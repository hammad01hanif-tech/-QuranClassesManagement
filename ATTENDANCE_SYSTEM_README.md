# 📋 دليل نظام حضور المعلمين - Attendance System Documentation

## 📌 نظرة عامة

نظام متكامل لإدارة حضور وانصراف المعلمين في مركز التحفيظ، مع حساب تلقائي للخصميات والرواتب.

---

## 🗂️ هيكل الملفات

```
QuranClasses-webProject/
│
├── config/
│   └── attendance-settings.js       # الإعدادات العامة للنظام
│
├── data/
│   └── teachers-attendance-config.js # بيانات المعلمين وإعداداتهم
│
├── js/
│   └── attendance-calculator.js     # دوال الحسابات والخصميات
│
└── ATTENDANCE_SYSTEM_README.md      # هذا الملف (التوثيق)
```

---

## 📦 الملفات الأساسية الثلاثة

### 1️⃣ `attendance-settings.js` - الإعدادات العامة

يحتوي على:
- ✅ **قواعد الدوام الافتراضية** (35 دقيقة بعد العصر، 30 دقيقة بعد العشاء)
- ✅ **نظام الخصميات** (5 ريال كل نصف ساعة)
- ✅ **أنواع حالات الحضور** (حاضر، غائب، متأخر، إلخ)
- ✅ **صلاحيات التعديل** (معلم، إدارة)
- ✅ **إعدادات الإشعارات**
- ✅ **رسائل النظام**

**مثال استخدام:**
```javascript
import { ATTENDANCE_SYSTEM_CONFIG, getSetting } from './config/attendance-settings.js';

// الحصول على قيمة خصمية التأخير
const latePenaltyAmount = getSetting('penaltySettings.latePenalty.amount'); // 5
```

---

### 2️⃣ `teachers-attendance-config.js` - بيانات المعلمين

يحتوي على:
- ✅ **معلومات كل معلم** (الاسم، المعرف، الحالة)
- ✅ **جدول العمل** (أيام العمل، أوقات الدوام)
- ✅ **الراتب والمكافآت**
- ✅ **الخصميات الخاصة** (لكل معلم نظام خاص)
- ✅ **الصلاحيات والإشعارات**

**مثال استخدام:**
```javascript
import { getTeacherConfig, getTeacherSalary } from './data/teachers-attendance-config.js';

// الحصول على إعدادات معلم
const teacher = getTeacherConfig('ABD01');
console.log(teacher.name); // "عبدالله بن محمد"
console.log(teacher.workSchedule.minutesAfterAsr); // 35

// الحصول على راتب معلم
const salary = getTeacherSalary('ABD01'); // 3000
```

---

### 3️⃣ `attendance-calculator.js` - دوال الحسابات

يحتوي على:
- ✅ **حساب أوقات الدوام** (بداية، نهاية، مدة)
- ✅ **حساب الخصميات** (تأخير، غياب، خروج مبكر)
- ✅ **التحقق من الحالات** (هل متأخر؟ هل خرج مبكراً؟)
- ✅ **دوال مساعدة** (تنسيق الوقت، التقريب)

**مثال استخدام:**
```javascript
import { 
  calculateWorkStartTime,
  calculateLatePenalty 
} from './js/attendance-calculator.js';

// حساب بداية الدوام
const asrTime = "15:40"; // 3:40 مساءً
const teacherId = "ABD01";
const workStart = calculateWorkStartTime(asrTime, teacherId);
// النتيجة: 4:15 مساءً (العصر + 35 دقيقة)

// حساب خصمية التأخير
const checkIn = new Date('2026-05-20T16:25:00'); // 4:25 مساءً
const workStartTime = new Date('2026-05-20T16:15:00'); // 4:15 مساءً
const penalty = calculateLatePenalty(checkIn, workStartTime, teacherId);
console.log(penalty);
// {
//   penalty: 5,        // 5 ريال
//   lateMinutes: 10,   // تأخر 10 دقائق
//   intervals: 1       // فترة واحدة (نصف ساعة)
// }
```

---

## 🎯 حالات الاستخدام

### 📍 الحالة 1: حساب بداية ونهاية الدوام

```javascript
import { getTodayPrayerTimes } from './js/prayer-times-local.js';
import { calculateWorkStartTime, calculateWorkEndTime } from './js/attendance-calculator.js';

async function getDailySchedule(teacherId) {
  // الحصول على مواقيت الصلاة
  const prayerTimes = await getTodayPrayerTimes();
  
  // حساب أوقات الدوام
  const workStart = calculateWorkStartTime(prayerTimes.asr, teacherId);
  const workEnd = calculateWorkEndTime(prayerTimes.isha, teacherId);
  
  return {
    start: workStart,
    end: workEnd,
    asr: prayerTimes.asr,
    isha: prayerTimes.isha
  };
}

// استخدام
getDailySchedule('ABD01').then(schedule => {
  console.log('العصر:', schedule.asr);           // 3:40 م
  console.log('بداية الدوام:', schedule.start);  // 4:15 م
  console.log('العشاء:', schedule.isha);         // 7:35 م
  console.log('نهاية الدوام:', schedule.end);    // 8:05 م
});
```

---

### 📍 الحالة 2: حساب الخصميات عند تسجيل الحضور

```javascript
import { 
  calculateWorkStartTime,
  calculateLatePenalty,
  isLate 
} from './js/attendance-calculator.js';

async function processCheckIn(teacherId, checkInTime) {
  // الحصول على وقت بداية الدوام
  const prayerTimes = await getTodayPrayerTimes();
  const workStart = calculateWorkStartTime(prayerTimes.asr, teacherId);
  
  // التحقق من التأخير
  if (isLate(checkInTime, workStart, teacherId)) {
    // حساب الخصمية
    const penaltyData = calculateLatePenalty(checkInTime, workStart, teacherId);
    
    console.log('⚠️ متأخر!');
    console.log('مدة التأخير:', penaltyData.lateMinutes, 'دقيقة');
    console.log('الخصمية:', penaltyData.penalty, 'ريال');
    
    return {
      status: 'late',
      checkInTime,
      lateDeduction: penaltyData.penalty
    };
  } else {
    console.log('✅ حضور في الموعد');
    return {
      status: 'on_time',
      checkInTime,
      lateDeduction: 0
    };
  }
}

// استخدام
const checkInTime = new Date('2026-05-20T16:30:00'); // 4:30 مساءً
processCheckIn('ABD01', checkInTime);
```

---

### 📍 الحالة 3: حساب خصمية الغياب

```javascript
import { calculateAbsencePenalty } from './js/attendance-calculator.js';
import { getMonthlyReport } from './js/study-days-calendar.js';

function processAbsence(teacherId, isExcused = false) {
  // الحصول على عدد أيام الدراسة في الشهر
  const today = new Date();
  const report = getMonthlyReport(today.getFullYear(), today.getMonth() + 1);
  const studyDays = report.studyDays;
  
  // حساب خصمية الغياب
  const penalty = calculateAbsencePenalty(teacherId, isExcused, studyDays);
  
  return {
    status: isExcused ? 'excused' : 'absent',
    absenceDeduction: penalty,
    studyDaysInMonth: studyDays
  };
}

// استخدام
const absence1 = processAbsence('ABD01', false); // غياب بدون عذر
console.log(absence1.absenceDeduction); // 100 ريال (3000 ÷ 30)

const absence2 = processAbsence('ABD01', true); // غياب بعذر
console.log(absence2.absenceDeduction); // 0 ريال
```

---

### 📍 الحالة 4: حساب خصمية الخروج المبكر

```javascript
import { 
  calculateWorkEndTime,
  calculateEarlyLeavePenalty,
  isEarlyLeave 
} from './js/attendance-calculator.js';

async function processCheckOut(teacherId, checkOutTime) {
  // الحصول على وقت نهاية الدوام
  const prayerTimes = await getTodayPrayerTimes();
  const workEnd = calculateWorkEndTime(prayerTimes.isha, teacherId);
  
  // التحقق من الخروج المبكر
  if (isEarlyLeave(checkOutTime, workEnd, teacherId)) {
    // حساب الخصمية
    const penaltyData = calculateEarlyLeavePenalty(checkOutTime, workEnd, teacherId);
    
    console.log('⚠️ خروج مبكر!');
    console.log('مدة الخروج المبكر:', penaltyData.earlyMinutes, 'دقيقة');
    console.log('الخصمية:', penaltyData.penalty, 'ريال');
    
    return {
      status: 'early_leave',
      checkOutTime,
      earlyLeaveDeduction: penaltyData.penalty
    };
  } else {
    console.log('✅ انصراف في الموعد');
    return {
      status: 'on_time',
      checkOutTime,
      earlyLeaveDeduction: 0
    };
  }
}
```

---

### 📍 الحالة 5: حساب الخصميات الكلية لليوم

```javascript
import { calculateTotalDailyPenalties } from './js/attendance-calculator.js';

function calculateDayTotal(attendanceData, teacherId) {
  // البيانات المطلوبة
  const data = {
    status: 'present', // أو 'absent'
    checkInTime: new Date('2026-05-20T16:30:00'),
    checkOutTime: new Date('2026-05-20T19:50:00'),
    workStartTime: new Date('2026-05-20T16:15:00'),
    workEndTime: new Date('2026-05-20T20:05:00'),
    isExcused: false,
    studyDaysInMonth: 20
  };
  
  // حساب الخصميات
  const penalties = calculateTotalDailyPenalties(data, teacherId);
  
  console.log('الخصميات:');
  console.log('- التأخير:', penalties.breakdown.late, 'ريال');
  console.log('- الخروج المبكر:', penalties.breakdown.earlyLeave, 'ريال');
  console.log('- الغياب:', penalties.breakdown.absence, 'ريال');
  console.log('الإجمالي:', penalties.total, 'ريال');
  
  return penalties;
}
```

---

## 🔄 التكامل مع Firebase

### حفظ بيانات الحضور

```javascript
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { calculateLatePenalty, calculateWorkStartTime } from './js/attendance-calculator.js';

async function saveCheckInToFirebase(teacherId, checkInTime, notes) {
  // حساب الخصمية
  const prayerTimes = await getTodayPrayerTimes();
  const workStart = calculateWorkStartTime(prayerTimes.asr, teacherId);
  const penaltyData = calculateLatePenalty(checkInTime, workStart, teacherId);
  
  // تحضير البيانات
  const dateStr = new Date().toISOString().split('T')[0];
  const docId = `${teacherId}_${dateStr}`;
  
  // الحفظ في Firestore
  const attendanceRef = doc(db, 'teacherAttendance', docId);
  await setDoc(attendanceRef, {
    teacherId,
    date: dateStr,
    checkInTime: serverTimestamp(),
    checkInNotes: notes,
    lateMinutes: penaltyData.lateMinutes,
    lateDeduction: penaltyData.penalty,
    workStartTime: workStart.toISOString(),
    status: penaltyData.lateMinutes > 0 ? 'late' : 'present',
    updatedAt: serverTimestamp()
  });
  
  console.log('✅ تم حفظ الحضور في Firebase');
}
```

---

## 📊 أمثلة على المعلمين الخمسة

### المعلم 1: عبدالله (النظام القياسي)

```javascript
const teacher1 = getTeacherConfig('ABD01');

// البيانات:
// - الراتب: 3000 ريال
// - بداية الدوام: العصر + 35 دقيقة
// - نهاية الدوام: العشاء + 30 دقيقة
// - خصمية التأخير: 5 ريال/30 دقيقة
// - خصمية الغياب: 3000 ÷ 30 = 100 ريال
```

**سيناريو:**
- العصر: 3:40 م → بداية الدوام: 4:15 م
- حضر: 4:30 م → تأخر 15 دقيقة → خصم 5 ريال
- العشاء: 7:35 م → نهاية الدوام: 8:05 م
- انصرف: 8:00 م → خرج مبكراً 5 دقائق → لا خصم (ضمن السماح)

---

### المعلم 2: خالد (لديه استثناءات)

```javascript
const teacher2 = getTeacherConfig('KHL01');

// البيانات:
// - الراتب: 3500 ريال
// - بداية الدوام: العصر + 45 دقيقة (أكثر سماحاً)
// - نهاية الدوام: العشاء + 15 دقيقة فقط
// - خصمية الخروج المبكر: معطلة
// - غياب بعذر: 50 ريال (مع العذر)
```

**سيناريو:**
- العصر: 3:40 م → بداية الدوام: 4:25 م
- حضر: 4:40 م → تأخر 15 دقيقة → 10 دقائق سماح → تأخر فعلي 5 دقائق → خصم 5 ريال
- العشاء: 7:35 م → نهاية الدوام: 7:50 م
- انصرف: 7:45 م → لا خصم (معطل)

---

### المعلم 3: محمد (دوام جزئي)

```javascript
const teacher3 = getTeacherConfig('MHD01');

// البيانات:
// - الراتب: 2000 ريال
// - بداية الدوام: العصر + 60 دقيقة
// - نهاية الدوام: العشاء مباشرة
// - أيام العمل: الأحد - الثلاثاء - الخميس فقط
// - خصمية الغياب: 2000 ÷ أيام الدراسة
```

---

### المعلم 4: أحمد (أوقات ثابتة)

```javascript
const teacher4 = getTeacherConfig('AHM01');

// البيانات:
// - الراتب: 4000 ريال
// - أوقات ثابتة: 4:00 م - 8:30 م (لا يتبع الصلاة)
// - خصمية التأخير: 10 ريال/15 دقيقة (ضعف العادي)
// - خصمية الغياب: 150 ريال ثابت
```

---

## 🎨 رسائل النظام

استخدام رسائل النظام الجاهزة:

```javascript
import { SYSTEM_MESSAGES } from './config/attendance-settings.js';

// رسائل النجاح
alert(SYSTEM_MESSAGES.success.checkInSuccess); // ✅ تم تسجيل الحضور بنجاح

// رسائل التحذير
alert(SYSTEM_MESSAGES.warning.lateArrival); // ⚠️ أنت متأخر، سيتم احتساب خصمية التأخير

// رسائل الأخطاء
alert(SYSTEM_MESSAGES.error.alreadyCheckedIn); // ❌ لقد سجلت حضورك مسبقاً اليوم
```

---

## 📈 التقارير والإحصائيات

### تقرير شهري لمعلم

```javascript
import { collection, query, where, getDocs } from 'firebase/firestore';
import { calculateAttendancePercentage } from './js/attendance-calculator.js';

async function generateMonthlyReport(teacherId, year, month) {
  // جلب البيانات من Firebase
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  
  const q = query(
    collection(db, 'teacherAttendance'),
    where('teacherId', '==', teacherId),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );
  
  const snapshot = await getDocs(q);
  
  // تحليل البيانات
  let totalDays = 0;
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let totalPenalties = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    totalDays++;
    
    if (data.status === 'present' || data.status === 'late') {
      presentDays++;
      if (data.lateDeduction > 0) lateDays++;
    } else if (data.status === 'absent') {
      absentDays++;
    }
    
    totalPenalties += (data.lateDeduction || 0) + (data.earlyLeaveDeduction || 0) + (data.absenceDeduction || 0);
  });
  
  // حساب النسب
  const attendancePercentage = calculateAttendancePercentage(presentDays, totalDays);
  
  return {
    teacherId,
    month,
    year,
    totalDays,
    presentDays,
    lateDays,
    absentDays,
    attendancePercentage,
    totalPenalties,
    netSalary: getTeacherSalary(teacherId) - totalPenalties
  };
}

// استخدام
generateMonthlyReport('ABD01', 2026, 5).then(report => {
  console.log('📊 تقرير شهر', report.month);
  console.log('إجمالي الأيام:', report.totalDays);
  console.log('أيام الحضور:', report.presentDays);
  console.log('أيام التأخير:', report.lateDays);
  console.log('أيام الغياب:', report.absentDays);
  console.log('نسبة الحضور:', report.attendancePercentage + '%');
  console.log('إجمالي الخصميات:', report.totalPenalties, 'ريال');
  console.log('صافي الراتب:', report.netSalary, 'ريال');
});
```

---

## 🔧 التخصيص والتوسع

### إضافة معلم جديد

1. افتح `data/teachers-attendance-config.js`
2. أضف كائن جديد في `TEACHERS_ATTENDANCE_CONFIG`:

```javascript
{
  id: 'NEW01',
  name: 'اسم المعلم الجديد',
  shortName: 'الاسم المختصر',
  active: true,
  
  workSchedule: {
    minutesAfterAsr: 35,
    minutesAfterIsha: 30,
    workDays: [0, 1, 2, 3, 4],
    followsPrayerTimes: true,
    fixedStartTime: null,
    fixedEndTime: null,
  },
  
  salary: {
    monthlySalary: 3000,
    currency: 'SAR',
    overtimeRate: 50,
    bonuses: {
      attendanceBonus: 200,
      performanceBonus: 0,
    },
  },
  
  // ... باقي الإعدادات
}
```

---

### تعديل قواعد الخصميات

لتغيير قيمة خصمية التأخير لجميع المعلمين:

```javascript
// في attendance-settings.js
penaltySettings: {
  latePenalty: {
    amount: 10, // غيّر من 5 إلى 10 ريال
    intervalMinutes: 15, // غيّر من 30 إلى 15 دقيقة
    // ...
  }
}
```

لتغيير قيمة خصمية معلم واحد فقط، عدّل في `teachers-attendance-config.js`.

---

## 🔐 الأمان والصلاحيات

استخدام صلاحيات التعديل:

```javascript
import { EDIT_PERMISSIONS } from './config/attendance-settings.js';

function canEditAttendance(userRole, isOwnAttendance) {
  if (userRole === 'admin') {
    return EDIT_PERMISSIONS.ADMIN.canEditAnyAttendance; // true
  }
  
  if (userRole === 'teacher' && isOwnAttendance) {
    return EDIT_PERMISSIONS.TEACHER.canEditOwnAttendance; // false
  }
  
  return false;
}
```

---

## 📱 التكامل مع واجهات المستخدم

### في صفحة تسجيل الحضور (teacher.js)

```javascript
import { 
  calculateWorkStartTime,
  calculateLatePenalty 
} from './attendance-calculator.js';
import { getTeacherConfig } from '../data/teachers-attendance-config.js';

// استخدام في loadTeacherAttendanceSection
const teacherId = sessionStorage.getItem('loggedInTeacher');
const teacher = getTeacherConfig(teacherId);

// عرض البيانات في الواجهة
document.getElementById('teacherName').textContent = teacher.name;
document.getElementById('monthlySalary').textContent = teacher.salary.monthlySalary + ' ريال';
```

---

## ⚡ نصائح للأداء

1. **التخزين المؤقت (Caching):**
   ```javascript
   let cachedPrayerTimes = null;
   
   async function getCachedPrayerTimes() {
     if (!cachedPrayerTimes) {
       cachedPrayerTimes = await getTodayPrayerTimes();
     }
     return cachedPrayerTimes;
   }
   ```

2. **تجميع الاستعلامات:**
   بدلاً من استدعاء `getTeacherConfig` عدة مرات، احتفظ بالنتيجة في متغير.

3. **الحسابات على الخادم:**
   للأمان، قم بإعادة حساب الخصميات على الخادم (Firebase Cloud Functions).

---

## 🚀 الخطوات القادمة

- [ ] إنشاء واجهة إدارة لتعديل الإعدادات
- [ ] إضافة نظام الموافقات للأعذار
- [ ] تقارير متقدمة (PDF, Excel)
- [ ] إشعارات تلقائية (Email, SMS)
- [ ] تكامل مع نظام الرواتب
- [ ] نظام الساعات الإضافية
- [ ] لوحة تحكم للإحصائيات

---

## 📞 الدعم

للمساعدة أو الاستفسارات، راجع التوثيق في الملفات الأساسية الثلاثة.

---

**آخر تحديث:** مايو 2026  
**الإصدار:** 1.0.0

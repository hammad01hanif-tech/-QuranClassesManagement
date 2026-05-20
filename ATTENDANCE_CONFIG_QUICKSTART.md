# ⚙️ نظام إعدادات حضور المعلمين - Quick Start

## 📂 البنية السريعة

```
📁 QuranClasses-webProject/
├── 📁 config/
│   └── attendance-settings.js      ← الإعدادات العامة
│
├── 📁 data/
│   └── teachers-attendance-config.js ← بيانات المعلمين
│
├── 📁 js/
│   └── attendance-calculator.js    ← دوال الحسابات
│
├── 📄 ATTENDANCE_SYSTEM_README.md  ← التوثيق الشامل
└── 📄 ATTENDANCE_EXAMPLES.md       ← الأمثلة العملية
```

---

## ⚡ البداية السريعة

### 1️⃣ استيراد الإعدادات

```javascript
import { ATTENDANCE_SYSTEM_CONFIG } from './config/attendance-settings.js';
import { getTeacherConfig } from './data/teachers-attendance-config.js';
import { calculateLatePenalty } from './js/attendance-calculator.js';
```

### 2️⃣ الحصول على بيانات معلم

```javascript
const teacher = getTeacherConfig('ABD01');
console.log(teacher.name);                              // "عبدالله بن محمد"
console.log(teacher.salary.monthlySalary);              // 3000
console.log(teacher.workSchedule.minutesAfterAsr);      // 35
```

### 3️⃣ حساب خصمية التأخير

```javascript
const checkIn = new Date('2026-05-20T16:30:00');        // 4:30 م
const workStart = new Date('2026-05-20T16:15:00');      // 4:15 م

const penalty = calculateLatePenalty(checkIn, workStart, 'ABD01');
console.log(penalty.penalty);       // 5 ريال
console.log(penalty.lateMinutes);   // 15 دقيقة
```

---

## 📋 المعلمون الخمسة

| المعرف | الاسم | الراتب | بداية الدوام | نهاية الدوام | ملاحظات |
|-------|------|--------|-------------|-------------|---------|
| `ABD01` | عبدالله | 3000 | العصر+35د | العشاء+30د | نظام قياسي |
| `KHL01` | خالد | 3500 | العصر+45د | العشاء+15د | سماح إضافي |
| `MHD01` | محمد | 2000 | العصر+60د | العشاء+0د | دوام جزئي |
| `AHM01` | أحمد | 4000 | 4:00م ثابت | 8:30م ثابت | أوقات ثابتة |
| `YSF01` | يوسف | 0 | - | - | احتياطي (غير نشط) |

---

## 🎯 الدوال الأساسية

### دوال الأوقات

```javascript
calculateWorkStartTime(asrTime, teacherId)      // حساب بداية الدوام
calculateWorkEndTime(ishaTime, teacherId)       // حساب نهاية الدوام
calculateWorkDuration(checkIn, checkOut)        // حساب مدة العمل
calculateLateMinutes(checkIn, workStart)        // حساب دقائق التأخير
calculateEarlyLeaveMinutes(checkOut, workEnd)   // حساب دقائق الخروج المبكر
```

### دوال الخصميات

```javascript
calculateLatePenalty(checkIn, workStart, teacherId)           // خصمية التأخير
calculateAbsencePenalty(teacherId, isExcused, studyDays)      // خصمية الغياب
calculateEarlyLeavePenalty(checkOut, workEnd, teacherId)      // خصمية الخروج المبكر
calculateTotalDailyPenalties(attendanceData, teacherId)       // إجمالي اليوم
```

### دوال التحقق

```javascript
isLate(checkIn, workStart, teacherId)           // هل متأخر؟
isEarlyLeave(checkOut, workEnd, teacherId)      // هل خرج مبكراً؟
hasMinimumWorkDuration(checkIn, checkOut)       // هل المدة كافية؟
```

---

## 💰 قواعد الخصميات الافتراضية

```javascript
// خصمية التأخير
5 ريال لكل 30 دقيقة

// خصمية الغياب
الراتب ÷ 30

// خصمية الخروج المبكر
5 ريال لكل 30 دقيقة (سماح 5 دقائق)
```

---

## 📖 للمزيد

- **التوثيق الشامل:** [ATTENDANCE_SYSTEM_README.md](ATTENDANCE_SYSTEM_README.md)
- **الأمثلة العملية:** [ATTENDANCE_EXAMPLES.md](ATTENDANCE_EXAMPLES.md)

---

## 🚀 الاستخدام في المشروع

### في صفحة المعلم (teacher.js)

```javascript
import { 
  calculateWorkStartTime,
  calculateLatePenalty 
} from './attendance-calculator.js';
import { getTodayPrayerTimes } from './prayer-times-local.js';

// حساب أوقات الدوام
const prayerTimes = await getTodayPrayerTimes();
const workStart = calculateWorkStartTime(prayerTimes.asr, teacherId);

// عرض في الواجهة
document.getElementById('shiftStartTime').textContent = formatTime(workStart);
```

### في صفحة الإدارة (admin.js)

```javascript
import { getActiveTeachers } from '../data/teachers-attendance-config.js';
import { calculateTotalDailyPenalties } from './attendance-calculator.js';

// جلب جميع المعلمين النشطين
const teachers = getActiveTeachers();

// حساب خصميات كل معلم
teachers.forEach(teacher => {
  const penalties = calculateTotalDailyPenalties(attendanceData, teacher.id);
  console.log(`${teacher.name}: ${penalties.total} ريال`);
});
```

---

## ✅ الخطوات التالية

- [ ] ربط مع صفحة تسجيل الحضور الحالية
- [ ] إنشاء واجهة إدارة لتعديل الإعدادات
- [ ] حفظ بيانات المعلمين في Firebase
- [ ] تقارير شهرية تلقائية
- [ ] إشعارات البريد الإلكتروني

---

**تم إنشاء النظام:** مايو 2026  
**الحالة:** جاهز للاستخدام ✅

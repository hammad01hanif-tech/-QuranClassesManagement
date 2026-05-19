# 📅 نظام أيام الدراسة والإجازات
**Study Days and Holidays Calendar System**

---

## 📋 نظرة عامة

نظام متكامل لإدارة أيام الدراسة والإجازات في حلقات تحفيظ القرآن الكريم. يوفر النظام:
- ✅ تحديد أيام الدراسة (الأحد - الخميس)
- 🏖️ تحديد أيام الإجازة الأسبوعية (الجمعة - السبت)
- 🎉 إدارة الإجازات الرسمية والأعياد
- 📊 حساب أيام الدراسة بين تاريخين
- 📈 إحصائيات شهرية وسنوية

---

## 📁 الملفات المتوفرة

### 1. **js/study-days-calendar.js**
الملف الرئيسي للنظام - يحتوي على جميع الدوال والمنطق:
```javascript
import { isStudyDay, getDayInfo, getTodayInfo } from './js/study-days-calendar.js';
```

### 2. **data/study-days-2026-2027.json**
ملف البيانات يحتوي على:
- الإجازات الرسمية (عيد الفطر، عيد الأضحى، اليوم الوطني، يوم التأسيس)
- إحصائيات شهرية
- معلومات التغطية الزمنية

### 3. **test-study-days.html**
صفحة اختبار تفاعلية لتجربة النظام ورؤية أمثلة عملية

---

## 🎯 قواعد النظام

### أيام الدراسة 📚
- **الأحد** (Sunday - 0)
- **الإثنين** (Monday - 1)
- **الثلاثاء** (Tuesday - 2)
- **الأربعاء** (Wednesday - 3)
- **الخميس** (Thursday - 4)

### أيام الإجازة الأسبوعية 🏖️
- **الجمعة** (Friday - 5)
- **السبت** (Saturday - 6)

### الإجازات الرسمية 🎉
1. **عيد الفطر**: 12 يوم (25 رمضان - 6 شوال)
2. **عيد الأضحى**: 11 يوم (5 ذو الحجة - 15 ذو الحجة)
3. **يوم التأسيس**: 22 فبراير
4. **اليوم الوطني**: 23 سبتمبر

---

## 💻 الدوال المتاحة

### 1. فحص الأيام

#### `isStudyDay(date)`
فحص إذا كان التاريخ المحدد يوم دراسة
```javascript
import { isStudyDay } from './js/study-days-calendar.js';

const today = new Date();
if (isStudyDay(today)) {
  console.log('اليوم يوم دراسة ✅');
} else {
  console.log('اليوم إجازة ❌');
}

// يمكن استخدام نص التاريخ أيضاً
if (isStudyDay('2026-05-19')) {
  console.log('يوم دراسة');
}
```

#### `isWeekend(date)`
فحص إذا كان التاريخ جمعة أو سبت
```javascript
import { isWeekend } from './js/study-days-calendar.js';

if (isWeekend(new Date())) {
  console.log('اليوم إجازة أسبوعية');
}
```

#### `isOfficialHoliday(date)`
فحص إذا كان التاريخ في إجازة رسمية (عيد أو يوم وطني)
```javascript
import { isOfficialHoliday } from './js/study-days-calendar.js';

if (isOfficialHoliday('2026-05-19')) {
  console.log('اليوم في إجازة رسمية');
}
```

---

### 2. معلومات الأيام

#### `getDayInfo(date)`
الحصول على معلومات كاملة عن يوم معين
```javascript
import { getDayInfo } from './js/study-days-calendar.js';

const info = getDayInfo(new Date());
console.log(info);
/*
{
  gregorianDate: "2026-05-19",
  hijriDate: "21 ذو الحجة 1447هـ",
  hijriDay: 21,
  hijriMonth: 12,
  hijriYear: 1447,
  dayOfWeek: 2,
  dayNameArabic: "الثلاثاء",
  dayNameEnglish: "Tuesday",
  isStudyDay: false,
  isWeekend: false,
  isOfficialHoliday: true,
  holidayInfo: {
    name: "عيد الأضحى",
    startGregorian: "2026-05-18",
    endGregorian: "2026-05-28"
  },
  status: "إجازة رسمية",
  statusEn: "Official Holiday"
}
*/
```

#### `getTodayInfo()`
معلومات اليوم الحالي
```javascript
import { getTodayInfo } from './js/study-days-calendar.js';

const today = getTodayInfo();
console.log(`اليوم ${today.dayNameArabic} - ${today.status}`);
```

#### `getHolidayInfo(date)`
معلومات الإجازة إذا كان التاريخ في إجازة رسمية
```javascript
import { getHolidayInfo } from './js/study-days-calendar.js';

const holiday = getHolidayInfo('2026-05-19');
if (holiday) {
  console.log(`إجازة: ${holiday.name}`);
  console.log(`المدة: ${holiday.durationDays} يوم`);
}
```

---

### 3. الإحصائيات والحسابات

#### `countStudyDays(startDate, endDate)`
حساب عدد أيام الدراسة بين تاريخين
```javascript
import { countStudyDays } from './js/study-days-calendar.js';

const start = new Date('2026-05-01');
const end = new Date('2026-05-31');
const count = countStudyDays(start, end);
console.log(`عدد أيام الدراسة في مايو: ${count} يوم`);
```

#### `countHolidays(startDate, endDate)`
حساب عدد أيام الإجازة بأنواعها
```javascript
import { countHolidays } from './js/study-days-calendar.js';

const holidays = countHolidays('2026-05-01', '2026-05-31');
console.log(`إجمالي الإجازات: ${holidays.total}`);
console.log(`إجازات أسبوعية: ${holidays.weekends}`);
console.log(`إجازات رسمية: ${holidays.officialHolidays}`);
```

#### `getStudyDaysInMonth(year, month)`
الحصول على جميع أيام الدراسة في شهر معين
```javascript
import { getStudyDaysInMonth } from './js/study-days-calendar.js';

const studyDays = getStudyDaysInMonth(2026, 5); // مايو 2026
console.log(`عدد أيام الدراسة: ${studyDays.length}`);

studyDays.forEach(day => {
  console.log(`${day.date} - ${day.dayInfo.dayNameArabic}`);
});
```

#### `getHolidaysInMonth(year, month)`
الحصول على جميع أيام الإجازة في شهر معين
```javascript
import { getHolidaysInMonth } from './js/study-days-calendar.js';

const holidays = getHolidaysInMonth(2026, 5);
holidays.forEach(day => {
  console.log(`${day.date} - ${day.dayInfo.status}`);
});
```

#### `getMonthlyReport(year, month)`
تقرير شامل لشهر معين
```javascript
import { getMonthlyReport } from './js/study-days-calendar.js';

const report = getMonthlyReport(2026, 5);
console.log(`إحصائيات مايو 2026:`);
console.log(`إجمالي الأيام: ${report.totalDays}`);
console.log(`أيام دراسة: ${report.studyDaysCount}`);
console.log(`إجازات أسبوعية: ${report.weekendsCount}`);
console.log(`إجازات رسمية: ${report.officialHolidaysCount}`);
```

---

### 4. التنقل بين الأيام

#### `getNextStudyDay(date)`
الحصول على يوم الدراسة التالي
```javascript
import { getNextStudyDay } from './js/study-days-calendar.js';

const today = new Date();
const nextStudy = getNextStudyDay(today);
console.log(`يوم الدراسة القادم: ${nextStudy.toLocaleDateString('ar-SA')}`);
```

#### `getPreviousStudyDay(date)`
الحصول على يوم الدراسة السابق
```javascript
import { getPreviousStudyDay } from './js/study-days-calendar.js';

const today = new Date();
const prevStudy = getPreviousStudyDay(today);
console.log(`يوم الدراسة السابق: ${prevStudy.toLocaleDateString('ar-SA')}`);
```

#### `getUpcomingHolidays(fromDate)`
قائمة الإجازات الرسمية القادمة
```javascript
import { getUpcomingHolidays } from './js/study-days-calendar.js';

const upcoming = getUpcomingHolidays();
upcoming.forEach(holiday => {
  console.log(`${holiday.name}: ${holiday.startGregorian} (${holiday.durationDays} يوم)`);
});
```

---

## 🎨 أمثلة عملية

### مثال 1: عرض حالة اليوم
```javascript
import { getTodayInfo } from './js/study-days-calendar.js';

const today = getTodayInfo();

let statusEmoji = '✅';
let statusColor = '#28a745';

if (today.isWeekend) {
  statusEmoji = '🏖️';
  statusColor = '#ffc107';
} else if (today.isOfficialHoliday) {
  statusEmoji = '🎉';
  statusColor = '#dc3545';
}

document.getElementById('status').innerHTML = `
  <div style="color: ${statusColor};">
    ${statusEmoji} ${today.status}
    <br>
    ${today.dayNameArabic} - ${today.gregorianDate}
    <br>
    ${today.hijriDate}
  </div>
`;
```

### مثال 2: حساب الحضور الشهري
```javascript
import { getStudyDaysInMonth, countStudyDays } from './js/study-days-calendar.js';

// الأيام التي حضر فيها الطالب
const attendedDates = [
  '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-05-06', '2026-05-07', '2026-05-10'
];

// إجمالي أيام الدراسة في الشهر
const totalStudyDays = getStudyDaysInMonth(2026, 5).length;

// عدد أيام الحضور
const attendedDays = attendedDates.length;

// نسبة الحضور
const attendanceRate = (attendedDays / totalStudyDays * 100).toFixed(1);

console.log(`أيام الدراسة المتاحة: ${totalStudyDays}`);
console.log(`أيام الحضور: ${attendedDays}`);
console.log(`نسبة الحضور: ${attendanceRate}%`);
```

### مثال 3: فلترة التقارير - أيام الدراسة فقط
```javascript
import { isStudyDay } from './js/study-days-calendar.js';

// سجل حضور الطلاب
const attendanceRecords = [
  { date: '2026-05-01', present: true },  // جمعة - إجازة
  { date: '2026-05-02', present: true },  // سبت - إجازة
  { date: '2026-05-03', present: true },  // أحد - دراسة
  { date: '2026-05-04', present: false }, // إثنين - دراسة
];

// فلترة أيام الدراسة فقط
const studyDayRecords = attendanceRecords.filter(record => 
  isStudyDay(record.date)
);

console.log('سجل الحضور (أيام الدراسة فقط):');
studyDayRecords.forEach(record => {
  console.log(`${record.date}: ${record.present ? 'حاضر' : 'غائب'}`);
});
```

### مثال 4: تنبيه بالإجازات القادمة
```javascript
import { getUpcomingHolidays, getDayInfo } from './js/study-days-calendar.js';

const upcoming = getUpcomingHolidays();

if (upcoming.length > 0) {
  const nextHoliday = upcoming[0];
  const startDate = new Date(nextHoliday.startGregorian);
  const today = new Date();
  const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
  
  if (daysUntil <= 7) {
    console.log(`⚠️ تنبيه: إجازة ${nextHoliday.name} بعد ${daysUntil} يوم`);
  }
}
```

---

## 🔗 التكامل مع النظام

### استخدام مع حضور المعلمين
```javascript
import { isStudyDay, getTodayInfo } from './js/study-days-calendar.js';

function recordTeacherAttendance(teacherId) {
  const today = getTodayInfo();
  
  if (!today.isStudyDay) {
    alert(`❌ لا يمكن تسجيل الحضور - اليوم ${today.status}`);
    return false;
  }
  
  // تسجيل الحضور في Firestore
  const attendanceData = {
    teacherId: teacherId,
    date: today.gregorianDate,
    hijriDate: today.hijriDate,
    dayName: today.dayNameArabic,
    timestamp: new Date()
  };
  
  // حفظ في قاعدة البيانات...
  return true;
}
```

### حساب رواتب المعلمين
```javascript
import { countStudyDays, isStudyDay } from './js/study-days-calendar.js';

async function calculateTeacherSalary(teacherId, year, month) {
  // إجمالي أيام الدراسة في الشهر
  const totalStudyDays = countStudyDays(
    new Date(year, month - 1, 1),
    new Date(year, month, 0)
  );
  
  // جلب سجل حضور المعلم من Firestore
  const attendanceRecords = await getTeacherAttendance(teacherId, year, month);
  
  // عد أيام الحضور (أيام الدراسة فقط)
  const attendedDays = attendanceRecords.filter(record => 
    record.present && isStudyDay(record.date)
  ).length;
  
  // حساب أيام الغياب
  const absentDays = totalStudyDays - attendedDays;
  
  // الراتب الأساسي
  const baseSalary = 3000;
  
  // خصم الغياب (100 ريال لكل يوم)
  const deduction = absentDays * 100;
  
  // الراتب النهائي
  const finalSalary = baseSalary - deduction;
  
  return {
    baseSalary,
    totalStudyDays,
    attendedDays,
    absentDays,
    deduction,
    finalSalary
  };
}
```

---

## 📊 الإحصائيات المتاحة

### ملف study-days-2026-2027.json يوفر:

```json
{
  "coverage": {
    "startDate": "2026-05-01",
    "endDate": "2027-12-31",
    "totalDays": 610,
    "studyDays": 428,
    "weekends": 174,
    "officialHolidays": 8
  }
}
```

### إحصائيات لكل شهر:
- إجمالي الأيام
- عدد أيام الدراسة
- عدد الإجازات الأسبوعية
- عدد الإجازات الرسمية

---

## 🎯 حالات الاستخدام

### 1. نظام الحضور والغياب
- ✅ تسجيل الحضور فقط في أيام الدراسة
- ❌ منع التسجيل في الإجازات
- 📊 حساب نسب الحضور الصحيحة

### 2. نظام الرواتب
- 💰 حساب الراتب بناءً على أيام الدراسة الفعلية
- 📉 خصم الغياب في أيام الدراسة فقط
- 📈 تقارير شهرية دقيقة

### 3. التقارير والإحصائيات
- 📊 عدد أيام الدراسة الفعلية في الشهر
- 📈 نسب الحضور والغياب
- 📅 التخطيط للفعاليات والاختبارات

### 4. التخطيط والجدولة
- 📆 معرفة أيام الدراسة القادمة
- 🎉 التنبيه بالإجازات
- ⏭️ الحصول على يوم الدراسة التالي

---

## 🧪 الاختبار

### فتح صفحة الاختبار:
```
http://localhost:8000/test-study-days.html
```

الصفحة توفر:
- 📆 معلومات اليوم الحالي
- 📊 إحصائيات الشهر الحالي
- 🎉 الإجازات القادمة
- 🔍 اختبار أي تاريخ
- 📅 حساب أيام الدراسة بين تاريخين

---

## 📝 ملاحظات مهمة

1. **التقويم الهجري**: يستخدم النظام `accurateHijriDates` من ملف `accurate-hijri-dates.js` للحصول على التواريخ الهجرية الدقيقة

2. **التوافقية**: النظام يعمل تلقائياً لأي تاريخ في المستقبل بناءً على قواعد الأسبوع (أحد-خميس دراسة، جمعة-سبت إجازة)

3. **الإجازات الرسمية**: محددة مسبقاً في `officialHolidays` ويمكن تحديثها سنوياً

4. **الاستثناءات**: يمكن إضافة إجازات خاصة بالحلقة في مصفوفة `officialHolidays`

5. **الأداء**: جميع الدوال محسّنة للأداء وتعمل بسرعة حتى مع نطاقات تاريخية كبيرة

---

## 🔄 التحديثات المستقبلية

يمكن إضافة:
- ✨ إجازات مخصصة للحلقة (اختبارات، فعاليات، ...)
- 📱 تنبيهات تلقائية بالإجازات
- 📊 تقارير سنوية شاملة
- 🔄 مزامنة مع التقويم الدراسي الرسمي
- 🌙 حساب تلقائي لمواعيد الإجازات القمرية

---

## 📞 الدعم

للمزيد من المعلومات أو الاستفسارات حول النظام، راجع الملفات:
- `js/study-days-calendar.js` - الكود المصدري مع التوثيق
- `data/study-days-2026-2027.json` - بيانات الإجازات والإحصائيات
- `test-study-days.html` - أمثلة عملية تفاعلية

---

**النظام جاهز للاستخدام! ✅**

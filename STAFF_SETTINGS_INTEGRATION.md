# دليل الربط بين إعدادات الإدارة وصفحة المعلم
## Staff Settings Integration Guide

هذا المستند يوضح كيف تم ربط إعدادات المعلمين والطاقم (التي يديرها الإداري) مع جميع العمليات في صفحة المعلم بشكل مباشر من قاعدة البيانات.

---

## 📋 نظرة عامة

جميع الإعدادات التي يقوم الإداري بتعيينها في **قسم الإدارة > المزيد > إعدادات المعلمين والطاقم** يتم حفظها في:
- **Collection**: `staffSettings`
- **Document ID**: `staffId`

وتستخدم هذه الإعدادات مباشرة في:
1. ✅ صفحة المعلم - الصفحة الرئيسية (الإحصائيات)
2. ✅ تسجيل الحضور (خصمية التأخير + فترة السماح)
3. ✅ تسجيل الانصراف (خصمية الخروج المبكر + فترة السماح)
4. ✅ تسجيل الغياب (خصمية الغياب من الراتب)
5. ✅ السجل الشهري (عرض الراتب والخصميات والراتب المتوقع)

---

## 📊 1. صفحة المعلم - الإحصائيات الشهرية

### الموقع
**ملف**: `js/teacher.js`  
**دالة**: `loadTeacherHomeSection(container)` - **السطر 7870**

### التحديثات
```javascript
// قبل التعديل
const baseSalary = 1000; // Base salary in SAR (hardcoded)
const deductionPerDay = 50; // Deduction per absent day (hardcoded)

// بعد التعديل
const settings = await getStaffSettings(teacherId);
const baseSalary = settings.salary || 3000; // من قاعدة البيانات
const deductionPerDay = Math.round(baseSalary / 30); // محسوب من الراتب
```

### النتيجة
- الآن يتم جلب **الراتب الأساسي** من `staffSettings.salary` مباشرة
- يتم حساب **خصمية اليوم** تلقائياً: `راتب الشهر ÷ 30`
- يظهر **الراتب المتوقع** بناءً على الخصميات الفعلية

---

## ⏰ 2. تسجيل الحضور - خصمية التأخير

### الموقع
**ملف**: `js/teacher.js`  
**دالة**: `window.submitCheckIn()` - **السطر 9470-9495**

### التحديثات
```javascript
// قبل التعديل
const penaltySettings = settings.penalties?.latePenalty || { 
  enabled: true, 
  amount: 5, 
  intervalMinutes: 30, 
  maxDailyPenalty: 20 
};

// بعد التعديل
const penaltyRules = settings.penaltyRules || {
  latePenaltyAmount: 5,
  latePenaltyInterval: 30,
  lateDailyMaxPenalty: 0,
  lateGracePeriod: 10
};

// تطبيق فترة السماح (Grace Period)
const gracePeriod = penaltyRules.lateGracePeriod || 10;
const effectiveLateMinutes = Math.max(0, lateMinutes - gracePeriod);

if (effectiveLateMinutes > 0) {
  const intervals = Math.ceil(effectiveLateMinutes / penaltyRules.latePenaltyInterval);
  lateDeduction = intervals * penaltyRules.latePenaltyAmount;
  
  // تطبيق الحد الأقصى للخصمية اليومية
  if (penaltyRules.lateDailyMaxPenalty > 0) {
    lateDeduction = Math.min(lateDeduction, penaltyRules.lateDailyMaxPenalty);
  }
}
```

### كيف تعمل
1. **فترة السماح (Grace Period)**: إذا كان المعلم متأخر أقل من `lateGracePeriod` دقيقة، لا يتم الخصم
2. **حساب الفترات**: عدد الفترات = `(الدقائق بعد السماح) ÷ latePenaltyInterval`
3. **الخصمية**: `عدد الفترات × latePenaltyAmount`
4. **الحد الأقصى**: إذا تم تحديد `lateDailyMaxPenalty`، الخصمية لن تتجاوز هذا الحد

### مثال
- **إعدادات الإداري**:
  - مبلغ الخصمية: 5 ريال
  - فترة الخصمية: 30 دقيقة
  - فترة السماح: 10 دقائق
  - الحد الأقصى اليومي: 20 ريال

- **سيناريو 1**: المعلم تأخر 8 دقائق
  - الدقائق الفعلية = 8 - 10 = -2 (أقل من صفر)
  - **الخصمية = 0 ريال** ✅ (ضمن فترة السماح)

- **سيناريو 2**: المعلم تأخر 35 دقيقة
  - الدقائق الفعلية = 35 - 10 = 25 دقيقة
  - عدد الفترات = 25 ÷ 30 = 1 فترة (تقريب لأعلى)
  - **الخصمية = 1 × 5 = 5 ريال**

- **سيناريو 3**: المعلم تأخر 150 دقيقة (ساعتين ونصف)
  - الدقائق الفعلية = 150 - 10 = 140 دقيقة
  - عدد الفترات = 140 ÷ 30 = 5 فترات
  - الخصمية = 5 × 5 = 25 ريال
  - **الخصمية النهائية = 20 ريال** (الحد الأقصى)

---

## 🚪 3. تسجيل الانصراف - خصمية الخروج المبكر

### الموقع
**ملف**: `js/teacher.js`  
**دالة**: `window.submitCheckOut()` - **السطر 9690-9720**

### التحديثات
```javascript
// قبل التعديل
const penaltySettings = settings.penalties?.earlyLeavePenalty || { 
  enabled: true, 
  amount: 5, 
  intervalMinutes: 30 
};

if (penaltySettings.enabled) {
  const intervals = Math.ceil(earlyMinutes / penaltySettings.intervalMinutes);
  earlyLeaveDeduction = intervals * penaltySettings.amount;
}

// بعد التعديل
const penaltyRules = settings.penaltyRules || {
  earlyLeaveEnabled: true,
  earlyLeavePenaltyAmount: 5,
  earlyLeavePenaltyInterval: 30,
  earlyLeaveGracePeriod: 5
};

// التحقق من تفعيل الخصمية
if (penaltyRules.earlyLeaveEnabled) {
  // تطبيق فترة السماح
  const gracePeriod = penaltyRules.earlyLeaveGracePeriod || 5;
  const effectiveEarlyMinutes = Math.max(0, earlyMinutes - gracePeriod);
  
  if (effectiveEarlyMinutes > 0) {
    const intervals = Math.ceil(effectiveEarlyMinutes / penaltyRules.earlyLeavePenaltyInterval);
    earlyLeaveDeduction = intervals * penaltyRules.earlyLeavePenaltyAmount;
  }
}
```

### كيف تعمل
1. **التحقق من التفعيل**: يتم الخصم فقط إذا كان `earlyLeaveEnabled = true`
2. **فترة السماح**: إذا خرج المعلم قبل الوقت بأقل من `earlyLeaveGracePeriod` دقيقة، لا يتم الخصم
3. **حساب الفترات**: عدد الفترات = `(الدقائق بعد السماح) ÷ earlyLeavePenaltyInterval`
4. **الخصمية**: `عدد الفترات × earlyLeavePenaltyAmount`

### مثال
- **إعدادات الإداري**:
  - تفعيل الخصمية: ✅ نعم
  - مبلغ الخصمية: 5 ريال
  - فترة الخصمية: 30 دقيقة
  - فترة السماح: 5 دقائق

- **سيناريو 1**: المعلم خرج قبل الوقت بـ 3 دقائق
  - الدقائق الفعلية = 3 - 5 = -2 (أقل من صفر)
  - **الخصمية = 0 ريال** ✅ (ضمن فترة السماح)

- **سيناريو 2**: المعلم خرج قبل الوقت بـ 40 دقيقة
  - الدقائق الفعلية = 40 - 5 = 35 دقيقة
  - عدد الفترات = 35 ÷ 30 = 2 فترة
  - **الخصمية = 2 × 5 = 10 ريال**

- **سيناريو 3**: الإداري عطّل الخصمية (`earlyLeaveEnabled = false`)
  - **الخصمية = 0 ريال** (حتى لو خرج مبكراً)

---

## ❌ 4. تسجيل الغياب - خصمية الغياب

### الموقع
**ملف**: `js/teacher.js`  
**دالة**: `window.submitAbsent()` - **السطر 9598-9607**

### التحديثات
```javascript
// قبل التعديل
const absencePenaltySettings = settings.penalties?.absencePenalty || { 
  enabled: true, 
  calculationMethod: 'salary_divided_by_30' 
};

if (absencePenaltySettings.enabled) {
  const monthlySalary = settings.salary?.monthlySalary || 3000;
  
  switch (absencePenaltySettings.calculationMethod) {
    case 'salary_divided_by_30':
      absenceDeduction = monthlySalary / 30;
      break;
    // ... more cases
  }
}

// بعد التعديل
const monthlySalary = settings.salary || 3000;

// حساب خصمية الغياب: (الراتب ÷ 30)
absenceDeduction = Math.round(monthlySalary / 30);
```

### كيف تعمل
- طريقة حساب موحدة: **الراتب الشهري ÷ 30**
- مثال: راتب 3000 ريال → خصمية اليوم = 100 ريال

### ملاحظة
- **الإجازات السنوية**: لا يتم الخصم عند استخدام الإجازة السنوية (يتم تحديثها تلقائياً في `staffSettings.vacationDays`)

---

## 📊 5. السجل الشهري - عرض الراتب والخصميات

### الموقع
**ملف**: `js/teacher.js`  
**دالة**: `loadAttendanceData(year, month, overrideStaffId)` - **السطر 8288-8294**

### التحديثات
```javascript
// إضافة حساب الراتب من staffSettings
const baseSalary = settings.salary || 3000;
const expectedSalary = baseSalary - totalDeductions;
```

### عرض الملخص النهائي
الآن يظهر في السجل الشهري:

| العنصر | القيمة | المصدر |
|--------|--------|--------|
| **الراتب الأساسي** | من `staffSettings.salary` | قاعدة البيانات |
| **عدد الغيابات** | محسوب من السجلات | `teacherAttendance` |
| **خصومات الغياب** | `عدد الغيابات × (راتب ÷ 30)` | محسوب |
| **خصومات التأخير** | مجموع `lateDeduction` | من السجلات |
| **خصومات الخروج المبكر** | مجموع `earlyLeaveDeduction` | من السجلات |
| **إجمالي الخصومات** | مجموع كل الخصميات | محسوب |
| **الراتب المتوقع** | `الراتب - إجمالي الخصومات` | محسوب |

### التنسيق (CSS)
- **الراتب الأساسي**: لون أزرق
- **الخصميات**: لون أحمر
- **الراتب المتوقع**: لون أخضر (بخلفية خضراء فاتحة)

الموقع: `styles.css` - **السطور 7098-7145**

---

## 📌 ملخص بنية staffSettings

### Collection: `staffSettings`
### Document ID: `staffId` (مثل: `teacher1`)

```javascript
{
  // معلومات أساسية
  staffId: "teacher1",
  staffName: "أحمد محمد",
  role: "teacher", // teacher | manager | admin
  
  // الراتب
  salary: 3000, // رقم مباشر (ليس object)
  
  // جدول العمل
  workSchedule: {
    minutesAfterAsr: 15,
    minutesAfterIsha: 5
  },
  
  // قواعد الخصميات
  penaltyRules: {
    // خصمية التأخير
    latePenaltyAmount: 5,       // مبلغ الخصمية لكل فترة
    latePenaltyInterval: 30,    // مدة الفترة بالدقائق
    lateDailyMaxPenalty: 0,     // الحد الأقصى اليومي (0 = بدون حد)
    lateGracePeriod: 10,        // فترة السماح بالدقائق
    
    // خصمية الخروج المبكر
    earlyLeaveEnabled: true,           // تفعيل/تعطيل
    earlyLeavePenaltyAmount: 5,        // مبلغ الخصمية
    earlyLeavePenaltyInterval: 30,     // مدة الفترة
    earlyLeaveGracePeriod: 5           // فترة السماح
  },
  
  // الإجازات السنوية
  vacationDays: {
    annual: 6,      // عدد الأيام السنوية
    used: 2,        // المستخدم
    remaining: 4    // المتبقي
  },
  
  // التواريخ
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## ✅ التحقق من الربط

### 1. اختبار الراتب في الصفحة الرئيسية
1. قم بتسجيل الدخول كإداري
2. افتح **قسم الإدارة > المزيد > إعدادات المعلمين والطاقم**
3. اختر معلم وقم بتعيين راتب معين (مثلاً: 4500 ريال)
4. احفظ الإعدادات
5. سجل خروج وادخل كمعلم
6. **النتيجة المتوقعة**: يظهر الراتب 4500 ريال في الإحصائيات

### 2. اختبار خصمية التأخير مع فترة السماح
1. في إعدادات المعلم، اضبط:
   - مبلغ الخصمية: 10 ريال
   - فترة الخصمية: 30 دقيقة
   - فترة السماح: 15 دقيقة
   - الحد الأقصى: 30 ريال
2. سجل حضور متأخر بـ 10 دقائق
3. **النتيجة المتوقعة**: لا يتم الخصم (ضمن فترة السماح)
4. سجل حضور متأخر بـ 50 دقيقة
5. **النتيجة المتوقعة**: خصمية = 10 ريال (50 - 15 = 35 دقيقة → فترة واحدة)

### 3. اختبار خصمية الخروج المبكر
1. في إعدادات المعلم، اضبط:
   - تفعيل: ✅ نعم
   - مبلغ الخصمية: 5 ريال
   - فترة الخصمية: 30 دقيقة
   - فترة السماح: 5 دقائق
2. سجل انصراف قبل الوقت بـ 3 دقائق
3. **النتيجة المتوقعة**: لا يتم الخصم (ضمن فترة السماح)
4. سجل انصراف قبل الوقت بـ 40 دقيقة
5. **النتيجة المتوقعة**: خصمية = 10 ريال (40 - 5 = 35 دقيقة → فترتان)

### 4. اختبار السجل الشهري
1. افتح السجل الشهري من صفحة المعلم
2. **النتيجة المتوقعة**:
   - يظهر الراتب الأساسي من staffSettings
   - تظهر جميع الخصميات
   - يظهر الراتب المتوقع = الراتب - الخصميات
   - الراتب المتوقع بخلفية خضراء

---

## 🔗 الملفات المعدلة

### 1. `js/teacher.js`
- **السطر 7870**: `loadTeacherHomeSection()` - تحويلها إلى async وجلب الراتب من staffSettings
- **السطر 9470-9495**: `submitCheckIn()` - إصلاح حساب خصمية التأخير + فترة السماح
- **السطر 9598-9607**: `submitAbsent()` - تبسيط حساب خصمية الغياب
- **السطر 9690-9720**: `submitCheckOut()` - إصلاح حساب خصمية الخروج المبكر + فترة السماح
- **السطر 8288-8294**: `loadAttendanceData()` - إضافة الراتب الأساسي والمتوقع في الملخص

### 2. `styles.css`
- **السطر 7098-7145**: إضافة أنماط `.expected-salary-item` للراتب المتوقع

---

## 📝 ملاحظات مهمة

1. **Cache الإعدادات**: تستخدم الدالة `getStaffSettings(teacherId)` cache لتقليل القراءات من Firestore
2. **التحديث التلقائي**: عند تعديل الإعدادات من قسم الإدارة، يتم مسح الـ cache تلقائياً
3. **القيم الافتراضية**: إذا لم توجد إعدادات، يتم استخدام القيم الافتراضية:
   - الراتب: 3000 ريال
   - خصمية التأخير: 5 ريال كل 30 دقيقة
   - فترة السماح للتأخير: 10 دقائق
   - خصمية الخروج المبكر: 5 ريال كل 30 دقيقة
   - فترة السماح للخروج المبكر: 5 دقائق

---

## 🎯 الخلاصة

تم الربط الكامل بين **قسم الإدارة** و**صفحة المعلم** في جميع العمليات:

✅ **الراتب**: يُجلب من staffSettings ويُعرض في الإحصائيات والسجل الشهري  
✅ **خصمية التأخير**: تُحسب من penaltyRules مع تطبيق فترة السماح والحد الأقصى  
✅ **خصمية الخروج المبكر**: تُحسب من penaltyRules مع التحقق من التفعيل وفترة السماح  
✅ **خصمية الغياب**: تُحسب من الراتب مباشرة (راتب ÷ 30)  
✅ **الراتب المتوقع**: يُحسب تلقائياً ويُعرض في السجل الشهري  

**جميع الإعدادات مربوطة بقاعدة البيانات ومتزامنة بين قسم الإدارة وصفحة المعلم.** 🚀

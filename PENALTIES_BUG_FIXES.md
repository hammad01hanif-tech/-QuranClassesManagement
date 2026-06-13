# إصلاحات مشاكل الخصميات - Penalties Bug Fixes

## 🐛 المشاكل المُكتشفة

### المشكلة الأولى: زر السماح لا يُحدّث الواجهة فوراً
**الوصف**: عند الضغط على زر "سماح" لإلغاء خصمية معينة، يتم حفظ التعديل في قاعدة البيانات بنجاح، لكن الواجهة لا تتحدث إلا بعد إعادة فتح السجل الشهري يدوياً.

**السبب الجذري**:
- دالة `updatePenaltyStatus()` في `admin.js` كانت تستدعي `viewStaffAttendanceReport()` بعد التحديث
- `viewStaffAttendanceReport()` تحاول فتح modal جديد بدلاً من تحديث المحتوى الموجود
- لأن الـ modal مفتوح بالفعل، لا يحدث تحديث للبيانات

**الحل المُطبّق**:
1. ✅ إنشاء دالة جديدة `window.refreshAttendanceModal()` تُحدّث بيانات السجل الشهري دون إعادة فتح الـ modal
2. ✅ تعديل `updatePenaltyStatus()` لاستدعاء `refreshAttendanceModal()` بدلاً من `viewStaffAttendanceReport()`
3. ✅ إضافة loading indicator أثناء تحديث البيانات لتجربة مستخدم أفضل
4. ✅ إصلاح selector issue: استخدام `#attendance-month-selector` بدلاً من `.month-select/.year-select`

**الملفات المُعدّلة**:
- `js/admin.js` (السطر ~9555)
- `js/teacher.js` (السطر ~8906)

---

### المشكلة الثانية: خصومات الغياب تظهر 0 ريال رغم وجود غيابات
**الوصف**: في السجل الشهري، يظهر عدد الغيابات بشكل صحيح (مثلاً "1 غياب")، لكن خصومات الغياب تظهر "0 ريال" بدلاً من قيمة الخصم الفعلية.

**السبب الجذري**:
```javascript
// الكود القديم:
absenceDeduction = calculateAbsencePenalty(staffId, false, studyDaysInMonth);
```

المشكلة أن `calculateAbsencePenalty()` في `attendance-calculator.js` تستخدم:
1. بيانات محلية قديمة من `TEACHER_CONFIGS` بدلاً من الإعدادات الحديثة من Firestore
2. طريقة حساب قد لا تتطابق مع الإعدادات المُفعّلة في `staffSettings`

**الحل المُطبّق**:
✅ استبدال استدعاء `calculateAbsencePenalty()` بحساب مباشر من إعدادات Firestore:

```javascript
// الكود الجديد:
if (absencePenalty.enabled) {
  const salary = settings.salary?.monthlySalary || settings.salary || 3000;
  
  if (absencePenalty.calculationMethod === 'salary_divided_by_30') {
    absenceDeduction = Math.round(salary / 30);
  } else if (absencePenalty.calculationMethod === 'salary_divided_by_study_days') {
    const studyDaysInMonth = 22; // افتراضي
    absenceDeduction = Math.round(salary / studyDaysInMonth);
  } else if (absencePenalty.calculationMethod === 'fixed') {
    absenceDeduction = absencePenalty.fixedAmount || 100;
  } else {
    absenceDeduction = Math.round(salary / 30);
  }
}
```

**المزايا**:
1. ✅ يستخدم إعدادات فعلية من Firestore (المُحدّثة بواسطة `getStaffSettings`)
2. ✅ يدعم جميع طرق الحساب: `salary_divided_by_30`, `salary_divided_by_study_days`, `fixed`
3. ✅ يوفر logging واضح: `console.log('💰 Absence penalty calculated:', absenceDeduction, 'SAR from salary', salary)`

**الملفات المُعدّلة**:
- `js/teacher.js` (السطر ~10900)

---

## 🔄 سير العمل الجديد

### عند الضغط على "سماح" من صفحة الإدارة:

```
1. المستخدم يضغط "سماح" على خصمية معينة
   ↓
2. updatePenaltyStatus() في admin.js
   - حفظ القيمة الأصلية في lateDeductionOriginal
   - تعيين lateDeduction = 0
   - تعيين lateApprovalStatus = 'pardoned'
   - حفظ في Firestore
   ↓
3. window.refreshAttendanceModal() في teacher.js
   - إظهار loading indicator
   - إعادة تحميل بيانات السجل الشهري
   - تحديث الجدول بالبيانات الجديدة
   ↓
4. ✅ المستخدم يرى التحديث فوراً دون إعادة فتح
```

### عند تعديل حضور المعلم إلى "غائب":

```
1. المسؤول يختار "غائب" من modal التعديل
   ↓
2. saveEditedAttendance() في teacher.js
   - جلب settings من Firestore
   - التحقق من تفعيل absencePenalty.enabled
   - حساب الخصمية مباشرة من الراتب وطريقة الحساب
   - حفظ في Firestore مع absenceDeduction
   ↓
3. ✅ السجل الشهري يعرض الخصمية الصحيحة
```

---

## 🧪 الاختبار المطلوب

### اختبار زر السماح:
1. افتح السجل الشهري لمعلم لديه خصمية تأخير
2. اضغط على الخصمية → "سماح"
3. ✅ يجب أن يظهر التحديث فوراً (خصمية مشطوبة + كلمة "سماح")
4. ✅ لا حاجة لإعادة فتح السجل

### اختبار خصومات الغياب:
1. عدّل حضور معلم إلى "غائب"
2. افتح السجل الشهري
3. ✅ يجب أن تظهر خصمية الغياب في:
   - خانة الحضور (تحت تاريخ الغياب)
   - الملخص الشهري: "عدد الغيابات: 1" و "خصومات الغياب: X ريال"
4. ✅ القيمة يجب أن تكون حسب الطريقة المُفعّلة في إعدادات المعلم

---

## 📝 ملاحظات إضافية

### طرق حساب خصمية الغياب:
- `salary_divided_by_30`: الراتب الشهري ÷ 30 يوم
- `salary_divided_by_study_days`: الراتب الشهري ÷ أيام الدراسة الفعلية (افتراضي 22)
- `fixed`: مبلغ ثابت محدد في الإعدادات

### القيمة الافتراضية:
- إذا لم تُحدد طريقة الحساب، يستخدم النظام `salary_divided_by_30`
- إذا لم يُحدد الراتب، يستخدم 3000 ريال كقيمة افتراضية

### التوافق مع نظام السماح:
- ✅ الخصومات المسموح عنها تُستثنى من المجموع الشهري
- ✅ تُعرض بشكل مشطوب مع كلمة "سماح"
- ✅ القيمة الأصلية محفوظة في `absenceDeductionOriginal`

---

## 🚀 الإصدار
- **تاريخ الإصلاح**: 2024-01-XX
- **الملفات المُعدّلة**: 
  - `js/admin.js`
  - `js/teacher.js`
- **الوظائف الجديدة**:
  - `window.refreshAttendanceModal()` - تحديث السجل الشهري دون إعادة فتح
- **الوظائف المُحسّنة**:
  - `updatePenaltyStatus()` - تحديث فوري للواجهة
  - `saveEditedAttendance()` - حساب دقيق لخصومات الغياب

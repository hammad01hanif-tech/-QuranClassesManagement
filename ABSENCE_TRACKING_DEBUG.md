# دليل فحص وإصلاح نظام تتبع الغيابات الشهرية

## المشكلة
النظام يعرض عدد غيابات غير صحيح في قسم الإشعارات. مثلاً: طالب غاب يومين فقط لكن النظام يظهر 5 غيابات!

## السبب المحتمل
قد يكون هناك عدم تطابق بين:
1. **monthlyAbsenceTracking** - الجدول الذي يحفظ عدد الغيابات الشهرية (للإشعارات السريعة)
2. **dailyReports** - التقارير اليومية الفعلية لكل طالب

## الحل: أدوات الفحص والإصلاح

### 1️⃣ فحص طالب واحد
افتح Console في المتصفح (F12) وشغّل:
```javascript
await window.verifyStudentAbsenceData('STUDENT_ID')
```

مثال:
```javascript
await window.verifyStudentAbsenceData('STU001')
```

سيعرض لك:
- ✅ العدد في monthlyAbsenceTracking
- ✅ العدد الفعلي في dailyReports
- ✅ هل البيانات متطابقة أم لا

---

### 2️⃣ فحص جميع الطلاب (تدقيق شامل)
```javascript
await window.auditAllStudentsAbsenceData()
```

سيفحص جميع الطلاب الذين لديهم غيابات في الشهر الحالي ويعرض:
- 📊 إجمالي الطلاب المفحوصين
- ⚠️ عدد السجلات غير المتطابقة
- 📝 تفاصيل كل سجل غير متطابق

---

### 3️⃣ إصلاح طالب واحد
```javascript
await window.syncStudentAbsenceData('STUDENT_ID', 'اسم الطالب')
```

مثال:
```javascript
await window.syncStudentAbsenceData('STU001', 'أحمد محمد')
```

سيقوم بـ:
- 🔍 حساب الغيابات الفعلية من dailyReports
- 🔄 تحديث monthlyAbsenceTracking ليطابق البيانات الفعلية
- ✅ حذف السجل إذا كان عدد الغيابات = 0

---

### 4️⃣ إصلاح جميع الطلاب (الحل الشامل) ⭐
```javascript
await window.syncAllStudentsAbsenceData()
```

هذا الأمر سيقوم بـ:
1. 🔍 فحص جميع الطلاب
2. 🔧 إصلاح جميع السجلات غير المتطابقة تلقائياً
3. ✅ عرض تقرير بالنتائج

**استخدم هذا الأمر لحل المشكلة بشكل كامل!**

---

## خطوات الحل الموصى بها

### للمستخدم:
1. افتح صفحة الإدارة
2. افتح Console (اضغط F12 ثم اختر Console)
3. شغّل الأمر:
   ```javascript
   await window.syncAllStudentsAbsenceData()
   ```
4. انتظر حتى ينتهي التدقيق والإصلاح
5. حدّث صفحة الإشعارات (F5)
6. الأعداد الآن يجب أن تكون صحيحة! ✅

---

## التفاصيل التقنية

### كيف يعمل النظام؟
1. **عند حفظ الحضور اليومي:**
   - يحفظ التقرير في `studentProgress/{studentId}/dailyReports/{hijriDate}`
   - إذا كان الطالب غائب بدون عذر، يزيد العداد في `monthlyAbsenceTracking`

2. **عند عرض الإشعارات:**
   - يقرأ من `monthlyAbsenceTracking` مباشرة (أسرع)
   - لكن أحياناً قد يحصل عدم تطابق مع البيانات الفعلية

3. **آلية التصفير التلقائي:**
   - document ID في monthlyAbsenceTracking هو `${studentId}_${currentMonth}`
   - عند بداية شهر هجري جديد، الـ ID يتغير تلقائياً
   - مثال: `STU001_1446-01` → `STU001_1446-02`
   - لذلك الغيابات تتصفر تلقائياً مع الشهر الجديد! ✅

### متى تحصل المشكلة؟
- إذا تم تعديل التقارير اليومية يدوياً من Firebase Console
- إذا تم حذف تقارير يومية
- إذا حصل خطأ أثناء حفظ الحضور
- إذا كان هناك تواريخ ميلادية مختلطة مع هجرية (نادر جداً)

---

## الوقاية من المشكلة مستقبلاً

✅ النظام الآن يحتوي على **تحقق تلقائي** عند فتح تفاصيل الإشعار:
- إذا كانت البيانات غير متطابقة، ستظهر علامة تحذير ⚠️
- يمكنك استخدام دوال الإصلاح مباشرة

✅ توصية: شغّل `auditAllStudentsAbsenceData()` بداية كل شهر هجري للتأكد

---

## أمثلة استخدام

### مثال 1: فحص طالب محدد
```javascript
// فحص طالب "محمد أحمد" - ID: STU123
await window.verifyStudentAbsenceData('STU123')

// النتيجة ستكون:
// ═══════════════════════════════════════════════
// 🔍 ABSENCE DATA VERIFICATION
// 📅 Current Month: 1446-02
// 👤 Student ID: STU123
// ═══════════════════════════════════════════════
// 
// 📊 monthlyAbsenceTracking:
//    Count: 5
//    Records: ['1446-02-01', '1446-02-03', '1446-02-05', '1446-02-07', '1446-02-09']
// 
// 📊 dailyReports (actual):
//    Count: 2
//    Records: ['1446-02-07', '1446-02-09']
// 
// ❌ RESULT: INCONSISTENT!
//    ⚠️  Discrepancy: monthlyAbsenceTracking shows 5 but dailyReports shows 2
//    🔧 Recommended action: Sync monthlyAbsenceTracking with dailyReports
// ═══════════════════════════════════════════════
```

### مثال 2: إصلاح المشكلة
```javascript
// إصلاح بيانات الطالب
await window.syncStudentAbsenceData('STU123', 'محمد أحمد')

// النتيجة:
// 🔧 SYNCING absence data for محمد أحمد (STU123)...
// ✅ Synced: محمد أحمد has 2 absence(s), tracking updated
```

### مثال 3: إصلاح شامل
```javascript
// فحص وإصلاح جميع الطلاب
const result = await window.syncAllStudentsAbsenceData()

console.log(result)
// {
//   success: true,
//   total: 3,      // عدد الطلاب الذين كان لديهم مشكلة
//   synced: 3,     // تم إصلاحهم جميعاً
//   results: [...]
// }
```

---

## ملاحظات مهمة

⚠️ **لا تحذف monthlyAbsenceTracking collection من Firebase!**
   - هذا الجدول ضروري لسرعة عرض الإشعارات
   - استخدم دوال الإصلاح بدلاً من الحذف

✅ **الأعداد في الإشعارات الآن موثوقة:**
   - بعد تشغيل `syncAllStudentsAbsenceData()`
   - العداد يطابق الغيابات الفعلية 100%

📅 **التصفير التلقائي يعمل:**
   - مع بداية كل شهر هجري، العدادات تبدأ من صفر
   - لا حاجة لإجراء يدوي

---

## دعم فني

إذا استمرت المشكلة بعد تشغيل `syncAllStudentsAbsenceData()`:

1. شغّل `auditAllStudentsAbsenceData()` مرة أخرى
2. التقط screenshot من نتائج Console
3. تحقق من التواريخ في dailyReports:
   ```javascript
   // افحص تقارير طالب معين
   const reportsRef = collection(db, 'studentProgress', 'STUDENT_ID', 'dailyReports')
   const snap = await getDocs(reportsRef)
   snap.forEach(doc => console.log(doc.id, doc.data()))
   ```
4. تأكد أن التواريخ بصيغة هجرية (YYYY-MM-DD) وليست ميلادية

---

تم إضافة هذه الدوال في: 2026-07-20  
الملف: `js/admin.js`  
السطور: 561-851

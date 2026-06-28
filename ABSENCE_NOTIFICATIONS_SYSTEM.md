# نظام إشعارات الغياب بدون عذر

## نظرة عامة
نظام آلي لإشعار الإدارة عند وصول الطالب للغياب الثاني وما بعده بدون عذر في الشهر الهجري الواحد، مع عرض أنيق ومنظم في قسم الإشعارات بصفحة الإدارة.

**الإشعارات المشمولة:**
- ✅ الغياب الثاني: إشعار تلقائي
- ✅ الغياب الثالث: إشعار تلقائي
- ✅ الغياب الرابع: إشعار تلقائي
- ✅ الغياب الخامس وما بعده: إشعار تلقائي
- ❌ الغياب الأول: لا يتم إنشاء إشعار (عقوبة داخلية فقط)

---

## 📍 موقع الإشعارات

### في الصفحة الرئيسية (index.html)
- **الموقع:** فوق الهيدر في صفحة الإدارة
- **زر الإشعارات:** أيقونة 🔔 في الشريط العلوي
- **Badge:** يظهر عدد الإشعارات غير المقروءة

### في الكود
- **Modal ID:** `adminNotificationsModal`
- **Container ID:** `adminNotificationsList`
- **Badge ID:** `adminNotificationBadge`

---

## ⚙️ آلية العمل

### 1. الفحص التلقائي
```javascript
checkAndNotifyAbsenceViolations()
```

**متى يتم استدعاءها:**
- ✅ عند تحميل صفحة الإدارة (`window.onload`)
- ✅ بعد حفظ التحضير اليومي مباشرة (`saveDailyAttendance`)

**ماذا تفعل:**
1. تجلب جميع سجلات `monthlyAbsenceTracking` للشهر الحالي
2. تفلتر السجلات التي فيها `absenceCount === 2` أو `absenceCount === 3`
3. تجلب بيانات المعلم من `teacherNames` map
4. تتحقق من عدم وجود إشعار سابق بنفس المعرّف
5. تنشئ إشعار جديد في `adminNotifications` collection

### 2. تحديث عدد الغيابات
```javascript
incrementStudentAbsenceCount(studentId, studentName)
```

**متى يتم استدعاءها:**
- عند حفظ التحضير اليومي لطالب بحالة:
  ```javascript
  status === 'absent' && excuseType === 'withoutExcuse'
  ```

**ماذا تفعل:**
1. تجلب أو تنشئ document في `monthlyAbsenceTracking`
2. تزيد `absenceCount` بمقدار 1
3. تضيف التاريخ الحالي إلى `absenceRecords` array
4. تحدّث `currentAction` بناءً على العدد الجديد
5. تحفظ الوقت في `lastUpdated`

### 3. عرض الإشعارات
```javascript
loadAdminNotifications()
```

**متى يتم استدعاءها:**
- عند فتح modal الإشعارات
- بعد تعليم الكل كمقروء
- بعد حذف إشعار

**ماذا تفعل:**
1. تجلب جميع الإشعارات غير المقروءة (`read: false`)
2. ترتّبها حسب `timestamp` (الأحدث أولاً)
3. تعرضها بتصميم أنيق حسب النوع

---

## 🎨 تصميم الإشعار

### بنية الإشعار في Firestore
```javascript
{
  // Unique ID Pattern: absence_{studentId}_{month}_{absenceCount}
  id: "absence_STD123_1447-11_2",
  
  // Basic Info
  type: "absence-violation",
  title: "⚠️ غياب ثاني بدون عذر",  // أو "ثالث"
  message: "الطالب: أحمد محمد | المعلم: الأستاذ عبدالله",
  
  // Student & Teacher Data
  studentId: "STD123",
  studentName: "أحمد محمد",
  teacherName: "الأستاذ عبدالله",
  
  // Absence Details
  absenceCount: 2,  // 2 or 3 only
  month: "1447-11",
  
  // Penalty Info
  penalty: "حرمان واستدعاء ولي الأمر",
  penaltyDescription: "الغياب الثاني بدون عذر: حرمان من دخول الحلقة واستدعاء ولي الأمر",
  penaltyEmoji: "📋",
  penaltyColor: "#dc3545",
  
  // Metadata
  read: false,
  timestamp: Timestamp,
  date: "1447-11-15",  // Hijri date
  dayName: "الأربعاء"
}
```

### التصميم المرئي

#### للغياب الثاني (`absenceCount: 2`)
```
┌────────────────────────────────────────┐
│ 📋 غياب ثاني بدون عذر              × │
├────────────────────────────────────────┤
│ ╔══════════════════════════════════╗ │
│ ║ 👤 أحمد محمد                      ║ │
│ ║ 👨‍🏫 المعلم: الأستاذ عبدالله       ║ │
│ ║ 📊 الغياب: الثاني بدون عذر        ║ │
│ ╚══════════════════════════════════╝ │
│                                        │
│ ╔═══ العقوبة (أحمر) ═══════════╗    │
│ ║ 📋 حرمان واستدعاء ولي الأمر   ║    │
│ ║ حرمان من دخول الحلقة...        ║    │
│ ╚════════════════════════════════╝    │
│                                        │
│ 📅 1447-11-15 - الأربعاء              │
└────────────────────────────────────────┘
```

#### للغياب الثالث (`absenceCount: 3`)
```
┌────────────────────────────────────────┐
│ ❌ غياب ثالث بدون عذر              × │
├────────────────────────────────────────┤
│ ╔══════════════════════════════════╗ │
│ ║ 👤 خالد سعيد                      ║ │
│ ║ 👨‍🏫 المعلم: الأستاذ إبراهيم       ║ │
│ ║ 📊 الغياب: الثالث بدون عذر        ║ │
│ ╚══════════════════════════════════╝ │
│                                        │
│ ╔═ العقوبة (أحمر غامق) ═════════╗   │
│ ║ ❌ استبعاد كامل من الحلقة      ║   │
│ ║ استبعاد كامل من الحلقات...     ║   │
│ ╚════════════════════════════════╝    │
│                                        │
│ 📅 1447-11-20 - الإثنين               │
└────────────────────────────────────────┘
```

---

## 🔍 التحقق من البيانات

### 1. فلترة الغيابات
```javascript
// في checkAndNotifyAbsenceViolations()
if (absenceCount >= 2) {
  // إنشاء إشعار للغياب الثاني وما بعده (2، 3، 4، 5...)
}
```

**ملاحظة:** يتم إنشاء إشعار لكل غياب من الثاني وما بعده للتوثيق والمتابعة.

### 2. التحقق من نوع الغياب
```javascript
// في saveDailyAttendance()
if (record.status === 'absent' && record.excuseType === 'withoutExcuse') {
  // فقط الغياب بدون عذر
  await incrementStudentAbsenceCount(studentId, studentName);
}
```

### 3. منع التكرار
```javascript
// معرّف فريد لكل إشعار
const notificationId = `absence_${studentId}_${currentMonth}_${absenceCount}`;

// التحقق من وجود الإشعار
const existingNotification = await getDoc(
  firestoreDoc(db, 'adminNotifications', notificationId)
);

if (!existingNotification.exists()) {
  // إنشاء الإشعار
}
```

### 4. التتبع الشهري
```javascript
// يتم إنشاء document جديد لكل شهر
const currentMonth = getCurrentHijriMonth(); // "1447-11"
const docId = `${studentId}_${currentMonth}`;  // "STD123_1447-11"
```

---

## 📊 أمثلة عملية

### مثال 1: طالب غاب مرتين بدون عذر

**السيناريو:**
1. يوم الأحد: الطالب أحمد غاب بدون عذر (أول مرة)
2. يوم الثلاثاء: الطالب أحمد غاب بدون عذر (ثاني مرة) ← **يظهر إشعار**

**ما يحدث:**
```javascript
// عند حفظ التحضير يوم الثلاثاء
await incrementStudentAbsenceCount("STD123", "أحمد محمد");
// absenceCount: 2

// بعد الحفظ مباشرة
await checkAndNotifyAbsenceViolations();
// ينشئ إشعار بمعرّف: absence_STD123_1447-11_2
```

**الإشعار الناتج:**
- **العنوان:** ⚠️ غياب ثاني بدون عذر
- **الطالب:** أحمد محمد
- **المعلم:** الأستاذ عبدالله
- **الغياب:** الثاني بدون عذر
- **العقوبة:** 📋 حرمان واستدعاء ولي الأمر

### مثال 2: طالب غاب ثلاث مرات

**السيناريو:**
1. الأحد: غياب أول (لا إشعار)
2. الثلاثاء: غياب ثاني ← **إشعار 1**
3. الخميس: غياب ثالث ← **إشعار 2** (مختلف)

**الإشعارات:**

**إشعار 1 (الثلاثاء):**
```
ID: absence_STD123_1447-11_2
Title: ⚠️ غياب ثاني بدون عذر
Penalty: 📋 حرمان واستدعاء ولي الأمر
Color: #dc3545 (أحمر)
```

**إشعار 2 (الخميس):**
```
ID: absence_STD123_1447-11_3
Title: ❌ غياب ثالث بدون عذر
Penalty: ❌ استبعاد كامل من الحلقة
Color: #721c24 (أحمر غامق)
```

### مثال 3: عدم إنشاء إشعار للغياب بعذر

**السيناريو:**
- الطالب خالد غاب مرتين، لكن المرة الثانية **بعذر**

**ما يحدث:**
```javascript
// الغياب الأول بدون عذر
excuseType: 'withoutExcuse' → absenceCount: 1 (لا إشعار)

// الغياب الثاني بعذر
excuseType: 'withExcuse' → 
// لا يتم استدعاء incrementStudentAbsenceCount
// absenceCount يبقى: 1
// ❌ لا يظهر إشعار
```

---

## 🛠️ الدوال المستخدمة

### 1. checkAndNotifyAbsenceViolations()
**الموقع:** `js/admin.js` (بعد `deleteAdminNotification`)

**المدخلات:** لا شيء

**المخرجات:** لا شيء (تنشئ إشعارات في Firestore)

**الخطوات:**
1. الحصول على الشهر الحالي
2. جلب سجلات `monthlyAbsenceTracking`
3. فلترة السجلات (absenceCount = 2 أو 3)
4. جلب بيانات المستخدمين (للحصول على classId)
5. إنشاء إشعار لكل طالب مؤهل (إذا لم يكن موجوداً)

### 2. incrementStudentAbsenceCount(studentId, studentName)
**الموقع:** `js/admin.js` (في قسم ABSENCE REGULATIONS SYSTEM)

**المدخلات:**
- `studentId` (string): معرّف الطالب
- `studentName` (string): اسم الطالب

**المخرجات:**
```javascript
{
  absenceCount: 2,
  currentAction: {
    level: 2,
    title: "حرمان واستدعاء ولي الأمر",
    description: "...",
    color: "#dc3545",
    emoji: "📋"
  }
}
```

### 3. loadAdminNotifications()
**الموقع:** `js/admin.js`

**المدخلات:** لا شيء

**المخرجات:** تحديث DOM بالإشعارات

**الميزات:**
- عرض مخصص لإشعارات الغياب (`type: 'absence-violation'`)
- تصميم أنيق مع ألوان العقوبة
- مستطيلات منفصلة للبيانات والعقوبة
- زر حذف لكل إشعار

### 4. getCurrentDayName()
**الموقع:** `js/admin.js`

**المدخلات:** لا شيء

**المخرجات:** اسم اليوم بالعربية (string)

```javascript
'الأحد' | 'الإثنين' | 'الثلاثاء' | 'الأربعاء' | 
'الخميس' | 'الجمعة' | 'السبت'
```

---

## 🎯 حالات الاستخدام

### للإدارة
1. **متابعة يومية:**
   - فتح صفحة الإدارة
   - النظر إلى badge الإشعارات
   - الضغط على 🔔 لرؤية التفاصيل

2. **اتخاذ إجراء:**
   - قراءة الإشعار
   - التواصل مع المعلم/ولي الأمر
   - تطبيق العقوبة المناسبة
   - حذف الإشعار أو تعليمه كمقروء

3. **تقارير شهرية:**
   - جميع الإشعارات محفوظة في Firestore
   - يمكن إنشاء تقارير شاملة لاحقاً

### للمعلم
- **لا حاجة لإجراء:** النظام آلي بالكامل
- عند حفظ التحضير، يتم:
  1. تحديث عدد الغيابات تلقائياً
  2. إنشاء الإشعار إذا لزم الأمر
  3. إرسال الإشعار للإدارة

---

## ⚡ الأداء والتحسينات

### منع التكرار
- **معرّف فريد:** `absence_{studentId}_{month}_{count}`
- **تحقق قبل الإنشاء:** `getDoc()` قبل `setDoc()`
- **نتيجة:** لا توجد إشعارات مكررة حتى لو تم تحديث الصفحة

### التحميل التلقائي
- **عند التحميل:** `checkAndNotifyAbsenceViolations()` على `window.onload`
- **بعد الحفظ:** استدعاء فوري بعد `saveDailyAttendance`
- **نتيجة:** الإشعارات تظهر فوراً

### الأداء
- **Firestore Queries:** محسّنة باستخدام `where('month', '==', currentMonth)`
- **عدد الـ reads:** يعتمد على عدد الطلاب المخالفين (عادة 0-5 في الشهر)
- **Caching:** بيانات المستخدمين تُجلب مرة واحدة

---

## 🔧 التخصيص والتطوير

### شروط الإشعار الحالية
```javascript
// في checkAndNotifyAbsenceViolations()
// النظام الحالي: من الغياب الثاني وما بعده
if (absenceCount >= 2) {
  // إنشاء إشعار لكل غياب (2، 3، 4، 5...)
}

// للحد من الإشعارات (مثلاً: فقط من 2 إلى 5):
if (absenceCount >= 2 && absenceCount <= 5) {
  // إنشاء إشعار
}
```

**العقوبات:**
- الغياب الأول: الوقوف خارج الحلقة (عقوبة داخلية، لا إشعار)
- الغياب الثاني: حرمان واستدعاء ولي الأمر + إشعار
- الغياب الثالث وما بعده: استبعاد كامل (فصل) + إشعار

### تخصيص التصميم
```javascript
// في loadAdminNotifications()
// البحث عن: notification.type === 'absence-violation'
// تعديل الـ HTML والـ inline styles
```

### إضافة إشعارات للتأخير
```javascript
// إنشاء دالة مشابهة
async function checkAndNotifyLateViolations() {
  // نفس المنطق ولكن مع monthlyLateTracking
  // وشروط مختلفة (مثل 4 تأخيرات)
}
```

---

## 📝 ملاحظات مهمة

1. **التوقيت:** الإشعارات تُنشأ فقط عند:
   - تحميل صفحة الإدارة
   - حفظ التحضير اليومي

2. **الشهر الهجري:** النظام يستخدم `getCurrentHijriMonth()` الذي يعتمد على `accurateHijriDates`

3. **اسم المعلم:** يُجلب من `teacherNames` map (يجب أن يكون محدّثاً)

4. **الغيابات بعذر:** لا تُحسب ولا تُنشئ إشعارات

5. **Badge Counter:** يعرض عدد **جميع** الإشعارات غير المقروءة (ليس فقط الغياب)

---

## 🐛 استكشاف الأخطاء

### الإشعار لا يظهر
1. ✅ تحقق من `absenceCount` في `monthlyAbsenceTracking`
2. ✅ تحقق من `excuseType === 'withoutExcuse'` في `dailyReports`
3. ✅ تحقق من `read: false` في `adminNotifications`
4. ✅ تحقق من Console للأخطاء

### اسم المعلم "غير محدد"
- ✅ تحقق من `teacherNames` map في `admin.js`
- ✅ تأكد من أن `student.classId` موجود ومطابق للمفتاح

### الإشعار يظهر مرتين
- ✅ تحقق من `notificationId` (يجب أن يكون فريداً)
- ✅ تحقق من `existingNotification.exists()` logic

### الألوان غير صحيحة
- ✅ تحقق من `currentAction.color` في `determineActionForAbsenceCount()`
- ✅ تحقق من `penaltyColor` في الإشعار

---

## 📚 الكود المرجعي

### الملفات المتأثرة
- ✅ `js/admin.js` (الدوال والمنطق)
- ✅ `index.html` (modal الإشعارات - لم يتم تعديله)

### الـ Collections في Firestore
- ✅ `monthlyAbsenceTracking` - تتبع الغيابات
- ✅ `adminNotifications` - الإشعارات
- ✅ `users` - بيانات الطلاب والمعلمين
- ✅ `studentProgress/{studentId}/dailyReports` - التحضير اليومي

### الدوال العامة المتاحة
```javascript
window.toggleAdminNotifications()
window.markAllAdminNotificationsAsRead()
window.deleteAdminNotification(notificationId)
window.incrementStudentAbsenceCount(studentId, studentName)
window.determineActionForAbsenceCount(absenceCount)
window.getStudentAbsenceStatus(studentId, studentName)
window.countStudentAbsenceInCurrentMonth(studentId)
```

---

## ✅ الخلاصة

نظام الإشعارات يعمل بشكل آلي وذكي:

1. ✅ **تلقائي:** لا حاجة لأي إجراء يدوي من المعلم
2. ✅ **دقيق:** يفلتر الغيابات بدون عذر فقط
3. ✅ **شهري:** يتتبع كل شهر هجري بشكل منفصل
4. ✅ **محدّد:** يشعر فقط عند الغياب الثاني والثالث
5. ✅ **أنيق:** تصميم جذاب ومنظم مع الألوان والإيموجي
6. ✅ **فعّال:** يمنع التكرار ويحسّن الأداء
7. ✅ **موثّق:** جميع البيانات محفوظة في Firestore

---

**آخر تحديث:** 2026-06-25  
**الإصدار:** 1.0.0  
**Commit:** `6aff9fc`

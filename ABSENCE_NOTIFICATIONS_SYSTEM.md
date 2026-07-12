# نظام إشعارات الغياب بدون عذر - 2024

## 🎯 نظرة عامة
نظام آلي لإشعار الإدارة عند وصول الطالب **للغياب الأول وما بعده** بدون عذر في الشهر الهجري الواحد، مع عرض احترافي في قسم الإشعارات بصفحة الإدارة.

> **⚠️ تحديث هام (2024):** الإشعارات الآن تبدأ من **الغياب الأول** (كان سابقاً من الثاني)

**الإشعارات المشمولة:**
- ✅ **الغياب الأول:** إشعار تلقائي + إنذار شفهي
- ✅ **الغياب الثاني:** إشعار تلقائي + الوقوف في الحلقة إلى المغرب
- ✅ **الغياب الثالث:** إشعار تلقائي + الحرمان من دخول الحلقة واستدعاء ولي الأمر
- ✅ **الغياب الرابع وما بعده:** إشعار تلقائي + الفصل النهائي

---

## 📍 موقع الإشعارات

### في الصفحة الرئيسية (index.html)
- **الموقع:** فوق الهيدر في صفحة الإدارة
- **زر الإشعارات:** أيقونة 🔔 في الشريط العلوي
- **Badge:** يظهر عدد الإشعارات غير المقروءة
- **Modal جديد:** تصميم احترافي مع فلترة وتواصل WhatsApp

### في الكود
- **Modal ID:** `adminNotificationsModal`
- **Container ID:** `adminNotificationsList`
- **Badge ID:** `adminNotificationBadge`
- **Teacher Filter ID:** `teacherFilter`
- **Details Modal ID:** `notificationDetailsModal`

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
2. **تفلتر السجلات التي فيها `absenceCount >= 1`** (تحديث 2024)
3. تجلب بيانات المعلم من `teacherNames` map
4. تتحقق من عدم وجود إشعار سابق بنفس المعرّف
5. تنشئ إشعار جديد في `adminNotifications` collection مع حقل `teacherId`

**الكود الرئيسي:**
```javascript
if (absenceCount >= 1) {  // تغيير من >= 2 إلى >= 1
  // Generate ordinal text
  const ordinals = {
    1: 'أول',     // جديد!
    2: 'ثاني',
    3: 'ثالث',
    4: 'رابع',
    // ...
  };
  
  const ordinalText = ordinals[absenceCount] || `الـ ${absenceCount}`;
  
  // Create notification
  title: `الغياب الـ${ordinalText} بدون عذر هذا الشهر`,
  teacherId: teacherId,  // جديد للفلترة
  lastAbsenceDate: lastAbsenceDate  // جديد لـ WhatsApp
}
```

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

### 3. عرض الإشعارات - التصميم الجديد
```javascript
loadAdminNotifications()  // معدّلة بالكامل
displayNotifications()     // جديدة
```

**متى يتم استدعاءها:**
- عند فتح modal الإشعارات
- بعد تعليم الكل كمقروء
- بعد حذف إشعار

**ماذا تفعل (التصميم الجديد):**
1. تجلب جميع الإشعارات غير المقروءة (`read: false`)
2. ترتّبها حسب `timestamp` (الأحدث أولاً)
3. تحفظها في `window.allNotifications` للفلترة
4. تستدعي `loadTeacherFilterOptions()` لملء قائمة المعلمين
5. تستدعي `displayNotifications()` لعرض البطاقات المدمجة

---

## 🎨 التصميم الجديد (2024)

### بطاقة الإشعار المدمجة (Compact Card)
```html
<div class="notification-card" style="--card-color: #ff9800;">
  <!-- Header -->
  <div class="notification-card-header">
    <p class="notification-card-title">الغياب الأول بدون عذر هذا الشهر</p>
    <button class="notification-card-delete">×</button>
  </div>
  
  <!-- Info - ONLY essential data -->
  <div class="notification-card-info">
    <div class="notification-info-row">
      <span class="notification-info-label">الطالب:</span>
      <span>أحمد محمد</span>
    </div>
    <div class="notification-info-row">
      <span class="notification-info-label">المعلم:</span>
      <span>الأستاذ عبدالله</span>
    </div>
  </div>
</div>
```

**مميزات البطاقة:**
- ✅ **مدمجة** - تعرض فقط العنوان واسم الطالب والمعلم
- ✅ **بدون emojis** - رموز SVG احترافية
- ✅ **Clickable** - النقر يفتح modal التفاصيل
- ✅ **حاشية ملونة** - `::before` pseudo-element بلون العقوبة
- ✅ **Hover effect** - ترتفع البطاقة عند التمرير

### Modal التفاصيل (Details Modal)
يظهر عند النقر على البطاقة:

```html
<div class="notification-details-modal">
  <!-- Header -->
  <h3>الغياب الأول بدون عذر هذا الشهر</h3>
  
  <!-- Student Info Section -->
  <div class="details-section">
    <h4>معلومات الطالب</h4>
    <div class="details-info-card">
      <div class="details-info-row">
        <span>الاسم</span>
        <span>أحمد محمد</span>
      </div>
      <div class="details-info-row">
        <span>المعلم</span>
        <span>الأستاذ عبدالله</span>
      </div>
      <div class="details-info-row">
        <span>عدد الغيابات هذا الشهر</span>
        <span>1 مرة</span>
      </div>
      <div class="details-info-row">
        <span>تاريخ آخر غياب</span>
        <span>1447-06-15</span>
      </div>
    </div>
  </div>
  
  <!-- Penalty Section -->
  <div class="details-section">
    <h4>الإجراء المتخذ</h4>
    <div class="details-penalty-card" style="background: linear-gradient(135deg, #ff9800, #f57c00);">
      <div class="details-penalty-title">إنذار شفهي</div>
      <div class="details-penalty-description">يتم توجيه إنذار شفهي للطالب وتذكيره بأهمية الحضور المنتظم للحلقة.</div>
    </div>
  </div>
  
  <!-- WhatsApp Actions -->
  <div class="notification-details-actions">
    <button class="whatsapp-btn whatsapp-guardian">
      <svg>...</svg>
      تواصل مع ولي الأمر
    </button>
    <button class="whatsapp-btn whatsapp-teacher">
      <svg>...</svg>
      إرسال بطاقة دخول للمعلم
    </button>
  </div>
</div>
```

**مميزات Modal التفاصيل:**
- ✅ **Bottom sheet** على الموبايل، Modal مركزي على Desktop
- ✅ **معلومات كاملة** - كل التفاصيل التي لم تظهر في البطاقة
- ✅ **بطاقة العقوبة** - بتدرج لوني gradient
- ✅ **أزرار WhatsApp** - تواصل سريع مع ولي الأمر والمعلم

---

## 📱 فلترة الإشعارات بالمعلم

### قائمة المعلمين المنسدلة
```html
<div class="notifications-filter-section">
  <label class="filter-label">
    <svg>...</svg>
    فلترة بالمعلم:
  </label>
  <select id="teacherFilter" class="teacher-filter-select" onchange="window.filterNotificationsByTeacher()">
    <option value="all">جميع المعلمين</option>
    <option value="TCH01">الأستاذ عبدالله</option>
    <option value="TCH02">الأستاذ محمد</option>
    <!-- ... -->
  </select>
</div>
```

**الدالة:**
```javascript
window.filterNotificationsByTeacher = function() {
  const selectedTeacherId = teacherFilter.value;
  
  let filteredNotifications;
  if (selectedTeacherId === 'all') {
    filteredNotifications = window.allNotifications;
  } else {
    filteredNotifications = window.allNotifications.filter(
      n => n.teacherId === selectedTeacherId
    );
  }
  
  // Animate and display
  displayNotifications(filteredNotifications);
};
```

---

## 📲 التواصل عبر WhatsApp

### 1. WhatsApp لولي الأمر
```javascript
window.sendWhatsAppToGuardian = function() {
  const message = `السلام عليكم ورحمة الله وبركاته

📋 *إشعار غياب طالب*

*الطالب:* ${studentName}
*المعلم:* ${teacherName}
*الغياب:* الأول بدون عذر هذا الشهر
*تاريخ آخر غياب:* ${date}

⚠️ *الإجراء المتخذ:*
${penalty}

${penaltyDescription}

يرجى متابعة حضور الطالب والتواصل مع إدارة الحلقات.

جزاكم الله خيراً`;

  const phone = guardianPhone.replace(/^0/, '966');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
};
```

### 2. WhatsApp للمعلم (بطاقة دخول)
```javascript
window.sendWhatsAppToTeacher = function() {
  const message = `*🎯 بطاقة دخول الحلقة*

*الطالب:* ${studentName}
*الحلقة:* ${teacherName}
*الغياب:* الأول بدون عذر هذا الشهر

⚠️ *الإجراء المطلوب:*
${penalty}

${penaltyDescription}

يرجى متابعة حالة الطالب واتخاذ الإجراء المناسب عند دخوله الحلقة.

بارك الله فيكم`;

  const phone = teacherPhone.replace(/^0/, '966');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
};
```

**متطلبات:**
- ✅ `guardianPhone` في user document (الطالب)
- ✅ `phone` أو `teacherPhone` في class document (المعلم)
- ✅ تحويل تلقائي من `0xxx` إلى `966xxx`
- ✅ تعطيل الزر إذا الرقم غير متوفر

---

## 🗄️ بنية الإشعار في Firestore

```javascript
{
  // Unique ID Pattern: absence_{studentId}_{month}_{absenceCount}
  id: "absence_STD123_1447-11_1",  // يبدأ من 1 الآن
  
  // Basic Info
  type: "absence-violation",
  title: "الغياب الأول بدون عذر هذا الشهر",  // أو "الثاني", "الثالث", الخ.
  message: "الطالب: أحمد محمد | المعلم: الأستاذ عبدالله",
  
  // Student & Teacher Data
  studentId: "STD123",
  studentName: "أحمد محمد",
  teacherId: "TCH01",           // جديد - للفلترة
  teacherName: "الأستاذ عبدالله",
  
  // Absence Details
  absenceCount: 1,              // العدد الكلي هذا الشهر
  month: "1447-11",
  lastAbsenceDate: "1447-11-15",  // جديد - لرسائل WhatsApp
  
  // Penalty Info
  penalty: "إنذار شفهي",
  penaltyDescription: "يتم توجيه إنذار شفهي للطالب وتذكيره بأهمية الحضور المنتظم للحلقة.",
  penaltyEmoji: "⚠️",
  penaltyColor: "#ff9800",      // برتقالي للإنذار الأول
  
  // Metadata
  read: false,
  timestamp: serverTimestamp(),
  date: "1447-11-15",
  dayName: "السبت"
}
```

---

## 📋 تاريخ التحديثات

### التحديث الكبير (2024)

#### ✅ التغييرات الرئيسية:

1. **بدء الإشعارات من الغياب الأول**
   - قبل: `if (absenceCount >= 2)`
   - بعد: `if (absenceCount >= 1)`
   
2. **إضافة حقل `teacherId`**
   - الهدف: تمكين فلترة الإشعارات بالمعلم
   
3. **إضافة حقل `lastAbsenceDate`**
   - الهدف: عرض التاريخ في رسائل WhatsApp
   
4. **تصميم جديد بالكامل**
   - بطاقات مدمجة بدلاً من البطاقات الكبيرة
   - إزالة جميع الـ emojis من UI
   - استبدالها برموز SVG احترافية
   - modal تفاصيل منفصل
   
5. **فلترة بالمعلم**
   - قائمة منسدلة للمعلمين
   - عرض إشعارات معلم محدد أو الكل
   
6. **تكامل WhatsApp**
   - زر "تواصل مع ولي الأمر" برسالة منسّقة
   - زر "إرسال بطاقة دخول للمعلم" برسالة منسّقة
   - تحويل تلقائي للأرقام من محلي لدولي
   - تعطيل الأزرار إذا الرقم غير متوفر

#### ✅ الملفات المُحدّثة:

1. **`index.html`** (Lines 4134-4282)
   - استبدال modal القديم بتصميم احترافي
   - إضافة قسم فلترة المعلمين
   - إضافة modal تفاصيل الإشعار
   - إضافة أزرار WhatsApp

2. **`styles.css`** (Lines 416+)
   - ~500 سطر CSS احترافي جديد
   - animations, hover effects, responsive
   - bottom sheet للموبايل، modal للديسكتوب

3. **`js/admin.js`** (Lines 3478-3900+)
   - تعديل `checkAndNotifyAbsenceViolations()` 
   - إعادة كتابة `loadAdminNotifications()`
   - إضافة 9 دوال جديدة:
     - `loadTeacherFilterOptions()`
     - `displayNotifications()`
     - `filterNotificationsByTeacher()`
     - `showNotificationDetails()`
     - `closeNotificationDetails()`
     - `sendWhatsAppToGuardian()`
     - `sendWhatsAppToTeacher()`
     - `darkenColor()`

4. **`ABSENCE_AND_LATE_REGULATIONS.md`**
   - تحديث لوائح الغياب لتوضيح أن الإشعارات تبدأ من الأول

5. **`ABSENCE_NOTIFICATIONS_SYSTEM.md`** (هذا الملف)
   - توثيق شامل للنظام الجديد

---

## 🧪 الاختبار

### 1. اختبار الإشعار من الغياب الأول
```javascript
// في console المتصفح بعد تسجيل غياب طالب بدون عذر:
await checkAndNotifyAbsenceViolations();

// تحقق من:
// ✅ إنشاء إشعار بعنوان "الغياب الأول..."
// ✅ absenceCount = 1
// ✅ يظهر في قائمة الإشعارات
```

### 2. اختبار الفلترة
```
1. افتح modal الإشعارات
2. لاحظ قائمة المعلمين المنسدلة في الأعلى
3. اختر معلم محدد
4. تحقق من ظهور إشعارات هذا المعلم فقط
5. اختر "جميع المعلمين"
6. تحقق من ظهور جميع الإشعارات
```

### 3. اختبار التفاصيل
```
1. انقر على بطاقة إشعار
2. تحقق من فتح modal التفاصيل
3. تحقق من عرض:
   - اسم الطالب والمعلم
   - عدد الغيابات
   - تاريخ آخر غياب
   - بطاقة العقوبة بلون صحيح
4. تحقق من وجود أزرار WhatsApp
```

### 4. اختبار WhatsApp
```javascript
// تأكد أولاً من وجود:
// - guardianPhone في user document
// - phone أو teacherPhone في class document

// ثم:
1. افتح تفاصيل إشعار
2. انقر "تواصل مع ولي الأمر"
3. تحقق من:
   - فتح WhatsApp
   - رسالة منسّقة صحيحة
   - رقم دولي (966...)
4. كرر للمعلم
```

---

## ⚠️ ملاحظات مهمة

### 1. متطلبات البيانات
لكي يعمل النظام بشكل كامل، تأكد من:

```javascript
// في users collection (الطلاب):
{
  guardianPhone: "0501234567",  // مطلوب لـ WhatsApp
  classId: "TCH01"              // للربط مع المعلم
}

// في classes collection (المعلمين):
{
  phone: "0509876543",          // أو teacherPhone
  teacherName: "الأستاذ عبدالله"
}
```

### 2. تنسيق أرقام الهواتف
- **في Firestore:** `"0501234567"` (صيغة محلية)
- **في WhatsApp URL:** `"966501234567"` (تحويل تلقائي)
- **لا تستخدم:** `"+966"`, `"00966"`, فواصل أو مسافات

### 3. الألوان حسب العقوبة
```javascript
// مستويات الغياب:
1: { color: "#ff9800" }  // برتقالي - إنذار
2: { color: "#ff5722" }  // برتقالي غامق - وقوف المغرب
3: { color: "#f44336" }  // أحمر - حرمان
4+: { color: "#d32f2f" } // أحمر غامق - فصل
```

### 4. Responsive Design
- **Mobile (< 600px):**
  - Modal بعرض كامل
  - Bottom sheet للتفاصيل
  - فلترة عمودية
  
- **Desktop (≥ 768px):**
  - Modal مركزي بحد أقصى 520px
  - Modal عادي للتفاصيل
  - فلترة أفقية

---

## 🔍 استكشاف الأخطاء

### المشكلة: الإشعارات لا تظهر
```javascript
// الحلول:
1. تحقق من Element IDs في HTML
2. افتح Console وابحث عن أخطاء
3. تحقق من Firestore Rules
4. تأكد من وجود notifications مع read: false
```

### المشكلة: Badge لا يتحدث
```javascript
// الحلول:
1. تحقق من Element ID: adminNotificationBadge
2. تحقق من استدعاء loadAdminNotifications()
3. تحقق من count > 0
```

### المشكلة: الفلترة لا تعمل
```javascript
// الحلول:
1. تحقق من وجود teacherId في الإشعارات
2. تحقق من teacherNames object معرّف
3. تحقق من window.allNotifications محفوظة
```

### المشكلة: WhatsApp لا يفتح
```javascript
// الحلول:
1. تحقق من guardianPhone موجود
2. تحقق من teacherPhone موجود
3. تحقق من تنسيق الرقم (0xxx)
4. تحقق من URL encoding
5. اسمح بالـ pop-ups في المتصفح
```

---

## 📚 المراجع

### ملفات ذات صلة:
- `ABSENCE_AND_LATE_REGULATIONS.md` - لوائح العقوبات
- `ABSENCE_WORKFLOW_COMPLETE.md` - سير العمل الكامل
- `NOTIFICATIONS_REDESIGN_COMPLETE.md` - توثيق شامل للتصميم الجديد
- `ADMIN_ATTENDANCE_EDIT_GUIDE.md` - تعديل التحضير

### دوال في admin.js:
- `checkAndNotifyAbsenceViolations()` - فحص وإنشاء إشعارات
- `incrementStudentAbsenceCount()` - زيادة عدد الغيابات
- `determineActionForAbsenceCount()` - تحديد العقوبة
- `loadAdminNotifications()` - تحميل وعرض الإشعارات
- `getTeacherPhone()` - جلب رقم المعلم

---

## ✅ الخلاصة

نظام الإشعارات الآن:
- ✅ **يبدأ من الغياب الأول** (تحديث 2024)
- ✅ **تصميم احترافي** بدون emojis، مع SVG
- ✅ **بطاقات مدمجة** للعرض السريع
- ✅ **تفاصيل عند الطلب** في modal منفصل
- ✅ **فلترة بالمعلم** لسهولة البحث
- ✅ **تواصل WhatsApp** سريع ومُنسّق
- ✅ **responsive** يعمل على جميع الأجهزة

**الحالة:** ✅ جاهز للإنتاج
**تاريخ التحديث:** 2024
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

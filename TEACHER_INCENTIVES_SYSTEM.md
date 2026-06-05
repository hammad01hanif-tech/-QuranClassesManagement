# 🎁 نظام الحوافز للمعلمين - Teacher Incentives System

## 📋 نظرة عامة

نظام متكامل لإدارة حوافز المعلمين يتكون من ثلاثة أقسام رئيسية:
1. **قسم العارض (Viewer)** - منح حوافز تلقائية
2. **لوحة الإدارة (Admin)** - إدارة الإعدادات ومنح حوافز يدوية
3. **صفحة المعلم (Teacher)** - عرض الحوافز

---

## 🔄 دورة عمل النظام الكاملة

### 1️⃣ قسم العارض (js/viewer.js) - الحوافز التلقائية

#### نقاط الربط (Integration Points)
```javascript
// نقطة 1: عند حفظ جزء جديد مع تاريخ عرض
Line 628: في دالة saveNewJuzDisplay()
await grantAutomaticIncentive(teacherId, teacherName, 'juz', juzNumber, reportId, studentName);

// نقطة 2: عند تحديث تاريخ عرض جزء
Line 1113: في دالة updateJuzDisplayDate()
await grantAutomaticIncentive(currentData.teacherId, currentData.teacherName, 'juz', ...);

// نقطة 3: عند حفظ تاريخ عرض من Modal (جزء/حزب)
Line 2845: في دالة saveDisplayDateFromModal()
await grantAutomaticIncentive(currentData.teacherId, currentData.teacherName, type, ...);
```

#### آلية العمل
1. ✅ التحقق من تفعيل الحوافز التلقائية في إعدادات المعلم
2. ✅ قراءة المبلغ والوصف من `staffSettings.incentiveSettings.automatic`
3. ✅ منع التكرار عبر التحقق من `reportId`
4. ✅ إنشاء سجل في `teacherIncentives` collection
5. ✅ إرسال إشعار للمعلم في `teacherNotifications`

#### بنية البيانات المُرسلة
```javascript
{
  incentiveId: "INC_ABD01_1717592400000",
  teacherId: "ABD01",
  teacherName: "عبدالرحمن السيسي",
  type: "automatic",
  source: "viewer",
  incentiveType: "juz_completion", // or "hizb_completion"
  incentiveName: "حافز اجتياز جزء 15",
  reason: "حافز اجتياز جزء 15 - الطالب: محمد",
  amount: 25, // number
  currency: "SAR",
  month: "2026-06",
  year: 2026,
  createdAt: serverTimestamp(),
  grantedBy: "system",
  grantedByName: "النظام التلقائي",
  status: "approved",
  metadata: {
    reportId: "REPORT_ID",
    studentName: "محمد",
    achievementNumber: 15,
    collectionName: "juzDisplays"
  }
}
```

---

### 2️⃣ لوحة الإدارة (js/admin.js) - الإعدادات والحوافز اليدوية

#### أ) إعدادات الحوافز (Lines 9804-9950)
```javascript
incentiveSettings: {
  automatic: {
    juzIncentive: {
      amount: "25",        // string في DB
      description: "حافز اجتياز جزء",
      enabled: true
    },
    hizbIncentive: {
      amount: "25",        // string في DB
      description: "حافز اجتياز حزب",
      enabled: true
    }
  },
  manual: {
    enabled: false         // يمكن تفعيله
  }
}
```

#### ب) منح الحوافز اليدوية (Lines 10057-10240)
```javascript
// 1. فتح Modal
openGrantManualIncentiveModal(teacherId, teacherName)

// 2. إدخال البيانات
- نص حر 100% للسبب (textarea)
- مبلغ مرن (number input)
- معاينة فورية

// 3. منح الحافز
grantManualIncentive(teacherId, teacherName)
```

#### بنية البيانات المُرسلة
```javascript
{
  incentiveId: "INC_MANUAL_ABD01_1717592400000",
  teacherId: "ABD01",
  teacherName: "عبدالرحمن السيسي",
  type: "manual",
  source: "admin",
  incentiveType: "manual_grant",
  incentiveName: "حافز يدوي",
  reason: "تميز في الأداء خلال الأسبوع", // نص حر
  amount: 100, // number
  currency: "SAR",
  month: "2026-06",
  year: 2026,
  createdAt: serverTimestamp(),
  grantedBy: "admin",
  grantedByName: "المدير",
  status: "approved",
  metadata: {
    manualEntry: true,
    source: "admin_panel"
  }
}
```

---

### 3️⃣ صفحة المعلم (js/teacher.js) - عرض الحوافز

#### أ) دالة جلب الحوافز (Lines 165-235)
```javascript
await getTeacherIncentivesForMonth(teacherId, year, month)
```

**الإرجاع:**
```javascript
{
  total: 150,           // إجمالي المبلغ
  count: 4,             // عدد الحوافز
  incentives: [...],    // قائمة الحوافز
  automatic: {
    count: 3,
    total: 75
  },
  manual: {
    count: 1,
    total: 75
  }
}
```

#### ب) البطاقة في الصفحة الرئيسية (Lines 7870-8100)
```html
<!-- حالة وجود حوافز -->
<div class="salary-item incentives clickable" onclick="openIncentivesBottomSheet(...)">
  <span class="salary-icon">🎁</span>
  <div class="salary-details">
    <div class="salary-label">الحوافز والمكافآت</div>
    <div class="salary-amount incentives-amount">+150 ريال</div>
    <div class="salary-meta">3 حافز تلقائي • 1 حافز يدوي</div>
  </div>
  <span class="salary-arrow">◀</span>
</div>

<!-- حالة عدم وجود حوافز -->
<div class="salary-item incentives no-incentives">
  <span class="salary-icon">🎁</span>
  <div class="salary-details">
    <div class="salary-label">الحوافز والمكافآت</div>
    <div class="salary-meta">لا توجد حوافز في الشهر الحالي</div>
  </div>
</div>
```

#### ج) Bottom Sheet للتفاصيل (Lines 8102-8245)
```javascript
window.openIncentivesBottomSheet(incentivesData, monthName)
```

**المكونات:**
1. **ملخص الحوافز** - 3 بطاقات (إجمالي، تلقائي، يدوي)
2. **قائمة التفاصيل** - كل حافز مع:
   - نوع الحافز (⚡ تلقائي / ✍️ يدوي)
   - المبلغ
   - السبب
   - التاريخ
   - من منحه

---

## 🗄️ قاعدة البيانات Firestore

### Collections المستخدمة

#### 1. `staffSettings/{teacherId}`
```javascript
{
  salary: { monthlySalary: 3000, currency: "SAR" },
  incentiveSettings: {
    automatic: {
      juzIncentive: { amount: "25", description: "...", enabled: true },
      hizbIncentive: { amount: "25", description: "...", enabled: true }
    },
    manual: { enabled: false }
  }
}
```

#### 2. `teacherIncentives/{incentiveId}`
```javascript
{
  teacherId: "ABD01",
  type: "automatic" | "manual",
  amount: 25,
  month: "2026-06",
  year: 2026,
  ...
}
```

#### 3. `teacherNotifications/{notificationId}`
```javascript
{
  staffId: "ABD01",
  type: "incentive",
  message: "تم منحك حافز تلقائي...",
  ...
}
```

### Queries المستخدمة

```javascript
// جلب حوافز شهر معين
query(
  collection(db, 'teacherIncentives'),
  where('teacherId', '==', teacherId),
  where('month', '==', '2026-06'),
  orderBy('createdAt', 'desc')
)

// التحقق من عدم التكرار
query(
  collection(db, 'teacherIncentives'),
  where('teacherId', '==', teacherId),
  where('metadata.reportId', '==', reportId)
)
```

---

## 🎨 التصميم (styles.css)

### بطاقة الحوافز
```css
.incentives {
  background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
  border-color: #fde68a;
  cursor: pointer;
}

.incentives-amount {
  color: #d97706 !important;
  font-weight: 800;
}
```

### Bottom Sheet
```css
.incentives-bottom-sheet {
  position: fixed;
  bottom: 0;
  max-height: 85vh;
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.incentives-bottom-sheet.active {
  transform: translateY(0);
}
```

### بطاقات الحوافز في Bottom Sheet
```css
.incentive-item.automatic {
  border-color: #93c5fd;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.incentive-item.manual {
  border-color: #c7d2fe;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
}
```

---

## ✅ التحقق من الربط بين الأقسام

### 🔗 مسار الحافز التلقائي
```
Viewer → grantAutomaticIncentive() 
       → Firestore (teacherIncentives)
       → Teacher (getTeacherIncentivesForMonth)
       → Display في صفحة المعلم
```

### 🔗 مسار الحافز اليدوي
```
Admin → openGrantManualIncentiveModal()
      → grantManualIncentive()
      → Firestore (teacherIncentives)
      → Teacher (getTeacherIncentivesForMonth)
      → Display في صفحة المعلم
```

### ✅ نقاط التحقق
- ✅ **Teacher ID**: يتم نقله بشكل صحيح من كل الأقسام
- ✅ **Month Format**: موحد "YYYY-MM" في كل الأقسام
- ✅ **Amount Type**: 
  - String في `staffSettings`
  - Number في `teacherIncentives`
  - التحويل يتم عبر `parseFloat()`
- ✅ **Duplicate Prevention**: عبر `reportId` للحوافز التلقائية
- ✅ **Real-time Display**: تحديث فوري عند فتح صفحة المعلم

---

## 🚀 الاستخدام

### للمعلم
1. افتح صفحة المعلم (Teacher Section)
2. شاهد إجمالي الحوافز في البطاقة الشهرية
3. اضغط على بطاقة الحوافز لعرض التفاصيل
4. شاهد كل حافز مع سببه وتاريخه

### للإدارة
1. افتح لوحة الإدارة (Admin Panel)
2. اذهب إلى "إعدادات المعلمين"
3. اختر معلم
4. قسم الحوافز:
   - فعّل/عطّل الحوافز التلقائية
   - حدد المبلغ والوصف لكل نوع
   - منح حوافز يدوية بنص حر

### للعارض
- لا حاجة لأي إجراء
- الحوافز تُمنح تلقائياً عند اجتياز الطلاب للأجزاء/الأحزاب

---

## 📊 الإحصائيات والتقارير

### في صفحة المعلم
- إجمالي الحوافز الشهرية
- عدد الحوافز التلقائية
- عدد الحوافز اليدوية
- تأثير الحوافز على الراتب المتوقع

### الحساب النهائي
```javascript
expectedSalary = baseSalary - totalDeductions + incentivesTotal
```

مثال:
- الراتب الأساسي: 3000 ريال
- الخصومات: -200 ريال
- الحوافز: +150 ريال
- **الراتب المتوقع: 2950 ريال**

---

## 🔒 الأمان والصلاحيات

### منع التكرار
```javascript
// التحقق من reportId
const existingQuery = query(
  collection(db, 'teacherIncentives'),
  where('teacherId', '==', teacherId),
  where('metadata.reportId', '==', reportId)
);
```

### صحة البيانات
- ✅ Teacher ID من القوائم المحددة فقط
- ✅ Amount يتم التحقق منه (must be > 0)
- ✅ Month format موحد "YYYY-MM"
- ✅ Timestamps من serverTimestamp()

---

## 📝 ملاحظات مهمة

1. **المبلغ الافتراضي**: 25 ريال (وليس 20)
2. **تنسيق الأرقام**: يستخدم `toLocaleString('ar-SA')`
3. **الحوافز اليدوية**: نص حر 100% بدون قيود
4. **التحديث الفوري**: عند فتح صفحة المعلم تُجلب البيانات من Firestore
5. **الأنيميشن**: Bottom Sheet بتأثير Slide Up سلس
6. **الاستجابة**: متوافق مع جميع أحجام الشاشات

---

## 🎯 المميزات الرئيسية

✨ **حوافز تلقائية**: تُمنح فوراً عند الإنجاز  
✍️ **حوافز يدوية**: نص حر كامل من الإدارة  
📊 **عرض شامل**: ملخص + تفاصيل كاملة  
🎨 **تصميم أنيق**: ألوان هادئة وأنيميشن سلس  
🔒 **آمن**: منع التكرار والتحقق من البيانات  
📱 **متجاوب**: يعمل على جميع الأجهزة  
⚡ **سريع**: استخدام Cache وQuery محسّن

---

## 📚 الملفات المعدّلة

1. **js/viewer.js** - دالة `grantAutomaticIncentive()` + 3 نقاط ربط
2. **js/admin.js** - واجهة الإعدادات + منح الحوافز اليدوية
3. **js/teacher.js** - دالة `getTeacherIncentivesForMonth()` + عرض البطاقة + Bottom Sheet
4. **styles.css** - تصميم كامل للحوافز والـ Bottom Sheet

---

تم بحمد الله ✅

# 🔄 سير العمل الكامل لنظام الغياب بدون عذر

## 📋 نظرة عامة
هذا المستند يشرح **العملية الكاملة** من البداية إلى النهاية لكيفية عمل نظام الغياب بدون عذر والإشعارات المرتبطة به.

---

## ⚖️ اللوائح المعتمدة

### العقوبات التدريجية للغياب بدون عذر:

| الغياب | العقوبة | اللون | الرمز |
|--------|---------|-------|-------|
| **الأول** | الوقوف خارج الحلقة إلى صلاة العشاء | `#ff9800` (برتقالي) | 🚫 |
| **الثاني** | **حرمان من دخول الحلقة واستدعاء ولي الأمر** | `#dc3545` (أحمر) | 📋 |
| **الثالث وما بعده** | **استبعاد كامل من الحلقات (فصل)** | `#721c24` (أحمر غامق) | ❌ |

**ملاحظات مهمة:**
- ✅ يتم إنشاء **إشعار تلقائي** للغياب **من الثاني وما بعده** (2، 3، 4، 5، 6...)
- ❌ الغياب الأول لا ينشئ إشعار (عقوبة داخلية فقط)
- 🔔 الإشعارات تظهر **فوراً** في badge بجانب زر الإشعارات
- ⚠️ الغياب الثالث والرابع والخامس... **جميعهم نفس العقوبة** (استبعاد كامل/فصل)

---

## 🔄 سير العمل الكامل

### الخطوة 1: المشرف يفتح التحضير اليومي

```
📍 قسم الإدارة → التحضير اليومي
↓
🎯 اختيار الحلقة
↓
✅ تحميل قائمة الطلاب
```

**الكود المسؤول:**
- `window.loadDailyQueue()` - في `admin.js`
- يعرض جميع الطلاب في الحلقة المختارة
- كل طالب له أزرار: [حاضر] [متأخر] [غائب بعذر] [غائب بدون عذر] [مشتت]

---

### الخطوة 2: المشرف يسجل الحضور

```
👤 الطالب: أحمد محمد
↓
🚫 يضغط على زر [غائب بدون عذر]
↓
✅ يتغير لون السطر إلى أحمر فاتح (#ffe6e6)
↓
💾 يضغط على [💾 حفظ التحضير]
```

**الكود المسؤول:**
- `window.selectAttendanceStatus(studentId, 'absent-no-excuse')` - تحديد الحالة
- صف الطالب يتحول للون الأحمر الفاتح

---

### الخطوة 3: حفظ البيانات في Firebase

عند الضغط على **💾 حفظ التحضير**:

```javascript
window.saveDailyAttendance = async function() {
  // 1. جمع بيانات جميع الطلاب
  // 2. حفظ كل سجل في:
  //    studentProgress/{studentId}/dailyReports/{date}
  
  for (const record of attendanceData) {
    // حفظ في Firebase
    await setDoc(reportRef, {
      status: 'absent',
      excuseType: 'withoutExcuse',
      date: currentDate,
      timestamp: serverTimestamp()
    });
    
    // ⚡ إذا كان غياب بدون عذر → زيادة العداد
    if (record.status === 'absent' && record.excuseType === 'withoutExcuse') {
      await incrementStudentAbsenceCount(studentId, studentName);
    }
  }
  
  // 3. بعد حفظ جميع السجلات
  // ⚡ فحص وإنشاء الإشعارات
  checkAndNotifyAbsenceViolations();
}
```

**النتيجة:**
- ✅ يتم حفظ السجل في `studentProgress/{studentId}/dailyReports/{date}`
- 📊 البيانات المحفوظة:
  ```javascript
  {
    status: "absent",
    excuseType: "withoutExcuse",
    date: "1447-11-15",
    timestamp: Timestamp,
    late: false,
    distracted: false
  }
  ```

---

### الخطوة 4: زيادة عداد الغياب

```javascript
await incrementStudentAbsenceCount(studentId, studentName);
```

**ماذا تفعل هذه الدالة؟**

1. **تحصل على الشهر الحالي:**
   ```javascript
   const currentMonth = getCurrentHijriMonth(); // مثال: "1447-11"
   ```

2. **تتحقق من وجود سجل للطالب في الشهر الحالي:**
   ```javascript
   const docRef = doc(db, 'monthlyAbsenceTracking', `${studentId}_${currentMonth}`);
   ```

3. **إذا كان السجل موجود:**
   ```javascript
   const newCount = existingData.absenceCount + 1; // زيادة العداد
   const action = determineActionForAbsenceCount(newCount); // تحديد العقوبة
   
   await updateDoc(docRef, {
     absenceCount: newCount,
     absenceRecords: arrayUnion(today), // إضافة التاريخ
     currentAction: action, // حفظ العقوبة
     lastUpdated: serverTimestamp()
   });
   ```

4. **إذا كان السجل جديد (أول غياب):**
   ```javascript
   const action = determineActionForAbsenceCount(1);
   
   await setDoc(docRef, {
     studentId: "STD123",
     studentName: "أحمد محمد",
     month: "1447-11",
     absenceCount: 1,
     absenceRecords: ["1447-11-15"],
     currentAction: {
       level: 1,
       title: "الوقوف خارج الحلقة",
       description: "الغياب الأول بدون عذر: الوقوف خارج الحلقة إلى صلاة العشاء",
       color: "#ff9800",
       emoji: "🚫"
     },
     createdAt: Timestamp,
     lastUpdated: Timestamp
   });
   ```

**النتيجة:**
- ✅ العداد يزيد في `monthlyAbsenceTracking`
- 📋 العقوبة الحالية محفوظة في `currentAction`
- 📅 التاريخ مضاف إلى `absenceRecords`

---

### الخطوة 5: فحص وإنشاء الإشعارات

```javascript
checkAndNotifyAbsenceViolations();
```

**ماذا تفعل هذه الدالة؟**

1. **تحصل على جميع سجلات الغياب للشهر الحالي:**
   ```javascript
   const absenceTrackingSnap = await getDocs(query(
     collection(db, 'monthlyAbsenceTracking'),
     where('month', '==', currentMonth)
   ));
   ```

2. **تفحص كل سجل:**
   ```javascript
   for (const absenceDoc of absenceTrackingSnap.docs) {
     const absenceCount = absenceData.absenceCount;
     
     // ⚡ فقط الغياب الثاني أو الثالث
     if (absenceCount === 2 || absenceCount === 3) {
       // إنشاء إشعار
     }
   }
   ```

3. **تنشئ إشعار إذا لم يكن موجود:**
   ```javascript
   const notificationId = `absence_${studentId}_${currentMonth}_${absenceCount}`;
   const existingNotification = await getDoc(doc(db, 'adminNotifications', notificationId));
   
   if (!existingNotification.exists()) {
     await setDoc(doc(db, 'adminNotifications', notificationId), {
       type: 'absence-violation',
       title: `⚠️ غياب ${absenceCount === 2 ? 'ثاني' : 'ثالث'} بدون عذر`,
       message: `الطالب: ${studentName} | المعلم: ${teacherName}`,
       studentId: studentId,
       studentName: studentName,
       teacherName: teacherName,
       absenceCount: absenceCount,
       penalty: action.title,
       penaltyDescription: action.description,
       penaltyEmoji: action.emoji,
       penaltyColor: action.color,
       month: currentMonth,
       read: false,
       timestamp: serverTimestamp(),
       date: getTodayForStorage(),
       dayName: getCurrentDayName()
     });
   }
   ```

4. **⚡ تحدث badge الإشعارات فوراً:**
   ```javascript
   if (notificationsCreated > 0) {
     await loadAdminNotifications();
   }
   ```

**النتيجة:**
- ✅ إشعار جديد في `adminNotifications` للغياب الثاني أو الثالث
- 🔔 Badge الإشعارات يتحدث **فوراً** بالعدد الجديد
- 📊 ID الإشعار فريد: `absence_STD123_1447-11_2`

---

### الخطوة 6: عرض الإشعار للمشرف

```
🔔 badge يظهر بجانب زر الإشعارات: [🔔 123]
↓
👨‍💼 المشرف يضغط على زر الإشعارات
↓
📋 المودال يفتح ويعرض:
```

**شكل الإشعار:**
```
┌─────────────────────────────────────────────┐
│ 📋 غياب ثاني بدون عذر                      │ ← عنوان أحمر
├─────────────────────────────────────────────┤
│ 👤 أحمد محمد                               │
│ 👨‍🏫 المعلم: أ. عبدالله                     │
│ 📊 الغياب: الثاني بدون عذر                │
├─────────────────────────────────────────────┤
│ 📋 حرمان واستدعاء ولي الأمر                │ ← صندوق العقوبة
│ الغياب الثاني بدون عذر: حرمان من دخول     │
│ الحلقة واستدعاء ولي الأمر                  │
└─────────────────────────────────────────────┘
📅 1447-11-15 - الأربعاء
```

---

## 🧪 مثال عملي كامل

### السيناريو:
طالب اسمه **أحمد محمد** (ID: `STD123`) في حلقة المعلم **عبدالله** (ID: `ABD01`)

### الشهر الأول: `1447-11`

#### **1. اليوم الأول (1447-11-05):**
```
المشرف: يسجل أحمد → [غائب بدون عذر]
النظام: 
  ✅ يحفظ في studentProgress/STD123/dailyReports/1447-11-05
  📊 يزيد العداد → absenceCount = 1
  🚫 العقوبة: الوقوف خارج الحلقة
  ❌ لا إشعار (الأول لا يحتاج إشعار)
```

**في Firestore:**
```javascript
// monthlyAbsenceTracking/STD123_1447-11
{
  studentId: "STD123",
  studentName: "أحمد محمد",
  month: "1447-11",
  absenceCount: 1,
  absenceRecords: ["1447-11-05"],
  currentAction: {
    level: 1,
    title: "الوقوف خارج الحلقة",
    // ...
  }
}
```

---

#### **2. اليوم الثاني (1447-11-12):**
```
المشرف: يسجل أحمد → [غائب بدون عذر] مرة ثانية
النظام:
  ✅ يحفظ في studentProgress/STD123/dailyReports/1447-11-12
  📊 يزيد العداد → absenceCount = 2
  📋 العقوبة: حرمان واستدعاء ولي الأمر
  🔔 ينشئ إشعار تلقائياً!
  ✨ badge يتحدث فوراً: [🔔 1]
```

**في Firestore:**
```javascript
// monthlyAbsenceTracking/STD123_1447-11
{
  absenceCount: 2,  // ← زاد!
  absenceRecords: ["1447-11-05", "1447-11-12"],
  currentAction: {
    level: 2,
    title: "حرمان واستدعاء ولي الأمر",
    description: "الغياب الثاني بدون عذر: حرمان من دخول الحلقة واستدعاء ولي الأمر",
    color: "#dc3545",
    emoji: "📋"
  }
}

// adminNotifications/absence_STD123_1447-11_2
{
  type: 'absence-violation',
  title: '⚠️ غياب ثاني بدون عذر',
  studentName: 'أحمد محمد',
  teacherName: 'أ. عبدالله',
  absenceCount: 2,
  penalty: 'حرمان واستدعاء ولي الأمر',
  read: false,
  // ...
}
```

**في الواجهة:**
- 🔔 Badge بجانب زر الإشعارات: **[🔔 1]**
- المشرف يضغط على الزر → المودال يفتح
- يرى الإشعار بتفاصيل العقوبة

---

#### **3. اليوم الثالث (1447-11-20):**
```
المشرف: يسجل أحمد → [غائب بدون عذر] للمرة الثالثة
النظام:
  ✅ يحفظ في studentProgress/STD123/dailyReports/1447-11-20
  📊 يزيد العداد → absenceCount = 3
  ❌ العقوبة: استبعاد كامل من الحلقات (فصل)
  🚨 ينشئ إشعار تلقائياً!
  ✨ badge يتحدث: [🔔 2]
```

**في Firestore:**
```javascript
// monthlyAbsenceTracking/STD123_1447-11
{
  absenceCount: 3,  // ← زاد!
  absenceRecords: ["1447-11-05", "1447-11-12", "1447-11-20"],
  currentAction: {
    level: 3,
    title: "استبعاد كامل من الحلقة",
    description: "الغياب الثالث وما بعده بدون عذر: استبعاد كامل من الحلقات (فصل)",
    color: "#721c24",
    emoji: "❌"
  }
}

// adminNotifications/absence_STD123_1447-11_3
{
  type: 'absence-violation',
  title: '⚠️ غياب ثالث بدون عذر',
  studentName: 'أحمد محمد',
  teacherName: 'أ. عبدالله',
  absenceCount: 3,
  penalty: 'استبعاد كامل من الحلقة',
  read: false,
  // ...
}
```

**في الواجهة:**
- 🔔 Badge: **[🔔 2]** (الإشعار الثاني والثالث)
- المشرف يرى إشعارين في المودال

---

#### **4. اليوم الرابع (1447-11-25):**
```
المشرف: يسجل أحمد → [غائب بدون عذر] للمرة الرابعة
النظام:
  ✅ يحفظ في studentProgress/STD123/dailyReports/1447-11-25
  📊 يزيد العداد → absenceCount = 4
  ❌ العقوبة: استبعاد كامل من الحلقات (فصل) - نفس العقوبة السابقة!
  🚨 ينشئ إشعار تلقائياً!
  ✨ badge يتحدث: [🔔 3]
```

**في Firestore:**
```javascript
// adminNotifications/absence_STD123_1447-11_4
{
  type: 'absence-violation',
  title: '⚠️ غياب رابع بدون عذر',
  studentName: 'أحمد محمد',
  teacherName: 'أ. عبدالله',
  absenceCount: 4,
  penalty: 'استبعاد كامل من الحلقة',
  read: false,
  // ...
}
```

**ملاحظة:** الغياب الرابع والخامس والسادس... **جميعهم نفس العقوبة** (استبعاد كامل)، ولكن يتم إنشاء **إشعار لكل غياب** للتوثيق والمتابعة.

---

### الشهر الثاني: `1447-12`

```
🔄 العداد يبدأ من الصفر تلقائياً!
```

إذا غاب أحمد في الشهر الجديد:
- ✅ يبدأ من `absenceCount = 1` (جديد)
- 📄 السجلات القديمة محفوظة في `STD123_1447-11`
- 📝 السجلات الجديدة في `STD123_1447-12`

---

## 🎯 ملخص العملية

```
1. المشرف يفتح التحضير اليومي
   ↓
2. يختار الحلقة
   ↓
3. يسجل الطالب → [غائب بدون عذر]
   ↓
4. يضغط [💾 حفظ التحضير]
   ↓
5. النظام:
   ✅ يحفظ في studentProgress/.../dailyReports
   📊 يزيد العداد في monthlyAbsenceTracking
   🎯 يحدد العقوبة (determineActionForAbsenceCount)
   📋 يحفظ العقوبة في currentAction
   ↓
6. إذا كان الغياب الثاني أو الثالث:
   🔔 ينشئ إشعار في adminNotifications
   ✨ يحدث badge الإشعارات فوراً
   ↓
7. المشرف يضغط على 🔔
   ↓
8. المودال يفتح ويعرض الإشعار بالتفاصيل
```

---

## 🔍 نقاط مهمة

### ✅ ما يحدث تلقائياً:
1. زيادة العداد عند كل غياب بدون عذر
2. تحديد العقوبة المناسبة بناءً على العدد
3. إنشاء إشعار للغياب الثاني والثالث
4. تحديث badge الإشعارات فوراً
5. التصفير التلقائي كل شهر هجري

### ❌ ما لا يحدث:
1. الغياب الأول لا ينشئ إشعار
2. الغياب بعذر لا يؤثر على العداد
3. التأخير لا يؤثر (نظام منفصل)

### 🎨 الألوان والرموز:
- **الأول:** 🚫 برتقالي `#ff9800`
- **الثاني:** 📋 أحمر `#dc3545`
- **الثالث:** ❌ أحمر غامق `#721c24`

---

## 📞 الملفات المسؤولة

| الملف | الوظيفة |
|------|---------|
| `js/admin.js` | يحتوي على جميع الدوال |
| `index.html` | يحتوي على واجهة المستخدم والمودال |
| `styles.css` | يحتوي على تصميم المودال (أزرق/بنفسجي) |
| `firebase-config.js` | إعدادات Firebase |

### الدوال الرئيسية:
1. `window.saveDailyAttendance()` - حفظ التحضير
2. `incrementStudentAbsenceCount()` - زيادة العداد
3. `determineActionForAbsenceCount()` - تحديد العقوبة
4. `checkAndNotifyAbsenceViolations()` - إنشاء الإشعارات
5. `loadAdminNotifications()` - تحميل وعرض الإشعارات

---

## 🎉 النتيجة النهائية

✅ **نظام متكامل وتلقائي بالكامل!**

- المشرف يسجل فقط → النظام يتولى الباقي
- الإشعارات تظهر فوراً بدون تحديث
- العقوبات واضحة ومحددة
- التصفير التلقائي كل شهر
- السجلات محفوظة للمراجعة

---

**آخر تحديث:** 2026-06-25  
**الإصدار:** 1.0  
**الحالة:** ✅ نشط ويعمل بكفاءة

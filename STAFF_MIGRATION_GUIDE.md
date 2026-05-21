# 📘 دليل نقل إعدادات المعلمين (Migration)

## 🎯 الهدف

نقل إعدادات المعلمين من ملف JavaScript المحلي (`teachers-attendance-config.js`) إلى Firestore في collection جديد اسمه `staffSettings`.

---

## 📋 قبل البدء - تحضيرات

### ✅ تأكد من:

1. **الاتصال بالإنترنت** ✓
2. **Firestore مفعّل** في مشروع Firebase ✓
3. **لديك صلاحيات الكتابة** في Firestore ✓
4. **أضفت العارضين الأربعة** في collection classes ✓

---

## 🚀 خطوات التنفيذ

### الخطوة 1️⃣: فتح أداة Migration

1. افتح المتصفح
2. اذهب إلى الملف: `staff-migration-tool.html`
3. يمكنك فتحه عبر Live Server أو مباشرة

**أو افتحه من المتصفح:**
```
file:///C:/Users/Acer/QuranClasses-webProject/staff-migration-tool.html
```

---

### الخطوة 2️⃣: معاينة البيانات

1. اضغط على زر **"👀 معاينة البيانات"**
2. ستظهر قائمة بجميع المعلمين وإعداداتهم:

```
1. عبدالله بن محمد (ABD01)
   - الراتب: 3000 ريال
   - بداية الدوام: العصر + 35 دقيقة
   - خصمية التأخير: 5 ريال/30 دقيقة

2. خالد بن أحمد (KHL01)
   ...

📊 إجمالي المعلمين: 5
```

3. **راجع البيانات** وتأكد أنها صحيحة

---

### الخطوة 3️⃣: تنفيذ عملية النقل

1. اضغط على زر **"🚀 بدء عملية النقل"**
2. ستظهر رسالة تأكيد - اضغط **"OK"**
3. انتظر حتى تكتمل العملية (قد تستغرق 5-10 ثواني)

**ستظهر رسائل مثل:**
```
🚀 بدء عملية Migration...
📝 معالجة: عبدالله بن محمد (ABD01)
✅ تم نقل: عبدالله بن محمد
📝 معالجة: خالد بن أحمد (KHL01)
✅ تم نقل: خالد بن أحمد
...

📊 ملخص عملية Migration:
✅ نجح: 5
❌ فشل: 0
📝 الإجمالي: 5
```

4. عند النجاح، ستظهر رسالة: **"✅ تمت عملية النقل بنجاح!"**

---

### الخطوة 4️⃣: التحقق من Firestore

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اختر مشروعك
3. اذهب إلى **Firestore Database**
4. ستجد Collection جديد اسمه: **`staffSettings`**
5. افتحه - يجب أن ترى 5 مستندات:

```
staffSettings/
├── ABD01
├── KHL01
├── MHD01
├── AHM01
└── YSF01
```

---

## 📊 مثال على محتوى مستند

عند فتح مستند `ABD01` في Firestore، ستجد:

```javascript
{
  staffId: "ABD01",
  
  workSchedule: {
    minutesAfterAsr: 35,
    minutesAfterIsha: 30,
    workDays: [0, 1, 2, 3, 4],
    followsPrayerTimes: true,
    fixedStartTime: null,
    fixedEndTime: null,
    gracePeriod: 5
  },
  
  penalties: {
    latePenalty: {
      enabled: true,
      amount: 5,
      intervalMinutes: 30,
      roundingMethod: "ceil",
      maxDailyDeduction: 20
    },
    
    absencePenalty: {
      enabled: true,
      calculationMethod: "salary_divided_by_30",
      fixedAmount: null,
      allowExcusedAbsence: true,
      excusedAbsenceDeduction: 0
    },
    
    earlyLeavePenalty: {
      enabled: true,
      amount: 5,
      intervalMinutes: 30,
      graceMinutes: 5,
      maxDailyDeduction: 20
    }
  },
  
  salary: {
    monthlySalary: 3000,
    currency: "SAR"
  },
  
  active: true,
  
  createdAt: timestamp,
  updatedAt: timestamp,
  
  notes: "تم النقل من teachers-attendance-config.js",
  migratedAt: "2026-05-21T..."
}
```

---

## ❓ الأسئلة الشائعة

### ❓ ماذا لو شغّلت Migration مرتين؟

**الإجابة:** سيتم **استبدال** البيانات القديمة بالجديدة. لا مشكلة، لكن إذا عدّلت شيء يدوياً في Firestore، سيضيع التعديل.

---

### ❓ هل يمكنني تعديل البيانات بعد النقل؟

**الإجابة:** نعم! يمكنك تعديل أي مستند في Firestore Console مباشرة، أو من واجهة الإدارة (سنبنيها لاحقاً).

---

### ❓ ماذا لو فشلت عملية النقل؟

**الإجابة:** 
1. تحقق من الاتصال بالإنترنت
2. تحقق من Firebase Console أن Firestore مفعّل
3. راجع رسائل الخطأ في أداة Migration
4. حاول مرة أخرى

---

### ❓ هل أحتاج إلى حذف الملف القديم؟

**الإجابة:** لا! احتفظ بملف `teachers-attendance-config.js` كنسخة احتياطية. النظام سيستخدم Firestore أولاً، وإذا فشل، سيرجع للملف.

---

## 🎯 بعد اكتمال Migration

### ✅ ما تم إنجازه:

- ✅ Collection جديد: `staffSettings`
- ✅ 5 مستندات (واحد لكل معلم)
- ✅ جميع الإعدادات منقولة
- ✅ جاهز للاستخدام في النظام

### 🔜 الخطوة التالية:

**المرحلة 3:** تعديل `attendance-calculator.js` ليجلب الإعدادات من Firestore بدلاً من الملف.

---

## 🆘 في حالة وجود مشاكل

### مشكلة: "Permission denied"

**الحل:**
```javascript
// تحقق من Firebase Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /staffSettings/{staffId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

### مشكلة: "Module not found"

**الحل:** تأكد أن الملفات موجودة:
- `js/staff-migration.js` ✓
- `data/teachers-attendance-config.js` ✓
- `firebase-config.js` ✓

---

## 📞 ملاحظات نهائية

- ⏱️ **المدة المتوقعة:** 1-2 دقيقة
- 💾 **عدد الكتابات:** 5 كتابات (واحدة لكل معلم)
- 🔒 **الأمان:** البيانات محفوظة في Firestore
- 🔄 **يمكن التكرار:** نعم، بدون مشاكل

---

**جاهز للبدء؟ افتح الأداة وابدأ! 🚀**

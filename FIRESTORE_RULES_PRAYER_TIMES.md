# 🔒 قواعد Firestore لنظام أوقات الصلاة

## 📝 إضافة قواعد في Firebase Console

1. افتح [Firebase Console](https://console.firebase.google.com)
2. اختر مشروعك
3. اذهب إلى **Firestore Database**
4. اضغط على تبويب **Rules**
5. أضف هذه القواعد:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... قواعدك الحالية ...
    
    // قواعد أوقات الصلاة (للقراءة فقط للجميع)
    match /prayerTimes/{monthKey} {
      // السماح بالقراءة للجميع
      allow read: if true;
      
      // السماح بالكتابة للمسؤولين فقط
      allow write: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 🔐 شرح القواعد

### القراءة (Read):
```javascript
allow read: if true;
```
- ✅ أي شخص يمكنه قراءة أوقات الصلاة
- مناسب لأن البيانات عامة وليست حساسة

### الكتابة (Write):
```javascript
allow write: if request.auth != null && 
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
```
- ✅ فقط المسؤولين (admin) يمكنهم إضافة/تعديل أوقات الصلاة
- يتحقق من:
  1. المستخدم مسجل دخول (`request.auth != null`)
  2. دور المستخدم هو `admin`

---

## 🧪 اختبار القواعد

بعد إضافة القواعد، اختبر:

### 1. القراءة (يجب أن تنجح):
```javascript
const times = await getPrayerTimesForDate("2026-05-17");
console.log(times); // ✅ يعمل للجميع
```

### 2. الكتابة كـ Admin (يجب أن تنجح):
```javascript
// تسجيل دخول كـ admin أولاً
await fetchAndStoreCurrentMonth();
// ✅ يعمل للمسؤولين فقط
```

### 3. الكتابة بدون تسجيل دخول (يجب أن تفشل):
```javascript
// بدون تسجيل دخول
await fetchAndStoreCurrentMonth();
// ❌ Permission Denied
```

---

## 🔧 قواعد بديلة (حسب احتياجاتك)

### أ) السماح للجميع (للتطوير فقط):
```javascript
match /prayerTimes/{monthKey} {
  allow read, write: if true; // ⚠️ غير آمن في Production
}
```

### ب) السماح فقط للمعلمين والمسؤولين:
```javascript
match /prayerTimes/{monthKey} {
  allow read: if request.auth != null;
  
  allow write: if request.auth != null && 
                 (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher');
}
```

### ج) القراءة للجميع، الكتابة معطلة:
```javascript
match /prayerTimes/{monthKey} {
  allow read: if true;
  allow write: if false; // لا أحد يمكنه الكتابة (استخدم Firebase Admin SDK)
}
```

---

## ✅ التحقق من القواعد

افتح Console في المتصفح واختبر:

```javascript
// اختبار 1: القراءة
console.log('Test 1: Reading prayer times...');
const times = await window.getPrayerTimesForDate('2026-05-17');
console.log(times ? '✅ Read Success' : '❌ Read Failed');

// اختبار 2: الكتابة (يتطلب admin)
console.log('Test 2: Writing prayer times...');
try {
  await window.fetchAndStoreCurrentMonth();
  console.log('✅ Write Success');
} catch (error) {
  console.log('❌ Write Failed:', error.message);
}
```

---

## 📌 ملاحظات مهمة

1. ✅ بعد تعديل القواعد، انتظر **دقيقة** قبل الاختبار
2. ✅ تأكد من نشر القواعد (Publish) في Firebase Console
3. ✅ راجع تبويب **Rules Playground** لاختبار القواعد قبل النشر
4. ⚠️ لا تستخدم `allow read, write: if true` في Production (غير آمن)
5. ✅ احتفظ بنسخة احتياطية من القواعد قبل التعديل

---

## 🐛 حل المشاكل

### المشكلة: "Missing or insufficient permissions"
**السبب:** القواعد لا تسمح بالعملية

**الحل:**
1. تحقق من تسجيل الدخول: `firebase.auth().currentUser`
2. تحقق من دور المستخدم في Firestore
3. راجع القواعد في Firebase Console
4. افحص Console للأخطاء

### المشكلة: القواعد لا تعمل بعد التحديث
**السبب:** التأخير في نشر القواعد

**الحل:**
1. انتظر دقيقة كاملة
2. امسح Cache المتصفح (Ctrl + Shift + R)
3. أعد تسجيل الدخول
4. تحقق من نشر القواعد في Firebase Console

---

**✅ بعد إضافة القواعد، النظام جاهز للاستخدام!**

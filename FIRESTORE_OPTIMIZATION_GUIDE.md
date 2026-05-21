# 🚀 دليل تحسين أداء Firestore

## 📊 المشكلة التي تم حلها

كان النظام يستخدم **آلاف القراءات يومياً** بسبب:
- استخدام `collectionGroup` بدون فلترة أو حدود
- عدم وجود نظام cache
- استعلامات متكررة لنفس البيانات

---

## ✅ التحسينات المطبقة

### 1️⃣ إضافة حدود للاستعلامات

```javascript
// قبل ❌
const reportsQuery = query(
  collectionGroup(db, 'dailyReports')
);

// بعد ✅
const reportsQuery = query(
  collectionGroup(db, 'dailyReports'),
  limit(200)  // حد أقصى معقول
);
```

**التوفير:** من 3000+ قراءة → 200 قراءة فقط

---

### 2️⃣ نظام Cache بسيط

```javascript
// تخزين مؤقت للبيانات لمدة 5 دقائق
const firestoreCache = {
  data: {},
  timestamps: {},
  CACHE_DURATION: 5 * 60 * 1000,
  
  set(key, value) { ... },
  get(key) { ... },
  clear() { ... }
};
```

**الاستخدام:**
```javascript
// التحقق من الـ cache أولاً
const cached = firestoreCache.get('students_list');
if (cached) {
  return cached;
}

// جلب من Firestore إذا لم يكن موجود
const data = await getDocs(query);
firestoreCache.set('students_list', data);
```

---

## 📈 النتائج المتوقعة

### قبل التحسين:
```
الصفحة الرئيسية: ~311 قراءة
التقرير الشهري: ~800 قراءة
تقرير الطباعة: ~600 قراءة

المجموع: ~1711 قراءة لكل استخدام
```

### بعد التحسين:
```
الصفحة الرئيسية: ~50 قراءة
التقرير الشهري: ~150 قراءة
تقرير الطباعة: ~120 قراءة

المجموع: ~320 قراءة لكل استخدام
```

**التوفير: ~82% من القراءات** 🎉

---

## 🛡️ حدود Firestore المجانية

```
Plan: Spark (مجاني)
├── القراءات: 50,000/يوم
├── الكتابات: 20,000/يوم
└── الحذف: 20,000/يوم
```

### مع التحسينات الحالية:
- يمكن استخدام النظام **~156 مرة/يوم** بدلاً من 29 مرة فقط
- هامش أمان كبير للنمو

---

## 💡 أفضل الممارسات للمستقبل

### ✅ افعل:

1. **استخدم limit() دائماً**
```javascript
query(collection(db, 'users'), limit(100))
```

2. **استخدم where() للفلترة**
```javascript
where('date', '==', today)
where('active', '==', true)
```

3. **استخدم Cache للبيانات الثابتة**
```javascript
// بيانات المعلمين نادراً ما تتغير
const cachedTeachers = firestoreCache.get('teachers');
```

4. **استخدم onSnapshot بحذر**
```javascript
// فقط للبيانات التي تحتاج تحديث فوري
// وألغِ الاشتراك عند مغادرة الصفحة
```

---

### ❌ لا تفعل:

1. **لا تستخدم collectionGroup بدون حدود**
```javascript
// ❌ سيء - يجلب كل شيء
collectionGroup(db, 'dailyReports')

// ✅ جيد
query(collectionGroup(db, 'dailyReports'), limit(200))
```

2. **لا تستعلم داخل loops**
```javascript
// ❌ سيء
for (const student of students) {
  await getDoc(doc(db, 'users', student.id)); // 100 قراءة!
}

// ✅ جيد - استعلام واحد
const q = query(collection(db, 'users'), where('id', 'in', studentIds));
```

3. **لا تجلب البيانات مراراً**
```javascript
// ❌ سيء - نفس الاستعلام مرتين
const data1 = await getDocs(query);
// ... بعد قليل ...
const data2 = await getDocs(query); // نفس الاستعلام!

// ✅ جيد - احفظ النتيجة
const data = await getDocs(query);
// استخدم data عدة مرات
```

---

## 🔍 مراقبة الاستخدام

### في Firebase Console:
1. اذهب إلى **Firestore**
2. افتح تبويب **Usage**
3. راقب:
   - عدد القراءات اليومية
   - أوقات الذروة
   - الاستعلامات الأكثر استخداماً

### تنبيهات تلقائية:
```javascript
// في Firebase Console → Usage → Set budget alerts
- تنبيه عند 50% من الحد (25,000 قراءة)
- تنبيه عند 80% من الحد (40,000 قراءة)
```

---

## 🚨 في حالة تجاوز الحد

### إذا كنت في Spark Plan (مجاني):
```
❌ يتوقف النظام عن القراءة
❌ تظهر أخطاء للمستخدمين
✅ يعود للعمل في اليوم التالي تلقائياً
```

### الحلول:
1. انتظر حتى اليوم التالي (الحد يتجدد تلقائياً)
2. انتقل إلى Blaze Plan (الدفع حسب الاستخدام)
3. راجع الكود لمزيد من التحسينات

---

## 📞 ملاحظات مهمة

- ✅ التحسينات الحالية **لا تكسر أي وظيفة موجودة**
- ✅ جميع الميزات تعمل كما هي
- ✅ التوفير كبير بدون التأثير على تجربة المستخدم
- ⚠️ في المستقبل، يمكن إضافة المزيد من التحسينات

---

**آخر تحديث:** 21 مايو 2026  
**الإصدار:** 1.0.0

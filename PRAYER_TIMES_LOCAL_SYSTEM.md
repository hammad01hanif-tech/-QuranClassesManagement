# نظام أوقات الصلاة المحلي 🕌

## نظرة عامة
تم إنشاء نظام متكامل لجلب وتخزين أوقات الصلاة محلياً في ملف JSON، بحيث لا يتطلب استدعاء API في كل مرة.

---

## 📁 الملفات المُنشأة

### 1. `fetch-prayer-data.js` (جلب البيانات)
- **الوظيفة:** Script يجلب أوقات الصلاة من Aladhan API ويخزنها محلياً
- **الاستخدام:** `node fetch-prayer-data.js`
- **المميزات:**
  - جلب عدة أشهر دفعة واحدة (حالياً: 8 أشهر من مايو-ديسمبر 2026)
  - التحقق من أوقات العصر والعشاء (لا يحفظ أيام بأوقات ناقصة)
  - تأخير ثانية واحدة بين الطلبات لتجنب rate limiting
  - إنشاء نسختين: عادية (formatted) ومضغوطة (minified)
  - عرض تقارير مفصلة عن نجاح العملية

**إعدادات API:**
```javascript
const CITY = 'Makkah';
const COUNTRY = 'Saudi Arabia';
const METHOD = 4;    // Umm al-Qura University, Makkah
const SCHOOL = 0;    // Shafi
```

**الفترة المحفوظة:**
- السنة: 2026
- الأشهر: 5 (مايو) - 12 (ديسمبر)
- إجمالي الأيام: 245 يوم

---

### 2. `data/prayer-times-2026.json` (البيانات)
**حجم الملف:** 165.62 KB (formatted) | 103.42 KB (minified)

**هيكل البيانات:**
```json
{
  "location": "Makkah",
  "country": "Saudi Arabia",
  "method": 4,
  "school": 0,
  "year": 2026,
  "fetchedAt": "2026-05-17T11:15:08.687Z",
  "months": [
    {
      "year": 2026,
      "month": 5,
      "monthName": "May",
      "totalDays": 31,
      "days": [
        {
          "gregorianDate": "01-05-2026",
          "gregorianDay": 1,
          "gregorianMonth": 5,
          "gregorianYear": 2026,
          "gregorianMonthName": "May",
          "gregorianWeekday": "Friday",
          "hijriDate": "14-11-1447",
          "hijriDay": 14,
          "hijriMonth": 11,
          "hijriYear": 1447,
          "hijriMonthName": "ذوالقعدة",
          "hijriWeekday": "الجمعة",
          "fajr": "04:29",
          "sunrise": "05:50",
          "dhuhr": "12:18",
          "asr": "15:38",
          "maghrib": "18:46",
          "isha": "20:16",
          "location": "Makkah",
          "country": "Saudi Arabia"
        }
      ]
    }
  ]
}
```

---

### 3. `js/prayer-times-local.js` (قراءة البيانات)
**الوظيفة:** مكتبة JavaScript لقراءة البيانات المحفوظة محلياً

**الدوال المتاحة:**

#### 1. `getPrayerTimesLocal(date)`
جلب أوقات الصلاة ليوم معين
```javascript
const times = getPrayerTimesLocal('2026-05-17');
console.log(times.fajr, times.asr, times.isha);
```

#### 2. `getTodayPrayerTimes()`
جلب أوقات الصلاة ليوم اليوم
```javascript
const today = getTodayPrayerTimes();
console.log(today.asr); // 15:38
```

#### 3. `getMonthPrayerTimes(year, month)`
جلب جميع أوقات الصلاة لشهر كامل
```javascript
const mayTimes = getMonthPrayerTimes(2026, 5);
console.log(mayTimes.length); // 31 days
```

#### 4. `getNextPrayer()`
جلب الصلاة القادمة مع الوقت المتبقي
```javascript
const next = getNextPrayer();
console.log(next.name);              // "العصر"
console.log(next.time);              // "15:38"
console.log(next.remainingHours);    // 2
console.log(next.remainingMins);     // 45
```

#### 5. `isAsrTime()`
هل الوقت الحالي بين العصر والمغرب؟
```javascript
if (isAsrTime()) {
  console.log('الآن وقت العصر');
}
```

#### 6. `isIshaTime()`
هل الوقت الحالي بعد العشاء؟
```javascript
if (isIshaTime()) {
  console.log('دخل وقت العشاء');
}
```

#### 7. `getAvailableMonths()`
جلب قائمة بجميع الأشهر المتاحة
```javascript
const months = getAvailableMonths();
console.log(months);
// [{year: 2026, month: 5, monthName: "May", totalDays: 31}, ...]
```

#### 8. `getDataInfo()`
جلب معلومات عن البيانات المحفوظة
```javascript
const info = getDataInfo();
console.log(info.totalMonths); // 8
console.log(info.totalDays);   // 245
console.log(info.location);    // "Makkah"
```

---

### 4. `test-prayer-times-local.html` (صفحة اختبار)
**الوصول:** `http://localhost:8000/test-prayer-times-local.html`

**المميزات:**
- ✅ عرض معلومات البيانات المحفوظة (عدد الأشهر والأيام)
- ✅ عرض الصلاة القادمة مع الوقت المتبقي
- ✅ عرض أوقات الصلاة اليوم
- ✅ البحث عن يوم معين
- ✅ عرض شهر كامل في جدول
- ✅ تمييز أوقات العصر والعشاء

---

## 🔄 سير العمل (Workflow)

### المرحلة 1: جلب البيانات (مرة واحدة أو عند التحديث)
```bash
node fetch-prayer-data.js
```

**النتيجة:**
- ✅ جلب 8 أشهر (245 يوم)
- ✅ التحقق من أوقات العصر والعشاء: 245/245
- ✅ حفظ في `data/prayer-times-2026.json`
- ✅ حفظ نسخة مضغوطة `data/prayer-times-2026.min.json`

### المرحلة 2: استخدام البيانات في التطبيق
```javascript
import { getTodayPrayerTimes, getNextPrayer } from './js/prayer-times-local.js';

// في أي صفحة من صفحات التطبيق
const today = getTodayPrayerTimes();
console.log(`وقت العصر اليوم: ${today.asr}`);

const next = getNextPrayer();
console.log(`الصلاة القادمة: ${next.name} - ${next.time}`);
```

---

## ⚙️ التخصيص والتعديل

### لتغيير المدينة:
في `fetch-prayer-data.js`:
```javascript
const CITY = 'Riyadh';       // اسم المدينة
const COUNTRY = 'Saudi Arabia';
```

### لتغيير عدد الأشهر:
في `fetch-prayer-data.js`:
```javascript
const START_MONTH = 1;   // يناير
const END_MONTH = 12;    // ديسمبر
```

### لتغيير طريقة الحساب:
في `fetch-prayer-data.js`:
```javascript
const METHOD = 4;   // 4 = Umm al-Qura
                   // 1 = Muslim World League
                   // 2 = Islamic Society of North America
```

---

## 📊 التحقق من البيانات

**الفحوصات التلقائية:**
- ✅ التحقق من وجود وقت العصر في كل يوم
- ✅ التحقق من وجود وقت العشاء في كل يوم
- ✅ عرض تقرير مفصل عن النجاح/الفشل
- ✅ عدم حفظ البيانات في حال وجود أوقات ناقصة

**نتيجة التحقق الأخيرة:**
```
✅ Asr times verified: 245/245
✅ Isha times verified: 245/245
🎉 ALL PRAYER TIMES VERIFIED SUCCESSFULLY!
```

---

## 🎯 الاستخدامات المستقبلية

### 1. عرض أوقات الصلاة في الصفحة الرئيسية
```javascript
import { getTodayPrayerTimes } from './js/prayer-times-local.js';

const times = getTodayPrayerTimes();
document.getElementById('fajr').textContent = times.fajr;
document.getElementById('asr').textContent = times.asr;
// ... إلخ
```

### 2. إرسال تنبيهات قبل الصلاة
```javascript
import { getNextPrayer } from './js/prayer-times-local.js';

const next = getNextPrayer();
if (next.remainingMinutes <= 15) {
  showNotification(`الصلاة القادمة ${next.name} بعد ${next.remainingMins} دقيقة`);
}
```

### 3. إضافة أوقات الصلاة في بطاقة دخول الحلقة
```javascript
import { getTodayPrayerTimes } from './js/prayer-times-local.js';

const times = getTodayPrayerTimes();
const message = `أوقات الصلاة اليوم:
الفجر: ${times.fajr}
العصر: ${times.asr}
المغرب: ${times.maghrib}`;
```

### 4. تحديد أوقات الحضور والانصراف
```javascript
import { getPrayerTimesLocal } from './js/prayer-times-local.js';

const times = getPrayerTimesLocal(attendanceDate);
const lessonStart = times.asr;  // بدء الحلقة بعد العصر
const lessonEnd = times.maghrib; // نهاية الحلقة عند المغرب
```

---

## 🔧 الصيانة

### تحديث البيانات (كل 6 أشهر مثلاً):
1. افتح `fetch-prayer-data.js`
2. غيّر التاريخ في `const START_MONTH` و `const END_MONTH`
3. شغّل: `node fetch-prayer-data.js`
4. تأكد من نجاح العملية (245/245 verified)
5. البيانات الجديدة ستحل محل القديمة تلقائياً

### إضافة أشهر إضافية:
```javascript
// في fetch-prayer-data.js
const START_MONTH = 13;  // يناير 2027
const END_MONTH = 18;    // يونيو 2027
```

ثم:
```bash
node fetch-prayer-data.js
```

---

## ✅ الخلاصة

### تم الإنجاز:
- ✅ **Script جلب البيانات:** `fetch-prayer-data.js`
- ✅ **البيانات المحلية:** 8 أشهر (245 يوم) محفوظة في JSON
- ✅ **مكتبة القراءة:** `prayer-times-local.js` مع 8 دوال
- ✅ **صفحة اختبار:** `test-prayer-times-local.html`
- ✅ **التحقق الكامل:** جميع أوقات العصر والعشاء موجودة

### الخطوات القادمة (حسب رغبة المستخدم):
- ⏳ دمج البيانات في واجهة الإدارة
- ⏳ إضافة عرض أوقات الصلاة في الصفحة الرئيسية
- ⏳ إدراج الأوقات في بطاقة الدخول للحلقة
- ⏳ تنبيهات قبل أوقات الصلاة

---

## 📞 ملاحظات مهمة

1. **ES6 Modules:** الملف `prayer-times-local.js` يستخدم `import` وبالتالي يجب فتح الصفحات عبر `http://` وليس `file://`
2. **السيرفر:** تأكد من تشغيل `node server.js` قبل فتح صفحة الاختبار
3. **CORS:** إذا ظهرت أخطاء CORS، تأكد من الوصول عبر `http://localhost:8000/`
4. **التحديث التلقائي:** حالياً البيانات ثابتة، إذا أردت تحديث تلقائي، يمكن جدولة script شهرياً

---

تم إنشاء النظام بنجاح! 🎉

# 🕌 نظام أوقات الصلاة - Aladhan API Integration

## 📋 الوصف

نظام متكامل لجلب وتخزين أوقات الصلاة لمدينة **مكة المكرمة، المملكة العربية السعودية** باستخدام Aladhan API.

---

## ✨ المميزات

- ✅ جلب أوقات الصلاة من Aladhan API
- ✅ تخزين البيانات في Firestore
- ✅ دعم التواريخ **الميلادية والهجرية**
- ✅ جلب شهر كامل بضغطة واحدة
- ✅ استعلام سريع عن أوقات الصلاة لأي يوم
- ✅ بيانات دقيقة لمكة المكرمة (Umm al-Qura Method)

---

## 🔧 الإعدادات

### API Configuration:
```javascript
API: https://api.aladhan.com/v1/calendarByCity
المدينة: Makkah (مكة المكرمة)
الدولة: Saudi Arabia
Method: 4 (Umm al-Qura University, Makkah)
School: 0 (Shafi)
```

---

## 📁 هيكل البيانات

### Firestore Collection: `prayerTimes`

```javascript
prayerTimes/{YYYY-MM}/
  {
    year: 2026,
    month: 5,
    monthKey: "2026-05",
    location: "Makkah",
    country: "Saudi Arabia",
    totalDays: 31,
    fetchedAt: Timestamp,
    days: [
      {
        // Gregorian Date
        gregorianDate: "17-05-2026",
        gregorianDay: 17,
        gregorianMonth: 5,
        gregorianYear: 2026,
        gregorianMonthName: "May",
        gregorianWeekday: "Sunday",
        
        // Hijri Date
        hijriDate: "21-11-1447",
        hijriDay: 21,
        hijriMonth: 11,
        hijriYear: 1447,
        hijriMonthName: "ذو القعدة",
        hijriWeekday: "الأحد",
        
        // Prayer Times
        fajr: "04:25",
        sunrise: "05:50",
        dhuhr: "12:20",
        asr: "15:45",
        maghrib: "18:50",
        isha: "20:20",
        
        // Meta
        timestamp: 1234567890,
        location: "Makkah",
        country: "Saudi Arabia"
      },
      // ... 30 more days
    ]
  }
```

---

## 🚀 كيفية الاستخدام

### 1️⃣ اختبار النظام

افتح صفحة الاختبار:
```
http://localhost:5000/test-prayer-times.html
```

أو في الـ Live Server:
```
http://127.0.0.1:5500/test-prayer-times.html
```

---

### 2️⃣ الوظائف المتاحة

#### أ) جلب وحفظ الشهر الحالي:
```javascript
await window.fetchAndStoreCurrentMonth();
// ✅ يجلب الشهر الحالي ويخزنه في Firestore
```

#### ب) التحقق من وجود بيانات:
```javascript
const exists = await window.checkPrayerTimesExist(2026, 5);
console.log(exists); // true أو false
```

#### ج) جلب أوقات صلاة يوم معين:
```javascript
const times = await window.getPrayerTimesForDate("2026-05-17");
console.log(times);
// {
//   fajr: "04:25",
//   dhuhr: "12:20",
//   ...
// }
```

#### د) عرض جميع الأشهر المخزنة:
```javascript
const months = await window.getAllStoredMonths();
console.log(months);
```

---

## 🎯 استخدام في الكود

### استيراد الوظائف:
```javascript
import { 
  fetchAndStoreCurrentMonth,
  getPrayerTimesForDate,
  checkPrayerTimesExist 
} from './js/prayer-times.js';
```

### مثال: عرض أوقات الصلاة اليوم
```javascript
const today = new Date().toISOString().split('T')[0]; // "2026-05-17"
const prayerTimes = await getPrayerTimesForDate(today);

if (prayerTimes) {
  console.log(`الفجر: ${prayerTimes.fajr}`);
  console.log(`الظهر: ${prayerTimes.dhuhr}`);
  console.log(`العصر: ${prayerTimes.asr}`);
  console.log(`المغرب: ${prayerTimes.maghrib}`);
  console.log(`العشاء: ${prayerTimes.isha}`);
} else {
  console.log('لا توجد بيانات. قم بجلبها أولاً');
  await fetchAndStoreCurrentMonth();
}
```

---

## 📊 مثال على النتائج

### جلب الشهر الحالي:
```json
{
  "success": true,
  "year": 2026,
  "month": 5,
  "totalDays": 31
}
```

### أوقات صلاة يوم معين:
```json
{
  "gregorianDate": "17-05-2026",
  "gregorianWeekday": "Sunday",
  "hijriDate": "21-11-1447",
  "hijriWeekday": "الأحد",
  "hijriMonthName": "ذو القعدة",
  "fajr": "04:25",
  "sunrise": "05:50",
  "dhuhr": "12:20",
  "asr": "15:45",
  "maghrib": "18:50",
  "isha": "20:20",
  "location": "Makkah",
  "country": "Saudi Arabia"
}
```

---

## 🔄 التحديث التلقائي

يمكنك إعداد تحديث تلقائي شهري:

```javascript
// في بداية كل شهر، تحقق وجلب البيانات
async function autoUpdatePrayerTimes() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  const exists = await checkPrayerTimesExist(year, month);
  
  if (!exists) {
    console.log('🔄 جلب بيانات الشهر الجديد...');
    await fetchAndStoreCurrentMonth();
    console.log('✅ تم التحديث بنجاح!');
  }
}

// تشغيل عند فتح الصفحة
autoUpdatePrayerTimes();
```

---

## 🎨 التكامل مع الواجهة

### عرض أوقات الصلاة في Dashboard:

```javascript
async function displayPrayerTimesWidget() {
  const today = new Date().toISOString().split('T')[0];
  const times = await getPrayerTimesForDate(today);
  
  if (!times) return;
  
  const widget = document.getElementById('prayer-times-widget');
  widget.innerHTML = `
    <div class="prayer-times">
      <h3>🕌 أوقات الصلاة - ${times.hijriDate}</h3>
      <div class="times-grid">
        <div>🌅 الفجر: ${times.fajr}</div>
        <div>☀️ الظهر: ${times.dhuhr}</div>
        <div>🌤️ العصر: ${times.asr}</div>
        <div>🌆 المغرب: ${times.maghrib}</div>
        <div>🌙 العشاء: ${times.isha}</div>
      </div>
    </div>
  `;
}
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: "No prayer times found"
**الحل:** تأكد من جلب البيانات أولاً:
```javascript
await fetchAndStoreCurrentMonth();
```

### المشكلة: CORS Error
**الحل:** استخدم Live Server أو localhost، لا تفتح الملف مباشرة من المجلد.

### المشكلة: Firebase Permission Denied
**الحل:** تأكد من قواعد Firestore:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /prayerTimes/{document=**} {
      allow read, write: if true; // أو حسب صلاحياتك
    }
  }
}
```

---

## 📝 ملاحظات مهمة

1. ✅ API مجاني بالكامل (لا يحتاج API Key)
2. ✅ البيانات دقيقة لمكة المكرمة
3. ✅ يتم تخزين شهر كامل (31 يوم) في وثيقة واحدة
4. ✅ التواريخ الهجرية محسوبة بدقة من API
5. ⚠️ يُفضل جلب البيانات مرة واحدة شهرياً (لتوفير الاستهلاك)

---

## 🔗 روابط مفيدة

- [Aladhan API Documentation](https://aladhan.com/prayer-times-api)
- [Prayer Times Methods](https://aladhan.com/calculation-methods)
- [Umm al-Qura Calendar](https://webspace.science.uu.nl/~gent0113/islam/ummalqura.htm)

---

## 📞 الدعم

للأسئلة أو المشاكل، راجع:
- صفحة الاختبار: `test-prayer-times.html`
- الكود المصدري: `js/prayer-times.js`
- Console في المتصفح للـ logs

---

**✨ جاهز للاستخدام! افتح صفحة الاختبار وجرب الآن! 🚀**

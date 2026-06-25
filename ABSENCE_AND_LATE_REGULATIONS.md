# نظام لوائح التأخير والغياب للطلاب

## نظرة عامة
هذا النظام يتتبع تأخيرات وغيابات الطلاب ويطبق عقوبات تدريجية حسب عدد المخالفات في الشهر الهجري الواحد.

---

## 📋 نظام لوائح التأخير (Late Regulations)

### المجموعة في Firestore
- **Collection:** `monthlyLateTracking`
- **Document ID:** `{studentId}_{YYYY-MM}`
- **مثال:** `STD123_1447-11`

### بنية البيانات
```javascript
{
  studentId: "STD123",
  studentName: "أحمد محمد",
  month: "1447-11",
  lateCount: 2,
  lateRecords: ["1447-11-05", "1447-11-12"],
  currentAction: {
    level: 2,
    title: "الوقوف خارج الحلقة",
    description: "التأخير الثاني: الوقوف من صلاة العصر إلى صلاة المغرب خارج الحلقة",
    color: "#ff9800",
    emoji: "🚫"
  },
  createdAt: Timestamp,
  lastUpdated: Timestamp
}
```

### العقوبات التدريجية

| التأخير | العقوبة | اللون | الرمز |
|---------|---------|-------|-------|
| الأول | تنبيه شفهي | `#ffc107` (أصفر) | ⚠️ |
| الثاني | الوقوف من العصر إلى المغرب خارج الحلقة | `#ff9800` (برتقالي) | 🚫 |
| الثالث | الوقوف من العصر إلى المغرب خارج الحلقة | `#ff9800` (برتقالي) | 🚫 |
| الرابع | استدعاء ولي الأمر وأخذ التعهد | `#dc3545` (أحمر) | 📋 |
| الخامس وما بعده | الفصل والحرمان من الحلقة | `#721c24` (أحمر غامق) | ❌ |

### الدوال المتاحة

#### 1. `incrementStudentLateCount(studentId, studentName)`
**الوظيفة:** زيادة عدد التأخيرات للطالب في الشهر الحالي
```javascript
const result = await incrementStudentLateCount('STD123', 'أحمد محمد');
// Returns: { lateCount: 2, currentAction: {...} }
```

#### 2. `determineActionForLateCount(lateCount)`
**الوظيفة:** تحديد العقوبة المناسبة بناءً على عدد التأخيرات
```javascript
const action = determineActionForLateCount(3);
// Returns: { level: 3, title: "...", description: "...", color: "...", emoji: "..." }
```

#### 3. `getStudentLateStatus(studentId, studentName)`
**الوظيفة:** الحصول على حالة التأخير الحالية للطالب
```javascript
const status = await getStudentLateStatus('STD123', 'أحمد محمد');
// Returns: { month: "1447-11", lateCount: 2, currentAction: {...}, lateRecords: [...] }
```

#### 4. `countStudentLateInCurrentMonth(studentId)`
**الوظيفة:** عد عدد التأخيرات من سجلات الحضور اليومية
```javascript
const count = await countStudentLateInCurrentMonth('STD123');
// Returns: 2
```

---

## 🚫 نظام لوائح الغياب بدون عذر (Absence Regulations)

### المجموعة في Firestore
- **Collection:** `monthlyAbsenceTracking`
- **Document ID:** `{studentId}_{YYYY-MM}`
- **مثال:** `STD123_1447-11`

### بنية البيانات
```javascript
{
  studentId: "STD123",
  studentName: "أحمد محمد",
  month: "1447-11",
  absenceCount: 2,
  absenceRecords: ["1447-11-08", "1447-11-15"],
  currentAction: {
    level: 2,
    title: "حرمان واستدعاء ولي الأمر",
    description: "الغياب الثاني بدون عذر: حرمان من دخول الحلقة واستدعاء ولي الأمر",
    color: "#dc3545",
    emoji: "📋"
  },
  createdAt: Timestamp,
  lastUpdated: Timestamp
}
```

### العقوبات التدريجية

| الغياب | العقوبة | اللون | الرمز |
|--------|---------|-------|-------|
| الأول | الوقوف خارج الحلقة إلى صلاة العشاء | `#ff9800` (برتقالي) | 🚫 |
| الثاني | حرمان من دخول الحلقة واستدعاء ولي الأمر | `#dc3545` (أحمر) | 📋 |
| الثالث وما بعده | استبعاد كامل من الحلقات (فصل) | `#721c24` (أحمر غامق) | ❌ |

### الدوال المتاحة

#### 1. `incrementStudentAbsenceCount(studentId, studentName)`
**الوظيفة:** زيادة عدد الغيابات بدون عذر للطالب في الشهر الحالي
```javascript
const result = await incrementStudentAbsenceCount('STD123', 'أحمد محمد');
// Returns: { absenceCount: 1, currentAction: {...} }
```

#### 2. `determineActionForAbsenceCount(absenceCount)`
**الوظيفة:** تحديد العقوبة المناسبة بناءً على عدد الغيابات
```javascript
const action = determineActionForAbsenceCount(2);
// Returns: { level: 2, title: "...", description: "...", color: "...", emoji: "..." }
```

#### 3. `getStudentAbsenceStatus(studentId, studentName)`
**الوظيفة:** الحصول على حالة الغياب الحالية للطالب
```javascript
const status = await getStudentAbsenceStatus('STD123', 'أحمد محمد');
// Returns: { month: "1447-11", absenceCount: 1, currentAction: {...}, absenceRecords: [...] }
```

#### 4. `countStudentAbsenceInCurrentMonth(studentId)`
**الوظيفة:** عد عدد الغيابات بدون عذر من سجلات الحضور اليومية
```javascript
const count = await countStudentAbsenceInCurrentMonth('STD123');
// Returns: 1
```

**ملاحظة:** هذه الدالة تبحث عن السجلات التي تحقق الشروط التالية:
```javascript
data.status === 'absent' && data.excuseType === 'withoutExcuse'
```

---

## 🔄 التصفير الشهري

### كيفية عمل النظام
- كل شهر هجري جديد، يبدأ العداد من الصفر تلقائياً
- يتم ذلك من خلال استخدام الشهر في `Document ID`
- مثال: `STD123_1447-11` للشهر الحادي عشر، و `STD123_1447-12` للشهر الثاني عشر

### السجلات التاريخية
- جميع السجلات السابقة **تبقى محفوظة** في Firestore
- يمكن استخدامها للتقارير الشهرية والسنوية
- كل document يحتوي على:
  - `lateRecords` أو `absenceRecords`: مصفوفة تحتوي على تواريخ المخالفات
  - `createdAt`: تاريخ أول مخالفة في الشهر
  - `lastUpdated`: تاريخ آخر تحديث

---

## 💡 أمثلة عملية

### مثال 1: تسجيل تأخير طالب
```javascript
// في التحضير اليومي عندما يتم تحديد الطالب كمتأخر
const studentId = 'STD123';
const studentName = 'أحمد محمد';

// زيادة عداد التأخير
const result = await window.incrementStudentLateCount(studentId, studentName);

console.log(`عدد التأخيرات: ${result.lateCount}`);
console.log(`العقوبة: ${result.currentAction.title}`);
console.log(`الوصف: ${result.currentAction.description}`);

// عرض رسالة للمستخدم
alert(`
${result.currentAction.emoji} ${result.currentAction.title}

${result.currentAction.description}

عدد التأخيرات في هذا الشهر: ${result.lateCount}
`);
```

### مثال 2: تسجيل غياب بدون عذر
```javascript
// عندما يتم تحديد الطالب كغائب بدون عذر
const studentId = 'STD123';
const studentName = 'أحمد محمد';

// زيادة عداد الغياب
const result = await window.incrementStudentAbsenceCount(studentId, studentName);

console.log(`عدد الغيابات: ${result.absenceCount}`);
console.log(`العقوبة: ${result.currentAction.title}`);

// عرض تحذير إذا كان الغياب الثالث (فصل)
if (result.absenceCount >= 3) {
  alert(`
⚠️ تحذير خطير!

${result.currentAction.description}

يرجى التواصل مع إدارة الحلقات فوراً.
  `);
}
```

### مثال 3: عرض حالة الطالب في Modal
```javascript
async function showStudentStatusModal(studentId, studentName) {
  // الحصول على حالة التأخير
  const lateStatus = await window.getStudentLateStatus(studentId, studentName);
  
  // الحصول على حالة الغياب
  const absenceStatus = await window.getStudentAbsenceStatus(studentId, studentName);
  
  const html = `
    <div style="padding: 20px;">
      <h3>${studentName}</h3>
      <p>الشهر الهجري: ${lateStatus.month}</p>
      
      <div style="margin-top: 15px;">
        <h4>⏰ التأخيرات</h4>
        <p>العدد: ${lateStatus.lateCount}</p>
        ${lateStatus.currentAction ? `
          <div style="background: ${lateStatus.currentAction.color}; color: white; padding: 10px; border-radius: 8px;">
            ${lateStatus.currentAction.emoji} ${lateStatus.currentAction.title}
            <br>
            <small>${lateStatus.currentAction.description}</small>
          </div>
        ` : '<p>لا توجد تأخيرات هذا الشهر ✅</p>'}
      </div>
      
      <div style="margin-top: 15px;">
        <h4>🚫 الغيابات بدون عذر</h4>
        <p>العدد: ${absenceStatus.absenceCount}</p>
        ${absenceStatus.currentAction ? `
          <div style="background: ${absenceStatus.currentAction.color}; color: white; padding: 10px; border-radius: 8px;">
            ${absenceStatus.currentAction.emoji} ${absenceStatus.currentAction.title}
            <br>
            <small>${absenceStatus.currentAction.description}</small>
          </div>
        ` : '<p>لا توجد غيابات بدون عذر هذا الشهر ✅</p>'}
      </div>
    </div>
  `;
  
  // Display modal...
}
```

### مثال 4: إنشاء تقرير شهري
```javascript
async function generateMonthlyViolationsReport(classId) {
  // الحصول على جميع طلاب الحلقة
  const studentsSnap = await getDocs(query(
    collection(db, 'users'),
    where('classId', '==', classId),
    where('role', '==', 'student')
  ));
  
  const report = [];
  
  for (const studentDoc of studentsSnap.docs) {
    const studentId = studentDoc.id;
    const studentName = studentDoc.data().name;
    
    // عد التأخيرات والغيابات
    const lateCount = await window.countStudentLateInCurrentMonth(studentId);
    const absenceCount = await window.countStudentAbsenceInCurrentMonth(studentId);
    
    if (lateCount > 0 || absenceCount > 0) {
      report.push({
        name: studentName,
        lateCount,
        absenceCount,
        lateAction: window.determineActionForLateCount(lateCount),
        absenceAction: window.determineActionForAbsenceCount(absenceCount)
      });
    }
  }
  
  return report;
}
```

---

## 🔍 التكامل مع النظام الحالي

### في التحضير اليومي (Daily Queue)
عند تسجيل حضور الطالب:
1. إذا كان الطالب متأخراً (`late: true`):
   ```javascript
   await window.incrementStudentLateCount(studentId, studentName);
   ```

2. إذا كان الطالب غائباً بدون عذر:
   ```javascript
   if (status === 'absent' && excuseType === 'withoutExcuse') {
     await window.incrementStudentAbsenceCount(studentId, studentName);
   }
   ```

### في بطاقة دخول الحلقة (Entry Card)
يمكن عرض حالة الطالب قبل السماح له بالدخول:
```javascript
const lateStatus = await window.getStudentLateStatus(studentId, studentName);
const absenceStatus = await window.getStudentAbsenceStatus(studentId, studentName);

// التحقق من الفصل
if (absenceStatus.absenceCount >= 3) {
  alert('⛔ هذا الطالب محروم من دخول الحلقة (مستبعد)');
  return false; // منع الدخول
}

// التحقق من الحرمان المؤقت
if (absenceStatus.absenceCount === 2) {
  alert('⚠️ هذا الطالب محروم من دخول الحلقة اليوم (يتطلب حضور ولي الأمر)');
  return false; // منع الدخول
}

// عرض تحذير للتأخير
if (lateStatus.lateCount >= 5) {
  alert('⛔ هذا الطالب محروم من الحلقة (فصل بسبب التأخيرات)');
  return false;
}
```

---

## 📊 استعلامات Firestore مفيدة

### الحصول على جميع الطلاب المخالفين في الشهر الحالي
```javascript
const currentMonth = window.getCurrentHijriMonth(); // "1447-11"

// التأخيرات
const lateQuery = query(
  collection(db, 'monthlyLateTracking'),
  where('month', '==', currentMonth)
);

// الغيابات
const absenceQuery = query(
  collection(db, 'monthlyAbsenceTracking'),
  where('month', '==', currentMonth)
);
```

### الحصول على الطلاب المهددين بالفصل
```javascript
// التأخيرات (4 أو أكثر)
const criticalLateQuery = query(
  collection(db, 'monthlyLateTracking'),
  where('month', '==', currentMonth),
  where('lateCount', '>=', 4)
);

// الغيابات (2 أو أكثر)
const criticalAbsenceQuery = query(
  collection(db, 'monthlyAbsenceTracking'),
  where('month', '==', currentMonth),
  where('absenceCount', '>=', 2)
);
```

---

## ⚙️ الملف المصدري
جميع الدوال موجودة في: `js/admin.js`

**الأسطر:**
- نظام التأخير: الأسطر 182-395
- نظام الغياب: الأسطر 397-600 (تقريباً)

---

## 📝 ملاحظات مهمة

1. **التصفير التلقائي:** النظام يستخدم الشهر الهجري في معرف الوثيقة، لذلك كل شهر جديد يبدأ بسجل جديد
2. **حفظ السجلات:** جميع السجلات القديمة محفوظة في Firestore للتقارير
3. **التكامل مع الحضور:** النظام يقرأ من `studentProgress/{studentId}/dailyReports/{date}`
4. **الدوال متاحة عالمياً:** جميع الدوال مضافة إلى `window` للاستخدام في أي مكان
5. **مرونة العقوبات:** يمكن تعديل العقوبات بسهولة من خلال تحديث دوال `determineActionFor...`

---

## 🚀 الخطوات القادمة (اقتراحات)

1. **عرض حالة الطالب في Dashboard المعلم**
2. **إرسال إشعارات لولي الأمر عند استدعائه**
3. **تقارير شهرية تلقائية للمخالفات**
4. **نظام استئناف للعقوبات**
5. **تكامل مع نظام النقاط والحوافز**

---

## 📞 الدعم
للأسئلة أو التعديلات على اللوائح، يرجى التواصل مع فريق التطوير.

**آخر تحديث:** 2026-06-25
**الإصدار:** 1.0.0

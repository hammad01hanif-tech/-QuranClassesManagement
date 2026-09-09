# 🎯 نظام المسارات والقوالب للتقييم - Assessment Tracks System

## 📋 نظرة عامة

نظام متقدم لإدارة تقييمات الطلاب بناءً على مستوياتهم ومساراتهم المختلفة. كل مستوى له مسارات خاصة، وكل مسار له نقاط تقييم وحقول مخصصة.

---

## 🏗️ البنية الأساسية

### 1️⃣ **مستويات الطلاب (Student Levels)**

```javascript
const STUDENT_LEVELS = {
  hifz: {
    id: 'hifz',
    name: 'طالب حفظ',
    icon: '📚',
    description: 'طالب يحفظ القرآن من الناس إلى البقرة (عكسي)'
  },
  dabt: {
    id: 'dabt',
    name: 'طالب ضبط',
    icon: '✨',
    description: 'طالب يضبط حفظه من البقرة إلى الناس (ترتيبي)'
  },
  noorani: {
    id: 'noorani',
    name: 'طالب القاعدة النورانية',
    icon: '🌟',
    description: 'طالب يدرس القاعدة النورانية'
  }
};
```

---

### 2️⃣ **المسارات حسب المستوى (Tracks by Level)**

#### 🌟 **مسارات طلاب القاعدة النورانية:**

```javascript
const NOORANI_TRACKS = {
  // المسار الأساسي
  main: {
    id: 'noorani_main',
    name: 'مسار القاعدة النورانية الأساسي',
    description: 'تعلم القاعدة النورانية من البداية',
    icon: '📖',
    
    // نقاط التقييم
    assessmentPoints: [
      {
        id: 'asrPrayer',
        name: 'صلاة العصر',
        icon: '🕌',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        required: true
      },
      {
        id: 'lesson',
        name: 'الدرس',
        icon: '📖',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        required: true,
        hasRange: true,
        rangeType: 'lesson' // رقم الدرس مثلاً
      },
      {
        id: 'reading',
        name: 'التلاوة في البيت',
        icon: '🏠',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        required: true
      },
      {
        id: 'behavior',
        name: 'السلوك',
        icon: '⭐',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        required: true
      }
    ],
    
    // طريقة حساب المجموع
    totalCalculation: 'sum', // sum = جمع كل النقاط
    maxTotal: 20
  }
};
```

#### 📚 **مسارات طلاب الحفظ:**

```javascript
const HIFZ_TRACKS = {
  // مسار الحفظ الجديد
  new_memorization: {
    id: 'hifz_new_memorization',
    name: 'مسار الحفظ الجديد',
    description: 'حفظ جديد من الناس إلى البقرة',
    icon: '📖',
    
    assessmentPoints: [
      {
        id: 'asrPrayer',
        name: 'صلاة العصر',
        icon: '🕌',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'lesson',
        name: 'الدرس الجديد',
        icon: '📖',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasRange: true,
        rangeType: 'verses' // من آية إلى آية
      },
      {
        id: 'lessonSide',
        name: 'جنب الدرس',
        icon: '📚',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasText: true // يمكن كتابة نص توضيحي
      },
      {
        id: 'reading',
        name: 'التلاوة في البيت',
        icon: '🏠',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'behavior',
        name: 'السلوك',
        icon: '⭐',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      }
    ],
    maxTotal: 25
  },
  
  // مسار المراجعة
  revision: {
    id: 'hifz_revision',
    name: 'مسار المراجعة',
    description: 'مراجعة المحفوظ السابق',
    icon: '🔄',
    
    assessmentPoints: [
      {
        id: 'revision',
        name: 'المراجعة',
        icon: '🔄',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasRange: true,
        rangeType: 'verses'
      },
      {
        id: 'reading',
        name: 'القراءة بالنظر',
        icon: '👁️',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'behavior',
        name: 'السلوك',
        icon: '⭐',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      }
    ],
    maxTotal: 15
  },
  
  // مسار كامل (درس + مراجعة)
  full_assessment: {
    id: 'hifz_full',
    name: 'مسار التقييم الكامل',
    description: 'درس جديد + مراجعة + جنب الدرس',
    icon: '📋',
    
    assessmentPoints: [
      {
        id: 'asrPrayer',
        name: 'صلاة العصر',
        icon: '🕌',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'lesson',
        name: 'الدرس',
        icon: '📖',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasRange: true,
        rangeType: 'verses'
      },
      {
        id: 'lessonSide',
        name: 'جنب الدرس',
        icon: '📚',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasText: true
      },
      {
        id: 'revision',
        name: 'المراجعة',
        icon: '🔄',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasRange: true,
        rangeType: 'verses'
      },
      {
        id: 'reading',
        name: 'القراءة بالنظر',
        icon: '👁️',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'behavior',
        name: 'السلوك',
        icon: '⭐',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      }
    ],
    maxTotal: 30
  }
};
```

#### ✨ **مسارات طلاب الضبط:**

```javascript
const DABT_TRACKS = {
  // مسار الضبط الأساسي
  main: {
    id: 'dabt_main',
    name: 'مسار الضبط الأساسي',
    description: 'ضبط المحفوظ من البقرة إلى الناس',
    icon: '✨',
    
    assessmentPoints: [
      {
        id: 'asrPrayer',
        name: 'صلاة العصر',
        icon: '🕌',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'dabt',
        name: 'الضبط',
        icon: '✨',
        type: 'score',
        min: 0,
        max: 5,
        default: 5,
        hasRange: true,
        rangeType: 'verses'
      },
      {
        id: 'mistakes',
        name: 'عدد الأخطاء',
        icon: '⚠️',
        type: 'number',
        min: 0,
        default: 0
      },
      {
        id: 'reading',
        name: 'التلاوة في البيت',
        icon: '🏠',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      },
      {
        id: 'behavior',
        name: 'السلوك',
        icon: '⭐',
        type: 'score',
        min: 0,
        max: 5,
        default: 5
      }
    ],
    maxTotal: 20
  }
};
```

---

## 🗄️ **البنية الجديدة في Firebase:**

### **1. إضافة حقل `tracks` للطلاب:**

```javascript
// users/{studentId}
{
  id: "ST001",
  name: "أحمد محمد",
  level: "noorani",  // hifz, dabt, noorani
  classId: "TCH001",
  
  // جديد: المسارات النشطة
  activeTracks: [
    {
      trackId: "noorani_main",
      enabled: true,
      priority: 1,  // الترتيب في العرض
      customSettings: {}
    }
  ],
  
  // جديد: المسار الافتراضي
  defaultTrack: "noorani_main"
}
```

### **2. التقييمات اليومية بالمسار:**

```javascript
// studentProgress/{studentId}/dailyReports/{dateId}
{
  studentId: "ST001",
  studentName: "أحمد محمد",
  date: "2026-09-01",
  hijriDate: "1448-03-01",
  
  // جديد: المسار المستخدم
  trackId: "noorani_main",
  trackName: "مسار القاعدة النورانية الأساسي",
  
  // الحضور
  status: "present", // present, absent-with-excuse, absent-without-excuse
  
  // النقاط بناءً على المسار
  assessmentData: {
    asrPrayer: {
      score: 5,
      maxScore: 5
    },
    lesson: {
      score: 4,
      maxScore: 5,
      lessonNumber: 5,  // رقم الدرس في القاعدة النورانية
      notes: "جيد"
    },
    reading: {
      score: 5,
      maxScore: 5
    },
    behavior: {
      score: 5,
      maxScore: 5
    }
  },
  
  // المجموع
  totalScore: 19,
  maxTotalScore: 20,
  percentage: 95,
  
  // التقييم السابق (للمقارنة)
  previousAssessment: {
    date: "2026-08-31",
    totalScore: 18,
    assessmentData: {...}
  },
  
  createdAt: Timestamp,
  createdBy: "TCH001"
}
```

### **3. تاريخ المسارات (Track History):**

```javascript
// studentTracks/{studentId}/history/{changeId}
{
  studentId: "ST001",
  changedAt: Timestamp,
  changedBy: "admin",
  action: "track_assigned", // track_assigned, track_removed, track_modified
  
  oldTrack: {
    trackId: "hifz_full",
    level: "hifz"
  },
  
  newTrack: {
    trackId: "dabt_main",
    level: "dabt"
  },
  
  reason: "الطالب انتقل من الحفظ إلى الضبط"
}
```

---

## 🎨 **واجهة المستخدم المقترحة:**

### **النموذج الجديد:**

```
┌────────────────────────────────────────┐
│  📝 تقييم يومي - الثلاثاء 1 محرم      │
├────────────────────────────────────────┤
│                                        │
│  👤 الطالب: [أحمد محمد ▾]            │
│  📊 المستوى: 🌟 القاعدة النورانية    │
│                                        │
│  🎯 المسار: [اختر المسار ▾]          │
│  ┌──────────────────────────────────┐ │
│  │ 📖 مسار القاعدة الأساسي         │ │
│  └──────────────────────────────────┘ │
│                                        │
├────────────────────────────────────────┤
│ [التقييم الحالي] [السابق] [الغياب]   │
├────────────────────────────────────────┤
│                                        │
│  📊 التقييم السابق (31 محرم):        │
│  ┌──────────────────────────────────┐ │
│  │ الدرس 4  |  الدرجة: 18/20       │ │
│  │ المجموع: 18  |  النسبة: 90%     │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ─────────────────────────────────    │
│                                        │
│  ✨ التقييم الحالي:                   │
│                                        │
│  ┌─────────────────────────────────┐  │
│  │ 🕌 صلاة العصر    [- 5 +]  5/5 │  │
│  ├─────────────────────────────────┤  │
│  │ 📖 الدرس         [- 5 +]  5/5 │  │
│  │    رقم الدرس: [5]              │  │
│  ├─────────────────────────────────┤  │
│  │ 🏠 التلاوة بالبيت [- 5 +]  5/5 │  │
│  ├─────────────────────────────────┤  │
│  │ ⭐ السلوك        [- 5 +]  5/5 │  │
│  └─────────────────────────────────┘  │
│                                        │
│  📊 المجموع التلقائي: 20 / 20        │
│  🎯 النسبة: 100% ⭐                   │
│                                        │
├────────────────────────────────────────┤
│    [💾 حفظ التقييم]    [❌ إلغاء]    │
└────────────────────────────────────────┘
```

---

## 📋 **قسم التقارير المقترح:**

```
┌─────────────────────────────────────────┐
│  📊 تقرير الإنجازات والمسارات          │
├─────────────────────────────────────────┤
│                                         │
│  الفلاتر:                               │
│  [الطالب ▾] [المسار ▾] [الشهر ▾] [🔍] │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🎯 إحصائيات سريعة:                    │
│  ┌──────┬──────┬──────┬──────┐         │
│  │📖 دروس│🔄 مراجع│📅 أيام│⭐ معدل│         │
│  │  25   │  120  │  18  │ 4.8 │         │
│  └──────┴──────┴──────┴──────┘         │
│                                         │
├─────────────────────────────────────────┤
│  📋 التقييمات التفصيلية:               │
│                                         │
│  ┌──────────┬──────────┬──────┬─────┐  │
│  │ التاريخ   │ المسار    │ المقرر│الدرجة│  │
│  ├──────────┼──────────┼──────┼─────┤  │
│  │ 1 محرم   │ القاعدة   │ درس 5 │19/20│  │
│  │ 2 محرم   │ القاعدة   │ درس 6 │18/20│  │
│  │ 3 محرم   │ القاعدة   │ درس 7 │20/20│  │
│  └──────────┴──────────┴──────┴─────┘  │
│                                         │
│  [📄 تصدير PDF] [📊 Excel]             │
└─────────────────────────────────────────┘
```

---

## 🔧 **خطوات التنفيذ:**

### **Phase 1: البنية التحتية** (3-4 أيام)
- [ ] إنشاء ملف `tracks-config.js` بجميع القوالب
- [ ] تحديث بنية `users` لإضافة `activeTracks`
- [ ] تحديث بنية `dailyReports` لاستخدام المسارات
- [ ] دوال مساعدة لجلب المسارات حسب المستوى

### **Phase 2: واجهة التقييم** (3-4 أيام)
- [ ] نموذج اختيار المسار ديناميكي
- [ ] عرض نقاط التقييم بناءً على المسار
- [ ] عرض التقييم السابق للمقارنة
- [ ] Tabs (الحالي/السابق/الغياب)

### **Phase 3: قسم التقارير** (2-3 أيام)
- [ ] Dashboard بالإحصائيات
- [ ] جدول التقييمات التفصيلي
- [ ] الفلترة المتقدمة
- [ ] تصدير PDF/Excel

### **Phase 4: التخصيص** (2-3 أيام)
- [ ] تفعيل المسار لمعلمين محددين
- [ ] تخصيص نقاط التقييم لكل معلم
- [ ] واجهة الإدارة لإدارة المسارات

---

## 💡 **المميزات الرئيسية:**

1. ✅ **مرونة كاملة** - كل مستوى له مساراته
2. ✅ **توسع سهل** - إضافة مسارات جديدة سهلة
3. ✅ **تخصيص** - كل معلم يمكن تخصيص مساراته
4. ✅ **تقارير دقيقة** - تقارير مفصلة بناءً على المسار
5. ✅ **متوافق مع النظام الحالي** - لا يؤثر على البيانات الحالية

---

## 🎯 **الخلاصة:**

هذا النظام يحل جميع المشاكل:
- ✅ طلاب القاعدة لهم نقاط تقييم مختلفة
- ✅ طلاب الحفظ لهم مسارات متعددة (درس، مراجعة، كامل)
- ✅ طلاب الضبط لهم نقاط تقييم خاصة بهم
- ✅ قابل للتوسع والتخصيص
- ✅ تقارير شاملة ومفصلة

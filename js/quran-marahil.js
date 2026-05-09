/**
 * نظام المراحل في تحفيظ القرآن الكريم
 * 
 * يحتوي على مسارين رئيسيين:
 * 1. مسار الحفظ من الناس إلى البقرة (عكسي)
 * 2. مسار الحفظ من البقرة إلى الناس (تسلسلي)
 * 
 * كل مسار يحتوي على 6 مراحل متدرجة (5، 10، 15، 20، 25، 30 جزء)
 */

// =====================================================
// المسار الأول: من الناس إلى البقرة (العكسي)
// =====================================================
const marahilNasToBaqarah = [
  {
    id: 'nas-to-baqarah-stage-1',
    stageNumber: 1,
    pathway: 'nas-to-baqarah',
    pathwayName: 'من الناس إلى البقرة',
    title: 'المرحلة الأولى',
    fromSurah: 'الناس',
    toSurah: 'الأحقاف',
    fromSurahNumber: 114,
    toSurahNumber: 46,
    juzCount: 5,
    description: 'من سورة الناس إلى سورة الأحقاف',
    juzRange: '30-26', // الأجزاء من 30 إلى 26
    color: '#4CAF50',
    icon: '📗'
  },
  {
    id: 'nas-to-baqarah-stage-2',
    stageNumber: 2,
    pathway: 'nas-to-baqarah',
    pathwayName: 'من الناس إلى البقرة',
    title: 'المرحلة الثانية',
    fromSurah: 'الناس',
    toSurah: 'العنكبوت',
    fromSurahNumber: 114,
    toSurahNumber: 29,
    juzCount: 10,
    description: 'من سورة الناس إلى سورة العنكبوت',
    juzRange: '30-21', // الأجزاء من 30 إلى 21
    color: '#2196F3',
    icon: '📘'
  },
  {
    id: 'nas-to-baqarah-stage-3',
    stageNumber: 3,
    pathway: 'nas-to-baqarah',
    pathwayName: 'من الناس إلى البقرة',
    title: 'المرحلة الثالثة',
    fromSurah: 'الناس',
    toSurah: 'الكهف',
    fromSurahNumber: 114,
    toSurahNumber: 18,
    juzCount: 15,
    description: 'من سورة الناس إلى سورة الكهف',
    juzRange: '30-16', // الأجزاء من 30 إلى 16
    color: '#FF9800',
    icon: '📙'
  },
  {
    id: 'nas-to-baqarah-stage-4',
    stageNumber: 4,
    pathway: 'nas-to-baqarah',
    pathwayName: 'من الناس إلى البقرة',
    title: 'المرحلة الرابعة',
    fromSurah: 'الناس',
    toSurah: 'التوبة',
    fromSurahNumber: 114,
    toSurahNumber: 9,
    juzCount: 20,
    description: 'من سورة الناس إلى سورة التوبة',
    juzRange: '30-11', // الأجزاء من 30 إلى 11
    color: '#9C27B0',
    icon: '📕'
  },
  {
    id: 'nas-to-baqarah-stage-5',
    stageNumber: 5,
    pathway: 'nas-to-baqarah',
    pathwayName: 'من الناس إلى البقرة',
    title: 'المرحلة الخامسة',
    fromSurah: 'الناس',
    toSurah: 'النساء',
    fromSurahNumber: 114,
    toSurahNumber: 4,
    juzCount: 25,
    description: 'من سورة الناس إلى سورة النساء',
    juzRange: '30-6', // الأجزاء من 30 إلى 6
    color: '#E91E63',
    icon: '📔'
  },
  {
    id: 'nas-to-baqarah-stage-6',
    stageNumber: 6,
    pathway: 'nas-to-baqarah',
    pathwayName: 'من الناس إلى البقرة',
    title: 'المرحلة السادسة',
    fromSurah: 'الناس',
    toSurah: 'البقرة',
    fromSurahNumber: 114,
    toSurahNumber: 2,
    juzCount: 30,
    description: 'من سورة الناس إلى سورة البقرة (القرآن كامل)',
    juzRange: '30-1', // الأجزاء من 30 إلى 1
    color: '#FFD700',
    icon: '🏆'
  }
];

// =====================================================
// المسار الثاني: من البقرة إلى الناس (التسلسلي)
// =====================================================
const marahilBaqarahToNas = [
  {
    id: 'baqarah-to-nas-stage-1',
    stageNumber: 1,
    pathway: 'baqarah-to-nas',
    pathwayName: 'من البقرة إلى الناس',
    title: 'المرحلة الأولى',
    fromSurah: 'البقرة',
    toSurah: 'النساء',
    fromSurahNumber: 2,
    toSurahNumber: 4,
    juzCount: 5,
    description: 'من سورة البقرة إلى سورة النساء',
    juzRange: '1-5', // الأجزاء من 1 إلى 5
    color: '#4CAF50',
    icon: '📗'
  },
  {
    id: 'baqarah-to-nas-stage-2',
    stageNumber: 2,
    pathway: 'baqarah-to-nas',
    pathwayName: 'من البقرة إلى الناس',
    title: 'المرحلة الثانية',
    fromSurah: 'البقرة',
    toSurah: 'التوبة',
    fromSurahNumber: 2,
    toSurahNumber: 9,
    juzCount: 10,
    description: 'من سورة البقرة إلى سورة التوبة',
    juzRange: '1-10', // الأجزاء من 1 إلى 10
    color: '#2196F3',
    icon: '📘'
  },
  {
    id: 'baqarah-to-nas-stage-3',
    stageNumber: 3,
    pathway: 'baqarah-to-nas',
    pathwayName: 'من البقرة إلى الناس',
    title: 'المرحلة الثالثة',
    fromSurah: 'البقرة',
    toSurah: 'الكهف',
    fromSurahNumber: 2,
    toSurahNumber: 18,
    juzCount: 15,
    description: 'من سورة البقرة إلى سورة الكهف',
    juzRange: '1-15', // الأجزاء من 1 إلى 15
    color: '#FF9800',
    icon: '📙'
  },
  {
    id: 'baqarah-to-nas-stage-4',
    stageNumber: 4,
    pathway: 'baqarah-to-nas',
    pathwayName: 'من البقرة إلى الناس',
    title: 'المرحلة الرابعة',
    fromSurah: 'البقرة',
    toSurah: 'العنكبوت',
    fromSurahNumber: 2,
    toSurahNumber: 29,
    juzCount: 20,
    description: 'من سورة البقرة إلى سورة العنكبوت',
    juzRange: '1-20', // الأجزاء من 1 إلى 20
    color: '#9C27B0',
    icon: '📕'
  },
  {
    id: 'baqarah-to-nas-stage-5',
    stageNumber: 5,
    pathway: 'baqarah-to-nas',
    pathwayName: 'من البقرة إلى الناس',
    title: 'المرحلة الخامسة',
    fromSurah: 'البقرة',
    toSurah: 'الأحقاف',
    fromSurahNumber: 2,
    toSurahNumber: 46,
    juzCount: 25,
    description: 'من سورة البقرة إلى سورة الأحقاف',
    juzRange: '1-25', // الأجزاء من 1 إلى 25
    color: '#E91E63',
    icon: '📔'
  },
  {
    id: 'baqarah-to-nas-stage-6',
    stageNumber: 6,
    pathway: 'baqarah-to-nas',
    pathwayName: 'من البقرة إلى الناس',
    title: 'المرحلة السادسة',
    fromSurah: 'البقرة',
    toSurah: 'الناس',
    fromSurahNumber: 2,
    toSurahNumber: 114,
    juzCount: 30,
    description: 'من سورة البقرة إلى سورة الناس (القرآن كامل)',
    juzRange: '1-30', // الأجزاء من 1 إلى 30
    color: '#FFD700',
    icon: '🏆'
  }
];

// =====================================================
// جميع المراحل (مجمعة)
// =====================================================
const allMarahil = [...marahilNasToBaqarah, ...marahilBaqarahToNas];

// =====================================================
// دوال مساعدة للاستعلام والتحقق
// =====================================================

/**
 * الحصول على جميع مراحل مسار معين
 * @param {string} pathway - 'nas-to-baqarah' أو 'baqarah-to-nas'
 * @returns {Array} - قائمة المراحل
 */
function getMarahilByPathway(pathway) {
  if (pathway === 'nas-to-baqarah') {
    return marahilNasToBaqarah;
  } else if (pathway === 'baqarah-to-nas') {
    return marahilBaqarahToNas;
  }
  return [];
}

/**
 * الحصول على مرحلة معينة بناءً على المسار ورقم المرحلة
 * @param {string} pathway - المسار
 * @param {number} stageNumber - رقم المرحلة (1-6)
 * @returns {Object|null} - بيانات المرحلة
 */
function getMarhalahByStageNumber(pathway, stageNumber) {
  const marahil = getMarahilByPathway(pathway);
  return marahil.find(m => m.stageNumber === stageNumber) || null;
}

/**
 * الحصول على مرحلة معينة بناءً على ID
 * @param {string} stageId - معرف المرحلة
 * @returns {Object|null} - بيانات المرحلة
 */
function getMarhalahById(stageId) {
  return allMarahil.find(m => m.id === stageId) || null;
}

/**
 * الحصول على المرحلة التالية
 * @param {string} pathway - المسار
 * @param {number} currentStageNumber - رقم المرحلة الحالية
 * @returns {Object|null} - المرحلة التالية أو null إذا كانت آخر مرحلة
 */
function getNextMarhalah(pathway, currentStageNumber) {
  if (currentStageNumber >= 6) {
    return null; // آخر مرحلة
  }
  return getMarhalahByStageNumber(pathway, currentStageNumber + 1);
}

/**
 * الحصول على المرحلة السابقة
 * @param {string} pathway - المسار
 * @param {number} currentStageNumber - رقم المرحلة الحالية
 * @returns {Object|null} - المرحلة السابقة أو null إذا كانت أول مرحلة
 */
function getPreviousMarhalah(pathway, currentStageNumber) {
  if (currentStageNumber <= 1) {
    return null; // أول مرحلة
  }
  return getMarhalahByStageNumber(pathway, currentStageNumber - 1);
}

/**
 * التحقق من إتمام القرآن كاملاً
 * @param {string} pathway - المسار
 * @param {number} stageNumber - رقم المرحلة
 * @returns {boolean} - true إذا كانت المرحلة السادسة (30 جزء)
 */
function isFullQuranCompleted(pathway, stageNumber) {
  return stageNumber === 6;
}

/**
 * حساب نسبة الإنجاز
 * @param {number} stageNumber - رقم المرحلة الحالية
 * @returns {number} - نسبة الإنجاز من 0 إلى 100
 */
function calculateProgressPercentage(stageNumber) {
  return Math.round((stageNumber / 6) * 100);
}

/**
 * الحصول على معلومات المسار
 * @param {string} pathway - المسار
 * @returns {Object} - معلومات المسار
 */
function getPathwayInfo(pathway) {
  if (pathway === 'nas-to-baqarah') {
    return {
      id: 'nas-to-baqarah',
      name: 'من الناس إلى البقرة',
      description: 'مسار الحفظ من نهاية القرآن إلى بدايته',
      direction: 'reverse',
      startSurah: 'الناس',
      endSurah: 'البقرة',
      icon: '⬅️'
    };
  } else if (pathway === 'baqarah-to-nas') {
    return {
      id: 'baqarah-to-nas',
      name: 'من البقرة إلى الناس',
      description: 'مسار الحفظ من بداية القرآن إلى نهايته',
      direction: 'sequential',
      startSurah: 'البقرة',
      endSurah: 'الناس',
      icon: '➡️'
    };
  }
  return null;
}

/**
 * تنسيق وصف المرحلة للعرض
 * @param {Object} marhalah - بيانات المرحلة
 * @returns {string} - وصف منسق
 */
function formatMarhalahDisplay(marhalah) {
  return `${marhalah.icon} ${marhalah.title} - ${marhalah.description} (${marhalah.juzCount} أجزاء)`;
}

/**
 * الحصول على جميع أرقام الأجزاء في مرحلة معينة
 * @param {Object} marhalah - بيانات المرحلة
 * @returns {Array} - قائمة أرقام الأجزاء
 */
function getJuzNumbersInMarhalah(marhalah) {
  const range = marhalah.juzRange.split('-').map(Number);
  const start = Math.min(...range);
  const end = Math.max(...range);
  const juzNumbers = [];
  
  for (let i = start; i <= end; i++) {
    juzNumbers.push(i);
  }
  
  // إذا كان المسار عكسي، نعكس الترتيب
  if (marhalah.pathway === 'nas-to-baqarah') {
    return juzNumbers.reverse();
  }
  
  return juzNumbers;
}

/**
 * التحقق من صحة رقم المرحلة
 * @param {number} stageNumber - رقم المرحلة
 * @returns {boolean} - true إذا كان الرقم صحيحاً (1-6)
 */
function isValidStageNumber(stageNumber) {
  return stageNumber >= 1 && stageNumber <= 6;
}

/**
 * الحصول على إجمالي عدد المراحل
 * @returns {number} - 6 مراحل
 */
function getTotalStages() {
  return 6;
}

/**
 * الحصول على قائمة المسارات المتاحة
 * @returns {Array} - قائمة المسارات
 */
function getAvailablePathways() {
  return [
    { id: 'nas-to-baqarah', name: 'من الناس إلى البقرة', icon: '⬅️' },
    { id: 'baqarah-to-nas', name: 'من البقرة إلى الناس', icon: '➡️' }
  ];
}

// =====================================================
// Export للاستخدام في الملفات الأخرى
// =====================================================
export {
  marahilNasToBaqarah,
  marahilBaqarahToNas,
  allMarahil,
  getMarahilByPathway,
  getMarhalahByStageNumber,
  getMarhalahById,
  getNextMarhalah,
  getPreviousMarhalah,
  isFullQuranCompleted,
  calculateProgressPercentage,
  getPathwayInfo,
  formatMarhalahDisplay,
  getJuzNumbersInMarhalah,
  isValidStageNumber,
  getTotalStages,
  getAvailablePathways
};

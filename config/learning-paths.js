// Learning path definitions and pure helpers for curriculum forms.
import { quranSurahs } from '../js/quran-data.js';

export const LEARNING_PATHS = Object.freeze({
  notebook: Object.freeze({
    id: 'notebook',
    name: 'الدفتر',
    lesson: Object.freeze({ type: 'notebook', label: 'الدرس الجديد', requiresPage: false }),
    revision: Object.freeze({ type: 'freeText', label: 'المراجعة' })
  }),
  noorani: Object.freeze({
    id: 'noorani',
    name: 'القاعدة النورانية',
    lesson: Object.freeze({ type: 'noorani', label: 'الدرس الجديد', requiresPage: true }),
    revision: Object.freeze({ type: 'freeText', label: 'المراجعة' })
  }),
  quran: Object.freeze({
    id: 'quran',
    name: 'القرآن الكريم',
    lesson: Object.freeze({ type: 'quranRange', label: 'الدرس الجديد' }),
    revision: Object.freeze({ type: 'quranRange', label: 'المراجعة' })
  })
});

export const LESSON_AMOUNT_OPTIONS = Object.freeze([
  { value: 'full_lesson', label: 'درس كامل' },
  { value: 'full_page', label: 'صفحة كاملة' },
  { value: 'upper_half', label: 'نصف الصفحة العلوية' },
  { value: 'lower_half', label: 'نصف الصفحة السفلية' },
  { value: 'lines', label: 'أسطر محددة' }
]);

export function getLearningPath(pathId) {
  return LEARNING_PATHS[pathId] || LEARNING_PATHS.noorani;
}

export function normalizeLearningPath(studentData = {}) {
  if (studentData.level === 'hifz' || studentData.level === 'dabt') {
    return null;
  }
  if (studentData.learningProgram && studentData.learningProgram !== 'noorani') {
    return null;
  }
  if (studentData.learningPath && LEARNING_PATHS[studentData.learningPath]) {
    return studentData.learningPath;
  }
  return studentData.level === 'noorani' ? 'noorani' : null;
}

export function getNooraniPath(studentData = {}) {
  return studentData.level === 'noorani' ? (normalizeLearningPath(studentData) || 'noorani') : null;
}

export function getSurah(surahNumber) {
  return quranSurahs.find(surah => Number(surah.number) === Number(surahNumber)) || null;
}

export function getVerseOptions(surahNumber) {
  const surah = getSurah(surahNumber);
  return surah ? Array.from({ length: surah.verses }, (_, index) => index + 1) : [];
}

export function isValidVerseRange(surahNumber, fromVerse, toVerse) {
  const surah = getSurah(surahNumber);
  const from = Number(fromVerse);
  const to = Number(toVerse);
  return Boolean(surah && Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from && to <= surah.verses);
}

export function createCurriculumData(pathId, lesson = {}, revision = {}) {
  const path = getLearningPath(pathId);
  const data = {
    pathId: path.id,
    pathName: path.name,
    lesson: { ...lesson },
    revision: { ...revision }
  };

  if (path.lesson.type === 'quranRange') {
    if (!isValidVerseRange(lesson.surahNumber, lesson.fromVerse, lesson.toVerse)) {
      throw new Error('نطاق آيات الدرس غير صحيح');
    }
    if (!isValidVerseRange(revision.surahNumber, revision.fromVerse, revision.toVerse)) {
      throw new Error('نطاق آيات المراجعة غير صحيح');
    }
    data.lesson.surahName = getSurah(lesson.surahNumber).name;
    data.revision.surahName = getSurah(revision.surahNumber).name;
  }

  return data;
}

// Juz (Parts) Data - First Surah and First Ayah for each Juz
// Used to detect when a student completes a Juz (reaches first ayah of first surah in reverse memorization)

export const juzData = [
  { number: 1, firstSurah: 'البقرة', firstSurahNumber: 2, firstAyah: 1 },
  { number: 2, firstSurah: 'البقرة', firstSurahNumber: 2, firstAyah: 142 },
  { number: 3, firstSurah: 'البقرة', firstSurahNumber: 2, firstAyah: 253 },
  { number: 4, firstSurah: 'آل عمران', firstSurahNumber: 3, firstAyah: 92 },
  { number: 5, firstSurah: 'النساء', firstSurahNumber: 4, firstAyah: 24 },
  { number: 6, firstSurah: 'النساء', firstSurahNumber: 4, firstAyah: 148 },
  { number: 7, firstSurah: 'المائدة', firstSurahNumber: 5, firstAyah: 82 },
  { number: 8, firstSurah: 'الأنعام', firstSurahNumber: 6, firstAyah: 111 },
  { number: 9, firstSurah: 'الأعراف', firstSurahNumber: 7, firstAyah: 88 },
  { number: 10, firstSurah: 'الأنفال', firstSurahNumber: 8, firstAyah: 41 },
  { number: 11, firstSurah: 'التوبة', firstSurahNumber: 9, firstAyah: 94 },
  { number: 12, firstSurah: 'هود', firstSurahNumber: 11, firstAyah: 6 },
  { number: 13, firstSurah: 'يوسف', firstSurahNumber: 12, firstAyah: 53 },
  { number: 14, firstSurah: 'الحجر', firstSurahNumber: 15, firstAyah: 22 },
  { number: 15, firstSurah: 'الإسراء', firstSurahNumber: 17, firstAyah: 1 },
  { number: 16, firstSurah: 'الكهف', firstSurahNumber: 18, firstAyah: 75 },
  { number: 17, firstSurah: 'الأنبياء', firstSurahNumber: 21, firstAyah: 1 },
  { number: 18, firstSurah: 'المؤمنون', firstSurahNumber: 23, firstAyah: 1 },
  { number: 19, firstSurah: 'الفرقان', firstSurahNumber: 25, firstAyah: 21 },
  { number: 20, firstSurah: 'النمل', firstSurahNumber: 27, firstAyah: 56 },
  { number: 21, firstSurah: 'العنكبوت', firstSurahNumber: 29, firstAyah: 46 },
  { number: 22, firstSurah: 'الأحزاب', firstSurahNumber: 33, firstAyah: 31 },
  { number: 23, firstSurah: 'يس', firstSurahNumber: 36, firstAyah: 28 },
  { number: 24, firstSurah: 'الزمر', firstSurahNumber: 39, firstAyah: 32 },
  { number: 25, firstSurah: 'فصلت', firstSurahNumber: 41, firstAyah: 47 },
  { number: 26, firstSurah: 'الأحقاف', firstSurahNumber: 46, firstAyah: 1 },
  { number: 27, firstSurah: 'الذاريات', firstSurahNumber: 51, firstAyah: 31 },
  { number: 28, firstSurah: 'المجادلة', firstSurahNumber: 58, firstAyah: 1 },
  { number: 29, firstSurah: 'الملك', firstSurahNumber: 67, firstAyah: 1 },
  { number: 30, firstSurah: 'النبأ', firstSurahNumber: 78, firstAyah: 1 }
];

// Juz Data for Sequential Memorization (Dabt) - Last Surah and Last Ayah for each Juz
// Used to detect when a student completes a Juz (reaches last ayah of last surah in forward memorization)
export const juzDataDabt = [
  { number: 1, lastSurah: 'البقرة', lastSurahNumber: 2, lastAyah: 141 },
  { number: 2, lastSurah: 'البقرة', lastSurahNumber: 2, lastAyah: 252 },
  { number: 3, lastSurah: 'آل عمران', lastSurahNumber: 3, lastAyah: 92 },
  { number: 4, lastSurah: 'النساء', lastSurahNumber: 4, lastAyah: 23 },
  { number: 5, lastSurah: 'النساء', lastSurahNumber: 4, lastAyah: 147 },
  { number: 6, lastSurah: 'المائدة', lastSurahNumber: 5, lastAyah: 81 },
  { number: 7, lastSurah: 'الأنعام', lastSurahNumber: 6, lastAyah: 110 },
  { number: 8, lastSurah: 'الأعراف', lastSurahNumber: 7, lastAyah: 87 },
  { number: 9, lastSurah: 'الأنفال', lastSurahNumber: 8, lastAyah: 40 },
  { number: 10, lastSurah: 'التوبة', lastSurahNumber: 9, lastAyah: 93 },
  { number: 11, lastSurah: 'هود', lastSurahNumber: 11, lastAyah: 5 },
  { number: 12, lastSurah: 'يوسف', lastSurahNumber: 12, lastAyah: 52 },
  { number: 13, lastSurah: 'إبراهيم', lastSurahNumber: 14, lastAyah: 52 },
  { number: 14, lastSurah: 'النحل', lastSurahNumber: 16, lastAyah: 128 },
  { number: 15, lastSurah: 'الكهف', lastSurahNumber: 18, lastAyah: 74 },
  { number: 16, lastSurah: 'طه', lastSurahNumber: 20, lastAyah: 135 },
  { number: 17, lastSurah: 'الحج', lastSurahNumber: 22, lastAyah: 78 },
  { number: 18, lastSurah: 'الفرقان', lastSurahNumber: 25, lastAyah: 20 },
  { number: 19, lastSurah: 'النمل', lastSurahNumber: 27, lastAyah: 55 },
  { number: 20, lastSurah: 'العنكبوت', lastSurahNumber: 29, lastAyah: 45 },
  { number: 21, lastSurah: 'الأحزاب', lastSurahNumber: 33, lastAyah: 30 },
  { number: 22, lastSurah: 'يس', lastSurahNumber: 36, lastAyah: 27 },
  { number: 23, lastSurah: 'الزمر', lastSurahNumber: 39, lastAyah: 31 },
  { number: 24, lastSurah: 'فصلت', lastSurahNumber: 41, lastAyah: 46 },
  { number: 25, lastSurah: 'الجاثية', lastSurahNumber: 45, lastAyah: 37 },
  { number: 26, lastSurah: 'الذاريات', lastSurahNumber: 51, lastAyah: 30 },
  { number: 27, lastSurah: 'الحديد', lastSurahNumber: 57, lastAyah: 29 },
  { number: 28, lastSurah: 'التحريم', lastSurahNumber: 66, lastAyah: 12 },
  { number: 29, lastSurah: 'المرسلات', lastSurahNumber: 77, lastAyah: 50 },
  { number: 30, lastSurah: 'الناس', lastSurahNumber: 114, lastAyah: 6 }
];

// Get Juz number from Surah and Ayah
export function getJuzFromSurahAyah(surahNumber, ayahNumber) {
  // Find which Juz this lesson belongs to
  for (let i = juzData.length - 1; i >= 0; i--) {
    const juz = juzData[i];
    if (surahNumber > juz.firstSurahNumber) {
      return juz.number;
    }
    if (surahNumber === juz.firstSurahNumber && ayahNumber >= juz.firstAyah) {
      return juz.number;
    }
  }
  return 1; // Default to Juz 1
}

// Check if this lesson is the last lesson in a Juz (first ayah of first surah)
export function isLastLessonInJuz(surahNumber, lessonStartAyah) {
  const juz = juzData.find(j => 
    j.firstSurahNumber === surahNumber && 
    j.firstAyah === lessonStartAyah
  );
  return juz ? juz.number : null;
}

// Get Juz details by number
export function getJuzDetails(juzNumber) {
  return juzData.find(j => j.number === juzNumber);
}

// ============================================
// DABT (Sequential) FUNCTIONS
// ============================================

// Check if this lesson is the last lesson in a Juz for Dabt (last ayah of last surah)
export function isLastLessonInJuzDabt(surahNumber, lessonEndAyah) {
  const juz = juzDataDabt.find(j => 
    j.lastSurahNumber === surahNumber && 
    j.lastAyah === lessonEndAyah
  );
  return juz ? juz.number : null;
}

// Get Juz details by number for Dabt
export function getJuzDetailsDabt(juzNumber) {
  return juzDataDabt.find(j => j.number === juzNumber);
}

// Get Juz number from Surah and Ayah for Dabt (forward direction)
export function getJuzFromSurahAyahDabt(surahNumber, ayahNumber) {
  // Find which Juz this lesson belongs to (forward direction)
  for (let i = 0; i < juzDataDabt.length; i++) {
    const juz = juzDataDabt[i];
    if (surahNumber < juz.lastSurahNumber) {
      return juz.number;
    }
    if (surahNumber === juz.lastSurahNumber && ayahNumber <= juz.lastAyah) {
      return juz.number;
    }
  }
  return 30; // Default to Juz 30 if beyond all ranges
}

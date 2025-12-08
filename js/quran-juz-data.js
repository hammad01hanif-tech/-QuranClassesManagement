// Quran Juz (Parts) Data with page information
// Each Juz has 20 pages (approximately)

export const quranJuzData = [
  { number: 1, name: "الفاتحة", startPage: 1, endPage: 21, pages: 21 },
  { number: 2, name: "سَيَقُولُ", startPage: 22, endPage: 41, pages: 20 },
  { number: 3, name: "تِلْكَ الرُّسُلُ", startPage: 42, endPage: 61, pages: 20 },
  { number: 4, name: "لَنْ تَنَالُوا", startPage: 62, endPage: 81, pages: 20 },
  { number: 5, name: "وَالْمُحْصَنَاتُ", startPage: 82, endPage: 101, pages: 20 },
  { number: 6, name: "لَا يُحِبُّ اللَّهُ", startPage: 102, endPage: 121, pages: 20 },
  { number: 7, name: "وَإِذَا سَمِعُوا", startPage: 122, endPage: 141, pages: 20 },
  { number: 8, name: "وَلَوْ أَنَّنَا", startPage: 142, endPage: 161, pages: 20 },
  { number: 9, name: "قَالَ الْمَلَأُ", startPage: 162, endPage: 181, pages: 20 },
  { number: 10, name: "وَاعْلَمُوا", startPage: 182, endPage: 201, pages: 20 },
  { number: 11, name: "يَعْتَذِرُونَ", startPage: 202, endPage: 221, pages: 20 },
  { number: 12, name: "وَمَا مِنْ دَابَّةٍ", startPage: 222, endPage: 241, pages: 20 },
  { number: 13, name: "وَمَا أُبَرِّئُ", startPage: 242, endPage: 261, pages: 20 },
  { number: 14, name: "رُبَمَا", startPage: 262, endPage: 281, pages: 20 },
  { number: 15, name: "سُبْحَانَ الَّذِي", startPage: 282, endPage: 301, pages: 20 },
  { number: 16, name: "قَالَ أَلَمْ", startPage: 302, endPage: 321, pages: 20 },
  { number: 17, name: "اقْتَرَبَ لِلنَّاسِ", startPage: 322, endPage: 341, pages: 20 },
  { number: 18, name: "قَدْ أَفْلَحَ", startPage: 342, endPage: 361, pages: 20 },
  { number: 19, name: "وَقَالَ الَّذِينَ", startPage: 362, endPage: 381, pages: 20 },
  { number: 20, name: "أَمَّنْ خَلَقَ", startPage: 382, endPage: 401, pages: 20 },
  { number: 21, name: "اتْلُ مَا أُوحِيَ", startPage: 402, endPage: 421, pages: 20 },
  { number: 22, name: "وَمَنْ يَقْنُتْ", startPage: 422, endPage: 441, pages: 20 },
  { number: 23, name: "وَمَالِيَ", startPage: 442, endPage: 461, pages: 20 },
  { number: 24, name: "فَمَنْ أَظْلَمُ", startPage: 462, endPage: 481, pages: 20 },
  { number: 25, name: "إِلَيْهِ يُرَدُّ", startPage: 482, endPage: 501, pages: 20 },
  { number: 26, name: "حم", startPage: 502, endPage: 521, pages: 20 },
  { number: 27, name: "قَالَ فَمَا خَطْبُكُمْ", startPage: 522, endPage: 541, pages: 20 },
  { number: 28, name: "قَدْ سَمِعَ", startPage: 542, endPage: 561, pages: 20 },
  { number: 29, name: "تَبَارَكَ الَّذِي", startPage: 562, endPage: 581, pages: 20 },
  { number: 30, name: "عَمَّ", startPage: 582, endPage: 604, pages: 23 }
];

// Helper function to get Juz by surah name
export function getJuzBySurahName(surahName) {
  // Extract surah name from format like "النبأ 1" or just "النبأ"
  const cleanSurahName = surahName.split(' ')[0].trim();
  
  // Map of surah names to juz with starting and ending pages
  const surahData = {
    "الفاتحة": { juz: 1, startPage: 1, endPage: 1 },
    "البقرة": { juz: 1, startPage: 2, endPage: 49 },
    "آل عمران": { juz: 3, startPage: 50, endPage: 76 },
    "النساء": { juz: 4, startPage: 77, endPage: 106 },
    "المائدة": { juz: 6, startPage: 106, endPage: 127 },
    "الأنعام": { juz: 7, startPage: 128, endPage: 150 },
    "الأعراف": { juz: 8, startPage: 151, endPage: 176 },
    "الأنفال": { juz: 9, startPage: 177, endPage: 186 },
    "التوبة": { juz: 10, startPage: 187, endPage: 207 },
    "يونس": { juz: 11, startPage: 208, endPage: 220 },
    "هود": { juz: 11, startPage: 221, endPage: 234 },
    "يوسف": { juz: 12, startPage: 235, endPage: 248 },
    "الرعد": { juz: 13, startPage: 249, endPage: 254 },
    "إبراهيم": { juz: 13, startPage: 255, endPage: 261 },
    "الحجر": { juz: 14, startPage: 262, endPage: 266 },
    "النحل": { juz: 14, startPage: 267, endPage: 281 },
    "الإسراء": { juz: 15, startPage: 282, endPage: 292 },
    "الكهف": { juz: 15, startPage: 293, endPage: 304 },
    "مريم": { juz: 16, startPage: 305, endPage: 311 },
    "طه": { juz: 16, startPage: 312, endPage: 321 },
    "الأنبياء": { juz: 17, startPage: 322, endPage: 331 },
    "الحج": { juz: 17, startPage: 332, endPage: 341 },
    "المؤمنون": { juz: 18, startPage: 342, endPage: 349 },
    "النور": { juz: 18, startPage: 350, endPage: 358 },
    "الفرقان": { juz: 18, startPage: 359, endPage: 366 },
    "الشعراء": { juz: 19, startPage: 367, endPage: 376 },
    "النمل": { juz: 19, startPage: 377, endPage: 384 },
    "القصص": { juz: 20, startPage: 385, endPage: 395 },
    "العنكبوت": { juz: 20, startPage: 396, endPage: 403 },
    "الروم": { juz: 21, startPage: 404, endPage: 410 },
    "لقمان": { juz: 21, startPage: 411, endPage: 414 },
    "السجدة": { juz: 21, startPage: 415, endPage: 417 },
    "الأحزاب": { juz: 21, startPage: 418, endPage: 427 },
    "سبأ": { juz: 22, startPage: 428, endPage: 433 },
    "فاطر": { juz: 22, startPage: 434, endPage: 439 },
    "يس": { juz: 22, startPage: 440, endPage: 445 },
    "الصافات": { juz: 23, startPage: 446, endPage: 452 },
    "ص": { juz: 23, startPage: 453, endPage: 457 },
    "الزمر": { juz: 23, startPage: 458, endPage: 466 },
    "غافر": { juz: 24, startPage: 467, endPage: 476 },
    "فصلت": { juz: 24, startPage: 477, endPage: 482 },
    "الشورى": { juz: 25, startPage: 483, endPage: 488 },
    "الزخرف": { juz: 25, startPage: 489, endPage: 495 },
    "الدخان": { juz: 25, startPage: 496, endPage: 498 },
    "الجاثية": { juz: 25, startPage: 499, endPage: 501 },
    "الأحقاف": { juz: 26, startPage: 502, endPage: 506 },
    "محمد": { juz: 26, startPage: 507, endPage: 510 },
    "الفتح": { juz: 26, startPage: 511, endPage: 514 },
    "الحجرات": { juz: 26, startPage: 515, endPage: 517 },
    "ق": { juz: 26, startPage: 518, endPage: 519 },
    "الذاريات": { juz: 27, startPage: 520, endPage: 522 },
    "الطور": { juz: 27, startPage: 523, endPage: 525 },
    "النجم": { juz: 27, startPage: 526, endPage: 527 },
    "القمر": { juz: 27, startPage: 528, endPage: 530 },
    "الرحمن": { juz: 27, startPage: 531, endPage: 533 },
    "الواقعة": { juz: 27, startPage: 534, endPage: 536 },
    "الحديد": { juz: 27, startPage: 537, endPage: 541 },
    "المجادلة": { juz: 28, startPage: 542, endPage: 544 },
    "الحشر": { juz: 28, startPage: 545, endPage: 548 },
    "الممتحنة": { juz: 28, startPage: 549, endPage: 550 },
    "الصف": { juz: 28, startPage: 551, endPage: 552 },
    "الجمعة": { juz: 28, startPage: 553, endPage: 553 },
    "المنافقون": { juz: 28, startPage: 554, endPage: 555 },
    "التغابن": { juz: 28, startPage: 556, endPage: 557 },
    "الطلاق": { juz: 28, startPage: 558, endPage: 559 },
    "التحريم": { juz: 28, startPage: 560, endPage: 561 },
    "الملك": { juz: 29, startPage: 562, endPage: 563 },
    "القلم": { juz: 29, startPage: 564, endPage: 565 },
    "الحاقة": { juz: 29, startPage: 566, endPage: 567 },
    "المعارج": { juz: 29, startPage: 568, endPage: 569 },
    "نوح": { juz: 29, startPage: 570, endPage: 571 },
    "الجن": { juz: 29, startPage: 572, endPage: 573 },
    "المزمل": { juz: 29, startPage: 574, endPage: 574 },
    "المدثر": { juz: 29, startPage: 575, endPage: 576 },
    "القيامة": { juz: 29, startPage: 577, endPage: 577 },
    "الإنسان": { juz: 29, startPage: 578, endPage: 579 },
    "المرسلات": { juz: 29, startPage: 580, endPage: 581 },
    "النبأ": { juz: 30, startPage: 582, endPage: 582 },
    "النازعات": { juz: 30, startPage: 583, endPage: 584 },
    "عبس": { juz: 30, startPage: 585, endPage: 585 },
    "التكوير": { juz: 30, startPage: 586, endPage: 586 },
    "الانفطار": { juz: 30, startPage: 587, endPage: 587 },
    "المطففين": { juz: 30, startPage: 587, endPage: 588 },
    "الانشقاق": { juz: 30, startPage: 589, endPage: 589 },
    "البروج": { juz: 30, startPage: 590, endPage: 590 },
    "الطارق": { juz: 30, startPage: 591, endPage: 591 },
    "الأعلى": { juz: 30, startPage: 591, endPage: 592 },
    "الغاشية": { juz: 30, startPage: 592, endPage: 592 },
    "الفجر": { juz: 30, startPage: 593, endPage: 593 },
    "البلد": { juz: 30, startPage: 594, endPage: 594 },
    "الشمس": { juz: 30, startPage: 595, endPage: 595 },
    "الليل": { juz: 30, startPage: 595, endPage: 596 },
    "الضحى": { juz: 30, startPage: 596, endPage: 596 },
    "الشرح": { juz: 30, startPage: 596, endPage: 596 },
    "التين": { juz: 30, startPage: 597, endPage: 597 },
    "العلق": { juz: 30, startPage: 597, endPage: 597 },
    "القدر": { juz: 30, startPage: 598, endPage: 598 },
    "البينة": { juz: 30, startPage: 598, endPage: 599 },
    "الزلزلة": { juz: 30, startPage: 599, endPage: 599 },
    "العاديات": { juz: 30, startPage: 599, endPage: 600 },
    "القارعة": { juz: 30, startPage: 600, endPage: 600 },
    "التكاثر": { juz: 30, startPage: 600, endPage: 600 },
    "العصر": { juz: 30, startPage: 601, endPage: 601 },
    "الهمزة": { juz: 30, startPage: 601, endPage: 601 },
    "الفيل": { juz: 30, startPage: 601, endPage: 601 },
    "قريش": { juz: 30, startPage: 602, endPage: 602 },
    "الماعون": { juz: 30, startPage: 602, endPage: 602 },
    "الكوثر": { juz: 30, startPage: 602, endPage: 602 },
    "الكافرون": { juz: 30, startPage: 603, endPage: 603 },
    "النصر": { juz: 30, startPage: 603, endPage: 603 },
    "المسد": { juz: 30, startPage: 603, endPage: 603 },
    "الإخلاص": { juz: 30, startPage: 604, endPage: 604 },
    "الفلق": { juz: 30, startPage: 604, endPage: 604 },
    "الناس": { juz: 30, startPage: 604, endPage: 604 }
  };
  
  return surahData[cleanSurahName] || null;
}

// Helper function to calculate pages between two surahs
export function calculateRevisionPages(fromSurah, toSurah) {
  const fromData = getJuzBySurahName(fromSurah);
  const toData = getJuzBySurahName(toSurah);
  
  if (!fromData || !toData) {
    console.log('Could not find surah data for:', fromSurah, 'or', toSurah);
    return 0;
  }
  
  // Extract surah names (without verse numbers)
  const fromSurahName = fromSurah.split(' ')[0].trim();
  const toSurahName = toSurah.split(' ')[0].trim();
  
  let pages = 0;
  
  // If same surah (e.g., "النساء 1" to "النساء 176")
  if (fromSurahName === toSurahName) {
    // Use endPage - startPage + 1 for complete surah
    pages = fromData.endPage - fromData.startPage + 1;
  } else {
    // Different surahs: calculate from start of first to end of second
    pages = Math.abs(toData.endPage - fromData.startPage) + 1;
  }
  
  console.log(`Revision from ${fromSurah} (page ${fromData.startPage}) to ${toSurah} (page ${toData.endPage}) = ${pages} pages`);
  
  return pages;
}

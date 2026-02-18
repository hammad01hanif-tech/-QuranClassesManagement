// Accurate Hijri Calendar Data
// Based on official Saudi Umm Al-Qura calendar
//
// Current Coverage: 5 months (118 days total)
// - Jumada Al-Akhir 1447: 29 days (2025-11-22 to 2025-12-20)
// - Rajab 1447: 30 days (2025-12-21 to 2026-01-19)
// - Sha'ban 1447: 29 days (2026-01-20 to 2026-02-17)
// - Ramadan 1447: 30 days (2026-02-18 to 2026-03-19)
//
// STUDY DAYS SYSTEM (أيام الدراسة):
// This system automatically recognizes study days for ALL months (current and future)
// Study Days: Sunday (0) to Thursday (4) - أحد إلى خميس ✅
// Weekend: Friday (5) and Saturday (6) - جمعة وسبت ❌
//
// All filtering functions use JavaScript's Date.getDay() which returns:
// 0 = Sunday (الأحد), 1 = Monday (الإثنين), 2 = Tuesday (الثلاثاء),
// 3 = Wednesday (الأربعاء), 4 = Thursday (الخميس),
// 5 = Friday (الجمعة), 6 = Saturday (السبت)
//
// The system will continue to work correctly for any future months you add,
// as long as you provide accurate Gregorian dates for each Hijri date.

export const accurateHijriDates = [
  {
    "gregorian": "2025-11-22",
    "hijri": "1447-06-01",
    "hijriDay": 1,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2025-11-23",
    "hijri": "1447-06-02",
    "hijriDay": 2,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2025-11-24",
    "hijri": "1447-06-03",
    "hijriDay": 3,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2025-11-25",
    "hijri": "1447-06-04",
    "hijriDay": 4,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2025-11-26",
    "hijri": "1447-06-05",
    "hijriDay": 5,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2025-11-27",
    "hijri": "1447-06-06",
    "hijriDay": 6,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2025-11-28",
    "hijri": "1447-06-07",
    "hijriDay": 7,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2025-11-29",
    "hijri": "1447-06-08",
    "hijriDay": 8,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2025-11-30",
    "hijri": "1447-06-09",
    "hijriDay": 9,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2025-12-01",
    "hijri": "1447-06-10",
    "hijriDay": 10,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2025-12-02",
    "hijri": "1447-06-11",
    "hijriDay": 11,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2025-12-03",
    "hijri": "1447-06-12",
    "hijriDay": 12,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2025-12-04",
    "hijri": "1447-06-13",
    "hijriDay": 13,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2025-12-05",
    "hijri": "1447-06-14",
    "hijriDay": 14,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2025-12-06",
    "hijri": "1447-06-15",
    "hijriDay": 15,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2025-12-07",
    "hijri": "1447-06-16",
    "hijriDay": 16,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2025-12-08",
    "hijri": "1447-06-17",
    "hijriDay": 17,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2025-12-09",
    "hijri": "1447-06-18",
    "hijriDay": 18,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2025-12-10",
    "hijri": "1447-06-19",
    "hijriDay": 19,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2025-12-11",
    "hijri": "1447-06-20",
    "hijriDay": 20,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2025-12-12",
    "hijri": "1447-06-21",
    "hijriDay": 21,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2025-12-13",
    "hijri": "1447-06-22",
    "hijriDay": 22,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2025-12-14",
    "hijri": "1447-06-23",
    "hijriDay": 23,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2025-12-15",
    "hijri": "1447-06-24",
    "hijriDay": 24,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2025-12-16",
    "hijri": "1447-06-25",
    "hijriDay": 25,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2025-12-17",
    "hijri": "1447-06-26",
    "hijriDay": 26,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2025-12-18",
    "hijri": "1447-06-27",
    "hijriDay": 27,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2025-12-19",
    "hijri": "1447-06-28",
    "hijriDay": 28,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2025-12-20",
    "hijri": "1447-06-29",
    "hijriDay": 29,
    "hijriMonth": 6,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  // شهر رجب 1447 هـ (30 يوم)
  {
    "gregorian": "2025-12-21",
    "hijri": "1447-07-01",
    "hijriDay": 1,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2025-12-22",
    "hijri": "1447-07-02",
    "hijriDay": 2,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2025-12-23",
    "hijri": "1447-07-03",
    "hijriDay": 3,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2025-12-24",
    "hijri": "1447-07-04",
    "hijriDay": 4,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2025-12-25",
    "hijri": "1447-07-05",
    "hijriDay": 5,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2025-12-26",
    "hijri": "1447-07-06",
    "hijriDay": 6,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2025-12-27",
    "hijri": "1447-07-07",
    "hijriDay": 7,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2025-12-28",
    "hijri": "1447-07-08",
    "hijriDay": 8,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2025-12-29",
    "hijri": "1447-07-09",
    "hijriDay": 9,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2025-12-30",
    "hijri": "1447-07-10",
    "hijriDay": 10,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2025-12-31",
    "hijri": "1447-07-11",
    "hijriDay": 11,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-01-01",
    "hijri": "1447-07-12",
    "hijriDay": 12,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-01-02",
    "hijri": "1447-07-13",
    "hijriDay": 13,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-01-03",
    "hijri": "1447-07-14",
    "hijriDay": 14,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-01-04",
    "hijri": "1447-07-15",
    "hijriDay": 15,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-01-05",
    "hijri": "1447-07-16",
    "hijriDay": 16,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-01-06",
    "hijri": "1447-07-17",
    "hijriDay": 17,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-01-07",
    "hijri": "1447-07-18",
    "hijriDay": 18,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-01-08",
    "hijri": "1447-07-19",
    "hijriDay": 19,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-01-09",
    "hijri": "1447-07-20",
    "hijriDay": 20,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-01-10",
    "hijri": "1447-07-21",
    "hijriDay": 21,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-01-11",
    "hijri": "1447-07-22",
    "hijriDay": 22,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-01-12",
    "hijri": "1447-07-23",
    "hijriDay": 23,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-01-13",
    "hijri": "1447-07-24",
    "hijriDay": 24,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-01-14",
    "hijri": "1447-07-25",
    "hijriDay": 25,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-01-15",
    "hijri": "1447-07-26",
    "hijriDay": 26,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-01-16",
    "hijri": "1447-07-27",
    "hijriDay": 27,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-01-17",
    "hijri": "1447-07-28",
    "hijriDay": 28,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-01-18",
    "hijri": "1447-07-29",
    "hijriDay": 29,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-01-19",
    "hijri": "1447-07-30",
    "hijriDay": 30,
    "hijriMonth": 7,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  // شعبان 1447 - Sha'ban 1447 (29 days)
  {
    "gregorian": "2026-01-20",
    "hijri": "1447-08-01",
    "hijriDay": 1,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-01-21",
    "hijri": "1447-08-02",
    "hijriDay": 2,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-01-22",
    "hijri": "1447-08-03",
    "hijriDay": 3,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-01-23",
    "hijri": "1447-08-04",
    "hijriDay": 4,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-01-24",
    "hijri": "1447-08-05",
    "hijriDay": 5,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-01-25",
    "hijri": "1447-08-06",
    "hijriDay": 6,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-01-26",
    "hijri": "1447-08-07",
    "hijriDay": 7,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-01-27",
    "hijri": "1447-08-08",
    "hijriDay": 8,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-01-28",
    "hijri": "1447-08-09",
    "hijriDay": 9,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-01-29",
    "hijri": "1447-08-10",
    "hijriDay": 10,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-01-30",
    "hijri": "1447-08-11",
    "hijriDay": 11,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-01-31",
    "hijri": "1447-08-12",
    "hijriDay": 12,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-02-01",
    "hijri": "1447-08-13",
    "hijriDay": 13,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-02-02",
    "hijri": "1447-08-14",
    "hijriDay": 14,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-02-03",
    "hijri": "1447-08-15",
    "hijriDay": 15,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-02-04",
    "hijri": "1447-08-16",
    "hijriDay": 16,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-02-05",
    "hijri": "1447-08-17",
    "hijriDay": 17,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-02-06",
    "hijri": "1447-08-18",
    "hijriDay": 18,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-02-07",
    "hijri": "1447-08-19",
    "hijriDay": 19,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-02-08",
    "hijri": "1447-08-20",
    "hijriDay": 20,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-02-09",
    "hijri": "1447-08-21",
    "hijriDay": 21,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-02-10",
    "hijri": "1447-08-22",
    "hijriDay": 22,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-02-11",
    "hijri": "1447-08-23",
    "hijriDay": 23,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-02-12",
    "hijri": "1447-08-24",
    "hijriDay": 24,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-02-13",
    "hijri": "1447-08-25",
    "hijriDay": 25,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-02-14",
    "hijri": "1447-08-26",
    "hijriDay": 26,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-02-15",
    "hijri": "1447-08-27",
    "hijriDay": 27,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-02-16",
    "hijri": "1447-08-28",
    "hijriDay": 28,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-02-17",
    "hijri": "1447-08-29",
    "hijriDay": 29,
    "hijriMonth": 8,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-02-18",
    "hijri": "1447-09-01",
    "hijriDay": 1,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-02-19",
    "hijri": "1447-09-02",
    "hijriDay": 2,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-02-20",
    "hijri": "1447-09-03",
    "hijriDay": 3,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-02-21",
    "hijri": "1447-09-04",
    "hijriDay": 4,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-02-22",
    "hijri": "1447-09-05",
    "hijriDay": 5,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-02-23",
    "hijri": "1447-09-06",
    "hijriDay": 6,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-02-24",
    "hijri": "1447-09-07",
    "hijriDay": 7,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-02-25",
    "hijri": "1447-09-08",
    "hijriDay": 8,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-02-26",
    "hijri": "1447-09-09",
    "hijriDay": 9,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-02-27",
    "hijri": "1447-09-10",
    "hijriDay": 10,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-02-28",
    "hijri": "1447-09-11",
    "hijriDay": 11,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-03-01",
    "hijri": "1447-09-12",
    "hijriDay": 12,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-03-02",
    "hijri": "1447-09-13",
    "hijriDay": 13,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-03-03",
    "hijri": "1447-09-14",
    "hijriDay": 14,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-03-04",
    "hijri": "1447-09-15",
    "hijriDay": 15,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-03-05",
    "hijri": "1447-09-16",
    "hijriDay": 16,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-03-06",
    "hijri": "1447-09-17",
    "hijriDay": 17,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-03-07",
    "hijri": "1447-09-18",
    "hijriDay": 18,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-03-08",
    "hijri": "1447-09-19",
    "hijriDay": 19,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-03-09",
    "hijri": "1447-09-20",
    "hijriDay": 20,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-03-10",
    "hijri": "1447-09-21",
    "hijriDay": 21,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-03-11",
    "hijri": "1447-09-22",
    "hijriDay": 22,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-03-12",
    "hijri": "1447-09-23",
    "hijriDay": 23,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الخميس"
  },
  {
    "gregorian": "2026-03-13",
    "hijri": "1447-09-24",
    "hijriDay": 24,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الجمعة"
  },
  {
    "gregorian": "2026-03-14",
    "hijri": "1447-09-25",
    "hijriDay": 25,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "السبت"
  },
  {
    "gregorian": "2026-03-15",
    "hijri": "1447-09-26",
    "hijriDay": 26,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأحد"
  },
  {
    "gregorian": "2026-03-16",
    "hijri": "1447-09-27",
    "hijriDay": 27,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الإثنين"
  },
  {
    "gregorian": "2026-03-17",
    "hijri": "1447-09-28",
    "hijriDay": 28,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الثلاثاء"
  },
  {
    "gregorian": "2026-03-18",
    "hijri": "1447-09-29",
    "hijriDay": 29,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الأربعاء"
  },
  {
    "gregorian": "2026-03-19",
    "hijri": "1447-09-30",
    "hijriDay": 30,
    "hijriMonth": 9,
    "hijriYear": 1447,
    "dayName": "الخميس"
  }
];

// Create lookup maps for fast conversion
const gregorianToHijriMap = new Map();
const hijriToGregorianMap = new Map();

accurateHijriDates.forEach(entry => {
  gregorianToHijriMap.set(entry.gregorian, entry);
  hijriToGregorianMap.set(entry.hijri, entry);
});

/**
 * Convert Gregorian date to accurate Hijri date
 * @param {Date|string} gregorianDate - Date object or YYYY-MM-DD string
 * @returns {Object} Hijri date object with all details
 */
export function gregorianToAccurateHijri(gregorianDate) {
  let dateStr;
  
  if (gregorianDate instanceof Date) {
    const year = gregorianDate.getFullYear();
    const month = String(gregorianDate.getMonth() + 1).padStart(2, '0');
    const day = String(gregorianDate.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  } else {
    dateStr = gregorianDate;
  }
  
  const hijriData = gregorianToHijriMap.get(dateStr);
  
  if (hijriData) {
    return hijriData;
  }
  
  // Fallback: Use Intl if date not in our data
  console.warn(`Date ${dateStr} not found in accurate Hijri calendar, using fallback`);
  const date = typeof gregorianDate === 'string' ? new Date(gregorianDate + 'T12:00:00') : gregorianDate;
  
  const formatter = new Intl.DateTimeFormat('en-SA-u-ca-islamic', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Riyadh'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return {
    gregorian: dateStr,
    hijri: `${year}-${month}-${day}`,
    hijriDay: parseInt(day),
    hijriMonth: parseInt(month),
    hijriYear: parseInt(year),
    dayName: new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(date)
  };
}

/**
 * Convert Hijri date to accurate Gregorian date
 * @param {string} hijriDate - Hijri date string (YYYY-MM-DD)
 * @returns {Object} Gregorian date object
 */
export function accurateHijriToGregorian(hijriDate) {
  const hijriData = hijriToGregorianMap.get(hijriDate);
  
  if (hijriData) {
    return new Date(hijriData.gregorian + 'T12:00:00');
  }
  
  console.warn(`Hijri date ${hijriDate} not found in accurate calendar`);
  return new Date();
}

/**
 * Get today's accurate Hijri date
 * @returns {Object} Today's Hijri date object
 */
export function getTodayAccurateHijri() {
  const today = new Date();
  return gregorianToAccurateHijri(today);
}

/**
 * Get accurate Hijri date for storage (YYYY-MM-DD format)
 * @param {Date} date - Optional date, defaults to today
 * @returns {string} Hijri date string
 */
export function getAccurateHijriForStorage(date = new Date()) {
  const hijriData = gregorianToAccurateHijri(date);
  return hijriData.hijri;
}

/**
 * Check if a given date is a study day (Sunday-Thursday)
 * This function works for ANY date, present or future, regardless of calendar data availability
 * @param {Date} date - Date to check
 * @returns {boolean} True if study day, false if weekend (Fri/Sat)
 */
export function isStudyDay(date = new Date()) {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Study days: Sunday (0) to Thursday (4)
  // Weekend: Friday (5) and Saturday (6)
  return dayOfWeek >= 0 && dayOfWeek <= 4; // Returns true for Sun-Thu only
}

/**
 * Check if today is a study day
 * @returns {boolean} True if today is a study day
 */
export function isTodayStudyDay() {
  return isStudyDay(new Date());
}

/**
 * Format accurate Hijri date in Arabic
 * @param {string|Date|Object} input - Hijri date string (YYYY-MM-DD), Date object, or Hijri object
 * @returns {string} Formatted Arabic date
 */
export function formatAccurateHijriDate(input) {
  const hijriMonths = [
    'المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  let hijriDate;
  
  // Handle different input types
  if (typeof input === 'string') {
    hijriDate = input;
  } else if (input instanceof Date) {
    const hijriObj = gregorianToAccurateHijri(input);
    hijriDate = hijriObj.hijri;
  } else if (input && typeof input === 'object' && input.hijri) {
    hijriDate = input.hijri;
  } else {
    console.error('Invalid input for formatAccurateHijriDate:', input);
    return 'تاريخ غير صحيح';
  }
  
  const [year, month, day] = hijriDate.split('-').map(Number);
  const monthName = hijriMonths[month - 1];
  
  return `${day} ${monthName} ${year} هـ`;
}

/**
 * Get all study days (Sun-Thu) for current Hijri month using accurate calendar
 * Automatically filters out Friday and Saturday for ANY month
 * @returns {Array<string>} Array of Hijri date IDs (YYYY-MM-DD format)
 */
export function getAccurateStudyDaysCurrentMonth() {
  const today = new Date();
  const todayHijri = gregorianToAccurateHijri(today);
  const currentMonth = `${todayHijri.hijriYear}-${String(todayHijri.hijriMonth).padStart(2, '0')}`;
  
  return accurateHijriDates
    .filter(entry => {
      const entryMonth = entry.hijri.substring(0, 7); // YYYY-MM
      const dayOfWeek = new Date(entry.gregorian + 'T12:00:00').getDay();
      
      // Include only current month and study days (Sun=0, Mon=1, Tue=2, Wed=3, Thu=4)
      // Exclude weekends (Fri=5, Sat=6)
      return entryMonth === currentMonth && dayOfWeek >= 0 && dayOfWeek <= 4;
    })
    .map(entry => entry.hijri);
}

/**
 * Get all study days for a specific Hijri month
 * Automatically filters out Friday and Saturday for ANY month (current or past)
 * @param {string} monthKey - Month in format YYYY-MM (e.g., "1447-07" for Rajab)
 * @returns {Array<string>} Array of Hijri date IDs (YYYY-MM-DD format)
 */
export function getAccurateStudyDaysForMonth(monthKey) {
  return accurateHijriDates
    .filter(entry => {
      const entryMonth = entry.hijri.substring(0, 7); // YYYY-MM
      const dateObj = new Date(entry.gregorian + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      
      // Include only specified month and study days (Sun=0 to Thu=4)
      // Automatically excludes Fri=5 and Sat=6 for ALL months
      return entryMonth === monthKey && dayOfWeek >= 0 && dayOfWeek <= 4;
    })
    .map(entry => entry.hijri);
}

// نظام تقويم أيام الدراسة والإجازات
// Study Days and Holidays Calendar System
//
// قواعد النظام:
// 1. أيام الدراسة: الأحد إلى الخميس (Sunday=0 to Thursday=4)
// 2. الإجازة الأسبوعية: الجمعة والسبت (Friday=5, Saturday=6)
// 3. إجازات الأعياد: حسب التقويم الهجري الرسمي
//
// الإجازات الرسمية في المملكة:
// - عيد الفطر: من 25 رمضان إلى 6 شوال
// - عيد الأضحى: من 5 ذو الحجة إلى 15 ذو الحجة
// - يوم التأسيس: 22 فبراير
// - اليوم الوطني: 23 سبتمبر

import { accurateHijriDates } from './accurate-hijri-dates.js';

// إجازات الأعياد الرسمية لعام 1447-1448 هـ
// Official Holidays for 1447-1448 AH
export const officialHolidays = [
  // عيد الفطر 1447 هـ (Eid Al-Fitr 1447)
  {
    name: 'عيد الفطر',
    nameEn: 'Eid Al-Fitr',
    type: 'islamic',
    startHijri: { year: 1447, month: 9, day: 25 }, // 25 رمضان
    endHijri: { year: 1447, month: 10, day: 6 },   // 6 شوال
    startGregorian: '2026-03-15',
    endGregorian: '2026-03-26',
    durationDays: 12
  },
  // عيد الأضحى 1447 هـ (Eid Al-Adha 1447)
  {
    name: 'عيد الأضحى',
    nameEn: 'Eid Al-Adha',
    type: 'islamic',
    startHijri: { year: 1447, month: 12, day: 5 },  // 5 ذو الحجة
    endHijri: { year: 1447, month: 12, day: 20 },   // 20 ذو الحجة
    startGregorian: '2026-05-18',
    endGregorian: '2026-06-06',
    durationDays: 20
  },
  // عيد الفطر 1448 هـ (Eid Al-Fitr 1448)
  {
    name: 'عيد الفطر',
    nameEn: 'Eid Al-Fitr',
    type: 'islamic',
    startHijri: { year: 1448, month: 9, day: 25 }, // 25 رمضان
    endHijri: { year: 1448, month: 10, day: 6 },   // 6 شوال
    startGregorian: '2027-03-05',
    endGregorian: '2027-03-16',
    durationDays: 12
  },
  // يوم التأسيس 2026 (Saudi Founding Day)
  {
    name: 'يوم التأسيس',
    nameEn: 'Founding Day',
    type: 'national',
    startGregorian: '2026-02-22',
    endGregorian: '2026-02-22',
    durationDays: 1
  },
  // اليوم الوطني 2026 (Saudi National Day)
  {
    name: 'اليوم الوطني',
    nameEn: 'National Day',
    type: 'national',
    startGregorian: '2026-09-23',
    endGregorian: '2026-09-23',
    durationDays: 1
  },
  // يوم التأسيس 2027
  {
    name: 'يوم التأسيس',
    nameEn: 'Founding Day',
    type: 'national',
    startGregorian: '2027-02-22',
    endGregorian: '2027-02-22',
    durationDays: 1
  },
  // اليوم الوطني 2027
  {
    name: 'اليوم الوطني',
    nameEn: 'National Day',
    type: 'national',
    startGregorian: '2027-09-23',
    endGregorian: '2027-09-23',
    durationDays: 1
  }
];

// أيام الدراسة في الأسبوع (Days of the week for study)
export const weeklySchedule = {
  studyDays: [0, 1, 2, 3, 4], // Sunday to Thursday - الأحد إلى الخميس
  weekendDays: [5, 6],         // Friday & Saturday - الجمعة والسبت
  
  studyDaysArabic: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  weekendDaysArabic: ['الجمعة', 'السبت'],
  
  allDaysArabic: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
};

/**
 * فحص إذا كان التاريخ المحدد يوم دراسة
 * Check if a given date is a study day
 * @param {Date|string} date - التاريخ الميلادي (Date object or string YYYY-MM-DD)
 * @returns {boolean} true إذا كان يوم دراسة، false إذا كان إجازة
 */
export function isStudyDay(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if weekend (Friday or Saturday)
  const dayOfWeek = dateObj.getDay();
  if (weeklySchedule.weekendDays.includes(dayOfWeek)) {
    return false; // Weekend
  }
  
  // Check if official holiday
  if (isOfficialHoliday(dateObj)) {
    return false; // Official holiday
  }
  
  return true; // Study day
}

/**
 * فحص إذا كان التاريخ المحدد في إجازة رسمية
 * Check if a given date is an official holiday
 * @param {Date|string} date - التاريخ الميلادي
 * @returns {boolean} true إذا كان في إجازة رسمية
 */
export function isOfficialHoliday(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDateToString(dateObj);
  
  for (const holiday of officialHolidays) {
    const startDate = new Date(holiday.startGregorian);
    const endDate = new Date(holiday.endGregorian);
    
    if (dateObj >= startDate && dateObj <= endDate) {
      return true;
    }
  }
  
  return false;
}

/**
 * فحص إذا كان التاريخ المحدد يوم إجازة أسبوعية (جمعة أو سبت)
 * Check if a given date is a weekend
 * @param {Date|string} date - التاريخ الميلادي
 * @returns {boolean} true إذا كان جمعة أو سبت
 */
export function isWeekend(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = dateObj.getDay();
  return weeklySchedule.weekendDays.includes(dayOfWeek);
}

/**
 * الحصول على معلومات يوم معين
 * Get information about a specific day
 * @param {Date|string} date - التاريخ الميلادي
 * @returns {Object} معلومات اليوم
 */
export function getDayInfo(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dayOfWeek = dateObj.getDay();
  const dateStr = formatDateToString(dateObj);
  
  // Get Hijri date from accurate calendar
  const hijriData = accurateHijriDates.find(entry => {
    const entryDate = new Date(entry.gregorian);
    return entryDate.toDateString() === dateObj.toDateString();
  });
  
  const holiday = getHolidayInfo(dateObj);
  const isWeekendDay = isWeekend(dateObj);
  const isHoliday = isOfficialHoliday(dateObj);
  const isStudy = isStudyDay(dateObj);
  
  return {
    gregorianDate: dateStr,
    hijriDate: hijriData ? hijriData.hijri : null,
    hijriDay: hijriData ? hijriData.hijriDay : null,
    hijriMonth: hijriData ? hijriData.hijriMonth : null,
    hijriYear: hijriData ? hijriData.hijriYear : null,
    dayOfWeek: dayOfWeek,
    dayNameArabic: weeklySchedule.allDaysArabic[dayOfWeek],
    dayNameEnglish: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
    isStudyDay: isStudy,
    isWeekend: isWeekendDay,
    isOfficialHoliday: isHoliday,
    holidayInfo: holiday,
    status: isHoliday ? 'إجازة رسمية' : isWeekendDay ? 'إجازة أسبوعية' : 'يوم دراسة',
    statusEn: isHoliday ? 'Official Holiday' : isWeekendDay ? 'Weekend' : 'Study Day'
  };
}

/**
 * الحصول على معلومات الإجازة إذا كان التاريخ في إجازة رسمية
 * Get holiday information if the date is an official holiday
 * @param {Date|string} date - التاريخ الميلادي
 * @returns {Object|null} معلومات الإجازة أو null
 */
export function getHolidayInfo(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  for (const holiday of officialHolidays) {
    const startDate = new Date(holiday.startGregorian);
    const endDate = new Date(holiday.endGregorian);
    
    if (dateObj >= startDate && dateObj <= endDate) {
      return holiday;
    }
  }
  
  return null;
}

/**
 * الحصول على جميع أيام الدراسة في شهر معين
 * Get all study days in a specific month
 * @param {number} year - السنة الميلادية
 * @param {number} month - الشهر الميلادي (1-12)
 * @returns {Array} مصفوفة بأيام الدراسة
 */
export function getStudyDaysInMonth(year, month) {
  const studyDays = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (isStudyDay(date)) {
      studyDays.push({
        date: formatDateToString(date),
        dayInfo: getDayInfo(date)
      });
    }
  }
  
  return studyDays;
}

/**
 * الحصول على جميع أيام الإجازة في شهر معين
 * Get all holidays in a specific month
 * @param {number} year - السنة الميلادية
 * @param {number} month - الشهر الميلادي (1-12)
 * @returns {Array} مصفوفة بأيام الإجازة
 */
export function getHolidaysInMonth(year, month) {
  const holidays = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (!isStudyDay(date)) {
      holidays.push({
        date: formatDateToString(date),
        dayInfo: getDayInfo(date)
      });
    }
  }
  
  return holidays;
}

/**
 * حساب عدد أيام الدراسة بين تاريخين
 * Calculate number of study days between two dates
 * @param {Date|string} startDate - تاريخ البداية
 * @param {Date|string} endDate - تاريخ النهاية
 * @returns {number} عدد أيام الدراسة
 */
export function countStudyDays(startDate, endDate) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    if (isStudyDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * حساب عدد أيام الإجازة بين تاريخين
 * Calculate number of holidays between two dates
 * @param {Date|string} startDate - تاريخ البداية
 * @param {Date|string} endDate - تاريخ النهاية
 * @returns {Object} عدد أيام الإجازات بأنواعها
 */
export function countHolidays(startDate, endDate) {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  let weekendCount = 0;
  let officialHolidayCount = 0;
  const current = new Date(start);
  
  while (current <= end) {
    if (isWeekend(current)) {
      weekendCount++;
    } else if (isOfficialHoliday(current)) {
      officialHolidayCount++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return {
    total: weekendCount + officialHolidayCount,
    weekends: weekendCount,
    officialHolidays: officialHolidayCount
  };
}

/**
 * الحصول على التاريخ التالي ليوم دراسة
 * Get the next study day after a given date
 * @param {Date|string} date - التاريخ المرجعي
 * @returns {Date} التاريخ التالي ليوم دراسة
 */
export function getNextStudyDay(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const nextDay = new Date(dateObj);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isStudyDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * الحصول على التاريخ السابق ليوم دراسة
 * Get the previous study day before a given date
 * @param {Date|string} date - التاريخ المرجعي
 * @returns {Date} التاريخ السابق ليوم دراسة
 */
export function getPreviousStudyDay(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const prevDay = new Date(dateObj);
  prevDay.setDate(prevDay.getDate() - 1);
  
  while (!isStudyDay(prevDay)) {
    prevDay.setDate(prevDay.getDate() - 1);
  }
  
  return prevDay;
}

/**
 * الحصول على قائمة بجميع الإجازات الرسمية القادمة
 * Get list of all upcoming official holidays
 * @param {Date|string} fromDate - تاريخ البداية (افتراضي: اليوم)
 * @returns {Array} مصفوفة بالإجازات القادمة
 */
export function getUpcomingHolidays(fromDate = new Date()) {
  const dateObj = typeof fromDate === 'string' ? new Date(fromDate) : fromDate;
  
  return officialHolidays.filter(holiday => {
    const startDate = new Date(holiday.startGregorian);
    return startDate >= dateObj;
  }).sort((a, b) => {
    return new Date(a.startGregorian) - new Date(b.startGregorian);
  });
}

/**
 * تنسيق التاريخ إلى نص YYYY-MM-DD
 * Format date to YYYY-MM-DD string
 * @param {Date} date - التاريخ
 * @returns {string} التاريخ المنسق
 */
function formatDateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * الحصول على معلومات اليوم الحالي
 * Get information about today
 * @returns {Object} معلومات اليوم الحالي
 */
export function getTodayInfo() {
  return getDayInfo(new Date());
}

/**
 * توليد تقرير شهري عن أيام الدراسة والإجازات
 * Generate monthly report of study days and holidays
 * @param {number} year - السنة الميلادية
 * @param {number} month - الشهر الميلادي (1-12)
 * @returns {Object} تقرير شامل للشهر
 */
export function getMonthlyReport(year, month) {
  const studyDays = getStudyDaysInMonth(year, month);
  const holidays = getHolidaysInMonth(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // تصنيف الإجازات
  const weekendDays = holidays.filter(h => h.dayInfo.isWeekend);
  const officialHolidayDays = holidays.filter(h => h.dayInfo.isOfficialHoliday);
  
  return {
    year,
    month,
    totalDays: daysInMonth,
    studyDaysCount: studyDays.length,
    holidaysCount: holidays.length,
    weekendsCount: weekendDays.length,
    officialHolidaysCount: officialHolidayDays.length,
    studyDays: studyDays,
    holidays: holidays,
    weekends: weekendDays,
    officialHolidays: officialHolidayDays
  };
}

// تصدير جميع الدوال
export default {
  officialHolidays,
  weeklySchedule,
  isStudyDay,
  isOfficialHoliday,
  isWeekend,
  getDayInfo,
  getHolidayInfo,
  getStudyDaysInMonth,
  getHolidaysInMonth,
  countStudyDays,
  countHolidays,
  getNextStudyDay,
  getPreviousStudyDay,
  getUpcomingHolidays,
  getTodayInfo,
  getMonthlyReport
};

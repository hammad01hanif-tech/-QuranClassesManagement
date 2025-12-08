// Hijri Date Conversion and Utilities
// استيراد التواريخ الدقيقة من التقويم الهجري الرسمي
import {
  gregorianToAccurateHijri,
  accurateHijriToGregorian,
  getTodayAccurateHijri,
  getAccurateHijriForStorage,
  formatAccurateHijriDate,
  getAccurateStudyDaysCurrentMonth,
  getAccurateStudyDaysForMonth,
  isStudyDay,
  isTodayStudyDay
} from './accurate-hijri-dates.js';

// Convert Gregorian date to Hijri using accurate calendar data
export function gregorianToHijri(gregorianDate) {
  // استخدام التقويم الدقيق بدلاً من Intl
  const hijri = gregorianToAccurateHijri(gregorianDate);
  
  return {
    year: hijri.hijriYear,
    month: hijri.hijriMonth,
    day: hijri.hijriDay,
    formatted: hijri.hijri // "1447-06-13" format
  };
}

// Convert Hijri date to Gregorian using accurate calendar data
export function hijriToGregorian(hijriYear, hijriMonth, hijriDay) {
  // استخدام التقويم الدقيق بدلاً من التقريب
  const hijriDate = `${hijriYear}-${String(hijriMonth).padStart(2, '0')}-${String(hijriDay).padStart(2, '0')}`;
  const gregorianString = accurateHijriToGregorian(hijriDate);
  
  if (gregorianString) {
    return new Date(gregorianString);
  }
  
  // Fallback: approximate calculation if date not in accurate calendar
  const hijriEpoch = new Date('622-07-16');
  const daysFromEpoch = (hijriYear - 1) * 354.36 + (hijriMonth - 1) * 29.53 + hijriDay;
  return new Date(hijriEpoch.getTime() + daysFromEpoch * 24 * 60 * 60 * 1000);
}

// Get current Hijri date
export function getCurrentHijriDate() {
  return getTodayAccurateHijri();
}

// Format Hijri date in Arabic
export function formatHijriDate(gregorianDate, options = {}) {
  // استخدام التقويم الدقيق
  return formatAccurateHijriDate(gregorianDate);
}

// Get Hijri day name
export function getHijriDayName(gregorianDate) {
  const date = new Date(gregorianDate);
  return new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(date);
}

// Get Hijri month name
export function getHijriMonthName(monthNumber) {
  const months = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  return months[monthNumber - 1] || '';
}

// Format date with time in Hijri
export function formatHijriDateTime(gregorianDate) {
  const date = new Date(gregorianDate);
  
  const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return formatter.format(date);
}

// Get start of Hijri week (Saturday in Islamic calendar)
export function getHijriWeekStart(gregorianDate) {
  const date = new Date(gregorianDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // In Islamic calendar, week starts on Saturday (6)
  const daysToSubtract = dayOfWeek === 6 ? 0 : (dayOfWeek + 1);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  
  return weekStart;
}

// Get start of Hijri month
export function getHijriMonthStart(gregorianDate) {
  const hijri = gregorianToHijri(gregorianDate);
  // Approximate: go back to day 1 of current Hijri month
  const date = new Date(gregorianDate);
  date.setDate(date.getDate() - hijri.day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Compare two Hijri dates
export function compareHijriDates(date1, date2) {
  const hijri1 = gregorianToHijri(date1);
  const hijri2 = gregorianToHijri(date2);
  
  if (hijri1.year !== hijri2.year) return hijri1.year - hijri2.year;
  if (hijri1.month !== hijri2.month) return hijri1.month - hijri2.month;
  return hijri1.day - hijri2.day;
}

// Get date range in Hijri format
export function getHijriDateRange(startDate, endDate) {
  return {
    start: formatHijriDate(startDate, { year: 'numeric', month: 'long', day: 'numeric' }),
    end: formatHijriDate(endDate, { year: 'numeric', month: 'long', day: 'numeric' })
  };
}

// Convert Gregorian YYYY-MM-DD to Hijri display format
export function gregorianToHijriDisplay(gregorianDateString) {
  try {
    const [year, month, day] = gregorianDateString.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone issues
    return formatHijriDate(date, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    console.error('Error converting date:', e);
    return gregorianDateString;
  }
}

// Get Hijri date for storage (keep Gregorian format for database)
export function getTodayForStorage() {
  // استخدام التقويم الدقيق
  return getAccurateHijriForStorage();
}

// Calculate Hijri week ago (7 days back)
export function getHijriWeekAgo(fromDate = new Date()) {
  const weekAgo = new Date(fromDate);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return weekAgo;
}

// Calculate Hijri month ago (approximately 29-30 days)
export function getHijriMonthAgo(fromDate = new Date()) {
  const monthAgo = new Date(fromDate);
  monthAgo.setDate(monthAgo.getDate() - 30); // Approximate Hijri month
  return monthAgo;
}

// Get all days in current Hijri month
export function getCurrentHijriMonthDays() {
  const today = new Date();
  const currentHijri = gregorianToHijri(today);
  
  // Start from day 1 of current Hijri month
  // Go backwards from today to find day 1
  let searchDate = new Date(today);
  let foundStart = null;
  
  // Search backwards up to 35 days to find day 1
  for (let i = 0; i < 35; i++) {
    const testDate = new Date(today);
    testDate.setDate(today.getDate() - i);
    
    const testHijri = gregorianToHijri(testDate);
    
    if (testHijri.day === 1 && testHijri.month === currentHijri.month && testHijri.year === currentHijri.year) {
      foundStart = testDate;
      break;
    }
  }
  
  if (!foundStart) {
    console.error('❌ Could not find start of Hijri month');
    return [];
  }
  
  const monthStart = new Date(foundStart);
  const days = [];
  
  // Collect all days in this Hijri month (max 30 days)
  for (let i = 0; i < 35; i++) {
    const checkDate = new Date(monthStart);
    checkDate.setDate(monthStart.getDate() + i);
    
    const hijriCheck = gregorianToHijri(checkDate);
    
    // Stop when we move to the next Hijri month
    if (hijriCheck.month !== currentHijri.month || hijriCheck.year !== currentHijri.year) {
      break;
    }
    
    days.push({
      gregorianDate: checkDate.toISOString().split('T')[0],
      hijriDate: `${hijriCheck.year}-${String(hijriCheck.month).padStart(2, '0')}-${String(hijriCheck.day).padStart(2, '0')}`, // "1447-06-05"
      hijriDay: hijriCheck.day,
      dayOfWeek: checkDate.getDay() // 0=Sunday, 5=Friday, 6=Saturday
    });
  }
  
  return days;
}

// Get study days only (Sunday-Thursday) in current Hijri month
export function getStudyDaysInCurrentHijriMonth() {
  // استخدام التقويم الدقيق مع فلتر أيام الدراسة
  return getAccurateStudyDaysCurrentMonth();
}

// Get study days for a specific Hijri month (for reports filter)
export function getStudyDaysForHijriMonth(hijriMonthKey) {
  // استخدام التقويم الدقيق لشهر محدد
  return getAccurateStudyDaysForMonth(hijriMonthKey);
}

// Check if a date is a study day (Sunday-Thursday)
export function isStudyDayDate(date) {
  return isStudyDay(date);
}

// Check if today is a study day
export function isTodayAStudyDay() {
  return isTodayStudyDay();
}

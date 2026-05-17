// Local Prayer Times Reader
// Read prayer times from locally stored JSON file

import prayerData from '../data/prayer-times-2026.json' assert { type: 'json' };

/**
 * Get prayer times for a specific date from local data
 * @param {string} date - Date in format "YYYY-MM-DD" or "DD-MM-YYYY"
 * @returns {Object|null} Prayer times object or null
 */
export function getPrayerTimesLocal(date) {
  try {
    // Parse date
    let year, month, day;
    
    if (date.includes('-')) {
      const parts = date.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        [year, month, day] = parts.map(p => parseInt(p));
      } else {
        // DD-MM-YYYY
        [day, month, year] = parts.map(p => parseInt(p));
      }
    }
    
    // Find month in data
    const monthData = prayerData.months.find(m => m.year === year && m.month === month);
    
    if (!monthData) {
      console.warn(`⚠️ No data found for ${year}/${month}`);
      return null;
    }
    
    // Find specific day
    const dayData = monthData.days.find(d => d.gregorianDay === day);
    
    if (!dayData) {
      console.warn(`⚠️ No data found for day ${day} in ${year}/${month}`);
      return null;
    }
    
    return dayData;
    
  } catch (error) {
    console.error('❌ Error reading local prayer times:', error);
    return null;
  }
}

/**
 * Get today's prayer times
 * @returns {Object|null}
 */
export function getTodayPrayerTimes() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return getPrayerTimesLocal(dateStr);
}

/**
 * Get all prayer times for a specific month
 * @param {number} year 
 * @param {number} month 
 * @returns {Array|null}
 */
export function getMonthPrayerTimes(year, month) {
  const monthData = prayerData.months.find(m => m.year === year && m.month === month);
  return monthData ? monthData.days : null;
}

/**
 * Get next prayer time
 * @returns {Object|null} {prayerName, time, remainingMinutes}
 */
export function getNextPrayer() {
  const now = new Date();
  const today = getTodayPrayerTimes();
  
  if (!today) return null;
  
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const prayers = [
    { name: 'الفجر', time: today.fajr },
    { name: 'الشروق', time: today.sunrise },
    { name: 'الظهر', time: today.dhuhr },
    { name: 'العصر', time: today.asr },
    { name: 'المغرب', time: today.maghrib },
    { name: 'العشاء', time: today.isha }
  ];
  
  // Find next prayer
  for (const prayer of prayers) {
    if (prayer.time > currentTime) {
      // Calculate remaining time
      const [nowH, nowM] = currentTime.split(':').map(Number);
      const [prayerH, prayerM] = prayer.time.split(':').map(Number);
      
      const nowMinutes = nowH * 60 + nowM;
      const prayerMinutes = prayerH * 60 + prayerM;
      const remaining = prayerMinutes - nowMinutes;
      
      return {
        name: prayer.name,
        time: prayer.time,
        remainingMinutes: remaining,
        remainingHours: Math.floor(remaining / 60),
        remainingMins: remaining % 60
      };
    }
  }
  
  // If no prayer left today, return Fajr of tomorrow
  return {
    name: 'الفجر (غداً)',
    time: today.fajr,
    remainingMinutes: null
  };
}

/**
 * Check if current time is between Asr and Maghrib (prayer time verification)
 * @returns {boolean}
 */
export function isAsrTime() {
  const today = getTodayPrayerTimes();
  if (!today) return false;
  
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return currentTime >= today.asr && currentTime < today.maghrib;
}

/**
 * Check if current time is after Isha
 * @returns {boolean}
 */
export function isIshaTime() {
  const today = getTodayPrayerTimes();
  if (!today) return false;
  
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return currentTime >= today.isha;
}

/**
 * Get all available months in local data
 * @returns {Array}
 */
export function getAvailableMonths() {
  return prayerData.months.map(m => ({
    year: m.year,
    month: m.month,
    monthName: m.monthName,
    totalDays: m.totalDays
  }));
}

/**
 * Get data metadata
 * @returns {Object}
 */
export function getDataInfo() {
  return {
    location: prayerData.location,
    country: prayerData.country,
    year: prayerData.year,
    fetchedAt: prayerData.fetchedAt,
    totalMonths: prayerData.months.length,
    totalDays: prayerData.months.reduce((sum, m) => sum + m.totalDays, 0)
  };
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
  window.getPrayerTimesLocal = getPrayerTimesLocal;
  window.getTodayPrayerTimes = getTodayPrayerTimes;
  window.getMonthPrayerTimes = getMonthPrayerTimes;
  window.getNextPrayer = getNextPrayer;
  window.isAsrTime = isAsrTime;
  window.isIshaTime = isIshaTime;
  window.getAvailableMonths = getAvailableMonths;
  window.getDataInfo = getDataInfo;
}

// Log when loaded
console.log('✅ Local Prayer Times Reader loaded');
console.log(`📊 Data: ${prayerData.months.length} months, ${prayerData.months.reduce((sum, m) => sum + m.totalDays, 0)} days`);

// Prayer Times API Integration
// Using Aladhan API for Makkah prayer times

import { 
  db, 
  collection, 
  getDocs,
  getDoc,
  doc as firestoreDoc,
  setDoc,
  serverTimestamp
} from '../firebase-config.js';

// API Configuration
const ALADHAN_API = 'https://api.aladhan.com/v1/calendarByCity';
const CITY = 'Makkah';
const COUNTRY = 'Saudi Arabia';
const METHOD = 4; // Umm al-Qura University, Makkah (أنسب طريقة لمكة)
const SCHOOL = 0; // Shafi (المذهب الشافعي)

/**
 * Fetch prayer times for a specific month from Aladhan API
 * @param {number} year - Gregorian year (e.g., 2026)
 * @param {number} month - Gregorian month (1-12)
 * @returns {Promise<Array>} Array of prayer times for each day
 */
export async function fetchPrayerTimesFromAPI(year, month) {
  try {
    console.log(`🕌 Fetching prayer times for ${year}/${month} - ${CITY}, ${COUNTRY}`);
    
    // Build API URL
    const url = `${ALADHAN_API}/${year}/${month}?city=${encodeURIComponent(CITY)}&country=${encodeURIComponent(COUNTRY)}&method=${METHOD}&school=${SCHOOL}`;
    
    console.log('📡 API URL:', url);
    
    // Fetch data
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 200 || !data.data) {
      throw new Error('Invalid API response');
    }
    
    console.log(`✅ Fetched ${data.data.length} days of prayer times`);
    
    // Transform data to our format
    const prayerTimes = data.data.map(day => {
      const timings = day.timings;
      const date = day.date;
      
      return {
        // Gregorian date
        gregorianDate: date.gregorian.date, // "17-05-2026"
        gregorianDay: parseInt(date.gregorian.day),
        gregorianMonth: parseInt(date.gregorian.month.number),
        gregorianYear: parseInt(date.gregorian.year),
        gregorianMonthName: date.gregorian.month.en,
        gregorianWeekday: date.gregorian.weekday.en,
        
        // Hijri date
        hijriDate: date.hijri.date, // "21-11-1447"
        hijriDay: parseInt(date.hijri.day),
        hijriMonth: parseInt(date.hijri.month.number),
        hijriYear: parseInt(date.hijri.year),
        hijriMonthName: date.hijri.month.ar,
        hijriWeekday: date.hijri.weekday.ar,
        
        // Prayer times (remove timezone info, keep only time)
        fajr: timings.Fajr.split(' ')[0], // "04:25"
        sunrise: timings.Sunrise.split(' ')[0],
        dhuhr: timings.Dhuhr.split(' ')[0],
        asr: timings.Asr.split(' ')[0],
        maghrib: timings.Maghrib.split(' ')[0],
        isha: timings.Isha.split(' ')[0],
        
        // Additional info
        timestamp: Date.now(),
        location: CITY,
        country: COUNTRY
      };
    });
    
    return prayerTimes;
    
  } catch (error) {
    console.error('❌ Error fetching prayer times:', error);
    throw error;
  }
}

/**
 * Store prayer times in Firestore
 * @param {number} year - Gregorian year
 * @param {number} month - Gregorian month
 * @param {Array} prayerTimes - Array of prayer times
 */
export async function storePrayerTimesInFirestore(year, month, prayerTimes) {
  try {
    console.log(`💾 Storing ${prayerTimes.length} prayer times in Firestore...`);
    
    const monthKey = `${year}-${String(month).padStart(2, '0')}`; // "2026-05"
    
    // Store entire month in one document
    const docRef = firestoreDoc(db, 'prayerTimes', monthKey);
    
    await setDoc(docRef, {
      year: year,
      month: month,
      monthKey: monthKey,
      location: CITY,
      country: COUNTRY,
      days: prayerTimes,
      fetchedAt: serverTimestamp(),
      totalDays: prayerTimes.length
    });
    
    console.log(`✅ Stored prayer times for ${monthKey}`);
    
  } catch (error) {
    console.error('❌ Error storing prayer times:', error);
    throw error;
  }
}

/**
 * Get prayer times for a specific date from Firestore
 * @param {string} gregorianDate - Date in format "YYYY-MM-DD" or "DD-MM-YYYY"
 * @returns {Promise<Object|null>} Prayer times object or null
 */
export async function getPrayerTimesForDate(gregorianDate) {
  try {
    // Parse date (support multiple formats)
    let year, month, day;
    
    if (gregorianDate.includes('-')) {
      const parts = gregorianDate.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        [year, month, day] = parts;
      } else {
        // DD-MM-YYYY
        [day, month, year] = parts;
      }
    }
    
    year = parseInt(year);
    month = parseInt(month);
    day = parseInt(day);
    
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    // Get month document
    const docRef = firestoreDoc(db, 'prayerTimes', monthKey);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log(`⚠️ No prayer times found for ${monthKey}`);
      return null;
    }
    
    const monthData = docSnap.data();
    
    // Find specific day
    const dayData = monthData.days.find(d => d.gregorianDay === day);
    
    if (!dayData) {
      console.log(`⚠️ No prayer times found for day ${day} in ${monthKey}`);
      return null;
    }
    
    return dayData;
    
  } catch (error) {
    console.error('❌ Error getting prayer times:', error);
    return null;
  }
}

/**
 * Fetch and store current month's prayer times
 */
export async function fetchAndStoreCurrentMonth() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JS months are 0-indexed
    
    console.log(`🔄 Fetching and storing prayer times for ${year}/${month}...`);
    
    // Fetch from API
    const prayerTimes = await fetchPrayerTimesFromAPI(year, month);
    
    // Store in Firestore
    await storePrayerTimesInFirestore(year, month, prayerTimes);
    
    console.log('✅ Successfully fetched and stored current month prayer times!');
    
    return {
      success: true,
      year: year,
      month: month,
      totalDays: prayerTimes.length
    };
    
  } catch (error) {
    console.error('❌ Error in fetchAndStoreCurrentMonth:', error);
    throw error;
  }
}

/**
 * Check if prayer times exist for a specific month
 * @param {number} year 
 * @param {number} month 
 * @returns {Promise<boolean>}
 */
export async function checkPrayerTimesExist(year, month) {
  try {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const docRef = firestoreDoc(db, 'prayerTimes', monthKey);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking prayer times:', error);
    return false;
  }
}

/**
 * Get all stored prayer times months
 * @returns {Promise<Array>} Array of stored months
 */
export async function getAllStoredMonths() {
  try {
    const querySnapshot = await getDocs(collection(db, 'prayerTimes'));
    const months = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      months.push({
        id: doc.id,
        year: data.year,
        month: data.month,
        monthKey: data.monthKey,
        totalDays: data.totalDays,
        location: data.location,
        fetchedAt: data.fetchedAt
      });
    });
    
    return months;
  } catch (error) {
    console.error('Error getting stored months:', error);
    return [];
  }
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
  window.fetchPrayerTimesFromAPI = fetchPrayerTimesFromAPI;
  window.storePrayerTimesInFirestore = storePrayerTimesInFirestore;
  window.getPrayerTimesForDate = getPrayerTimesForDate;
  window.fetchAndStoreCurrentMonth = fetchAndStoreCurrentMonth;
  window.checkPrayerTimesExist = checkPrayerTimesExist;
  window.getAllStoredMonths = getAllStoredMonths;
}

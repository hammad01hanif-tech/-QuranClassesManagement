// Fetch Prayer Times Data and Store Locally
// Run this script with: node fetch-prayer-data.js

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CITY = 'Makkah';
const COUNTRY = 'Saudi Arabia';
const METHOD = 4; // Umm al-Qura University, Makkah
const SCHOOL = 0; // Shafi
const YEAR = 2026;
const START_MONTH = 5; // May (current month)
const END_MONTH = 12; // December

// API Base URL
const API_BASE = 'https://api.aladhan.com/v1/calendarByCity';

/**
 * Fetch prayer times for a specific month
 */
function fetchMonthData(year, month) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/${year}/${month}?city=${encodeURIComponent(CITY)}&country=${encodeURIComponent(COUNTRY)}&method=${METHOD}&school=${SCHOOL}`;
    
    console.log(`\n🔄 Fetching ${year}/${month}...`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.code !== 200 || !json.data) {
            reject(new Error(`API Error for ${year}/${month}`));
            return;
          }
          
          // Transform data
          const prayerTimes = json.data.map(day => {
            const timings = day.timings;
            const date = day.date;
            
            return {
              // Gregorian date
              gregorianDate: date.gregorian.date,
              gregorianDay: parseInt(date.gregorian.day),
              gregorianMonth: parseInt(date.gregorian.month.number),
              gregorianYear: parseInt(date.gregorian.year),
              gregorianMonthName: date.gregorian.month.en,
              gregorianWeekday: date.gregorian.weekday.en,
              
              // Hijri date
              hijriDate: date.hijri.date,
              hijriDay: parseInt(date.hijri.day),
              hijriMonth: parseInt(date.hijri.month.number),
              hijriYear: parseInt(date.hijri.year),
              hijriMonthName: date.hijri.month.ar,
              hijriWeekday: date.hijri.weekday.ar,
              
              // Prayer times (remove timezone info)
              fajr: timings.Fajr.split(' ')[0],
              sunrise: timings.Sunrise.split(' ')[0],
              dhuhr: timings.Dhuhr.split(' ')[0],
              asr: timings.Asr.split(' ')[0],
              maghrib: timings.Maghrib.split(' ')[0],
              isha: timings.Isha.split(' ')[0],
              
              // Location
              location: CITY,
              country: COUNTRY
            };
          });
          
          console.log(`✅ Fetched ${prayerTimes.length} days`);
          
          // Verify Asr and Isha times
          const missingAsr = prayerTimes.filter(d => !d.asr || d.asr === '');
          const missingIsha = prayerTimes.filter(d => !d.isha || d.isha === '');
          
          if (missingAsr.length > 0) {
            console.warn(`⚠️  WARNING: ${missingAsr.length} days missing Asr time!`);
          }
          if (missingIsha.length > 0) {
            console.warn(`⚠️  WARNING: ${missingIsha.length} days missing Isha time!`);
          }
          
          if (missingAsr.length === 0 && missingIsha.length === 0) {
            console.log(`✅ Asr and Isha times verified for all ${prayerTimes.length} days`);
          }
          
          resolve({
            year: year,
            month: month,
            monthName: prayerTimes[0].gregorianMonthName,
            totalDays: prayerTimes.length,
            days: prayerTimes
          });
          
        } catch (error) {
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Delay helper to avoid rate limiting
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function - Fetch all months
 */
async function fetchAllMonths() {
  console.log('🕌 Starting Prayer Times Data Fetch');
  console.log(`📍 Location: ${CITY}, ${COUNTRY}`);
  console.log(`📅 Period: ${YEAR}/${START_MONTH} to ${YEAR}/${END_MONTH}`);
  console.log(`🔢 Total months: ${END_MONTH - START_MONTH + 1}`);
  console.log('=' .repeat(60));
  
  const allData = {
    location: CITY,
    country: COUNTRY,
    method: METHOD,
    school: SCHOOL,
    year: YEAR,
    fetchedAt: new Date().toISOString(),
    months: []
  };
  
  let totalDays = 0;
  let totalAsrVerified = 0;
  let totalIshaVerified = 0;
  
  try {
    for (let month = START_MONTH; month <= END_MONTH; month++) {
      try {
        const monthData = await fetchMonthData(YEAR, month);
        allData.months.push(monthData);
        totalDays += monthData.totalDays;
        
        // Count verified times
        const asrVerified = monthData.days.filter(d => d.asr && d.asr !== '').length;
        const ishaVerified = monthData.days.filter(d => d.isha && d.isha !== '').length;
        totalAsrVerified += asrVerified;
        totalIshaVerified += ishaVerified;
        
        console.log(`   Asr: ${asrVerified}/${monthData.totalDays} | Isha: ${ishaVerified}/${monthData.totalDays}`);
        
        // Wait 1 second between requests to be nice to the API
        if (month < END_MONTH) {
          await delay(1000);
        }
        
      } catch (error) {
        console.error(`❌ Error fetching month ${month}:`, error.message);
        // Continue with next month
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`✅ Successfully fetched ${allData.months.length} months`);
    console.log(`✅ Total days: ${totalDays}`);
    console.log(`✅ Asr times verified: ${totalAsrVerified}/${totalDays}`);
    console.log(`✅ Isha times verified: ${totalIshaVerified}/${totalDays}`);
    
    if (totalAsrVerified === totalDays && totalIshaVerified === totalDays) {
      console.log('🎉 ALL PRAYER TIMES VERIFIED SUCCESSFULLY!');
    }
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('\n📁 Created data directory');
    }
    
    // Save to JSON file
    const outputFile = path.join(dataDir, `prayer-times-${YEAR}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2), 'utf8');
    
    console.log(`\n💾 Data saved to: ${outputFile}`);
    console.log(`📦 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
    
    // Also create a minified version
    const minifiedFile = path.join(dataDir, `prayer-times-${YEAR}.min.json`);
    fs.writeFileSync(minifiedFile, JSON.stringify(allData), 'utf8');
    console.log(`📦 Minified version: ${minifiedFile}`);
    console.log(`📦 Minified size: ${(fs.statSync(minifiedFile).size / 1024).toFixed(2)} KB`);
    
    console.log('\n✅ DONE! Prayer times data is ready to use.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
console.log('\n');
fetchAllMonths().then(() => {
  console.log('\n🎉 Script completed successfully!\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});

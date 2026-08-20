// Honor System JavaScript - نظام تكريم الأوائل
import { db, collection, getDocs, addDoc, doc, getDoc, setDoc, query, where, serverTimestamp } from '../firebase-config.js';
import { getCurrentHijriDate } from './hijri-date.js';
import { accurateHijriToGregorian } from './accurate-hijri-dates.js';

// Global variables
let allNominees = [];
let filteredNominees = [];
let allHonored = [];

/**
 * Add months to a Hijri date string
 * @param {string} hijriMonth - Format: "YYYY-MM"
 * @param {number} monthsToAdd - Number of months to add
 * @returns {string} New Hijri month in format "YYYY-MM"
 */
function addMonthsToHijri(hijriMonth, monthsToAdd) {
  if (monthsToAdd === 0) return hijriMonth;
  
  const [yearStr, monthStr] = hijriMonth.split('-');
  let year = parseInt(yearStr);
  let month = parseInt(monthStr);
  
  // Add months
  month += monthsToAdd;
  
  // Handle year overflow
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  
  // Handle underflow (in case of negative monthsToAdd)
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  
  // Return formatted string
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Initialize Honor System
 */
window.initHonorSystem = async function() {
  console.log('🚀 Initializing Honor System...');
  
  try {
    // Load month filters
    await loadMonthFilters();
    
    // Load class filters
    await loadClassFilters();
    
    // Load honored months
    await loadHonoredMonths();
    
    // Switch to nominees tab by default
    window.switchHonorTab('nominees');
    
    console.log('✅ Honor System initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Honor System:', error);
    alert('حدث خطأ في تحميل نظام التكريم. يرجى تحديث الصفحة.');
  }
};

/**
 * Switch between Honor tabs
 */
// Track if data has been loaded
let nomineesDataLoaded = false;
let honoredDataLoaded = false;

window.switchHonorTab = function(tabName) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll('.exam-tab-content');
  tabContents.forEach(content => content.classList.remove('active'));
  
  // Remove active class from all tabs
  const tabs = document.querySelectorAll('.exam-tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Show selected tab content
  const selectedContent = document.getElementById(`${tabName}Tab`);
  if (selectedContent) {
    selectedContent.classList.add('active');
  }
  
  // Add active class to selected tab button
  const selectedTab = document.querySelector(`.exam-tab[data-tab="${tabName}"]`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }
  
  // Auto-load data when switching to tab for the first time
  if (tabName === 'nominees' && !nomineesDataLoaded) {
    nomineesDataLoaded = true;
    loadNominees();
  } else if (tabName === 'honored' && !honoredDataLoaded) {
    honoredDataLoaded = true;
    loadHonoredStudents();
  }
};

/**
 * Load month filters
 */
async function loadMonthFilters() {
  const monthSelect = document.getElementById('honorFilterMonth');
  if (!monthSelect) return;
  
  // Generate last 6 months
  const currentHijriData = getCurrentHijriDate();
  const currentYear = currentHijriData.hijriYear;
  const currentMonth = currentHijriData.hijriMonth;
  
  const hijriMonths = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  monthSelect.innerHTML = '<option value="">جميع الأشهر</option>';
  
  // Add last 6 months
  for (let i = 0; i < 6; i++) {
    let month = currentMonth - i;
    let year = currentYear;
    
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthName = hijriMonths[month - 1];
    
    const option = document.createElement('option');
    option.value = monthKey;
    option.textContent = `${monthName} ${year}`;
    monthSelect.appendChild(option);
  }
}

/**
 * Load class filters
 */
async function loadClassFilters() {
  const classSelect = document.getElementById('honorFilterClass');
  if (!classSelect) return;
  
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    
    classSelect.innerHTML = '<option value="">جميع الحلقات</option>';
    
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const option = document.createElement('option');
      option.value = classDoc.id;
      option.textContent = classData.teacherName || classData.className || classDoc.id;
      classSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading classes:', error);
  }
}

/**
 * Load Honored Months (for dropdown in Honored tab)
 */
async function loadHonoredMonths() {
  const monthSelect = document.getElementById('honoredMonthSelect');
  if (!monthSelect) return;
  
  try {
    // Get unique months from honoredStudents collection
    const honoredSnapshot = await getDocs(collection(db, 'honoredStudents'));
    const monthsSet = new Set();
    
    honoredSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.honorMonth) {
        monthsSet.add(data.honorMonth);
      }
    });
    
    const monthsArray = Array.from(monthsSet).sort().reverse();
    
    monthSelect.innerHTML = '<option value="">-- اختر الشهر --</option>';
    
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    
    monthsArray.forEach(monthKey => {
      const parts = monthKey.split('-');
      const year = parts[0];
      const month = parseInt(parts[1]);
      const monthName = hijriMonths[month - 1];
      
      const option = document.createElement('option');
      option.value = monthKey;
      option.textContent = `${monthName} ${year}`;
      monthSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading honored months:', error);
  }
}

/**
 * Load Nominees - Main function to calculate eligible students (OPTIMIZED)
 */
window.loadNominees = async function() {
  const container = document.getElementById('nomineesTableContainer');
  if (!container) return;
  
  // Mark as loaded so auto-load doesn't trigger again
  nomineesDataLoaded = true;
  
  container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري تحميل البيانات...<br><small>سيستغرق بضع ثوانٍ فقط</small></p>';
  
  try {
    console.log('📊 Starting optimized nominees calculation...');
    const startTime = Date.now();
    
    allNominees = [];
    
    // Step 1: Load ALL data at once (parallel queries)
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري تحميل البيانات... (1/5)</p>';
    
    const [studentsSnapshot, classesSnapshot, allHizbsSnapshot, allJuzSnapshot, allExamsSnapshot, allCheckpointsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
      getDocs(collection(db, 'classes')),
      getDocs(query(collection(db, 'hizbDisplays'), where('status', '==', 'completed'))),
      getDocs(query(collection(db, 'juzDisplays'), where('status', '==', 'completed'))),
      getDocs(collection(db, 'monthlyExams')),
      getDocs(collection(db, 'studentHonorCheckpoints'))
    ]);
    
    console.log(`✅ Data loaded in ${Date.now() - startTime}ms`);
    console.log(`📚 Students: ${studentsSnapshot.size}, Hizbs: ${allHizbsSnapshot.size}, Juz: ${allJuzSnapshot.size}, Exams: ${allExamsSnapshot.size}`);
    
    // Step 2: Build data maps for fast lookup
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري معالجة البيانات... (2/5)</p>';
    
    // Teacher names map
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
    // Checkpoints map
    const checkpointsMap = {};
    allCheckpointsSnapshot.forEach(doc => {
      checkpointsMap[doc.id] = doc.data();
    });
    
    // Hizbs by student map
    const hizbsByStudent = {};
    allHizbsSnapshot.forEach(doc => {
      const data = doc.data();
      if (!hizbsByStudent[data.studentId]) {
        hizbsByStudent[data.studentId] = [];
      }
      hizbsByStudent[data.studentId].push({ ...data, type: 'hizb' });
    });
    
    // Juz by student map
    const juzByStudent = {};
    allJuzSnapshot.forEach(doc => {
      const data = doc.data();
      if (!juzByStudent[data.studentId]) {
        juzByStudent[data.studentId] = [];
      }
      juzByStudent[data.studentId].push({ ...data, type: 'juz' });
    });
    
    // Exams by student and month map
    const examsByStudentMonth = {};
    let totalExamsProcessed = 0;
    allExamsSnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.studentId}_${data.hijriMonth}`;
      if (!examsByStudentMonth[key]) {
        examsByStudentMonth[key] = [];
      }
      examsByStudentMonth[key].push(data);
      totalExamsProcessed++;
    });
    
    console.log('✅ Data maps built');
    console.log(`   📝 Total exams processed: ${totalExamsProcessed}`);
    console.log(`   📊 Unique student-month combinations: ${Object.keys(examsByStudentMonth).length}`);
    
    // Step 3: Process each student (fast in-memory operations)
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري حساب المرشحين... (3/5)</p>';
    
    const totalStudents = studentsSnapshot.size;
    let processedCount = 0;
    
    studentsSnapshot.forEach(studentDoc => {
      processedCount++;
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      const studentName = studentData.name || 'غير محدد';
      const teacherId = studentData.classId;
      const teacherName = teacherNamesMap[teacherId] || 'غير محدد';
      
      // Calculate eligibility using pre-loaded maps (returns array of nominations)
      const eligibilities = calculateStudentEligibilityOptimized(
        studentId,
        studentName,
        teacherId,
        teacherName,
        checkpointsMap[studentId],
        hizbsByStudent[studentId] || [],
        juzByStudent[studentId] || [],
        examsByStudentMonth
      );
      
      // Add all eligibilities to allNominees
      if (eligibilities && eligibilities.length > 0) {
        allNominees.push(...eligibilities);
      }
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Total eligible nominees (before filtering): ${allNominees.length}`);
    
    // Filter out old months (before Safar 1448)
    // Only keep nominations from Safar 1448 (1448-02) and onwards
    const MINIMUM_MONTH = '1448-02'; // Safar 1448
    allNominees = allNominees.filter(nominee => {
      return nominee.eligibleMonth >= MINIMUM_MONTH;
    });
    
    console.log(`✅ Total eligible nominees (after old months filter): ${allNominees.length}`);
    console.log(`⚡ Total processing time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    
    // Step 4: Update statistics
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري تحديث الإحصائيات... (4/5)</p>';
    
    // Step 5: Apply filters and display nominees
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري عرض النتائج... (5/5)</p>';
    
    // Apply current filters if any
    const monthFilter = document.getElementById('honorFilterMonth')?.value;
    const classFilter = document.getElementById('honorFilterClass')?.value;
    
    if (monthFilter || classFilter) {
      // Apply filters
      filteredNominees = allNominees.filter(nominee => {
        if (monthFilter && nominee.eligibleMonth !== monthFilter) return false;
        if (classFilter && nominee.teacherId !== classFilter) return false;
        return true;
      });
    } else {
      // No filters, show all
      filteredNominees = [...allNominees];
    }
    
    displayNominees();
    
    console.log(`🎉 All done in ${(totalTime/1000).toFixed(2)}s!`);
    
  } catch (error) {
    console.error('Error loading nominees:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
        <p style="color: #dc3545; font-size: 18px; margin-bottom: 10px;">حدث خطأ في تحميل المرشحين</p>
        <p style="color: #999; font-size: 14px;">${error.message || 'خطأ غير معروف'}</p>
        <button onclick="window.loadNominees()" style="margin-top: 15px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🔄 إعادة المحاولة
        </button>
      </div>
    `;
  }
};

/**
 * Get the last day of a Hijri month (29 or 30)
 * @param {string} hijriMonth - Hijri month in format "YYYY-MM"
 * @returns {string} - Last day of the month in format "YYYY-MM-DD"
 */
function getLastDayOfHijriMonth(hijriMonth) {
  const [year, month] = hijriMonth.split('-');
  const paddedMonth = month.padStart(2, '0');
  
  // Try day 30 first
  const day30 = `${year}-${paddedMonth}-30`;
  try {
    const gregorian30 = hijriToGregorianString(day30);
    if (gregorian30 && gregorian30 !== '0000-00-00') {
      // Successfully converted, month has 30 days
      return day30;
    }
  } catch (e) {
    // Day 30 failed, try day 29
  }
  
  // Month has 29 days
  return `${year}-${paddedMonth}-29`;
}

/**
 * Calculate student eligibility - OPTIMIZED (uses pre-loaded data)
 * 
 * UNIFIED ELIGIBILITY RULES FOR FAIRNESS:
 * =======================================
 * 
 * RULE 1 - lastLessonDate (Registration Date):
 *   ✅ MUST be >= Safar 1448 start (2026-07-15)
 *   ❌ Rejects any lesson registered in Muharram or earlier
 *   🌐 Applies to ALL students (with or without checkpoint)
 *   ⚖️ Ensures fairness: everyone starts from same baseline
 * 
 * RULE 2 - displayDate (Completion Date):
 *   📅 If NO checkpoint: displayDate >= Safar start (first cycle)
 *   🔒 If HAS checkpoint: displayDate > last day of honored month
 *   🚫 Ensures no double-honor for same achievement
 * 
 * CHECKPOINT SYSTEM:
 *   🏆 After honor: checkpoint = last day of honored month
 *   🔄 Resets counter: student needs full requirement again
 *   ➕ Extra achievements carry to next month
 * 
 * EXAMPLE:
 *   Student: 4 hizbs in Safar (all lastLesson in Safar)
 *     → Month 1 (Safar): hizb 1+2 ✅
 *     → Month 2 (Rabi'): hizb 3+4 ✅
 */
function calculateStudentEligibilityOptimized(studentId, studentName, teacherId, teacherName, checkpoint, studentHizbs, studentJuz, examsByStudentMonth) {
  try {
    // UNIFIED STARTING POINT FOR ALL STUDENTS (FAIRNESS)
    // =================================================
    // Starting point is ALWAYS Safar 1448 start date for ALL students
    // This ensures every student is judged by the same baseline
    // Checkpoint is used ONLY to exclude previously honored achievements
    const SAFAR_START_GREGORIAN = '2026-07-15'; // First day of Safar 1448 in Gregorian calendar
    const SAFAR_START_HIJRI = '1448-02-01'; // First day of Safar 1448 in Hijri calendar
    
    // Checkpoint tracks: which achievements were already honored (to avoid double-counting)
    const hasCheckpoint = checkpoint && checkpoint.lastHonorMonth;
    let checkpointDateGregorian = null; // Date to exclude previously honored achievements
    
    if (hasCheckpoint) {
      // Calculate the last day of the honored month (checkpoint cutoff date)
      const lastCheckpointDateHijri = getLastDayOfHijriMonth(checkpoint.lastHonorMonth);
      checkpointDateGregorian = hijriToGregorianString(lastCheckpointDateHijri);
    }
    
    // Read carried-over count (remaining achievements from last honor)
    const carriedOverCount = (checkpoint && checkpoint.carriedOverCount) || 0;
    
    const totalRecords = (studentHizbs?.length || 0) + (studentJuz?.length || 0);
    if (totalRecords > 0) {
      console.log(`\n🔍 ============ Student ${studentName} (${studentId}) ============`);
      console.log(`   📊 Total records: ${studentHizbs?.length || 0} hizbs + ${studentJuz?.length || 0} juz = ${totalRecords}`);
      console.log(`   🎯 Starting point (UNIFIED): ${SAFAR_START_GREGORIAN} (بداية صفر 1448 - للجميع)`);
      if (hasCheckpoint) {
        console.log(`   🔒 Checkpoint cutoff: ${checkpointDateGregorian} (استبعاد المُكرّمين سابقاً)`);
        console.log(`   📦 Carried over: ${carriedOverCount} (الرصيد المحفوظ)`);
      } else {
        console.log(`   ✨ First cycle (no checkpoint)`);
      }
    }
    
    // Filter records with TWO critical rules for fairness:
    // RULE 1: lastLessonDate MUST be >= Safar start (no lessons registered before Safar)
    // RULE 2 (displayDate): For first cycle >= Safar start, After honor > checkpoint
    // This ensures all students are judged equally regardless of checkpoint status
    const allRecords = [];
    
    // Process hizbs
    studentHizbs.forEach((record, index) => {
      const displayDate = record.displayDate || '';
      const lastLessonDate = record.lastLessonDate || '';
      
      // Convert Hijri dates to Gregorian for comparison
      const displayDateGregorian = hijriToGregorianString(displayDate);
      const lastLessonDateGregorian = hijriToGregorianString(lastLessonDate);
      
      console.log(`   📋 Hizb #${index + 1} (رقم ${record.hizbNumber}):`);
      console.log(`      • lastLessonDate: ${lastLessonDate} → Gregorian: ${lastLessonDateGregorian}`);
      console.log(`      • displayDate: ${displayDate} → Gregorian: ${displayDateGregorian}`);
      
      // RULE 1: lastLessonDate MUST be >= Safar start (UNIFIED for all students)
      if (lastLessonDateGregorian < SAFAR_START_GREGORIAN) {
        console.log(`      ❌ REJECTED - lastLessonDate before Safar start (registered before system start)`);
        console.log(`      • ${lastLessonDateGregorian} < ${SAFAR_START_GREGORIAN}`);
        return;
      }
      
      // RULE 2: displayDate must exclude previously honored achievements
      let isValid = false;
      if (hasCheckpoint) {
        // Student was honored before: exclude achievements up to checkpoint
        isValid = displayDateGregorian > checkpointDateGregorian;
        console.log(`      • Check displayDate > checkpoint: ${displayDateGregorian} > ${checkpointDateGregorian}? ${isValid}`);
      } else {
        // First cycle: accept all from Safar start
        isValid = displayDateGregorian >= SAFAR_START_GREGORIAN;
        console.log(`      • Check displayDate >= Safar start: ${displayDateGregorian} >= ${SAFAR_START_GREGORIAN}? ${isValid}`);
      }
      
      if (isValid) {
        const duration = calculateDaysBetween(lastLessonDate, displayDate);
        const attemptsCount = record.attemptsCount || 1;
        
        console.log(`      ✅ ACCEPTED - New achievement (not previously honored)`);
        console.log(`      • Attempts: ${attemptsCount}, Duration: ${duration} days`);
        
        allRecords.push({ 
          ...record, 
          type: 'hizb',
          attemptsCount: attemptsCount,
          duration: duration
        });
      } else {
        console.log(`      ❌ REJECTED - ${hasCheckpoint ? 'Already honored (before checkpoint)' : 'Before system start'}`);
      }
    });
    
    // Process juz
    studentJuz.forEach((record, index) => {
      const displayDate = record.displayDate || '';
      const lastLessonDate = record.lastLessonDate || '';
      
      // Convert Hijri dates to Gregorian for comparison
      const displayDateGregorian = hijriToGregorianString(displayDate);
      const lastLessonDateGregorian = hijriToGregorianString(lastLessonDate);
      
      console.log(`   📖 Juz #${index + 1} (رقم ${record.juzNumber}):`);
      console.log(`      • lastLessonDate: ${lastLessonDate} → Gregorian: ${lastLessonDateGregorian}`);
      console.log(`      • displayDate: ${displayDate} → Gregorian: ${displayDateGregorian}`);
      
      // RULE 1: lastLessonDate MUST be >= Safar start (UNIFIED for all students)
      if (lastLessonDateGregorian < SAFAR_START_GREGORIAN) {
        console.log(`      ❌ REJECTED - lastLessonDate before Safar start (registered before system start)`);
        console.log(`      • ${lastLessonDateGregorian} < ${SAFAR_START_GREGORIAN}`);
        return;
      }
      
      // RULE 2: displayDate must exclude previously honored achievements
      let isValid = false;
      if (hasCheckpoint) {
        // Student was honored before: exclude achievements up to checkpoint
        isValid = displayDateGregorian > checkpointDateGregorian;
        console.log(`      • Check displayDate > checkpoint: ${displayDateGregorian} > ${checkpointDateGregorian}? ${isValid}`);
      } else {
        // First cycle: accept all from Safar start
        isValid = displayDateGregorian >= SAFAR_START_GREGORIAN;
        console.log(`      • Check displayDate >= Safar start: ${displayDateGregorian} >= ${SAFAR_START_GREGORIAN}? ${isValid}`);
      }
      
      if (isValid) {
        const duration = calculateDaysBetween(lastLessonDate, displayDate);
        const attemptsCount = record.attemptsCount || 1;
        
        console.log(`      ✅ ACCEPTED - New achievement (not previously honored)`);
        console.log(`      • Attempts: ${attemptsCount}, Duration: ${duration} days`);
        
        allRecords.push({ 
          ...record, 
          type: 'juz',
          attemptsCount: attemptsCount,
          duration: duration
        });
      } else {
        console.log(`      ❌ REJECTED - ${hasCheckpoint ? 'Already honored (before checkpoint)' : 'Before system start'}`);
      }
    });
    
    if (allRecords.length === 0) {
      if (totalRecords > 0) {
        console.log(`   ❌ INELIGIBLE: No records passed the date filter (0 out of ${totalRecords})`);
      }
      return { eligible: false };
    }
    
    console.log(`   ✅ Accepted records: ${allRecords.length} out of ${totalRecords}`);
    console.log(`   📦 Carried over from previous: ${carriedOverCount}`);
    console.log(`   📊 Total available: ${allRecords.length} + ${carriedOverCount} = ${allRecords.length + carriedOverCount}`);
    
    // Sort by displayDate
    allRecords.sort((a, b) => {
      const dateA = normalizeDate(a.displayDate);
      const dateB = normalizeDate(b.displayDate);
      return dateA.localeCompare(dateB);
    });
    
    // Determine student type and required count based on the records
    let requiredCount = 0;
    let studentType = '';
    
    if (allRecords.length > 0 && allRecords[0].type === 'juz') {
      requiredCount = 2;
      studentType = 'جزآن';
    } else if (allRecords.length > 0) {
      // Determine based on latest hizb number
      const latestHizbNumber = allRecords[allRecords.length - 1].hizbNumber || 0;
      
      if (latestHizbNumber >= 1 && latestHizbNumber <= 15) {
        requiredCount = 1;
        studentType = 'حزب واحد (الناس)';
      } else if (latestHizbNumber >= 16 && latestHizbNumber <= 60) {
        requiredCount = 2;
        studentType = 'حزبان (يس)';
      }
    } else if (carriedOverCount > 0) {
      // No new records but has carried over - use checkpoint info
      requiredCount = (checkpoint.checkpointType === 'juz') ? 2 : 
                     (checkpoint.checkpointType === 'hizb-nas') ? 1 : 2;
      studentType = (checkpoint.checkpointType === 'juz') ? 'جزآن' :
                   (checkpoint.checkpointType === 'hizb-nas') ? 'حزب واحد (الناس)' : 'حزبان (يس)';
    }
    
    console.log(`   📊 Required: ${requiredCount} ${studentType}, New: ${allRecords.length}, Carried: ${carriedOverCount}`);
    
    // Calculate total with carried over count
    const totalAvailable = allRecords.length + carriedOverCount;
    
    // Check if completed the required count (including carried over)
    if (totalAvailable < requiredCount) {
      console.log(`   ❌ INELIGIBLE: Not enough (need ${requiredCount}, have ${totalAvailable} = ${allRecords.length} new + ${carriedOverCount} carried)`);
      return { eligible: false };
    }
    
    // Handle extra achievements (carry over to next months)
    // 
    // CARRIED OVER LOGIC:
    // ===================
    // If student has carriedOverCount > 0, they already have partial progress
    // Example: requiredCount=2, carriedOverCount=1, newRecords=1
    //   → First nomination uses: 1 carried + 1 new = complete!
    //   → eligibleMonth = month of the 1 new record
    // 
    // Example: requiredCount=2, carriedOverCount=1, newRecords=3
    //   → Nomination 1: 1 carried + 1 new (first record)
    //   → Nomination 2: 2 new (records 2+3)
    //
    // Example: requiredCount=2, carriedOverCount=0, newRecords=4
    //   → Nomination 1: 2 new (records 1+2)
    //   → Nomination 2: 2 new (records 3+4)
    
    const eligibleNominations = [];
    
    console.log(`   📅 Creating nominations (with carried over: ${carriedOverCount})...`);
    
    let currentCarriedOver = carriedOverCount;
    let recordIndex = 0;
    
    while (recordIndex < allRecords.length || currentCarriedOver >= requiredCount) {
      // Calculate how many new records needed for this nomination
      const neededFromNew = Math.max(0, requiredCount - currentCarriedOver);
      
      console.log(`   🔄 Nomination attempt: need ${neededFromNew} from new (carried: ${currentCarriedOver})`);
      
      // Check if we have enough records
      if (recordIndex + neededFromNew > allRecords.length) {
        // Not enough new records, save as carried over for next time
        const remaining = currentCarriedOver + (allRecords.length - recordIndex);
        console.log(`   💾 Not enough for complete nomination. Carrying over: ${remaining}`);
        break;
      }
      
      // Get the records for this nomination
      const nominationRecords = allRecords.slice(recordIndex, recordIndex + neededFromNew);
      const completionRecord = nominationRecords.length > 0 ? 
                              nominationRecords[nominationRecords.length - 1] : 
                              null;
      
      // Determine eligible month
      let eligibleMonth;
      if (completionRecord) {
        // Has new records: use completion month of last new record
        eligibleMonth = extractMonth(completionRecord.displayDate);
      } else {
        // Only carried over (no new records), shouldn't happen after check above
        console.log(`   ⚠️ ERROR: No completion record found`);
        break;
      }
      
      // Adjust for sequential months (nominations in different months should be sequential)
      if (eligibleNominations.length > 0) {
        const previousNomination = eligibleNominations[eligibleNominations.length - 1];
        const nextMonthAfterPrevious = addMonthsToHijri(previousNomination.eligibleMonth, 1);
        
        // Use whichever is later: actual completion month or next month after previous
        if (eligibleMonth < nextMonthAfterPrevious) {
          eligibleMonth = nextMonthAfterPrevious;
        }
      }
      
      console.log(`   ✅ Nomination #${eligibleNominations.length + 1}:`);
      console.log(`      • Carried over used: ${Math.min(currentCarriedOver, requiredCount)}`);
      console.log(`      • New records used: ${neededFromNew}`);
      console.log(`      • Completion Month: ${eligibleMonth}`);
      console.log(`      • Eligible Month: ${eligibleMonth}`);
      
      eligibleNominations.push({
        records: nominationRecords,
        completionRecord: completionRecord,
        eligibleMonth: eligibleMonth,
        nominationIndex: eligibleNominations.length,
        usedCarriedOver: Math.min(currentCarriedOver, requiredCount)
      });
      
      // Update counters
      currentCarriedOver = Math.max(0, currentCarriedOver - requiredCount);
      recordIndex += neededFromNew;
    }
    
    // Calculate remaining carried over
    const newCarriedOver = currentCarriedOver + (allRecords.length - recordIndex);
    console.log(`   💾 New carried over for next time: ${newCarriedOver}`);
    
    // Return empty array if no complete nominations
    if (eligibleNominations.length === 0) {
      console.log(`   ❌ No complete nominations (will carry over ${newCarriedOver})`);
      return [];
    }
    
    // Find the BEST record across ALL records (for tiebreaker)
    let globalBestRecord = allRecords.length > 0 ? allRecords[0] : null;
    if (globalBestRecord) {
      for (let i = 1; i < allRecords.length; i++) {
        const current = allRecords[i];
        
        // Compare attempts first
        if (current.attemptsCount < globalBestRecord.attemptsCount) {
          globalBestRecord = current;
        } else if (current.attemptsCount === globalBestRecord.attemptsCount) {
          // If attempts are equal, compare duration
          if (current.duration < globalBestRecord.duration) {
            globalBestRecord = current;
          }
        }
      }
      
      console.log(`   🏆 Global Best Record (for tiebreaker across all achievements):`);
      console.log(`      • Type: ${globalBestRecord.type === 'hizb' ? 'حزب' : 'جزء'}`);
      console.log(`      • Number: ${globalBestRecord.type === 'hizb' ? globalBestRecord.hizbNumber : globalBestRecord.juzNumber}`);
      console.log(`      • Attempts: ${globalBestRecord.attemptsCount}`);
      console.log(`      • Duration: ${globalBestRecord.duration} days`);
    }    
    // Create eligibility object for EACH nomination
    const results = [];
    
    for (let i = 0; i < eligibleNominations.length; i++) {
      const nomination = eligibleNominations[i];
      const eligibleMonth = nomination.eligibleMonth;
      const completionRecord = nomination.completionRecord;
      
      console.log(`\n   📊 Processing Nomination #${i + 1} for Month: ${eligibleMonth}...`);
      console.log(`      • Student ID: ${studentId}`);
      console.log(`      • Eligible Month: ${eligibleMonth}`);
      
      // Get exam score from pre-loaded map (exam MUST be in the eligibility month)
      const examKey = `${studentId}_${eligibleMonth}`;
      const monthExams = examsByStudentMonth[examKey] || [];
      
      console.log(`      • Exam key: ${examKey}`);
      console.log(`      • Found exams: ${monthExams.length}`);
      
      let examScore = 0;
      let hasExamScore = false;
      let examDetails = null;
      
      if (monthExams.length > 0) {
        // Sort by creation time (most recent first)
        const sortedExams = monthExams.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        
        const examData = sortedExams[0];
        const originalScore = examData.score || 0;
        
        console.log(`      • Most recent exam data:`, {
          score: originalScore,
          hijriMonth: examData.hijriMonth,
          createdAt: examData.createdAt?.toDate?.()?.toLocaleString('ar-SA') || 'N/A'
        });
        
        // Calculate exam score (out of 50)
        examScore = originalScore / 2;
        hasExamScore = true;
        
        examDetails = {
          originalScore: originalScore,
          calculatedScore: examScore,
          hijriMonth: examData.hijriMonth
        };
        
        console.log(`      • Original score: ${originalScore}/100`);
        console.log(`      • Calculated score: ${examScore}/50`);
      } else {
        console.log(`      • ❌ No exam found for this month`);
      }
      
      const totalScore = 50 + examScore;
      
      console.log(`   🎯 ELIGIBLE! Month: ${eligibleMonth}, Type: ${studentType}, Total Score: ${totalScore}`);
      
      // Calculate new carried over for THIS nomination
      // After this nomination is honored, what will be the new carried over?
      const nominationsProcessed = i + 1;
      const recordsUsedSoFar = nominationsProcessed * requiredCount - carriedOverCount;
      const nominationCarriedOver = Math.max(0, allRecords.length - recordsUsedSoFar);
      
      results.push({
        eligible: true,
        studentId: studentId,
        studentName: studentName,
        teacherId: teacherId,
        teacherName: teacherName,
        type: studentType,
        requiredCount: requiredCount,
        completedCount: nomination.records.length,
        eligibleMonth: eligibleMonth,
        eligibleDate: completionRecord.displayDate,
        completionScore: 50,
        examScore: examScore,
        totalScore: totalScore,
        hasExamScore: hasExamScore,
        examDetails: examDetails,
        bestAttempts: globalBestRecord ? globalBestRecord.attemptsCount : 1,
        bestDuration: globalBestRecord ? globalBestRecord.duration : 0,
        bestRecordType: globalBestRecord ? globalBestRecord.type : studentType.includes('جزء') ? 'juz' : 'hizb',
        bestRecordNumber: globalBestRecord ? (globalBestRecord.type === 'hizb' ? globalBestRecord.hizbNumber : globalBestRecord.juzNumber) : 0,
        lastNumber: completionRecord ? (completionRecord.hizbNumber || completionRecord.juzNumber || 0) : 0,
        totalAchievements: allRecords.length,
        nominationIndex: i,
        totalNominations: eligibleNominations.length,
        carriedOverCount: nominationCarriedOver, // Will be saved to checkpoint
        checkpointType: studentType.includes('جزء') ? 'juz' : 
                        studentType.includes('الناس') ? 'hizb-nas' : 'hizb-yas'
      });
    }
    
    console.log(`   ============================================\n`);
    
    return results;
    
  } catch (error) {
    console.error(`❌ Error calculating eligibility for ${studentName}:`, error);
    return [];
  }
}

/**
 * Calculate student eligibility - OLD VERSION (kept for reference, not used)
 */
async function calculateStudentEligibility(studentId, studentName, teacherId, teacherName) {
  try {
    // Check for existing checkpoint
    const checkpointDoc = await getDoc(doc(db, 'studentHonorCheckpoints', studentId));
    const lastCheckpointDate = checkpointDoc.exists() ? checkpointDoc.data().lastHonorDate : '0';
    
    // Get all hizbs for student (then filter in JS to avoid index requirement)
    const hizbQuery = query(
      collection(db, 'hizbDisplays'),
      where('studentId', '==', studentId)
    );
    const hizbSnapshot = await getDocs(hizbQuery);
    
    // Get all juz for student (then filter in JS to avoid index requirement)
    const juzQuery = query(
      collection(db, 'juzDisplays'),
      where('studentId', '==', studentId)
    );
    const juzSnapshot = await getDocs(juzQuery);
    
    // Collect all records and filter in JavaScript
    const allRecords = [];
    
    // Filter hizbs: completed and after checkpoint
    hizbSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed' && (data.displayDate || '') > lastCheckpointDate) {
        allRecords.push({ ...data, type: 'hizb' });
      }
    });
    
    // Filter juz: completed and after checkpoint
    juzSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed' && (data.displayDate || '') > lastCheckpointDate) {
        allRecords.push({ ...data, type: 'juz' });
      }
    });
    
    if (allRecords.length === 0) {
      return { eligible: false };
    }
    
    // Sort by displayDate
    allRecords.sort((a, b) => {
      const dateA = normalizeDate(a.displayDate);
      const dateB = normalizeDate(b.displayDate);
      return dateA.localeCompare(dateB);
    });
    
    // Determine student type and required count
    let requiredCount = 0;
    let studentType = '';
    
    if (allRecords[0].type === 'juz') {
      // Student is doing juz
      requiredCount = 2;
      studentType = 'جزآن';
    } else {
      // Student is doing hizb - determine based on last hizb number
      const latestHizbNumber = allRecords[allRecords.length - 1].hizbNumber || 0;
      
      if (latestHizbNumber >= 1 && latestHizbNumber <= 15) {
        requiredCount = 1;
        studentType = 'حزب واحد (الناس)';
      } else if (latestHizbNumber >= 16 && latestHizbNumber <= 60) {
        requiredCount = 2;
        studentType = 'حزبان (يس)';
      }
    }
    
    // Check if student has completed required count
    if (allRecords.length < requiredCount) {
      return { eligible: false };
    }
    
    // Get the record that completed the requirement
    const completionRecord = allRecords[requiredCount - 1];
    const eligibleMonth = extractMonth(completionRecord.displayDate);
    
    // Get exam score for this month (avoid index requirement by filtering in JS)
    const examQuery = query(
      collection(db, 'monthlyExams'),
      where('studentId', '==', studentId)
    );
    const examSnapshot = await getDocs(examQuery);
    
    let examScore = 0;
    let hasExamScore = false;
    
    // Filter by month and get latest in JavaScript
    const monthExams = [];
    examSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.hijriMonth === eligibleMonth) {
        monthExams.push({ id: doc.id, ...data });
      }
    });
    
    // Sort by createdAt and get latest
    if (monthExams.length > 0) {
      monthExams.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA; // descending
      });
      
      const examData = monthExams[0];
      examScore = (examData.score || 0) / 2;  // Convert from 100 to 50
      hasExamScore = true;
    }
    
    const totalScore = 50 + examScore;
    
    return {
      eligible: true,
      studentId: studentId,
      studentName: studentName,
      teacherId: teacherId,
      teacherName: teacherName,
      type: studentType,
      requiredCount: requiredCount,
      completedCount: allRecords.length,
      eligibleMonth: eligibleMonth,
      eligibleDate: completionRecord.displayDate,
      completionScore: 50,
      examScore: examScore,
      totalScore: totalScore,
      hasExamScore: hasExamScore,
      lastNumber: completionRecord.hizbNumber || completionRecord.juzNumber || 0
    };
    
  } catch (error) {
    console.error(`Error calculating eligibility for ${studentName}:`, error);
    return { eligible: false };
  }
}

/**
 * Normalize date format
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '0000-00-00';
  
  // If date is in DD/MM/YYYY format, convert to YYYY-MM-DD
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  
  // If date is in YYYY-MM-DD format, ensure padding
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  
  return dateStr;
}

/**
 * Convert Hijri date to Gregorian date string (YYYY-MM-DD)
 * @param {string} hijriDate - Hijri date in YYYY-MM-DD format (e.g., "1448-02-15")
 * @returns {string} - Gregorian date in YYYY-MM-DD format (e.g., "2026-08-01")
 */
function hijriToGregorianString(hijriDate) {
  if (!hijriDate) return '0000-00-00';
  
  try {
    // Normalize the Hijri date format (ensure padding)
    const normalizedHijri = normalizeDate(hijriDate);
    
    // Convert to Gregorian using accurateHijriToGregorian
    const gregorianDateObj = accurateHijriToGregorian(normalizedHijri);
    
    // Convert Date object to YYYY-MM-DD string
    const year = gregorianDateObj.getFullYear();
    const month = String(gregorianDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(gregorianDateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error(`Error converting Hijri date ${hijriDate}:`, error);
    return '0000-00-00';
  }
}

/**
 * Extract month from date
 */
function extractMonth(dateStr) {
  const normalized = normalizeDate(dateStr);
  const parts = normalized.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return '';
}

/**
 * Calculate days between two Hijri dates
 * @param {string} startDate - Hijri date in YYYY-MM-DD format
 * @param {string} endDate - Hijri date in YYYY-MM-DD format
 * @returns {number} - Number of days between the dates
 */
function calculateDaysBetween(startDate, endDate) {
  try {
    // Convert both Hijri dates to Gregorian
    const startGregorian = hijriToGregorianString(startDate);
    const endGregorian = hijriToGregorianString(endDate);
    
    if (!startGregorian || !endGregorian) {
      return 0;
    }
    
    // Parse dates
    const start = new Date(startGregorian);
    const end = new Date(endGregorian);
    
    // Calculate difference in milliseconds
    const diffMs = end - start;
    
    // Convert to days
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Return 0 if negative
  } catch (error) {
    console.error('Error calculating days between:', error);
    return 0;
  }
}

/**
 * Update nominees statistics
 */
function updateNomineesStatistics() {
  // Use filteredNominees to reflect current filter state
  const total = filteredNominees.length;
  const withScores = filteredNominees.filter(n => n.hasExamScore).length;
  const waiting = total - withScores;
  
  document.getElementById('totalNominees').textContent = total;
  document.getElementById('nomineesWithScores').textContent = withScores;
  document.getElementById('nomineesWaiting').textContent = waiting;
}

/**
 * Filter nominees
 */
window.filterNominees = function() {
  const monthFilter = document.getElementById('honorFilterMonth').value;
  const classFilter = document.getElementById('honorFilterClass').value;
  
  filteredNominees = allNominees.filter(nominee => {
    if (monthFilter && nominee.eligibleMonth !== monthFilter) return false;
    if (classFilter && nominee.teacherId !== classFilter) return false;
    return true;
  });
  
  displayNominees();
};

/**
 * Display nominees
 */
function displayNominees() {
  const container = document.getElementById('nomineesTableContainer');
  if (!container) return;
  
  if (filteredNominees.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا يوجد طلاب مرشحين</p>';
    return;
  }
  
  // Sort by multiple criteria (total score, then best attempts, then best duration)
  filteredNominees.sort((a, b) => {
    // 1. Total score (descending - higher is better)
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    // 2. Best attempts (ascending - fewer is better)
    if (a.bestAttempts !== b.bestAttempts) {
      return a.bestAttempts - b.bestAttempts;
    }
    
    // 3. Best duration (ascending - shorter is better)
    if (a.bestDuration !== b.bestDuration) {
      return a.bestDuration - b.bestDuration;
    }
    
    // 4. Same rank if all criteria are equal
    return 0;
  });
  
  // Check if there are any extra nominations
  const hasWaitingExams = filteredNominees.some(n => !n.hasExamScore);
  
  let tableHTML = '';
  
  // Add warning box if there are students waiting for exam scores
  if (hasWaitingExams) {
    const waitingCount = filteredNominees.filter(n => !n.hasExamScore).length;
    tableHTML += `
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; border-right: 4px solid #ffc107;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">⚠️</span>
          <div>
            <div style="font-weight: bold; color: #856404; margin-bottom: 3px;">⏳ تنبيه: طلاب بانتظار درجة الاختبار</div>
            <div style="font-size: 13px; color: #856404;">
              يوجد <strong>${waitingCount}</strong> طالب لم يتم رصد درجة الاختبار الشهري لهم (خلفية صفراء). <strong>لن يتم تكريمهم</strong> حتى يتم رصد الدرجة.
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  tableHTML += `
    <div style="overflow-x: auto;">
      <table class="keep-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 12px; text-align: right;">الطالب</th>
            <th style="padding: 12px; text-align: center;">المعلم</th>
            <th style="padding: 12px; text-align: center;">النوع</th>
            <th style="padding: 12px; text-align: center;">الشهر</th>
            <th style="padding: 12px; text-align: center;">الإنجاز (50)</th>
            <th style="padding: 12px; text-align: center;">الاختبار (50)</th>
            <th style="padding: 12px; text-align: center; font-weight: bold;">المجموع</th>
            <th style="padding: 12px; text-align: center; font-size: 12px;" title="أفضل عدد محاولات">🔄 المحاولات</th>
            <th style="padding: 12px; text-align: center; font-size: 12px;" title="أقصر مدة إنجاز">⏱️ المدة</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  filteredNominees.forEach((nominee, index) => {
    // Determine row background color and style
    let bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
    let rowStyle = '';
    let warningIcon = '';
    
    // Special styling for students without exam scores
    if (!nominee.hasExamScore) {
      bgColor = '#fff3cd'; // Yellow warning background
      rowStyle = 'border-right: 4px solid #ffc107;'; // Yellow left border
      warningIcon = '<span style="color: #ffc107; font-size: 16px; margin-left: 5px;" title="⚠️ لن يتم تكريم هذا الطالب حتى يتم رصد درجة الاختبار الشهري">⚠️</span>';
    }
    
    // Exam score display with original score in tooltip
    let examStatus = '';
    if (nominee.hasExamScore) {
      const originalScore = nominee.examDetails?.originalScore || (nominee.examScore * 2);
      examStatus = `<span style="color: #28a745; font-weight: bold;" title="الدرجة الأصلية: ${originalScore.toFixed(2)}/100">${nominee.examScore.toFixed(2)}</span>
                    <div style="font-size: 10px; color: #666; margin-top: 2px;">(${originalScore.toFixed(2)}/100)</div>`;
    } else {
      examStatus = `<span style="color: #ffc107; font-weight: bold;">⏳ انتظار</span>
                    <div style="font-size: 10px; color: #856404; margin-top: 2px; font-weight: bold;">لن يتكرم</div>`;
    }
    
    const totalDisplay = nominee.hasExamScore ? 
      `<span style="font-size: 16px; font-weight: bold; color: #667eea;">${nominee.totalScore.toFixed(2)}</span>` :
      `<span style="color: #999;">-</span>`;
    
    // Attempts display with color coding
    let attemptsColor = '#28a745'; // Green for 1
    if (nominee.bestAttempts === 2) attemptsColor = '#ffc107'; // Yellow for 2
    else if (nominee.bestAttempts >= 3) attemptsColor = '#dc3545'; // Red for 3+
    
    const attemptsDisplay = `<span style="background: ${attemptsColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;" title="أفضل إنجاز: ${nominee.bestRecordType === 'hizb' ? 'حزب' : 'جزء'} رقم ${nominee.bestRecordNumber}">${nominee.bestAttempts}</span>`;
    
    // Duration display
    const durationDisplay = `<span style="color: #764ba2; font-weight: bold;" title="المدة المستغرقة لأفضل إنجاز">${nominee.bestDuration} يوم</span>`;
    
    tableHTML += `
      <tr style="background: ${bgColor}; ${rowStyle}" title="${!nominee.hasExamScore ? '⚠️ هذا الطالب لن يتم تكريمه حتى يتم رصد درجة الاختبار الشهري' : ''}">
        <td style="padding: 10px; border: 1px solid #dee2e6;">${nominee.studentName}${warningIcon}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${nominee.teacherName}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${nominee.type}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${nominee.eligibleMonth}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #28a745; font-weight: bold;">50.0</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${examStatus}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${totalDisplay}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${attemptsDisplay}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${durationDisplay}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table></div>';
  
  container.innerHTML = tableHTML;
  
  // Update statistics after displaying
  updateNomineesStatistics();
}

/**
 * Select Top 30 Students
 */
window.selectTop30 = async function() {
  if (allNominees.length === 0) {
    alert('⚠️ لا يوجد مرشحين! يرجى تحميل البيانات أولاً.');
    return;
  }
  
  // Get unique months from all nominees
  const uniqueMonths = [...new Set(allNominees.map(n => n.eligibleMonth))].sort();
  
  if (uniqueMonths.length === 0) {
    alert('⚠️ لا يوجد أشهر متاحة للتكريم!');
    return;
  }
  
  // Ask user to select month
  let monthMessage = 'اختر الشهر المراد تكريمه:\n\n';
  uniqueMonths.forEach((month, index) => {
    monthMessage += `${index + 1}. ${month}\n`;
  });
  monthMessage += '\nأدخل رقم الشهر:';
  
  const monthChoice = prompt(monthMessage);
  if (!monthChoice) return;
  
  const monthIndex = parseInt(monthChoice) - 1;
  if (monthIndex < 0 || monthIndex >= uniqueMonths.length) {
    alert('⚠️ اختيار خاطئ!');
    return;
  }
  
  const selectedMonth = uniqueMonths[monthIndex];
  
  // Filter nominees by selected month
  const monthNominees = allNominees.filter(n => n.eligibleMonth === selectedMonth);
  
  // Filter only nominees with exam scores
  const nomineesWithScores = monthNominees.filter(n => n.hasExamScore);
  const nomineesWithoutScores = monthNominees.filter(n => !n.hasExamScore);
  
  if (nomineesWithScores.length === 0) {
    alert(`⚠️ لا يوجد مرشحين لديهم درجات اختبار في شهر ${selectedMonth}!`);
    return;
  }
  
  let confirmMessage = `هل أنت متأكد من اختيار أفضل 30 طالب لشهر ${selectedMonth}؟\n\n`;
  confirmMessage += `✅ سيتم اختيار من بين: ${nomineesWithScores.length} طالب (لديهم درجات اختبار)\n`;
  
  if (nomineesWithoutScores.length > 0) {
    confirmMessage += `⚠️ تم استبعاد: ${nomineesWithoutScores.length} طالب (بانتظار درجة الاختبار)\n\n`;
  } else {
    confirmMessage += `\n`;
  }
  
  confirmMessage += `سيتم:\n- حفظ قائمة المكرمين\n- منح الحوافز للمعلمين تلقائياً\n- إنشاء نقاط تصفير للطلاب`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  try {
    // Sort by multiple criteria (same as display)
    nomineesWithScores.sort((a, b) => {
      // 1. Total score (descending)
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      
      // 2. Best attempts (ascending - fewer is better)
      if (a.bestAttempts !== b.bestAttempts) {
        return a.bestAttempts - b.bestAttempts;
      }
      
      // 3. Best duration (ascending - shorter is better)
      if (a.bestDuration !== b.bestDuration) {
        return a.bestDuration - b.bestDuration;
      }
      
      return 0;
    });
    
    // Select top 30
    const winners = nomineesWithScores.slice(0, 30);
    
    console.log(`🏆 Selecting top ${winners.length} students for ${selectedMonth}...`);
    
    // Save honored students and grant incentives
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const rank = i + 1;
      
      // Save to honoredStudents collection
      await addDoc(collection(db, 'honoredStudents'), {
        studentId: winner.studentId,
        studentName: winner.studentName,
        teacherId: winner.teacherId,
        teacherName: winner.teacherName,
        type: winner.type,
        requiredCount: winner.requiredCount,
        completedCount: winner.completedCount,
        completionScore: winner.completionScore,
        examScore: winner.examScore,
        totalScore: winner.totalScore,
        rank: rank,
        honorMonth: selectedMonth,
        eligibleDate: winner.eligibleDate,
        createdAt: serverTimestamp()
      });
      
      // Create checkpoint (use last day of honored month, not last achievement date)
      const checkpointDate = getLastDayOfHijriMonth(selectedMonth);
      await setDoc(doc(db, 'studentHonorCheckpoints', winner.studentId), {
        lastHonorDate: checkpointDate,
        lastHonorMonth: selectedMonth,
        lastCompletedNumber: winner.lastNumber,
        checkpointType: winner.checkpointType || 'hizb-yas',
        carriedOverCount: winner.carriedOverCount || 0,
        updatedAt: serverTimestamp()
      });
      
      // Grant teacher incentive
      await addDoc(collection(db, 'teacherIncentives'), {
        teacherId: winner.teacherId,
        teacherName: winner.teacherName,
        type: 'honor',
        amount: 20,
        studentId: winner.studentId,
        studentName: winner.studentName,
        rank: rank,
        reason: `تكريم طالب في قائمة الأوائل - المرتبة ${rank}`,
        month: selectedMonth,
        createdAt: serverTimestamp(),
        autoGenerated: true
      });
      
      console.log(`✅ Honored ${rank}. ${winner.studentName} - ${winner.totalScore} pts`);
    }
    
    // Reset checkpoints for all remaining nominees who completed requirements but weren't honored
    console.log(`\n🔄 Resetting checkpoints for non-winners who completed requirements...`);
    
    // Get unique student IDs from all nominees with scores in this month
    const allStudentIdsInMonth = new Map();
    nomineesWithScores.forEach(nominee => {
      if (!allStudentIdsInMonth.has(nominee.studentId)) {
        allStudentIdsInMonth.set(nominee.studentId, nominee);
      }
    });
    
    // Get winner IDs for exclusion
    const winnerIds = new Set(winners.map(w => w.studentId));
    
    // Reset checkpoints for non-winners
    let resetCount = 0;
    for (const [studentId, nominee] of allStudentIdsInMonth.entries()) {
      // Skip if this student was a winner
      if (winnerIds.has(studentId)) {
        continue;
      }
      
      // Create checkpoint for this student (use last day of month, not last achievement date)
      const checkpointDate = getLastDayOfHijriMonth(selectedMonth);
      await setDoc(doc(db, 'studentHonorCheckpoints', studentId), {
        lastHonorDate: checkpointDate,
        lastHonorMonth: selectedMonth,
        lastCompletedNumber: nominee.lastNumber,
        checkpointType: nominee.checkpointType || 'hizb-yas',
        carriedOverCount: nominee.carriedOverCount || 0,
        updatedAt: serverTimestamp()
      });
      
      resetCount++;
      console.log(`   ↻ Reset checkpoint for ${nominee.studentName} (non-winner)`);
    }
    
    console.log(`✅ Reset ${resetCount} checkpoints for non-winners`);
    
    let successMessage = `✅ تم تكريم ${winners.length} طالب بنجاح في شهر ${selectedMonth}!\n\n`;
    successMessage += `📊 الإحصائيات:\n`;
    successMessage += `- المكرّمون (أفضل 30): ${winners.length} طالب\n`;
    successMessage += `- تم تصفير عداداتهم: ${resetCount} طالب (أكملوا المطلوب لكن لم يكرموا)\n`;
    successMessage += `- تم منح الحوافز للمعلمين\n\n`;
    successMessage += `💡 ملاحظة: الإنجازات الإضافية محفوظة للأشهر القادمة`;
    
    alert(successMessage);
    
    // Reload honored months
    await loadHonoredMonths();
    
    // Reload nominees to reflect checkpoint changes
    console.log('🔄 Reloading nominees after honor ceremony...');
    await window.loadNominees();
    
    // Switch to honored tab
    window.switchHonorTab('honored');
    
  } catch (error) {
    console.error('Error selecting top 30:', error);
    alert('❌ حدث خطأ في عملية التكريم');
  }
};

/**
 * Load Honored Students
 */
window.loadHonoredStudents = async function() {
  const monthSelect = document.getElementById('honoredMonthSelect');
  const container = document.getElementById('honoredTableContainer');
  
  // Mark as loaded so auto-load doesn't trigger again
  honoredDataLoaded = true;
  
  if (!monthSelect || !container) return;
  
  const selectedMonth = monthSelect.value;
  
  if (!selectedMonth) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">اختر شهر التكريم لعرض القائمة...</p>';
    return;
  }
  
  container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري تحميل قائمة المكرمين...</p>';
  
  try {
    // Get honored students for month (then sort in JS to avoid index requirement)
    const honoredQuery = query(
      collection(db, 'honoredStudents'),
      where('honorMonth', '==', selectedMonth)
    );
    
    const honoredSnapshot = await getDocs(honoredQuery);
    
    if (honoredSnapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد قائمة تكريم لهذا الشهر</p>';
      return;
    }
    
    allHonored = [];
    honoredSnapshot.forEach(doc => {
      allHonored.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by rank in JavaScript
    allHonored.sort((a, b) => (a.rank || 0) - (b.rank || 0));
    
    displayHonoredStudents();
    
  } catch (error) {
    console.error('Error loading honored students:', error);
    container.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 40px;">❌ حدث خطأ في تحميل القائمة</p>';
  }
};

/**
 * Display honored students
 */
function displayHonoredStudents() {
  const container = document.getElementById('honoredTableContainer');
  if (!container || allHonored.length === 0) return;
  
  let tableHTML = `
    <div style="overflow-x: auto;">
      <table class="keep-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333;">
            <th style="padding: 12px; text-align: center; font-weight: bold;">🏆 المرتبة</th>
            <th style="padding: 12px; text-align: right;">الطالب</th>
            <th style="padding: 12px; text-align: center;">المعلم</th>
            <th style="padding: 12px; text-align: center;">النوع</th>
            <th style="padding: 12px; text-align: center;">المجموع</th>
            <th style="padding: 12px; text-align: center;">الحافز</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  allHonored.forEach((student, index) => {
    const bgColor = index % 2 === 0 ? '#fffef0' : 'white';
    
    // Medal for top 3
    let medalIcon = '';
    if (student.rank === 1) medalIcon = '🥇';
    else if (student.rank === 2) medalIcon = '🥈';
    else if (student.rank === 3) medalIcon = '🥉';
    
    tableHTML += `
      <tr style="background: ${bgColor};">
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 18px; font-weight: bold;">${medalIcon} ${student.rank}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; font-weight: bold;">${student.studentName}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${student.teacherName}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${student.type}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 16px; font-weight: bold; color: #667eea;">${student.totalScore.toFixed(1)}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #28a745; font-weight: bold;">20 ريال</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table></div>';
  
  container.innerHTML = tableHTML;
}

/**
 * Export Honored Students to PDF
 */
/**
 * Export Nominees to PDF - grouped by teacher
 */
window.exportNomineesPDF = async function() {
  if (allNominees.length === 0) {
    alert('⚠️ لا توجد بيانات للتصدير! يرجى تحميل المرشحين أولاً.');
    return;
  }
  
  try {
    // Get current Hijri month name
    const currentHijriData = getCurrentHijriDate();
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const currentMonthName = hijriMonths[currentHijriData.hijriMonth - 1];
    const currentYear = currentHijriData.hijriYear;
    
    // Group nominees by teacher
    const nomineesByTeacher = {};
    allNominees.forEach(nominee => {
      const teacherName = nominee.teacherName || 'غير محدد';
      if (!nomineesByTeacher[teacherName]) {
        nomineesByTeacher[teacherName] = [];
      }
      nomineesByTeacher[teacherName].push(nominee);
    });
    
    // Sort teachers alphabetically
    const teacherNames = Object.keys(nomineesByTeacher).sort();
    
    // Create temporary container for PDF content
    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; background: white; padding: 40px; font-family: Arial, sans-serif;';
    
    // Build HTML content
    let htmlContent = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px;">
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 28px;">الطلاب المرشحين لشهر ${currentMonthName} ${currentYear} حتى الآن</h1>
        <p style="color: #666; margin: 0; font-size: 14px;">تم إنشاء التقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
      </div>
    `;
    
    // Add each teacher's section
    teacherNames.forEach((teacherName, index) => {
      const nominees = nomineesByTeacher[teacherName];
      
      // Sort nominees by multiple criteria (same as display)
      nominees.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (a.bestAttempts !== b.bestAttempts) return a.bestAttempts - b.bestAttempts;
        if (a.bestDuration !== b.bestDuration) return a.bestDuration - b.bestDuration;
        return 0;
      });
      
      htmlContent += `
        <div style="margin-bottom: 40px; ${index > 0 ? 'page-break-before: always;' : ''}">
          <h2 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; margin: 0 0 20px 0; border-radius: 8px; font-size: 20px;">
            ${teacherName}
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">#</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 14px; font-weight: bold;">اسم الطالب</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">النوع</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">الشهر</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">الاكمال</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">الاختبار</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 14px; font-weight: bold;">المجموع</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 13px; font-weight: bold;">المحاولات</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-size: 13px; font-weight: bold;">المدة</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      nominees.forEach((nominee, idx) => {
        // Extract month name from eligibleMonth (YYYY-MM format)
        const monthParts = nominee.eligibleMonth.split('-');
        const monthIndex = parseInt(monthParts[1]) - 1;
        const monthName = hijriMonths[monthIndex];
        
        htmlContent += `
          <tr style="${idx % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}">
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 13px;">${idx + 1}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 13px;">${nominee.studentName}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 13px;">${nominee.type}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 13px;">${monthName}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 13px;">${nominee.completionScore}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 13px;">${nominee.examScore.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 13px; font-weight: bold; color: #667eea;">${nominee.totalScore.toFixed(2)}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 12px;">${nominee.bestAttempts}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-size: 12px;">${nominee.bestDuration} يوم</td>
          </tr>
        `;
      });
      
      htmlContent += `
            </tbody>
          </table>
          
          <p style="text-align: right; color: #666; font-size: 13px; margin: 10px 0;">
            <strong>اجمالي المرشحين:</strong> ${nominees.length} طالب
          </p>
        </div>
      `;
    });
    
    // Add footer
    htmlContent += `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #999; font-size: 12px;">
        <p style="margin: 0;">نظام تكريم الأوائل - حلقات القرآن الكريم</p>
      </div>
    `;
    
    pdfContainer.innerHTML = htmlContent;
    document.body.appendChild(pdfContainer);
    
    // Generate PDF using html2canvas
    const canvas = await html2canvas(pdfContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    
    // Remove temporary container
    document.body.removeChild(pdfContainer);
    
    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Add image to PDF (handle multiple pages if needed)
    const pageHeight = 297; // A4 height in mm
    let heightLeft = imgHeight;
    let position = 0;
    
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    const fileName = `المرشحين_${currentMonthName}_${currentYear}_${new Date().getTime()}.pdf`;
    pdf.save(fileName);
    
    console.log('✅ PDF exported successfully');
    
  } catch (error) {
    console.error('❌ Error exporting PDF:', error);
    alert('حدث خطأ في تصدير PDF. يرجى المحاولة مرة أخرى.');
  }
};

/**
 * Export Honored Students to PDF
 */
window.exportHonoredPDF = async function() {
  if (allHonored.length === 0) {
    alert('⚠️ لا توجد بيانات للتصدير! يرجى تحميل قائمة التكريم أولاً.');
    return;
  }
  
  try {
    // Show loading message
    const container = document.getElementById('honoredTableContainer');
    const originalContent = container.innerHTML;
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px; font-size: 18px;">⏳ جاري إنشاء تقرير PDF...<br><small>يرجى الانتظار...</small></p>';
    
    // Get selected month name
    const monthSelect = document.getElementById('honoredMonthSelect');
    const selectedMonth = monthSelect.value; // e.g., "1448-02"
    
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    
    const [year, month] = selectedMonth.split('-');
    const monthIndex = parseInt(month) - 1;
    const monthName = hijriMonths[monthIndex];
    
    // Create temporary container for PDF content
    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 1000px; background: white; padding: 40px; font-family: Arial, sans-serif;';
    
    // Build HTML content
    let htmlContent = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #ffd700; padding-bottom: 20px;">
        <h1 style="color: #333; margin: 0; font-size: 24px; font-weight: bold; line-height: 1.6;">تكريم الطلاب الشهري لشهر ${monthName} ${year}هـ<br/>لطلاب حلقات جامع حمدة آل ثاني</h1>
      </div>
      
      <div style="overflow-x: auto; margin-top: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333;">
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 8%;">المرتبة</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 22%;">اسم الطالب</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 18%;">اسم المعلم</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 13%;">درجة الاختبار الشهري</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 13%;">الهدف المنجز</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 11%;">المجموع</th>
              <th style="padding: 12px; text-align: center; font-weight: bold; border: 2px solid #ddd; width: 15%;">المكافأة</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Add honored students
    allHonored.forEach((student, index) => {
      const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      
      // Medal for top 3
      let rankDisplay = student.rank;
      if (student.rank === 1) rankDisplay = '🥇 1';
      else if (student.rank === 2) rankDisplay = '🥈 2';
      else if (student.rank === 3) rankDisplay = '🥉 3';
      
      // Calculate reward based on rank
      let reward = 20; // Default for 26-30
      if (student.rank === 1) reward = 100;
      else if (student.rank === 2) reward = 85;
      else if (student.rank === 3) reward = 65;
      else if (student.rank === 4) reward = 55;
      else if (student.rank === 5) reward = 50;
      else if (student.rank >= 6 && student.rank <= 15) reward = 30;
      else if (student.rank >= 16 && student.rank <= 25) reward = 25;
      
      // Clean up type text (remove يس and الناس)
      let achievementText = student.type || '';
      achievementText = achievementText
        .replace(/\(يس\)/g, '')
        .replace(/\(الناس\)/g, '')
        .replace('يس', '')
        .replace('الناس', '')
        .trim();
      
      // Get exam score (stored as /50, multiply by 2 to get original /100)
      const examScore = (student.examScore || 0) * 2;
      
      htmlContent += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 16px; font-weight: bold;">${rankDisplay}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 14px;">${student.studentName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 13px;">${student.teacherName}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 14px; color: #28a745; font-weight: bold;">${examScore.toFixed(1)}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 13px;">${achievementText}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 15px; font-weight: bold; color: #667eea;">${student.totalScore.toFixed(1)}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 14px; color: #dc3545; font-weight: bold;">${reward} ريال</td>
        </tr>
      `;
    });
    
    htmlContent += `
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 2px solid #eee;">
        <p style="color: #666; font-size: 14px; margin: 0;">
          تم إنشاء التقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    `;
    
    pdfContainer.innerHTML = htmlContent;
    document.body.appendChild(pdfContainer);
    
    // Wait for fonts and styles to load
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate PDF using html2canvas
    const canvas = await html2canvas(pdfContainer, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    // Remove temporary container
    document.body.removeChild(pdfContainer);
    
    // Restore original content
    container.innerHTML = originalContent;
    
    // Create PDF with multiple pages if needed
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if content exceeds one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    const fileName = `المكرمون_${monthName}_${year}.pdf`;
    pdf.save(fileName);
    
    console.log('✅ PDF exported successfully');
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('❌ حدث خطأ في تصدير PDF');
    
    // Restore original content
    const container = document.getElementById('honoredTableContainer');
    if (container) {
      displayHonoredStudents();
    }
  }
};

// Initialize on load
console.log('✅ Honor System module loaded');

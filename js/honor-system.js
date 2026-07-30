// Honor System JavaScript - نظام تكريم الأوائل
import { db, collection, getDocs, addDoc, doc, getDoc, setDoc, query, where, serverTimestamp } from '../firebase-config.js';
import { getCurrentHijriDate } from './hijri-date.js';

// Global variables
let allNominees = [];
let filteredNominees = [];
let allHonored = [];

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
    allExamsSnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.studentId}_${data.hijriMonth}`;
      if (!examsByStudentMonth[key]) {
        examsByStudentMonth[key] = [];
      }
      examsByStudentMonth[key].push(data);
    });
    
    console.log('✅ Data maps built');
    
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
      
      // Calculate eligibility using pre-loaded maps
      const eligibility = calculateStudentEligibilityOptimized(
        studentId,
        studentName,
        teacherId,
        teacherName,
        checkpointsMap[studentId],
        hizbsByStudent[studentId] || [],
        juzByStudent[studentId] || [],
        examsByStudentMonth
      );
      
      if (eligibility.eligible) {
        allNominees.push(eligibility);
      }
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Total eligible nominees: ${allNominees.length}`);
    console.log(`⚡ Total processing time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    
    // Step 4: Update statistics
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري تحديث الإحصائيات... (4/5)</p>';
    updateNomineesStatistics();
    
    // Step 5: Display nominees
    container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">⏳ جاري عرض النتائج... (5/5)</p>';
    filteredNominees = [...allNominees];
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
 * Calculate student eligibility - OPTIMIZED (uses pre-loaded data)
 * 
 * New rules:
 * 1. Safar (1447-08) is the starting point for the first cycle
 * 2. Both lastLessonDate AND displayDate must be after the checkpoint/starting point
 * 3. After first honor, checkpoint becomes the new starting point (moving checkpoint)
 * 4. Extra achievements are carried over to next months automatically
 */
function calculateStudentEligibilityOptimized(studentId, studentName, teacherId, teacherName, checkpoint, studentHizbs, studentJuz, examsByStudentMonth) {
  try {
    // Determine the starting point
    // If no checkpoint exists, use Safar 1447-08 as the starting point
    // If checkpoint exists, use the last honor date (moving checkpoint)
    const SAFAR_START = '1447-08'; // Safar is the launch month
    const lastCheckpointDate = checkpoint?.lastHonorDate || '0';
    
    // For first cycle (no checkpoint), we need both registration and completion in/after Safar
    // For subsequent cycles, we use the checkpoint date
    const hasCheckpoint = checkpoint && checkpoint.lastHonorDate;
    const startingPoint = hasCheckpoint ? lastCheckpointDate : '0';
    
    // Filter records: both lastLessonDate and displayDate must be after starting point
    const allRecords = [];
    
    // Process hizbs
    studentHizbs.forEach(record => {
      const displayDate = record.displayDate || '';
      const lastLessonDate = record.lastLessonDate || '';
      const displayMonth = extractMonth(displayDate);
      const lessonMonth = extractMonth(lastLessonDate);
      
      // For first cycle: both must be in/after Safar
      // For subsequent cycles: both must be after checkpoint
      if (hasCheckpoint) {
        // Moving checkpoint: compare with last honor date
        if (displayDate > startingPoint && lastLessonDate > startingPoint) {
          allRecords.push({ ...record, type: 'hizb' });
        }
      } else {
        // First cycle: both must be in/after Safar (1447-08)
        if (displayMonth >= SAFAR_START && lessonMonth >= SAFAR_START) {
          allRecords.push({ ...record, type: 'hizb' });
        }
      }
    });
    
    // Process juz
    studentJuz.forEach(record => {
      const displayDate = record.displayDate || '';
      const lastLessonDate = record.lastLessonDate || '';
      const displayMonth = extractMonth(displayDate);
      const lessonMonth = extractMonth(lastLessonDate);
      
      if (hasCheckpoint) {
        if (displayDate > startingPoint && lastLessonDate > startingPoint) {
          allRecords.push({ ...record, type: 'juz' });
        }
      } else {
        if (displayMonth >= SAFAR_START && lessonMonth >= SAFAR_START) {
          allRecords.push({ ...record, type: 'juz' });
        }
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
    
    // Determine student type and required count based on the records
    let requiredCount = 0;
    let studentType = '';
    
    if (allRecords[0].type === 'juz') {
      requiredCount = 2;
      studentType = 'جزآن';
    } else {
      // Determine based on latest hizb number
      const latestHizbNumber = allRecords[allRecords.length - 1].hizbNumber || 0;
      
      if (latestHizbNumber >= 1 && latestHizbNumber <= 15) {
        requiredCount = 1;
        studentType = 'حزب واحد (الناس)';
      } else if (latestHizbNumber >= 16 && latestHizbNumber <= 60) {
        requiredCount = 2;
        studentType = 'حزبان (يس)';
      }
    }
    
    // Check if completed the required count
    if (allRecords.length < requiredCount) {
      return { eligible: false };
    }
    
    // Handle extra achievements (carry over to next months)
    // Example: if required is 1 but achieved 3, then:
    //   - 1st achievement = current month
    //   - 2nd achievement = next month (automatic)
    //   - 3rd achievement = month after next (automatic)
    
    const eligibleNominations = [];
    
    // Split achievements into groups based on required count
    for (let i = 0; i < allRecords.length; i += requiredCount) {
      const group = allRecords.slice(i, i + requiredCount);
      
      // Only add if this group has the full required count
      if (group.length === requiredCount) {
        const completionRecord = group[group.length - 1];
        const eligibleMonth = extractMonth(completionRecord.displayDate);
        
        eligibleNominations.push({
          records: group,
          completionRecord: completionRecord,
          eligibleMonth: eligibleMonth
        });
      }
    }
    
    // For now, return only the FIRST nomination (current month)
    // The extra nominations are implicitly stored for future months
    if (eligibleNominations.length === 0) {
      return { eligible: false };
    }
    
    const firstNomination = eligibleNominations[0];
    const eligibleMonth = firstNomination.eligibleMonth;
    const completionRecord = firstNomination.completionRecord;
    
    // Get exam score from pre-loaded map
    const examKey = `${studentId}_${eligibleMonth}`;
    const monthExams = examsByStudentMonth[examKey] || [];
    
    let examScore = 0;
    let hasExamScore = false;
    
    if (monthExams.length > 0) {
      const sortedExams = monthExams.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      const examData = sortedExams[0];
      examScore = (examData.score || 0) / 2;
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
      completedCount: firstNomination.records.length,
      eligibleMonth: eligibleMonth,
      eligibleDate: completionRecord.displayDate,
      completionScore: 50,
      examScore: examScore,
      totalScore: totalScore,
      hasExamScore: hasExamScore,
      lastNumber: completionRecord.hizbNumber || completionRecord.juzNumber || 0,
      totalAchievements: allRecords.length, // For future reference
      extraNominations: eligibleNominations.length - 1 // How many months ahead they're eligible
    };
    
  } catch (error) {
    console.error(`Error calculating eligibility for ${studentName}:`, error);
    return { eligible: false };
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
 * Update nominees statistics
 */
function updateNomineesStatistics() {
  const total = allNominees.length;
  const withScores = allNominees.filter(n => n.hasExamScore).length;
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
  
  // Sort by total score descending
  filteredNominees.sort((a, b) => b.totalScore - a.totalScore);
  
  // Check if there are any extra nominations
  const hasExtraNominations = filteredNominees.some(n => n.extraNominations && n.extraNominations > 0);
  
  let tableHTML = '';
  
  // Add info box if there are extra nominations
  if (hasExtraNominations) {
    tableHTML += `
      <div style="background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; border-right: 4px solid #f39c12;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">⚡</span>
          <div>
            <div style="font-weight: bold; color: #2d3436; margin-bottom: 3px;">📋 ملاحظة: إنجازات إضافية</div>
            <div style="font-size: 13px; color: #636e72;">
              بعض الطلاب أنجزوا أكثر من المطلوب في شهر واحد. الأرقام في عمود "⚡ إضافي" تعني عدد الشهور القادمة التي سيكونون مرشحين فيها تلقائياً!
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  tableHTML += `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 12px; text-align: right;">الطالب</th>
            <th style="padding: 12px; text-align: center;">المعلم</th>
            <th style="padding: 12px; text-align: center;">النوع</th>
            <th style="padding: 12px; text-align: center;">الشهر</th>
            <th style="padding: 12px; text-align: center;">الإنجاز (50)</th>
            <th style="padding: 12px; text-align: center;">الاختبار (50)</th>
            <th style="padding: 12px; text-align: center; font-weight: bold;">المجموع</th>
            <th style="padding: 12px; text-align: center; font-size: 12px;">⚡ إضافي</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  filteredNominees.forEach((nominee, index) => {
    const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
    const examStatus = nominee.hasExamScore ? 
      `<span style="color: #28a745; font-weight: bold;">${nominee.examScore.toFixed(1)}</span>` :
      `<span style="color: #ffc107;">⏳ انتظار</span>`;
    
    const totalDisplay = nominee.hasExamScore ? 
      `<span style="font-size: 16px; font-weight: bold; color: #667eea;">${nominee.totalScore.toFixed(1)}</span>` :
      `<span style="color: #999;">-</span>`;
    
    // Extra nominations display
    let extraDisplay = '';
    if (nominee.extraNominations && nominee.extraNominations > 0) {
      extraDisplay = `<span style="background: #ffc107; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;" title="يمكن ترشيحه ${nominee.extraNominations} شهر إضافي">+${nominee.extraNominations}</span>`;
    } else {
      extraDisplay = `<span style="color: #ccc;">-</span>`;
    }
    
    tableHTML += `
      <tr style="background: ${bgColor};">
        <td style="padding: 10px; border: 1px solid #dee2e6;">${nominee.studentName}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${nominee.teacherName}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${nominee.type}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${nominee.eligibleMonth}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #28a745; font-weight: bold;">50.0</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${examStatus}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${totalDisplay}</td>
        <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">${extraDisplay}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table></div>';
  
  container.innerHTML = tableHTML;
}

/**
 * Select Top 30 Students
 */
window.selectTop30 = async function() {
  if (allNominees.length === 0) {
    alert('⚠️ لا يوجد مرشحين! يرجى تحميل البيانات أولاً.');
    return;
  }
  
  // Filter only nominees with exam scores
  const nomineesWithScores = allNominees.filter(n => n.hasExamScore);
  
  if (nomineesWithScores.length === 0) {
    alert('⚠️ لا يوجد مرشحين لديهم درجات اختبار!');
    return;
  }
  
  if (!confirm(`هل أنت متأكد من اختيار أفضل 30 طالب؟\n\nسيتم:\n- حفظ قائمة المكرمين\n- منح الحوافز للمعلمين تلقائياً\n- إنشاء نقاط تصفير للطلاب`)) {
    return;
  }
  
  try {
    // Sort by total score descending
    nomineesWithScores.sort((a, b) => b.totalScore - a.totalScore);
    
    // Select top 30
    const winners = nomineesWithScores.slice(0, 30);
    
    console.log(`🏆 Selecting top ${winners.length} students...`);
    
    const currentHijriData = getCurrentHijriDate();
    const currentMonth = `${currentHijriData.hijriYear}-${String(currentHijriData.hijriMonth).padStart(2, '0')}`;
    
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
        honorMonth: currentMonth,
        honorYear: currentHijriData.hijriYear,
        eligibleDate: winner.eligibleDate,
        createdAt: serverTimestamp()
      });
      
      // Create checkpoint
      await setDoc(doc(db, 'studentHonorCheckpoints', winner.studentId), {
        lastHonorDate: winner.eligibleDate,
        lastHonorMonth: currentMonth,
        lastCompletedNumber: winner.lastNumber,
        checkpointType: winner.type,
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
        month: currentMonth,
        year: currentHijriData.hijriYear,
        createdAt: serverTimestamp(),
        autoGenerated: true
      });
      
      console.log(`✅ Honored ${rank}. ${winner.studentName} - ${winner.totalScore} pts`);
    }
    
    alert(`✅ تم تكريم ${winners.length} طالب بنجاح!\n\n- تم حفظ قائمة المكرمين\n- تم منح الحوافز للمعلمين\n- تم إنشاء نقاط التصفير`);
    
    // Reload honored months
    await loadHonoredMonths();
    
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
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
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
window.exportHonoredPDF = async function() {
  if (allHonored.length === 0) {
    alert('⚠️ لا توجد بيانات للتصدير! يرجى تحميل قائمة التكريم أولاً.');
    return;
  }
  
  alert('🚧 ميزة تصدير PDF قيد التطوير...');
  // TODO: Implement PDF export
};

// Initialize on load
console.log('✅ Honor System module loaded');

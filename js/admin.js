// Admin Section JavaScript
import { 
  db, 
  collection, 
  collectionGroup,
  getDocs,
  getDoc,
  doc,
  doc as firestoreDoc, 
  query, 
  where, 
  limit,
  setDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  deleteDoc,
  arrayRemove,
  deleteField,
  onSnapshot
} from '../firebase-config.js';

import { calculateRevisionPages } from './quran-juz-data.js';
import { formatHijriDate, gregorianToHijriDisplay, getHijriWeekAgo, getHijriMonthAgo, getStudyDaysInCurrentHijriMonth, getStudyDaysForHijriMonth, getTodayForStorage, getCurrentHijriDate, gregorianToHijri, hijriToGregorian as convertHijriToGregorian } from './hijri-date.js';
import { accurateHijriDates, getTodayAccurateHijri, formatAccurateHijriDate } from './accurate-hijri-dates.js';

// ==========================================
// TEACHER UTILITIES
// ==========================================

/**
 * Get teacher phone number from Firestore
 * @param {string} teacherNameOrId - Teacher name or ID
 * @returns {Promise<string|null>} Phone number or null if not found
 */
async function getTeacherPhone(teacherNameOrId) {
  try {
    console.log('🔍 البحث عن معلم:', teacherNameOrId);
    
    // Search in 'classes' collection (not 'teachers')
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    
    console.log(`📊 عدد الحلقات في Firestore: ${classesSnapshot.docs.length}`);
    
    if (classesSnapshot.empty) {
      console.error('❌ لا يوجد حلقات في collection classes!');
      return null;
    }
    
    // Clean search term
    const searchTerm = teacherNameOrId.trim();
    
    // Try to find by 'teacherId' field
    let classDoc = classesSnapshot.docs.find(
      doc => doc.data().teacherId && doc.data().teacherId === searchTerm
    );
    
    if (classDoc) {
      const phone = classDoc.data().phone || classDoc.data().teacherPhone || null;
      if (phone) {
        console.log('✅ وُجد بحقل teacherId:', classDoc.data());
        return phone;
      }
    }
    
    // Try exact name match (teacherName field)
    classDoc = classesSnapshot.docs.find(
      doc => doc.data().teacherName && doc.data().teacherName.trim() === searchTerm
    );
    
    if (classDoc) {
      const phone = classDoc.data().phone || classDoc.data().teacherPhone || null;
      if (phone) {
        console.log('✅ وُجد بالاسم الدقيق:', classDoc.data());
        return phone;
      }
    }
    
    // Try partial match (contains)
    classDoc = classesSnapshot.docs.find(
      doc => doc.data().teacherName && 
             (doc.data().teacherName.includes(searchTerm) || searchTerm.includes(doc.data().teacherName))
    );
    
    if (classDoc) {
      const phone = classDoc.data().phone || classDoc.data().teacherPhone || null;
      if (phone) {
        console.log('✅ وُجد بالمطابقة الجزئية:', classDoc.data());
        return phone;
      }
    }
    
    // List all classes/teachers for debugging
    console.log('❌ لم يُعثر على المعلم. الحلقات المتاحة:');
    const teachersMap = new Map();
    
    classesSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const teacherId = data.teacherId || 'غير موجود';
      const teacherName = data.teacherName || 'غير محدد';
      const teacherPhone = data.phone || data.teacherPhone || 'غير موجود';
      
      // Group by teacher to avoid duplicates
      if (!teachersMap.has(teacherId)) {
        teachersMap.set(teacherId, {
          teacherId,
          teacherName,
          teacherPhone,
          classes: []
        });
      }
      teachersMap.get(teacherId).classes.push(data.className || doc.id);
    });
    
    console.log(`\n📋 إجمالي المعلمين: ${teachersMap.size}`);
    console.log(`⚠️ المعلم "${searchTerm}" غير موجود في القاعدة!`);
    
    return null;
  } catch (error) {
    console.error('❌ خطأ في جلب رقم المعلم:', error);
    return null;
  }
}

/**
 * Get teacher data from Firestore
 * @param {string} teacherNameOrId - Teacher name or ID
 * @returns {Promise<Object|null>} Teacher data or null if not found
 */
async function getTeacherData(teacherNameOrId) {
  try {
    // Search in 'classes' collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    
    // Try to find by 'teacherId' field
    let classDoc = classesSnapshot.docs.find(
      doc => doc.data().teacherId === teacherNameOrId
    );
    
    if (classDoc) {
      return {
        id: classDoc.data().teacherId,
        name: classDoc.data().teacherName,
        phone: classDoc.data().phone || classDoc.data().teacherPhone
      };
    }
    
    // If not found by teacherId, search by teacherName
    classDoc = classesSnapshot.docs.find(
      doc => doc.data().teacherName === teacherNameOrId
    );
    
    if (classDoc) {
      return {
        id: classDoc.data().teacherId,
        name: classDoc.data().teacherName,
        phone: classDoc.data().phone || classDoc.data().teacherPhone
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching teacher data:', error);
    return null;
  }
}

// Make functions globally available
window.getTeacherPhone = getTeacherPhone;
window.getTeacherData = getTeacherData;

// ==========================================
// MONTHLY LATE TRACKING SYSTEM
// ==========================================

/**
 * Get current Hijri month in format "YYYY-MM" using accurate dates
 * @returns {string} Current Hijri month (e.g., "1446-05")
 */
function getCurrentHijriMonth() {
  const today = getTodayAccurateHijri(); // Get accurate Hijri date
  if (today && today.hijri) {
    return today.hijri.substring(0, 7); // Extract "YYYY-MM"
  }
  // Fallback to getTodayForStorage if accurate date not available
  const fallback = getTodayForStorage();
  return fallback.substring(0, 7);
}

/**
 * Get student's late tracking data for current month
 * @param {string} studentId - Student ID
 * @returns {Promise<Object|null>} Late tracking data or null
 */
async function getStudentMonthlyLateData(studentId) {
  try {
    const currentMonth = getCurrentHijriMonth();
    const docRef = doc(db, 'monthlyLateTracking', `${studentId}_${currentMonth}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching student late data:', error);
    return null;
  }
}

/**
 * Increment student's late count for current month
 * @param {string} studentId - Student ID
 * @param {string} studentName - Student name
 * @returns {Promise<Object>} Updated late data with count and action
 */
async function incrementStudentLateCount(studentId, studentName) {
  try {
    const currentMonth = getCurrentHijriMonth();
    const todayAccurate = getTodayAccurateHijri();
    const today = todayAccurate && todayAccurate.hijri ? todayAccurate.hijri : getTodayForStorage();
    const docRef = doc(db, 'monthlyLateTracking', `${studentId}_${currentMonth}`);
    
    // Get existing data
    const existingData = await getStudentMonthlyLateData(studentId);
    
    if (existingData) {
      // Increment existing count
      const newCount = existingData.lateCount + 1;
      const action = determineActionForLateCount(newCount);
      
      await updateDoc(docRef, {
        lateCount: newCount,
        lateRecords: arrayUnion(today),
        currentAction: action,
        lastUpdated: serverTimestamp()
      });
      
      return { lateCount: newCount, currentAction: action };
    } else {
      // Create new record
      const action = determineActionForLateCount(1);
      
      await setDoc(docRef, {
        studentId,
        studentName,
        month: currentMonth,
        lateCount: 1,
        lateRecords: [today],
        currentAction: action,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
      
      return { lateCount: 1, currentAction: action };
    }
  } catch (error) {
    console.error('Error incrementing late count:', error);
    throw error;
  }
}

/**
 * Determine action based on late count
 * @param {number} lateCount - Number of late occurrences
 * @returns {Object} Action details {level, title, description}
 */
function determineActionForLateCount(lateCount) {
  const actions = {
    1: {
      level: 1,
      title: 'تنبيه شفهي',
      description: 'التأخير الأول في الشهر: تنبيه شفهي',
      color: '#ffc107',
      emoji: '⚠️'
    },
    2: {
      level: 2,
      title: 'الوقوف خارج الحلقة',
      description: 'التأخير الثاني: الوقوف من صلاة العصر إلى صلاة المغرب خارج الحلقة',
      color: '#ff9800',
      emoji: '🚫'
    },
    3: {
      level: 3,
      title: 'الوقوف خارج الحلقة',
      description: 'التأخير الثالث: الوقوف من صلاة العصر إلى صلاة المغرب خارج الحلقة',
      color: '#ff9800',
      emoji: '🚫'
    },
    4: {
      level: 4,
      title: 'استدعاء ولي الأمر',
      description: 'التأخير الرابع: استدعاء ولي الأمر وأخذ التعهد',
      color: '#dc3545',
      emoji: '📋'
    },
    5: {
      level: 5,
      title: 'الفصل والحرمان',
      description: 'التأخير الخامس: الفصل والحرمان من الحلقة',
      color: '#721c24',
      emoji: '❌'
    }
  };
  
  // For counts >= 5, return level 5 action
  if (lateCount >= 5) {
    return actions[5];
  }
  
  return actions[lateCount] || actions[1];
}

/**
 * Get student's current late status for modal display
 * @param {string} studentId - Student ID
 * @param {string} studentName - Student name
 * @returns {Promise<Object>} Late status with count, action, and month
 */
async function getStudentLateStatus(studentId, studentName) {
  try {
    const currentMonth = getCurrentHijriMonth();
    const lateData = await getStudentMonthlyLateData(studentId);
    
    if (lateData) {
      return {
        month: currentMonth,
        lateCount: lateData.lateCount,
        currentAction: lateData.currentAction,
        lateRecords: lateData.lateRecords || []
      };
    } else {
      // No late records for this month
      return {
        month: currentMonth,
        lateCount: 0,
        currentAction: null,
        lateRecords: []
      };
    }
  } catch (error) {
    console.error('Error getting student late status:', error);
    return {
      month: getCurrentHijriMonth(),
      lateCount: 0,
      currentAction: null,
      lateRecords: []
    };
  }
}

/**
 * Count student's late occurrences in current month from daily attendance records
 * @param {string} studentId - Student ID
 * @returns {Promise<number>} Number of late occurrences this month
 */
async function countStudentLateInCurrentMonth(studentId) {
  try {
    const currentMonth = getCurrentHijriMonth(); // e.g., "1446-05"
    
    // Get all daily reports for this student
    const reportsRef = collection(db, 'studentProgress', studentId, 'dailyReports');
    const reportsSnapshot = await getDocs(reportsRef);
    
    let lateCount = 0;
    
    reportsSnapshot.forEach(doc => {
      const data = doc.data();
      const reportDate = doc.id; // date is the document ID (format: "YYYY-MM-DD")
      
      // Check if this report is from current month
      if (reportDate.startsWith(currentMonth) && data.late === true) {
        lateCount++;
      }
    });
    
    return lateCount;
  } catch (error) {
    console.error('Error counting late occurrences:', error);
    return 0;
  }
}

// Make functions globally available
window.getCurrentHijriMonth = getCurrentHijriMonth;
window.getStudentMonthlyLateData = getStudentMonthlyLateData;
window.incrementStudentLateCount = incrementStudentLateCount;
window.determineActionForLateCount = determineActionForLateCount;
window.getStudentLateStatus = getStudentLateStatus;
window.countStudentLateInCurrentMonth = countStudentLateInCurrentMonth;

// Teacher names mapping for display in UI
const teacherNames = {
  'ABD01': 'الأستاذ عبدالرحمن السيسي',
  'AMR01': 'الأستاذ عامر هوساوي',
  'ANS01': 'الأستاذ أنس',
  'HRT01': 'الأستاذ حارث',
  'JHD01': 'الأستاذ جهاد',
  'JWD01': 'الأستاذ عبدالرحمن جاويد',
  'MZB01': 'الأستاذ مازن البلوشي',
  'MZN01': 'الأستاذ مازن',
  'NBL01': 'الأستاذ نبيل',
  'OMR01': 'الأستاذ عمر',
  'OSM01': 'الأستاذ أسامة حبيب',
  'SLM01': 'الأستاذ سلمان رفيق'
};

// DOM Elements - will be initialized in initAdmin()
let classSelectAdd;
let classSelectViewModal;
let classSelectReports;
let classSelectStruggling;
let studentSelectReports;
let studentsDiv;
let reportsContainer;
let strugglingReportsContainer;

let selectedClassId = null;
let listenersInitialized = false;

// Global variable to store current student ID for date range filter
window.currentAdminReportStudentId = null;

// Initialize admin section
export function initAdmin() {
  // Initialize DOM elements
  classSelectAdd = document.getElementById('classSelectAdd');
  classSelectViewModal = document.getElementById('classSelectViewModal');
  classSelectReports = document.getElementById('classSelectReports');
  classSelectStruggling = document.getElementById('classSelectStruggling');
  studentSelectReports = document.getElementById('studentSelectReports');
  studentsDiv = document.getElementById('students');
  reportsContainer = document.getElementById('reportsContainer');
  strugglingReportsContainer = document.getElementById('strugglingReportsContainer');
  
  loadClasses();
  loadAdminNotifications(); // Load notifications on init
  loadClassesManagement(); // Load classes management section
  if (!listenersInitialized) {
    setupEventListeners();
    listenersInitialized = true;
  }
}

// Load classes from Firebase
async function loadClasses() {
  classSelectAdd.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  classSelectViewModal.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  classSelectReports.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  classSelectStruggling.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  
  const classSelectAttendance = document.getElementById('classSelectAttendance');
  if (classSelectAttendance) {
    classSelectAttendance.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  }
  
  const snap = await getDocs(collection(db, 'classes'));
  const classesData = [];
  
  snap.forEach(d => {
    const data = d.data();
    const cid = data.classId || d.id;
    // Use teacher name from teacherNames map, fallback to className or cid
    const label = teacherNames[cid] || data.teacherName || data.className || cid;
    classesData.push({ cid, label });
    
    // Add to all dropdowns immediately (no waiting for attendance check)
    const selects = [classSelectAdd, classSelectViewModal, classSelectReports, classSelectStruggling];
    
    selects.forEach(select => {
      const opt = document.createElement('option');
      opt.value = cid;
      opt.textContent = label;
      select.appendChild(opt);
    });
    
    // Add to attendance dropdown immediately (without indicator)
    if (classSelectAttendance) {
      const opt = document.createElement('option');
      opt.value = cid;
      opt.textContent = label;
      opt.dataset.originalLabel = label; // Store original label
      classSelectAttendance.appendChild(opt);
    }
  });
  
  // Load attendance indicators in background (non-blocking)
  if (classSelectAttendance && classesData.length > 0) {
    loadAttendanceIndicators(classesData, classSelectAttendance);
  }
}

// Load attendance indicators in background (non-blocking)
async function loadAttendanceIndicators(classesData, selectElement) {
  const today = getTodayForStorage();
  
  // Process classes one by one to avoid overwhelming Firebase
  for (const { cid, label } of classesData) {
    try {
      const hasAttendance = await checkClassHasAttendanceToday(cid, today);
      
      // Update the option with indicator
      const option = Array.from(selectElement.options).find(opt => opt.value === cid);
      if (option && hasAttendance) {
        option.textContent = `✅ ${label}`;
      }
    } catch (error) {
      console.error(`Error checking attendance for ${cid}:`, error);
      // Continue with next class even if one fails
    }
  }
}

// Helper function to check if a class has attendance saved for a specific date (optimized)
async function checkClassHasAttendanceToday(classId, hijriDate) {
  try {
    // Get only the first student in the class (limit to 1 for performance)
    const studentsQuery = query(
      collection(db, 'users'),
      where('classId', '==', classId),
      where('role', '==', 'student'),
      limit(5) // Check only first 5 students for faster response
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    if (studentsSnap.empty) return false;
    
    // Check if any of the first students has attendance for this date
    for (const studentDoc of studentsSnap.docs) {
      const reportRef = firestoreDoc(db, 'studentProgress', studentDoc.id, 'dailyReports', hijriDate);
      const reportSnap = await getDoc(reportRef);
      
      if (reportSnap.exists()) {
        return true; // Found at least one attendance record
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking attendance:', error);
    return false;
  }
}

// Add student function
window.addStudent = async function() {
  const name = document.getElementById("studentName").value.trim();
  const birthDate = document.getElementById("studentBirthDate").value;
  const nationalId = document.getElementById("studentNationalId").value.trim();
  const studentPhone = document.getElementById("studentPhone").value.trim();
  const guardianPhone = document.getElementById("guardianPhone").value.trim();
  const level = document.getElementById("studentLevel").value;
  const classId = document.getElementById("classSelectAdd").value;
  const result = document.getElementById("result");

  // Validation
  if (!name) {
    result.innerText = "❌ الرجاء إدخال اسم الطالب";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!birthDate) {
    result.innerText = "❌ الرجاء اختيار تاريخ الميلاد";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!guardianPhone) {
    result.innerText = "❌ الرجاء إدخال رقم جوال ولي الأمر";
    result.style.color = '#ff6b6b';
    return;
  }

  // Validate guardian phone format (10 digits)
  if (guardianPhone && !/^[0-9]{10}$/.test(guardianPhone)) {
    result.innerText = "❌ رقم جوال ولي الأمر يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }

  // Validate student phone format if provided (10 digits)
  if (studentPhone && !/^[0-9]{10}$/.test(studentPhone)) {
    result.innerText = "❌ رقم جوال الطالب يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!level) {
    result.innerText = "❌ الرجاء اختيار المستوى";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!classId) {
    result.innerText = "❌ الرجاء اختيار الحلقة";
    result.style.color = '#ff6b6b';
    return;
  }

  try {
    result.innerText = "⏳ جاري إضافة الطالب...";
    result.style.color = '#667eea';

    // Generate unique student ID
    const randomNumber = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const userId = `${classId}_${randomNumber}`;

    // Calculate age from birth date
    const birthDateObj = new Date(birthDate);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = todayDate.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDateObj.getDate())) {
      age--;
    }

    // Get current Hijri date for registration date
    const registrationDateHijri = formatHijriDate(todayDate);

    // Prepare student data
    const studentData = {
      userId: userId,
      name: name,
      role: "student",
      classId: classId,
      birthDate: birthDate,
      age: age,
      guardianPhone: guardianPhone,
      level: level,
      createdAt: serverTimestamp(),
      registrationDateHijri: registrationDateHijri,
      monthlyScore: 0,
      rank: 0
    };

    // Add optional fields if provided
    if (nationalId) {
      studentData.nationalId = nationalId;
    }
    if (studentPhone) {
      studentData.studentPhone = studentPhone;
    }

    // Save to Firestore
    await setDoc(firestoreDoc(db, "users", userId), studentData);

    // Update class document with new student
    const classDocRef = firestoreDoc(db, "classes", classId);
    await updateDoc(classDocRef, {
      studentIds: arrayUnion(userId)
    });

    result.innerText = `✅ تم إضافة الطالب بنجاح: ${name} (${userId})`;
    result.style.color = '#51cf66';
    
    // Clear form and close after short delay
    setTimeout(() => {
      document.getElementById("studentName").value = "";
      document.getElementById("studentBirthDate").value = "";
      document.getElementById("studentNationalId").value = "";
      document.getElementById("studentPhone").value = "";
      document.getElementById("guardianPhone").value = "";
      document.getElementById("studentLevel").value = "";
      document.getElementById("classSelectAdd").value = "";
      result.innerText = "";
      
      // Close form
      const formContainer = document.getElementById('addStudentFormContainer');
      if (formContainer) {
        formContainer.style.display = 'none';
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 2000);
    
    // Reload student list if viewing same class
    if (selectedClassId === classId) {
      loadStudentsForClass(classId);
    }
  } catch (error) {
    console.error("Error adding student:", error);
    result.innerText = "❌ خطأ في إضافة الطالب: " + error.message;
    result.style.color = '#ff6b6b';
  }
};

// Load students for a class
async function loadStudentsForClass(classId) {
  studentsDiv.innerHTML = 'جارٍ التحميل...';
  selectedClassId = classId;
  
  // Show delete all buttons when a class is selected (both in navbar and modal)
  const deleteAllBtn = document.getElementById('deleteAllStudentsBtn');
  const deleteAllBtnModal = document.getElementById('deleteAllStudentsBtnModal');
  
  if (deleteAllBtn) {
    deleteAllBtn.style.display = classId ? 'block' : 'none';
  }
  if (deleteAllBtnModal) {
    deleteAllBtnModal.style.display = classId ? 'block' : 'none';
  }
  
  try {
    let q = query(collection(db, 'users'), where('classId', '==', classId));
    let snap = await getDocs(q);
    
    if (snap.empty) {
      studentsDiv.innerHTML = 'لا يوجد طلاب مُسجلين لهذه الحلقة.';
      return;
    }
    
    studentsDiv.innerHTML = '';
    const students = [];
    snap.forEach(d => {
      const dt = d.data();
      const id = d.id;
      const name = dt.name || '(بدون اسم)';
      const role = dt.role || '';
      const level = dt.level || 'غير محدد';
      const age = dt.age || '-';
      const guardianPhone = dt.guardianPhone || '-';
      if (role === 'student') {
        students.push({ 
          id, 
          name, 
          level, 
          age, 
          guardianPhone,
          fullData: dt 
        });
      }
    });
    
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    students.forEach(student => {
      const div = document.createElement('div');
      div.className = 'student-card-item';
      
      // Level badge with icon
      let levelBadge = '';
      let levelColor = '';
      if (student.level === 'hifz') {
        levelBadge = '📚 حفظ';
        levelColor = '#667eea';
      } else if (student.level === 'dabt') {
        levelBadge = '✨ ضبط';
        levelColor = '#f5576c';
      } else if (student.level === 'noorani') {
        levelBadge = '🌟 النورانية';
        levelColor = '#feca57';
      } else {
        levelBadge = student.level;
        levelColor = '#999';
      }
      
      div.innerHTML = `
        <div class="student-card-header">
          <div class="student-card-info">
            <div class="student-card-name">
              <strong style="font-size: 16px; color: #333;">${student.name}</strong>
              <span class="student-card-id" style="background: #f0f0f0; padding: 3px 10px; border-radius: 12px; font-size: 13px; color: #666;">${student.id}</span>
            </div>
            <div class="student-card-details" style="display: flex; gap: 15px; margin-top: 8px; flex-wrap: wrap;">
              <span style="background: ${levelColor}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">${levelBadge}</span>
              <span style="color: #666; font-size: 13px;">👤 العمر: ${student.age}</span>
              <span style="color: #666; font-size: 13px;">📱 ولي الأمر: ${student.guardianPhone}</span>
            </div>
          </div>
        </div>
        <div class="student-card-actions">
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn edit-btn" title="تعديل بيانات الطالب">
            ✏️
          </button>
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn transfer-btn" title="نقل لحلقة أخرى">
            🔄
          </button>
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn delete-btn" title="حذف الطالب">
            🗑️
          </button>
        </div>
      `;
      studentsDiv.appendChild(div);
      
      // Edit button event
      div.querySelector('.edit-btn').addEventListener('click', async (e) => {
        const studentId = e.target.dataset.id;
        await showEditStudentDialog(studentId, student.fullData);
      });
      
      // Transfer button event
      div.querySelector('.transfer-btn').addEventListener('click', async (e) => {
        const studentId = e.target.dataset.id;
        const studentName = e.target.dataset.name;
        await showTransferDialog(studentId, studentName);
      });
      
      // Delete button event
      div.querySelector('.delete-btn').addEventListener('click', async (e) => {
        const studentId = e.target.dataset.id;
        const studentName = e.target.dataset.name;
        if (confirm(`هل أنت متأكد من حذف الطالب "${studentName}" (${studentId})؟\nسيتم حذف جميع بياناته نهائياً.`)) {
          await deleteStudent(studentId, studentName);
        }
      });
    });
  } catch (error) {
    console.error('Error loading students:', error);
    studentsDiv.innerHTML = 'خطأ في تحميل الطلاب: ' + error.message;
  }
}

// Delete student
async function deleteStudent(studentId, studentName) {
  try {
    await deleteDoc(firestoreDoc(db, 'users', studentId));
    
    if (selectedClassId) {
      const classDocRef = firestoreDoc(db, 'classes', selectedClassId);
      await updateDoc(classDocRef, {
        studentIds: arrayRemove(studentId)
      });
    }
    
    alert(`تم حذف الطالب "${studentName}" (${studentId}) بنجاح`);
    
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    }
  } catch (error) {
    console.error('خطأ في حذف الطالب:', error);
    alert('حدث خطأ أثناء حذف الطالب: ' + error.message);
  }
}

// Delete all students in a class
window.deleteAllStudentsInClass = async function() {
  if (!selectedClassId) {
    alert('⚠️ يرجى اختيار حلقة أولاً');
    return;
  }
  
  try {
    // Get all students in the class
    const q = query(collection(db, 'users'), where('classId', '==', selectedClassId), where('role', '==', 'student'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      alert('ℹ️ لا يوجد طلاب في هذه الحلقة');
      return;
    }
    
    const studentCount = snap.size;
    
    // Confirm deletion
    const confirmed = confirm(`⚠️ تحذير: هل أنت متأكد من حذف جميع الطلاب؟\n\nعدد الطلاب: ${studentCount}\n\n⚠️ سيتم حذف جميع البيانات نهائياً ولا يمكن التراجع!`);
    
    if (!confirmed) {
      return;
    }
    
    // Double confirmation for safety
    const doubleConfirm = confirm(`⚠️⚠️ تأكيد نهائي ⚠️⚠️\n\nسيتم حذف ${studentCount} طالب نهائياً!\n\nهل أنت متأكد 100%؟`);
    
    if (!doubleConfirm) {
      return;
    }
    
    // Delete all students
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const docSnap of snap.docs) {
      try {
        await deleteDoc(firestoreDoc(db, 'users', docSnap.id));
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting student ${docSnap.id}:`, error);
        failedCount++;
      }
    }
    
    // Update class document
    try {
      const classDocRef = firestoreDoc(db, 'classes', selectedClassId);
      await updateDoc(classDocRef, {
        studentIds: []
      });
    } catch (error) {
      console.warn('Error updating class document:', error);
    }
    
    // Show result
    if (failedCount > 0) {
      alert(`✅ تم حذف ${deletedCount} طالب\n❌ فشل حذف ${failedCount} طالب`);
    } else {
      alert(`✅ تم حذف جميع الطلاب بنجاح (${deletedCount} طالب)`);
    }
    
    // Reload the list
    loadStudentsForClass(selectedClassId);
    
  } catch (error) {
    console.error('Error deleting all students:', error);
    alert('❌ حدث خطأ أثناء حذف الطلاب: ' + error.message);
  }
};

// Show edit student dialog
async function showEditStudentDialog(studentId, studentData) {
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'editStudentModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; overflow-y: auto;';
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 20px 20px 0 0; position: sticky; top: 0; z-index: 1;">
        <h3 style="margin: 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
          ✏️ تعديل بيانات الطالب
        </h3>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${studentData.name} (${studentId})</p>
      </div>
      
      <div style="padding: 30px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> اسم الطالب
            </label>
            <input type="text" id="editStudentName" value="${studentData.name || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> تاريخ الميلاد
            </label>
            <input type="date" id="editBirthDate" value="${studentData.birthDate || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              رقم الهوية
            </label>
            <input type="text" id="editNationalId" value="${studentData.nationalId || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              رقم جوال الطالب
            </label>
            <input type="tel" id="editStudentPhone" value="${studentData.studentPhone || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> رقم جوال ولي الأمر
            </label>
            <input type="tel" id="editGuardianPhone" value="${studentData.guardianPhone || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> المستوى
            </label>
            <select id="editLevel" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit; background: white;">
              <option value="hifz" ${studentData.level === 'hifz' ? 'selected' : ''}>📚 حفظ</option>
              <option value="dabt" ${studentData.level === 'dabt' ? 'selected' : ''}>✨ ضبط</option>
              <option value="noorani" ${studentData.level === 'noorani' ? 'selected' : ''}>🌟 القاعدة النورانية</option>
            </select>
          </div>
        </div>
        
        <div id="editStudentResult" style="margin-top: 20px; text-align: center; font-weight: bold; font-size: 15px;"></div>
        
        <div style="display: flex; gap: 15px; margin-top: 30px; justify-content: center; flex-wrap: wrap;">
          <button onclick="saveStudentEdit('${studentId}')" 
            style="background: linear-gradient(135deg, #51cf66 0%, #2d7a44 100%); color: white; padding: 12px 40px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(45,122,68,0.3);">
            ✅ حفظ التعديلات
          </button>
          <button onclick="closeEditStudentModal()" 
            style="background: #6c757d; color: white; padding: 12px 40px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Save student edit
window.saveStudentEdit = async function(studentId) {
  const name = document.getElementById('editStudentName').value.trim();
  const birthDate = document.getElementById('editBirthDate').value;
  const nationalId = document.getElementById('editNationalId').value.trim();
  const studentPhone = document.getElementById('editStudentPhone').value.trim();
  const guardianPhone = document.getElementById('editGuardianPhone').value.trim();
  const level = document.getElementById('editLevel').value;
  const result = document.getElementById('editStudentResult');
  
  // Validation
  if (!name || !birthDate || !guardianPhone || !level) {
    result.innerText = "❌ الرجاء ملء جميع الحقول المطلوبة";
    result.style.color = '#ff6b6b';
    return;
  }
  
  if (guardianPhone && !/^[0-9]{10}$/.test(guardianPhone)) {
    result.innerText = "❌ رقم جوال ولي الأمر يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }
  
  if (studentPhone && !/^[0-9]{10}$/.test(studentPhone)) {
    result.innerText = "❌ رقم جوال الطالب يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }
  
  try {
    result.innerText = "⏳ جاري حفظ التعديلات...";
    result.style.color = '#667eea';
    
    // Calculate age
    const birthDateObj = new Date(birthDate);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = todayDate.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDateObj.getDate())) {
      age--;
    }
    
    // Update data
    const updateData = {
      name: name,
      birthDate: birthDate,
      age: age,
      guardianPhone: guardianPhone,
      level: level,
      lastModified: serverTimestamp()
    };
    
    if (nationalId) {
      updateData.nationalId = nationalId;
    } else {
      updateData.nationalId = deleteField();
    }
    
    if (studentPhone) {
      updateData.studentPhone = studentPhone;
    } else {
      updateData.studentPhone = deleteField();
    }
    
    await updateDoc(firestoreDoc(db, 'users', studentId), updateData);
    
    result.innerText = "✅ تم حفظ التعديلات بنجاح!";
    result.style.color = '#51cf66';
    
    setTimeout(() => {
      closeEditStudentModal();
      if (selectedClassId) {
        loadStudentsForClass(selectedClassId);
      }
    }, 1500);
    
  } catch (error) {
    console.error('Error updating student:', error);
    result.innerText = "❌ خطأ في حفظ التعديلات: " + error.message;
    result.style.color = '#ff6b6b';
  }
};

// Close edit modal
window.closeEditStudentModal = function() {
  const modal = document.getElementById('editStudentModal');
  if (modal) {
    modal.remove();
  }
};

// Show transfer dialog
async function showTransferDialog(studentId, studentName) {
  try {
    // Get all classes
    const classesSnap = await getDocs(collection(db, 'classes'));
    
    if (classesSnap.empty) {
      alert('لا توجد حلقات متاحة للنقل');
      return;
    }
    
    // Get student's current class
    const studentDoc = await getDoc(firestoreDoc(db, 'users', studentId));
    const currentClassId = studentDoc.data().classId;
    
    // Build classes list (exclude current class)
    let classesHTML = '<option value="">-- اختر الحلقة الجديدة --</option>';
    classesSnap.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classDoc.id;
      if (classId !== currentClassId) {
        // Display teacher name if available, otherwise show class name or ID
        const displayName = teacherNames[classId] || classData.name || classId;
        classesHTML += `<option value="${classId}">${displayName}</option>`;
      }
    });
    
    // Create modal dialog
    const modalHTML = `
      <div id="transferModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; justify-content: center; align-items: center;">
        <div style="background: white; border-radius: 15px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #17a2b8; padding-bottom: 15px;">
            <h3 style="margin: 0; color: #17a2b8;">🔄 نقل طالب</h3>
            <button onclick="document.getElementById('transferModal').remove()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 35px; height: 35px; font-size: 20px; cursor: pointer;">×</button>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #666;"><strong>الطالب:</strong> ${studentName}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>الرقم:</strong> ${studentId}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">اختر الحلقة الجديدة:</label>
            <select id="targetClassSelect" style="width: 100%; padding: 12px; border: 2px solid #17a2b8; border-radius: 8px; font-size: 16px;">
              ${classesHTML}
            </select>
          </div>
          
          <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              ⚠️ <strong>ملاحظة مهمة:</strong><br>
              • سيتم نقل الطالب للحلقة الجديدة<br>
              • <strong>جميع التقييمات والحضور السابق سيبقى محفوظاً</strong><br>
              • التقارير ستعرض فقط التقييمات من تاريخ النقل<br>
              • يمكن تتبع تاريخ النقل من سجل الطالب
            </p>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button onclick="executeTransfer('${studentId}', '${studentName}')" style="flex: 1; padding: 12px; background: #17a2b8; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
              ✅ تأكيد النقل
            </button>
            <button onclick="document.getElementById('transferModal').remove()" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
  } catch (error) {
    console.error('Error showing transfer dialog:', error);
    alert('حدث خطأ: ' + error.message);
  }
}

// Execute student transfer
window.executeTransfer = async function(studentId, studentName) {
  const targetClassSelect = document.getElementById('targetClassSelect');
  const targetClassId = targetClassSelect.value;
  
  if (!targetClassId) {
    alert('الرجاء اختيار الحلقة الجديدة');
    return;
  }
  
  try {
    // Get current date in Hijri format
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    // Get accurate Hijri date
    const currentHijri = getCurrentHijriDate();
    const hijriDate = currentHijri?.hijri || getTodayForStorage(); // YYYY-MM-DD
    const gregorianDate = today.toISOString().split('T')[0];
    
    // Get student data
    const studentRef = firestoreDoc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      alert('الطالب غير موجود');
      return;
    }
    
    const studentData = studentSnap.data();
    const oldClassId = studentData.classId;
    
    if (!oldClassId) {
      alert('الطالب غير مسجل في أي حلقة');
      return;
    }
    
    // Get class names for history
    const oldClassSnap = await getDoc(firestoreDoc(db, 'classes', oldClassId));
    const newClassSnap = await getDoc(firestoreDoc(db, 'classes', targetClassId));
    const oldClassName = oldClassSnap.exists() ? (oldClassSnap.data().name || oldClassId) : oldClassId;
    const newClassName = newClassSnap.exists() ? (newClassSnap.data().name || targetClassId) : targetClassId;
    
    // Prepare transfer history entry (ensure all values are defined)
    const transferEntry = {
      fromClassId: String(oldClassId),
      fromClassName: String(oldClassName),
      toClassId: String(targetClassId),
      toClassName: String(newClassName),
      transferDate: String(hijriDate),
      transferDateGregorian: String(gregorianDate),
      timestampMs: Date.now()
    };
    
    console.log('Transfer entry:', transferEntry); // Debug log
    
    // Update student document
    const updateData = {
      classId: targetClassId,
      lastTransferDate: hijriDate,
      lastTransferTimestamp: serverTimestamp(),
      transferHistory: arrayUnion(transferEntry)
    };
    
    // If no classHistory exists, initialize it
    if (!studentData.classHistory) {
      updateData.classHistory = [
        {
          classId: oldClassId,
          className: oldClassName,
          startDate: null, // Unknown start date for existing students
          endDate: hijriDate
        },
        {
          classId: targetClassId,
          className: newClassName,
          startDate: hijriDate,
          endDate: null // Current class
        }
      ];
    } else {
      // Update the end date of current class and add new class
      const classHistory = [...studentData.classHistory];
      const currentClassIndex = classHistory.findIndex(h => h.classId === oldClassId && !h.endDate);
      if (currentClassIndex !== -1) {
        classHistory[currentClassIndex].endDate = hijriDate;
      }
      classHistory.push({
        classId: targetClassId,
        className: newClassName,
        startDate: hijriDate,
        endDate: null
      });
      updateData.classHistory = classHistory;
    }
    
    await updateDoc(studentRef, updateData);
    
    // Update old class (remove student)
    const oldClassRef = firestoreDoc(db, 'classes', oldClassId);
    await updateDoc(oldClassRef, {
      studentIds: arrayRemove(studentId)
    });
    
    // Update new class (add student)
    const newClassRef = firestoreDoc(db, 'classes', targetClassId);
    await updateDoc(newClassRef, {
      studentIds: arrayUnion(studentId)
    });
    
    // Close modal
    document.getElementById('transferModal').remove();
    
    // Show success message
    alert(`✅ تم نقل الطالب "${studentName}" بنجاح\n\nمن: ${oldClassName}\nإلى: ${newClassName}\n\nالتاريخ: ${hijriDate}`);
    
    // Reload students list
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    }
    
  } catch (error) {
    console.error('Error transferring student:', error);
    alert('حدث خطأ أثناء نقل الطالب: ' + error.message);
  }
};

// Load students for reports tab
async function loadStudentsForReports(classId) {
  studentSelectReports.innerHTML = '<option value="">-- اختر طالب --</option>';
  reportsContainer.innerHTML = '<p class="small">اختر طالب لعرض تقاريره</p>';
  
  try {
    let q = query(collection(db, 'users'), where('classId', '==', classId), where('role', '==', 'student'));
    let snap = await getDocs(q);
    
    if (snap.empty) {
      studentSelectReports.innerHTML = '<option value="">لا يوجد طلاب</option>';
      return;
    }
    
    const students = [];
    snap.forEach(d => {
      const dt = d.data();
      students.push({ id: d.id, name: dt.name || '(بدون اسم)' });
    });
    
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    students.forEach(student => {
      const opt = document.createElement('option');
      opt.value = student.id;
      opt.textContent = `${student.id} — ${student.name}`;
      studentSelectReports.appendChild(opt);
    });
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelectReports.innerHTML = '<option value="">خطأ في التحميل</option>';
  }
}

// Load reports for selected student with month filter
window.loadReportsForStudent = async function(studentId, selectedMonthFilter = 'current-month', selectedDayFilter = 'all-days') {
  reportsContainer.innerHTML = '<p>جاري تحميل التقارير...</p>';
  
  // Store current studentId for filter callbacks
  window.currentAdminReportStudentId = studentId;
  
  try {
    // Get student data to check for transfer history
    const studentDoc = await getDoc(firestoreDoc(db, 'users', studentId));
    const studentData = studentDoc.data();
    
    // Load daily reports from database
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    // Load exam reports
    const examReportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'examReports'));
    
    // Build transfer history display
    let transferHistoryHTML = '';
    if (studentData.transferHistory && studentData.transferHistory.length > 0) {
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      
      transferHistoryHTML = `
        <div style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
          <h4 style="margin: 0 0 15px 0;">🔄 تاريخ النقل بين الحلقات</h4>
          <div style="display: grid; gap: 10px;">
      `;
      
      studentData.transferHistory.forEach((transfer, index) => {
        const [year, month, day] = transfer.transferDate.split('-');
        const monthName = hijriMonths[parseInt(month) - 1];
        const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
        
        transferHistoryHTML += `
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; border-right: 4px solid white;">
            <div style="font-size: 14px; opacity: 0.9;">النقل ${index + 1}</div>
            <div style="font-weight: bold; margin: 5px 0;">من: ${transfer.fromClassName} → إلى: ${transfer.toClassName}</div>
            <div style="font-size: 13px; opacity: 0.9;">📅 ${hijriDate}</div>
          </div>
        `;
      });
      
      transferHistoryHTML += `
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 13px;">
            ℹ️ التقارير أدناه تشمل جميع الفترات (قبل وبعد النقل)
          </div>
        </div>
      `;
    }
    
    // Get actual reports from database
    const actualReports = new Map();
    reportsSnap.forEach(d => {
      actualReports.set(d.id, d.data());
    });
    
    // Get study days based on selected month
    let allStudyDays = [];
    
    if (selectedMonthFilter === 'current-month') {
      // Get current month study days
      allStudyDays = getStudyDaysInCurrentHijriMonth();
    } else {
      // Get study days for selected month
      allStudyDays = getStudyDaysForHijriMonth(selectedMonthFilter);
    }
    
    // Create complete list of reports (actual + missing days)
    const completeReports = [];
    
    allStudyDays.forEach(dateId => {
      if (actualReports.has(dateId)) {
        // Has actual report
        completeReports.push({ 
          dateId: dateId, 
          hasReport: true,
          ...actualReports.get(dateId) 
        });
      } else {
        // Missing report - not assessed yet
        completeReports.push({ 
          dateId: dateId, 
          hasReport: false,
          status: 'not-assessed'
        });
      }
    });
    
    // Sort by date ascending (oldest first - from start of month to end)
    completeReports.sort((a, b) => a.dateId.localeCompare(b.dateId));
    
    // Get current Hijri year
    const today = new Date();
    const hijriFormatter = new Intl.DateTimeFormat('en-SA-u-ca-islamic', {
      year: 'numeric',
      month: '2-digit',
      timeZone: 'Asia/Riyadh'
    });
    const parts = hijriFormatter.formatToParts(today);
    const currentHijriYear = parts.find(p => p.type === 'year').value;
    
    // Generate all months of current Hijri year
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const allMonths = [];
    
    // Add all months from current year
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${currentHijriYear}-${String(i).padStart(2, '0')}`;
      allMonths.push({
        key: monthKey,
        name: hijriMonths[i - 1],
        year: currentHijriYear
      });
    }
    
    // Add previous year months (last 3 months)
    const prevYear = String(parseInt(currentHijriYear) - 1);
    for (let i = 10; i <= 12; i++) {
      const monthKey = `${prevYear}-${String(i).padStart(2, '0')}`;
      allMonths.unshift({
        key: monthKey,
        name: hijriMonths[i - 1],
        year: prevYear
      });
    }
    
    // Populate month and day filters in the filter section
    const monthSelect = document.getElementById('adminReportsMonthFilter');
    monthSelect.innerHTML = '<option value="current-month">الشهر الحالي</option>';
    allMonths.forEach(month => {
      const displayText = `${month.name} ${month.year} هـ`;
      const option = document.createElement('option');
      option.value = month.key;
      option.textContent = displayText;
      if (selectedMonthFilter === month.key) {
        option.selected = true;
      }
      monthSelect.appendChild(option);
    });
    
    // Populate days filter
    const daySelect = document.getElementById('adminReportsDateFilter');
    daySelect.innerHTML = '<option value="all-days">جميع أيام الشهر</option>';
    allStudyDays.forEach(dateId => {
      const [y, m, d] = dateId.split('-').map(Number);
      
      // PRIORITY: Use accurate-hijri-dates.js for day name
      const dateEntry = accurateHijriDates.find(entry => entry.hijri === dateId);
      let gregorianDate, dayOfWeek;
      
      if (dateEntry) {
        // Use accurate calendar data
        const [gYear, gMonth, gDay] = dateEntry.gregorian.split('-').map(Number);
        gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
        dayOfWeek = gregorianDate.getDay();
      } else {
        // Fallback: use conversion
        gregorianDate = convertHijriToGregorian(y, m, d);
        dayOfWeek = gregorianDate.getDay();
      }
      
      const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = dayNames[dayOfWeek];
      const monthName = hijriMonths[m - 1];
      const option = document.createElement('option');
      option.value = dateId;
      option.textContent = `${dayName} - ${d} ${monthName} ${y} هـ`;
      if (selectedDayFilter === dateId) {
        option.selected = true;
      }
      daySelect.appendChild(option);
    });
    
    // Show filters
    document.getElementById('adminReportsFilters').style.display = 'block';
    
    // Populate Hijri date range selects
    await populateHijriDateRangeFilters();
    
    // Set default date range (from start of current month to today)
    await setDefaultDateRange();
    
    // Hide harvest card and reports initially - show only after applying filter
    document.getElementById('studentStatsSummary').style.display = 'none';
    reportsContainer.innerHTML = '<div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 12px; margin-top: 20px;"><p style="font-size: 16px; color: #6c757d; margin: 0;">⚡ اختر فترة زمنية واضغط "🔍 تطبيق الفلتر" لعرض التقارير</p></div>';
    
    // Don't calculate statistics on initial load
    // const reportsForStats = completeReports.filter(r => r.hasReport);
    // calculateStudentStatistics(reportsForStats);
    
    // Don't show any reports or exams on initial load - user must apply filter first
    
  } catch (error) {
    console.error('Error loading reports for student:', error);
    reportsContainer.innerHTML = '<p style="color: #dc3545;">❌ حدث خطأ في تحميل البيانات</p>';
  }
};

// Calculate student statistics (weekly from Sunday-Thursday, monthly) based on Hijri calendar
function calculateStudentStatistics(reports) {
  const today = new Date();
  
  // Get current Hijri date using accurate calendar
  const currentHijri = gregorianToHijri(today);
  const currentHijriDate = currentHijri.formatted; // YYYY-MM-DD
  
  // Find the start of current study week (last Sunday)
  const currentDayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const daysToLastSunday = currentDayOfWeek; // If today is Sunday (0), daysToLastSunday = 0
  
  const weekStartDate = new Date(today);
  weekStartDate.setDate(weekStartDate.getDate() - daysToLastSunday);
  weekStartDate.setHours(0, 0, 0, 0); // Start of Sunday
  
  const weekStartHijri = gregorianToHijri(weekStartDate);
  const weekStartHijriDate = weekStartHijri.formatted; // YYYY-MM-DD
  
  // Calculate 30 days ago (approximate Hijri month) using Gregorian then convert to Hijri
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoHijri = gregorianToHijri(monthAgo);
  const monthAgoHijriDate = monthAgoHijri.formatted; // YYYY-MM-DD
  
  console.log('📅 Date ranges for statistics:');
  console.log('Current Hijri:', currentHijriDate);
  console.log('Week start (Sunday) Hijri:', weekStartHijriDate);
  console.log('Month ago Hijri:', monthAgoHijriDate);
  console.log('Current day of week:', currentDayOfWeek, '(0=Sun, 1=Mon, ..., 6=Sat)');
  
  let weeklyLessons = 0;
  let weeklyRevisionPages = 0;
  let monthlyLessons = 0;
  let monthlyRevisionPages = 0;
  
  reports.forEach(report => {
    const reportDateId = report.dateId; // This is in Hijri format: YYYY-MM-DD
    
    // Get the Gregorian date of the report to check day of week
    const [hijriYear, hijriMonth, hijriDay] = reportDateId.split('-').map(Number);
    
    // PRIORITY: Use accurate-hijri-dates.js for day of week
    const dateEntry = accurateHijriDates.find(d => d.hijri === reportDateId);
    let reportGregorian, reportDayOfWeek;
    
    if (dateEntry) {
      // Use accurate calendar data
      const [gYear, gMonth, gDay] = dateEntry.gregorian.split('-').map(Number);
      reportGregorian = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
      reportDayOfWeek = reportGregorian.getDay();
    } else {
      // Fallback: use conversion
      reportGregorian = convertHijriToGregorian(hijriYear, hijriMonth, hijriDay);
      reportDayOfWeek = reportGregorian.getDay();
    }
    
    // Only count if it's a study day (Sunday=0 to Thursday=4)
    const isStudyDay = reportDayOfWeek >= 0 && reportDayOfWeek <= 4;
    
    // Count lessons based on score (every 5 points = 1 lesson)
    const lessonsFromScore = Math.floor((report.lessonScore || 0) / 5);
    
    // Also add extraLessonCount if it exists (for backward compatibility)
    const extraLessons = report.extraLessonCount || 0;
    const totalLessonsForDay = lessonsFromScore + extraLessons;
    
    // Log extra lesson details if available
    if (report.hasExtraLesson && extraLessons > 0) {
      console.log(`  ⭐ Extra Lesson: ${report.extraLessonFrom || ''} → ${report.extraLessonTo || ''}, Score: ${report.extraLessonScore || 0}, Count: ${extraLessons}`);
    }
    
    // Calculate revision pages
    let revisionPages = 0;
    if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    }
    
    // Weekly stats: from current week's Sunday to today, only study days (Sun-Thu)
    if (isStudyDay && reportDateId >= weekStartHijriDate && reportDateId <= currentHijriDate) {
      weeklyLessons += totalLessonsForDay;
      weeklyRevisionPages += revisionPages;
      console.log('📊 Weekly report:', reportDateId, '(Day:', reportDayOfWeek + ')', 'Lessons:', totalLessonsForDay, `(${lessonsFromScore}+${extraLessons})`, 'Pages:', revisionPages);
    }
    
    // Monthly stats (last 30 days, only study days)
    if (isStudyDay && reportDateId >= monthAgoHijriDate && reportDateId <= currentHijriDate) {
      monthlyLessons += totalLessonsForDay;
      monthlyRevisionPages += revisionPages;
      console.log('📈 Monthly report:', reportDateId, '(Day:', reportDayOfWeek + ')', 'Lessons:', totalLessonsForDay, `(${lessonsFromScore}+${extraLessons})`, 'Pages:', revisionPages);
    }
  });
  
  console.log('✅ Final statistics:');
  console.log('Weekly (Sun-Thu this week) - Lessons:', weeklyLessons, 'Pages:', weeklyRevisionPages);
  console.log('Monthly (last 30 days, Sun-Thu only) - Lessons:', monthlyLessons, 'Pages:', monthlyRevisionPages);
  
  // Update UI
  document.getElementById('studentStatsSummary').style.display = 'block';
  document.getElementById('harvestPeriodTitle').textContent = '📊 الحصاد الأسبوعي';
  document.getElementById('harvestPeriodSubtitle').textContent = 'من الأحد إلى الخميس';
  document.getElementById('periodLessonsCount').textContent = weeklyLessons;
  document.getElementById('periodRevisionPages').textContent = weeklyRevisionPages;
}

// Apply date range filter
window.applyAdminDateRangeFilter = async function() {
  const startDateSelect = document.getElementById('adminReportsStartDateHijri');
  const endDateSelect = document.getElementById('adminReportsEndDateHijri');
  const displayDiv = document.getElementById('dateRangeDisplay');
  
  const startDateHijri = startDateSelect.value; // Format: "1447-06-02"
  const endDateHijri = endDateSelect.value;
  
  if (!startDateHijri || !endDateHijri) {
    alert('⚠️ يرجى اختيار تاريخ البداية والنهاية');
    return;
  }
  
  if (startDateHijri > endDateHijri) {
    alert('⚠️ تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
    return;
  }
  
  const studentId = window.currentAdminReportStudentId;
  if (!studentId) {
    alert('⚠️ لم يتم اختيار طالب');
    return;
  }
  
  // Get display text from selected options
  const startDisplayText = startDateSelect.options[startDateSelect.selectedIndex].text;
  const endDisplayText = endDateSelect.options[endDateSelect.selectedIndex].text;
  
  displayDiv.innerHTML = `📅 الفترة: من ${startDisplayText} إلى ${endDisplayText}`;
  
  // Load reports with custom date range (using Hijri dates)
  await loadReportsForStudentCustomRange(studentId, startDateHijri, endDateHijri);
};

// Populate Hijri date range filters from accurate calendar
async function populateHijriDateRangeFilters() {
  try {
    // Import accurate Hijri dates
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const today = getTodayForStorage();
    
    const monthSelector = document.getElementById('adminReportsMonthSelector');
    
    if (!monthSelector) return;
    
    // Extract unique year-month combinations from accurate dates
    const availableMonths = new Set();
    accurateHijriDates.forEach(entry => {
      const monthKey = `${entry.hijriYear}-${String(entry.hijriMonth).padStart(2, '0')}`;
      availableMonths.add(monthKey);
    });
    
    // Convert to sorted array
    const sortedMonths = Array.from(availableMonths).sort();
    
    // Clear and populate month selector dynamically
    monthSelector.innerHTML = '<option value="">-- اختر الشهر --</option>';
    
    let currentYear = null;
    sortedMonths.forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      const monthNum = parseInt(month);
      
      // Add year separator when year changes
      if (currentYear !== parseInt(year)) {
        if (currentYear !== null) {
          const separator = document.createElement('option');
          separator.disabled = true;
          separator.textContent = `────── ${year} هـ ──────`;
          separator.style.textAlign = 'center';
          separator.style.fontSize = '11px';
          separator.style.color = '#999';
          monthSelector.appendChild(separator);
        }
        currentYear = parseInt(year);
      }
      
      const option = document.createElement('option');
      option.value = monthKey;
      option.textContent = `${hijriMonths[monthNum - 1]} ${year}`;
      
      // Select current month if it matches
      if (today.startsWith(monthKey)) {
        option.selected = true;
      }
      
      monthSelector.appendChild(option);
    });
    
    // Trigger initial population for current month
    window.updateAdminAttendanceDatesForMonth();
    
  } catch (error) {
    console.error('Error populating Hijri date filters:', error);
  }
}

// Update dates dropdown based on selected month for attendance reports
window.updateAdminAttendanceDatesForMonth = async function() {
  const monthSelector = document.getElementById('adminReportsMonthSelector');
  const startDateSelect = document.getElementById('adminReportsStartDateHijri');
  const endDateSelect = document.getElementById('adminReportsEndDateHijri');
  const messageDiv = document.getElementById('attendanceDateMessage');
  
  if (!monthSelector || !startDateSelect || !endDateSelect) return;
  
  const selectedValue = monthSelector.value;
  
  if (!selectedValue) {
    startDateSelect.innerHTML = '<option value="">-- اختر الشهر أولاً --</option>';
    endDateSelect.innerHTML = '<option value="">-- اختر الشهر أولاً --</option>';
    if (messageDiv) messageDiv.style.display = 'none';
    return;
  }
  
  // Parse year-month from value (e.g., "1447-11" or "1448-1")
  const [selectedYear, selectedMonth] = selectedValue.split('-').map(Number);
  
  try {
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    // Clear existing options
    startDateSelect.innerHTML = '<option value="">-- اختر التاريخ --</option>';
    endDateSelect.innerHTML = '<option value="">-- اختر التاريخ --</option>';
    
    // Filter dates for selected year and month
    const filteredDates = accurateHijriDates.filter(dateEntry => {
      const [year, month] = dateEntry.hijri.split('-').map(Number);
      return year === selectedYear && month === selectedMonth;
    });
    
    // Check if dates exist for this month
    if (filteredDates.length === 0) {
      startDateSelect.innerHTML = '<option value="">-- غير متوفر --</option>';
      endDateSelect.innerHTML = '<option value="">-- غير متوفر --</option>';
      if (messageDiv) messageDiv.style.display = 'block';
      return;
    }
    
    // Hide message if dates found
    if (messageDiv) messageDiv.style.display = 'none';
    
    // Add filtered dates to dropdowns
    filteredDates.forEach(dateEntry => {
      const [year, month, day] = dateEntry.hijri.split('-').map(Number);
      const monthName = hijriMonths[month - 1];
      
      // Get day of week
      const gregorianDate = new Date(dateEntry.gregorian + 'T12:00:00');
      const dayOfWeek = gregorianDate.getDay();
      const dayName = dayNames[dayOfWeek];
      
      const displayText = `${dayName} ${day} ${monthName} ${year} هـ`;
      
      // Create option for start date
      const startOption = document.createElement('option');
      startOption.value = dateEntry.hijri;
      startOption.textContent = displayText;
      startDateSelect.appendChild(startOption);
      
      // Create option for end date
      const endOption = document.createElement('option');
      endOption.value = dateEntry.hijri;
      endOption.textContent = displayText;
      endDateSelect.appendChild(endOption);
    });
    
    // Set default values - first and last date of month
    if (filteredDates.length > 0) {
      startDateSelect.value = filteredDates[0].hijri;
      endDateSelect.value = filteredDates[filteredDates.length - 1].hijri;
    }
    
  } catch (error) {
    console.error('Error updating dates:', error);
    if (messageDiv) messageDiv.style.display = 'block';
  }
};

// Set default date range (from start of current month to today)
async function setDefaultDateRange() {
  try {
    const { accurateHijriDates, getTodayAccurateHijri } = await import('./accurate-hijri-dates.js');
    
    const today = getTodayAccurateHijri();
    const currentHijri = today.hijri; // Format: "1447-06-13"
    
    // Get current month start
    const [currentYear, currentMonth] = currentHijri.split('-');
    const monthStart = `${currentYear}-${currentMonth}-01`;
    
    // Find the first available date in current month
    let firstDateInMonth = null;
    for (const dateEntry of accurateHijriDates) {
      if (dateEntry.hijri.startsWith(`${currentYear}-${currentMonth}`)) {
        firstDateInMonth = dateEntry.hijri;
        break;
      }
    }
    
    // Set default values
    const startDateSelect = document.getElementById('adminReportsStartDateHijri');
    const endDateSelect = document.getElementById('adminReportsEndDateHijri');
    
    if (firstDateInMonth && startDateSelect && endDateSelect) {
      // Set start date to beginning of month
      startDateSelect.value = firstDateInMonth;
      
      // Set end date to today (or closest available date)
      let closestToToday = firstDateInMonth;
      for (const dateEntry of accurateHijriDates) {
        if (dateEntry.hijri <= currentHijri) {
          closestToToday = dateEntry.hijri;
        } else {
          break;
        }
      }
      endDateSelect.value = closestToToday;
      
      // Update display
      const startOption = startDateSelect.options[startDateSelect.selectedIndex];
      const endOption = endDateSelect.options[endDateSelect.selectedIndex];
      if (startOption && endOption) {
        const displayDiv = document.getElementById('dateRangeDisplay');
        displayDiv.innerHTML = `📅 الفترة الافتراضية: من ${startOption.text} إلى ${endOption.text}`;
      }
    }
    
  } catch (error) {
    console.error('Error setting default date range:', error);
  }
}

// Load reports for custom date range
async function loadReportsForStudentCustomRange(studentId, startDateHijri, endDateHijri) {
  const reportsContainer = document.getElementById('reportsContainer');
  reportsContainer.innerHTML = '<p>جاري تحميل التقارير...</p>';
  
  try {
    // Import accurate Hijri dates
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    
    // Get all reports from database
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    const actualReports = new Map();
    reportsSnap.forEach(d => {
      actualReports.set(d.id, d.data());
    });
    
    // Get all study days in the date range using accurate dates
    const allStudyDaysSet = new Set(); // Use Set to prevent duplicates
    
    console.log('📅 Loading reports from', startDateHijri, 'to', endDateHijri);
    
    for (const dateEntry of accurateHijriDates) {
      // Check if date is within range
      if (dateEntry.hijri >= startDateHijri && dateEntry.hijri <= endDateHijri) {
        // Check if it's a study day (Sunday to Thursday)
        const gregorianDate = new Date(dateEntry.gregorian + 'T12:00:00');
        const dayOfWeek = gregorianDate.getDay();
        
        // Only include Sunday-Thursday (0,1,2,3,4)
        if (dayOfWeek >= 0 && dayOfWeek <= 4) {
          allStudyDaysSet.add(dateEntry.hijri);
          console.log('  ✅ Study day:', dateEntry.hijri, '(Day:', dayOfWeek + ')');
        } else {
          console.log('  ❌ Weekend:', dateEntry.hijri, '(Day:', dayOfWeek + ')');
        }
      }
    }
    
    // Convert Set to Array and sort
    const allStudyDays = Array.from(allStudyDaysSet).sort();
    console.log('✅ Total unique study days:', allStudyDays.length);
    
    // Create complete list of reports
    const completeReports = [];
    const seenDates = new Set(); // Track seen dates to prevent duplicates
    
    allStudyDays.forEach(dateId => {
      if (seenDates.has(dateId)) {
        console.warn('⚠️ Duplicate date detected:', dateId);
        return; // Skip duplicates
      }
      seenDates.add(dateId);
      
      // Find gregorianDate from accurate calendar
      const dateEntry = accurateHijriDates.find(d => d.hijri === dateId);
      const gregorianDate = dateEntry ? dateEntry.gregorian : null;
      
      if (actualReports.has(dateId)) {
        const reportData = actualReports.get(dateId);
        completeReports.push({ 
          dateId: dateId, 
          hasReport: true,
          gregorianDate: reportData.gregorianDate || gregorianDate, // Use from report or accurate calendar
          ...reportData 
        });
        console.log('📊 Report found for:', dateId);
      } else {
        completeReports.push({ 
          dateId: dateId, 
          hasReport: false,
          status: 'not-assessed',
          gregorianDate: gregorianDate // Add gregorian date for accurate day name
        });
        console.log('⏳ No report for:', dateId);
      }
    });
    
    // Sort by date
    completeReports.sort((a, b) => a.dateId.localeCompare(b.dateId));
    
    console.log('✅ Complete reports generated:', completeReports.length);
    
    // Store filtered reports globally for PDF export
    window.currentFilteredReports = completeReports;
    
    // Calculate statistics for this period
    const reportsForStats = completeReports.filter(r => r.hasReport);
    calculateCustomPeriodStatistics(reportsForStats, allStudyDays.length);
    
    // Generate reports table (without exam reports)
    const tableHTML = generateReportsTable(completeReports, allStudyDays.length);
    
    reportsContainer.innerHTML = tableHTML;
    
  } catch (error) {
    console.error('Error loading custom range reports:', error);
    reportsContainer.innerHTML = '<p style="color: #dc3545;">❌ حدث خطأ في تحميل التقارير</p>';
  }
}

// Calculate statistics for custom period
function calculateCustomPeriodStatistics(reports, totalDays) {
  let totalLessons = 0;
  let totalRevisionPages = 0;
  
  console.log('🔍 Calculating custom period statistics for', reports.length, 'reports');
  
  reports.forEach(report => {
    // Count lessons based on score (every 5 points = 1 lesson) - SAME as calculateHarvestStatistics
    const lessonScore = report.lessonScore || 0;
    const lessonsFromScore = Math.floor(lessonScore / 5);
    
    // Also add extraLessonCount if it exists (for backward compatibility)
    const extraLessons = report.extraLessonCount || 0;
    const totalLessonsForDay = lessonsFromScore + extraLessons;
    
    // Log details for debugging
    if (extraLessons > 0) {
      console.log(`  ⭐ ${report.dateId}: Extra Lesson Score=${report.extraLessonScore || 0}, Count=${extraLessons}, Range: ${report.extraLessonFrom || ''} → ${report.extraLessonTo || ''}`);
    }
    
    // Count revision pages - calculate from revisionFrom and revisionTo
    let revisionPages = 0;
    if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    }
    
    console.log(`  📊 ${report.dateId}: Lessons=${totalLessonsForDay} (score=${lessonScore}/5=${lessonsFromScore}, extra=${extraLessons}), Pages=${revisionPages}`);
    
    totalLessons += totalLessonsForDay;
    totalRevisionPages += revisionPages;
  });
  
  console.log('✅ Total: Lessons=' + totalLessons + ', Pages=' + totalRevisionPages);
  
  // Update UI with custom period stats and show harvest card
  document.getElementById('studentStatsSummary').style.display = 'block';
  
  // Get selected date range text from filter display
  const dateRangeDisplay = document.getElementById('dateRangeDisplay');
  const dateRangeText = dateRangeDisplay ? dateRangeDisplay.textContent.replace('📅 الفترة: ', '').replace('📅 الفترة الافتراضية: ', '') : '';
  
  // Update card title and subtitle
  document.getElementById('harvestPeriodTitle').textContent = '📊 حصاد الفترة المختارة';
  document.getElementById('harvestPeriodSubtitle').textContent = dateRangeText || `${totalDays} يوم دراسي`;
  
  // Update stats
  document.getElementById('periodLessonsCount').textContent = totalLessons;
  document.getElementById('periodRevisionPages').textContent = totalRevisionPages;
}

// Generate exam reports HTML
function generateExamReportsHTML(examReports) {
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  let html = `
    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
      <h4 style="margin: 0 0 15px 0;">📝 درجات الاختبارات الشهرية</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
  `;
  
  examReports.forEach(exam => {
    const [year, month, day] = exam.dateId.split('-');
    const monthName = hijriMonths[parseInt(month) - 1];
    const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
    const passIcon = exam.isPassed ? '✅' : '❌';
    const passText = exam.isPassed ? 'ناجح' : 'راسب';
    const passColor = exam.isPassed ? '#4caf50' : '#f44336';
    
    html += `
      <div style="background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; color: #333;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: bold; color: #667eea;">📅 ${hijriDate}</span>
          <span style="background: ${passColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">${passIcon} ${passText}</span>
        </div>
        <div style="font-size: 28px; font-weight: bold; color: #764ba2; text-align: center; margin: 10px 0;">
          ${exam.finalScore.toFixed(1)} / ${exam.maxScore}
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; margin-top: 10px;">
          <div>تنبيه: <strong>${exam.errorCounts?.tanbih || 0}</strong></div>
          <div>خطأ: <strong>${exam.errorCounts?.khata || 0}</strong></div>
          <div>تجويد: <strong>${exam.errorCounts?.tajweed || 0}</strong></div>
          <div>لحن: <strong>${exam.errorCounts?.lahn || 0}</strong></div>
        </div>
      </div>
    `;
  });
  
  html += '</div></div>';
  return html;
}

// Generate reports table HTML
function generateReportsTable(completeReports, totalDays) {
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  let tableHTML = `
    <h4 style="margin: 20px 0 15px 0;">تقارير المتابعة (${totalDays} يوم دراسي)</h4>
    <table class="compact-reports-table keep-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <th style="padding: 12px; text-align: right; border-radius: 8px 0 0 0;">التاريخ</th>
          <th style="padding: 12px; text-align: center;">اليوم</th>
          <th style="padding: 12px; text-align: center; border-radius: 0 8px 0 0;">الحالة</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  completeReports.forEach((report, index) => {
    const [year, month, day] = report.dateId.split('-');
    const monthName = hijriMonths[parseInt(month) - 1];
    const fullHijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
    
    // Get day name - ALWAYS use accurate calendar first
    let dayName = 'غير محدد';
    
    // PRIORITY 1: Look up in accurate-hijri-dates.js (most accurate)
    const dateEntry = accurateHijriDates.find(d => d.hijri === report.dateId);
    let correctGregorianDate = dateEntry ? dateEntry.gregorian : report.gregorianDate;
    
    if (correctGregorianDate) {
      // Parse gregorianDate correctly (format: "YYYY-MM-DD")
      const [gYear, gMonth, gDay] = correctGregorianDate.split('-').map(Number);
      // Month is 0-indexed in JavaScript Date
      const gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
      dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      
      // Debug log - show if database was wrong
      if (dateEntry && report.gregorianDate !== dateEntry.gregorian) {
        console.log(`🔧 Fixed date: ${report.dateId} → DB:${report.gregorianDate} → Correct:${correctGregorianDate} → ${dayName}`);
      } else {
        console.log(`📅 ${report.dateId} → ${correctGregorianDate} → ${dayName} (Day: ${gregorianDate.getDay()})`);
      }
    } else {
      // Fallback: convert from Hijri
      const [y, m, d] = report.dateId.split('-').map(Number);
      const gregorianDate = convertHijriToGregorian(y, m, d);
      dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      console.log(`⚠️ No date found for ${report.dateId}, using conversion`);
    }
    
    const uniqueId = `admin-report-${report.dateId}-${index}`;
    const rowColor = index % 2 === 0 ? '#f8f9fa' : 'white';
    
    let statusHTML = '';
    let clickHandler = '';
    
    if (!report.hasReport) {
      statusHTML = '<span style="color: #856404; font-weight: bold;">⏳ لم يُقيّم</span>';
    } else if (report.status === 'absent') {
      statusHTML = '<span style="color: #dc3545; font-weight: bold;">❌ غائب</span>';
      clickHandler = `onclick="viewReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})"`;
    } else {
      const totalScore = report.totalScore || 0;
      // Calculate max score dynamically
      const lessonScore = report.lessonScore || 0;
      const mainLessonBonus = lessonScore > 5 ? lessonScore - 5 : 0;
      const extraLessonScore = report.extraLessonScore || 0;
      const maxScore = 30 + mainLessonBonus + extraLessonScore;
      const scorePercentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      const statusColor = scorePercentage >= 80 ? '#28a745' : (scorePercentage >= 50 ? '#ffc107' : '#dc3545');
      statusHTML = `<span style="color: ${statusColor}; font-weight: bold;">✅ ${totalScore}/${maxScore}</span>`;
      clickHandler = `onclick="viewReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})"`;
    }
    
    tableHTML += `
      <tr style="background: ${rowColor}; ${report.hasReport ? 'cursor: pointer;' : ''}" ${clickHandler}>
        <td style="padding: 12px;">${fullHijriDate}</td>
        <td style="padding: 12px; text-align: center;">${dayName}</td>
        <td style="padding: 12px; text-align: center;">${statusHTML}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  return tableHTML;
}

// View report details
window.viewReportDetails = function(dateId, report) {
  // Format Hijri date properly
  const [year, month, day] = dateId.split('-');
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const monthName = hijriMonths[parseInt(month) - 1];
  const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
  
  // Get day name - ALWAYS use accurate calendar first
  let dayName = 'غير محدد';
  
  // PRIORITY 1: Look up in accurate-hijri-dates.js (most accurate)
  const dateEntry = accurateHijriDates.find(d => d.hijri === dateId);
  
  if (dateEntry) {
    // Use accurate calendar
    const [gYear, gMonth, gDay] = dateEntry.gregorian.split('-').map(Number);
    const gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
  } else if (report.gregorianDate) {
    // PRIORITY 2: Use stored gregorianDate from report
    const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
  }
  
  // Check if student was absent
  if (report.status === 'absent') {
    const details = `
التاريخ الهجري: ${hijriDate}
اليوم: ${dayName}
اسم الطالب: ${report.studentName || 'غير محدد'}
رقم الطالب: ${report.studentId || 'غير محدد'}

❌ الطالب كان غائباً في هذا اليوم
    `;
    alert(details);
    return;
  }
  
  // Show normal assessment details
  const lessonScore = report.lessonScore || 0;
  const lessonsFromScore = Math.floor(lessonScore / 5);
  const extraLessons = report.extraLessonCount || 0;
  const totalLessonsForDay = lessonsFromScore + extraLessons;
  
  // Get extra lesson details
  const hasExtraLesson = report.hasExtraLesson || false;
  const extraLessonScore = report.extraLessonScore || 0;
  const extraLessonFrom = report.extraLessonFrom || '';
  const extraLessonTo = report.extraLessonTo || '';
  
  // Calculate revision pages
  let revisionPages = 0;
  if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
    try {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    } catch (e) {
      console.error('Error calculating revision pages:', e);
    }
  }
  
  // Calculate max score (base 30 + main lesson bonus + extra lesson)
  const mainLessonBonus = lessonScore > 5 ? lessonScore - 5 : 0;
  const maxScore = 30 + mainLessonBonus + extraLessonScore;
  
  // Build extra lesson section
  let extraLessonSection = '';
  if (hasExtraLesson && extraLessonScore > 0) {
    extraLessonSection = `
الدرس الإضافي: ${extraLessonScore}/20 (من ${extraLessonFrom || '-'} إلى ${extraLessonTo || '-'})
  └─ عدد الدروس الإضافية: ${extraLessons}`;
  }
  
  const details = `
التاريخ الهجري: ${hijriDate}
اليوم: ${dayName}
اسم الطالب: ${report.studentName || 'غير محدد'}
رقم الطالب: ${report.studentId || 'غير محدد'}

=== الدرجات ===
صلاة العصر: ${report.asrPrayerScore || 0}/5
الدرس: ${lessonScore}/25 (من ${report.lessonFrom || '-'} إلى ${report.lessonTo || '-'})
  └─ عدد الدروس من التقييم: ${lessonsFromScore}${extraLessonSection}
جنب الدرس: ${report.lessonSideScore || 0}/5 (${report.lessonSideText || '-'})
المراجعة: ${report.revisionScore || 0}/5 (من ${report.revisionFrom || '-'} إلى ${report.revisionTo || '-'})
  └─ عدد صفحات المراجعة: ${revisionPages}
القراءة بالنظر: ${report.readingScore || 0}/5
السلوك: ${report.behaviorScore || 0}/10

════════════════════
إجمالي عدد الدروس المنجزة: ${totalLessonsForDay} (${lessonsFromScore} أساسي + ${extraLessons} إضافي)
المجموع الكلي: ${report.totalScore || 0}/${maxScore}
  `;
  alert(details);
};

// Setup event listeners
function setupEventListeners() {
  // Event listener for Students List Modal (shows cards)
  classSelectViewModal.addEventListener('change', (e) => {
    const cid = e.target.value;
    if (!cid) { 
      studentsDiv.innerHTML = 'اختر حلقة.'; 
      return; 
    }
    loadStudentsForClass(cid);
  });
  
  // Note: Daily Attendance Modal has its own class selector (classSelectAttendance)
  // No additional event listener needed here

  classSelectReports.addEventListener('change', (e) => {
    const cid = e.target.value;
    if (!cid) {
      studentSelectReports.innerHTML = '<option value="">-- اختر طالب --</option>';
      reportsContainer.innerHTML = '<p class="small">اختر حلقة أولاً</p>';
      return;
    }
    loadStudentsForReports(cid);
  });

  studentSelectReports.addEventListener('change', (e) => {
    const sid = e.target.value;
    if (!sid) {
      reportsContainer.innerHTML = '<p class="small">اختر طالب لعرض تقاريره</p>';
      return;
    }
    loadReportsForStudent(sid);
  });
}

// Load struggling students reports
window.loadStrugglingReports = async function() {
  const classId = classSelectStruggling.value;
  
  if (!classId) {
    strugglingReportsContainer.innerHTML = '<p class="small">اختر حلقة لعرض تقارير الطلاب المتعثرين</p>';
    return;
  }
  
  try {
    // Get all struggling reports for this class
    const q = query(
      collection(db, 'strugglingReports'),
      where('classId', '==', classId)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
      strugglingReportsContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; background: #f0f8ff; border-radius: 10px; margin-top: 20px;">
          <p style="font-size: 18px; color: #51cf66;">✅ لا توجد تقارير تعثر لهذه الحلقة</p>
        </div>
      `;
      return;
    }
    
    // Group reports by date
    const reportsByDate = {};
    snap.forEach(doc => {
      const data = doc.data();
      const dateKey = data.dateId || data.date; // Use dateId (Hijri format)
      if (!reportsByDate[dateKey]) {
        reportsByDate[dateKey] = [];
      }
      reportsByDate[dateKey].push(data);
    });
    
    // Sort dates descending (newest first)
    const sortedDates = Object.keys(reportsByDate).sort().reverse();
    
    let html = '';
    sortedDates.forEach(dateKey => {
      const reports = reportsByDate[dateKey];
      const firstReport = reports[0];
      
      // PRIORITY: Use accurate-hijri-dates.js for day name and date display
      let dayName = '';
      let hijriDate = 'تاريخ غير محدد';
      
      // Try to get dateId (Hijri format: YYYY-MM-DD)
      const dateId = firstReport.dateId || dateKey;
      
      if (dateId && dateId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Valid Hijri date format
        const [year, month, day] = dateId.split('-').map(Number);
        const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
        const monthName = hijriMonths[month - 1];
        hijriDate = `${day} ${monthName} ${year} هـ`;
        
        // PRIORITY 1: Look up in accurate-hijri-dates.js (most accurate)
        const dateEntry = accurateHijriDates.find(d => d.hijri === dateId);
        
        if (dateEntry) {
          // Use accurate calendar
          const [gYear, gMonth, gDay] = dateEntry.gregorian.split('-').map(Number);
          const gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
          dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
        } else {
          // PRIORITY 2: Use stored dayName from report
          dayName = firstReport.dayName || '';
        }
      } else {
        // Fallback: use stored data
        hijriDate = firstReport.date || firstReport.dateHijri || 'تاريخ غير محدد';
        dayName = firstReport.dayName || '';
      }
      
      const fullHijriDisplay = dayName ? `${dayName} ${hijriDate}` : hijriDate;
      
      reports.forEach(report => {
        const reportId = `${report.classId}_${report.dateId || dateKey}`;
        
        html += `
          <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%); border: 2px solid #ff6b6b; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 3px 10px rgba(255,107,107,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0; color: #d32f2f;">⚠️ تقرير التعثرات</h3>
              <div style="display: flex; gap: 10px; align-items: center;">
                <span style="background: white; padding: 8px 15px; border-radius: 8px; font-weight: bold; color: #666;">📅 ${fullHijriDisplay}</span>
                <button onclick="window.deleteStrugglingReport('${reportId}')" style="background: #dc3545; color: white; padding: 8px 15px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                  🗑️ حذف التقرير
                </button>
              </div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>👨‍🏫 المعلم:</strong> ${report.teacherName || report.teacherId}</p>
              <p style="margin: 5px 0; font-size: 16px;"><strong>📚 الحلقة:</strong> ${report.classId}</p>
              <p style="margin: 5px 0; font-size: 16px;"><strong>📊 عدد الطلاب المتعثرين:</strong> ${report.students?.length || report.totalCount || 1}</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 10px;">
              <h4 style="margin-top: 0; color: #d32f2f;">قائمة الطلاب المتعثرين:</h4>
              ${(report.students || [{ name: report.studentName, issues: report.issues, scores: report.scores, totalScore: report.totalScore }]).map(student => `
                <div style="background: #fff; border: 2px solid #ffcccb; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                  <h4 style="margin: 0 0 10px 0; color: #d32f2f; font-size: 18px;">👤 ${student.name || 'غير محدد'}</h4>
                  <div style="margin-top: 10px;">
                    <strong style="color: #555;">التعثرات:</strong><br>
                    ${(student.issues || []).map(issue => `
                      <span style="background: #ffe6e6; padding: 6px 12px; border-radius: 6px; display: inline-block; margin: 5px; font-size: 14px; color: #d32f2f;">
                        ${issue}
                      </span>
                    `).join('')}
                  </div>
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ffcccb;">
                    <p style="margin: 3px 0; font-size: 14px; color: #666;">
                      <strong>الدرس:</strong> ${student.scores?.lesson || 0}/5 | 
                      <strong>جنب الدرس:</strong> ${student.scores?.lessonSide || 0}/5 | 
                      <strong>المراجعة:</strong> ${student.scores?.revision || 0}/5
                    </p>
                    <p style="margin: 3px 0; font-size: 14px; color: #666;">
                      <strong>المجموع:</strong> ${student.totalScore || 0}
                    </p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    });
    
    strugglingReportsContainer.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading struggling reports:', error);
    strugglingReportsContainer.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #ffe6e6; border-radius: 10px; margin-top: 20px;">
        <p style="color: #d32f2f;">❌ حدث خطأ في تحميل التقارير</p>
      </div>
    `;
  }
  
  // Load absent students reports (only if container exists)
  const absentContainer = document.getElementById('absentStudentsReportsContainer');
  if (absentContainer) {
    loadAbsentStudentsReports();
  }
};

// Load absent students reports
async function loadAbsentStudentsReports() {
  const container = document.getElementById('absentStudentsReportsContainer');
  
  if (!container) {
    console.log('absentStudentsReportsContainer not found in page');
    return;
  }
  
  try {
    container.innerHTML = '<p class="small">جاري تحميل تقارير الغياب...</p>';
    
    const snap = await getDocs(collection(db, 'absentStudentsReports'));
    
    if (snap.empty) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; background: #f0f8ff; border-radius: 10px;">
          <p style="font-size: 18px; color: #51cf66;">✅ لا توجد تقارير غياب</p>
        </div>
      `;
      return;
    }
    
    const reports = [];
    snap.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by dateId (Hijri format) descending
    reports.sort((a, b) => (b.dateId || b.reportDate || '').localeCompare(a.dateId || a.reportDate || ''));
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">';
    
    reports.forEach(report => {
      // PRIORITY: Use accurate-hijri-dates.js for date display
      let displayDate = 'تاريخ غير محدد';
      let dayName = '';
      
      // Try to extract dateId (Hijri format)
      const dateId = report.dateId || report.reportDate;
      
      if (dateId && dateId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Valid Hijri date format
        const [year, month, day] = dateId.split('-').map(Number);
        const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
        const monthName = hijriMonths[month - 1];
        displayDate = `${day} ${monthName} ${year} هـ`;
        
        // PRIORITY 1: Look up in accurate-hijri-dates.js for day name
        const dateEntry = accurateHijriDates.find(d => d.hijri === dateId);
        
        if (dateEntry) {
          // Use accurate calendar
          const [gYear, gMonth, gDay] = dateEntry.gregorian.split('-').map(Number);
          const gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
          dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
          displayDate = `${dayName} ${displayDate}`;
        }
      } else if (report.reportDate) {
        // Already formatted
        displayDate = report.reportDate;
      } else if (report.gregorianDate) {
        // Convert from Gregorian
        try {
          displayDate = gregorianToHijriDisplay(report.gregorianDate);
        } catch (e) {
          console.error('Error converting date:', e);
        }
      }
      
      html += `
        <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 2px solid #ff9800; border-radius: 12px; padding: 20px; box-shadow: 0 3px 10px rgba(255,152,0,0.2);">
          <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0; color: #e65100;">📅 تقرير غياب</h4>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <p style="margin: 5px 0; font-size: 15px;"><strong>👤 الطالب:</strong> ${report.studentName}</p>
            <p style="margin: 5px 0; font-size: 15px;"><strong>📚 الحلقة:</strong> ${report.classId}</p>
            <p style="margin: 5px 0; font-size: 15px;"><strong>👨‍🏫 المعلم:</strong> ${report.teacherName}</p>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>📆 الشهر:</strong> ${report.month || 'غير محدد'}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>📅 تاريخ التقرير:</strong> ${displayDate}</p>
            <div style="margin-top: 10px; padding: 10px; background: #ffebee; border-radius: 6px; text-align: center;">
              <span style="font-size: 24px; font-weight: bold; color: #d32f2f;">${report.absentCount || 0}</span>
              <span style="font-size: 14px; color: #666; display: block; margin-top: 5px;">أيام غياب</span>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading absent reports:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #ffe6e6; border-radius: 10px;">
        <p style="color: #d32f2f;">❌ حدث خطأ في تحميل تقارير الغياب</p>
      </div>
    `;
  }
}

// Load daily attendance section (simplified for future implementation)
window.loadDailyAttendance = async function() {
  console.log('🔵 loadDailyAttendance: Start');
  const classId = document.getElementById('classSelectAttendance').value;
  
  if (!classId) {
    console.log('⚠️ No classId selected');
    return;
  }
  
  try {
    // Get class data
    const classDocRef = firestoreDoc(db, 'classes', classId);
    const classDocSnap = await getDoc(classDocRef);
    
    if (!classDocSnap.exists()) {
      alert('❌ الحلقة غير موجودة');
      return;
    }
    
    const classData = classDocSnap.data();
    
    // Get teacher name and ID properly
    let teacherName = classData.teacherName || 'غير محدد';
    let teacherId = classData.teacherId || null;
    
    // If we have teacherId, get teacher data from teachers collection
    if (teacherId) {
      console.log('🔍 Getting teacher data for ID:', teacherId);
      const teacherData = await getTeacherData(teacherId);
      if (teacherData && teacherData.name) {
        teacherName = teacherData.name;
        console.log('✅ Teacher name from teachers collection:', teacherName);
      }
    }
    
    console.log('📋 Final teacher info:', { teacherId, teacherName });
    
    // Get students in this class
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('classId', '==', classId),
      where('role', '==', 'student')
    ));
    
    if (studentsSnap.empty) {
      alert('⚠️ لا يوجد طلاب في هذه الحلقة');
      return;
    }
    
    // Collect students
    const students = [];
    studentsSnap.forEach(doc => {
      students.push({
        id: doc.id,
        name: doc.data().name || 'غير محدد',
        guardianPhone: doc.data().guardianPhone || '',
        teacherId: teacherId // Store teacherId in student data
      });
    });
    
    // Sort alphabetically
    students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Show modal with students (pass teacherId too)
    window.showDailyAttendanceModal(classId, teacherName, students, null, teacherId);
    
  } catch (error) {
    console.error('❌ Error loading daily attendance:', error);
    alert('حدث خطأ في تحميل التحضير اليومي');
  }
};

// Show daily attendance modal
window.showDailyAttendanceModal = function(classId, teacherName, students, selectedDate = null, teacherId = null) {
  const modal = document.getElementById('dailyAttendanceModal');
  const dateDisplay = document.getElementById('dailyAttendanceDate');
  const teacherDisplay = document.getElementById('dailyAttendanceTeacher');
  const studentsList = document.getElementById('dailyAttendanceStudentsList');
  
  // Store classId, students, teacherName AND teacherId for later use
  modal.dataset.classId = classId;
  modal.dataset.teacherName = teacherName;
  modal.dataset.teacherId = teacherId || '';
  modal.dataset.studentsData = JSON.stringify(students);
  
  // Get selected date or today's date
  const targetDate = selectedDate || getTodayForStorage(); // YYYY-MM-DD (Hijri format)
  modal.dataset.currentDate = targetDate;
  
  const todayEntry = accurateHijriDates.find(e => e.hijri === targetDate);
  
  if (todayEntry) {
    const parts = todayEntry.hijri.split('-');
    const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const monthName = hijriMonths[parseInt(parts[1]) - 1];
    dateDisplay.innerHTML = `
      <div onclick="window.showDatePicker()" style="cursor: pointer; padding: 5px 10px; border-radius: 8px; background: rgba(255,255,255,0.1); transition: all 0.3s; display: inline-block;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
        📅 ${todayEntry.dayName} - ${parts[2]} ${monthName} ${parts[0]} هـ
      </div>
    `;
  } else {
    dateDisplay.innerHTML = `
      <div onclick="window.showDatePicker()" style="cursor: pointer; padding: 5px 10px; border-radius: 8px; background: rgba(255,255,255,0.1); transition: all 0.3s; display: inline-block;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
        📅 ${targetDate}
      </div>
    `;
  }
  
  teacherDisplay.textContent = `المعلم: ${teacherName}`;
  
  // Check if it's Friday or Saturday (weekend)
  const isWeekend = todayEntry && (todayEntry.dayName === 'الجمعة' || todayEntry.dayName === 'السبت');
  
  // If it's weekend, show holiday message instead of students list
  if (isWeekend) {
    const dayNameArabic = todayEntry.dayName;
    studentsList.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; padding: 40px; text-align: center;">
        <div style="font-size: 80px; margin-bottom: 20px; opacity: 0.3;">🏖️</div>
        <h2 style="color: #667eea; font-size: 28px; margin-bottom: 15px; font-weight: bold;">يوم إجازة</h2>
        <p style="color: #666; font-size: 18px; line-height: 1.8; max-width: 500px;">
          لا يوجد تحضير يومي يوم <strong style="color: #764ba2;">${dayNameArabic}</strong>
          <br>
          💼 يمكنك الضغط على التاريخ أعلاه لعرض تحضيرات الأيام السابقة
        </p>
        <div style="margin-top: 25px; padding: 15px 25px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 10px; border: 2px dashed #667eea;">
          <p style="color: #764ba2; font-weight: 600; margin: 0;">
            📅 أيام الدراسة: الأحد - الخميس
          </p>
        </div>
      </div>
    `;
    
    // Hide save button on weekends
    const saveBtn = document.getElementById('saveDailyAttendanceBtn');
    if (saveBtn) {
      saveBtn.style.display = 'none';
    }
    
    // Show modal and return early (skip loading saved attendance)
    modal.style.display = 'flex';
    return;
  }
  
  // Show save button for non-weekend days
  const saveBtn = document.getElementById('saveDailyAttendanceBtn');
  if (saveBtn) {
    saveBtn.style.display = 'block';
  }
  
  // Build table with legend and students (for non-weekend days)
  let html = `
    <!-- Legend -->
    <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 12px; border: 2px solid #e9ecef;">
      <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 16px; height: 16px; background: #28a745; border-radius: 50%;"></div>
          <span>حاضر</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 16px; height: 16px; background: #ffc107; border-radius: 50%;"></div>
          <span>متأخر</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 16px; height: 16px; background: #667eea; border-radius: 50%;"></div>
          <span>غائب بعذر</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 16px; height: 16px; background: #dc3545; border-radius: 50%;"></div>
          <span>غائب بدون عذر</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <div style="width: 16px; height: 16px; background: #ff9800; border-radius: 50%;"></div>
          <span>شارد</span>
        </div>
      </div>
    </div>
    
    <!-- Students Table -->
    <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <th style="padding: 10px 8px; text-align: right; font-size: 13px; font-weight: bold; width: 40px;">#</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 13px; font-weight: bold;">اسم الطالب</th>
          <th style="padding: 10px 8px; text-align: center; font-size: 13px; font-weight: bold; width: 180px;">الحالة</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  students.forEach((student, index) => {
    const rowColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    const studentTeacherId = student.teacherId || '';
    html += `
      <tr id="row-${student.id}" style="background: ${rowColor}; border-bottom: 1px solid #e9ecef; transition: background 0.3s;">
        <td style="padding: 8px; font-size: 12px; color: #666;">${index + 1}</td>
        <td onclick="window.showWhatsAppModal('${student.name.replace(/'/g, "\\'")}', '${student.guardianPhone || ''}', '${teacherName.replace(/'/g, "\\'")}', '${student.id}', '${studentTeacherId}')" style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #333; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.color='#667eea'; this.style.textDecoration='underline'" onmouseout="this.style.color='#333'; this.style.textDecoration='none'" title="اضغط للتواصل مع ولي الأمر">${student.name}</td>
        <td style="padding: 6px 8px;">
          <div class="attendance-buttons" data-student-id="${student.id}" style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button onclick="window.selectAttendanceStatus('${student.id}', 'present')" data-status="present" title="حاضر" style="width: 26px; height: 26px; background: #28a745; border: 2px solid #28a745; border-radius: 50%; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 5px rgba(40,167,69,0.3); padding: 0;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'"></button>
            <button onclick="window.selectAttendanceStatus('${student.id}', 'late')" data-status="late" title="متأخر" style="width: 26px; height: 26px; background: #ffc107; border: 2px solid #ddd; border-radius: 50%; cursor: pointer; transition: all 0.2s; opacity: 0.4; padding: 0;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="if(!this.classList.contains('selected')) this.style.transform='scale(1)'"></button>
            <button onclick="window.selectAttendanceStatus('${student.id}', 'absent-excuse')" data-status="absent-excuse" title="غائب بعذر" style="width: 26px; height: 26px; background: #667eea; border: 2px solid #ddd; border-radius: 50%; cursor: pointer; transition: all 0.2s; opacity: 0.4; padding: 0;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="if(!this.classList.contains('selected')) this.style.transform='scale(1)'"></button>
            <button onclick="window.selectAttendanceStatus('${student.id}', 'absent-no-excuse')" data-status="absent-no-excuse" title="غائب بدون عذر" style="width: 26px; height: 26px; background: #dc3545; border: 2px solid #ddd; border-radius: 50%; cursor: pointer; transition: all 0.2s; opacity: 0.4; padding: 0;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="if(!this.classList.contains('selected')) this.style.transform='scale(1)'"></button>
            <button onclick="window.selectAttendanceStatus('${student.id}', 'distracted')" data-status="distracted" title="شارد" style="width: 26px; height: 26px; background: #ff9800; border: 2px solid #ddd; border-radius: 50%; cursor: pointer; transition: all 0.2s; opacity: 0.4; padding: 0;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="if(!this.classList.contains('selected')) this.style.transform='scale(1)'"></button>
          </div>
        </td>
      </tr>
    `;
  });
  
  // Stats footer row
  html += `
      </tbody>
      <tfoot>
        <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-top: 3px solid #667eea;">
          <td colspan="3" style="padding: 12px;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
              <div>
                <div style="font-size: 10px; color: #666; margin-bottom: 3px;">✅ الحضور</div>
                <div id="presentCount" style="font-size: 20px; font-weight: bold; color: #28a745;">0</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #666; margin-bottom: 3px;">📄 غائب بعذر</div>
                <div id="absentWithExcuseCount" style="font-size: 20px; font-weight: bold; color: #667eea;">0</div>
              </div>
              <div>
                <div style="font-size: 10px; color: #666; margin-bottom: 3px;">⚠️ بدون عذر</div>
                <div id="absentWithoutExcuseCount" style="font-size: 20px; font-weight: bold; color: #dc3545;">0</div>
              </div>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
  
  studentsList.innerHTML = html;
  
  // Show modal
  modal.style.display = 'flex';
  
  // Add to history for back button
  window.pushModalToHistory('dailyAttendanceModal');
  
  // Load saved attendance data after DOM updates
  setTimeout(() => {
    window.loadSavedAttendance(students, targetDate);
  }, 100);
};

// Show date picker for selecting different days
window.showDatePicker = async function(selectedMonth = null) {
  const modal = document.getElementById('dailyAttendanceModal');
  const currentDate = modal.dataset.currentDate || getTodayForStorage();
  const classId = modal.dataset.classId;
  
  // Find current month from selected date
  let currentEntry = accurateHijriDates.find(e => e.hijri === currentDate);
  
  // If current date not found in accurate data, use the last available month
  if (!currentEntry) {
    // Get the last entry in the accurate dates
    const lastEntry = accurateHijriDates[accurateHijriDates.length - 1];
    if (!lastEntry) {
      alert('⚠️ لا توجد بيانات هجرية متاحة. يرجى تحديث التقويم.');
      return;
    }
    // Use last available month
    currentEntry = lastEntry;
    
    // Show warning message
    const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const parts = lastEntry.hijri.split('-');
    const monthName = hijriMonths[parseInt(parts[1]) - 1];
    
    console.warn(`⚠️ التاريخ الحالي (${currentDate}) غير متوفر في البيانات الدقيقة. عرض آخر شهر متاح: ${monthName} ${parts[0]} هـ`);
  }
  
  let currentMonth = selectedMonth || currentEntry.hijriMonth;
  const currentYear = currentEntry.hijriYear;
  
  // Get all study days for current month (Sunday to Thursday only)
  const monthDates = accurateHijriDates.filter(entry => {
    if (entry.hijriMonth !== currentMonth || entry.hijriYear !== currentYear) return false;
    
    // Get day of week from Gregorian date
    const gregDate = new Date(entry.gregorian);
    const dayOfWeek = gregDate.getDay(); // 0=Sunday, 6=Saturday
    
    // Only study days: Sunday(0) to Thursday(4)
    return dayOfWeek >= 0 && dayOfWeek <= 4;
  });
  
  if (monthDates.length === 0) {
    alert('لا توجد أيام دراسية في هذا الشهر');
    return;
  }
  
  // Build date picker HTML immediately (don't wait for attendance checks)
  const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const monthName = hijriMonths[currentMonth - 1];
  
  // Check if we're showing fallback data
  const isUsingFallback = !accurateHijriDates.find(e => e.hijri === currentDate);
  const warningMessage = isUsingFallback ? 
    '<div style="background: #fff3cd; color: #856404; padding: 8px; margin: 10px 15px 0 15px; border-radius: 8px; font-size: 11px; text-align: center;">⚠️ التاريخ الحالي خارج نطاق البيانات المتوفرة. يتم عرض آخر شهر متاح.</div>' : '';
  
  // Available months filter (ذو القعدة and ذو الحجة)
  const availableMonths = [{num: 11, name: 'ذو القعدة'}, {num: 12, name: 'ذو الحجة'}];
  const monthOptions = availableMonths.map(m => 
    `<option value="${m.num}" ${m.num === currentMonth ? 'selected' : ''}>${m.name}</option>`
  ).join('');
  
  let html = `
    <div id="datePickerOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center;" onclick="this.remove()">
      <div style="background: white; border-radius: 15px; width: 90%; max-width: 500px; max-height: 70vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px 20px; color: white; border-radius: 15px 15px 0 0; position: sticky; top: 0; z-index: 1;">
          <h3 style="margin: 0; font-size: 18px; text-align: center;">📅 اختر يوم التحضير</h3>
          <div style="margin-top: 10px; text-align: center;">
            <select onchange="window.showDatePicker(parseInt(this.value))" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 8px 15px; border-radius: 8px; font-size: 14px; cursor: pointer; outline: none; min-width: 150px;">
              ${monthOptions}
            </select>
          </div>
          <p style="margin: 5px 0 0 0; font-size: 12px; text-align: center; opacity: 0.8;">${currentYear} هـ (أيام الدراسة فقط)</p>
        </div>
        ${warningMessage}
        
        <!-- Dates List -->
        <div id="datesListContainer" style="padding: 15px;">
  `;
  
  monthDates.forEach(entry => {
    const parts = entry.hijri.split('-');
    const isSelected = entry.hijri === currentDate;
    const bgColor = isSelected ? '#667eea' : '#f8f9fa';
    const textColor = isSelected ? 'white' : '#333';
    const borderColor = isSelected ? '#667eea' : '#e9ecef';
    
    html += `
      <div id="date-${entry.hijri}" onclick="window.switchToDate('${entry.hijri}'); document.getElementById('datePickerOverlay').remove();" 
           style="background: ${bgColor}; color: ${textColor}; padding: 12px 15px; margin-bottom: 8px; border-radius: 10px; cursor: pointer; border: 2px solid ${borderColor}; transition: all 0.3s; display: flex; justify-content: space-between; align-items: center;"
           onmouseover="if('${isSelected}' !== 'true') { this.style.background='#e9ecef'; this.style.transform='translateX(5px)'; }"
           onmouseout="if('${isSelected}' !== 'true') { this.style.background='#f8f9fa'; this.style.transform='translateX(0)'; }">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="indicator-${entry.hijri}" style="font-size: 12px; display: none;">✅</span>
          <div>
            <div style="font-weight: bold; font-size: 14px;">${entry.dayName}</div>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">${parts[2]} ${monthName} ${parts[0]} هـ</div>
          </div>
        </div>
        <div style="font-size: 12px; opacity: 0.7;">${entry.gregorian}</div>
      </div>
    `;
  });
  
  html += `
        </div>
      </div>
    </div>
  `;
  
  // Show the date picker immediately
  document.body.insertAdjacentHTML('beforeend', html);
  
  // Load attendance indicators in background (non-blocking)
  loadDateAttendanceIndicators(classId, monthDates);
};

// Load attendance indicators for date picker in background
async function loadDateAttendanceIndicators(classId, monthDates) {
  for (const entry of monthDates) {
    try {
      const hasAttendance = await checkClassHasAttendanceToday(classId, entry.hijri);
      
      // Update the indicator in the DOM
      const indicator = document.getElementById(`indicator-${entry.hijri}`);
      if (indicator && hasAttendance) {
        indicator.style.display = 'inline';
      }
    } catch (error) {
      console.error(`Error checking attendance for ${entry.hijri}:`, error);
    }
  }
}

// Switch to different date
window.switchToDate = function(hijriDate) {
  const modal = document.getElementById('dailyAttendanceModal');
  const classId = modal.dataset.classId;
  const teacherName = modal.dataset.teacherName;
  const teacherId = modal.dataset.teacherId || null;
  const students = JSON.parse(modal.dataset.studentsData || '[]');
  
  // Reload modal with new date (hijri format: YYYY-MM-DD)
  window.showDailyAttendanceModal(classId, teacherName, students, hijriDate, teacherId);
};

// Load saved attendance data for students
window.loadSavedAttendance = async function(students, targetDate = null) {
  try {
    const dateToLoad = targetDate || getTodayForStorage(); // YYYY-MM-DD
    
    if (!students || students.length === 0) {
      console.log('⚠️ No students to load attendance for');
      window.updateAttendanceStats();
      return;
    }
    
    for (const student of students) {
      const reportRef = firestoreDoc(db, 'studentProgress', student.id, 'dailyReports', dateToLoad);
      const reportSnap = await getDoc(reportRef);
      
      if (reportSnap.exists()) {
        const data = reportSnap.data();
        let uiStatus = 'present'; // default
        
        // Convert saved data to UI status
        if (data.status === 'present' && data.late === true) {
          uiStatus = 'late';
        } else if (data.status === 'absent' && data.excuseType === 'withExcuse') {
          uiStatus = 'absent-excuse';
        } else if (data.status === 'absent' && data.excuseType === 'withoutExcuse') {
          uiStatus = 'absent-no-excuse';
        } else if (data.status === 'distracted') {
          uiStatus = 'distracted';
        } else if (data.status === 'present') {
          uiStatus = 'present';
        }
        
        // Apply the saved status (will be skipped if element not found)
        window.selectAttendanceStatus(student.id, uiStatus);
      }
    }
    
    // Update stats after loading all data
    window.updateAttendanceStats();
    
  } catch (error) {
    console.error('❌ Error loading saved attendance:', error);
    // If error, just show default (all present) and update stats
    window.updateAttendanceStats();
  }
};

// Select attendance status for a student
window.selectAttendanceStatus = function(studentId, status) {
  const container = document.querySelector(`.attendance-buttons[data-student-id="${studentId}"]`);
  
  // Check if container exists
  if (!container) {
    console.warn(`⚠️ Container not found for student: ${studentId}`);
    return;
  }
  
  const buttons = container.querySelectorAll('button');
  
  // Remove selected class from all buttons
  buttons.forEach(btn => {
    btn.classList.remove('selected');
    btn.style.opacity = '0.4';
    btn.style.border = '2px solid #ddd';
    btn.style.boxShadow = 'none';
  });
  
  // Add selected class to clicked button
  const selectedBtn = container.querySelector(`button[data-status="${status}"]`);
  
  if (!selectedBtn) {
    console.warn(`⚠️ Button not found for status: ${status}`);
    return;
  }
  
  selectedBtn.classList.add('selected');
  selectedBtn.style.opacity = '1';
  selectedBtn.style.border = `2px solid ${selectedBtn.style.background}`;
  selectedBtn.style.boxShadow = `0 2px 8px ${selectedBtn.style.background}80`;
  selectedBtn.style.transform = 'scale(1.1)';
  setTimeout(() => {
    selectedBtn.style.transform = 'scale(1)';
  }, 200);
  
  // Change row color if absent without excuse
  const row = document.getElementById(`row-${studentId}`);
  if (row) {
    if (status === 'absent-no-excuse') {
      row.style.background = '#ffe6e6'; // Light red background
    } else {
      // Reset to original alternating color
      const allRows = document.querySelectorAll('#dailyAttendanceModal tbody tr');
      const rowIndex = Array.from(allRows).indexOf(row);
      row.style.background = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
    }
  }
  
  // Update stats
  window.updateAttendanceStats();
};

// Update attendance statistics
window.updateAttendanceStats = function() {
  const allButtons = document.querySelectorAll('.attendance-buttons');
  let present = 0;
  let absentWithExcuse = 0;
  let absentWithoutExcuse = 0;
  
  allButtons.forEach(container => {
    const selectedBtn = container.querySelector('button.selected');
    const status = selectedBtn ? selectedBtn.dataset.status : 'present';
    
    if (status === 'present' || status === 'late') {
      present++;
    } else if (status === 'absent-excuse') {
      absentWithExcuse++;
    } else if (status === 'absent-no-excuse') {
      absentWithoutExcuse++;
    }
    // distracted doesn't count in any category for now
  });
  
  document.getElementById('presentCount').textContent = present;
  document.getElementById('absentWithExcuseCount').textContent = absentWithExcuse;
  document.getElementById('absentWithoutExcuseCount').textContent = absentWithoutExcuse;
};

// Save daily attendance
window.saveDailyAttendance = async function() {
  const modal = document.getElementById('dailyAttendanceModal');
  const classId = modal.dataset.classId;
  const currentDate = modal.dataset.currentDate || getTodayForStorage();
  const saveBtn = document.getElementById('saveDailyAttendanceBtn');
  
  if (!classId) {
    alert('❌ خطأ: لم يتم اختيار الحلقة');
    return;
  }
  
  // Disable button
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ جاري الحفظ...';
  
  try {
    const allButtons = document.querySelectorAll('.attendance-buttons');
    
    // Collect attendance data
    const attendanceData = [];
    allButtons.forEach(container => {
      const studentId = container.dataset.studentId;
      const selectedBtn = container.querySelector('button.selected');
      const status = selectedBtn ? selectedBtn.dataset.status : 'present';
      
      let finalStatus = 'present';
      let excuseType = null;
      
      if (status === 'late') {
        finalStatus = 'present'; // متأخر = حاضر
      } else if (status === 'absent-excuse') {
        finalStatus = 'absent';
        excuseType = 'withExcuse';
      } else if (status === 'absent-no-excuse') {
        finalStatus = 'absent';
        excuseType = 'withoutExcuse';
      } else if (status === 'distracted') {
        finalStatus = 'distracted';
      }
      
      attendanceData.push({
        studentId,
        status: finalStatus,
        originalStatus: status,
        excuseType,
        date: currentDate
      });
    });
    
    // Save to Firebase
    for (const record of attendanceData) {
      const reportRef = firestoreDoc(db, 'studentProgress', record.studentId, 'dailyReports', currentDate);
      
      const reportData = {
        status: record.status,
        date: currentDate,
        timestamp: serverTimestamp(),
        late: record.originalStatus === 'late',  // true or false صراحة
        distracted: record.originalStatus === 'distracted',  // true or false صراحة
        excuseType: record.excuseType || null  // null لمسح القيم القديمة
      };
      
      await setDoc(reportRef, reportData, { merge: true });
    }
    
    // Success
    saveBtn.textContent = '✅ تم الحفظ بنجاح';
    saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    
    // Reload attendance indicators for the class dropdown
    const classSelect = document.getElementById('classSelectAttendance');
    if (classSelect) {
      const currentDate = getTodayForStorage();
      // Update the indicator for this specific class
      const option = classSelect.querySelector(`option[value="${classId}"]`);
      if (option) {
        const hasIndicator = option.textContent.includes('✅');
        if (!hasIndicator) {
          const originalText = option.textContent;
          option.textContent = `✅ ${originalText}`;
        }
      }
    }
    
    setTimeout(() => {
      window.closeDailyAttendanceModal();
    }, 1500);
    
  } catch (error) {
    console.error('❌ Error saving attendance:', error);
    alert('حدث خطأ في حفظ التحضير');
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 حفظ التحضير';
  }
};

// Close daily attendance modal
window.closeDailyAttendanceModal = function() {
  const modal = document.getElementById('dailyAttendanceModal');
  modal.style.display = 'none';
  
  // Reset save button
  const saveBtn = document.getElementById('saveDailyAttendanceBtn');
  saveBtn.disabled = false;
  saveBtn.textContent = '💾 حفظ التحضير';
  saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
  
  // Go back in history if modal was in stack
  if (window.modalStack.includes('dailyAttendanceModal')) {
    history.back();
  }
};

// Toggle admin notifications panel
window.toggleAdminNotifications = function() {
  const modal = document.getElementById('adminNotificationsModal');
  if (modal.style.display === 'none' || modal.style.display === '') {
    modal.style.display = 'block';
    loadAdminNotifications();
  } else {
    modal.style.display = 'none';
  }
};

// Logout from admin panel
window.logoutFromAdmin = function() {
  // Confirm logout
  if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
    console.log('🚪 Logging out from admin...');
    
    // Clear admin session data (correct key name!)
    sessionStorage.removeItem('loggedInAdmin');
    localStorage.removeItem('adminLoggedIn');
    
    // Hide admin section
    document.getElementById('adminSection').style.display = 'none';
    
    // Show role selection
    document.getElementById('roleSelection').style.display = 'flex';
    
    // Show success message
    console.log('✅ تم تسجيل الخروج بنجاح');
  }
};

// Load admin notifications
async function loadAdminNotifications() {
  const notificationsList = document.getElementById('adminNotificationsList');
  const badge = document.getElementById('adminNotificationBadge');
  
  try {
    const notificationsSnap = await getDocs(query(collection(db, 'adminNotifications'), where('read', '==', false)));
    
    if (notificationsSnap.empty) {
      notificationsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا توجد إشعارات</p>';
      badge.style.display = 'none';
      return;
    }
    
    const notifications = [];
    notificationsSnap.forEach(doc => {
      notifications.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by timestamp descending
    notifications.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toDate() - a.timestamp.toDate();
      }
      return 0;
    });
    
    // Update badge
    badge.textContent = notifications.length;
    badge.style.display = 'flex';
    
    // Display notifications
    let html = '';
    notifications.forEach(notification => {
      const bgColor = notification.type === 'not-assessed' ? '#fff3cd' : '#f8d7da';
      const borderColor = notification.type === 'not-assessed' ? '#ffc107' : '#dc3545';
      const icon = notification.type === 'not-assessed' ? '⚠️' : '❌';
      
      html += `
        <div style="background: ${bgColor}; border-right: 4px solid ${borderColor}; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <strong style="font-size: 14px;">${icon} ${notification.title}</strong>
            <button onclick="window.deleteAdminNotification('${notification.id}')" style="background: transparent; border: none; color: #999; cursor: pointer; font-size: 18px;">×</button>
          </div>
          <p style="margin: 5px 0; font-size: 13px; color: #333;">${notification.message}</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">📅 ${notification.date || ''} - ${notification.dayName || ''}</p>
        </div>
      `;
    });
    
    notificationsList.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading admin notifications:', error);
    notificationsList.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">حدث خطأ في تحميل الإشعارات</p>';
  }
}

// Mark all admin notifications as read
window.markAllAdminNotificationsAsRead = async function() {
  try {
    const notificationsSnap = await getDocs(query(collection(db, 'adminNotifications'), where('read', '==', false)));
    
    const updates = [];
    notificationsSnap.forEach(doc => {
      updates.push(updateDoc(doc.ref, { read: true }));
    });
    
    await Promise.all(updates);
    
    loadAdminNotifications();
    
  } catch (error) {
    console.error('Error marking notifications as read:', error);
  }
};

// Delete admin notification
window.deleteAdminNotification = async function(notificationId) {
  try {
    await deleteDoc(firestoreDoc(db, 'adminNotifications', notificationId));
    loadAdminNotifications();
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

// Delete struggling report
window.deleteStrugglingReport = async function(reportId) {
  if (!confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
    return;
  }
  
  try {
    await deleteDoc(firestoreDoc(db, 'strugglingReports', reportId));
    alert('✅ تم حذف التقرير بنجاح');
    
    // Reload reports
    const classFilter = document.getElementById('strugglingClassFilter');
    if (classFilter && classFilter.value) {
      window.loadStrugglingReports(classFilter.value);
    }
  } catch (error) {
    console.error('Error deleting struggling report:', error);
    alert('❌ حدث خطأ في حذف التقرير');
  }
};

// Update notification badge periodically
setInterval(() => {
  updateAdminNotificationBadge();
}, 30000); // Check every 30 seconds

async function updateAdminNotificationBadge() {
  try {
    const notificationsSnap = await getDocs(query(collection(db, 'adminNotifications'), where('read', '==', false)));
    const badge = document.getElementById('adminNotificationBadge');
    
    if (notificationsSnap.empty) {
      badge.style.display = 'none';
    } else {
      badge.textContent = notificationsSnap.size;
      badge.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error updating notification badge:', error);
  }
}

// Toggle admin report details
window.toggleAdminReportDetails = function(uniqueId) {
  const detailsRow = document.getElementById(uniqueId);
  if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
    detailsRow.style.display = 'table-row';
  } else {
    detailsRow.style.display = 'none';
  }
};

// Populate admin reports days filter  
window.populateAdminReportsDaysFilter = async function() {
  const monthValue = document.getElementById('adminReportsMonthFilter').value;
  const select = document.getElementById('adminReportsDateFilter');
  
  if (!monthValue) {
    select.innerHTML = '<option value="all-days">جميع أيام الشهر</option>';
    return;
  }
  
  // Get study days based on selected month
  let studyDays = [];
  if (monthValue === 'current-month') {
    studyDays = getStudyDaysInCurrentHijriMonth();
  } else {
    studyDays = getStudyDaysForHijriMonth(monthValue);
  }
  
  // Build options
  let options = '<option value="all-days">جميع أيام الشهر</option>';
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  for (const dateId of studyDays) {
    const [y, m, d] = dateId.split('-').map(Number);
    
    // PRIORITY: Use accurate-hijri-dates.js for day name
    const dateEntry = accurateHijriDates.find(entry => entry.hijri === dateId);
    let gregorianDate, dayOfWeek;
    
    if (dateEntry) {
      // Use accurate calendar data
      const [gYear, gMonth, gDay] = dateEntry.gregorian.split('-').map(Number);
      gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
      dayOfWeek = gregorianDate.getDay();
    } else {
      // Fallback: use conversion
      gregorianDate = convertHijriToGregorian(y, m, d);
      dayOfWeek = gregorianDate.getDay();
    }
    
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = dayNames[dayOfWeek];
    const monthName = hijriMonths[m - 1];
    
    options += `<option value="${dateId}">${dayName} - ${d} ${monthName} ${y} هـ</option>`;
  }
  
  select.innerHTML = options;
  
  // Reload reports with new filter
  await window.filterAdminReportsByDate();
};

// Filter admin reports by date
window.filterAdminReportsByDate = async function() {
  const monthValue = document.getElementById('adminReportsMonthFilter').value;
  const dayValue = document.getElementById('adminReportsDateFilter').value;
  const studentId = window.currentAdminReportStudentId;
  
  if (studentId) {
    await window.loadReportsForStudent(studentId, monthValue, dayValue);
  }
};

// Export comprehensive report as PDF
window.exportComprehensiveReportPDF = async function() {
  try {
    const studentId = window.currentAdminReportStudentId;
    if (!studentId) {
      alert('⚠️ لم يتم اختيار طالب');
      return;
    }
    
    // Get stored report data from last filter
    if (!window.currentFilteredReports || window.currentFilteredReports.length === 0) {
      alert('⚠️ لا توجد بيانات للتصدير. يرجى تطبيق الفلتر أولاً');
      return;
    }
    
    // Get student data
    const studentDocRef = firestoreDoc(db, 'users', studentId);
    const studentDocSnap = await getDoc(studentDocRef);
    const studentData = studentDocSnap.data();
    
    console.log('📋 Student data:', studentData);
    
    // Find teacher automatically - PRIORITY ORDER
    let teacherName = 'غير محدد';
    let teacherId = null;
    
    // Method 1 (HIGHEST PRIORITY): Get from class.teacherName
    if (studentData.classId) {
      console.log('🔍 Method 1 (Priority): Finding teacher from class:', studentData.classId);
      try {
        const classDocRef = firestoreDoc(db, 'classes', studentData.classId);
        const classDocSnap = await getDoc(classDocRef);
        if (classDocSnap.exists()) {
          const classData = classDocSnap.data();
          console.log('  📚 Class data:', classData);
          
          if (classData.teacherName) {
            teacherName = `الأستاذ ${classData.teacherName}`;
            console.log('  ✅ Found teacherName in class:', teacherName);
          } else if (classData.teacherId) {
            teacherId = classData.teacherId;
            console.log('  ✅ Found teacherId in class:', teacherId);
          }
        } else {
          console.log('  ⚠️ Class document not found');
        }
      } catch (error) {
        console.error('  ❌ Error finding teacher from class:', error);
      }
    }
    
    // Method 2: Get from student's teacherId
    if (teacherName === 'غير محدد' && studentData.teacherId) {
      teacherId = studentData.teacherId;
      console.log('🔍 Method 2: Using student.teacherId:', teacherId);
    }
    
    // Method 3: Get from filtered reports
    if (teacherName === 'غير محدد' && !teacherId) {
      console.log('🔍 Method 3: Finding teacher from reports...');
      const reportsWithTeacher = window.currentFilteredReports.filter(r => r.teacherId || r.teacherName);
      if (reportsWithTeacher.length > 0) {
        if (reportsWithTeacher[0].teacherName) {
          teacherName = `الأستاذ ${reportsWithTeacher[0].teacherName}`;
          console.log('  ✅ Found teacher name in report:', teacherName);
        } else if (reportsWithTeacher[0].teacherId) {
          teacherId = reportsWithTeacher[0].teacherId;
          console.log('  ✅ Found teacherId in report:', teacherId);
        }
      }
    }
    
    // If we have teacherId, fetch teacher name
    if (teacherName === 'غير محدد' && teacherId) {
      console.log('🔍 Fetching teacher name from teacherId:', teacherId);
      try {
        const teacherDocRef = firestoreDoc(db, 'users', teacherId);
        const teacherDocSnap = await getDoc(teacherDocRef);
        if (teacherDocSnap.exists()) {
          const rawName = teacherDocSnap.data().name;
          if (rawName) {
            teacherName = `الأستاذ ${rawName}`;
            console.log('✅ Teacher name fetched:', teacherName);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error fetching teacher:', error);
      }
    }
    
    console.log('👨‍🏫 Final teacher name:', teacherName);
    
    // Get period from display
    const periodText = document.getElementById('harvestPeriodSubtitle').textContent;
    
    // Calculate statistics
    const reports = window.currentFilteredReports.filter(r => r.hasReport);
    let totalLessons = 0;
    let totalRevisionPages = 0;
    let firstLesson = null;
    let lastLesson = null;
    let firstRevision = null;
    let lastRevision = null;
    let absenceWithExcuse = 0;
    let absenceWithoutExcuse = 0;
    
    reports.forEach(report => {
      if (report.status === 'absent') {
        if (report.excuseType === 'withExcuse') {
          absenceWithExcuse++;
        } else {
          absenceWithoutExcuse++;
        }
      } else {
        // Count lessons - SAME method as calculateCustomPeriodStatistics
        const lessonScore = report.lessonScore || 0;
        const lessonsFromScore = Math.floor(lessonScore / 5);
        const extraLessons = report.extraLessonCount || 0;
        totalLessons += lessonsFromScore + extraLessons;
        
        console.log(`📊 PDF: ${report.dateId} - Lessons: ${lessonsFromScore + extraLessons} (main=${lessonsFromScore}, extra=${extraLessons}, score=${lessonScore})`);
        
        // Log extra lesson details if available
        if (report.hasExtraLesson && extraLessons > 0) {
          console.log(`  ⭐ Extra Lesson Details: ${report.extraLessonFrom || ''} → ${report.extraLessonTo || ''}, Score: ${report.extraLessonScore || 0}`);
        }
        
        // Track first and last lesson
        if (lessonScore >= 5 && report.lessonFrom && report.lessonTo) {
          const lessonInfo = {
            from: report.lessonFrom,
            to: report.lessonTo,
            date: report.dateId
          };
          if (!firstLesson) firstLesson = lessonInfo;
          lastLesson = lessonInfo;
        }
        
        // Count revision pages
        if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
          const pages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
          totalRevisionPages += pages;
          
          console.log(`📖 PDF: ${report.dateId} - Revision pages: ${pages} (${report.revisionFrom}-${report.revisionTo})`);
          
          const revisionInfo = {
            from: report.revisionFrom,
            to: report.revisionTo,
            date: report.dateId
          };
          if (!firstRevision) firstRevision = revisionInfo;
          lastRevision = revisionInfo;
        }
      }
    });
    
    console.log('✅ PDF Statistics calculated:');
    console.log('  Total Lessons:', totalLessons);
    console.log('  Total Revision Pages:', totalRevisionPages);
    console.log('  Absences (with excuse):', absenceWithExcuse);
    console.log('  Absences (without excuse):', absenceWithoutExcuse);
    
    // 🚀 INNOVATIVE SOLUTION: Create HTML content and convert to PDF using html2canvas
    console.log('🎨 Creating HTML content for PDF...');
    
    // Create temporary container
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 800px;
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      text-align: right;
    `;
    
    const levelMap = {
      'memorization': 'حفظ',
      'consolidation': 'ضبط',
      'noorani': 'القاعدة النورانية'
    };
    const levelText = levelMap[studentData.level] || studentData.level || 'غير محدد';
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 28px;">تقرير شامل - حلقات حمدة آل ثاني</h1>
        <p style="color: #666; font-size: 16px; margin: 0;">الفترة: ${periodText}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
        <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 20px;">معلومات الطالب</h3>
        <p style="margin: 5px 0; font-size: 16px;"><strong>الاسم:</strong> ${studentData.name || 'غير محدد'}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>المعلم:</strong> ${teacherName}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>المستوى:</strong> ${levelText}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr>
            <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; text-align: right; border: none; font-size: 16px;">البيان</th>
            <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; text-align: center; border: none; font-size: 16px;">التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد الدروس المنجزة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${totalLessons}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">أول درس</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${firstLesson ? `${firstLesson.from} - ${firstLesson.to}` : 'لا يوجد'}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">آخر درس</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${lastLesson ? `${lastLesson.from} - ${lastLesson.to}` : 'لا يوجد'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد صفحات المراجعة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${totalRevisionPages}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">أول مراجعة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${firstRevision ? `من ${firstRevision.from} إلى ${firstRevision.to}` : 'لا يوجد'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">آخر مراجعة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${lastRevision ? `من ${lastRevision.from} إلى ${lastRevision.to}` : 'لا يوجد'}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد أيام الغياب (بعذر)</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${absenceWithExcuse}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد أيام الغياب (بدون عذر)</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${absenceWithoutExcuse}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea;">
        <p style="margin: 5px 0; color: #667eea; font-size: 14px; font-style: italic;">إدارة حلقات حمدة آل ثاني</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</p>
      </div>
    `;
    
    document.body.appendChild(container);
    console.log('📸 Converting HTML to canvas...');
    
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: true,
      backgroundColor: '#ffffff'
    });
    
    console.log('✅ Canvas created successfully');
    
    // Remove temporary container
    document.body.removeChild(container);
    
    // Create PDF from canvas
    console.log('📄 Creating PDF from canvas...');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    console.log('✅ PDF generated successfully');
    
    // Save PDF
    const fileName = `تقرير_${studentData.name || 'طالب'}_${Date.now()}.pdf`;
    doc.save(fileName);
    
    console.log('🎉 PDF saved successfully:', fileName);
    alert('✅ تم تصدير التقرير بنجاح!');
    
  } catch (error) {
    console.error('❌ Error exporting PDF:', error);
    console.error('Error stack:', error.stack);
    alert('❌ حدث خطأ في تصدير التقرير: ' + error.message);
  }
};

// ============================================
// Classes Management - Teacher Names
// ============================================

// Load classes management section
async function loadClassesManagement() {
  const container = document.getElementById('classesManagementContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<p>جاري تحميل الحلقات...</p>';
    
    const classesSnap = await getDocs(collection(db, 'classes'));
    
    if (classesSnap.empty) {
      container.innerHTML = '<p style="color: #999;">لا توجد حلقات مسجلة</p>';
      return;
    }
    
    let html = '<div style="display: grid; gap: 15px;">';
    
    classesSnap.forEach(doc => {
      const classData = doc.data();
      const classId = classData.classId || doc.id;
      const className = classData.className || classId;
      const teacherName = classData.teacherName || '';
      
      html += `
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 15px; align-items: center;">
            <div>
              <label style="display: block; font-weight: bold; color: #667eea; margin-bottom: 5px;">اسم الحلقة:</label>
              <div style="color: #333; font-size: 16px;">${className}</div>
            </div>
            
            <div>
              <label style="display: block; font-weight: bold; color: #555; margin-bottom: 5px;">اسم المعلم:</label>
              <input 
                type="text" 
                id="teacher-${classId}" 
                value="${teacherName}"
                placeholder="مثال: أنس أو عامر"
                style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 15px;"
              />
            </div>
            
            <button 
              onclick="window.updateClassTeacherName('${classId}')"
              style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; white-space: nowrap;">
              💾 حفظ
            </button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading classes management:', error);
    container.innerHTML = '<p style="color: #dc3545;">❌ حدث خطأ في تحميل الحلقات</p>';
  }
}

// Update class teacher name
window.updateClassTeacherName = async function(classId) {
  const input = document.getElementById(`teacher-${classId}`);
  const teacherName = input.value.trim();
  
  if (!teacherName) {
    alert('⚠️ يرجى إدخال اسم المعلم');
    return;
  }
  
  try {
    console.log(`💾 Updating teacher name for class ${classId}:`, teacherName);
    
    const classDocRef = firestoreDoc(db, 'classes', classId);
    await updateDoc(classDocRef, {
      teacherName: teacherName,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Teacher name updated successfully');
    alert(`✅ تم حفظ اسم المعلم: ${teacherName}`);
    
    // Reload classes to refresh dropdowns
    await loadClasses();
    
  } catch (error) {
    console.error('❌ Error updating teacher name:', error);
    alert('❌ حدث خطأ في حفظ اسم المعلم: ' + error.message);
  }
};

// Toggle Add Student Form visibility
window.toggleAddStudentForm = function() {
  const formContainer = document.getElementById('addStudentFormContainer');
  const toggleBtn = document.getElementById('toggleAddStudentBtn');
  
  if (formContainer.style.display === 'none' || formContainer.style.display === '') {
    // Show form
    formContainer.style.display = 'block';
    // Scroll to form smoothly
    setTimeout(() => {
      formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  } else {
    // Hide form and clear inputs
    formContainer.style.display = 'none';
    // Clear form fields
    document.getElementById('studentName').value = '';
    document.getElementById('studentBirthDate').value = '';
    document.getElementById('studentNationalId').value = '';
    document.getElementById('studentPhone').value = '';
    document.getElementById('guardianPhone').value = '';
    document.getElementById('studentLevel').value = '';
    document.getElementById('classSelectAdd').value = '';
    document.getElementById('result').innerText = '';
    // Scroll back to button
    toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// Toggle Student Search visibility
window.toggleStudentSearch = function() {
  const searchContainer = document.getElementById('searchStudentContainer');
  const toggleBtn = document.getElementById('toggleSearchBtn');
  
  if (searchContainer.style.display === 'none' || searchContainer.style.display === '') {
    // Show search
    searchContainer.style.display = 'block';
    // Clear previous search
    document.getElementById('studentSearchInput').value = '';
    document.getElementById('searchResultsContainer').innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">اكتب اسم الطالب للبحث...</p>';
    // Scroll to search
    setTimeout(() => {
      searchContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('studentSearchInput').focus();
    }, 100);
  } else {
    // Hide search
    searchContainer.style.display = 'none';
    // Scroll back to button
    toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// Smart search scoring function - calculates match accuracy
function calculateSearchScore(name, searchTerm) {
  const nameLower = name.toLowerCase().trim();
  const searchLower = searchTerm.toLowerCase().trim();
  
  // Exact match = highest score
  if (nameLower === searchLower) return 100;
  
  // Name starts with search term = very high score
  if (nameLower.startsWith(searchLower)) return 90;
  
  // Any word in name starts with search term
  const words = nameLower.split(/\s+/);
  const searchWords = searchLower.split(/\s+/);
  
  // Check if all search words match word beginnings
  let allWordsMatch = true;
  for (const searchWord of searchWords) {
    const found = words.some(word => word.startsWith(searchWord));
    if (!found) {
      allWordsMatch = false;
      break;
    }
  }
  if (allWordsMatch) return 80;
  
  // Any single word starts with search term
  if (words.some(word => word.startsWith(searchLower))) return 70;
  
  // Name contains search term as substring
  if (nameLower.includes(searchLower)) return 50;
  
  // Calculate similarity based on matching characters in order
  let matchCount = 0;
  let searchIndex = 0;
  for (let i = 0; i < nameLower.length && searchIndex < searchLower.length; i++) {
    if (nameLower[i] === searchLower[searchIndex]) {
      matchCount++;
      searchIndex++;
    }
  }
  
  if (matchCount === searchLower.length) {
    // All search characters found in order
    return 30 + (matchCount / nameLower.length) * 20;
  }
  
  // No meaningful match
  return 0;
}

// Perform student search
window.performStudentSearch = async function() {
  const searchInput = document.getElementById('studentSearchInput').value.trim().toLowerCase();
  const resultsContainer = document.getElementById('searchResultsContainer');
  
  // If search is empty, show placeholder
  if (searchInput.length === 0) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">اكتب اسم الطالب للبحث...</p>';
    return;
  }
  
  // If search is less than 2 characters, ask for more
  if (searchInput.length < 2) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b; padding: 40px;">الرجاء إدخال حرفين على الأقل</p>';
    return;
  }
  
  try {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;">🔍 جاري البحث...</p>';
    
    // Get all students
    const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    
    // Filter and score students by name
    const matchedStudents = [];
    studentsSnapshot.forEach(doc => {
      const studentData = doc.data();
      if (studentData.name) {
        const score = calculateSearchScore(studentData.name, searchInput);
        if (score > 0) {
          matchedStudents.push({
            id: doc.id,
            ...studentData,
            searchScore: score
          });
        }
      }
    });
    
    // Sort by score (highest first)
    matchedStudents.sort((a, b) => b.searchScore - a.searchScore);
    
    // Display results
    if (matchedStudents.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="font-size: 64px; margin-bottom: 15px;">🔍</div>
          <p style="color: #999; font-size: 18px; margin: 0;">لا توجد نتائج للبحث عن: <strong>"${searchInput}"</strong></p>
        </div>
      `;
      return;
    }
    
    // Store matched students globally for detail view
    window.searchResultsData = matchedStudents;
    
    // Get class names for students
    const classIds = [...new Set(matchedStudents.map(s => s.classId).filter(Boolean))];
    const classNames = {};
    for (const classId of classIds) {
      try {
        const classDoc = await getDoc(firestoreDoc(db, 'classes', classId));
        if (classDoc.exists()) {
          classNames[classId] = classDoc.data().name || classId;
        }
      } catch (error) {
        classNames[classId] = classId;
      }
    }
    
    // Store class names globally
    window.searchClassNames = classNames;
    
    // Display matched students as simple list
    let html = `
      <div style="margin-bottom: 15px; padding: 12px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 10px; text-align: center;">
        <span style="color: #1976d2; font-weight: bold; font-size: 16px;">🎯 النتائج: ${matchedStudents.length} طالب</span>
        <span style="color: #666; font-size: 13px; margin-right: 10px;">- اضغط على أي اسم لعرض التفاصيل</span>
      </div>
      <div style="display: grid; gap: 10px;">
    `;
    
    matchedStudents.forEach((student, index) => {
      const className = classNames[student.classId] || 'غير محدد';
      
      html += `
        <div id="student-card-${index}" onclick="toggleStudentDetails(${index})" 
          style="background: white; border: 2px solid #e0e0e0; border-radius: 10px; padding: 15px; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 6px rgba(0,0,0,0.06);"
          onmouseover="this.style.borderColor='#28a745'; this.style.boxShadow='0 3px 12px rgba(40,167,69,0.2)'; this.style.transform='translateX(-3px)'"
          onmouseout="this.style.borderColor='#e0e0e0'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.06)'; this.style.transform='translateX(0)'">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
              <span style="font-size: 24px;">👤</span>
              <div>
                <div style="font-weight: bold; color: #333; font-size: 16px;">${student.name}</div>
                <div style="color: #999; font-size: 12px;">${student.id}</div>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                ${className}
              </span>
              <span id="toggle-icon-${index}" style="color: #28a745; font-size: 18px; transition: transform 0.3s;">▼</span>
            </div>
          </div>
          
          <div id="student-details-${index}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 2px solid #f0f0f0;"></div>
        </div>
      `;
    });
    
    html += '</div>';
    resultsContainer.innerHTML = html;
    
  } catch (error) {
    console.error('Error searching students:', error);
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
        <p style="color: #dc3545; font-size: 16px; margin: 0;">حدث خطأ في البحث: ${error.message}</p>
      </div>
    `;
  }
};

// Show edit student dialog from search results
// Delete student from system
window.deleteStudentFromSearch = async function(studentId, studentName) {
  // Confirm deletion
  const confirmed = confirm(`⚠️ هل أنت متأكد من حذف الطالب "${studentName}"؟\n\nسيتم حذف جميع بياناته بشكل نهائي:\n• البيانات الشخصية\n• التقدم الدراسي\n• التقارير اليومية\n• جميع السجلات المرتبطة\n\n⛔ لا يمكن التراجع عن هذا الإجراء!`);
  
  if (!confirmed) return;
  
  // Double confirm
  const doubleConfirmed = confirm(`🔴 تأكيد نهائي: حذف "${studentName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه!`);
  
  if (!doubleConfirmed) return;
  
  try {
    // Get student data first
    const studentDoc = await getDoc(firestoreDoc(db, 'users', studentId));
    if (!studentDoc.exists()) {
      alert('❌ الطالب غير موجود في النظام');
      return;
    }
    
    const studentData = studentDoc.data();
    const classId = studentData.classId;
    
    // 1. Delete student progress data (hizbDisplays)
    try {
      const hizbDisplaysSnapshot = await getDocs(collection(db, 'hizbDisplays'));
      for (const doc of hizbDisplaysSnapshot.docs) {
        if (doc.data().studentId === studentId) {
          await deleteDoc(firestoreDoc(db, 'hizbDisplays', doc.id));
        }
      }
    } catch (error) {
      console.log('No hizbDisplays to delete:', error);
    }
    
    // 2. Delete juzDisplays
    try {
      const juzDisplaysSnapshot = await getDocs(collection(db, 'juzDisplays'));
      for (const doc of juzDisplaysSnapshot.docs) {
        if (doc.data().studentId === studentId) {
          await deleteDoc(firestoreDoc(db, 'juzDisplays', doc.id));
        }
      }
    } catch (error) {
      console.log('No juzDisplays to delete:', error);
    }
    
    // 3. Delete daily reports
    try {
      const reportsSnapshot = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
      for (const doc of reportsSnapshot.docs) {
        await deleteDoc(doc.ref);
      }
    } catch (error) {
      console.log('No daily reports to delete:', error);
    }
    
    // 4. Delete studentProgress document
    try {
      await deleteDoc(firestoreDoc(db, 'studentProgress', studentId));
    } catch (error) {
      console.log('No studentProgress to delete:', error);
    }
    
    // 5. Remove student from class
    if (classId) {
      try {
        const classRef = firestoreDoc(db, 'classes', classId);
        await updateDoc(classRef, {
          studentIds: arrayRemove(studentId)
        });
      } catch (error) {
        console.log('Error removing student from class:', error);
      }
    }
    
    // 6. Delete student document
    await deleteDoc(firestoreDoc(db, 'users', studentId));
    
    alert(`✅ تم حذف الطالب "${studentName}" بنجاح من النظام`);
    
    // Refresh search results
    window.performStudentSearch();
    
  } catch (error) {
    console.error('❌ Error deleting student:', error);
    alert('❌ حدث خطأ في حذف الطالب. الرجاء المحاولة مرة أخرى.');
  }
};

window.showEditStudentFromSearch = async function(studentId) {
  try {
    const studentDoc = await getDoc(firestoreDoc(db, 'users', studentId));
    if (studentDoc.exists()) {
      await showEditStudentDialog(studentId, studentDoc.data());
    } else {
      alert('الطالب غير موجود');
    }
  } catch (error) {
    console.error('Error loading student:', error);
    alert('حدث خطأ في تحميل بيانات الطالب');
  }
};

// Show transfer dialog from search results  
window.showTransferFromSearch = async function(studentId, studentName, currentClassId) {
  await showTransferDialog(studentId, studentName);
};

// Toggle student details in search results
window.toggleStudentDetails = function(index) {
  const detailsDiv = document.getElementById(`student-details-${index}`);
  const toggleIcon = document.getElementById(`toggle-icon-${index}`);
  const cardDiv = document.getElementById(`student-card-${index}`);
  
  if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
    // Show details
    const student = window.searchResultsData[index];
    const classNames = window.searchClassNames;
    const levelIcon = student.level === 'hifz' ? '📚' : student.level === 'dabt' ? '✨' : '🌟';
    const levelName = student.level === 'hifz' ? 'حفظ' : student.level === 'dabt' ? 'ضبط' : 'القاعدة النورانية';
    
    let html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; animation: slideDown 0.3s ease;">
        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">📅 تاريخ الميلاد</div>
          <div style="font-weight: bold; color: #333; font-size: 13px;">${student.birthDate || '-'}</div>
        </div>
        
        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">🎂 العمر</div>
          <div style="font-weight: bold; color: #333; font-size: 13px;">${student.age || '-'} سنة</div>
        </div>
        
        <div style="background: #f8f9fa; padding: 10px; border-radius: 8px;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">${levelIcon} المستوى</div>
          <div style="font-weight: bold; color: #333; font-size: 13px;">${levelName}</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
        ${student.guardianPhone ? `
          <div style="background: #e8f5e9; padding: 10px; border-radius: 8px;">
            <div style="font-size: 11px; color: #2e7d32; margin-bottom: 4px;">📞 جوال ولي الأمر</div>
            <div style="font-weight: bold; color: #1b5e20; font-size: 13px; direction: ltr; text-align: right;">${student.guardianPhone}</div>
          </div>
        ` : ''}
        
        ${student.studentPhone ? `
          <div style="background: #e3f2fd; padding: 10px; border-radius: 8px;">
            <div style="font-size: 11px; color: #1565c0; margin-bottom: 4px;">📱 جوال الطالب</div>
            <div style="font-weight: bold; color: #0d47a1; font-size: 13px; direction: ltr; text-align: right;">${student.studentPhone}</div>
          </div>
        ` : ''}
        
        ${student.nationalId ? `
          <div style="background: #fff3e0; padding: 10px; border-radius: 8px;">
            <div style="font-size: 11px; color: #e65100; margin-bottom: 4px;">🆔 رقم الهوية</div>
            <div style="font-weight: bold; color: #bf360c; font-size: 13px;">${student.nationalId}</div>
          </div>
        ` : ''}
      </div>
      
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button onclick="event.stopPropagation(); showEditStudentFromSearch('${student.id}')" 
          style="flex: 1; min-width: 110px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102, 126, 234, 0.3)'">
          ✏️ تعديل
        </button>
        <button onclick="event.stopPropagation(); showTransferFromSearch('${student.id}', '${student.name.replace(/'/g, "\\'")}', '${student.classId}')" 
          style="flex: 1; min-width: 110px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 10px 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 8px rgba(17, 153, 142, 0.3);"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(17, 153, 142, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(17, 153, 142, 0.3)'">
          🔄 نقل
        </button>
        <button onclick="event.stopPropagation(); deleteStudentFromSearch('${student.id}', '${student.name.replace(/'/g, "\\'")}')" 
          style="flex: 1; min-width: 110px; background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; padding: 10px 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 8px rgba(235, 51, 73, 0.3);"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(235, 51, 73, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(235, 51, 73, 0.3)'">
          🗑️ حذف
        </button>
      </div>
    `;
    
    detailsDiv.innerHTML = html;
    detailsDiv.style.display = 'block';
    toggleIcon.style.transform = 'rotate(180deg)';
    toggleIcon.textContent = '▲';
    cardDiv.style.background = 'linear-gradient(to bottom, #f8f9fa 0%, white 100%)';
  } else {
    // Hide details
    detailsDiv.style.display = 'none';
    toggleIcon.style.transform = 'rotate(0deg)';
    toggleIcon.textContent = '▼';
    cardDiv.style.background = 'white';
  }
};

// ==================== ABSENCE REPORTS MODULE ====================

// Show absence reports modal - Select teacher/class
window.showAbsenceReportsModal = async function() {
  try {
    // Get all classes
    const classesSnap = await getDocs(collection(db, 'classes'));
    
    if (classesSnap.empty) {
      alert('⚠️ لا توجد حلقات متاحة');
      return;
    }
    
    let classOptions = '<option value="">-- اختر الحلقة --</option>';
    classesSnap.forEach(doc => {
      const classData = doc.data();
      const teacherName = classData.teacherName || 'غير محدد';
      const className = classData.className || 'غير محدد';
      classOptions += `<option value="${doc.id}">${teacherName} - ${className}</option>`;
    });
    
    const html = `
      <div id="absenceReportsOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center;" onclick="this.remove()">
        <div style="background: white; border-radius: 15px; width: 90%; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; border-radius: 15px 15px 0 0;">
            <h3 style="margin: 0; text-align: center; font-size: 20px;">📊 تقارير الغياب</h3>
          </div>
          
          <div style="padding: 25px;">
            <label style="display: block; margin-bottom: 10px; color: #333; font-weight: bold;">👨‍🏫 اختر الحلقة:</label>
            <select id="absenceClassSelect" style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 10px; font-size: 15px; margin-bottom: 20px;">
              ${classOptions}
            </select>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button onclick="document.getElementById('absenceReportsOverlay').remove()" style="padding: 12px 25px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px;">
                إلغاء
              </button>
              <button onclick="window.loadAbsenceReportForClass()" style="padding: 12px 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: bold;">
                التالي
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
  } catch (error) {
    console.error('Error loading absence reports:', error);
    alert('حدث خطأ في تحميل تقارير الغياب');
  }
};

// Load absence report for selected class - Show date range and students selection
window.loadAbsenceReportForClass = async function() {
  const classId = document.getElementById('absenceClassSelect').value;
  
  if (!classId) {
    alert('⚠️ يرجى اختيار الحلقة أولاً');
    return;
  }
  
  try {
    // Get class data
    const classDocRef = firestoreDoc(db, 'classes', classId);
    const classDocSnap = await getDoc(classDocRef);
    
    if (!classDocSnap.exists()) {
      alert('❌ الحلقة غير موجودة');
      return;
    }
    
    const classData = classDocSnap.data();
    const teacherName = classData.teacherName || 'غير محدد';
    
    // Get students in this class
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('classId', '==', classId),
      where('role', '==', 'student')
    ));
    
    if (studentsSnap.empty) {
      alert('⚠️ لا يوجد طلاب في هذه الحلقة');
      return;
    }
    
    const students = [];
    studentsSnap.forEach(doc => {
      students.push({
        id: doc.id,
        name: doc.data().name || 'غير محدد'
      });
    });
    
    // Sort alphabetically
    students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Get today's Hijri date
    const today = getTodayForStorage(); // e.g., "1447-11-02"
    const todayParts = today.split('-');
    const currentYear = parseInt(todayParts[0]);
    const currentMonth = parseInt(todayParts[1]);
    
    // Build date options from accurate Hijri dates
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    // Build month options dynamically from available dates
    let monthOptions = '<option value="">-- اختر الشهر --</option>';
    
    // Extract unique year-month combinations
    const availableMonths = new Map();
    accurateHijriDates.forEach(entry => {
      const monthKey = `${entry.hijriYear}-${String(entry.hijriMonth).padStart(2, '0')}`;
      if (!availableMonths.has(monthKey)) {
        availableMonths.set(monthKey, {
          year: entry.hijriYear,
          month: entry.hijriMonth,
          name: hijriMonths[entry.hijriMonth - 1]
        });
      }
    });
    
    // Convert to sorted array
    const sortedMonths = Array.from(availableMonths.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    
    // Build month options with year separators
    let lastYear = null;
    sortedMonths.forEach(m => {
      // Add year separator when year changes
      if (lastYear !== m.year) {
        if (lastYear !== null) {
          // Add separator before new year except for first year
          monthOptions += `<option disabled style="text-align: center; font-size: 11px; color: #999;">────── ${m.year} هـ ──────</option>`;
        }
        lastYear = m.year;
      }
      
      const monthKey = `${m.year}-${String(m.month).padStart(2, '0')}`;
      const isSelected = (m.year === currentYear && m.month === currentMonth) ? 'selected' : '';
      monthOptions += `<option value="${monthKey}" ${isSelected}>${m.name} ${m.year}</option>`;
    });
    
    // Build students options
    let studentOptions = '<option value="all">جميع الطلاب</option>';
    students.forEach(student => {
      studentOptions += `<option value="${student.id}">${student.name}</option>`;
    });
    
    // Close previous modal
    const overlay = document.getElementById('absenceReportsOverlay');
    if (overlay) overlay.remove();
    
    const html = `
      <div id="absenceReportConfigOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center;" onclick="this.remove()">
        <div style="background: white; border-radius: 15px; width: 90%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; color: white; border-radius: 15px 15px 0 0; flex-shrink: 0;">
            <h3 style="margin: 0; text-align: center; font-size: 18px;">📊 تقرير غياب الطلاب</h3>
            <p style="margin: 5px 0 0 0; text-align: center; font-size: 13px; opacity: 0.9;">المعلم: ${teacherName}</p>
          </div>
          
          <div style="padding: 20px; overflow-y: auto; flex: 1;">
            <div style="background: rgba(102,126,234,0.1); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 6px; color: #333; font-weight: bold; font-size: 13px;">📅 اختر الفترة الزمنية:</label>
              
              <!-- Month Selector -->
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; color: #666; font-size: 12px;">اختر الشهر الهجري:</label>
                <select id="absenceMonthSelect" onchange="window.updateAbsenceDatesForMonth()" style="width: 100%; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 13px; font-weight: bold; background: white;">
                  ${monthOptions}
                </select>
              </div>
              
              <!-- Date Range Selectors -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <label style="display: block; margin-bottom: 4px; color: #666; font-size: 12px;">من تاريخ:</label>
                  <select id="absenceFromDate" style="width: 100%; padding: 8px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 12px;">
                    <option value="">-- اختر التاريخ --</option>
                  </select>
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 4px; color: #666; font-size: 12px;">إلى تاريخ:</label>
                  <select id="absenceToDate" style="width: 100%; padding: 8px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 12px;">
                    <option value="">-- اختر التاريخ --</option>
                  </select>
                </div>
              </div>
              
              <!-- Message for unavailable months -->
              <div id="absenceDateMessage" style="display: none; margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; color: #856404; font-size: 12px; text-align: center;">
                ⚠️ التواريخ لهذا الشهر غير مضافة بعد
              </div>
            </div>
            
            <!-- Report Type Selector -->
            <div style="background: rgba(102,126,234,0.1); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 8px; color: #333; font-weight: bold; font-size: 13px;">📋 نوع التقرير:</label>
              <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 8px 12px; background: white; border: 2px solid #e9ecef; border-radius: 8px; font-size: 13px; transition: all 0.3s;" onmouseover="this.style.borderColor='#667eea'" onmouseout="if(!this.querySelector('input').checked) this.style.borderColor='#e9ecef'">
                  <input type="radio" name="reportType" value="tardiness" id="reportTypeTardiness" style="width: 16px; height: 16px; cursor: pointer;" onchange="this.parentElement.style.borderColor='#667eea'; this.parentElement.style.background='rgba(102,126,234,0.1)'">
                  <span>⏰ تقرير التأخيرات</span>
                </label>
                
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 8px 12px; background: white; border: 2px solid #e9ecef; border-radius: 8px; font-size: 13px; transition: all 0.3s;" onmouseover="this.style.borderColor='#667eea'" onmouseout="if(!this.querySelector('input').checked) this.style.borderColor='#e9ecef'">
                  <input type="radio" name="reportType" value="absences" id="reportTypeAbsences" style="width: 16px; height: 16px; cursor: pointer;" onchange="this.parentElement.style.borderColor='#667eea'; this.parentElement.style.background='rgba(102,126,234,0.1)'">
                  <span>📊 تقرير الغيابات</span>
                </label>
              </div>
            </div>
            
            <label style="display: block; margin-bottom: 8px; color: #333; font-weight: bold;">👨‍🎓 اختر الطالب:</label>
            <select id="absenceStudentSelect" style="width: 100%; padding: 12px; border: 2px solid #e9ecef; border-radius: 10px; font-size: 15px; margin-bottom: 15px;">
              ${studentOptions}
            </select>
          </div>
          
          <div style="padding: 15px; background: #f8f9fa; border-top: 2px solid #e9ecef; flex-shrink: 0;">
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button onclick="document.getElementById('absenceReportConfigOverlay').remove()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                إلغاء
              </button>
              <button onclick="window.generateAbsenceReport('${classId}', '${teacherName}')" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">
                📊 عرض التقرير
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Trigger month change to populate dates for current month
    setTimeout(() => {
      window.updateAbsenceDatesForMonth();
    }, 100);
    
  } catch (error) {
    console.error('Error loading class data:', error);
    alert('حدث خطأ في تحميل بيانات الحلقة');
  }
};

// Update dates dropdown based on selected month
window.updateAbsenceDatesForMonth = async function() {
  const monthSelect = document.getElementById('absenceMonthSelect');
  const fromDateSelect = document.getElementById('absenceFromDate');
  const toDateSelect = document.getElementById('absenceToDate');
  const messageDiv = document.getElementById('absenceDateMessage');
  
  if (!monthSelect || !fromDateSelect || !toDateSelect) return;
  
  const selectedValue = monthSelect.value;
  
  if (!selectedValue) {
    fromDateSelect.innerHTML = '<option value="">-- اختر الشهر أولاً --</option>';
    toDateSelect.innerHTML = '<option value="">-- اختر الشهر أولاً --</option>';
    messageDiv.style.display = 'none';
    return;
  }
  
  // Parse year-month from value (e.g., "1447-11" or "1448-1")
  const [selectedYear, selectedMonth] = selectedValue.split('-').map(Number);
  
  try {
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    // Filter dates for selected year and month
    const filteredDates = accurateHijriDates.filter(dateEntry => {
      const [year, month] = dateEntry.hijri.split('-').map(Number);
      return year === selectedYear && month === selectedMonth;
    });
    
    // Check if dates exist for this month
    if (filteredDates.length === 0) {
      fromDateSelect.innerHTML = '<option value="">-- غير متوفر --</option>';
      toDateSelect.innerHTML = '<option value="">-- غير متوفر --</option>';
      messageDiv.style.display = 'block';
      return;
    }
    
    // Hide message if dates found
    messageDiv.style.display = 'none';
    
    // Build date options
    let dateOptions = '<option value="">-- اختر التاريخ --</option>';
    filteredDates.forEach(dateEntry => {
      const [year, month, day] = dateEntry.hijri.split('-').map(Number);
      const monthName = hijriMonths[month - 1];
      
      // Get day of week
      const gregorianDate = new Date(dateEntry.gregorian + 'T12:00:00');
      const dayOfWeek = gregorianDate.getDay();
      const dayName = dayNames[dayOfWeek];
      
      const displayText = `${dayName} ${day} ${monthName} ${year} هـ`;
      dateOptions += `<option value="${dateEntry.hijri}">${displayText}</option>`;
    });
    
    // Update both selects
    fromDateSelect.innerHTML = dateOptions;
    toDateSelect.innerHTML = dateOptions;
    
    // Set default values - first date and last date of month
    if (filteredDates.length > 0) {
      fromDateSelect.value = filteredDates[0].hijri;
      toDateSelect.value = filteredDates[filteredDates.length - 1].hijri;
    }
    
  } catch (error) {
    console.error('Error updating dates:', error);
    messageDiv.style.display = 'block';
  }
};

// Generate absence report
window.generateAbsenceReport = async function(classId, teacherName) {
  const fromDate = document.getElementById('absenceFromDate').value.trim();
  const toDate = document.getElementById('absenceToDate').value.trim();
  const studentSelection = document.getElementById('absenceStudentSelect').value;
  
  // Check report type selection
  const reportTypeTardiness = document.getElementById('reportTypeTardiness');
  const reportTypeAbsences = document.getElementById('reportTypeAbsences');
  
  if (!reportTypeTardiness.checked && !reportTypeAbsences.checked) {
    alert('⚠️ يرجى اختيار نوع التقرير (تأخيرات أو غيابات)');
    return;
  }
  
  const reportType = reportTypeTardiness.checked ? 'tardiness' : 'absences';
  
  if (!fromDate || !toDate) {
    alert('⚠️ يرجى إدخال الفترة الزمنية كاملة');
    return;
  }
  
  // Validate date format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(fromDate) || !datePattern.test(toDate)) {
    alert('⚠️ صيغة التاريخ غير صحيحة. استخدم: YYYY-MM-DD');
    return;
  }
  
  if (fromDate > toDate) {
    alert('⚠️ تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
    return;
  }
  
  // Route to appropriate report generator
  if (reportType === 'tardiness') {
    await generateTardinessReport(classId, teacherName, fromDate, toDate, studentSelection);
  } else {
    await generateAbsencesReport(classId, teacherName, fromDate, toDate, studentSelection);
  }
};

// Generate tardiness report
async function generateTardinessReport(classId, teacherName, fromDate, toDate, studentSelection) {
  try {
    // Show loading
    const configOverlay = document.getElementById('absenceReportConfigOverlay');
    if (configOverlay) configOverlay.remove();
    
    const loadingHtml = `
      <div id="absenceReportLoadingOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center;">
        <div style="background: white; padding: 30px; border-radius: 15px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
          <p style="margin: 0; font-size: 16px; color: #333;">جاري تحميل تقرير التأخيرات...</p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHtml);
    
    // Get students to analyze
    let studentsToAnalyze = [];
    
    if (studentSelection === 'all') {
      const studentsSnap = await getDocs(query(
        collection(db, 'users'),
        where('classId', '==', classId),
        where('role', '==', 'student')
      ));
      
      studentsSnap.forEach(doc => {
        studentsToAnalyze.push({
          id: doc.id,
          name: doc.data().name || 'غير محدد'
        });
      });
    } else {
      const studentDoc = await getDoc(firestoreDoc(db, 'users', studentSelection));
      if (studentDoc.exists()) {
        studentsToAnalyze.push({
          id: studentDoc.id,
          name: studentDoc.data().name || 'غير محدد'
        });
      }
    }
    
    if (studentsToAnalyze.length === 0) {
      alert('⚠️ لم يتم العثور على طلاب');
      document.getElementById('absenceReportLoadingOverlay').remove();
      return;
    }
    
    studentsToAnalyze.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Get all study dates in the range
    const studyDates = accurateHijriDates.filter(entry => {
      if (entry.hijri < fromDate || entry.hijri > toDate) return false;
      const gregDate = new Date(entry.gregorian);
      const dayOfWeek = gregDate.getDay();
      return dayOfWeek >= 0 && dayOfWeek <= 4;
    });
    
    if (studyDates.length === 0) {
      alert('⚠️ لا توجد أيام دراسية في الفترة المحددة');
      document.getElementById('absenceReportLoadingOverlay').remove();
      return;
    }
    
    // Analyze tardiness for each student (optimized with Promise.all)
    const reportData = [];
    
    console.log('⏰ Analyzing tardiness for date range:', fromDate, 'to', toDate);
    console.log('⏰ Study dates found:', studyDates.length);
    
    // Process all students in parallel
    const studentPromises = studentsToAnalyze.map(async (student) => {
      // Fetch all date reports for this student in parallel
      const datePromises = studyDates.map(dateEntry => 
        getDoc(firestoreDoc(db, 'studentProgress', student.id, 'dailyReports', dateEntry.hijri))
      );
      
      const reportSnaps = await Promise.all(datePromises);
      
      let tardinessCount = 0;
      reportSnaps.forEach((reportSnap, index) => {
        if (reportSnap.exists()) {
          const data = reportSnap.data();
          // Check if student was late using the 'late' field (not status)
          if (data.late === true) {
            tardinessCount++;
            console.log(`⏰ ${student.name} was late on ${studyDates[index].hijri}`);
          }
        }
      });
      
      console.log(`✅ ${student.name}: Total tardiness = ${tardinessCount}`);
      
      return {
        name: student.name,
        tardinessCount
      };
    });
    
    const results = await Promise.all(studentPromises);
    reportData.push(...results);
    
    // Remove loading
    document.getElementById('absenceReportLoadingOverlay').remove();
    
    // Display report
    displayTardinessReportTable(reportData, fromDate, toDate, teacherName, studyDates.length);
    
  } catch (error) {
    console.error('Error generating tardiness report:', error);
    alert('حدث خطأ في إنشاء تقرير التأخيرات');
    const loadingOverlay = document.getElementById('absenceReportLoadingOverlay');
    if (loadingOverlay) loadingOverlay.remove();
  }
}

// Print tardiness report function
window.printTardinessReport = function(reportData, fromDate, toDate, teacherName, totalDays) {
  const fromParts = fromDate.split('-');
  const toParts = toDate.split('-');
  const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  const fromDateDisplay = `${fromParts[2]} ${hijriMonths[parseInt(fromParts[1]) - 1]} ${fromParts[0]} هـ`;
  const toDateDisplay = `${toParts[2]} ${hijriMonths[parseInt(toParts[1]) - 1]} ${toParts[0]} هـ`;
  
  // Build table rows
  let tableRows = '';
  reportData.forEach((student, index) => {
    tableRows += `
      <tr>
        <td style="padding: 10px 12px; text-align: right; border: 1px solid #ddd;">${student.name}</td>
        <td style="padding: 10px 12px; text-align: center; border: 1px solid #ddd; font-weight: bold;">${student.tardinessCount}</td>
      </tr>
    `;
  });
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير تأخيرات الطلاب</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          direction: rtl;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #ff9800;
          padding-bottom: 15px;
        }
        .header h1 {
          color: #ff9800;
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .header p {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background: #ff9800;
          color: white;
          padding: 12px;
          text-align: center;
          border: 1px solid #ddd;
        }
        td {
          padding: 10px 12px;
          border: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
        @media print {
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⏰ تقرير تأخيرات الطلاب</h1>
        <p><strong>المعلم:</strong> ${teacherName}</p>
        <p><strong>الفترة:</strong> من ${fromDateDisplay} إلى ${toDateDisplay}</p>
        <p><strong>إجمالي الأيام الدراسية:</strong> ${totalDays} يوم</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>اسم الطالب</th>
            <th>مجموع التأخيرات</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

// Display tardiness report table
function displayTardinessReportTable(reportData, fromDate, toDate, teacherName, totalDays) {
  const fromParts = fromDate.split('-');
  const toParts = toDate.split('-');
  const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  const fromDateDisplay = `${fromParts[2]} ${hijriMonths[parseInt(fromParts[1]) - 1]} ${fromParts[0]} هـ`;
  const toDateDisplay = `${toParts[2]} ${hijriMonths[parseInt(toParts[1]) - 1]} ${toParts[0]} هـ`;
  
  // Build table rows
  let tableRows = '';
  reportData.forEach((student, index) => {
    const rowBg = index % 2 === 0 ? '#f8f9fa' : 'white';
    tableRows += `
      <tr style="background: ${rowBg};">
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e9ecef; font-size: 14px;">${student.name}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #ff9800; font-weight: bold; font-size: 14px;">${student.tardinessCount}</td>
      </tr>
    `;
  });
  
  // Store data in window object for print function
  window.currentTardinessReportData = {
    reportData: reportData,
    fromDate: fromDate,
    toDate: toDate,
    teacherName: teacherName,
    totalDays: totalDays
  };
  
  const html = `
    <div id="absenceReportResultOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center; overflow-y: auto; padding: 20px;" onclick="this.remove()">
      <div style="background: white; border-radius: 15px; width: 90%; max-width: 550px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); margin: auto;" onclick="event.stopPropagation()">
        <div style="background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%); padding: 18px 20px; color: white; border-radius: 15px 15px 0 0; position: relative;">
          <button onclick="document.getElementById('absenceReportResultOverlay').remove()" style="position: absolute; top: 12px; left: 15px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 22px; line-height: 1; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'" title="إغلاق">×</button>
          <button onclick="printTardinessReport(window.currentTardinessReportData.reportData, window.currentTardinessReportData.fromDate, window.currentTardinessReportData.toDate, window.currentTardinessReportData.teacherName, window.currentTardinessReportData.totalDays)" style="position: absolute; top: 12px; right: 15px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 18px; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'" title="طباعة">🖨️</button>
          <h3 style="margin: 0 0 6px 0; text-align: center; font-size: 18px; padding: 0 50px;">⏰ تقرير تأخيرات الطلاب</h3>
          <p style="margin: 0; text-align: center; font-size: 13px; opacity: 0.95;">المعلم: ${teacherName}</p>
          <p style="margin: 5px 0 0 0; text-align: center; font-size: 12px; opacity: 0.9;">من ${fromDateDisplay} إلى ${toDateDisplay}</p>
          <p style="margin: 5px 0 0 0; text-align: center; font-size: 11px; opacity: 0.85;">إجمالي الأيام الدراسية: ${totalDays} يوم</p>
        </div>
        
        <div style="padding: 20px; max-height: 450px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%); color: white;">
                <th style="padding: 10px 12px; text-align: right; border-radius: 8px 0 0 0; font-size: 13px;">اسم الطالب</th>
                <th style="padding: 10px 12px; text-align: center; border-radius: 0 8px 0 0; font-size: 13px;">مجموع التأخيرات</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

// Generate absences report (original function)
async function generateAbsencesReport(classId, teacherName, fromDate, toDate, studentSelection) {
  try {
    // Show loading
    const configOverlay = document.getElementById('absenceReportConfigOverlay');
    if (configOverlay) configOverlay.remove();
    
    const loadingHtml = `
      <div id="absenceReportLoadingOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center;">
        <div style="background: white; padding: 30px; border-radius: 15px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
          <p style="margin: 0; font-size: 16px; color: #333;">جاري تحميل التقرير...</p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHtml);
    
    // Get students to analyze
    let studentsToAnalyze = [];
    
    if (studentSelection === 'all') {
      // Get all students in the class
      const studentsSnap = await getDocs(query(
        collection(db, 'users'),
        where('classId', '==', classId),
        where('role', '==', 'student')
      ));
      
      studentsSnap.forEach(doc => {
        studentsToAnalyze.push({
          id: doc.id,
          name: doc.data().name || 'غير محدد'
        });
      });
    } else {
      // Get single student
      const studentDoc = await getDoc(firestoreDoc(db, 'users', studentSelection));
      if (studentDoc.exists()) {
        studentsToAnalyze.push({
          id: studentDoc.id,
          name: studentDoc.data().name || 'غير محدد'
        });
      }
    }
    
    if (studentsToAnalyze.length === 0) {
      alert('⚠️ لم يتم العثور على طلاب');
      document.getElementById('absenceReportLoadingOverlay').remove();
      return;
    }
    
    // Sort alphabetically
    studentsToAnalyze.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Get all study dates in the range
    const studyDates = accurateHijriDates.filter(entry => {
      if (entry.hijri < fromDate || entry.hijri > toDate) return false;
      
      // Check if it's a study day (Sunday to Thursday)
      const gregDate = new Date(entry.gregorian);
      const dayOfWeek = gregDate.getDay();
      return dayOfWeek >= 0 && dayOfWeek <= 4;
    });
    
    if (studyDates.length === 0) {
      alert('⚠️ لا توجد أيام دراسية في الفترة المحددة');
      document.getElementById('absenceReportLoadingOverlay').remove();
      return;
    }
    
    // Analyze absence for each student (optimized with Promise.all)
    const reportData = [];
    
    console.log('📊 Analyzing absence for date range:', fromDate, 'to', toDate);
    console.log('📊 Study dates found:', studyDates.length);
    
    // Process all students in parallel
    const studentPromises = studentsToAnalyze.map(async (student) => {
      // Fetch all date reports for this student in parallel
      const datePromises = studyDates.map(dateEntry => 
        getDoc(firestoreDoc(db, 'studentProgress', student.id, 'dailyReports', dateEntry.hijri))
      );
      
      const reportSnaps = await Promise.all(datePromises);
      
      let excusedAbsences = 0;
      let unexcusedAbsences = 0;
      
      reportSnaps.forEach((reportSnap, index) => {
        if (reportSnap.exists()) {
          const data = reportSnap.data();
          
          // Check attendance status
          if (data.status === 'absent') {
            if (data.excuseType === 'withExcuse') {
              excusedAbsences++;
            } else if (data.excuseType === 'withoutExcuse') {
              unexcusedAbsences++;
            }
          }
        }
      });
      
      console.log(`✅ ${student.name}: Excused=${excusedAbsences}, Unexcused=${unexcusedAbsences}`);
      
      return {
        name: student.name,
        excusedAbsences,
        unexcusedAbsences,
        totalAbsences: excusedAbsences + unexcusedAbsences
      };
    });
    
    const results = await Promise.all(studentPromises);
    reportData.push(...results);
    
    // Remove loading
    document.getElementById('absenceReportLoadingOverlay').remove();
    
    // Display report
    displayAbsenceReportTable(reportData, fromDate, toDate, teacherName, studyDates.length);
    
  } catch (error) {
    console.error('Error generating absence report:', error);
    alert('حدث خطأ في إنشاء التقرير');
    const loadingOverlay = document.getElementById('absenceReportLoadingOverlay');
    if (loadingOverlay) loadingOverlay.remove();
  }
}

// Print absence report function
window.printAbsenceReport = function(reportData, fromDate, toDate, teacherName, totalDays) {
  const fromParts = fromDate.split('-');
  const toParts = toDate.split('-');
  const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  const fromDateDisplay = `${fromParts[2]} ${hijriMonths[parseInt(fromParts[1]) - 1]} ${fromParts[0]} هـ`;
  const toDateDisplay = `${toParts[2]} ${hijriMonths[parseInt(toParts[1]) - 1]} ${toParts[0]} هـ`;
  
  // Build table rows
  let tableRows = '';
  reportData.forEach((student, index) => {
    tableRows += `
      <tr>
        <td style="padding: 10px 12px; text-align: right; border: 1px solid #ddd;">${student.name}</td>
        <td style="padding: 10px 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; color: #28a745;">${student.excusedAbsences}</td>
        <td style="padding: 10px 12px; text-align: center; border: 1px solid #ddd; font-weight: bold; color: #dc3545;">${student.unexcusedAbsences}</td>
        <td style="padding: 10px 12px; text-align: center; border: 1px solid #ddd; font-weight: bold;">${student.totalAbsences}</td>
      </tr>
    `;
  });
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير غياب الطلاب</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          direction: rtl;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #667eea;
          padding-bottom: 15px;
        }
        .header h1 {
          color: #667eea;
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .header p {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background: #667eea;
          color: white;
          padding: 12px;
          text-align: center;
          border: 1px solid #ddd;
        }
        td {
          padding: 10px 12px;
          border: 1px solid #ddd;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
        @media print {
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 تقرير غياب الطلاب</h1>
        <p><strong>المعلم:</strong> ${teacherName}</p>
        <p><strong>الفترة:</strong> من ${fromDateDisplay} إلى ${toDateDisplay}</p>
        <p><strong>إجمالي الأيام الدراسية:</strong> ${totalDays} يوم</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>اسم الطالب</th>
            <th>غياب بعذر</th>
            <th>غياب بدون عذر</th>
            <th>المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

// Display absence report table
function displayAbsenceReportTable(reportData, fromDate, toDate, teacherName, totalDays) {
  // Format dates for display
  const fromParts = fromDate.split('-');
  const toParts = toDate.split('-');
  const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  const fromDateDisplay = `${fromParts[2]} ${hijriMonths[parseInt(fromParts[1]) - 1]} ${fromParts[0]} هـ`;
  const toDateDisplay = `${toParts[2]} ${hijriMonths[parseInt(toParts[1]) - 1]} ${toParts[0]} هـ`;
  
  // Build table rows
  let tableRows = '';
  reportData.forEach((student, index) => {
    const rowBg = index % 2 === 0 ? '#f8f9fa' : 'white';
    tableRows += `
      <tr style="background: ${rowBg};">
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e9ecef; font-size: 14px;">${student.name}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #28a745; font-weight: bold; font-size: 14px;">${student.excusedAbsences}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #dc3545; font-weight: bold; font-size: 14px;">${student.unexcusedAbsences}</td>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e9ecef; font-weight: bold; font-size: 14px;">${student.totalAbsences}</td>
      </tr>
    `;
  });
  
  // Store data in window object for print function
  window.currentAbsenceReportData = {
    reportData: reportData,
    fromDate: fromDate,
    toDate: toDate,
    teacherName: teacherName,
    totalDays: totalDays
  };
  
  const html = `
    <div id="absenceReportResultOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 99999; display: flex; justify-content: center; align-items: center; overflow-y: auto; padding: 20px;" onclick="this.remove()">
      <div style="background: white; border-radius: 15px; width: 90%; max-width: 650px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); margin: auto;" onclick="event.stopPropagation()">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 18px 20px; color: white; border-radius: 15px 15px 0 0; position: relative;">
          <button onclick="document.getElementById('absenceReportResultOverlay').remove()" style="position: absolute; top: 12px; left: 15px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 22px; line-height: 1; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'" title="إغلاق">×</button>
          <button onclick="printAbsenceReport(window.currentAbsenceReportData.reportData, window.currentAbsenceReportData.fromDate, window.currentAbsenceReportData.toDate, window.currentAbsenceReportData.teacherName, window.currentAbsenceReportData.totalDays)" style="position: absolute; top: 12px; right: 15px; background: rgba(255,255,255,0.2); border: none; color: white; font-size: 18px; cursor: pointer; padding: 6px 12px; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'" title="طباعة">🖨️</button>
          <h3 style="margin: 0 0 6px 0; text-align: center; font-size: 18px; padding: 0 50px;">📊 تقرير غياب الطلاب</h3>
          <p style="margin: 0; text-align: center; font-size: 13px; opacity: 0.95;">المعلم: ${teacherName}</p>
          <p style="margin: 5px 0 0 0; text-align: center; font-size: 12px; opacity: 0.9;">من ${fromDateDisplay} إلى ${toDateDisplay}</p>
          <p style="margin: 5px 0 0 0; text-align: center; font-size: 11px; opacity: 0.85;">إجمالي الأيام الدراسية: ${totalDays} يوم</p>
        </div>
        
        <div style="padding: 20px; max-height: 450px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <th style="padding: 10px 12px; text-align: right; border-radius: 8px 0 0 0; font-size: 13px;">اسم الطالب</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 13px;">غياب بعذر</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 13px;">غياب بدون عذر</th>
                <th style="padding: 10px 12px; text-align: center; border-radius: 0 8px 0 0; font-size: 13px;">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

// ==================== ADMIN NAVBAR TOGGLE ====================

// Toggle admin sidebar navbar
window.toggleAdminNavbar = function() {
  const navbar = document.getElementById('adminSidebarNavbar');
  const overlay = document.getElementById('adminNavbarOverlay');
  
  if (navbar.style.display === 'none' || navbar.style.display === '') {
    // Open navbar
    navbar.style.display = 'block';
    overlay.style.display = 'block';
    
    // Animate slide in
    setTimeout(() => {
      navbar.style.transform = 'translateX(0)';
    }, 10);
  } else {
    // Close navbar
    navbar.style.transform = 'translateX(100%)';
    
    // Hide after animation
    setTimeout(() => {
      navbar.style.display = 'none';
      overlay.style.display = 'none';
    }, 300);
  }
};
// ==================== STUDENTS LIST MODAL ====================

// Open students list modal
window.openStudentsListModal = function() {
  // First, close the navbar
  const navbar = document.getElementById('adminSidebarNavbar');
  const overlay = document.getElementById('adminNavbarOverlay');
  
  if (navbar && navbar.style.display !== 'none') {
    navbar.style.transform = 'translateX(100%)';
    setTimeout(() => {
      navbar.style.display = 'none';
      overlay.style.display = 'none';
    }, 300);
  }
  
  // Then open the modal
  setTimeout(() => {
    const modal = document.getElementById('studentsListModal');
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      
      // Add to history for back button
      window.pushModalToHistory('studentsListModal');
    }
  }, navbar && navbar.style.display !== 'none' ? 350 : 0);
};

// Close students list modal
window.closeStudentsListModal = function() {
  const modal = document.getElementById('studentsListModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
  
  // Go back in history if modal was in stack
  if (window.modalStack.includes('studentsListModal')) {
    history.back();
  }
};

// ==================== NEW STUDENTS MODAL ====================

// Open new students modal
window.openNewStudentsModal = function() {
  // First, close the navbar
  const navbar = document.getElementById('adminSidebarNavbar');
  const overlay = document.getElementById('adminNavbarOverlay');
  
  if (navbar && navbar.style.display !== 'none') {
    navbar.style.transform = 'translateX(100%)';
    setTimeout(() => {
      navbar.style.display = 'none';
      overlay.style.display = 'none';
    }, 300);
  }
  
  // Then open the modal
  setTimeout(() => {
    const modal = document.getElementById('newStudentsModal');
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      
      // Add to history for back button
      window.pushModalToHistory('newStudentsModal');
    }
  }, navbar && navbar.style.display !== 'none' ? 350 : 0);
};

// Close new students modal
window.closeNewStudentsModal = function() {
  const modal = document.getElementById('newStudentsModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
  
  // Go back in history if modal was in stack
  if (window.modalStack.includes('newStudentsModal')) {
    history.back();
  }
};

// Show add new student form (placeholder - to be implemented later)
window.showAddNewStudentForm = function() {
  alert('⏳ سيتم تنفيذ هذه الميزة قريباً');
  // TODO: Implement add new student form functionality
};

// Show new students list (placeholder - to be implemented later)
window.showNewStudentsList = function() {
  alert('⏳ سيتم تنفيذ هذه الميزة قريباً');
  // TODO: Implement new students list table with details to be provided later
};

// Show WhatsApp contact modal
window.showWhatsAppModal = function(studentName, guardianPhone, teacherName = null, studentId = null, teacherId = null) {
  const modal = document.getElementById('whatsappContactModal');
  const nameDisplay = document.getElementById('whatsappStudentName');
  const phoneDisplay = document.getElementById('whatsappGuardianPhone');
  const whatsappLink = document.getElementById('whatsappContactLink');
  
  // Store data in modal for entry pass
  modal.dataset.studentName = studentName;
  modal.dataset.studentId = studentId || '';
  modal.dataset.teacherName = teacherName || '';
  modal.dataset.teacherId = teacherId || '';
  
  console.log('📝 Modal data stored:', { studentName, studentId, teacherName, teacherId });
  
  // Check if guardian phone exists
  if (!guardianPhone || guardianPhone === '-' || guardianPhone === '') {
    alert('⚠️ لا يوجد رقم جوال لولي أمر هذا الطالب');
    return;
  }
  
  // Fill modal data
  nameDisplay.textContent = studentName;
  phoneDisplay.textContent = guardianPhone;
  
  // Prepare WhatsApp message
  const message = `السلام عليكم ورحمة الله وبركاته،

نود إشعاركم بأن ابنكم ${studentName} متغيب عن الحلقات، وهذا الغياب يؤثر سلبًا على مستواه وتحصيله. نأمل منكم متابعته والحرص على انتظامه في الحضور.

شاكرين تعاونكم،
إدارة الحلقات`;
  
  // Format phone number (remove leading 0 and add 966 country code)
  const formattedPhone = guardianPhone.replace(/^0/, '');
  const encodedMessage = encodeURIComponent(message);
  
  // Set WhatsApp link
  whatsappLink.href = `https://wa.me/966${formattedPhone}?text=${encodedMessage}`;
  
  // Show modal
  modal.style.display = 'flex';
};

// Send Entry Pass to Teacher
window.sendEntryPass = async function() {
  const modal = document.getElementById('whatsappContactModal');
  const studentName = modal.dataset.studentName;
  const studentId = modal.dataset.studentId;
  const teacherName = modal.dataset.teacherName;
  const teacherId = modal.dataset.teacherId;
  
  console.log('🎫 Entry Pass clicked:', { studentName, studentId, teacherName, teacherId });
  
  if (!teacherName && !teacherId) {
    alert('⚠️ لا يمكن تحديد معلم الطالب');
    return;
  }
  
  if (!studentId) {
    alert('⚠️ لا يمكن تحديد معرف الطالب');
    return;
  }
  
  // Show loading
  const entryPassBtn = document.getElementById('entryPassBtn');
  const originalText = entryPassBtn.innerHTML;
  entryPassBtn.innerHTML = '<span style="font-size: 22px;">⏳</span><span>جاري التحميل...</span>';
  entryPassBtn.disabled = true;
  
  try {
    // Get teacher phone from Firestore - use teacherId if available, otherwise use teacherName
    let teacherPhone = null;
    
    if (teacherId) {
      console.log('🔍 Searching by teacherId:', teacherId);
      teacherPhone = await getTeacherPhone(teacherId);
    }
    
    if (!teacherPhone && teacherName) {
      console.log('🔍 Searching by teacherName:', teacherName);
      teacherPhone = await getTeacherPhone(teacherName);
    }
    
    if (!teacherPhone) {
      alert(`⚠️ لا يوجد رقم جوال للمعلم: ${teacherName}\n\n💡 تأكد من:\n• إضافة رقم المعلم في قاعدة البيانات\n• تطابق اسم المعلم بالضبط\n\n🔍 افتح Console (F12) لمزيد من التفاصيل`);
      entryPassBtn.innerHTML = originalText;
      entryPassBtn.disabled = false;
      return;
    }
    
    console.log('✅ Teacher phone found:', teacherPhone);
    
    // Get accurate Hijri date
    const todayAccurate = getTodayAccurateHijri();
    let todayFormatted = '';
    let dayName = '';
    
    if (todayAccurate) {
      dayName = todayAccurate.dayName || '';
      todayFormatted = formatAccurateHijriDate(todayAccurate.hijri);
    } else {
      // Fallback
      const fallback = getTodayForStorage();
      const parts = fallback.split('-');
      const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[parseInt(parts[1]) - 1];
      todayFormatted = `${parts[2]} ${monthName} ${parts[0]}هـ`;
    }
    
    // Count late occurrences from daily attendance records (READ ONLY - no new registration)
    const lateCount = await countStudentLateInCurrentMonth(studentId);
    
    // Determine action based on late count
    const action = determineActionForLateCount(lateCount);
    const newLateCount = lateCount;
    
    // Prepare entry pass message with late count and action
    let message = `🎫 بطاقة دخول الحلقة\n`;
    message += `━━━━━━━━━━━━━━━━━\n\n`;
    
    message += `📋 بيانات الطالب:\n`;
    message += `• الاسم: ${studentName}\n`;
    message += `• المعلم: ${teacherName}\n`;
    message += `• التاريخ: ${dayName} ${todayFormatted}\n\n`;
    
    message += `⏰ عدد التأخيرات في هذا الشهر: ${newLateCount}\n\n`;
    
    message += `${action.emoji} الإجراء المتخذ:\n`;
    message += `${action.description}\n\n`;
    
    // Add color-coded status
    let statusText = '';
    if (newLateCount === 1) {
      statusText = `🟡 الحالة: تحذير أولي`;
    } else if (newLateCount === 2 || newLateCount === 3) {
      statusText = `🟠 الحالة: تحذير متقدم`;
    } else if (newLateCount === 4) {
      statusText = `🔴 الحالة: حرج - يتطلب تدخل ولي الأمر`;
    } else if (newLateCount >= 5) {
      statusText = `⛔ الحالة: حرج جداً - قرار الفصل`;
    }
    
    message += statusText;
    message += `\n━━━━━━━━━━━━━━━━━`;
    
    // Format phone number
    const formattedPhone = teacherPhone.replace(/^0/, '');
    const encodedMessage = encodeURIComponent(message);
    
    // Open WhatsApp
    window.open(`https://wa.me/966${formattedPhone}?text=${encodedMessage}`, '_blank');
    
    // Reset button
    entryPassBtn.innerHTML = originalText;
    entryPassBtn.disabled = false;
    
  } catch (error) {
    console.error('Error sending entry pass:', error);
    alert('❌ حدث خطأ في إرسال بطاقة الدخول');
    entryPassBtn.innerHTML = originalText;
    entryPassBtn.disabled = false;
  }
};

// Close WhatsApp contact modal
window.closeWhatsAppModal = function() {
  const modal = document.getElementById('whatsappContactModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// Show ready messages menu
window.showReadyMessagesMenu = function() {
  const modal = document.getElementById('readyMessagesMenuModal');
  if (modal) {
    modal.style.display = 'flex';
  }
};

// Close ready messages menu
window.closeReadyMessagesMenu = function() {
  const modal = document.getElementById('readyMessagesMenuModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// Show absent without excuse modal
// Load absent report for a specific date
async function loadAbsentReportForDate(hijriDate) {
  const resultsDiv = document.getElementById('absentReportResults');
  
  if (!resultsDiv) return;
  
  // Show loading
  resultsDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;"><span style="font-size: 40px;">⏳</span><br>جاري تحميل بيانات الغائبين...</p>';
  
  try {
    // Get date details from accurateHijriDates
    const dateEntry = accurateHijriDates.find(e => e.hijri === hijriDate);
    
    let dateText = hijriDate;
    if (dateEntry) {
      const parts = dateEntry.hijri.split('-');
      const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[parseInt(parts[1]) - 1];
      dateText = `${dateEntry.dayName} - ${parts[2]} ${monthName} ${parts[0]} هـ`;
    }
    
    // Get all students and classes in parallel
    const [studentsSnap, classesSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
      getDocs(collection(db, 'classes'))
    ]);
    
    if (classesSnap.empty) {
      resultsDiv.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">لا توجد حلقات في النظام</p>';
      return;
    }
    
    // Create classes map for quick lookup
    const classesMap = {};
    classesSnap.forEach(classDoc => {
      const classData = classDoc.data();
      classesMap[classDoc.id] = {
        teacherName: classData.teacherName || classData.className || 'غير محدد',
        absentStudents: []
      };
    });
    
    // Get all student reports in parallel (much faster!)
    const reportPromises = studentsSnap.docs.map(async (studentDoc) => {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || 'غير محدد';
      const classId = studentData.classId;
      
      if (!classId || !classesMap[classId]) return null;
      
      const reportRef = firestoreDoc(db, 'studentProgress', studentId, 'dailyReports', hijriDate);
      const reportSnap = await getDoc(reportRef);
      
      if (reportSnap.exists()) {
        const reportData = reportSnap.data();
        
        // Check if student is absent without excuse
        if (reportData.status === 'absent' && reportData.excuseType === 'withoutExcuse') {
          return { classId, studentName };
        }
      }
      
      return null;
    });
    
    // Wait for all reports and filter nulls
    const results = (await Promise.all(reportPromises)).filter(r => r !== null);
    
    // Group by class
    let totalAbsent = 0;
    results.forEach(result => {
      if (classesMap[result.classId]) {
        classesMap[result.classId].absentStudents.push(result.studentName);
        totalAbsent++;
      }
    });
    
    // Convert to array and sort
    const classesData = Object.values(classesMap).map(classInfo => ({
      teacherName: classInfo.teacherName,
      absentStudents: classInfo.absentStudents.sort((a, b) => a.localeCompare(b, 'ar'))
    })).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ar'));
    
    // Build message
    let message = `📋 تقرير الغياب اليومي\n${dateText}\n\n`;
    
    classesData.forEach(classInfo => {
      message += `👨‍🏫 ${classInfo.teacherName}\n`;
      
      if (classInfo.absentStudents.length === 0) {
        message += `✅ لا يوجد طلاب غائبين بدون عذر\n\n`;
      } else {
        classInfo.absentStudents.forEach((studentName, index) => {
          message += `   ${index + 1}. ${studentName}\n`;
        });
        message += `\n`;
      }
    });
    
    message += `━━━━━━━━━━━━━━━━\n📊 المجموع: ${totalAbsent} طالب غائب بدون عذر`;
    
    // Encode message for WhatsApp
    const whatsappGroupLink = `https://chat.whatsapp.com/E9uZOmNEB2wElocpUYgBmb`;
    
    // Display results
    resultsDiv.innerHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px; border: 2px solid #e9ecef;">
        <div style="font-size: 13px; color: #666; margin-bottom: 8px; text-align: center;">📅 التاريخ</div>
        <div style="font-size: 15px; font-weight: bold; color: #333; text-align: center;">${dateText}</div>
      </div>
      
      <div id="messagePreview" style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px; border: 2px solid #e9ecef; max-height: 300px; overflow-y: auto;">
        <div style="white-space: pre-wrap; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.6; text-align: right;">
${message.split('\n').map(line => {
  if (line.includes('👨‍🏫')) {
    return `<div style="background: #667eea; color: white; padding: 8px 12px; border-radius: 8px; margin: 8px 0; font-weight: bold;">${line}</div>`;
  } else if (line.includes('✅')) {
    return `<div style="color: #28a745; padding: 4px 12px; font-style: italic;">${line}</div>`;
  } else if (line.includes('📊')) {
    return `<div style="background: #dc3545; color: white; padding: 10px 12px; border-radius: 8px; margin-top: 12px; font-weight: bold; text-align: center;">${line}</div>`;
  } else if (line.includes('━━━')) {
    return '<hr style="border: none; border-top: 2px dashed #ddd; margin: 10px 0;">';
  } else if (line.trim()) {
    return `<div style="padding: 2px 12px;">${line}</div>`;
  }
  return '';
}).join('')}
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button onclick="window.copyAbsentMessage(\`${message.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, event)" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: bold; box-shadow: 0 4px 15px rgba(102,126,234,0.3); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102,126,234,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102,126,234,0.3)'">
          <span style="font-size: 20px;">📋</span>
          <span>نسخ الرسالة</span>
        </button>
        
        <a href="${whatsappGroupLink}" target="_blank" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: bold; box-shadow: 0 4px 15px rgba(37,211,102,0.3); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(37,211,102,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(37,211,102,0.3)'">
          <span style="font-size: 20px;">📱</span>
          <span>فتح مجموعة الواتساب</span>
        </a>
      </div>
      
      <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
        <div style="font-size: 12px; color: #856404; text-align: center;">
          💡 انسخ الرسالة أولاً، ثم افتح المجموعة والصقها
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading absent students:', error);
    resultsDiv.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #dc3545;">
        <div style="font-size: 50px; margin-bottom: 10px;">❌</div>
        <div style="font-size: 16px; font-weight: bold;">حدث خطأ في تحميل البيانات</div>
        <div style="font-size: 13px; margin-top: 8px; color: #666;">${error.message}</div>
      </div>
    `;
  }
}

// Show Absent Without Excuse Modal with date selector
window.showAbsentWithoutExcuseModal = async function() {
  // Close the menu first
  window.closeReadyMessagesMenu();
  
  const modal = document.getElementById('absentWithoutExcuseModal');
  const content = document.getElementById('absentWithoutExcuseContent');
  
  // Get current Hijri date
  const todayHijri = getTodayForStorage(); // YYYY-MM-DD format
  const parts = todayHijri.split('-');
  const currentYear = parseInt(parts[0]);
  const currentMonth = parseInt(parts[1]);
  const currentDay = parts[2];
  
  // Import accurate Hijri dates to get available months
  const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
  
  // Extract unique year-month combinations
  const availableMonths = new Map(); // Map to store year-month with month names
  const hijriMonthNames = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  accurateHijriDates.forEach(entry => {
    const monthKey = `${entry.hijriYear}-${entry.hijriMonth}`;
    if (!availableMonths.has(monthKey)) {
      availableMonths.set(monthKey, {
        year: entry.hijriYear,
        month: entry.hijriMonth,
        name: hijriMonthNames[entry.hijriMonth - 1]
      });
    }
  });
  
  // Convert to sorted array
  const sortedMonths = Array.from(availableMonths.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  
  // Generate month options HTML
  const monthOptionsHTML = sortedMonths.map(m => {
    const value = `${m.year}-${m.month}`;
    const selected = (m.year === currentYear && m.month === currentMonth) ? 'selected' : '';
    return `<option value="${value}" ${selected}>${m.name} ${m.year}</option>`;
  }).join('');
  
  // Show modal
  if (modal) {
    modal.style.display = 'flex';
  }
  
  // Create date selector UI
  content.innerHTML = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
      <div style="text-align: center; color: white; font-size: 14px; font-weight: bold; margin-bottom: 12px;">
        📅 اختر التاريخ الهجري لعرض تقرير الغياب
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label style="display: block; color: white; font-size: 12px; margin-bottom: 5px; font-weight: bold;">الشهر</label>
          <select id="absentMonthSelect" style="width: 100%; padding: 10px; border: 2px solid white; border-radius: 8px; font-size: 14px; font-weight: bold; background: white; color: #333;">
            ${monthOptionsHTML}
          </select>
        </div>
        
        <div>
          <label style="display: block; color: white; font-size: 12px; margin-bottom: 5px; font-weight: bold;">اليوم</label>
          <select id="absentDaySelect" style="width: 100%; padding: 10px; border: 2px solid white; border-radius: 8px; font-size: 14px; font-weight: bold; background: white; color: #333;">
            ${Array.from({length: 30}, (_, i) => i + 1).map(day => {
              const dayStr = day.toString().padStart(2, '0');
              const selected = currentDay === dayStr ? 'selected' : '';
              return `<option value="${dayStr}" ${selected}>${day}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      
      <button id="loadAbsentReportBtn" style="width: 100%; padding: 12px; background: white; color: #667eea; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; margin-top: 12px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.2);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 15px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.2)'">
        🔍 عرض التقرير
      </button>
    </div>
    
    <div id="absentReportResults">
      <p style="text-align: center; color: #999; padding: 20px;">اختر التاريخ واضغط على "عرض التقرير" لعرض البيانات</p>
    </div>
  `;
  
  // Add event listener to the button
  document.getElementById('loadAbsentReportBtn').addEventListener('click', async () => {
    const monthValue = document.getElementById('absentMonthSelect').value;
    const day = document.getElementById('absentDaySelect').value;
    
    // Parse year and month from value
    const [year, month] = monthValue.split('-');
    const selectedDate = `${year}-${month.padStart(2, '0')}-${day}`;
    
    await loadAbsentReportForDate(selectedDate);
  });
  
  // Auto-load today's report
  await loadAbsentReportForDate(todayHijri);
};

// Copy absent message to clipboard
window.copyAbsentMessage = async function(message, event) {
  try {
    await navigator.clipboard.writeText(message);
    
    // Show success feedback
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span style="font-size: 20px;">✅</span><span>تم النسخ!</span>';
    btn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 2000);
  } catch (error) {
    console.error('Error copying message:', error);
    alert('حدث خطأ في نسخ الرسالة. الرجاء المحاولة مرة أخرى.');
  }
};

// Close absent without excuse modal
window.closeAbsentWithoutExcuseModal = function() {
  const modal = document.getElementById('absentWithoutExcuseModal');
  if (modal) {
    modal.style.display = 'none';
  }
};


// ==================== HISTORY API MANAGEMENT FOR MODALS ====================

// Track currently open modals for back button navigation
window.modalStack = window.modalStack || [];

// Add modal to history
window.pushModalToHistory = function(modalId) {
  if (!window.modalStack.includes(modalId)) {
    window.modalStack.push(modalId);
    history.pushState({ modal: modalId }, '', `#${modalId}`);
  }
};

// Remove modal from history
window.popModalFromHistory = function() {
  if (window.modalStack.length > 0) {
    window.modalStack.pop();
    if (window.modalStack.length === 0) {
      // No more modals, go back to clean URL
      history.pushState({}, '', window.location.pathname);
    }
  }
};

// Handle browser back button
window.addEventListener('popstate', function(event) {
  // Check if there are open modals
  const modals = [
    'dailyAttendanceModal',
    'studentsListModal',
    'newStudentsModal',
    'whatsappContactModal',
    'absentWithoutExcuseModal',
    'absenceReportConfigOverlay',
    'absenceReportResultOverlay'
  ];
  
  let hasOpenModal = false;
  
  // Close all visible modals
  modals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
      hasOpenModal = true;
      modal.style.display = 'none';
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Clear modal stack
      window.modalStack = window.modalStack.filter(id => id !== modalId);
    }
  });
  
  // If back button was pressed and no modal was open, let browser handle it normally
  if (!hasOpenModal && event.state === null) {
    // Normal navigation - browser will handle it
    return;
  }
  
  // Prevent default navigation if modal was closed
  if (hasOpenModal) {
    event.preventDefault();
  }
});

// Initialize history state on page load
window.addEventListener('load', function() {
  // Clear hash if present
  if (window.location.hash) {
    history.replaceState({}, '', window.location.pathname);
  }
  window.modalStack = [];
});

// ==========================================
// NEW MOBILE-FIRST DESIGN FUNCTIONS
// ==========================================

// Switch between admin sections in new design
window.switchAdminSection = function(sectionName) {
  // Hide all sections
  const allSections = document.querySelectorAll('.admin-main-section');
  allSections.forEach(section => section.classList.remove('active-section'));
  
  // Remove active class from all nav items
  const allNavItems = document.querySelectorAll('.nav-item');
  allNavItems.forEach(item => item.classList.remove('active'));
  
  // Show selected section
  let targetSection;
  switch(sectionName) {
    case 'dashboard':
      targetSection = document.getElementById('dashboardHomeSection');
      break;
    case 'students':
      targetSection = document.getElementById('studentsSection');
      break;
    case 'classes':
      targetSection = document.getElementById('classesSection');
      break;
    case 'tasks':
      targetSection = document.getElementById('tasksSection');
      break;
    case 'more':
      targetSection = document.getElementById('moreSection');
      break;
    default:
      targetSection = document.getElementById('dashboardHomeSection');
  }
  
  if (targetSection) {
    targetSection.classList.add('active-section');
  }
  
  // Add active class to clicked nav item
  const activeNavItem = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
  if (activeNavItem) {
    activeNavItem.classList.add('active');
  }
  
  // Show/hide main header based on section
  const mainHeader = document.getElementById('mainAdminHeader');
  if (mainHeader) {
    if (sectionName === 'dashboard') {
      // Show header only on dashboard
      mainHeader.style.display = 'flex';
    } else {
      // Hide header on other sections
      mainHeader.style.display = 'none';
    }
  }
  
  // Load classes dropdown when switching to classes section
  if (sectionName === 'classes') {
    window.loadClassesForNewDesign();
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Update Hijri Date in new header
window.updateNewAdminHijriDate = function() {
  const hijriDateElement = document.getElementById('hijriDateText');
  if (hijriDateElement) {
    const hijriData = getTodayAccurateHijri();
    if (hijriData && hijriData.hijri) {
      // Use the same formatting function as the old design
      const formattedDate = formatAccurateHijriDate(hijriData);
      // Remove " هـ" suffix as it's already in the icon/design
      hijriDateElement.textContent = formattedDate.replace(' هـ', '');
    } else {
      // Fallback if date not in accurate data
      const currentHijri = getCurrentHijriDate();
      hijriDateElement.textContent = `${currentHijri.day} ${currentHijri.monthName} ${currentHijri.year}`;
    }
  }
};

// Show all tasks
window.showAllTasks = function() {
  window.switchAdminSection('tasks');
};

// Show add task modal (placeholder for now)
window.showAddTaskModal = function() {
  alert('سيتم إضافة نموذج إضافة مهمة لاحقاً');
};

// Load dashboard statistics
window.loadDashboardStats = async function() {
  try {
    console.log('\n📊 ====== LOADING DASHBOARD STATISTICS ======');
    console.log('📌 Function: loadDashboardStats() called');
    
    // Count total students from ALL classes
    console.log('🔍 Step 1: Getting students from all classes...');
    console.log('📍 Reading from: users collection (role: student)');
    
    // Fetch all users and filter students
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = [];
    usersSnapshot.forEach(doc => {
      allUsers.push({ id: doc.id, ...doc.data() });
    });
    
    // Filter only students
    const students = allUsers.filter(user => user.role === 'student');
    const totalStudents = students.length;
    
    console.log(`📊 Total users in database: ${allUsers.length}`);
    console.log(`📊 Students found (role=student): ${totalStudents}`);
    console.log(`📊 Other users: ${allUsers.length - totalStudents}`);
    
    // Log first few students to verify data exists
    if (totalStudents > 0) {
      console.log('📝 First 5 students (sample):');
      students.slice(0, 5).forEach((student, index) => {
        console.log(`   ${index + 1}. ID: ${student.id || student.userId}, Name: ${student.name || 'N/A'}, Class: ${student.classId || 'Unknown'}`);
      });
    } else {
      console.warn('⚠️ WARNING: No students found in Firestore!');
      console.log('💡 TIP: Check if students are added in users collection with role: "student"');
      console.log('💡 Expected structure: users/{userId} with field role: "student"');
    }
    
    document.getElementById('totalStudentsCount').textContent = totalStudents;
    console.log(`✅ Updated DOM: totalStudentsCount = ${totalStudents}`);
    
    // Count total classes
    console.log('\n🔍 Step 2: Getting classes from Firestore...');
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const totalClasses = classesSnapshot.size;
    console.log(`📊 Raw classes count from Firestore: ${totalClasses}`);
    console.log(`📊 Number of class documents found: ${classesSnapshot.docs.length}`);
    
    // List all classes for verification
    const classNames = [];
    if (classesSnapshot.docs.length > 0) {
      console.log('📝 All classes in system:');
      let classIndex = 0;
      classesSnapshot.forEach(doc => {
        classIndex++;
        const data = doc.data();
        const className = data.className || data.classId || doc.id;
        classNames.push(className);
        console.log(`   ${classIndex}. ID: ${doc.id}, Name: ${className}`);
      });
    } else {
      console.warn('⚠️ WARNING: No classes found in Firestore!');
    }
    
    document.getElementById('totalClassesCount').textContent = totalClasses;
    console.log(`✅ Updated DOM: totalClassesCount = ${totalClasses}`);
    console.log('📋 Classes list:', classNames.join(', ') || 'No classes');
    
    // Count students per class (for debugging)
    if (totalClasses > 0) {
      console.log('\n🔍 DEBUG: Counting students in each class...');
      
      // Group students by class
      const studentsByClass = {};
      students.forEach(student => {
        const classId = student.classId;
        if (classId) {
          studentsByClass[classId] = (studentsByClass[classId] || 0) + 1;
        }
      });
      
      // Display count for each class
      classesSnapshot.forEach(doc => {
        const classId = doc.id;
        const count = studentsByClass[classId] || 0;
        const className = doc.data().className || doc.data().classId || classId;
        console.log(`   📚 ${classId} (${className}): ${count} students`);
      });
      
      const studentsWithoutClass = students.filter(s => !s.classId).length;
      if (studentsWithoutClass > 0) {
        console.log(`   ⚠️ Students without classId: ${studentsWithoutClass}`);
      }
    }
    
    // Load today's tasks from Firestore
    console.log('\n🔍 Step 3: Loading dashboard tasks...');
    await loadDashboardTasks();
    
    // Today's absent count (will be implemented later)
    document.getElementById('todayAbsentCount').textContent = '-';
    
    console.log('\n✅ ====== DASHBOARD STATISTICS LOADED SUCCESSFULLY ======\n');
    
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
    console.error('Error details:', error.message);
  }
};

// Load today's tasks for dashboard (top 3 important tasks)
window.loadDashboardTasks = async function() {
  try {
    console.log('\n📥 ====== LOADING DASHBOARD TASKS ======');
    console.log('📌 Function: loadDashboardTasks() called');
    
    const todayTasksList = document.getElementById('todayTasksList');
    if (!todayTasksList) {
      console.error('❌ ERROR: todayTasksList element not found in DOM!');
      return;
    }
    console.log('✅ todayTasksList element found');
    
    // Get today's date (use local timezone, not UTC)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    console.log(`📅 Today's date (local): ${todayString}`);
    console.log(`📅 System date: ${today.toLocaleString('ar-SA')} (UTC: ${today.toISOString()})`);
    
    // Get all tasks from Firestore
    console.log('🔍 Fetching all tasks from Firestore...');
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));
    
    console.log(`📊 Total tasks in Firestore: ${tasksSnapshot.size}`);
    console.log(`📊 Task documents found: ${tasksSnapshot.docs.length}`);
    
    if (tasksSnapshot.empty) {
      console.warn('⚠️ WARNING: No tasks found in Firestore!');
      todayTasksList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">لا توجد مهام اليوم</div>';
      document.getElementById('todayTasksCount').textContent = '0';
      return;
    }
    
    // Collect all tasks
    const allTasks = [];
    console.log('📝 All tasks in system:');
    let taskIndex = 0;
    tasksSnapshot.forEach(doc => {
      taskIndex++;
      const task = { id: doc.id, ...doc.data() };
      allTasks.push(task);
      console.log(`   ${taskIndex}. [${task.priority?.toUpperCase() || 'NO-PRIORITY'}] ${task.title || 'No title'} - Status: ${task.status || 'N/A'}, Date: ${task.date || 'N/A'}`);
    });
    
    // Count today's tasks only (for the counter)
    console.log(`\n🔍 Filtering tasks for today (${todayString})...`);
    const todayTasks = allTasks.filter(task => {
      if (task.recurrence === 'daily') return true;
      if (task.date === todayString) return true;
      return false;
    });
    console.log(`📊 Today's tasks count: ${todayTasks.length}`);
    todayTasks.forEach((task, index) => {
      console.log(`   ${index + 1}. ${task.title} (${task.recurrence === 'daily' ? 'Daily' : task.date})`);
    });
    document.getElementById('todayTasksCount').textContent = todayTasks.length;
    console.log(`✅ Updated DOM: todayTasksCount = ${todayTasks.length}`);
    
    // Filter tasks for dashboard display (exclude old completed tasks)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    const displayTasks = allTasks.filter(task => {
      // Exclude completed tasks older than yesterday
      if (task.status === 'completed' && task.date < yesterdayString) {
        return false;
      }
      return true;
    });
    
    // Sort by priority FIRST (high -> medium -> low), then by status
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    const statusOrder = { 'in-progress': 4, 'overdue': 3, 'pending': 2, 'completed': 1 };
    
    displayTasks.sort((a, b) => {
      // First by priority (most important!)
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by status (in-progress first)
      const statusDiff = (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
      if (statusDiff !== 0) return statusDiff;
      
      // Then by date (closer dates first)
      if (a.date && b.date) {
        return a.date.localeCompare(b.date);
      }
      
      // Finally by time
      return (a.time || '').localeCompare(b.time || '');
    });
    
    // Take top 3 tasks (regardless of date)
    const topTasks = displayTasks.slice(0, 3);
    
    console.log(`\n📊 FINAL RESULT:`);
    console.log(`   - Total tasks in system: ${allTasks.length}`);
    console.log(`   - Today's tasks: ${todayTasks.length}`);
    console.log(`   - Tasks to display (after filter): ${displayTasks.length}`);
    console.log(`   - Top 3 tasks by priority: ${topTasks.length}`);
    console.log('\n🏆 Top 3 Tasks to Display:');
    topTasks.forEach((task, index) => {
      console.log(`   ${index + 1}. [${task.priority?.toUpperCase()}] ${task.title} (${task.status}) - Date: ${task.date || 'N/A'}`);
    });
    
    if (topTasks.length === 0) {
      todayTasksList.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">لا توجد مهام</div>';
      return;
    }
    
    // Clear existing tasks
    todayTasksList.innerHTML = '';
    
    // Create task items
    topTasks.forEach(task => {
      const taskItem = createDashboardTaskItem(task);
      todayTasksList.appendChild(taskItem);
    });
    
    console.log(`✅ Loaded ${topTasks.length} dashboard tasks`);
    
  } catch (error) {
    console.error('❌ Error loading dashboard tasks:', error);
  }
};

// Create dashboard task item HTML
function createDashboardTaskItem(task) {
  const taskItem = document.createElement('div');
  
  // Map status to class names
  const statusClass = task.status === 'completed' ? 'completed' :
                      task.status === 'overdue' ? 'overdue' :
                      task.status === 'in-progress' ? 'in-progress' : 'not-started';
  
  const statusText = task.status === 'completed' ? 'مكتملة' :
                     task.status === 'overdue' ? 'متأخرة' :
                     task.status === 'in-progress' ? 'جاري التنفيذ' : 'لم تبدأ';
  
  // Format time (HH:MM)
  const timeFormatted = task.time ? task.time.substring(0, 5) : '00:00';
  
  // Priority icon
  const priorityIcons = {
    'high': '🔴',
    'medium': '🟠',
    'low': '🟢'
  };
  const priorityIcon = priorityIcons[task.priority] || '🟠';
  
  taskItem.className = `task-item ${statusClass}`;
  taskItem.innerHTML = `
    <div class="task-main">
      <div class="task-status-dot"></div>
      <div class="task-details">
        <div class="task-name">${task.title}</div>
        <div class="task-meta">
          <span class="task-assignee">👤 ${task.assignee || 'غير محدد'}</span>
          <span class="task-time">⏰ ${timeFormatted}</span>
          <span class="task-priority" style="margin-right: 8px;">${priorityIcon}</span>
        </div>
      </div>
    </div>
    <div class="task-badge ${statusClass}">${statusText}</div>
  `;
  
  // Add click event to navigate to task details
  taskItem.style.cursor = 'pointer';
  taskItem.addEventListener('click', function() {
    window.switchAdminSection('tasks');
  });
  
  return taskItem;
}

// Setup real-time listener for dashboard tasks
let dashboardTasksUnsubscribe = null;
function setupDashboardTasksListener() {
  // Unsubscribe from previous listener if exists
  if (dashboardTasksUnsubscribe) {
    dashboardTasksUnsubscribe();
  }
  
  console.log('🔄 Setting up dashboard tasks listener...');
  
  // Listen to changes in tasks collection
  dashboardTasksUnsubscribe = onSnapshot(
    collection(db, 'tasks'),
    (snapshot) => {
      console.log('📡 Dashboard tasks update received');
      
      // Reload dashboard tasks when any change occurs
      window.loadDashboardTasks();
    },
    (error) => {
      console.error('❌ Dashboard tasks listener error:', error);
    }
  );
  
  console.log('✅ Dashboard tasks real-time sync active');
}

// Setup real-time listener for dashboard statistics (students & classes)
let dashboardStatsUnsubscribe = null;
let dashboardUsersUnsubscribe = null;

function setupDashboardStatsListener() {
  // Unsubscribe from previous listeners if exist
  if (dashboardStatsUnsubscribe) {
    dashboardStatsUnsubscribe();
  }
  if (dashboardUsersUnsubscribe) {
    dashboardUsersUnsubscribe();
  }
  
  console.log('🔄 Setting up dashboard stats listeners...');
  
  // Listen to changes in classes collection
  dashboardStatsUnsubscribe = onSnapshot(
    collection(db, 'classes'),
    (snapshot) => {
      console.log('📡 Dashboard classes update received');
      reloadDashboardCounts();
    },
    (error) => {
      console.error('❌ Dashboard classes listener error:', error);
    }
  );
  
  // Listen to changes in users collection (for students count)
  dashboardUsersUnsubscribe = onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      console.log('📡 Dashboard users/students update received');
      reloadDashboardCounts();
    },
    (error) => {
      console.error('❌ Dashboard users listener error:', error);
    }
  );
  
  console.log('✅ Dashboard stats real-time sync active (classes + users)');
}

// Reload dashboard counts only (without tasks)
async function reloadDashboardCounts() {
  try {
    console.log('\n🔄 ====== RELOADING DASHBOARD COUNTS ======');
    console.log('📍 Function: reloadDashboardCounts() called (triggered by listener)');
    
    // Count total students from users collection
    console.log('🔍 Fetching students count from users collection...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const students = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.role === 'student') {
        students.push(data);
      }
    });
    const totalStudents = students.length;
    console.log(`📊 Students found: ${totalStudents}`);
    document.getElementById('totalStudentsCount').textContent = totalStudents;
    
    // Count total classes
    console.log('🔍 Fetching classes count...');
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const totalClasses = classesSnapshot.size;
    console.log(`📊 Classes found: ${totalClasses}`);
    document.getElementById('totalClassesCount').textContent = totalClasses;
    
    console.log(`✅ Stats updated successfully: ${totalStudents} students, ${totalClasses} classes`);
    console.log('✅ ====== DASHBOARD COUNTS RELOADED ======\n');
  } catch (error) {
    console.error('❌ Error reloading dashboard counts:', error);
  }
}

// Initialize new design when admin section is shown
window.initNewAdminDesign = async function() {
  console.log('\n🚀 ====== INITIALIZING NEW ADMIN DESIGN ======');
  console.log('📍 Function: initNewAdminDesign() called');
  
  // Show new design, hide old design
  const newDesign = document.getElementById('newAdminDesign');
  const oldDesign = document.getElementById('oldAdminDesign');
  
  console.log('🔍 Checking DOM elements:');
  console.log(`   - newAdminDesign: ${newDesign ? '✅ Found' : '❌ Not Found'}`);
  console.log(`   - oldAdminDesign: ${oldDesign ? '✅ Found' : '❌ Not Found'}`);
  
  if (newDesign && oldDesign) {
    newDesign.style.display = 'block';
    oldDesign.style.display = 'none';
    console.log('✅ Design switched: New design shown, old design hidden');
  } else {
    console.error('❌ ERROR: Cannot switch designs - elements not found!');
  }
  
  // Update Hijri date
  console.log('📅 Updating Hijri date...');
  window.updateNewAdminHijriDate();
  
  // Load dashboard stats and tasks (wait for completion)
  console.log('📊 Loading dashboard statistics and tasks...');
  try {
    await window.loadDashboardStats();
    console.log('✅ Dashboard stats loaded successfully');
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
  }
  
  // Setup real-time listeners for dashboard
  console.log('🔄 Setting up real-time listeners...');
  setupDashboardTasksListener();
  setupDashboardStatsListener();
  console.log('✅ Real-time listeners activated');
  
  // Set default section to dashboard
  console.log('🏠 Setting default section to dashboard...');
  window.switchAdminSection('dashboard');
  
  console.log('✅ ====== NEW ADMIN DESIGN INITIALIZED ======\n');
};

// END OF NEW MOBILE-FIRST DESIGN FUNCTIONS

// ========================================
// STUDENT MANAGEMENT FOR NEW DESIGN
// ========================================

// Add Student - New Design Version
window.addStudentNew = async function() {
  const name = document.getElementById("studentNameNew").value.trim();
  const birthDate = document.getElementById("studentBirthDateNew").value;
  const nationalId = document.getElementById("studentNationalIdNew").value.trim();
  const studentPhone = document.getElementById("studentPhoneNew").value.trim();
  const guardianPhone = document.getElementById("guardianPhoneNew").value.trim();
  const level = document.getElementById("studentLevelNew").value;
  const classId = document.getElementById("classSelectAddNew").value;
  const result = document.getElementById("resultNew");

  // Validation
  if (!name) {
    result.innerText = "❌ الرجاء إدخال اسم الطالب";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!birthDate) {
    result.innerText = "❌ الرجاء اختيار تاريخ الميلاد";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!guardianPhone) {
    result.innerText = "❌ الرجاء إدخال رقم جوال ولي الأمر";
    result.style.color = '#ff6b6b';
    return;
  }

  // Validate guardian phone format (10 digits)
  if (guardianPhone && !/^[0-9]{10}$/.test(guardianPhone)) {
    result.innerText = "❌ رقم جوال ولي الأمر يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }

  // Validate student phone format if provided (10 digits)
  if (studentPhone && !/^[0-9]{10}$/.test(studentPhone)) {
    result.innerText = "❌ رقم جوال الطالب يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!level) {
    result.innerText = "❌ الرجاء اختيار المستوى";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!classId) {
    result.innerText = "❌ الرجاء اختيار الحلقة";
    result.style.color = '#ff6b6b';
    return;
  }

  try {
    result.innerText = "⏳ جاري إضافة الطالب...";
    result.style.color = '#667eea';

    // Generate unique student ID
    const randomNumber = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const userId = `${classId}_${randomNumber}`;

    // Calculate age from birth date
    const birthDateObj = new Date(birthDate);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = todayDate.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDateObj.getDate())) {
      age--;
    }

    // Get current Hijri date for registration date
    const registrationDateHijri = formatHijriDate(todayDate);

    // Prepare student data
    const studentData = {
      userId: userId,
      name: name,
      role: "student",
      classId: classId,
      birthDate: birthDate,
      age: age,
      guardianPhone: guardianPhone,
      level: level,
      createdAt: serverTimestamp(),
      registrationDateHijri: registrationDateHijri,
      monthlyScore: 0,
      rank: 0
    };

    // Add optional fields if provided
    if (nationalId) {
      studentData.nationalId = nationalId;
    }
    if (studentPhone) {
      studentData.studentPhone = studentPhone;
    }

    // Save to Firestore
    await setDoc(firestoreDoc(db, "users", userId), studentData);

    // Update class document with new student
    const classDocRef = firestoreDoc(db, "classes", classId);
    await updateDoc(classDocRef, {
      studentIds: arrayUnion(userId)
    });

    result.innerText = `✅ تم إضافة الطالب بنجاح: ${name} (${userId})`;
    result.style.color = '#51cf66';
    
    // Clear form after short delay
    setTimeout(() => {
      document.getElementById("studentNameNew").value = "";
      document.getElementById("studentBirthDateNew").value = "";
      document.getElementById("studentNationalIdNew").value = "";
      document.getElementById("studentPhoneNew").value = "";
      document.getElementById("guardianPhoneNew").value = "";
      document.getElementById("studentLevelNew").value = "";
      document.getElementById("classSelectAddNew").value = "";
      result.innerText = "";
      
      // Close form
      const formContainer = document.getElementById('addStudentFormContainerNew');
      if (formContainer) {
        formContainer.style.display = 'none';
      }
      
      // Reload dashboard stats to reflect new student
      if (typeof window.loadDashboardStats === 'function') {
        window.loadDashboardStats();
      }
    }, 2000);

  } catch (error) {
    console.error("Error adding student:", error);
    result.innerText = `❌ خطأ في إضافة الطالب: ${error.message}`;
    result.style.color = '#ff6b6b';
  }
};

// Perform Student Search - New Design Version
window.performStudentSearchNew = async function() {
  const searchInput = document.getElementById('studentSearchInputNew').value.trim().toLowerCase();
  const resultsContainer = document.getElementById('searchResultsContainerNew');
  
  // If search is empty, show placeholder
  if (searchInput.length === 0) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 30px; font-size: 14px;">اكتب اسم الطالب للبحث...</p>';
    return;
  }
  
  // If search is less than 2 characters, ask for more
  if (searchInput.length < 2) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b; padding: 30px; font-size: 14px;">الرجاء إدخال حرفين على الأقل</p>';
    return;
  }
  
  try {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #667eea; padding: 30px; font-size: 14px;">🔍 جاري البحث...</p>';
    
    // Get all students
    const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    
    // Filter and score students by name
    const matchedStudents = [];
    studentsSnapshot.forEach(doc => {
      const studentData = doc.data();
      if (studentData.name) {
        const score = calculateSearchScore(studentData.name, searchInput);
        if (score > 0) {
          matchedStudents.push({
            id: doc.id,
            ...studentData,
            searchScore: score
          });
        }
      }
    });
    
    // Sort by score (highest first)
    matchedStudents.sort((a, b) => b.searchScore - a.searchScore);
    
    // Display results
    if (matchedStudents.length === 0) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
          <p style="color: #999; font-size: 15px; margin: 0;">لا توجد نتائج للبحث عن: <strong>"${searchInput}"</strong></p>
        </div>
      `;
      return;
    }
    
    // Store matched students globally for detail view
    window.searchResultsDataNew = matchedStudents;
    
    // Get class names for students
    const classIds = [...new Set(matchedStudents.map(s => s.classId).filter(Boolean))];
    const classNames = {};
    for (const classId of classIds) {
      try {
        const classDoc = await getDoc(firestoreDoc(db, 'classes', classId));
        if (classDoc.exists()) {
          classNames[classId] = classDoc.data().name || classId;
        }
      } catch (error) {
        classNames[classId] = classId;
      }
    }
    
    // Store class names globally
    window.searchClassNamesNew = classNames;
    
    // Display matched students as compact list
    let html = `
      <div style="margin-bottom: 12px; padding: 10px; background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 8px; text-align: center;">
        <span style="color: #1976d2; font-weight: bold; font-size: 14px;">🎯 النتائج: ${matchedStudents.length} طالب</span>
      </div>
      <div style="display: grid; gap: 8px;">
    `;
    
    matchedStudents.forEach((student, index) => {
      const className = classNames[student.classId] || 'غير محدد';
      
      html += `
        <div id="student-card-new-${index}" onclick="toggleStudentDetailsNew(${index})" 
          style="background: white; border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px; cursor: pointer; transition: all 0.3s; box-shadow: 0 2px 6px rgba(0,0,0,0.06);"
          onmouseover="this.style.borderColor='#28a745'; this.style.boxShadow='0 3px 12px rgba(40,167,69,0.2)'; this.style.transform='translateX(-3px)'"
          onmouseout="this.style.borderColor='#e0e0e0'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.06)'; this.style.transform='translateX(0)'">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <span style="font-size: 20px;">👤</span>
              <div>
                <div style="font-weight: bold; color: #333; font-size: 14px;">${student.name}</div>
                <div style="color: #999; font-size: 11px;">${student.id}</div>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                ${className}
              </span>
              <span id="toggle-icon-new-${index}" style="color: #28a745; font-size: 16px; transition: transform 0.3s;">▼</span>
            </div>
          </div>
          
          <div id="student-details-new-${index}" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 2px solid #f0f0f0;"></div>
        </div>
      `;
    });
    
    html += '</div>';
    resultsContainer.innerHTML = html;
    
  } catch (error) {
    console.error('Error searching students:', error);
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <div style="font-size: 40px; margin-bottom: 12px;">❌</div>
        <p style="color: #dc3545; font-size: 14px; margin: 0;">حدث خطأ في البحث: ${error.message}</p>
      </div>
    `;
  }
};

// Toggle student details in search results - New Design Version
window.toggleStudentDetailsNew = function(index) {
  const detailsDiv = document.getElementById(`student-details-new-${index}`);
  const toggleIcon = document.getElementById(`toggle-icon-new-${index}`);
  
  if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
    // Show details
    const student = window.searchResultsDataNew[index];
    const classNames = window.searchClassNamesNew;
    const levelIcon = student.level === 'hifz' ? '📚' : student.level === 'dabt' ? '✨' : '🌟';
    const levelName = student.level === 'hifz' ? 'حفظ' : student.level === 'dabt' ? 'ضبط' : 'القاعدة النورانية';
    
    let html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 10px;">
        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; text-align: center;">
          <div style="color: #999; font-size: 11px; margin-bottom: 3px;">المستوى</div>
          <div style="font-weight: bold; color: #667eea; font-size: 12px;">${levelIcon} ${levelName}</div>
        </div>
        
        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; text-align: center;">
          <div style="color: #999; font-size: 11px; margin-bottom: 3px;">العمر</div>
          <div style="font-weight: bold; color: #28a745; font-size: 12px;">${student.age || 'غير محدد'} سنة</div>
        </div>
    `;
    
    if (student.guardianPhone) {
      html += `
        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; text-align: center;">
          <div style="color: #999; font-size: 11px; margin-bottom: 3px;">جوال ولي الأمر</div>
          <div style="font-weight: bold; color: #333; font-size: 12px; direction: ltr;">${student.guardianPhone}</div>
        </div>
      `;
    }
    
    if (student.studentPhone) {
      html += `
        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; text-align: center;">
          <div style="color: #999; font-size: 11px; margin-bottom: 3px;">جوال الطالب</div>
          <div style="font-weight: bold; color: #333; font-size: 12px; direction: ltr;">${student.studentPhone}</div>
        </div>
      `;
    }
    
    html += `</div>`;
    
    // Action buttons
    html += `
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button onclick="showEditStudentFromSearch('${student.id}')" 
          style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 8px; border: none; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.3s; font-family: inherit; box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);"
          onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 9px rgba(102, 126, 234, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(102, 126, 234, 0.3)'">
          ✏️ تعديل
        </button>
        
        <button onclick="showTransferFromSearch('${student.id}', '${student.name}', '${student.classId}')" 
          style="flex: 1; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 10px 8px; border: none; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.3s; font-family: inherit; box-shadow: 0 2px 6px rgba(17, 153, 142, 0.3);"
          onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 9px rgba(17, 153, 142, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(17, 153, 142, 0.3)'">
          🔄 نقل
        </button>
        
        <button onclick="deleteStudentFromSearch('${student.id}', '${student.name}')" 
          style="flex: 1; background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; padding: 10px 8px; border: none; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.3s; font-family: inherit; box-shadow: 0 2px 6px rgba(235, 51, 73, 0.3);"
          onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 9px rgba(235, 51, 73, 0.4)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 6px rgba(235, 51, 73, 0.3)'">
          🗑️ حذف
        </button>
      </div>
    `;
    
    detailsDiv.innerHTML = html;
    detailsDiv.style.display = 'block';
    toggleIcon.style.transform = 'rotate(180deg)';
    toggleIcon.textContent = '▲';
  } else {
    // Hide details
    detailsDiv.style.display = 'none';
    toggleIcon.style.transform = 'rotate(0deg)';
    toggleIcon.textContent = '▼';
  }
};

// Load classes into dropdown - Called when Classes section is opened
window.loadClassesForNewDesign = async function() {
  const classSelect = document.getElementById('classSelectAddNew');
  
  if (!classSelect) return;
  
  try {
    // Clear existing options except the first one
    classSelect.innerHTML = '<option value="">-- اختر الحلقة --</option>';
    
    // Get all classes from Firestore
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    
    if (classesSnapshot.empty) {
      classSelect.innerHTML = '<option value="">لا توجد حلقات</option>';
      return;
    }
    
    // Add each class as an option
    classesSnapshot.forEach(doc => {
      const classData = doc.data();
      const classId = doc.id;
      const option = document.createElement('option');
      option.value = classId;
      // Display teacher name from teacherNames map, fallback to class name or ID
      const displayName = teacherNames[classId] || classData.teacherName || classData.name || classId;
      option.textContent = displayName;
      classSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading classes:', error);
    classSelect.innerHTML = '<option value="">خطأ في تحميل الحلقات</option>';
  }
};

// Update toggle functions to work with both designs
const originalToggleAddStudentForm = window.toggleAddStudentForm;
window.toggleAddStudentForm = function() {
  // Check if new design is active
  const newDesign = document.querySelector('.new-admin-design');
  const isNewDesignActive = newDesign && window.getComputedStyle(newDesign).display !== 'none';
  
  if (isNewDesignActive) {
    // Handle new design
    const formContainer = document.getElementById('addStudentFormContainerNew');
    const searchContainer = document.getElementById('searchStudentContainerNew');
    
    if (formContainer.style.display === 'none' || formContainer.style.display === '') {
      // Show add form, hide search
      formContainer.style.display = 'block';
      if (searchContainer) searchContainer.style.display = 'none';
      
      // Load classes if not loaded yet
      if (document.getElementById('classSelectAddNew').options.length <= 1) {
        window.loadClassesForNewDesign();
      }
      
      // Scroll to form
      setTimeout(() => {
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } else {
      // Hide form and clear inputs
      formContainer.style.display = 'none';
      document.getElementById('studentNameNew').value = '';
      document.getElementById('studentBirthDateNew').value = '';
      document.getElementById('studentNationalIdNew').value = '';
      document.getElementById('studentPhoneNew').value = '';
      document.getElementById('guardianPhoneNew').value = '';
      document.getElementById('studentLevelNew').value = '';
      document.getElementById('classSelectAddNew').value = '';
      document.getElementById('resultNew').innerText = '';
    }
  } else {
    // Call original function for old design
    if (originalToggleAddStudentForm) {
      originalToggleAddStudentForm();
    }
  }
};

const originalToggleStudentSearch = window.toggleStudentSearch;
window.toggleStudentSearch = function() {
  // Check if new design is active
  const newDesign = document.querySelector('.new-admin-design');
  const isNewDesignActive = newDesign && window.getComputedStyle(newDesign).display !== 'none';
  
  if (isNewDesignActive) {
    // Handle new design
    const searchContainer = document.getElementById('searchStudentContainerNew');
    const formContainer = document.getElementById('addStudentFormContainerNew');
    
    if (searchContainer.style.display === 'none' || searchContainer.style.display === '') {
      // Show search, hide add form
      searchContainer.style.display = 'block';
      if (formContainer) formContainer.style.display = 'none';
      
      // Clear previous search
      document.getElementById('studentSearchInputNew').value = '';
      document.getElementById('searchResultsContainerNew').innerHTML = '<p style="text-align: center; color: #999; padding: 30px; font-size: 14px;">اكتب اسم الطالب للبحث...</p>';
      
      // Scroll and focus
      setTimeout(() => {
        searchContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('studentSearchInputNew').focus();
      }, 100);
    } else {
      // Hide search
      searchContainer.style.display = 'none';
    }
  } else {
    // Call original function for old design
    if (originalToggleStudentSearch) {
      originalToggleStudentSearch();
    }
  }
};

// ========================================
// MODERN TASKS PAGE FUNCTIONS
// ========================================

// Global filter state
window.tasksFilterState = {
  status: 'all',
  priority: 'all',
  assignee: 'all',
  type: 'all',
  dateFrom: '',
  dateTo: '',
  period: 'today' // today, month, year
};

// Switch Tasks Period (Today/Month/Year)
window.switchTasksPeriod = function(period) {
  // Update filter state
  window.tasksFilterState.period = period;
  
  // Update active tab
  const allTabs = document.querySelectorAll('.period-tab');
  allTabs.forEach(tab => tab.classList.remove('active'));
  
  const activeTab = document.querySelector(`.period-tab[data-period="${period}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  // Reload tasks based on period
  loadTasksByPeriod(period);
};

// Load tasks by period
function loadTasksByPeriod(period) {
  console.log(`Loading tasks for period: ${period}`);
  // Here you would fetch tasks from Firebase based on period
  // For now, we'll just log it
}

// Open Tasks Filter Modal
window.openTasksFilter = function() {
  const modal = document.getElementById('tasksFilterModal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }
};

// Close Tasks Filter Modal
window.closeTasksFilter = function() {
  const modal = document.getElementById('tasksFilterModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
  }
};

// Close filter on outside click
window.closeTasksFilterOnOutside = function(event) {
  if (event.target.id === 'tasksFilterModal') {
    closeTasksFilter();
  }
};

// Handle filter option selection
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for DOM to be ready
  setTimeout(() => {
    const filterButtons = document.querySelectorAll('.filter-option-btn');
    
    filterButtons.forEach(button => {
      button.addEventListener('click', function() {
        const filterType = this.getAttribute('data-filter');
        const filterValue = this.getAttribute('data-value');
        
        // Remove active from siblings
        const siblings = this.parentElement.querySelectorAll('.filter-option-btn');
        siblings.forEach(btn => btn.classList.remove('active'));
        
        // Add active to clicked button
        this.classList.add('active');
        
        // Update filter state
        if (filterType === 'status') {
          window.tasksFilterState.status = filterValue;
        } else if (filterType === 'priority') {
          window.tasksFilterState.priority = filterValue;
        } else if (filterType === 'assignee') {
          window.tasksFilterState.assignee = filterValue;
        } else if (filterType === 'type') {
          window.tasksFilterState.type = filterValue;
        }
      });
    });
  }, 500);
});

// Apply Tasks Filter
window.applyTasksFilter = function() {
  // Get date filters
  const dateFrom = document.getElementById('filterDateFrom')?.value || '';
  const dateTo = document.getElementById('filterDateTo')?.value || '';
  
  window.tasksFilterState.dateFrom = dateFrom;
  window.tasksFilterState.dateTo = dateTo;
  
  // Apply filter logic
  filterTasks();
  
  // Close modal
  closeTasksFilter();
  
  // Show feedback
  console.log('Filter applied:', window.tasksFilterState);
};

// Reset Tasks Filter
window.resetTasksFilter = function() {
  // Reset state
  window.tasksFilterState = {
    status: 'all',
    priority: 'all',
    assignee: 'all',
    type: 'all',
    dateFrom: '',
    dateTo: '',
    period: window.tasksFilterState.period // Keep current period
  };
  
  // Reset UI
  document.querySelectorAll('.filter-option-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-value') === 'all') {
      btn.classList.add('active');
    }
  });
  
  // Reset date inputs
  const dateFrom = document.getElementById('filterDateFrom');
  const dateTo = document.getElementById('filterDateTo');
  if (dateFrom) dateFrom.value = '';
  if (dateTo) dateTo.value = '';
  
  // Reload all tasks
  filterTasks();
  
  console.log('Filter reset');
};

// Filter tasks based on current filter state
function filterTasks() {
  const allCards = document.querySelectorAll('.task-modern-card');
  let visibleCount = 0;
  
  allCards.forEach(card => {
    let shouldShow = true;
    
    // Filter by status
    if (window.tasksFilterState.status !== 'all') {
      const cardStatus = card.getAttribute('data-status');
      if (cardStatus !== window.tasksFilterState.status) {
        shouldShow = false;
      }
    }
    
    // Filter by priority
    if (window.tasksFilterState.priority !== 'all') {
      const cardPriority = card.getAttribute('data-priority');
      if (cardPriority !== window.tasksFilterState.priority) {
        shouldShow = false;
      }
    }
    
    // Show/hide card
    if (shouldShow) {
      card.style.display = 'block';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });
  
  // Update visible count
  const countBadge = document.getElementById('visibleTasksCount');
  if (countBadge) {
    countBadge.textContent = `${visibleCount} مهمة`;
  }
}

// Update Tasks Hijri Date
window.updateTasksHijriDate = function() {
  const hijriDateElement = document.getElementById('tasksHijriDate');
  if (hijriDateElement && typeof getTodayAccurateHijri === 'function') {
    const hijriData = getTodayAccurateHijri();
    if (hijriData && hijriData.hijri) {
      if (typeof formatAccurateHijriDate === 'function') {
        const formattedDate = formatAccurateHijriDate(hijriData);
        hijriDateElement.textContent = formattedDate.replace(' هـ', '');
      }
    }
  }
};

// Load Tasks Stats
window.loadTasksStats = async function() {
  // Update stats based on actual DOM tasks
  updateTasksStats();
  console.log('✅ Tasks stats loaded');
};

// Initialize Tasks Page
window.initTasksPage = async function() {
  try {
    console.log('🔧 Initializing Tasks Page...');
    
    // Update Hijri date
    updateTasksHijriDate();
    
    // Load saved tasks from Firestore
    console.log('📥 Loading tasks from Firestore...');
    await loadTasksFromStorage();
    
    // Load stats
    loadTasksStats();
    
    // Set default period to today
    switchTasksPeriod('today');
    
    // Setup real-time listener for automatic sync across devices
    console.log('🔄 Setting up real-time listener...');
    setupTasksRealtimeListener();
    
    console.log('✅ Tasks page initialized with real-time sync');
  } catch (error) {
    console.error('❌ Error initializing tasks page:', error);
    alert('حدث خطأ في تحميل المهام. تأكد من اتصالك بالإنترنت.');
  }
};

// Call init when switching to tasks section
const originalSwitchAdminSection = window.switchAdminSection;
window.switchAdminSection = function(sectionName) {
  // Call original function
  originalSwitchAdminSection(sectionName);
  
  // Initialize tasks page if switching to it
  if (sectionName === 'tasks') {
    console.log('📋 Switching to tasks section...');
    // Small delay to ensure DOM is ready
    setTimeout(async () => {
      try {
        await initTasksPage();
      } catch (error) {
        console.error('❌ Error in initTasksPage:', error);
      }
    }, 100);
  }
};

// ========================================
// ADD NEW TASK PAGE FUNCTIONS
// ========================================

// Global variables for task form
window.currentTaskType = 'daily';
window.currentPriority = 'medium';

// Open Add Task Page
window.openAddTaskPage = function() {
  const tasksSection = document.getElementById('tasksSection');
  const addTaskPage = document.getElementById('addTaskPage');
  
  if (tasksSection && addTaskPage) {
    // Hide tasks list, show add task page
    tasksSection.style.display = 'none';
    addTaskPage.style.display = 'block';
    
    // Reset form
    resetTaskForm();
    
    // Set default date and time
    const now = new Date();
    const dateInput = document.getElementById('newTaskDate');
    const timeInput = document.getElementById('newTaskTime');
    
    if (dateInput) {
      dateInput.value = now.toISOString().split('T')[0];
    }
    
    if (timeInput) {
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      timeInput.value = `${hours}:${minutes}`;
    }
  }
};

// Close Add Task Page
window.closeAddTaskPage = function() {
  const tasksSection = document.getElementById('tasksSection');
  const addTaskPage = document.getElementById('addTaskPage');
  
  if (tasksSection && addTaskPage) {
    // Show tasks list, hide add task page
    addTaskPage.style.display = 'none';
    tasksSection.style.display = 'block';
  }
};

// Reset Task Form
function resetTaskForm() {
  // Reset text inputs
  const titleInput = document.getElementById('newTaskTitle');
  const descInput = document.getElementById('newTaskDescription');
  const assigneeSelect = document.getElementById('newTaskAssignee');
  const recurrenceSelect = document.getElementById('newTaskRecurrence');
  
  if (titleInput) titleInput.value = '';
  if (descInput) descInput.value = '';
  if (assigneeSelect) assigneeSelect.value = '';
  if (recurrenceSelect) recurrenceSelect.value = 'none';
  
  // Reset task type to daily
  window.currentTaskType = 'daily';
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.type === 'daily') {
      btn.classList.add('active');
    }
  });
  
  // Reset priority to medium
  window.currentPriority = 'medium';
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.priority === 'medium') {
      btn.classList.add('active');
    }
  });
  
  // Reset form visibility (show all fields by default)
  handleRecurrenceChange();
}

// Handle Recurrence Change - Dynamic Form Logic
window.handleRecurrenceChange = function() {
  const recurrence = document.getElementById('newTaskRecurrence')?.value || 'none';
  const taskTypeSection = document.getElementById('taskTypeSection');
  const taskDateSection = document.getElementById('taskDateSection');
  const taskTimeSection = document.getElementById('taskTimeSection');
  
  if (recurrence === 'daily') {
    // For daily recurring tasks: hide task type and date, show only time
    if (taskTypeSection) {
      taskTypeSection.style.maxHeight = taskTypeSection.scrollHeight + 'px';
      setTimeout(() => {
        taskTypeSection.style.maxHeight = '0px';
        taskTypeSection.style.opacity = '0';
        taskTypeSection.style.marginBottom = '0';
        taskTypeSection.style.overflow = 'hidden';
      }, 10);
    }
    
    if (taskDateSection) {
      taskDateSection.style.maxHeight = taskDateSection.scrollHeight + 'px';
      setTimeout(() => {
        taskDateSection.style.maxHeight = '0px';
        taskDateSection.style.opacity = '0';
        taskDateSection.style.overflow = 'hidden';
        taskDateSection.style.display = 'none';
      }, 10);
    }
    
    // Expand time section to full width
    if (taskTimeSection) {
      taskTimeSection.classList.remove('half');
      taskTimeSection.classList.add('full-width');
    }
    
    console.log('📋 Recurring daily task mode - simplified form');
    
  } else {
    // For non-recurring or other recurrence types: show all fields
    if (taskTypeSection) {
      taskTypeSection.style.maxHeight = '1000px';
      taskTypeSection.style.opacity = '1';
      taskTypeSection.style.marginBottom = '';
      taskTypeSection.style.overflow = 'visible';
    }
    
    if (taskDateSection) {
      taskDateSection.style.display = 'block';
      setTimeout(() => {
        taskDateSection.style.maxHeight = '1000px';
        taskDateSection.style.opacity = '1';
        taskDateSection.style.overflow = 'visible';
      }, 10);
    }
    
    // Restore half width for date and time
    if (taskTimeSection) {
      taskTimeSection.classList.remove('full-width');
      taskTimeSection.classList.add('half');
    }
    
    console.log('📋 Standard task mode - full form');
  }
};

// Select Task Type
window.selectTaskType = function(type) {
  window.currentTaskType = type;
  
  // Update UI
  document.querySelectorAll('.segment-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.type === type) {
      btn.classList.add('active');
    }
  });
};

// Select Priority
window.selectPriority = function(priority) {
  window.currentPriority = priority;
  
  // Update UI
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.priority === priority) {
      btn.classList.add('active');
    }
  });
};

// Save New Task
window.saveNewTask = async function() {
  // Get form values
  const title = document.getElementById('newTaskTitle')?.value.trim();
  const description = document.getElementById('newTaskDescription')?.value.trim();
  const assignee = document.getElementById('newTaskAssignee')?.value;
  const date = document.getElementById('newTaskDate')?.value;
  const time = document.getElementById('newTaskTime')?.value;
  const recurrence = document.getElementById('newTaskRecurrence')?.value;
  
  // Validation
  if (!title) {
    alert('❌ الرجاء إدخال عنوان المهمة');
    return;
  }
  
  if (!assignee) {
    alert('❌ الرجاء اختيار المسؤول');
    return;
  }
  
  // Date validation: only required if recurrence is not daily
  if (recurrence !== 'daily' && !date) {
    alert('❌ الرجاء اختيار التاريخ');
    return;
  }
  
  if (!time) {
    alert('❌ الرجاء اختيار الوقت');
    return;
  }
  
  try {
    // For daily recurring tasks, use today's date automatically
    const taskDate = recurrence === 'daily' ? new Date().toISOString().split('T')[0] : date;
    
    // Prepare task data
    const taskData = {
      title: title,
      description: description || '',
      type: window.currentTaskType || 'daily',
      assignee: assignee,
      date: taskDate,
      time: time,
      priority: window.currentPriority,
      recurrence: recurrence || 'none',
      status: 'in-progress', // Default status for new tasks
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    };
    
    console.log('New task created:', taskData);
    
    // Generate task ID first
    const taskId = 'task_' + Date.now();
    taskData.id = taskId;
    
    // Track this task BEFORE saving to prevent duplicate when listener fires
    locallyAddedTaskIds.add(taskId);
    console.log('🔒 Task ID tracked before saving:', taskId);
    
    // Add to DOM immediately for instant feedback (optimistic update)
    addTaskToList(taskData);
    console.log('✅ Task added with optimistic update');
    
    // Save to Firestore (async - listener will be ignored via Set)
    await saveTaskToStorage(taskData);
    console.log('💾 Task saved to Firestore');
    
    // Update stats
    updateTasksStats();
    
    // Show success toast
    showSuccessToast('✅ تم إضافة المهمة بنجاح');
    
    // Close page and return to appropriate tasks view
    setTimeout(() => {
      closeAddTaskPage();
      
      // Switch to appropriate period tab based on task type
      if (window.currentTaskType === 'daily') {
        switchTasksPeriod('today');
      } else if (window.currentTaskType === 'monthly') {
        switchTasksPeriod('month');
      } else if (window.currentTaskType === 'yearly') {
        switchTasksPeriod('year');
      }
    }, 1500);
    
  } catch (error) {
    console.error('Error saving task:', error);
    alert('❌ حدث خطأ في حفظ المهمة: ' + error.message);
  }
};

// Add Task to List (DOM)
function addTaskToList(taskData) {
  const tasksCardsList = document.getElementById('tasksCardsList');
  if (!tasksCardsList) return;
  
  // Use existing ID or generate new one
  const taskId = taskData.id || 'task_' + Date.now();
  
  // Helper function to format Hijri date from Gregorian date string
  const getHijriDateDisplay = (gregorianDateString) => {
    try {
      // Find exact match in accurate Hijri calendar data
      const hijriEntry = accurateHijriDates.find(entry => entry.gregorian === gregorianDateString);
      
      if (hijriEntry) {
        // Use data from accurate calendar
        const hijriMonths = [
          'المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
          'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
          'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
        ];
        
        const monthName = hijriMonths[hijriEntry.hijriMonth - 1];
        return `${hijriEntry.hijriDay} ${monthName} ${hijriEntry.hijriYear} هـ`;
      } else {
        // Date not in accurate calendar - show Gregorian as fallback
        console.warn(`Date ${gregorianDateString} not found in accurate Hijri calendar`);
        return gregorianDateString;
      }
    } catch (error) {
      console.error('Error converting to Hijri:', error);
      return gregorianDateString;
    }
  };
  
  // Get type icons
  const typeIcons = {
    'daily': '🔁',
    'monthly': '📊',
    'yearly': '📆'
  };
  
  const typeLabels = {
    'daily': 'يومية',
    'monthly': 'شهرية',
    'yearly': 'سنوية'
  };
  
  const priorityIcons = {
    'low': '🟢',
    'medium': '🟠',
    'high': '🔴'
  };
  
  const priorityLabels = {
    'low': 'منخفضة',
    'medium': 'متوسطة',
    'high': 'عالية'
  };
  
  const statusBadges = {
    'pending': { class: 'pending', label: 'قيد الانتظار' },
    'in-progress': { class: 'in-progress', label: 'جاري التنفيذ' },
    'completed': { class: 'completed', label: 'مكتملة' },
    'overdue': { class: 'overdue', label: 'متأخرة' }
  };
  
  // Format time for display
  const timeFormatted = taskData.time || '00:00';
  const timeDisplay = timeFormatted.substring(0, 5); // HH:MM format
  
  // Create task card HTML
  const taskCard = document.createElement('div');
  taskCard.className = 'task-modern-card';
  taskCard.dataset.status = taskData.status || 'in-progress';
  taskCard.dataset.priority = taskData.priority || 'medium';
  taskCard.dataset.type = taskData.type || 'daily';
  taskCard.dataset.taskId = taskId;
  
  const statusBadge = statusBadges[taskData.status] || statusBadges['in-progress'];
  
  taskCard.innerHTML = `
    <div class="task-card-header">
      <div class="task-title-row">
        <span class="task-priority-dot ${taskData.priority}"></span>
        <h4 class="task-card-title">${taskData.title}</h4>
      </div>
      <div class="task-status-dropdown-container" style="position: relative;">
        <span class="task-status-badge ${statusBadge.class}" onclick="toggleTaskDropdown(event, '${taskData.id || taskId}')" style="cursor: pointer; user-select: none;" title="اضغط للخيارات">
          ${statusBadge.label}
        </span>
        <div class="task-dropdown-menu" id="dropdown-${taskData.id || taskId}" style="display: none; position: absolute; top: 100%; left: 0; background: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); padding: 8px; min-width: 140px; z-index: 1000; margin-top: 5px;">
          <div onclick="markTaskComplete('${taskData.id || taskId}')" style="padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333;" onmouseover="this.style.background='#e8f5e9'" onmouseout="this.style.background='transparent'">
            <span style="font-size: 16px;">✅</span>
            <span style="font-weight: 600;">مكتملة</span>
          </div>
          <div onclick="deleteTask('${taskData.id || taskId}')" style="padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #dc3545;" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background='transparent'">
            <span style="font-size: 16px;">🗑️</span>
            <span style="font-weight: 600;">حذف</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="task-card-meta">
      <div class="task-meta-item">
        <span class="meta-icon">👤</span>
        <span class="meta-text">${taskData.assignee}</span>
      </div>
      <div class="task-meta-item">
        <span class="meta-icon">🕘</span>
        <span class="meta-text">${timeDisplay}</span>
      </div>
      <div class="task-meta-item">
        ${taskData.recurrence === 'daily' 
          ? `<span class="meta-icon">🔁</span>
             <span class="meta-text">يومية</span>`
          : `<span class="meta-icon">📅</span>
             <span class="meta-text">${getHijriDateDisplay(taskData.date)}</span>`
        }
      </div>
      <div class="task-meta-item priority">
        <span class="meta-icon">${priorityIcons[taskData.priority]}</span>
        <span class="meta-text">${priorityLabels[taskData.priority]}</span>
      </div>
    </div>
  `;
  
  // Add animation
  taskCard.style.animation = 'slideUp 0.4s ease';
  
  // Insert at the beginning of the list
  tasksCardsList.insertBefore(taskCard, tasksCardsList.firstChild);
  
  console.log('Task added to DOM:', taskId);
}

// Save task to Firestore
async function saveTaskToStorage(taskData) {
  try {
    // Use existing ID if present, otherwise generate new one
    const taskId = taskData.id || 'task_' + Date.now();
    taskData.id = taskId;
    
    // Save to Firestore
    await setDoc(firestoreDoc(db, 'tasks', taskId), {
      ...taskData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Task saved to Firestore:', taskId);
    return taskId;
  } catch (error) {
    console.error('❌ Error saving task to Firestore:', error);
    throw error;
  }
}

// Load tasks from Firestore
async function loadTasksFromStorage() {
  try {
    console.log('📡 Connecting to Firestore...');
    
    // Get tasks from Firestore
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));
    
    if (tasksSnapshot.empty) {
      console.log('ℹ️ No saved tasks in Firestore (collection is empty)');
      return;
    }
    
    const savedTasks = [];
    tasksSnapshot.forEach(doc => {
      const taskData = { id: doc.id, ...doc.data() };
      savedTasks.push(taskData);
      console.log('📄 Loaded task:', taskData.title || taskData.id);
    });
    
    console.log(`📂 Loading ${savedTasks.length} tasks from Firestore...`);
    
    // Clear existing task cards
    const tasksList = document.getElementById('tasksCardsList');
    if (!tasksList) {
      console.error('❌ tasksCardsList element not found!');
      return;
    }
    
    // Remove only dynamically added tasks
    const dynamicTasks = tasksList.querySelectorAll('[data-task-id]');
    console.log(`🗑️ Removing ${dynamicTasks.length} existing task cards...`);
    dynamicTasks.forEach(task => task.remove());
    
    // Add all saved tasks to DOM
    savedTasks.forEach(taskData => {
      console.log('➕ Adding task to DOM:', taskData.title);
      addTaskToList(taskData);
    });
    
    // Check and update expired tasks
    await checkAndUpdateExpiredTasks();
    
    // Update stats after loading all tasks
    updateTasksStats();
    
    console.log('✅ Tasks loaded successfully from Firestore');
    
  } catch (error) {
    console.error('❌ Error loading tasks from Firestore:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Setup real-time listener for automatic cross-device sync
let tasksUnsubscribe = null;
let locallyAddedTaskIds = new Set(); // Track tasks added locally to prevent duplicates

function setupTasksRealtimeListener() {
  try {
    // Unsubscribe from previous listener if exists
    if (tasksUnsubscribe) {
      console.log('🔄 Unsubscribing from previous listener...');
      tasksUnsubscribe();
    }
    
    console.log('🔄 Setting up real-time tasks sync...');
    
    // Listen to all changes in tasks collection
    tasksUnsubscribe = onSnapshot(
      collection(db, 'tasks'), 
      (snapshot) => {
        console.log('📡 Real-time update received:', snapshot.docChanges().length, 'changes');
        snapshot.docChanges().forEach((change) => {
          const taskData = { id: change.doc.id, ...change.doc.data() };
          console.log(`🔄 Change type: ${change.type}, Task: ${taskData.title}`);
          
          if (change.type === 'added') {
            // Check if task was just added locally (optimistic update)
            if (locallyAddedTaskIds.has(taskData.id)) {
              console.log('⏩ Task added locally, skipping listener duplicate:', taskData.title);
              locallyAddedTaskIds.delete(taskData.id); // Remove from tracking
              return;
            }
            
            // Check if task already exists in DOM (avoid duplicates)
            const existingCard = document.querySelector(`[data-task-id="${taskData.id}"]`);
            if (!existingCard) {
              console.log('➕ Real-time: Task added -', taskData.title);
              addTaskToList(taskData);
              updateTasksStats();
            } else {
              console.log('⏩ Task already in DOM, skipping:', taskData.title);
            }
          }
      
      if (change.type === 'modified') {
        console.log('✏️ Real-time: Task modified -', taskData.title);
        const taskCard = document.querySelector(`[data-task-id="${taskData.id}"]`);
        if (taskCard) {
          // Update status badge
          const badge = taskCard.querySelector('.task-status-badge');
          if (badge) {
            badge.className = `task-status-badge ${taskData.status}`;
            badge.textContent = 
              taskData.status === 'completed' ? 'مكتملة' :
              taskData.status === 'overdue' ? 'متأخرة' :
              taskData.status === 'in-progress' ? 'جارية' : 'جديدة';
          }
          
          // Update dataset
          taskCard.dataset.status = taskData.status;
          
          // Update title and description if changed
          const titleEl = taskCard.querySelector('.task-modern-title');
          if (titleEl) titleEl.textContent = taskData.title;
          
          const descEl = taskCard.querySelector('.task-modern-description');
          if (descEl) descEl.textContent = taskData.description || 'لا يوجد وصف';
          
          updateTasksStats();
        }
      }
      
      if (change.type === 'removed') {
        console.log('🗑️ Real-time: Task removed -', taskData.title);
        const taskCard = document.querySelector(`[data-task-id="${taskData.id}"]`);
        if (taskCard) {
          taskCard.style.animation = 'fadeOut 0.3s ease';
          setTimeout(() => {
            taskCard.remove();
            updateTasksStats();
          }, 300);
        }
        }
      });
    }, 
    (error) => {
      console.error('❌ Real-time listener error:', error);
      console.error('Error details:', error.message);
    });
    
    console.log('✅ Real-time sync active - tasks will update automatically across all devices');
  } catch (error) {
    console.error('❌ Error setting up real-time listener:', error);
    console.error('Error details:', error.message);
  }
}

// Delete task from Firestore
async function deleteTaskFromStorage(taskId) {
  try {
    await deleteDoc(firestoreDoc(db, 'tasks', taskId));
    console.log('✅ Task deleted from Firestore:', taskId);
  } catch (error) {
    console.error('❌ Error deleting task:', error);
    throw error;
  }
}

// Calculate next recurrence date based on recurrence type
function calculateNextRecurrenceDate(currentDate, recurrenceType) {
  const nextDate = new Date(currentDate);
  
  switch(recurrenceType) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return null;
  }
  
  return nextDate.toISOString().split('T')[0];
}

// Check if there's an overdue instance of this recurring task
async function hasOverdueInstance(originalTaskId) {
  try {
    const tasksSnapshot = await getDocs(
      query(
        collection(db, 'tasks'),
        where('originalTaskId', '==', originalTaskId),
        where('status', '==', 'overdue')
      )
    );
    return !tasksSnapshot.empty;
  } catch (error) {
    console.error('❌ Error checking overdue tasks:', error);
    return false;
  }
}

// Create a new copy of a recurring task
async function createRecurringTaskCopy(originalTask) {
  if (!originalTask.recurrence || originalTask.recurrence === 'none') {
    return null;
  }
  
  const originalTaskId = originalTask.originalTaskId || originalTask.id;
  
  // Check if there's an overdue instance - if yes, don't create new copy
  const hasOverdue = await hasOverdueInstance(originalTaskId);
  if (hasOverdue) {
    console.log(`⏸️ Skipping recurring task creation - overdue instance exists for: ${originalTask.title}`);
    return null;
  }
  
  // If task was overdue, next date should be today or appropriate future date
  let nextDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(originalTask.date);
  taskDate.setHours(0, 0, 0, 0);
  
  if (originalTask.status === 'completed' && taskDate < today) {
    // Task was completed after its due date (overdue)
    // Create next instance for TODAY (not tomorrow) because we missed the days in between
    nextDate = today.toISOString().split('T')[0];
    console.log(`📅 Overdue task completed - creating instance for today: ${nextDate}`);
  } else {
    // Task completed on time - create next instance from task date
    nextDate = calculateNextRecurrenceDate(originalTask.date, originalTask.recurrence);
    console.log(`📅 On-time completion - creating instance for: ${nextDate}`);
  }
  
  if (!nextDate) return null;
  
  const newTask = {
    ...originalTask,
    id: `task_${Date.now()}`,
    date: nextDate,
    status: 'in-progress',
    originalTaskId: originalTaskId,
    createdAt: new Date().toISOString()
  };
  
  // Save to Firestore
  try {
    await setDoc(firestoreDoc(db, 'tasks', newTask.id), {
      ...newTask,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Add to DOM
    addTaskToList(newTask);
    
    console.log(`🔄 Created recurring task copy: ${newTask.title} for ${nextDate}`);
    
    return newTask;
  } catch (error) {
    console.error('❌ Error creating recurring task:', error);
    return null;
  }
}

// Check and update expired tasks
function checkAndUpdateExpiredTasks() {
  try {
    console.log('🔍 Checking for expired tasks...');
    
    const tasks = JSON.parse(localStorage.getItem('adminTasks') || '[]');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    
    let tasksToUpdate = [];
    let tasksToDelete = [];
    let recurringTasksToCreate = [];
    
    tasks.forEach(task => {
      if (!task.date) return; // Skip tasks without dates
      
      const taskDate = new Date(task.date);
      taskDate.setHours(0, 0, 0, 0);
      
      // If task date is before today (task is expired)
      if (taskDate < today) {
        if (task.status === 'completed') {
          // For completed recurring tasks, create next instance
          if (task.recurrence && task.recurrence !== 'none') {
            const originalTaskId = task.originalTaskId || task.id;
            // Only create if no overdue instance exists
            if (!hasOverdueInstance(originalTaskId, tasks)) {
              recurringTasksToCreate.push(task);
              console.log(`🔄 Will create next instance of: ${task.title}`);
            }
          }
          // Completed tasks are removed after their date
          tasksToDelete.push(task.id);
          console.log(`🗑️ Auto-deleting completed task: ${task.title}`);
        } else if (task.status !== 'overdue') {
          // Incomplete tasks become overdue
          task.status = 'overdue';
          tasksToUpdate.push(task);
          console.log(`⏰ Auto-updating to overdue: ${task.title}`);
        }
      }
    });
    
    // Delete completed expired tasks
    if (tasksToDelete.length > 0) {
      const updatedTasks = tasks.filter(task => !tasksToDelete.includes(task.id));
      localStorage.setItem('adminTasks', JSON.stringify(updatedTasks));
      
      // Remove from DOM
      tasksToDelete.forEach(taskId => {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
          taskCard.style.animation = 'fadeOut 0.3s ease';
          setTimeout(() => taskCard.remove(), 300);
        }
      });
      
      console.log(`✅ Deleted ${tasksToDelete.length} completed expired tasks`);
    }
    
    // Update overdue tasks
    if (tasksToUpdate.length > 0) {
      // Save updated tasks to localStorage
      localStorage.setItem('adminTasks', JSON.stringify(tasks));
      
      // Update in DOM
      tasksToUpdate.forEach(task => {
        const taskCard = document.querySelector(`[data-task-id="${task.id}"]`);
        if (taskCard) {
          taskCard.dataset.status = 'overdue';
          const badge = taskCard.querySelector('.task-status-badge');
          if (badge) {
            badge.className = 'task-status-badge overdue';
            badge.textContent = 'متأخرة';
            taskCard.style.animation = 'pulse 0.4s ease';
          }
        }
      });
      
      console.log(`✅ Updated ${tasksToUpdate.length} tasks to overdue`);
    }
    
    // Create recurring task copies
    if (recurringTasksToCreate.length > 0) {
      recurringTasksToCreate.forEach(task => {
        createRecurringTaskCopy(task);
      });
      console.log(`✅ Created ${recurringTasksToCreate.length} recurring task instances`);
    }
    
    if (tasksToDelete.length > 0 || tasksToUpdate.length > 0 || recurringTasksToCreate.length > 0) {
      // Update stats after changes
      setTimeout(() => {
        updateTasksStats();
      }, 350);
    }
    
  } catch (error) {
    console.error('❌ Error checking expired tasks:', error);
  }
}

// Toggle task dropdown menu
window.toggleTaskDropdown = function(event, taskId) {
  event.stopPropagation();
  
  const dropdown = document.getElementById(`dropdown-${taskId}`);
  const allDropdowns = document.querySelectorAll('.task-dropdown-menu');
  
  // Close all other dropdowns
  allDropdowns.forEach(dd => {
    if (dd.id !== `dropdown-${taskId}`) {
      dd.style.display = 'none';
    }
  });
  
  // Toggle current dropdown
  if (dropdown.style.display === 'none' || dropdown.style.display === '') {
    dropdown.style.display = 'block';
    dropdown.style.animation = 'fadeIn 0.2s ease';
  } else {
    dropdown.style.display = 'none';
  }
};

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.task-status-dropdown-container')) {
    const allDropdowns = document.querySelectorAll('.task-dropdown-menu');
    allDropdowns.forEach(dd => dd.style.display = 'none');
  }
});

// Mark task as complete
window.markTaskComplete = async function(taskId) {
  try {
    // Close dropdown
    const dropdown = document.getElementById(`dropdown-${taskId}`);
    if (dropdown) dropdown.style.display = 'none';
    
    // Get task from Firestore
    const taskSnapshot = await getDocs(query(
      collection(db, 'tasks'),
      where('id', '==', taskId)
    ));
    
    if (!taskSnapshot.empty) {
      const taskDoc = taskSnapshot.docs[0];
      const completedTask = { id: taskDoc.id, ...taskDoc.data() };
      
      // Update in Firestore
      await updateDoc(firestoreDoc(db, 'tasks', taskId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // If task is recurring, create next instance immediately
      if (completedTask.recurrence && completedTask.recurrence !== 'none') {
        setTimeout(async () => {
          await createRecurringTaskCopy(completedTask);
          updateTasksStats();
        }, 500);
      }
    }
    
    // Update in DOM
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskCard) {
      // Update status badge
      const badge = taskCard.querySelector('.task-status-badge');
      if (badge) {
        badge.className = 'task-status-badge completed';
        badge.textContent = 'مكتملة';
      }
      
      // Update dataset
      taskCard.dataset.status = 'completed';
      
      // Animate and move to bottom
      taskCard.style.animation = 'pulse 0.4s ease';
      
      setTimeout(() => {
        const tasksList = document.getElementById('tasksCardsList');
        if (tasksList) {
          tasksList.appendChild(taskCard);
          taskCard.style.animation = 'slideUp 0.4s ease';
        }
      }, 400);
    }
    
    // Update stats
    updateTasksStats();
    
    console.log('✅ Task marked as complete:', taskId);
    
  } catch (error) {
    console.error('❌ Error marking task complete:', error);
    alert('حدث خطأ في تحديث المهمة');
  }
};

// Delete task (from UI and storage)
window.deleteTask = async function(taskId) {
  if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
    return;
  }
  
  try {
    // Close dropdown
    const dropdown = document.getElementById(`dropdown-${taskId}`);
    if (dropdown) dropdown.style.display = 'none';
    
    // Remove from DOM
    const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskCard) {
      taskCard.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => {
        taskCard.remove();
        // Update stats after removal
        updateTasksStats();
      }, 300);
    }
    
    // Remove from Firestore
    await deleteTaskFromStorage(taskId);
    
    console.log('✅ Task deleted successfully:', taskId);
    
  } catch (error) {
    console.error('❌ Error deleting task:', error);
    alert('حدث خطأ في حذف المهمة');
  }
};

// Update Tasks Stats
function updateTasksStats() {
  const allCards = document.querySelectorAll('.task-modern-card');
  
  let total = allCards.length;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  
  allCards.forEach(card => {
    const status = card.dataset.status;
    if (status === 'in-progress' || status === 'pending') {
      inProgress++;
    } else if (status === 'completed') {
      completed++;
    } else if (status === 'overdue') {
      overdue++;
    }
  });
  
  // Update stat cards with animation
  const totalEl = document.getElementById('totalTasksCount');
  const inProgressEl = document.getElementById('inProgressTasksCount');
  const completedEl = document.getElementById('completedTasksCount');
  const overdueEl = document.getElementById('overdueTasksCount');
  const visibleEl = document.getElementById('visibleTasksCount');
  
  // Helper function to update with animation
  const updateWithAnimation = (element, newValue) => {
    if (element && element.textContent !== String(newValue)) {
      element.style.animation = 'pulse 0.4s ease';
      element.textContent = newValue;
      setTimeout(() => {
        element.style.animation = '';
      }, 400);
    } else if (element) {
      element.textContent = newValue;
    }
  };
  
  updateWithAnimation(totalEl, total);
  updateWithAnimation(inProgressEl, inProgress);
  updateWithAnimation(completedEl, completed);
  updateWithAnimation(overdueEl, overdue);
  if (visibleEl) visibleEl.textContent = `${total} مهمة`;
  
  console.log('📊 Stats updated:', { total, inProgress, completed, overdue });
}

// Clear all tasks (for testing/reset)
window.clearAllTasks = function() {
  if (!confirm('⚠️ هل أنت متأكد من حذف جميع المهام؟\n\nسيتم حذف جميع المهام نهائياً من القائمة.')) {
    return;
  }
  
  try {
    // Clear from localStorage
    localStorage.removeItem('adminTasks');
    
    // Clear from DOM
    const tasksList = document.getElementById('tasksCardsList');
    if (tasksList) {
      const allTasks = tasksList.querySelectorAll('[data-task-id]');
      allTasks.forEach(task => task.remove());
    }
    
    // Update stats
    updateTasksStats();
    
    console.log('🗑️ All tasks cleared');
    alert('✅ تم حذف جميع المهام بنجاح');
    
  } catch (error) {
    console.error('❌ Error clearing tasks:', error);
    alert('حدث خطأ في حذف المهام');
  }
};

// Show Success Toast
function showSuccessToast(message) {
  // Check if toast already exists
  let toast = document.querySelector('.task-success-toast');
  
  if (!toast) {
    // Create toast element
    toast = document.createElement('div');
    toast.className = 'task-success-toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Update floating action button to open add task page
window.showAddTaskModal = function() {
  openAddTaskPage();
};

// END OF ADD NEW TASK PAGE FUNCTIONS

// END OF MODERN TASKS PAGE FUNCTIONS

// ============================================
// WAITING STUDENTS SECTION FUNCTIONS
// ============================================

// Open Waiting Students Section
window.openWaitingStudentsSection = function() {
  const waitingSection = document.getElementById('waitingStudentsSection');
  if (waitingSection) {
    waitingSection.style.display = 'block';
    loadWaitingStudents();
  }
};

// Close Waiting Students Section
window.closeWaitingStudentsSection = function() {
  const waitingSection = document.getElementById('waitingStudentsSection');
  if (waitingSection) {
    waitingSection.style.display = 'none';
  }
};

// Open Add Waiting Student Page
window.openAddWaitingStudent = async function() {
  const addPage = document.getElementById('addWaitingStudentPage');
  if (addPage) {
    addPage.style.display = 'block';
    // Reset form
    const form = document.getElementById('waitingStudentForm');
    if (form) form.reset();
    document.getElementById('waitingStudentAge').value = ''; // Clear calculated age
    
    // Initialize Hijri date dropdowns with current date
    initializeHijriDateDropdowns();
    
    // Load classes list
    await loadClassesForWaitingStudent();
  }
};

// Initialize Hijri Date Dropdowns
function initializeHijriDateDropdowns() {
  console.log('📅 [WAITING] Initializing smart Hijri date dropdowns...');
  
  const daySelect = document.getElementById('waitingRegDay');
  const monthSelect = document.getElementById('waitingRegMonth');
  const yearSelect = document.getElementById('waitingRegYear');
  
  if (!daySelect || !monthSelect || !yearSelect) return;
  
  // Get current Hijri date
  const currentHijri = getCurrentHijriDate();
  console.log('📅 Current Hijri:', currentHijri);
  
  // Hijri month names
  const hijriMonths = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  // Clear existing options except first
  daySelect.innerHTML = '<option value="">اليوم</option>';
  monthSelect.innerHTML = '<option value="">الشهر</option>';
  yearSelect.innerHTML = '<option value="">السنة</option>';
  
  // Populate days (1-30)
  for (let day = 1; day <= 30; day++) {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = day;
    daySelect.appendChild(option);
  }
  
  // Smart month population: Start from current month and go forward
  // Show remaining months of current year, then next year from month 1
  const currentMonth = currentHijri.hijriMonth;
  const currentYear = currentHijri.hijriYear;
  const currentDay = currentHijri.hijriDay;
  
  // Add remaining months of current year (from current month to month 12)
  for (let month = currentMonth; month <= 12; month++) {
    const option = document.createElement('option');
    option.value = `${currentYear}-${month}`;
    option.textContent = `${month} - ${hijriMonths[month - 1]} ${currentYear}`;
    monthSelect.appendChild(option);
  }
  
  // Add all months of next year (from month 1 to month before current)
  for (let month = 1; month < currentMonth; month++) {
    const option = document.createElement('option');
    option.value = `${currentYear + 1}-${month}`;
    option.textContent = `${month} - ${hijriMonths[month - 1]} ${currentYear + 1}`;
    monthSelect.appendChild(option);
  }
  
  // Populate years (current year to +5 years)
  for (let year = currentYear; year <= currentYear + 5; year++) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
  
  // Set current date as default
  daySelect.value = currentDay;
  monthSelect.value = `${currentYear}-${currentMonth}`;
  yearSelect.value = currentYear;
  
  console.log('✅ [WAITING] Smart Hijri date dropdowns initialized:', {
    currentDate: currentHijri,
    currentDay: currentDay,
    currentMonth: currentMonth,
    currentYear: currentYear,
    monthsFrom: `${currentMonth}-${currentYear}`,
    monthsTo: `${currentMonth - 1}-${currentYear + 1}`,
    totalMonthOptions: monthSelect.options.length - 1
  });
}

// Load Classes for Waiting Student Selection
async function loadClassesForWaitingStudent() {
  try {
    const classSelect = document.getElementById('waitingStudentClass');
    if (!classSelect) return;
    
    // Clear existing options except the first one
    classSelect.innerHTML = '<option value="">لم يتم التحديد بعد</option>';
    
    // Get all classes
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    
    classesSnapshot.forEach(doc => {
      const classData = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = classData.name || doc.id;
      classSelect.appendChild(option);
    });
    
    console.log('✅ [WAITING] Classes loaded for selection');
  } catch (error) {
    console.error('❌ [WAITING] Error loading classes:', error);
  }
}

// Calculate Age from Birth Date for Waiting Student
window.calculateWaitingStudentAge = function() {
  const birthDateInput = document.getElementById('waitingStudentBirthDate');
  const ageInput = document.getElementById('waitingStudentAge');
  
  if (!birthDateInput || !ageInput) return;
  
  const birthDate = birthDateInput.value;
  if (!birthDate) {
    ageInput.value = '';
    return;
  }
  
  const birthDateObj = new Date(birthDate);
  const today = new Date();
  
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
    age--;
  }
  
  ageInput.value = age + ' سنة';
  console.log('📅 [WAITING] Age calculated:', age);
};

// Close Add Waiting Student Page
window.closeAddWaitingStudent = function() {
  const addPage = document.getElementById('addWaitingStudentPage');
  if (addPage) {
    addPage.style.display = 'none';
  }
};

// Save Waiting Student
window.saveWaitingStudent = async function() {
  console.log('💾 [WAITING] Starting save waiting student...');
  
  // Get form values
  const name = document.getElementById('waitingStudentName').value.trim();
  const birthDate = document.getElementById('waitingStudentBirthDate').value;
  const age = document.getElementById('waitingStudentAge').value.trim();
  const nationalId = document.getElementById('waitingStudentNationalId').value.trim();
  const level = document.getElementById('waitingStudentLevel').value;
  const classId = document.getElementById('waitingStudentClass').value;
  const guardianPhone = document.getElementById('waitingGuardianPhone').value.trim();
  const studentPhone = document.getElementById('waitingStudentPhone').value.trim();
  const notes = document.getElementById('waitingStudentNotes').value.trim();
  
  // Get Hijri registration date from dropdowns
  const regDay = document.getElementById('waitingRegDay').value;
  const regMonthValue = document.getElementById('waitingRegMonth').value; // Format: "year-month"
  const regYear = document.getElementById('waitingRegYear').value;
  
  // Extract year and month from month dropdown value
  let actualRegYear = parseInt(regYear);
  let actualRegMonth = null;
  
  if (regMonthValue && regMonthValue.includes('-')) {
    const [yearFromMonth, month] = regMonthValue.split('-');
    actualRegYear = parseInt(yearFromMonth);
    actualRegMonth = parseInt(month);
  }
  
  // Get selected priority
  const priorityInputs = document.querySelectorAll('input[name="waitingPriority"]');
  let priority = 'normal';
  priorityInputs.forEach(input => {
    if (input.checked) {
      priority = input.value;
    }
  });
  
  // Validation
  if (!name) {
    alert('⚠️ الرجاء إدخال اسم الطالب');
    return;
  }
  
  if (!birthDate) {
    alert('⚠️ الرجاء اختيار تاريخ الميلاد');
    return;
  }
  
  if (!guardianPhone) {
    alert('⚠️ الرجاء إدخال رقم ولي الأمر');
    return;
  }
  
  if (!regDay || !regMonthValue || !actualRegMonth) {
    alert('⚠️ الرجاء اختيار تاريخ التسجيل الهجري كاملاً');
    return;
  }
  
  // Validate phone formats
  if (guardianPhone && !/^[0-9]{10}$/.test(guardianPhone)) {
    alert('⚠️ رقم جوال ولي الأمر يجب أن يكون 10 أرقام');
    return;
  }
  
  if (studentPhone && !/^[0-9]{10}$/.test(studentPhone)) {
    alert('⚠️ رقم جوال الطالب يجب أن يكون 10 أرقام');
    return;
  }
  
  if (!level) {
    alert('⚠️ الرجاء اختيار المستوى');
    return;
  }
  
  try {
    console.log('📝 [WAITING] Creating student data...', { name, priority, level });
    
    // Calculate numeric age from birth date
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    let numericAge = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      numericAge--;
    }
    
    // Format registration date in Hijri
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const registrationDateHijri = `${regDay} ${hijriMonths[actualRegMonth - 1]} ${actualRegYear}`;
    
    // Convert Hijri date to Gregorian for accurate sorting
    const registrationDateGregorian = convertHijriToGregorian(actualRegYear, actualRegMonth, parseInt(regDay));
    
    // Create student object
    const studentData = {
      name: name,
      birthDate: birthDate,
      age: numericAge,
      level: level,
      guardianPhone: guardianPhone,
      priority: priority,
      registrationDateHijri: registrationDateHijri,
      registrationDay: parseInt(regDay),
      registrationMonth: actualRegMonth,
      registrationYear: actualRegYear,
      addedDate: registrationDateGregorian ? registrationDateGregorian.toISOString() : new Date().toISOString(),
      addedBy: 'admin',
      status: 'waiting'
    };
    
    // Add optional fields
    if (nationalId) {
      studentData.nationalId = nationalId;
    }
    if (studentPhone) {
      studentData.studentPhone = studentPhone;
    }
    if (classId) {
      studentData.suggestedClassId = classId; // Save as suggestion, not final assignment
    }
    if (notes) {
      studentData.notes = notes;
    }
    
    // Save to Firestore
    const docRef = await addDoc(collection(db, 'waitingStudents'), studentData);
    console.log('✅ [WAITING] Student saved successfully! ID:', docRef.id);
    
    // Show success message
    showSuccessToast('✅ تمت إضافة الطالب إلى قائمة الانتظار');
    
    // Close add page
    closeAddWaitingStudent();
    
    // Reload waiting students list
    loadWaitingStudents();
    
  } catch (error) {
    console.error('❌ [WAITING] Error saving student:', error);
    alert('❌ حدث خطأ أثناء الحفظ: ' + error.message);
  }
};

// Load Waiting Students
window.loadWaitingStudents = async function() {
  console.log('📥 [WAITING] Loading waiting students...');
  
  try {
    // Query waiting students (سنقوم بالترتيب يدوياً في JavaScript)
    const q = query(
      collection(db, 'waitingStudents'),
      where('status', '==', 'waiting')
    );
    
    const snapshot = await getDocs(q);
    console.log('📊 [WAITING] Found students:', snapshot.size);
    
    const students = [];
    snapshot.forEach(doc => {
      students.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Sort by priority first, then by registration date
    // Priority order: urgent (0) > high (1) > normal (2)
    // Within same priority, earlier registration comes first
    students.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff; // Sort by priority first
      }
      
      // If same priority, sort by registration date (earliest first)
      const dateA = new Date(a.addedDate);
      const dateB = new Date(b.addedDate);
      return dateA - dateB;
    });
    
    console.log('✅ [WAITING] Students sorted by priority and registration date');
    
    // Update stats
    updateWaitingStats(students);
    
    // Display students
    displayWaitingStudents(students);
    
  } catch (error) {
    console.error('❌ [WAITING] Error loading students:', error);
    // Show empty state on error
    const listContainer = document.getElementById('waitingStudentsList');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3 class="empty-title">حدث خطأ</h3>
          <p class="empty-desc">${error.message}</p>
        </div>
      `;
    }
  }
};

// Update Waiting Stats
function updateWaitingStats(students) {
  console.log('📈 [WAITING] Updating stats...', students.length);
  
  // Total waiting
  const totalElement = document.querySelector('#waitingStudentsSection .waiting-stat-card:nth-child(1) .stat-number');
  if (totalElement) {
    totalElement.textContent = students.length;
  }
  
  // Priority count (urgent + high)
  const priorityCount = students.filter(s => s.priority === 'urgent' || s.priority === 'high').length;
  const priorityElement = document.querySelector('#waitingStudentsSection .waiting-stat-card:nth-child(2) .stat-number');
  if (priorityElement) {
    priorityElement.textContent = priorityCount;
  }
  
  // Recent (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentCount = students.filter(s => {
    const addedDate = new Date(s.addedDate);
    return addedDate >= oneWeekAgo;
  }).length;
  const recentElement = document.querySelector('#waitingStudentsSection .waiting-stat-card:nth-child(3) .stat-number');
  if (recentElement) {
    recentElement.textContent = recentCount;
  }
  
  // Update badge in more menu
  const badge = document.querySelector('.more-menu-card .more-card-badge');
  if (badge) {
    badge.textContent = students.length;
  }
}

// Display Waiting Students
function displayWaitingStudents(students) {
  console.log('🖼️ [WAITING] Displaying students...', students.length);
  
  const listContainer = document.getElementById('waitingStudentsList');
  if (!listContainer) return;
  
  if (students.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <h3 class="empty-title">لا يوجد طلاب في قائمة الانتظار</h3>
        <p class="empty-desc">اضغط على "إضافة طالب انتظار" لإضافة طالب جديد</p>
      </div>
    `;
    return;
  }
  
  // Build HTML with both desktop table and mobile cards views
  let html = `
    <style>
      .waiting-table-container { display: block; }
      .waiting-cards-container { display: none; }
      
      @media (max-width: 768px) {
        .waiting-table-container { display: none; }
        .waiting-cards-container { display: block; }
      }
    </style>
    
    <!-- Desktop: Table View -->
    <div class="waiting-table-container" style="background: white; border-radius: 15px; padding: 20px; box-shadow: 0 2px 15px rgba(0,0,0,0.08); overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 14px 12px; text-align: center; border-radius: 10px 0 0 0; font-weight: 600; font-size: 13px; white-space: nowrap;">#</th>
            <th style="padding: 14px 16px; text-align: right; font-weight: 600; font-size: 13px;">اسم الطالب</th>
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; font-size: 13px; white-space: nowrap;">تاريخ التسجيل</th>
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; font-size: 13px;">المستوى</th>
            <th style="padding: 14px 12px; text-align: center; font-weight: 600; font-size: 13px;">الأولوية</th>
            <th style="padding: 14px 12px; text-align: center; border-radius: 0 10px 0 0; font-weight: 600; font-size: 13px;">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  students.forEach((student, index) => {
    const queueNumber = index + 1;
    
    const priorityEmoji = {
      urgent: '🔴',
      high: '⭐',
      normal: '🔵'
    };
    
    const priorityLabel = {
      urgent: 'عاجل',
      high: 'أولوية',
      normal: 'عادي'
    };
    
    const priorityColor = {
      urgent: '#dc3545',
      high: '#ffc107',
      normal: '#667eea'
    };
    
    const levelText = {
      'hifz': 'حفظ',
      'dabt': 'ضبط',
      'noorani': 'نورانية'
    };
    
    const rowBg = index % 2 === 0 ? '#f8f9ff' : '#ffffff';
    
    // Desktop table row
    html += `
      <tr style="background: ${rowBg}; border-bottom: 1px solid #e9ecef; transition: all 0.2s;" onmouseover="this.style.background='#f0f3ff'" onmouseout="this.style.background='${rowBg}'">
        <td style="padding: 14px 12px; text-align: center; font-weight: 700; font-size: 15px; color: #667eea;">
          ${queueNumber}
        </td>
        <td style="padding: 14px 16px; text-align: right;">
          <div style="font-weight: 600; font-size: 14px; color: #1a1a1a; margin-bottom: 4px;">
            👤 ${student.name}
          </div>
          <div style="font-size: 12px; color: #666;">
            📞 ${student.guardianPhone}
          </div>
        </td>
        <td style="padding: 14px 12px; text-align: center;">
          <div style="font-weight: 600; font-size: 13px; color: #667eea; white-space: nowrap;">
            📅 ${student.registrationDateHijri || 'غير محدد'}
          </div>
        </td>
        <td style="padding: 14px 12px; text-align: center;">
          <span style="background: #f0f3ff; color: #667eea; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-block;">
            ${levelText[student.level] || student.level || 'غير محدد'}
          </span>
        </td>
        <td style="padding: 14px 12px; text-align: center;">
          <span style="background: ${priorityColor[student.priority]}15; color: ${priorityColor[student.priority]}; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; display: inline-block; white-space: nowrap;">
            ${priorityEmoji[student.priority]} ${priorityLabel[student.priority]}
          </span>
        </td>
        <td style="padding: 14px 12px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
            <button onclick="contactWaitingStudent('${student.id}')" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
              📞
            </button>
            <button onclick="deleteWaitingStudent('${student.id}')" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
    
    <!-- Mobile: Cards View -->
    <div class="waiting-cards-container" style="display: grid; gap: 12px;">
  `;
  
  // Mobile cards
  students.forEach((student, index) => {
    const queueNumber = index + 1;
    
    const priorityEmoji = {
      urgent: '🔴',
      high: '⭐',
      normal: '🔵'
    };
    
    const priorityLabel = {
      urgent: 'عاجل',
      high: 'أولوية',
      normal: 'عادي'
    };
    
    const priorityColor = {
      urgent: '#dc3545',
      high: '#ffc107',
      normal: '#667eea'
    };
    
    // Simplified mobile card - just name and date
    const studentDataJson = JSON.stringify(student).replace(/"/g, '&quot;');
    
    html += `
      <div onclick='openWaitingStudentModal(${studentDataJson})' style="background: white; border-radius: 12px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-right: 4px solid ${priorityColor[student.priority]}; position: relative; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'">
        
        <!-- Queue Number Badge -->
        <div style="position: absolute; top: -8px; left: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 3px 8px rgba(102,126,234,0.4);">
          ${queueNumber}
        </div>
        
        <div>
          <h3 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1a1a1a;">
            👤 ${student.name}
          </h3>
          <p style="margin: 0; font-size: 13px; color: #667eea; font-weight: 500;">
            📅 ${student.registrationDateHijri || 'غير محدد'}
          </p>
        </div>
        
      </div>
    `;
  });
  
  html += `
    </div>
  `;
  listContainer.innerHTML = html;
}

// Open Waiting Student Modal with Details
window.openWaitingStudentModal = function(studentData) {
  console.log('📋 [WAITING] Opening modal for student:', studentData);
  
  const modal = document.getElementById('waitingStudentModal');
  const modalContent = document.getElementById('waitingStudentModalContent');
  
  if (!modal || !modalContent) return;
  
  const priorityEmoji = {
    urgent: '🔴',
    high: '⭐',
    normal: '🔵'
  };
  
  const priorityLabel = {
    urgent: 'عاجل',
    high: 'أولوية عالية',
    normal: 'عادي'
  };
  
  const priorityColor = {
    urgent: '#dc3545',
    high: '#ffc107',
    normal: '#667eea'
  };
  
  const levelText = {
    'hifz': 'حفظ',
    'dabt': 'ضبط',
    'noorani': 'نورانية'
  };
  
  modalContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">
        👤 ${studentData.name}
      </h2>
      <span style="background: ${priorityColor[studentData.priority]}15; color: ${priorityColor[studentData.priority]}; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; display: inline-block;">
        ${priorityEmoji[studentData.priority]} ${priorityLabel[studentData.priority]}
      </span>
    </div>
    
    <div style="background: #f8f9ff; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
      <div style="display: grid; gap: 12px;">
        
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">تاريخ التسجيل</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #667eea;">
            📅 ${studentData.registrationDateHijri || 'غير محدد'}
          </p>
        </div>
        
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">رقم جوال ولي الأمر</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
            📞 ${studentData.guardianPhone}
          </p>
        </div>
        
        ${studentData.studentPhone ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">رقم جوال الطالب</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
            📱 ${studentData.studentPhone}
          </p>
        </div>
        ` : ''}
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">العمر</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
              ${studentData.age ? studentData.age + ' سنة' : 'غير محدد'}
            </p>
          </div>
          <div>
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">المستوى</p>
            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
              ${levelText[studentData.level] || studentData.level || 'غير محدد'}
            </p>
          </div>
        </div>
        
        ${studentData.nationalId ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">رقم الهوية</p>
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">
            🆔 ${studentData.nationalId}
          </p>
        </div>
        ` : ''}
        
        ${studentData.notes ? `
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #999;">ملاحظات</p>
          <p style="margin: 0; font-size: 13px; color: #666; background: #fffbea; padding: 10px; border-radius: 8px;">
            📝 ${studentData.notes}
          </p>
        </div>
        ` : ''}
        
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div style="display: grid; gap: 10px;">
      <button onclick="joinWaitingStudentToClass('${studentData.id}')" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(40,167,69,0.3)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
        ✅ انضم للحلقة
      </button>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button onclick="contactWaitingStudent('${studentData.id}')" style="background: #667eea; color: white; border: none; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          📞 تواصل
        </button>
        <button onclick="if(confirm('⚠️ هل أنت متأكد من الحذف؟')) { deleteWaitingStudent('${studentData.id}'); closeWaitingStudentModal(); }" style="background: #dc3545; color: white; border: none; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          🗑️ حذف
        </button>
      </div>
    </div>
  `;
  
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
};

// Close Waiting Student Modal
window.closeWaitingStudentModal = function() {
  const modal = document.getElementById('waitingStudentModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
};

// Join Waiting Student to Class
window.joinWaitingStudentToClass = async function(studentId) {
  console.log('🎓 [WAITING] Joining student to class:', studentId);
  
  try {
    // Get student data
    const studentDoc = await getDoc(doc(db, 'waitingStudents', studentId));
    if (!studentDoc.exists()) {
      alert('❌ الطالب غير موجود');
      return;
    }
    
    const studentData = studentDoc.data();
    
    // Get all classes
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    if (classesSnapshot.empty) {
      alert('❌ لا توجد حلقات متاحة');
      return;
    }
    
    // Build classes options
    let classesHTML = '<option value="">اختر الحلقة</option>';
    classesSnapshot.forEach(doc => {
      const classData = doc.data();
      classesHTML += `<option value="${doc.id}">${classData.name || doc.id}</option>`;
    });
    
    // Show modal to select class
    const modalContent = document.getElementById('waitingStudentModalContent');
    modalContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px 0; font-size: 17px; color: #1a1a1a;">اختر الحلقة</h3>
        <p style="margin: 0; font-size: 13px; color: #666;">اختر الحلقة المناسبة للطالب ${studentData.name}</p>
      </div>
      
      <select id="selectedClassForWaiting" style="width: 100%; padding: 14px; border: 2px solid #e9ecef; border-radius: 12px; font-size: 15px; margin-bottom: 16px; background: white;">
        ${classesHTML}
      </select>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button onclick="confirmJoinWaitingStudentToClass('${studentId}')" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          ✅ تأكيد
        </button>
        <button onclick="closeWaitingStudentModal()" style="background: #6c757d; color: white; border: none; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          ✖️ إلغاء
        </button>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ [WAITING] Error loading classes:', error);
    alert('❌ حدث خطأ: ' + error.message);
  }
};

// Confirm Join Waiting Student to Class
window.confirmJoinWaitingStudentToClass = async function(studentId) {
  const classSelect = document.getElementById('selectedClassForWaiting');
  const classId = classSelect.value;
  
  if (!classId) {
    alert('⚠️ الرجاء اختيار الحلقة');
    return;
  }
  
  try {
    console.log('💾 [WAITING] Moving student to class:', { studentId, classId });
    
    // Get student data from waiting list
    const waitingStudentDoc = await getDoc(doc(db, 'waitingStudents', studentId));
    if (!waitingStudentDoc.exists()) {
      alert('❌ الطالب غير موجود في قائمة الانتظار');
      return;
    }
    
    const studentData = waitingStudentDoc.data();
    
    // Get class data to get teacher info
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (!classDoc.exists()) {
      alert('❌ الحلقة غير موجودة');
      return;
    }
    
    const classData = classDoc.data();
    
    // Generate custom student ID
    const randomNumber = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const customUserId = `${classId}_${randomNumber}`;
    
    // Create new student in users collection
    const newStudentData = {
      userId: customUserId,
      name: studentData.name,
      role: 'student',
      birthDate: studentData.birthDate || null,
      age: studentData.age || null,
      nationalId: studentData.nationalId || null,
      level: studentData.level,
      classId: classId,
      teacher: classData.teacher || 'غير محدد',
      guardianPhone: studentData.guardianPhone,
      studentPhone: studentData.studentPhone || null,
      notes: studentData.notes || null,
      addedDate: new Date().toISOString(),
      addedFrom: 'waitingList',
      status: 'active'
    };
    
    // Add to users collection with custom ID
    await setDoc(firestoreDoc(db, 'users', customUserId), newStudentData);
    console.log('✅ [WAITING] Student added to users collection:', customUserId);
    
    // Update class document to add student ID
    const classDocRef = firestoreDoc(db, 'classes', classId);
    await updateDoc(classDocRef, {
      studentIds: arrayUnion(customUserId)
    });
    console.log('✅ [WAITING] Student added to class studentIds array');
    
    // Delete from waiting list
    await deleteDoc(doc(db, 'waitingStudents', studentId));
    console.log('✅ [WAITING] Student removed from waiting list');
    
    // Close modal and reload
    closeWaitingStudentModal();
    showSuccessToast('✅ تم إضافة الطالب للحلقة بنجاح');
    loadWaitingStudents();
    
  } catch (error) {
    console.error('❌ [WAITING] Error joining student to class:', error);
    alert('❌ حدث خطأ: ' + error.message);
  }
};

// Contact Waiting Student
window.contactWaitingStudent = function(studentId) {
  console.log('📞 [WAITING] Contacting student:', studentId);
  alert('🚧 هذه الميزة قيد التطوير\nيمكنك التواصل مع الطالب مباشرة عبر رقم الجوال');
  // TODO: Implement call or WhatsApp integration
};

// Delete Waiting Student
window.deleteWaitingStudent = async function(studentId) {
  console.log('🗑️ [WAITING] Deleting student:', studentId);
  
  const confirmDelete = confirm('⚠️ هل أنت متأكد من حذف هذا الطالب من قائمة الانتظار؟');
  if (!confirmDelete) return;
  
  try {
    await deleteDoc(doc(db, 'waitingStudents', studentId));
    console.log('✅ [WAITING] Student deleted successfully');
    
    showSuccessToast('✅ تم حذف الطالب من قائمة الانتظار');
    
    // Reload list
    loadWaitingStudents();
    
  } catch (error) {
    console.error('❌ [WAITING] Error deleting student:', error);
    alert('❌ حدث خطأ أثناء الحذف: ' + error.message);
  }
};

// Filter Waiting Students
window.filterWaitingStudents = function() {
  console.log('🔍 [WAITING] Opening filter options...');
  alert('🚧 الفلترة حسب الأولوية والتاريخ\nقريبًا...');
  // TODO: Implement filter modal
};

// Search Waiting Students
window.searchWaitingStudents = function(event) {
  const searchTerm = event.target.value.toLowerCase().trim();
  console.log('🔍 [WAITING] Searching for:', searchTerm);
  
  if (searchTerm === '') {
    loadWaitingStudents(); // Reset to full list
    return;
  }
  
  // Filter students by search term
  // This would be more efficient with a filtered query, but for simplicity:
  const allCards = document.querySelectorAll('#waitingStudentsList > div > div');
  allCards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (text.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
};

// Setup Real-time Listener for Waiting Students
let waitingStudentsUnsubscribe = null;

function setupWaitingStudentsListener() {
  console.log('👂 [WAITING] Setting up real-time listener...');
  
  const q = query(
    collection(db, 'waitingStudents'),
    where('status', '==', 'waiting')
  );
  
  waitingStudentsUnsubscribe = onSnapshot(q, (snapshot) => {
    console.log('🔄 [WAITING] Real-time update received!', snapshot.size, 'students');
    
    // Only reload if section is visible
    const section = document.getElementById('waitingStudentsSection');
    if (section && section.style.display !== 'none') {
      loadWaitingStudents();
    } else {
      // Update badge count only
      const badge = document.querySelector('.more-menu-card .more-card-badge');
      if (badge) {
        badge.textContent = snapshot.size;
      }
    }
  });
}

// Initialize waiting students listener when page loads
document.addEventListener('DOMContentLoaded', () => {
  if (typeof db !== 'undefined') {
    setupWaitingStudentsListener();
    console.log('✅ [WAITING] Listener initialized');
  }
});

// END OF WAITING STUDENTS SECTION FUNCTIONS

// ==========================================
// STAFF ATTENDANCE SECTION
// ==========================================

// Open Staff Attendance Section
window.openStaffAttendanceSection = async function() {
  const section = document.getElementById('staffAttendanceSection');
  if (section) {
    section.style.display = 'block';
    await loadStaffList();
    initializeAttendanceFilters();
  }
};

// Close Staff Attendance Section
window.closeStaffAttendanceSection = function() {
  const section = document.getElementById('staffAttendanceSection');
  if (section) {
    section.style.display = 'none';
  }
};

// Load Staff List for Dropdown
async function loadStaffList() {
  try {
    const staffSelect = document.getElementById('staffAttendanceSelect');
    if (!staffSelect) return;
    
    // Clear existing options (except first one)
    staffSelect.innerHTML = '<option value="">-- ���� �� ������� --</option>';
    
    // Fetch all staff from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const staffList = [];
    
    classesSnapshot.forEach((doc) => {
      const data = doc.data();
      const staffId = doc.id;
      const role = data.role;
      
      let name = '';
      let roleIcon = '';
      
      if (role === 'teacher') {
        name = data.teacherName || '���� ��� �����';
        roleIcon = '??�??';
      } else if (role === 'viewer') {
        name = data.presenterName || '���� ��� �����';
        roleIcon = '??';
      } else if (role === 'admin') {
        name = data.adminName || '����� ��� �����';
        roleIcon = '??�??';
      } else {
        return; // Skip if no valid role
      }
      
      staffList.push({ id: staffId, name, role, roleIcon });
    });
    
    // Sort alphabetically
    staffList.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Add to dropdown
    staffList.forEach(staff => {
      const option = document.createElement('option');
      option.value = staff.id;
      option.textContent = ${staff.roleIcon} ;
      option.dataset.role = staff.role;
      option.dataset.roleIcon = staff.roleIcon;
      staffSelect.appendChild(option);
    });
    
    // Store in global for later use
    window.staffListData = staffList;
    
  } catch (error) {
    console.error('Error loading staff list:', error);
  }
}

// Initialize Attendance Filters (Month/Year)
function initializeAttendanceFilters() {
  const yearSelect = document.getElementById('attendanceYear');
  if (!yearSelect) return;
  
  // Clear and populate years (current + past 2 years)
  yearSelect.innerHTML = '';
  const currentYear = 1448; // Current Hijri year
  for (let i = 0; i < 3; i++) {
    const year = currentYear - i;
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    if (i === 0) option.selected = true;
    yearSelect.appendChild(option);
  }
  
  // Set current month
  const monthSelect = document.getElementById('attendanceMonth');
  if (monthSelect) {
    const currentMonth = 5; // May = Dhu al-Qadah (11)
    monthSelect.value = currentMonth;
  }
}

// Load Staff Attendance Data (when staff selected)
window.loadStaffAttendanceData = async function() {
  const staffId = document.getElementById('staffAttendanceSelect').value;
  
  if (!staffId) {
    // Reset to empty state
    document.getElementById('attendanceFilters').style.display = 'none';
    document.getElementById('staffInfoCard').style.display = 'none';
    document.getElementById('attendanceEmptyState').style.display = 'block';
    document.getElementById('staffAttendanceReportContainer').style.display = 'none';
    return;
  }
  
  // Show filters and info card
  document.getElementById('attendanceFilters').style.display = 'block';
  document.getElementById('attendanceEmptyState').style.display = 'none';
  
  // Get selected staff data
  const staffSelect = document.getElementById('staffAttendanceSelect');
  const selectedOption = staffSelect.options[staffSelect.selectedIndex];
  const staffName = selectedOption.textContent;
  const roleIcon = selectedOption.dataset.roleIcon || '??�??';
  const role = selectedOption.dataset.role || 'teacher';
  
  let roleText = '';
  if (role === 'teacher') roleText = '����';
  else if (role === 'viewer') roleText = '����';
  else if (role === 'admin') roleText = '�����';
  
  // Fetch staff settings for salary
  let salary = 3000; // Default
  try {
    const settingsDoc = await getDoc(doc(db, 'staffSettings', staffId));
    if (settingsDoc.exists()) {
      salary = settingsDoc.data().salary?.monthlySalary || 3000;
    }
  } catch (error) {
    console.error('Error fetching salary:', error);
  }
  
  // Update staff info card
  document.getElementById('staffAvatarIcon').textContent = roleIcon;
  document.getElementById('staffNameDisplay').textContent = staffName;
  document.getElementById('staffRoleDisplay').textContent = roleText;
  document.getElementById('staffSalaryDisplay').textContent = ${salary} ����;
  document.getElementById('staffInfoCard').style.display = 'flex';
  
  // Store current staff ID globally
  window.currentStaffId = staffId;
  window.currentStaffName = staffName;
  window.currentStaffSalary = salary;
};

// View Staff Attendance Report (Open Modal)
window.viewStaffAttendanceReport = async function() {
  const staffId = window.currentStaffId;
  if (!staffId) {
    alert('������ ������ ���� �����');
    return;
  }
  
  const month = parseInt(document.getElementById('attendanceMonth').value);
  const year = parseInt(document.getElementById('attendanceYear').value);
  
  // Show loading
  document.getElementById('attendanceLoadingState').style.display = 'block';
  document.getElementById('staffAttendanceReportContainer').style.display = 'none';
  
  try {
    // Import function from teacher.js to open attendance modal
    // We'll reuse the same modal and loadAttendanceData function
    
    // Get month name
    const monthNames = ['', '����', '���', '���� �����', '���� �����', '����� ������', '����� ������', '���', '�����', '�����', '����', '�� ������', '�� �����'];
    const monthName = monthNames[month];
    
    // Create temporary session storage for staff
    const previousStaff = sessionStorage.getItem('loggedInTeacher');
    sessionStorage.setItem('loggedInTeacher', staffId);
    
    // Call the attendance modal function from teacher.js
    if (window.openAttendanceRecordModal) {
      window.openAttendanceRecordModal(monthName, year, month);
    } else {
      alert('?? ����� ��� ������� ��� ����� ������');
    }
    
    // Restore previous staff
    if (previousStaff) {
      sessionStorage.setItem('loggedInTeacher', previousStaff);
    }
    
  } catch (error) {
    console.error('Error loading attendance report:', error);
    alert('��� ��� �� ����� �������');
  } finally {
    document.getElementById('attendanceLoadingState').style.display = 'none';
  }
};

// Show Penalty Action Sheet (for approving/pardoning penalties)
window.showPenaltyActionSheet = function(staffId, date, type) {
  // type: 'late', 'earlyLeave', 'absence'
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.onclick = () => closePenaltyActionSheet();
  
  // Create action sheet
  const sheet = document.createElement('div');
  sheet.className = 'penalty-action-sheet';
  sheet.id = 'penaltySheet';
  
  let title = '';
  if (type === 'late') title = '����� �������';
  else if (type === 'earlyLeave') title = '����� ������ ������';
  else if (type === 'absence') title = '����� ������';
  
  sheet.innerHTML = 
    <div class="sheet-handle"></div>
    <h3 class="sheet-title"></h3>
    <div class="sheet-options">
      <button class="sheet-option-btn approve" onclick="window.updatePenaltyStatus('', '', '', 'approved')">
        <span class="sheet-option-icon">?</span>
        <span class="sheet-option-text">������ �����</span>
      </button>
      <button class="sheet-option-btn pardon" onclick="window.updatePenaltyStatus('', '', '', 'pardoned')">
        <span class="sheet-option-icon">??</span>
        <span class="sheet-option-text">���� (����� �����)</span>
      </button>
    </div>
  ;
  
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  
  // Animate in
  setTimeout(() => {
    overlay.classList.add('show');
    sheet.classList.add('show');
  }, 10);
  
  // Store for closing
  window.currentPenaltyOverlay = overlay;
  window.currentPenaltySheet = sheet;
};

// Close Penalty Action Sheet
window.closePenaltyActionSheet = function() {
  const overlay = window.currentPenaltyOverlay;
  const sheet = window.currentPenaltySheet;
  
  if (overlay && sheet) {
    overlay.classList.remove('show');
    sheet.classList.remove('show');
    
    setTimeout(() => {
      overlay.remove();
      sheet.remove();
    }, 300);
  }
};

// Update Penalty Status (Approve/Pardon)
window.updatePenaltyStatus = async function(staffId, date, type, status) {
  try {
    const docRef = doc(db, 'teacherAttendance', ${staffId}_);
    const updateData = {};
    
    if (type === 'late') {
      updateData.lateApprovalStatus = status;
      if (status === 'pardoned') {
        updateData.lateDeduction = 0;
      }
    } else if (type === 'earlyLeave') {
      updateData.earlyLeaveApprovalStatus = status;
      if (status === 'pardoned') {
        updateData.earlyLeaveDeduction = 0;
      }
    } else if (type === 'absence') {
      updateData.absenceApprovalStatus = status;
      if (status === 'pardoned') {
        updateData.absenceDeduction = 0;
      }
    }
    
    updateData.updatedAt = serverTimestamp();
    updateData.updatedBy = 'admin';
    
    await updateDoc(docRef, updateData);
    
    // Close action sheet
    window.closePenaltyActionSheet();
    
    // Show success message
    alert(status === 'approved' ? '? �� ������ �����' : '? �� ������ ������ �����');
    
    // Reload report
    window.viewStaffAttendanceReport();
    
  } catch (error) {
    console.error('Error updating penalty status:', error);
    alert('��� ��� �� �������');
  }
};

console.log('? Staff Attendance functions loaded');


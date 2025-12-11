// Teacher Section JavaScript
import { 
  db, 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  query, 
  where, 
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  onSnapshot
} from '../firebase-config.js';

import { quranSurahs } from './quran-data.js';
import { formatHijriDate, gregorianToHijriDisplay, getTodayForStorage, getStudyDaysInCurrentHijriMonth, getCurrentHijriDate, getStudyDaysForHijriMonth as getStudyDaysForHijriMonthFromCalendar, hijriToGregorian, gregorianToHijri, isTodayAStudyDay } from './hijri-date.js';
import { isLastLessonInJuz, getJuzDetails, isLastLessonInJuzDabt, getJuzDetailsDabt } from './juz-data.js';

// DOM Elements
const teacherStudentSelect = document.getElementById('teacherStudentSelect');
const teacherStudentActions = document.getElementById('teacherStudentActions');
const selectedTeacherStudentSpan = document.getElementById('selectedTeacherStudent');

let currentTeacherStudentId = null;
let currentTeacherStudentName = null;
let currentTeacherStudentData = null; // Store full student data including level
let currentTeacherClassId = null;

// Convert Hijri date ID to Gregorian Date
function hijriDateToGregorian(dateId) {
  // dateId format: YYYY-MM-DD (Hijri)
  const [year, month, day] = dateId.split('-').map(Number);
  
  // استخدام التقويم الدقيق
  const gregorianDate = hijriToGregorian(year, month, day);
  if (gregorianDate) {
    return gregorianDate;
  }
  
  return new Date(); // Fallback
}

// Get study days for a specific Hijri month (YYYY-MM format)
function getStudyDaysForHijriMonth(monthKey) {
  // استخدام التقويم الدقيق من hijri-date.js
  return getStudyDaysForHijriMonthFromCalendar(monthKey);
}

let notificationsListener = null; // For real-time notifications

// Score values
let scores = {
  asrPrayer: 5,
  lesson: 5,
  lessonSide: 5,
  revision: 5,
  reading: 5,
  behavior: 5
};

// Initialize teacher section with specific class
export function initTeacher(teacherClassId) {
  currentTeacherClassId = teacherClassId;
  loadTeacherStudents(teacherClassId);
  setupEventListeners();
  loadTodayStrugglingStudents(teacherClassId);
  loadMonthlyScores(teacherClassId);
  startNotificationsListener(teacherClassId); // Start listening for notifications
  startNotAssessedScheduler(); // Start scheduler for checking not-assessed students at 9 PM
  updateTeacherNotificationBadge(); // Update notification badge
}

// Load students for specific teacher's class
async function loadTeacherStudents(classId) {
  const studentsGridContainer = document.getElementById('studentsGridContainer');
  studentsGridContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">⏳ جاري تحميل الطلاب...</p>';
  
  // Check if today is a study day
  const isStudyDay = isTodayAStudyDay();
  
  try {
    // Get today's Hijri date for checking assessments
    const todayHijri = getCurrentHijriDate();
    const todayHijriId = todayHijri?.hijri || getTodayForStorage();
    
    console.log('📅 Today Hijri:', todayHijri);
    console.log('📅 Today Hijri ID:', todayHijriId);
    
    // Get students who belong to this teacher's class
    let q = query(
      collection(db, 'users'), 
      where('role', '==', 'student'),
      where('classId', '==', classId)
    );
    let snap = await getDocs(q);
    
    if (snap.empty) {
      studentsGridContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 40px; font-size: 18px;">😔 لا يوجد طلاب في حلقتك</p>';
      return;
    }
    
    const students = [];
    
    // Check each student for today's assessment
    for (const d of snap.docs) {
      const dt = d.data();
      const studentId = d.id;
      
      // Check if student has been assessed today
      let assessedToday = false;
      try {
        const reportRef = doc(db, 'studentProgress', studentId, 'dailyReports', todayHijriId);
        const reportSnap = await getDoc(reportRef);
        assessedToday = reportSnap.exists();
      } catch (err) {
        console.warn(`Could not check assessment for ${studentId}:`, err);
      }
      
      students.push({ 
        id: studentId, 
        name: dt.name || '(بدون اسم)',
        monthlyScore: dt.monthlyScore || 0,
        rank: dt.rank || 0,
        assessedToday: assessedToday
      });
    }
    
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    // Clear container
    studentsGridContainer.innerHTML = '';
    
    // Show weekend notice if not a study day
    if (!isStudyDay) {
      const weekendNotice = document.createElement('div');
      weekendNotice.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);';
      weekendNotice.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">🌙</div>
        <h3 style="margin: 10px 0; font-size: 22px;">اليوم عطلة نهاية الأسبوع</h3>
        <p style="margin: 5px 0; font-size: 16px;">الجمعة والسبت - لا يمكن إضافة تقييمات جديدة</p>
        <p style="margin: 10px 0; font-size: 14px; opacity: 0.9;">يمكنك مراجعة التقييمات السابقة والتقارير</p>
      `;
      studentsGridContainer.appendChild(weekendNotice);
    }
    
    // Add student count header
    const countHeader = document.createElement('div');
    countHeader.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);';
    countHeader.innerHTML = `
      <div style="font-size: 28px; font-weight: bold; margin-bottom: 5px;">${students.length}</div>
      <div style="font-size: 14px; opacity: 0.95;">إجمالي عدد الطلاب</div>
    `;
    studentsGridContainer.appendChild(countHeader);
    
    // Create compact student cards with numbering
    students.forEach((student, index) => {
      const card = document.createElement('div');
      card.className = 'student-card-compact';
      
      // Add indicator if not assessed today
      const notAssessedBadge = !student.assessedToday 
        ? '<span class="not-assessed-indicator" title="لم يتم التقييم اليوم">⚠️</span>' 
        : '<span style="color: #28a745; font-size: 14px;" title="تم التقييم اليوم">✓</span>';
      
      // Disable assessment button on weekends
      const assessmentBtnDisabled = !isStudyDay ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';
      const assessmentBtnTitle = !isStudyDay ? 'title="لا يمكن التقييم في أيام الإجازة"' : '';
      
      card.innerHTML = `
        <div class="compact-card-content">
          <div class="student-number">${index + 1}</div>
          <div class="student-info-compact">
            <div class="student-name-compact">${student.name}</div>
            <div class="student-id-compact">${student.id}</div>
          </div>
          <div class="student-status-compact">${notAssessedBadge}</div>
          <button class="three-dots-btn-compact" onclick="toggleStudentMenu('${student.id}')">⋮</button>
          <div id="menu-${student.id}" class="student-menu-compact">
            <button class="menu-item assessment" ${assessmentBtnDisabled} ${assessmentBtnTitle} onclick="selectStudentAndShowAssessment('${student.id}', '${student.name}')">
              ➕ تقييم جديد
            </button>
            <button class="menu-item reports" onclick="selectStudentAndShowReports('${student.id}', '${student.name}')">
              📋 التقييمات السابقة
            </button>
            <button class="menu-item exam" onclick="selectStudentAndShowExam('${student.id}', '${student.name}')">
              📝 الاختبار الشهري
            </button>
            <button class="menu-item attendance" onclick="selectStudentAndShowAttendance('${student.id}', '${student.id}')">
              📅 حضور الطالب
            </button>
            <button class="menu-item struggles" onclick="selectStudentAndShowStruggles('${student.id}', '${student.name}')">
              ⚠️ التعثرات
            </button>
            <button class="menu-item info" onclick="selectStudentAndShowInfo('${student.id}', '${student.name}')">
              ℹ️ معلومات الطالب
            </button>
          </div>
        </div>
      `;
      studentsGridContainer.appendChild(card);
    });
    
  } catch (error) {
    console.error('Error loading students:', error);
    studentsGridContainer.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">❌ حدث خطأ في تحميل الطلاب</p>';
  }
}

// Toggle student menu (three dots)
window.toggleStudentMenu = function(studentId) {
  const menu = document.getElementById(`menu-${studentId}`);
  const allMenus = document.querySelectorAll('.student-menu');
  
  // Close all other menus
  allMenus.forEach(m => {
    if (m.id !== `menu-${studentId}`) {
      m.classList.remove('show');
    }
  });
  
  // Toggle current menu
  menu.classList.toggle('show');
};

// Close menus when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.three-dots-btn') && !event.target.closest('.student-menu')) {
    const allMenus = document.querySelectorAll('.student-menu');
    allMenus.forEach(m => m.classList.remove('show'));
  }
});

// Helper functions to select student and show specific section
window.selectStudentAndShowInfo = function(studentId, studentName) {
  showStudentInfoModal(studentId, studentName);
};

window.selectStudentAndShowAssessment = async function(studentId, studentName) {
  // Check if today is a study day
  if (!isTodayAStudyDay()) {
    alert('⚠️ لا يمكن إضافة تقييمات جديدة في أيام الإجازة (الجمعة والسبت)\nيمكنك مراجعة التقييمات السابقة والتقارير');
    return;
  }
  
  await selectStudent(studentId, studentName);
  showNewAssessment();
};

window.selectStudentAndShowReports = async function(studentId, studentName) {
  await selectStudent(studentId, studentName);
  showPastReports();
};

window.selectStudentAndShowExam = async function(studentId, studentName) {
  await selectStudent(studentId, studentName);
  showMonthlyExam();
};

window.selectStudentAndShowAttendance = async function(studentId, studentName) {
  await selectStudent(studentId, studentName);
  showStudentAttendanceReport();
};

window.selectStudentAndShowStruggles = async function(studentId, studentName) {
  await selectStudent(studentId, studentName);
  showStruggles();
};

// Select student function
async function selectStudent(studentId, studentName) {
  currentTeacherStudentId = studentId;
  currentTeacherStudentName = studentName;
  
  // Load full student data including level
  try {
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    if (studentDoc.exists()) {
      currentTeacherStudentData = studentDoc.data();
      console.log('📋 Student Level:', currentTeacherStudentData.level);
    }
  } catch (error) {
    console.error('Error loading student data:', error);
    currentTeacherStudentData = null;
  }
  
  // Show student actions section
  document.getElementById('teacherStudentActions').style.display = 'block';
  document.getElementById('selectedTeacherStudent').textContent = `${studentId} — ${studentName}`;
  
  // Load student data
  loadStudentMonthlyScore(studentId);
  
  // Scroll to actions
  document.getElementById('teacherStudentActions').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Show student info modal
async function showStudentInfoModal(studentId, studentName) {
  try {
    // Get student data
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!studentDoc.exists()) {
      alert('لم يتم العثور على بيانات الطالب');
      return;
    }
    
    const studentData = studentDoc.data();
    
    // Level badge
    let levelText = '';
    let levelColor = '';
    if (studentData.level === 'hifz') {
      levelText = '📚 حفظ';
      levelColor = '#667eea';
    } else if (studentData.level === 'dabt') {
      levelText = '✨ ضبط';
      levelColor = '#f5576c';
    } else if (studentData.level === 'noorani') {
      levelText = '🌟 القاعدة النورانية';
      levelColor = '#feca57';
    } else {
      levelText = studentData.level || 'غير محدد';
      levelColor = '#999';
    }
    
    // Format birth date
    let birthDateFormatted = 'غير محدد';
    if (studentData.birthDate) {
      const birthDate = new Date(studentData.birthDate);
      birthDateFormatted = birthDate.toLocaleDateString('ar-SA');
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'studentInfoModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; overflow-y: auto;';
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 20px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 20px 20px 0 0; position: sticky; top: 0; z-index: 1;">
          <h3 style="margin: 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
            ℹ️ معلومات الطالب
          </h3>
        </div>
        
        <div style="padding: 30px;">
          <!-- Student Name & ID -->
          <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0;">
            <h2 style="margin: 0 0 10px 0; color: #333; font-size: 24px;">${studentData.name || 'غير محدد'}</h2>
            <span style="background: #f0f0f0; padding: 6px 15px; border-radius: 15px; color: #666; font-size: 14px; font-weight: bold;">${studentId}</span>
          </div>
          
          <!-- Info Grid -->
          <div style="display: grid; gap: 18px;">
            <!-- Level -->
            <div class="info-row">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <span style="color: #666; font-weight: bold; font-size: 15px;">📖 المستوى</span>
                <span style="background: ${levelColor}; color: white; padding: 6px 15px; border-radius: 15px; font-size: 14px; font-weight: bold;">${levelText}</span>
              </div>
            </div>
            
            <!-- Birth Date -->
            <div class="info-row">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <span style="color: #666; font-weight: bold; font-size: 15px;">🎂 تاريخ الميلاد</span>
                <span style="color: #333; font-size: 15px;">${birthDateFormatted}</span>
              </div>
            </div>
            
            <!-- Age -->
            <div class="info-row">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <span style="color: #666; font-weight: bold; font-size: 15px;">👤 العمر</span>
                <span style="color: #333; font-size: 15px; font-weight: bold;">${studentData.age || '-'} سنة</span>
              </div>
            </div>
            
            <!-- National ID -->
            ${studentData.nationalId ? `
            <div class="info-row">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <span style="color: #666; font-weight: bold; font-size: 15px;">🆔 رقم الهوية</span>
                <span style="color: #333; font-size: 15px;">${studentData.nationalId}</span>
              </div>
            </div>
            ` : ''}
            
            <!-- Student Phone -->
            ${studentData.studentPhone ? `
            <div class="info-row">
              <div style="padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #666; font-weight: bold; font-size: 15px;">📱 جوال الطالب</span>
                  <span style="color: #333; font-size: 15px; font-weight: bold;">${studentData.studentPhone}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                  <a href="tel:${studentData.studentPhone}" style="flex: 1; text-align: center; padding: 10px; background: #25D366; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    📞 اتصال
                  </a>
                  <a href="https://wa.me/966${studentData.studentPhone.replace(/^0/, '')}" target="_blank" style="flex: 1; text-align: center; padding: 10px; background: #25D366; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    💬 واتساب
                  </a>
                </div>
              </div>
            </div>
            ` : ''}
            
            <!-- Guardian Phone -->
            <div class="info-row">
              <div style="padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #666; font-weight: bold; font-size: 15px;">📞 جوال ولي الأمر</span>
                  <span style="color: #333; font-size: 15px; font-weight: bold;">${studentData.guardianPhone || 'غير محدد'}</span>
                </div>
                ${studentData.guardianPhone ? `
                <div style="display: flex; gap: 10px;">
                  <a href="tel:${studentData.guardianPhone}" style="flex: 1; text-align: center; padding: 10px; background: #007bff; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    📞 اتصال
                  </a>
                  <a href="https://wa.me/966${studentData.guardianPhone.replace(/^0/, '')}" target="_blank" style="flex: 1; text-align: center; padding: 10px; background: #25D366; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    💬 واتساب
                  </a>
                </div>
                ` : ''}
              </div>
            </div>
            
            <!-- Registration Date -->
            ${studentData.registrationDateHijri ? `
            <div class="info-row">
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: #f8f9fa; border-radius: 12px;">
                <span style="color: #666; font-weight: bold; font-size: 15px;">📅 تاريخ التسجيل</span>
                <span style="color: #333; font-size: 14px;">${studentData.registrationDateHijri}</span>
              </div>
            </div>
            ` : ''}
            
            <!-- Monthly Score & Rank -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #51cf66 0%, #2d7a44 100%); border-radius: 12px; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">الدرجة الشهرية</div>
                <div style="font-size: 28px; font-weight: bold;">${studentData.monthlyScore || 0}</div>
              </div>
              <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #ffd43b 0%, #fab005 100%); border-radius: 12px; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">الترتيب</div>
                <div style="font-size: 28px; font-weight: bold;">#${studentData.rank || '-'}</div>
              </div>
            </div>
          </div>
          
          <!-- Close Button -->
          <div style="text-align: center; margin-top: 30px;">
            <button onclick="closeStudentInfoModal()" 
              style="background: #6c757d; color: white; padding: 12px 40px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; font-family: inherit;">
              إغلاق
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('Error loading student info:', error);
    alert('حدث خطأ في تحميل معلومات الطالب');
  }
}

// Close student info modal
window.closeStudentInfoModal = function() {
  const modal = document.getElementById('studentInfoModal');
  if (modal) {
    modal.remove();
  }
};

// Toggle absent mode
window.toggleAbsentMode = function() {
  const studentStatus = document.querySelector('input[name="studentStatus"]:checked').value;
  const fieldsContainer = document.getElementById('assessmentFieldsContainer');
  const excuseTypeContainer = document.getElementById('excuseTypeContainer');
  
  if (studentStatus === 'absent') {
    fieldsContainer.style.display = 'none';
    excuseTypeContainer.style.display = 'block';
  } else {
    fieldsContainer.style.display = 'block';
    excuseTypeContainer.style.display = 'none';
  }
};

// Show new assessment form
window.showNewAssessment = function() {
  // Check if today is Friday (5) or Saturday (6) - Weekend days
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday, 5=Friday, 6=Saturday
  
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    const dayName = dayOfWeek === 5 ? 'الجمعة' : 'السبت';
    alert(`⚠️ تنبيه\n\nاليوم ${dayName} وهو يوم إجازة.\n\nأيام الدراسة من الأحد إلى الخميس فقط.\n\nلا يمكن إضافة تقييمات في أيام الإجازة.`);
    return; // Stop execution
  }
  
  // Check student level and show appropriate form
  const studentLevel = currentTeacherStudentData?.level || 'hifz'; // Default to hifz if not set
  
  console.log('🎯 Opening assessment form for level:', studentLevel);
  
  // Hide all forms first
  document.getElementById('newAssessmentForm').style.display = 'none';
  document.getElementById('dabtAssessmentForm').style.display = 'none';
  document.getElementById('nooraniAssessmentForm').style.display = 'none';
  document.getElementById('pastReportsSection').style.display = 'none';
  document.getElementById('strugglesSection').style.display = 'none';
  document.getElementById('monthlyExamSection').style.display = 'none';
  document.getElementById('attendanceReportSection').style.display = 'none';
  
  // Show the appropriate form based on student level
  if (studentLevel === 'hifz') {
    // Show Hifz form (current default form)
    document.getElementById('newAssessmentForm').style.display = 'block';
    
    // Reset scores for hifz form
    scores = {
      asrPrayer: 5,
      lesson: 5,
      lessonSide: 5,
      revision: 5,
      reading: 5,
      behavior: 5
    };
    
    updateScoreDisplays();
    populateSurahSelects();
    
    // Restore last form data for this student
    restoreStudentFormData();
    
    document.getElementById('teacherStatus').textContent = '';
    updateStruggleIndicator();
    
  } else if (studentLevel === 'dabt') {
    // Show Dabt form (will be created later)
    const dabtForm = document.getElementById('dabtAssessmentForm');
    if (dabtForm) {
      dabtForm.style.display = 'block';
      // Initialize dabt form (will add this later)
      console.log('📝 Dabt form opened');
    } else {
      alert('⚠️ نموذج الضبط قيد التطوير\nسيتم إضافته قريباً');
      document.getElementById('newAssessmentForm').style.display = 'block';
    }
    
  } else if (studentLevel === 'noorani') {
    // Show Noorani form (will be created later)
    const nooraniForm = document.getElementById('nooraniAssessmentForm');
    if (nooraniForm) {
      nooraniForm.style.display = 'block';
      // Initialize noorani form (will add this later)
      console.log('📝 Noorani form opened');
    } else {
      alert('⚠️ نموذج القاعدة النورانية قيد التطوير\nسيتم إضافته قريباً');
      document.getElementById('newAssessmentForm').style.display = 'block';
    }
    
  } else {
    // Unknown level - default to hifz
    console.warn('⚠️ Unknown student level:', studentLevel);
    document.getElementById('newAssessmentForm').style.display = 'block';
    
    scores = {
      asrPrayer: 5,
      lesson: 5,
      lessonSide: 5,
      revision: 5,
      reading: 5,
      behavior: 5
    };
    
    updateScoreDisplays();
    populateSurahSelects();
    document.getElementById('teacherLessonSideText').value = '';
    document.getElementById('teacherStatus').textContent = '';
    updateStruggleIndicator();
  }
};

// Populate Surah dropdowns
function populateSurahSelects() {
  const selects = [
    'lessonSurahFrom', 'revisionSurahFrom', 'lessonSurahTo', 'revisionSurahTo'
  ];
  
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '<option value="">-- اختر السورة --</option>';
      quranSurahs.forEach(surah => {
        const opt = document.createElement('option');
        opt.value = surah.number;
        opt.textContent = `${surah.number}. ${surah.name}`;
        opt.dataset.verses = surah.verses;
        select.appendChild(opt);
      });
    }
  });
}

// Update verse options based on selected surah
window.updateVerseOptions = function(surahSelectId, verseSelectId) {
  const surahSelect = document.getElementById(surahSelectId);
  const verseSelect = document.getElementById(verseSelectId);
  
  if (!surahSelect || !verseSelect) return;
  
  const selectedOption = surahSelect.options[surahSelect.selectedIndex];
  const maxVerses = parseInt(selectedOption.dataset.verses) || 0;
  
  verseSelect.innerHTML = '<option value="">-- رقم الآية --</option>';
  
  for (let i = 1; i <= maxVerses; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    verseSelect.appendChild(opt);
  }
};

// Storage for each student's last form data (per session)
const studentFormDataCache = {};

// Restore form data for current student
function restoreStudentFormData() {
  if (!currentTeacherStudentId) return;
  
  const cachedData = studentFormDataCache[currentTeacherStudentId];
  
  if (cachedData) {
    console.log('✅ Restoring cached data for student:', currentTeacherStudentId, cachedData);
    
    // Use setTimeout to ensure dropdowns are populated first
    setTimeout(() => {
      // Restore lesson surah and verse
      if (cachedData.lessonSurahFrom) {
        document.getElementById('lessonSurahFrom').value = cachedData.lessonSurahFrom;
        updateVerseOptions('lessonSurahFrom', 'lessonVerseFrom');
        
        // Wait for verses to populate
        setTimeout(() => {
          if (cachedData.lessonVerseFrom) {
            document.getElementById('lessonVerseFrom').value = cachedData.lessonVerseFrom;
          }
        }, 50);
      }
      
      if (cachedData.lessonSurahTo) {
        document.getElementById('lessonSurahTo').value = cachedData.lessonSurahTo;
        updateVerseOptions('lessonSurahTo', 'lessonVerseTo');
        
        setTimeout(() => {
          if (cachedData.lessonVerseTo) {
            document.getElementById('lessonVerseTo').value = cachedData.lessonVerseTo;
          }
        }, 50);
      }
      
      // Restore revision surah and verse
      if (cachedData.revisionSurahFrom) {
        document.getElementById('revisionSurahFrom').value = cachedData.revisionSurahFrom;
        updateVerseOptions('revisionSurahFrom', 'revisionVerseFrom');
        
        setTimeout(() => {
          if (cachedData.revisionVerseFrom) {
            document.getElementById('revisionVerseFrom').value = cachedData.revisionVerseFrom;
          }
        }, 50);
      }
      
      if (cachedData.revisionSurahTo) {
        document.getElementById('revisionSurahTo').value = cachedData.revisionSurahTo;
        updateVerseOptions('revisionSurahTo', 'revisionVerseTo');
        
        setTimeout(() => {
          if (cachedData.revisionVerseTo) {
            document.getElementById('revisionVerseTo').value = cachedData.revisionVerseTo;
          }
        }, 50);
      }
      
      // Restore lesson side text
      if (cachedData.lessonSideText) {
        document.getElementById('teacherLessonSideText').value = cachedData.lessonSideText;
      }
    }, 100);
  } else {
    // Clear form if no cached data for this student
    console.log('🆕 No cached data for student:', currentTeacherStudentId);
    document.getElementById('lessonSurahFrom').value = '';
    document.getElementById('lessonVerseFrom').innerHTML = '<option value="">-- رقم الآية --</option>';
    document.getElementById('lessonSurahTo').value = '';
    document.getElementById('lessonVerseTo').innerHTML = '<option value="">-- رقم الآية --</option>';
    document.getElementById('revisionSurahFrom').value = '';
    document.getElementById('revisionVerseFrom').innerHTML = '<option value="">-- رقم الآية --</option>';
    document.getElementById('revisionSurahTo').value = '';
    document.getElementById('revisionVerseTo').innerHTML = '<option value="">-- رقم الآية --</option>';
    document.getElementById('teacherLessonSideText').value = '';
  }
}

// Save current form data for this student
window.saveStudentFormData = function() {
  if (!currentTeacherStudentId) return;
  
  const formData = {
    lessonSurahFrom: document.getElementById('lessonSurahFrom').value,
    lessonVerseFrom: document.getElementById('lessonVerseFrom').value,
    lessonSurahTo: document.getElementById('lessonSurahTo').value,
    lessonVerseTo: document.getElementById('lessonVerseTo').value,
    revisionSurahFrom: document.getElementById('revisionSurahFrom').value,
    revisionVerseFrom: document.getElementById('revisionVerseFrom').value,
    revisionSurahTo: document.getElementById('revisionSurahTo').value,
    revisionVerseTo: document.getElementById('revisionVerseTo').value,
    lessonSideText: document.getElementById('teacherLessonSideText').value
  };
  
  studentFormDataCache[currentTeacherStudentId] = formData;
  console.log('💾 Saved form data for student:', currentTeacherStudentId, formData);
};

// Update score displays
function updateScoreDisplays() {
  document.getElementById('asrPrayerDisplay').textContent = scores.asrPrayer;
  document.getElementById('lessonDisplay').textContent = scores.lesson;
  document.getElementById('lessonSideDisplay').textContent = scores.lessonSide;
  document.getElementById('revisionDisplay').textContent = scores.revision;
  document.getElementById('readingDisplay').textContent = scores.reading;
  document.getElementById('behaviorDisplay').textContent = scores.behavior;
  updateStruggleIndicator();
}

// Change score
window.changeScore = function(field, delta) {
  if (field === 'behavior') {
    scores[field] = Math.max(0, Math.min(10, scores[field] + delta));
  } else if (field === 'lesson') {
    // Lesson can go up to 25 for extra lessons
    scores[field] = Math.max(0, Math.min(25, scores[field] + delta));
  } else {
    scores[field] = Math.max(0, Math.min(5, scores[field] + delta));
  }
  updateScoreDisplays();
};

// Update struggle indicator
function updateStruggleIndicator() {
  const indicator = document.getElementById('struggleIndicator');
  if (!indicator) return;
  
  const isStruggling = scores.lesson < 5 || scores.lessonSide < 5 || scores.revision < 5;
  
  if (isStruggling) {
    indicator.className = 'struggle-indicator struggle-yes';
    indicator.innerHTML = '⚠️ الطالب متعثر - يحتاج متابعة خاصة';
  } else {
    indicator.className = 'struggle-indicator struggle-no';
    indicator.innerHTML = '✅ الطالب غير متعثر - أداء ممتاز';
  }
};

// Save teacher assessment
window.saveTeacherAssessment = async function() {
  // Check if today is a study day
  if (!isTodayAStudyDay()) {
    alert('⚠️ لا يمكن حفظ التقييمات في أيام الإجازة (الجمعة والسبت)');
    return;
  }
  
  if (!currentTeacherStudentId) {
    alert('الرجاء اختيار طالب');
    return;
  }
  
  const statusDiv = document.getElementById('teacherStatus');
  statusDiv.textContent = 'جاري الحفظ...';
  statusDiv.style.color = 'white';
  
  // Check student status (present or absent)
  const studentStatus = document.querySelector('input[name="studentStatus"]:checked').value;
  
  // If student is absent, save absent record directly
  if (studentStatus === 'absent') {
    await saveAbsentRecord();
    return;
  }
  
  // Continue with normal assessment for present students
  // Get Surah and Verse data
  const lessonSurahFrom = document.getElementById('lessonSurahFrom');
  const lessonVerseFrom = document.getElementById('lessonVerseFrom');
  const lessonSurahTo = document.getElementById('lessonSurahTo');
  const lessonVerseTo = document.getElementById('lessonVerseTo');
  
  const revisionSurahFrom = document.getElementById('revisionSurahFrom');
  const revisionVerseFrom = document.getElementById('revisionVerseFrom');
  const revisionSurahTo = document.getElementById('revisionSurahTo');
  const revisionVerseTo = document.getElementById('revisionVerseTo');
  
  const lessonFrom = lessonSurahFrom.value && lessonVerseFrom.value 
    ? `${lessonSurahFrom.options[lessonSurahFrom.selectedIndex].text.split('. ')[1]} ${lessonVerseFrom.value}`
    : '';
    
  const lessonTo = lessonSurahTo.value && lessonVerseTo.value 
    ? `${lessonSurahTo.options[lessonSurahTo.selectedIndex].text.split('. ')[1]} ${lessonVerseTo.value}`
    : '';
    
  const revisionFrom = revisionSurahFrom.value && revisionVerseFrom.value 
    ? `${revisionSurahFrom.options[revisionSurahFrom.selectedIndex].text.split('. ')[1]} ${revisionVerseFrom.value}`
    : '';
    
  const revisionTo = revisionSurahTo.value && revisionVerseTo.value 
    ? `${revisionSurahTo.options[revisionSurahTo.selectedIndex].text.split('. ')[1]} ${revisionVerseTo.value}`
    : '';
  
  const data = {
    studentId: currentTeacherStudentId,
    studentName: currentTeacherStudentName,
    asrPrayerScore: scores.asrPrayer,
    lessonScore: scores.lesson,
    lessonFrom: lessonFrom,
    lessonTo: lessonTo,
    lessonSideScore: scores.lessonSide,
    lessonSideText: (document.getElementById('teacherLessonSideText').value || '').trim(),
    revisionScore: scores.revision,
    revisionFrom: revisionFrom,
    revisionTo: revisionTo,
    readingScore: scores.reading,
    behaviorScore: scores.behavior,
    extraLessonCount: parseInt(document.getElementById('teacherExtraLessons').value) || 0
  };
  
  // Calculate total
  data.totalScore = data.asrPrayerScore + data.lessonScore + data.lessonSideScore
                  + data.revisionScore + data.readingScore + data.behaviorScore;
  
  // Add status field to mark as present (not absent)
  data.status = 'present';
  
  // Check completeness
  const missing = [];
  if (!data.lessonFrom || !data.lessonTo) missing.push('lesson');
  if (!data.revisionFrom || !data.revisionTo) missing.push('revision');
  if (!data.lessonSideText) missing.push('lessonSide');
  data.missingFields = missing;
  data.isComplete = missing.length === 0;
  data.date = serverTimestamp();
  
  // Get today's date in both Hijri and Gregorian formats using accurate calendar
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Set to noon to ensure correct date
  
  // Get accurate Hijri date
  const todayHijri = getCurrentHijriDate();
  const dateId = todayHijri?.hijri || getTodayForStorage(); // YYYY-MM-DD format
  
  // Store Gregorian date for accurate day name retrieval
  const gregorianDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  data.gregorianDate = gregorianDate;
  
  try {
    const targetDoc = doc(db, 'studentProgress', currentTeacherStudentId, 'dailyReports', dateId);
    await setDoc(targetDoc, data);
    const maxScore = 30 + (data.lessonScore > 5 ? data.lessonScore - 5 : 0);
    statusDiv.textContent = `✅ تم حفظ التقييم بنجاح — المجموع: ${data.totalScore}/${maxScore}`;
    statusDiv.style.color = '#51cf66';
    
    // Reload attendance report if visible to update counts
    if (document.getElementById('classAttendanceReportSection')?.style.display !== 'none') {
      await loadClassAttendanceReport(currentTeacherClassId);
    }
    
    // Get recitation type from form (hifz or dabt)
    const recitationType = document.querySelector('input[name="recitationType"]:checked').value;
    
    // Check if student completed a Juz based on STUDENT LEVEL AND recitation type
    let completedJuzNumber = null;
    const studentLevel = currentTeacherStudentData?.level || 'hifz';
    
    // Debug log
    console.log('🔍 Juz Completion Check:', {
      recitationType,
      studentLevel,
      surahFrom: lessonSurahFrom.value,
      ayahFrom: lessonVerseFrom.value,
      surahTo: lessonSurahTo.value,
      ayahTo: lessonVerseTo.value
    });
    
    // Only check for students with matching level
    if (recitationType === 'hifz' && studentLevel === 'hifz') {
      // Reverse memorization (Hifz): check first ayah of first surah in Juz (from "من")
      // Students go from An-Nas → Al-Baqarah (reverse)
      if (lessonSurahFrom.value && lessonVerseFrom.value) {
        const surahNumber = parseInt(lessonSurahFrom.value);
        const startAyah = parseInt(lessonVerseFrom.value);
        console.log(`🔍 Checking Hifz completion: Surah ${surahNumber}, Ayah ${startAyah}`);
        completedJuzNumber = isLastLessonInJuz(surahNumber, startAyah);
        
        if (completedJuzNumber) {
          console.log(`✅ Hifz student completed Juz ${completedJuzNumber}: ${surahNumber}:${startAyah}`);
        } else {
          console.log(`❌ Not a Juz completion for Hifz`);
        }
      }
    } else if (recitationType === 'dabt' && studentLevel === 'dabt') {
      // Forward memorization (Dabt): check last ayah of last surah in Juz (from "إلى")
      // Students go from Al-Baqarah → An-Nas (forward)
      if (lessonSurahTo.value && lessonVerseTo.value) {
        const surahNumber = parseInt(lessonSurahTo.value);
        const endAyah = parseInt(lessonVerseTo.value);
        console.log(`🔍 Checking Dabt completion: Surah ${surahNumber}, Ayah ${endAyah}`);
        completedJuzNumber = isLastLessonInJuzDabt(surahNumber, endAyah);
        
        if (completedJuzNumber) {
          console.log(`✅ Dabt student completed Juz ${completedJuzNumber}: ${surahNumber}:${endAyah}`);
        } else {
          console.log(`❌ Not a Juz completion for Dabt`);
        }
      }
    } else {
      console.log(`⚠️ Level mismatch - recitationType: ${recitationType}, studentLevel: ${studentLevel}`);
    }
    
    if (completedJuzNumber) {
      // Student completed a Juz! Send notification to teacher
      await sendJuzCompletionNotification(
        currentTeacherStudentId,
        currentTeacherStudentName,
        currentTeacherClassId,
        completedJuzNumber,
        dateId,
        recitationType
      );
      
      // Show success message
      const typeText = recitationType === 'hifz' ? 'حفظ' : 'ضبط';
      statusDiv.textContent += ` 🎉 تنبيه: أتم الطالب الجزء ${completedJuzNumber} (${typeText})!`;
    }    // Check if student is struggling and send automatic notifications
    const isStruggling = data.lessonScore < 5 || data.lessonSideScore < 5 || data.revisionScore < 5;
    if (isStruggling) {
      await sendStrugglingNotifications(currentTeacherStudentId, currentTeacherStudentName, data, dateId);
    }
    
    // Auto-refresh struggling students list
    loadTodayStrugglingStudents(currentTeacherClassId);
    
    // Reload monthly scores to update rankings
    await loadMonthlyScores(currentTeacherClassId);
    updateStudentScoreDisplay(currentTeacherStudentId);
    
    // Reload student list to update assessment indicators
    await loadTeacherStudents(currentTeacherClassId);
    
    setTimeout(() => {
      showNewAssessment();
    }, 2000);
  } catch (error) {
    console.error('Error saving assessment:', error);
    statusDiv.textContent = '❌ خطأ في حفظ التقييم: ' + error.message;
    statusDiv.style.color = '#ff6b6b';
  }
};

// Show past reports
window.showPastReports = async function(selectedMonthFilter = 'current-month') {
  document.getElementById('newAssessmentForm').style.display = 'none';
  document.getElementById('pastReportsSection').style.display = 'block';
  document.getElementById('strugglesSection').style.display = 'none';
  document.getElementById('monthlyExamSection').style.display = 'none';
  document.getElementById('attendanceReportSection').style.display = 'none';
  
  const container = document.getElementById('pastReportsContainer');
  container.innerHTML = '<p>جاري تحميل التقارير...</p>';
  
  try {
    // Get actual reports from database
    const reportsSnap = await getDocs(collection(db, 'studentProgress', currentTeacherStudentId, 'dailyReports'));
    
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
    const currentHijriMonth = parts.find(p => p.type === 'month').value;
    
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
    
    // Create month filter dropdown
    let filterHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
        <label style="color: white; font-weight: bold; margin-left: 10px; font-size: 16px;">📅 فلترة حسب الشهر:</label>
        <select id="monthFilter" onchange="window.showPastReports(this.value)" style="padding: 8px 15px; border-radius: 6px; border: 2px solid white; font-size: 14px; font-weight: bold; cursor: pointer; min-width: 200px;">
          <option value="current-month" ${!selectedMonthFilter || selectedMonthFilter === 'current-month' ? 'selected' : ''}>الشهر الحالي</option>
    `;
    
    allMonths.forEach(month => {
      const displayText = `${month.name} ${month.year} هـ`;
      filterHTML += `<option value="${month.key}" ${selectedMonthFilter === month.key ? 'selected' : ''}>${displayText}</option>`;
    });
    
    filterHTML += `
        </select>
      </div>
    `;
    
    // Reports are already filtered by getStudyDaysForHijriMonth
    const filteredReports = completeReports;
    
    if (filteredReports.length === 0) {
      container.innerHTML = filterHTML + '<p class="small">لا توجد تقارير لهذا الشهر</p>';
      return;
    }
    
    let tableHTML = `
      <table class="reports-table compact-reports-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>اليوم</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    filteredReports.forEach((report, index) => {
      // dateId is already in Hijri format YYYY-MM-DD
      const [year, month, day] = report.dateId.split('-');
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[parseInt(month) - 1];
      const fullHijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
      
      // Get day name
      let dayName = 'غير محدد';
      if (report.gregorianDate) {
        const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      } else {
        // Convert Hijri date to get day name
        const gregorianDate = hijriDateToGregorian(report.dateId);
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      }
      
      const uniqueId = `report-${report.dateId}-${index}`;
      
      // Check report status
      if (!report.hasReport) {
        // Not assessed yet
        tableHTML += `
          <tr class="report-row clickable-row" onclick="toggleReportDetails('${uniqueId}')" style="background: #fff3cd; cursor: pointer;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: #856404; font-weight: bold;">⏳ لم يُقيّم</td>
          </tr>
          <tr id="${uniqueId}" class="report-details" style="display: none;">
            <td colspan="3" style="background: #fffbf0; padding: 20px;">
              <div style="text-align: center; color: #856404; padding: 20px;">
                <p style="font-size: 18px; font-weight: bold;">⏳ هذا اليوم لم يُقيّم بعد</p>
                <p>لا توجد تفاصيل متاحة</p>
              </div>
            </td>
          </tr>
        `;
      } else if (report.status === 'absent') {
        // Absent
        const excuseText = report.excuseType === 'withExcuse' ? 'بعذر' : 'بدون عذر';
        tableHTML += `
          <tr class="report-row clickable-row" onclick="toggleReportDetails('${uniqueId}')" style="background: #ffe5e5; cursor: pointer;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: #dc3545; font-weight: bold;">❌ غائب (${excuseText})</td>
          </tr>
          <tr id="${uniqueId}" class="report-details" style="display: none;">
            <td colspan="3" style="background: #fff5f5; padding: 15px;">
              <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #dc3545;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <strong style="color: #dc3545;">❌ غائب (${excuseText})</strong>
                  <button class="delete-report-btn" onclick="event.stopPropagation(); window.deleteReportConfirm('${report.dateId}', '${fullHijriDate}')" style="padding: 5px 15px; font-size: 13px;">🗑️ حذف</button>
                </div>
                <div style="font-size: 13px; color: #666;">
                  <div>📅 ${fullHijriDate}</div>
                  <div>📆 ${dayName}</div>
                </div>
              </div>
            </td>
          </tr>
        `;
      } else {
        // Has assessment with scores
        const statusColor = report.totalScore >= 25 ? '#28a745' : report.totalScore >= 20 ? '#ffc107' : '#dc3545';
        const statusIcon = report.totalScore >= 25 ? '✅' : report.totalScore >= 20 ? '⚠️' : '❌';
        
        // Format lesson and revision details
        const lessonDetails = report.lessonSurahFrom && report.lessonVerseFrom 
          ? `من ${report.lessonSurahFrom}:${report.lessonVerseFrom} إلى ${report.lessonSurahTo}:${report.lessonVerseTo}`
          : 'غير محدد';
        
        const revisionDetails = report.revisionSurahFrom && report.revisionVerseFrom
          ? `من ${report.revisionSurahFrom}:${report.revisionVerseFrom} إلى ${report.revisionSurahTo}:${report.revisionVerseTo}`
          : 'غير محدد';
        
        tableHTML += `
          <tr class="report-row clickable-row" onclick="toggleReportDetails('${uniqueId}')" style="cursor: pointer;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: ${statusColor}; font-weight: bold;">${statusIcon} ${report.totalScore || 0}/30</td>
          </tr>
          <tr id="${uniqueId}" class="report-details" style="display: none;">
            <td colspan="3" style="background: #f8f9fa; padding: 10px;">
              <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.08);">
                
                <!-- Compact Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #667eea;">
                  <div>
                    <span style="font-size: 20px; font-weight: bold; color: ${statusColor};">${report.totalScore || 0}/30</span>
                    <span style="font-size: 12px; color: #999; margin-right: 8px;">${fullHijriDate}</span>
                  </div>
                </div>
                
                <!-- Compact Scores -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
                  <div style="background: #e8f5e9; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #28a745;">${report.asrPrayerScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">العصر</div>
                  </div>
                  <div style="background: #e3f2fd; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #2196f3;">${report.lessonScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">الدرس</div>
                  </div>
                  <div style="background: #f3e5f5; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #9c27b0;">${report.lessonSideScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">جنب الدرس</div>
                  </div>
                  <div style="background: #fff3e0; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #ff9800;">${report.revisionScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">المراجعة</div>
                  </div>
                  <div style="background: #fce4ec; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #e91e63;">${report.readingScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">القراءة</div>
                  </div>
                  <div style="background: #e0f7fa; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #00bcd4;">${report.behaviorScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">السلوك</div>
                  </div>
                </div>
                
                <!-- Recitation Details -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 13px;">
                  <div style="margin-bottom: 6px;">
                    <strong style="color: #2196f3;">📖 الدرس:</strong>
                    <div style="color: #666; margin-top: 2px; margin-right: 20px;">${lessonDetails}</div>
                  </div>
                  <div>
                    <strong style="color: #ff9800;">🔄 المراجعة:</strong>
                    <div style="color: #666; margin-top: 2px; margin-right: 20px;">${revisionDetails}</div>
                  </div>
                </div>
                
                <!-- Notes -->
                ${report.details ? `
                  <div style="background: #fffbea; padding: 8px; border-radius: 6px; margin-bottom: 10px; font-size: 12px; border-right: 3px solid #ffc107;">
                    <strong style="color: #f57c00;">📝 ملاحظات:</strong>
                    <p style="margin: 5px 0 0 0; color: #666; white-space: pre-wrap;">${report.details}</p>
                  </div>
                ` : ''}
                
                <!-- Action Buttons -->
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                  <button class="edit-report-btn" onclick="event.stopPropagation(); window.editReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})" style="padding: 6px 12px; font-size: 12px;">✏️ تعديل</button>
                  <button class="delete-report-btn" onclick="event.stopPropagation(); window.deleteReportConfirm('${report.dateId}', '${fullHijriDate}')" style="padding: 6px 12px; font-size: 12px;">🗑️ حذف</button>
                </div>
              </div>
            </td>
          </tr>
        `;
      }
    });
    
    tableHTML += '</tbody></table>';
    
    const summaryText = selectedMonthFilter === 'all' 
      ? `<h4>إجمالي التقارير: ${filteredReports.length} من ${completeReports.length}</h4>`
      : `<h4>تقارير الشهر المحدد: ${filteredReports.length}</h4>`;
    
    container.innerHTML = filterHTML + summaryText + tableHTML;
  } catch (error) {
    console.error('Error loading reports:', error);
    container.innerHTML = '<p style="color:red;">خطأ في تحميل التقارير</p>';
  }
};

// Toggle report details visibility
window.toggleReportDetails = function(detailsId) {
  const detailsRow = document.getElementById(detailsId);
  if (detailsRow) {
    const isVisible = detailsRow.style.display !== 'none';
    detailsRow.style.display = isVisible ? 'none' : 'table-row';
    
    // Toggle row background for visual feedback
    const mainRow = detailsRow.previousElementSibling;
    if (mainRow) {
      mainRow.style.background = isVisible ? '' : '#e8f5e9';
    }
  }
};

// Show struggles (incomplete scores)
window.showStruggles = async function() {
  document.getElementById('newAssessmentForm').style.display = 'none';
  document.getElementById('pastReportsSection').style.display = 'none';
  document.getElementById('strugglesSection').style.display = 'block';
  document.getElementById('monthlyExamSection').style.display = 'none';
  document.getElementById('attendanceReportSection').style.display = 'none';
  
  const container = document.getElementById('strugglesContainer');
  container.innerHTML = '<p>جاري تحميل التعثرات...</p>';
  
  try {
    const reportsSnap = await getDocs(collection(db, 'studentProgress', currentTeacherStudentId, 'dailyReports'));
    
    if (reportsSnap.empty) {
      container.innerHTML = '<p class="small">لا توجد تقارير لهذا الطالب</p>';
      return;
    }
    
    const struggles = [];
    reportsSnap.forEach(d => {
      const report = { dateId: d.id, ...d.data() };
      
      if (report.lessonScore < 5 || report.lessonSideScore < 5 || report.revisionScore < 5) {
        struggles.push(report);
      }
    });
    
    if (struggles.length === 0) {
      container.innerHTML = '<p style="color: green;">✅ ممتاز! لا توجد تعثرات لهذا الطالب</p>';
      return;
    }
    
    struggles.sort((a, b) => b.dateId.localeCompare(a.dateId));
    
    let html = `<p><strong>عدد الأيام التي بها تعثرات: ${struggles.length}</strong></p>`;
    
    struggles.forEach(report => {
      // report.dateId is in Hijri format (e.g., "1447-06-05")
      const hijriParts = report.dateId.split('-');
      const hijriYear = hijriParts[0];
      const hijriMonth = parseInt(hijriParts[1]);
      const hijriDay = parseInt(hijriParts[2]);
      
      // Get month name
      const monthNames = [
        'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
        'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
        'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
      ];
      const monthName = monthNames[hijriMonth - 1];
      const hijriDate = `${hijriDay} ${monthName} ${hijriYear} هـ`;
      
      // Get day name from gregorianDate field if available
      let dayName;
      if (report.gregorianDate) {
        const gregorianParts = report.gregorianDate.split('-');
        const date = new Date(gregorianParts[0], gregorianParts[1] - 1, gregorianParts[2], 12, 0, 0);
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(date);
      } else {
        // Fallback: assume dateId is Gregorian (for old records)
        const dateParts = report.dateId.split('-');
        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(date);
      }
      
      html += `<div class="struggle-item"><h4>📅 ${dayName} ${hijriDate}</h4>`;
      
      if (report.lessonScore < 5) {
        html += `<p>❌ <strong>الدرس:</strong> ${report.lessonScore}/5 — من ${report.lessonFrom || '-'} إلى ${report.lessonTo || '-'}</p>`;
      }
      
      if (report.lessonSideScore < 5) {
        html += `<p>❌ <strong>جنب الدرس:</strong> ${report.lessonSideScore}/5 — ${report.lessonSideText || '-'}</p>`;
      }
      
      if (report.revisionScore < 5) {
        html += `<p>❌ <strong>المراجعة:</strong> ${report.revisionScore}/5 — من ${report.revisionFrom || '-'} إلى ${report.revisionTo || '-'}</p>`;
      }
      
      html += `<p class="small"><strong>المجموع الكلي:</strong> ${report.totalScore || 0}/30</p></div>`;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading struggles:', error);
    container.innerHTML = '<p style="color:red;">خطأ في تحميل التعثرات</p>';
  }
};

// Setup event listeners
function setupEventListeners() {
  // Check if dropdown exists (old design compatibility)
  if (teacherStudentSelect) {
    teacherStudentSelect.addEventListener('change', (e) => {
      const studentId = e.target.value;
      if (!studentId) {
        teacherStudentActions.style.display = 'none';
        return;
      }
      
      const selectedOption = e.target.options[e.target.selectedIndex];
      const studentText = selectedOption.textContent;
      
      currentTeacherStudentId = studentId;
      currentTeacherStudentName = studentText.split(' — ')[1] || studentId;
      
      selectedTeacherStudentSpan.textContent = studentText;
      teacherStudentActions.style.display = 'block';
      
      // Update student score and rank display
      updateStudentScoreDisplay(studentId);
      
      // Hide all sections
      document.getElementById('newAssessmentForm').style.display = 'none';
      document.getElementById('pastReportsSection').style.display = 'none';
      document.getElementById('strugglesSection').style.display = 'none';
      document.getElementById('monthlyExamSection').style.display = 'none';
      document.getElementById('attendanceReportSection').style.display = 'none';
    });
  }
}

// Load today's struggling students
async function loadTodayStrugglingStudents(classId) {
  try {
    // Get today's date in accurate Hijri format (YYYY-MM-DD)
    const todayHijriData = getCurrentHijriDate();
    const todayHijriId = todayHijriData.hijri; // e.g., "1447-06-20" - accurate format
    
    // Get Hijri date display (e.g., "20 جمادى الآخرة 1447 هـ")
    const [year, month, day] = todayHijriId.split('-');
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const monthName = hijriMonths[parseInt(month) - 1];
    const todayHijriDisplay = `${parseInt(day)} ${monthName} ${year} هـ`;
    
    // Get current day name in Arabic
    const todayDate = new Date();
    const dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(todayDate);
    
    console.log('Checking for struggling students on accurate Hijri date:', todayHijriId);
    console.log('Display format:', todayHijriDisplay);
    
    // Get all students in this class
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', classId)
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    console.log('Found students:', studentsSnap.size);
    
    const strugglingStudents = [];
    
    // Check each student's report for today
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || studentId;
      
      console.log(`Checking student: ${studentId} - ${studentName}`);
      
      // Get today's report specifically using Hijri date ID
      try {
        const todayReportRef = doc(db, 'studentProgress', studentId, 'dailyReports', todayHijriId);
        const todayReportSnap = await getDoc(todayReportRef);
        
        if (todayReportSnap.exists()) {
          const todayReport = todayReportSnap.data();
          console.log(`  Found today's report for ${studentId}:`, todayReport);
          
          const issues = [];
          
          // Check for struggles (scores < 5 for most, < 25 for lesson)
          if (todayReport.lessonScore !== undefined && todayReport.lessonScore < 5) {
            issues.push(`الدرس: ${todayReport.lessonScore}/25`);
          }
          if (todayReport.lessonSideScore !== undefined && todayReport.lessonSideScore < 5) {
            issues.push(`جنب الدرس: ${todayReport.lessonSideScore}/5`);
          }
          if (todayReport.revisionScore !== undefined && todayReport.revisionScore < 5) {
            issues.push(`المراجعة: ${todayReport.revisionScore}/5`);
          }
          
          console.log(`  Issues found:`, issues);
          
          if (issues.length > 0) {
            strugglingStudents.push({
              id: studentId,
              name: studentName,
              issues: issues,
              scores: {
                lesson: todayReport.lessonScore,
                lessonSide: todayReport.lessonSideScore,
                revision: todayReport.revisionScore
              }
            });
          }
        } else {
          console.log(`  No report found for today for ${studentId}`);
        }
      } catch (error) {
        console.error(`  Error checking report for ${studentId}:`, error);
      }
    }
    
    console.log('Total struggling students:', strugglingStudents.length);
    
    // Note: The red box (strugglingStudentsSection) has been removed from HTML
    // Struggling students are now only shown in the "متعثرو اليوم" modal report
    // This function now only stores data for internal use
    
    if (strugglingStudents.length > 0) {
      // Store struggling students data for sharing/reporting
      window.strugglingDataForSharing = {
        students: strugglingStudents,
        date: todayHijriDisplay,
        dayName: dayName,
        classId: classId
      };
      
      console.log('✅ Struggling students data stored for reporting:', strugglingStudents.length);
    } else {
      window.strugglingDataForSharing = null;
      console.log('✅ No struggling students today');
    }
  } catch (error) {
    console.error('Error loading struggling students:', error);
  }
}

// Send struggling students list to admin
window.sendStrugglingToAdmin = async function() {
  if (!window.currentStrugglingStudents || window.currentStrugglingStudents.length === 0) {
    alert('لا يوجد طلاب متعثرين لإرسالهم');
    return;
  }
  
  try {
    const teacherId = sessionStorage.getItem('loggedInTeacher');
    const teacherName = sessionStorage.getItem('loggedInTeacherName');
    const today = getTodayForStorage(); // Gregorian for database
    const todayHijri = gregorianToHijriDisplay(today);
    
    // Save struggling report to Firestore
    await setDoc(doc(db, 'strugglingReports', `${teacherId}_${today}`), {
      teacherId: teacherId,
      teacherName: teacherName,
      classId: currentTeacherClassId,
      date: today, // Gregorian for database
      dateHijri: todayHijri, // Hijri for display
      timestamp: serverTimestamp(),
      students: window.currentStrugglingStudents
    });
    
    alert('✅ تم إرسال القائمة للإدارة بنجاح!');
    
    // Reload struggling students list to show sent status
    loadTodayStrugglingStudents(currentTeacherClassId);
  } catch (error) {
    console.error('Error sending struggling report:', error);
    alert('حدث خطأ أثناء إرسال القائمة');
  }
};

// Load monthly scores for all students in the class
async function loadMonthlyScores(classId) {
  try {
    // Get current Hijri month and year
    const now = new Date();
    now.setHours(12, 0, 0, 0); // Noon for accurate conversion
    
    const hijriFormatter = new Intl.DateTimeFormat('en-SA-u-ca-islamic', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Riyadh'
    });
    
    const parts = hijriFormatter.formatToParts(now);
    const currentHijriYear = parts.find(p => p.type === 'year').value;
    const currentHijriMonth = parts.find(p => p.type === 'month').value;
    
    // Create Hijri month prefix (e.g., "1447-06" for all dates in Jumada al-Akhirah 1447)
    const hijriMonthPrefix = `${currentHijriYear}-${currentHijriMonth}`;
    
    // Get all students in this class
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', classId)
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    const studentsScores = [];
    
    // Calculate scores for each student
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || studentId;
      
      // Get all daily reports for this student in current Hijri month
      const reportsSnap = await getDocs(
        collection(db, 'studentProgress', studentId, 'dailyReports')
      );
      
      let totalScore = 0;
      let daysCount = 0;
      
      reportsSnap.forEach(reportDoc => {
        const reportDateId = reportDoc.id; // This is in Hijri format: YYYY-MM-DD
        
        // Check if report is from current Hijri month (compare YYYY-MM prefix)
        if (reportDateId.startsWith(hijriMonthPrefix)) {
          const reportData = reportDoc.data();
          totalScore += reportData.totalScore || 0;
          daysCount++;
        }
      });
      
      // Get exam score from actual exam reports (not from user data)
      let examScore = 0;
      try {
        const examReportsSnap = await getDocs(
          collection(db, 'studentProgress', studentId, 'examReports')
        );
        
        // Check if there's an exam report for current month
        examReportsSnap.forEach(examDoc => {
          const examDateId = examDoc.id;
          // Check if exam is from current Hijri month
          if (examDateId.startsWith(hijriMonthPrefix)) {
            const examData = examDoc.data();
            examScore = examData.finalScore || 0;
          }
        });
      } catch (error) {
        console.warn(`Could not load exam reports for ${studentId}:`, error);
      }
      
      const average = (examScore > 0) ? ((totalScore + examScore) / 2) : 0;
      
      studentsScores.push({
        id: studentId,
        name: studentName,
        totalScore: totalScore,
        daysCount: daysCount,
        examScore: examScore,
        average: average // Average = 0 if no exam
      });
    }
    
    // Sort by average (descending)
    studentsScores.sort((a, b) => b.average - a.average);
    
    // Add rank to each student
    studentsScores.forEach((student, index) => {
      student.rank = index + 1;
    });
    
    // Store for later use
    window.currentClassScores = studentsScores;
    
    // Display the scores
    displayMonthlyScores(studentsScores);
    
  } catch (error) {
    console.error('Error loading monthly scores:', error);
  }
}

// Display monthly scores
function displayMonthlyScores(studentsScores) {
  const allStudentsList = document.getElementById('allStudentsList');
  
  if (!allStudentsList) return;
  
  if (studentsScores.length === 0) {
    allStudentsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا توجد بيانات</p>';
    return;
  }
  
  // Medal icons for top 3
  const medals = ['🥇', '🥈', '🥉'];
  
  // Display all students in a single list
  allStudentsList.innerHTML = studentsScores.map(student => {
    const rankDisplay = student.rank <= 3 ? medals[student.rank - 1] : `#${student.rank}`;
    const avgDisplay = student.average > 0 ? student.average.toFixed(1) : '0.0';
    const rowBg = student.rank <= 3 ? '#f0f7ff' : (student.rank % 2 === 0 ? '#f9f9f9' : 'white');
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #e0e0e0; background: ${rowBg}; border-radius: 5px; margin-bottom: 3px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <span style="font-size: 18px; font-weight: bold; min-width: 30px;">${rankDisplay}</span>
          <span style="font-weight: ${student.rank <= 3 ? 'bold' : '500'}; color: #333; font-size: 14px;">${student.name}</span>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="text-align: center; min-width: 45px;">
            <div style="font-size: 10px; color: #666;">النقاط</div>
            <div style="font-size: 14px; font-weight: bold; color: #667eea;">${student.totalScore}</div>
          </div>
          <div style="text-align: center; min-width: 50px;">
            <div style="font-size: 10px; color: #666;">الاختبار</div>
            <div style="font-size: 14px; font-weight: bold; color: #764ba2;">${student.examScore}</div>
          </div>
          <div style="text-align: center; min-width: 50px;">
            <div style="font-size: 10px; color: #666;">المعدل</div>
            <div style="font-size: 15px; font-weight: bold; color: ${student.rank <= 3 ? '#28a745' : '#17a2b8'};">${avgDisplay}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Get student rank and score by ID
function getStudentRankAndScore(studentId) {
  if (!window.currentClassScores) return { rank: '-', score: 0 };
  
  const student = window.currentClassScores.find(s => s.id === studentId);
  return student ? { rank: student.rank, score: student.totalScore } : { rank: '-', score: 0 };
}

// Update student score display
function updateStudentScoreDisplay(studentId) {
  const { rank, score } = getStudentRankAndScore(studentId);
  
  const rankElement = document.getElementById('studentRankValue');
  const scoreElement = document.getElementById('studentScoreValue');
  
  if (rankElement) rankElement.textContent = `#${rank}`;
  if (scoreElement) scoreElement.textContent = score;
}

// Load student monthly score
async function loadStudentMonthlyScore(studentId) {
  try {
    // First, ensure we have class scores loaded
    if (!window.currentClassScores || window.currentClassScores.length === 0) {
      await loadMonthlyScores(currentTeacherClassId);
    }
    
    // Update display
    updateStudentScoreDisplay(studentId);
  } catch (error) {
    console.error('Error loading student monthly score:', error);
  }
}

// Show Monthly Exam Section
window.showMonthlyExam = function() {
  document.getElementById('newAssessmentForm').style.display = 'none';
  document.getElementById('pastReportsSection').style.display = 'none';
  document.getElementById('strugglesSection').style.display = 'none';
  document.getElementById('monthlyExamSection').style.display = 'block';
  document.getElementById('attendanceReportSection').style.display = 'none';
  
  // Fill student and teacher info
  document.getElementById('examStudentName').value = currentTeacherStudentName || '';
  document.getElementById('examTeacherName').value = sessionStorage.getItem('loggedInTeacherName') || '';
  document.getElementById('examDate').value = formatHijriDate(new Date());
  
  // Hide send to admin button initially
  document.getElementById('sendExamToAdminBtn').style.display = 'none';
};

// Show Class Attendance Report (all students)
window.showClassAttendanceReport = async function() {
  document.getElementById('classAttendanceReportSection').style.display = 'block';
  
  // Fill teacher info
  const teacherName = sessionStorage.getItem('loggedInTeacherName') || 'المعلم';
  document.getElementById('classAttendanceTeacherName').textContent = teacherName;
  
  await loadClassAttendanceReport(currentTeacherClassId);
};

// Hide Class Attendance Report
window.hideClassAttendanceReport = function() {
  document.getElementById('classAttendanceReportSection').style.display = 'none';
};

// Load attendance report for entire class
async function loadClassAttendanceReport(classId) {
  console.log('🔵 loadClassAttendanceReport: Start, classId:', classId);
  const tbody = document.getElementById('classAttendanceTableBody');
  console.log('🔵 tbody element:', tbody);
  tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">جاري تحميل البيانات...</div>';
  
  try {
    // Get all students in the class
    console.log('🔵 Fetching students for class:', classId);
    const studentsSnap = await getDocs(query(collection(db, 'users'), where('classId', '==', classId), where('role', '==', 'student')));
    console.log('🔵 Students found:', studentsSnap.size);
    
    if (studentsSnap.empty) {
      console.log('⚠️ No students found');
      tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">لا يوجد طلاب في هذه الحلقة</div>';
      return;
    }
    
    document.getElementById('classAttendanceTotalStudents').textContent = studentsSnap.size;
    
    // Get current Hijri month info using accurate calendar
    const today = new Date();
    const currentMonth = formatHijriDate(today);
    document.getElementById('classAttendancePeriod').textContent = currentMonth;
    
    // Get all study days (Sunday-Thursday) in current Hijri month
    const studyDays = getStudyDaysInCurrentHijriMonth();
    
    // Populate date filter dropdown
    const dateFilter = document.getElementById('attendanceDateFilter');
    dateFilter.innerHTML = '<option value="all">جميع أيام الشهر الحالي</option>';
    studyDays.forEach(day => {
      const option = document.createElement('option');
      option.value = day;
      
      // Format date for display
      const parts = day.split('-');
      const hijriYear = parts[0];
      const hijriMonth = parseInt(parts[1]);
      const hijriDay = parseInt(parts[2]);
      const monthNames = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = monthNames[hijriMonth - 1];
      
      option.textContent = `${hijriDay} ${monthName} ${hijriYear} هـ`;
      dateFilter.appendChild(option);
    });
    
    // Collect attendance data for each student
    const attendanceData = [];
    
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || 'غير محدد';
      
      // Get all daily reports for this student
      const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
      
      // Count for each status
      let presentCount = 0;  // Has assessment (not absent)
      let absentCount = 0;   // Marked as absent
      let notAssessedCount = 0; // No record at all
      
      studyDays.forEach(studyDay => {
        const reportDoc = reportsSnap.docs.find(doc => doc.id === studyDay);
        
        if (reportDoc) {
          const reportData = reportDoc.data();
          
          // Check status field first, then fallback to checking if it's an actual assessment
          if (reportData.status === 'absent') {
            // Explicitly marked as absent
            absentCount++;
          } else if (reportData.status === 'present' || reportData.totalScore !== undefined) {
            // Either explicitly marked as present, or has scores (old format)
            presentCount++;
          } else {
            // Has record but unclear status
            notAssessedCount++;
          }
        } else {
          notAssessedCount++;
        }
      });
      
      attendanceData.push({
        id: studentId,
        name: studentName,
        present: presentCount,
        absent: absentCount,
        notAssessed: notAssessedCount,
        total: studyDays.length
      });
    }
    
    // Sort by name
    attendanceData.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Store for filtering
    window.currentAttendanceData = attendanceData;
    window.currentStudyDays = studyDays;
    
    // Display table
    displayAttendanceTable(attendanceData);
    console.log('✅ loadClassAttendanceReport: Complete');
    
  } catch (error) {
    console.error('❌ Error loading attendance report:', error);
    tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">حدث خطأ في تحميل البيانات</div>';
  }
}

// Display attendance table
function displayAttendanceTable(attendanceData) {
  console.log('🔵 displayAttendanceTable: Displaying', attendanceData.length, 'students');
  const tbody = document.getElementById('classAttendanceTableBody');
  
  if (attendanceData.length === 0) {
    tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">لا توجد بيانات حضور</div>';
    return;
  }
  
  // Build mobile-friendly compact list
  tbody.innerHTML = attendanceData.map((student, index) => {
    const uniqueId = `attendance-student-${student.id}`;
    
    return `
      <!-- Student Card -->
      <div onclick="toggleAttendanceDetails('${uniqueId}')" style="background: white; padding: 12px 15px; border-radius: 8px; border: 2px solid #e0e0e0; cursor: pointer; transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-weight: bold; color: #333; font-size: 15px; margin-bottom: 4px;">
              ${index + 1}. ${student.name}
            </div>
            <div style="font-size: 12px; color: #666;">
              <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 10px; margin-left: 5px;">✅ ${student.present}</span>
              <span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 10px; margin-left: 5px;">❌ ${student.absent}</span>
              <span style="background: #ffc107; color: white; padding: 2px 8px; border-radius: 10px;">⏳ ${student.notAssessed}</span>
            </div>
          </div>
          <div style="font-size: 16px; font-weight: bold; color: #17a2b8; min-width: 40px; text-align: center;">
            ${student.total}
          </div>
        </div>
      </div>
      
      <!-- Expanded Details -->
      <div id="${uniqueId}" style="display: none; background: #f8f9fa; padding: 12px 15px; border-radius: 8px; margin-top: -6px; border: 2px solid #e0e0e0; border-top: none; animation: slideDown 0.3s ease;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">✅ حاضر</div>
            <div style="font-size: 20px; font-weight: bold; color: #28a745;">${student.present}</div>
          </div>
          <div style="background: #ffebee; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">❌ غائب</div>
            <div style="font-size: 20px; font-weight: bold; color: #dc3545;">${student.absent}</div>
          </div>
          <div style="background: #fff3e0; padding: 10px; border-radius: 6px; text-align: center;">
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">⏳ لم يُقيَّم</div>
            <div style="font-size: 20px; font-weight: bold; color: #ffc107;">${student.notAssessed}</div>
          </div>
        </div>
        <div style="margin-top: 10px; text-align: center; background: #e3f2fd; padding: 10px; border-radius: 6px;">
          <div style="font-size: 12px; color: #666;">📊 إجمالي الأيام</div>
          <div style="font-size: 20px; font-weight: bold; color: #17a2b8;">${student.total}</div>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('✅ Attendance table displayed');
}

// Toggle attendance details
window.toggleAttendanceDetails = function(uniqueId) {
  const detailsDiv = document.getElementById(uniqueId);
  if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
    detailsDiv.style.display = 'block';
  } else {
    detailsDiv.style.display = 'none';
  }
};

// Filter attendance by date
window.filterAttendanceByDate = async function() {
  console.log('🔵 filterAttendanceByDate: Start');
  const selectedDate = document.getElementById('attendanceDateFilter').value;
  console.log('🔵 Selected date:', selectedDate);
  
  if (selectedDate === 'all') {
    // Show all days
    console.log('🔵 Showing all days data');
    displayAttendanceTable(window.currentAttendanceData);
    return;
  }
  
  // Filter for specific date
  const tbody = document.getElementById('classAttendanceTableBody');
  tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">جاري تحميل البيانات...</div>';
  
  try {
    console.log('🔵 Fetching students for specific date...');
    const studentsSnap = await getDocs(query(collection(db, 'users'), where('classId', '==', currentTeacherClassId), where('role', '==', 'student')));
    console.log('🔵 Students found:', studentsSnap.size);
    
    const dayData = [];
    
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || 'غير محدد';
      
      // Check report for selected date
      const reportRef = doc(db, 'studentProgress', studentId, 'dailyReports', selectedDate);
      const reportSnap = await getDoc(reportRef);
      
      let status = 'لم يُقيَّم';
      let statusColor = '#ffc107';
      let statusIcon = '⏳';
      
      if (reportSnap.exists()) {
        const reportData = reportSnap.data();
        
        if (reportData.status === 'absent') {
          status = 'غائب';
          statusColor = '#dc3545';
          statusIcon = '❌';
        } else if (reportData.status === 'present' || reportData.totalScore !== undefined) {
          // Either explicitly marked as present, or has scores (old format)
          status = 'حاضر';
          statusColor = '#28a745';
          statusIcon = '✅';
        }
      }
      
      dayData.push({
        id: studentId,
        name: studentName,
        status: status,
        statusColor: statusColor,
        statusIcon: statusIcon
      });
    }
    
    // Sort by name
    dayData.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    console.log('🔵 Day data prepared:', dayData.length, 'students');
    
    // Display single day view - Mobile-friendly cards
    tbody.innerHTML = dayData.map((student, index) => {
      return `
        <div style="background: white; padding: 12px 15px; border-radius: 8px; border: 2px solid #e0e0e0; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #333; font-size: 15px;">
                ${index + 1}. ${student.name}
              </div>
            </div>
            <div style="background: ${student.statusColor}; color: white; padding: 8px 15px; border-radius: 20px; font-weight: bold; font-size: 14px;">
              ${student.statusIcon} ${student.status}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    console.log('✅ Single day view displayed');
    
  } catch (error) {
    console.error('❌ Error filtering attendance:', error);
    tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">حدث خطأ في تحميل البيانات</div>';
  }
};

// Show Student Attendance Report (single student)
window.showStudentAttendanceReport = async function() {
  if (!currentTeacherStudentId) {
    alert('لم يتم اختيار طالب');
    return;
  }
  
  document.getElementById('newAssessmentForm').style.display = 'none';
  document.getElementById('pastReportsSection').style.display = 'none';
  document.getElementById('strugglesSection').style.display = 'none';
  document.getElementById('monthlyExamSection').style.display = 'none';
  document.getElementById('attendanceReportSection').style.display = 'block';
  
  await loadStudentAttendanceReport(currentTeacherStudentId, currentTeacherStudentName);
};

// Load attendance report for single student
async function loadStudentAttendanceReport(studentId, studentName) {
  try {
    // Fill student name
    document.getElementById('studentAttendanceName').textContent = studentName;
    
    // Get current month info using accurate calendar
    const today = new Date();
    const currentMonth = formatHijriDate(today);
    document.getElementById('studentAttendancePeriod').textContent = currentMonth;
    
    // Get all study days (Sunday-Thursday) in current Hijri month
    const studyDays = getStudyDaysInCurrentHijriMonth();
    const totalStudyDays = studyDays.length;
    
    // Get student reports
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    // Count how many study days have reports (present days)
    let presentCount = 0;
    studyDays.forEach(studyDay => {
      // Check if there's a report for this study day
      const hasReport = reportsSnap.docs.some(doc => doc.id === studyDay);
      if (hasReport) {
        presentCount++;
      }
    });
    
    const absentCount = totalStudyDays - presentCount;
    
    // Update display (only 2 cards: present and absent)
    document.getElementById('studentPresentDays').textContent = presentCount;
    document.getElementById('studentAbsentDays').textContent = absentCount;
    
  } catch (error) {
    console.error('Error loading student attendance:', error);
    alert('حدث خطأ في تحميل بيانات الحضور');
  }
}

// Send absent student to admin
window.sendAbsentStudentToAdmin = async function(studentId, studentName, absentCount) {
  if (!confirm(`هل تريد إرسال تقرير غياب الطالب "${studentName}" للإدارة؟\nعدد أيام الغياب: ${absentCount}`)) {
    return;
  }
  
  try {
    const hijriToday = getCurrentHijriDate();
    const todayHijriId = hijriToday?.hijri || getTodayForStorage(); // "1447-06-05"
    const todayGregorian = getTodayForStorage(); // For gregorianDate field
    
    const teacherName = sessionStorage.getItem('loggedInTeacherName') || 'المعلم';
    const currentMonth = formatHijriDate(new Date());
    
    // Save to absentStudentsReports collection
    const reportRef = doc(db, 'absentStudentsReports', `${studentId}_${todayHijriId}`);
    await setDoc(reportRef, {
      studentId: studentId,
      studentName: studentName,
      absentCount: absentCount,
      month: currentMonth,
      reportDate: todayHijriId, // Hijri date
      gregorianDate: todayGregorian, // Gregorian for day name
      teacherName: teacherName,
      classId: currentTeacherClassId,
      timestamp: serverTimestamp()
    });
    
    alert(`✅ تم إرسال تقرير غياب الطالب "${studentName}" للإدارة بنجاح`);
    
    // Reload attendance report
    await loadClassAttendanceReport(currentTeacherClassId);
    
  } catch (error) {
    console.error('Error sending absent student report:', error);
    alert('❌ حدث خطأ في الإرسال: ' + error.message);
  }
};

// Generate exam questions
window.generateExamQuestions = function() {
  const count = parseInt(document.getElementById('examQuestionsCount').value) || 6;
  const container = document.getElementById('examQuestionsDisplay');
  container.innerHTML = '';
  
  // Sample surahs for exam
  const examSurahs = quranSurahs.slice(); // All surahs
  
  let cardsHTML = '';
  
  for (let i = 1; i <= count; i++) {
    const randomIndex = Math.floor(Math.random() * examSurahs.length);
    const surah = examSurahs[randomIndex];
    
    cardsHTML += `
      <div class="exam-question-card" data-question="${i}" style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 2px solid #667eea;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 16px;">📝 السؤال ${i}</span>
          <span class="exam-row-points" style="background: rgba(255,255,255,0.3); padding: 5px 15px; border-radius: 20px; font-weight: bold;">0 نقطة</span>
        </div>
        
        <!-- السورة والموضع -->
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #666; font-size: 13px; font-weight: bold;">📖 السورة</label>
          <input type="text" class="exam-surah-input" list="surahDatalist" value="${surah.name}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;" />
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #666; font-size: 13px; font-weight: bold;">📍 الموضع (اختياري)</label>
          <input type="text" class="exam-position-input" placeholder="مثال: من الآية 1 إلى الآية 10" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px;" />
        </div>
        
        <!-- الأخطاء -->
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 12px 0; color: #333; font-size: 14px;">⚠️ تسجيل الأخطاء</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
            
            <div style="background: #ffeaa7; padding: 10px; border-radius: 8px;">
              <label style="display: block; margin-bottom: 6px; color: #666; font-size: 12px; text-align: center; font-weight: bold;">⚡ تنبيه</label>
              <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <button onclick="changeExamCount(this, 'tanbih', -1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">-</button>
                <input type="number" class="exam-count" data-type="tanbih" value="0" min="0" style="width: 50px; padding: 6px; text-align: center; border: 2px solid #fdcb6e; border-radius: 6px; font-weight: bold;" onchange="calculateExamResults()" />
                <button onclick="changeExamCount(this, 'tanbih', 1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">+</button>
              </div>
            </div>
            
            <div style="background: #fab1a0; padding: 10px; border-radius: 8px;">
              <label style="display: block; margin-bottom: 6px; color: #666; font-size: 12px; text-align: center; font-weight: bold;">❌ خطأ</label>
              <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <button onclick="changeExamCount(this, 'khata', -1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">-</button>
                <input type="number" class="exam-count" data-type="khata" value="0" min="0" style="width: 50px; padding: 6px; text-align: center; border: 2px solid #e17055; border-radius: 6px; font-weight: bold;" onchange="calculateExamResults()" />
                <button onclick="changeExamCount(this, 'khata', 1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">+</button>
              </div>
            </div>
            
            <div style="background: #a29bfe; padding: 10px; border-radius: 8px;">
              <label style="display: block; margin-bottom: 6px; color: #fff; font-size: 12px; text-align: center; font-weight: bold;">🎯 تجويد</label>
              <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <button onclick="changeExamCount(this, 'tajweed', -1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">-</button>
                <input type="number" class="exam-count" data-type="tajweed" value="0" min="0" style="width: 50px; padding: 6px; text-align: center; border: 2px solid #6c5ce7; border-radius: 6px; font-weight: bold;" onchange="calculateExamResults()" />
                <button onclick="changeExamCount(this, 'tajweed', 1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">+</button>
              </div>
            </div>
            
            <div style="background: #ff7675; padding: 10px; border-radius: 8px;">
              <label style="display: block; margin-bottom: 6px; color: #fff; font-size: 12px; text-align: center; font-weight: bold;">🚫 لحن جلي</label>
              <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <button onclick="changeExamCount(this, 'lahn', -1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">-</button>
                <input type="number" class="exam-count" data-type="lahn" value="0" min="0" style="width: 50px; padding: 6px; text-align: center; border: 2px solid #d63031; border-radius: 6px; font-weight: bold;" onchange="calculateExamResults()" />
                <button onclick="changeExamCount(this, 'lahn', 1)" style="width: 32px; height: 32px; border: none; background: rgba(0,0,0,0.1); border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 16px;">+</button>
              </div>
            </div>
            
          </div>
        </div>
        
        <!-- ملاحظات -->
        <div>
          <label style="display: block; margin-bottom: 5px; color: #666; font-size: 13px; font-weight: bold;">📋 ملاحظات</label>
          <textarea class="exam-note-input" placeholder="أضف ملاحظاتك هنا..." style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; min-height: 60px; resize: vertical;"></textarea>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = cardsHTML;
  document.getElementById('examQuestionsContainer').style.display = 'block';
};

// Change exam count
window.changeExamCount = function(button, type, delta) {
  const card = button.closest('.exam-question-card');
  const input = card.querySelector(`input[data-type="${type}"]`);
  let value = parseInt(input.value) || 0;
  value = Math.max(0, value + delta);
  input.value = value;
  calculateExamResults();
};

// Calculate exam results
window.calculateExamResults = function() {
  const wTanbih = parseFloat(document.getElementById('examWeightTanbih').value) || 0.5;
  const wKhata = parseFloat(document.getElementById('examWeightKhata').value) || 1;
  const wTajweed = parseFloat(document.getElementById('examWeightTajweed').value) || 2;
  const wLahn = parseFloat(document.getElementById('examWeightLahn').value) || 3;
  const maxScore = parseFloat(document.getElementById('examMaxScore').value) || 100;
  const passPercent = parseFloat(document.getElementById('examPassPercent').value) || 97;
  
  let sumTanbih = 0, sumKhata = 0, sumTajweed = 0, sumLahn = 0, sumPoints = 0;
  
  const cards = document.querySelectorAll('#examQuestionsDisplay .exam-question-card');
  cards.forEach(card => {
    const tanbih = parseInt(card.querySelector('input[data-type="tanbih"]').value) || 0;
    const khata = parseInt(card.querySelector('input[data-type="khata"]').value) || 0;
    const tajweed = parseInt(card.querySelector('input[data-type="tajweed"]').value) || 0;
    const lahn = parseInt(card.querySelector('input[data-type="lahn"]').value) || 0;
    
    const rowPoints = (tanbih * wTanbih) + (khata * wKhata) + (tajweed * wTajweed) + (lahn * wLahn);
    card.querySelector('.exam-row-points').textContent = rowPoints.toFixed(2) + ' نقطة';
    
    sumTanbih += tanbih;
    sumKhata += khata;
    sumTajweed += tajweed;
    sumLahn += lahn;
    sumPoints += rowPoints;
  });
  
  const finalScore = Math.max(0, maxScore - sumPoints);
  const passScore = (maxScore * passPercent) / 100;
  const passed = finalScore >= passScore;
  
  document.getElementById('examSumTanbih').textContent = sumTanbih;
  document.getElementById('examSumKhata').textContent = sumKhata;
  document.getElementById('examSumTajweed').textContent = sumTajweed;
  document.getElementById('examSumLahn').textContent = sumLahn;
  document.getElementById('examSumPoints').textContent = sumPoints.toFixed(2);
  document.getElementById('examFinalScore').textContent = finalScore.toFixed(2);
  document.getElementById('examMaxScoreDisplay').textContent = maxScore;
  
  const resultBadge = document.getElementById('examResultBadge');
  resultBadge.style.display = 'block';
  if (passed) {
    resultBadge.style.background = '#28a745';
    resultBadge.textContent = `✅ ناجح (${finalScore.toFixed(2)} / ${maxScore})`;
  } else {
    resultBadge.style.background = '#dc3545';
    resultBadge.textContent = `❌ راسب (${finalScore.toFixed(2)} / ${maxScore})`;
  }
};

// Save exam results
window.saveExamResults = async function() {
  if (!currentTeacherStudentId) {
    alert('لم يتم اختيار طالب');
    return;
  }
  
  const finalScore = parseFloat(document.getElementById('examFinalScore').textContent) || 0;
  const statusDiv = document.getElementById('examSaveStatus');
  
  try {
    statusDiv.textContent = 'جاري حفظ درجة الاختبار...';
    statusDiv.style.color = '#667eea';
    
    // Get exam details
    const maxScore = parseInt(document.getElementById('examMaxScore').value) || 100;
    const passPercent = parseInt(document.getElementById('examPassPercent').value) || 97;
    const passScore = (maxScore * passPercent) / 100;
    const isPassed = finalScore >= passScore;
    const hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date());
    const teacherName = sessionStorage.getItem('loggedInTeacherName') || 'المعلم';
    
    // Get questions data
    const questions = [];
    const cards = document.querySelectorAll('#examQuestionsDisplay .exam-question-card');
    cards.forEach((card, index) => {
      const surahInput = card.querySelector('.exam-surah-input');
      const positionInput = card.querySelector('.exam-position-input');
      const noteInput = card.querySelector('.exam-note-input');
      const tanbih = parseInt(card.querySelector('input[data-type="tanbih"]').value) || 0;
      const khata = parseInt(card.querySelector('input[data-type="khata"]').value) || 0;
      const tajweed = parseInt(card.querySelector('input[data-type="tajweed"]').value) || 0;
      const lahn = parseInt(card.querySelector('input[data-type="lahn"]').value) || 0;
      const pointsText = card.querySelector('.exam-row-points').textContent;
      const points = parseFloat(pointsText.replace(' نقطة', '')) || 0;
      
      questions.push({
        number: index + 1,
        surah: surahInput ? surahInput.value : '',
        position: positionInput ? positionInput.value : '',
        notes: noteInput ? noteInput.value : '',
        errors: {
          tanbih: tanbih,
          khata: khata,
          tajweed: tajweed,
          lahn: lahn
        },
        deductedPoints: points
      });
    });
    
    // Save to monthlyExams collection for the management section
    const examId = getTodayForStorage(); // Use date as exam ID
    const examRef = doc(db, 'monthlyExams', currentTeacherStudentId, 'exams', examId);
    await setDoc(examRef, {
      studentId: currentTeacherStudentId,
      studentName: currentTeacherStudentName,
      teacherName: teacherName,
      hijriDate: hijriDate,
      totalScore: finalScore,
      maxScore: maxScore,
      passPercent: passPercent,
      isPassed: isPassed,
      questions: questions,
      timestamp: serverTimestamp()
    });
    
    // Also save to examReports for top performers calculation
    const examReportRef = doc(db, 'studentProgress', currentTeacherStudentId, 'examReports', examId);
    await setDoc(examReportRef, {
      studentId: currentTeacherStudentId,
      studentName: currentTeacherStudentName,
      examDate: examId,
      finalScore: finalScore,
      maxScore: maxScore,
      passPercent: passPercent,
      isPassed: isPassed,
      questionsCount: questions.length,
      errorCounts: {
        tanbih: questions.reduce((sum, q) => sum + q.errors.tanbih, 0),
        khata: questions.reduce((sum, q) => sum + q.errors.khata, 0),
        tajweed: questions.reduce((sum, q) => sum + q.errors.tajweed, 0),
        lahn: questions.reduce((sum, q) => sum + q.errors.lahn, 0)
      },
      timestamp: serverTimestamp()
    });
    
    // Update student's exam score in users collection (for monthly scores)
    const studentRef = doc(db, 'users', currentTeacherStudentId);
    await updateDoc(studentRef, {
      examScore: finalScore,
      lastExamDate: getTodayForStorage()
    });
    
    // Reload monthly scores to update display
    await loadMonthlyScores(currentTeacherClassId);
    updateStudentScoreDisplay(currentTeacherStudentId);
    
    statusDiv.textContent = `✅ تم حفظ درجة الاختبار بنجاح: ${finalScore.toFixed(2)}`;
    statusDiv.style.color = '#28a745';
    
    // Hide send to admin button since exam is already saved to examReports
    const sendBtn = document.getElementById('sendExamToAdminBtn');
    if (sendBtn) {
      sendBtn.style.display = 'none';
    }
    
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
    
  } catch (error) {
    console.error('Error saving exam score:', error);
    statusDiv.textContent = '❌ حدث خطأ في حفظ الدرجة: ' + error.message;
    statusDiv.style.color = '#dc3545';
  }
};

// Send exam score to admin
window.sendExamScoreToAdmin = async function() {
  if (!currentTeacherStudentId || !currentTeacherStudentName) {
    alert('لم يتم اختيار طالب');
    return;
  }
  
  const finalScore = parseFloat(document.getElementById('examFinalScore').textContent) || 0;
  const examDate = getTodayForStorage();
  const statusDiv = document.getElementById('examSaveStatus');
  
  try {
    statusDiv.textContent = 'جاري إرسال درجة الاختبار للإدارة...';
    statusDiv.style.color = '#667eea';
    
    // Get exam details
    const questionsCount = parseInt(document.getElementById('examQuestionsCount').value) || 6;
    const maxScore = parseInt(document.getElementById('examMaxScore').value) || 100;
    const passPercent = parseInt(document.getElementById('examPassPercent').value) || 97;
    const passScore = (maxScore * passPercent) / 100;
    const isPassed = finalScore >= passScore;
    
    // Get error counts
    const sumTanbih = parseInt(document.getElementById('examSumTanbih').textContent) || 0;
    const sumKhata = parseInt(document.getElementById('examSumKhata').textContent) || 0;
    const sumTajweed = parseInt(document.getElementById('examSumTajweed').textContent) || 0;
    const sumLahn = parseInt(document.getElementById('examSumLahn').textContent) || 0;
    
    // Save to studentProgress/examReports collection
    const examReportRef = doc(db, 'studentProgress', currentTeacherStudentId, 'examReports', examDate);
    await setDoc(examReportRef, {
      studentId: currentTeacherStudentId,
      studentName: currentTeacherStudentName,
      examDate: examDate,
      finalScore: finalScore,
      maxScore: maxScore,
      passPercent: passPercent,
      isPassed: isPassed,
      questionsCount: questionsCount,
      errorCounts: {
        tanbih: sumTanbih,
        khata: sumKhata,
        tajweed: sumTajweed,
        lahn: sumLahn
      },
      timestamp: serverTimestamp()
    });
    
    statusDiv.textContent = '✅ تم إرسال درجة الاختبار للإدارة بنجاح';
    statusDiv.style.color = '#28a745';
    
    // Hide send button after sending
    document.getElementById('sendExamToAdminBtn').style.display = 'none';
    
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
    
  } catch (error) {
    console.error('Error sending exam score to admin:', error);
    statusDiv.textContent = '❌ حدث خطأ في الإرسال: ' + error.message;
    statusDiv.style.color = '#dc3545';
  }
};

// Reset exam
window.resetExam = function() {
  if (confirm('هل أنت متأكد من إعادة تعيين الاختبار؟')) {
    document.getElementById('examQuestionsTableBody').innerHTML = '';
    document.getElementById('examQuestionsContainer').style.display = 'none';
    document.getElementById('examSaveStatus').textContent = '';
    document.getElementById('sendExamToAdminBtn').style.display = 'none';
    
    // Reset all summary values
    document.getElementById('examSumTanbih').textContent = '0';
    document.getElementById('examSumKhata').textContent = '0';
    document.getElementById('examSumTajweed').textContent = '0';
    document.getElementById('examSumLahn').textContent = '0';
    document.getElementById('examSumPoints').textContent = '0';
    document.getElementById('examFinalScore').textContent = '0';
    document.getElementById('examResultBadge').style.display = 'none';
    
    // Reset settings to defaults
    document.getElementById('examQuestionsCount').value = '6';
    document.getElementById('examMaxScore').value = '100';
    document.getElementById('examPassPercent').value = '97';
    document.getElementById('examWeightTanbih').value = '0.5';
    document.getElementById('examWeightKhata').value = '1';
    document.getElementById('examWeightTajweed').value = '2';
    document.getElementById('examWeightLahn').value = '3';
  }
};

// ============================================
// INBOX NOTIFICATIONS SYSTEM
// ============================================

// Start real-time listener for notifications
function startNotificationsListener(teacherId) {
  // Stop previous listener if exists
  if (notificationsListener) {
    notificationsListener();
  }
  
  try {
    const q = query(
      collection(db, 'teacherNotifications'),
      where('teacherId', '==', teacherId),
      where('read', '==', false)
    );
    
    // Real-time listener
    notificationsListener = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      updateInboxBadge(count);
    });
  } catch (error) {
    console.error('Error starting notifications listener:', error);
  }
}

// Update inbox badge count
function updateInboxBadge(count) {
  const badge = document.getElementById('inboxBadge');
  const btn = document.getElementById('teacherInboxBtn');
  
  if (!badge || !btn) {
    console.warn('Inbox badge or button not found');
    return;
  }
  
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
    btn.style.animation = 'pulse 1.5s infinite';
  } else {
    badge.style.display = 'none';
    btn.style.animation = 'none';
  }
}

// Toggle inbox modal
window.toggleTeacherInbox = async function() {
  const modal = document.getElementById('teacherInboxModal');
  const isVisible = modal.style.display === 'flex';
  
  if (isVisible) {
    modal.style.display = 'none';
  } else {
    modal.style.display = 'flex';
    await loadTeacherNotifications();
  }
};

// Load and display all notifications (old + new)
async function loadTeacherNotifications() {
  const container = document.getElementById('inboxNotificationsList');
  const badge = document.getElementById('inboxBadge');
  
  try {
    // Get both old notifications (teacherNotifications with teacherId) 
    // and new notifications (teacherNotifications with classId)
    const q1 = query(
      collection(db, 'teacherNotifications'),
      where('teacherId', '==', currentTeacherClassId),
      where('read', '==', false)
    );
    
    const q2 = query(
      collection(db, 'teacherNotifications'),
      where('classId', '==', currentTeacherClassId),
      where('read', '==', false)
    );
    
    const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    const allNotifications = [];
    
    // Add old style notifications
    snapshot1.forEach(docSnapshot => {
      const data = docSnapshot.data();
      allNotifications.push({
        id: docSnapshot.id,
        ...data,
        type: data.type || 'general'
      });
    });
    
    // Add new style notifications (not-assessed)
    snapshot2.forEach(docSnapshot => {
      const data = docSnapshot.data();
      allNotifications.push({
        id: docSnapshot.id,
        ...data,
        type: data.type || 'not-assessed'
      });
    });
    
    if (allNotifications.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد إشعارات جديدة</p>';
      badge.style.display = 'none';
      return;
    }
    
    // Update badge
    badge.textContent = allNotifications.length;
    badge.style.display = 'flex';
    
    // Sort by timestamp
    allNotifications.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toDate() - a.timestamp.toDate();
      }
      if (a.createdAt && b.createdAt) {
        return b.createdAt.toDate() - a.createdAt.toDate();
      }
      return 0;
    });
    
    let html = '';
    allNotifications.forEach(notification => {
      // Format timestamp
      let dateStr = 'الآن';
      const timestamp = notification.timestamp || notification.createdAt;
      if (timestamp && timestamp.toDate) {
        const date = timestamp.toDate();
        dateStr = date.toLocaleString('ar-SA', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Determine notification styling based on type
      let bgGradient, borderColor, badgeBg, badgeIcon, badgeText;
      
      if (notification.type === 'not-assessed') {
        // Not assessed notifications - yellow/warning style
        bgGradient = 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)';
        borderColor = '#ffc107';
        badgeBg = '#ffc107';
        badgeIcon = '⚠️';
        badgeText = 'تنبيه: لم يُقيَّم';
      } else if (notification.type === 'juz_completed') {
        // Juz completion - orange celebration style
        bgGradient = 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)';
        borderColor = '#ff9800';
        badgeBg = '#ff9800';
        badgeIcon = '🎊';
        badgeText = 'إنجاز جديد';
      } else {
        // Default/general notifications - green style
        bgGradient = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
        borderColor = '#28a745';
        badgeBg = '#28a745';
        badgeIcon = '🎉';
        badgeText = 'رسالة اجتياز';
      }
      
      html += `
        <div style="background: ${bgGradient}; padding: 20px; border-radius: 10px; margin-bottom: 15px; border-right: 5px solid ${borderColor}; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <div>
              <span style="background: ${badgeBg}; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">${badgeIcon} ${badgeText}</span>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">⏰ ${dateStr}</p>
            </div>
            <button onclick="window.markNotificationAsRead('${notification.id}')" style="background: ${badgeBg}; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.3s;">
              ✓ تم القراءة
            </button>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; white-space: pre-line; line-height: 1.8; color: #333;">
            ${notification.message || notification.title || ''}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    container.innerHTML = '<p style="text-align: center; color: #f44336; padding: 40px;">حدث خطأ في تحميل الإشعارات</p>';
  }
}

// Mark notification as read (delete it)
window.markNotificationAsRead = async function(notificationId) {
  try {
    await deleteDoc(doc(db, 'teacherNotifications', notificationId));
    
    // Reload notifications
    await loadTeacherNotifications();
    
    // Show success message
    const container = document.getElementById('inboxNotificationsList');
    const tempMsg = document.createElement('div');
    tempMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #28a745; color: white; padding: 20px 40px; border-radius: 10px; font-weight: bold; z-index: 10000; box-shadow: 0 5px 20px rgba(0,0,0,0.3);';
    tempMsg.textContent = '✅ تم وضع علامة كمقروء';
    document.body.appendChild(tempMsg);
    
    setTimeout(() => {
      tempMsg.remove();
    }, 2000);
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
    alert('❌ حدث خطأ في تحديث الإشعار');
  }
};

// Stop notifications listener when logging out
export function stopNotificationsListener() {
  if (notificationsListener) {
    notificationsListener();
    notificationsListener = null;
  }
}

// ============================================
// JUZ COMPLETION NOTIFICATION SYSTEM
// ============================================

// Send notification when student completes a Juz
async function sendJuzCompletionNotification(studentId, studentName, teacherId, juzNumber, completionDate, recitationType = 'hifz') {
  try {
    // Get Juz details based on recitation type
    const juzDetails = recitationType === 'hifz' 
      ? getJuzDetails(juzNumber) 
      : getJuzDetailsDabt(juzNumber);
    
    // completionDate is already in Hijri format (YYYY-MM-DD)
    // Convert to Arabic display format
    const [year, month, day] = completionDate.split('-');
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const hijriDate = `${parseInt(day)} ${hijriMonths[parseInt(month)-1]} ${year} هـ`;
    
    // Get teacher name
    const teacherNames = {
      'ABD01': 'الأستاذ عبدالرحمن السيسي',
      'AMR01': 'الأستاذ عامر هوساوي',
      'ANS01': 'الأستاذ أنس',
      'HRT01': 'الأستاذ حارث',
      'JHD01': 'الأستاذ جهاد',
      'JWD01': 'الأستاذ عبدالرحمن جاويد',
      'MZN01': 'الأستاذ مازن',
      'NBL01': 'الأستاذ نبيل',
      'OMR01': 'الأستاذ عمر',
      'OSM01': 'الأستاذ أسامة حبيب',
      'SLM01': 'الأستاذ سلمان رفيق'
    };
    const teacherName = teacherNames[teacherId] || teacherId;
    
    // Determine message based on recitation type
    const typeText = recitationType === 'hifz' ? 'حفظ' : 'ضبط';
    const typeEmoji = recitationType === 'hifz' ? '📚' : '✨';
    const surahInfo = recitationType === 'hifz' 
      ? (juzDetails ? juzDetails.firstSurah : '')
      : (juzDetails ? juzDetails.lastSurah : '');
    
    const notificationData = {
      type: 'juz_completed',
      teacherId: teacherId,
      teacherName: teacherName,
      studentId: studentId,
      studentName: studentName,
      juzNumber: juzNumber,
      recitationType: recitationType,
      juzSurah: surahInfo,
      completionDate: completionDate,
      completionDateHijri: hijriDate,
      message: `🎊 إنجاز جديد!\n\n✅ الطالب: ${studentName}\n👨‍🏫 المعلم: ${teacherName}\n${typeEmoji} أتم ${typeText} الجزء: ${juzNumber}\n📅 التاريخ: ${hijriDate}\n\n⚠️ يجب على الطالب عرض الجزء كاملاً عند العارض`,
      createdAt: serverTimestamp(),
      read: false,
      requiresAction: true
    };
    
    // Save to teacherNotifications collection
    await setDoc(doc(collection(db, 'teacherNotifications')), notificationData);
    
    // Save to viewerNotifications collection (for Parts Viewer)
    await setDoc(doc(collection(db, 'viewerNotifications')), notificationData);
    
    console.log(`✅ Juz ${juzNumber} completion notification (${typeText}) sent for student ${studentName}`);
    
  } catch (error) {
    console.error('Error sending Juz completion notification:', error);
  }
}

// ============================================
// VIEW & EDIT REPORT DETAILS
// ============================================

// View report details in modal
window.viewReportDetails = function(dateId, reportData) {
  const report = typeof reportData === 'string' ? JSON.parse(reportData.replace(/&quot;/g, '"')) : reportData;
  
  // dateId is already in Hijri format YYYY-MM-DD
  const [year, month, day] = dateId.split('-');
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const monthName = hijriMonths[parseInt(month) - 1];
  const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
  
  // Get accurate day name from stored Gregorian date
  let dayName = 'غير محدد';
  if (report.gregorianDate) {
    const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
  } else {
    // Fallback for old records
    const hijriEpoch = new Date('622-07-16');
    const daysFromEpoch = (parseInt(year) - 1) * 354.36 + (parseInt(month) - 1) * 29.53 + parseInt(day);
    const approxGregorian = new Date(hijriEpoch.getTime() + daysFromEpoch * 24 * 60 * 60 * 1000);
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(approxGregorian);
  }
  
  // Check if student was absent
  const isAbsent = report.status === 'absent';
  
  let contentHTML = '';
  
  if (isAbsent) {
    // Show absent message
    contentHTML = `
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 40px; border-radius: 15px; text-align: center; margin: 20px 0;">
        <div style="font-size: 60px; margin-bottom: 15px;">❌</div>
        <h2 style="margin: 0; font-size: 28px;">الطالب كان غائباً</h2>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">لم يحضر في هذا اليوم</p>
      </div>
    `;
  } else {
    // Show normal assessment details
    contentHTML = `
      <div style="display: grid; gap: 15px;">
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
          <strong>صلاة العصر:</strong> ${report.asrPrayerScore || 0}/5
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
          <strong>الدرس:</strong> ${report.lessonScore || 0}/5<br>
          <small style="color: #666;">من: ${report.lessonFrom || '-'} | إلى: ${report.lessonTo || '-'}</small>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8;">
          <strong>جنب الدرس:</strong> ${report.lessonSideScore || 0}/5<br>
          <small style="color: #666;">${report.lessonSideText || '-'}</small>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
          <strong>المراجعة:</strong> ${report.revisionScore || 0}/5<br>
          <small style="color: #666;">من: ${report.revisionFrom || '-'} | إلى: ${report.revisionTo || '-'}</small>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #6f42c1;">
          <strong>القراءة:</strong> ${report.readingScore || 0}/5
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #fd7e14;">
          <strong>السلوك:</strong> ${report.behaviorScore || 0}/10
        </div>
        
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; margin-top: 10px;">
          <h3 style="margin: 0; font-size: 24px;">المجموع: ${report.totalScore || 0}/30</h3>
          ${report.extraLessonCount > 0 ? `<p style="margin: 5px 0 0 0; font-size: 14px;">⭐ يحتوي على ${report.extraLessonCount} درس إضافي</p>` : ''}
        </div>
      </div>
    `;
  }
  
  const modalHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; justify-content: center; align-items: center;" onclick="this.remove()">
      <div style="background: white; border-radius: 15px; padding: 30px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 15px;">
          <h3 style="margin: 0; color: #667eea;">📋 تفاصيل التقييم</h3>
          <button onclick="this.closest('div[style*=fixed]').remove()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 35px; height: 35px; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <h4 style="margin: 0 0 5px 0;">${dayName}</h4>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">${hijriDate}</p>
        </div>
        
        ${contentHTML}
        
        <button onclick="this.closest('div[style*=fixed]').remove()" style="width: 100%; padding: 12px; margin-top: 20px; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">إغلاق</button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Edit report details
window.editReportDetails = function(dateId, reportData) {
  const report = typeof reportData === 'string' ? JSON.parse(reportData.replace(/&quot;/g, '"')) : reportData;
  
  // dateId is already in Hijri format YYYY-MM-DD
  const [year, month, day] = dateId.split('-');
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const monthName = hijriMonths[parseInt(month) - 1];
  const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
  
  // Get accurate day name from stored Gregorian date
  let dayName = 'غير محدد';
  if (report.gregorianDate) {
    const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
  } else {
    // Fallback for old records
    const hijriEpoch = new Date('622-07-16');
    const daysFromEpoch = (parseInt(year) - 1) * 354.36 + (parseInt(month) - 1) * 29.53 + parseInt(day);
    const approxGregorian = new Date(hijriEpoch.getTime() + daysFromEpoch * 24 * 60 * 60 * 1000);
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(approxGregorian);
  }
  
  const modalHTML = `
    <div id="editReportModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; justify-content: center; align-items: center;">
      <div style="background: white; border-radius: 15px; padding: 30px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 15px;">
          <h3 style="margin: 0; color: #667eea;">✏️ تعديل التقييم</h3>
          <button onclick="document.getElementById('editReportModal').remove()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 35px; height: 35px; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <h4 style="margin: 0 0 5px 0;">${dayName}</h4>
          <p style="margin: 0; font-size: 18px; font-weight: bold;">${hijriDate}</p>
        </div>
        
        <!-- Date Editing Section -->
        <div style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <label style="font-weight: bold; color: #856404; display: block; margin-bottom: 10px;">📅 تعديل التاريخ الهجري</label>
          <input type="text" id="edit_hijriDate" value="${parseInt(day)}-${parseInt(month)}-${year}" placeholder="DD-MM-YYYY" style="width: 100%; padding: 10px; border: 2px solid #ffc107; border-radius: 6px; font-size: 16px; text-align: center; font-weight: bold;">
          <small style="font-size: 12px; color: #856404; display: block; margin-top: 5px;">⚠️ الصيغة: يوم-شهر-سنة (مثال: 5-6-1447)</small>
        </div>
        
        <div style="display: grid; gap: 15px;">
          <!-- Lesson Section -->
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <label style="font-weight: bold; color: #007bff; display: block; margin-bottom: 10px;">📖 الدرس</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 12px; color: #666;">من (سورة:آية)</label>
                <input type="text" id="edit_lessonFrom" value="${report.lessonFrom || ''}" placeholder="مثال: الكهف:1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #666;">إلى (سورة:آية)</label>
                <input type="text" id="edit_lessonTo" value="${report.lessonTo || ''}" placeholder="مثال: الكهف:10" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #666;">الدرجة (0-25)</label>
                <input type="number" id="edit_lessonScore" value="${report.lessonScore || 0}" min="0" max="25" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <small style="font-size: 10px; color: #007bff; display: block; margin-top: 3px;">💡 5 نقاط = درس واحد، 10 = درسين، 15 = ثلاثة دروس</small>
              </div>
            </div>
          </div>
          
          <!-- Lesson Side Section -->
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <label style="font-weight: bold; color: #17a2b8; display: block; margin-bottom: 10px;">📝 جنب الدرس</label>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 12px; color: #666;">النص</label>
                <input type="text" id="edit_lessonSideText" value="${report.lessonSideText || ''}" placeholder="مثال: البقرة:100-120" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #666;">الدرجة (0-5)</label>
                <input type="number" id="edit_lessonSideScore" value="${report.lessonSideScore || 0}" min="0" max="5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
            </div>
          </div>
          
          <!-- Revision Section -->
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <label style="font-weight: bold; color: #ffc107; display: block; margin-bottom: 10px;">🔄 المراجعة</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
              <div>
                <label style="font-size: 12px; color: #666;">من</label>
                <input type="text" id="edit_revisionFrom" value="${report.revisionFrom || ''}" placeholder="مثال: الكهف:1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #666;">إلى</label>
                <input type="text" id="edit_revisionTo" value="${report.revisionTo || ''}" placeholder="مثال: الكهف:50" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div>
                <label style="font-size: 12px; color: #666;">الدرجة (0-5)</label>
                <input type="number" id="edit_revisionScore" value="${report.revisionScore || 0}" min="0" max="5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
            </div>
          </div>
          
          <!-- Other Scores -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
              <label style="font-weight: bold; color: #28a745; display: block; margin-bottom: 5px;">🕌 صلاة العصر</label>
              <input type="number" id="edit_asrPrayerScore" value="${report.asrPrayerScore || 0}" min="0" max="5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
              <label style="font-weight: bold; color: #6f42c1; display: block; margin-bottom: 5px;">📚 القراءة</label>
              <input type="number" id="edit_readingScore" value="${report.readingScore || 0}" min="0" max="5" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
              <label style="font-weight: bold; color: #fd7e14; display: block; margin-bottom: 5px;">😊 السلوك</label>
              <input type="number" id="edit_behaviorScore" value="${report.behaviorScore || 0}" min="0" max="10" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
          </div>
          
          <!-- Extra Lessons -->
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); color: white; padding: 15px; border-radius: 8px;">
            <label style="font-weight: bold; display: block; margin-bottom: 10px;">⭐ دروس إضافية (اختياري)</label>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px; align-items: center;">
              <div>
                <label style="font-size: 12px;">عدد الدروس الإضافية</label>
                <input type="number" id="edit_extraLessonCount" value="${report.extraLessonCount || 0}" min="0" max="5" style="width: 100%; padding: 8px; border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; background: rgba(255,255,255,0.9);">
              </div>
              <div>
                <small style="font-size: 11px; display: block; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px;">
                  💡 إذا سمّع الطالب درسين في نفس اليوم، ضع 1 هنا. سيُحتسب تلقائياً في التقارير.
                </small>
              </div>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button onclick="window.saveEditedReport('${dateId}')" style="flex: 1; padding: 15px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
            ✅ حفظ التعديلات
          </button>
          <button onclick="document.getElementById('editReportModal').remove()" style="flex: 1; padding: 15px; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Save edited report
window.saveEditedReport = async function(originalDateId) {
  try {
    const lessonScore = parseInt(document.getElementById('edit_lessonScore').value) || 0;
    const lessonSideScore = parseInt(document.getElementById('edit_lessonSideScore').value) || 0;
    const revisionScore = parseInt(document.getElementById('edit_revisionScore').value) || 0;
    const asrPrayerScore = parseInt(document.getElementById('edit_asrPrayerScore').value) || 0;
    const readingScore = parseInt(document.getElementById('edit_readingScore').value) || 0;
    const behaviorScore = parseInt(document.getElementById('edit_behaviorScore').value) || 0;
    const extraLessonCount = parseInt(document.getElementById('edit_extraLessonCount').value) || 0;
    
    const totalScore = lessonScore + lessonSideScore + revisionScore + asrPrayerScore + readingScore + behaviorScore;
    
    // Check if date was changed
    const newHijriDateInput = document.getElementById('edit_hijriDate').value.trim();
    const [newDay, newMonth, newYear] = newHijriDateInput.split('-').map(n => parseInt(n));
    
    // Validate date format
    if (!newDay || !newMonth || !newYear || newDay < 1 || newDay > 30 || newMonth < 1 || newMonth > 12) {
      alert('❌ صيغة التاريخ غير صحيحة. يرجى استخدام: يوم-شهر-سنة (مثال: 5-6-1447)');
      return;
    }
    
    const newDateId = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
    
    // Calculate new Gregorian date for accurate day name
    let newGregorianDate;
    try {
      const tempDate = new Date(2025, 0, 1);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        calendar: 'islamic',
        timeZone: 'Asia/Riyadh'
      });
      
      const islamicParts = formatter.formatToParts(tempDate);
      const currentIslamicYear = parseInt(islamicParts.find(p => p.type === 'year').value);
      const yearDiff = newYear - currentIslamicYear;
      const approxDate = new Date(tempDate);
      approxDate.setFullYear(tempDate.getFullYear() + yearDiff);
      approxDate.setMonth((newMonth - 1));
      approxDate.setDate(newDay);
      
      newGregorianDate = approxDate.toISOString().split('T')[0];
    } catch (err) {
      console.warn('Could not calculate exact Gregorian date, using approximate', err);
      newGregorianDate = new Date().toISOString().split('T')[0];
    }
    
    const updatedData = {
      lessonFrom: document.getElementById('edit_lessonFrom').value.trim(),
      lessonTo: document.getElementById('edit_lessonTo').value.trim(),
      lessonScore: lessonScore,
      lessonSideText: document.getElementById('edit_lessonSideText').value.trim(),
      lessonSideScore: lessonSideScore,
      revisionFrom: document.getElementById('edit_revisionFrom').value.trim(),
      revisionTo: document.getElementById('edit_revisionTo').value.trim(),
      revisionScore: revisionScore,
      asrPrayerScore: asrPrayerScore,
      readingScore: readingScore,
      behaviorScore: behaviorScore,
      extraLessonCount: extraLessonCount,
      totalScore: totalScore,
      gregorianDate: newGregorianDate,
      lastModified: serverTimestamp()
    };
    
    // If date changed, delete old and create new
    if (newDateId !== originalDateId) {
      const oldReportRef = doc(db, 'studentProgress', currentTeacherStudentId, 'dailyReports', originalDateId);
      const newReportRef = doc(db, 'studentProgress', currentTeacherStudentId, 'dailyReports', newDateId);
      
      // Get old data first to preserve any fields we're not editing
      const oldReportSnap = await getDoc(oldReportRef);
      if (oldReportSnap.exists()) {
        const oldData = oldReportSnap.data();
        const mergedData = { ...oldData, ...updatedData };
        
        // Create new document
        await setDoc(newReportRef, mergedData);
        
        // Delete old document
        await deleteDoc(oldReportRef);
      }
    } else {
      // Same date, just update
      const reportRef = doc(db, 'studentProgress', currentTeacherStudentId, 'dailyReports', newDateId);
      await setDoc(reportRef, updatedData, { merge: true });
    }
    
    alert('✅ تم حفظ التعديلات بنجاح!');
    document.getElementById('editReportModal').remove();
    
    // Reload reports
    window.showPastReports();
    
    // Update monthly scores and rankings
    await loadMonthlyScores(currentTeacherClassId);
    updateStudentScoreDisplay(currentTeacherStudentId);
    
  } catch (error) {
    console.error('Error saving edited report:', error);
    alert('❌ حدث خطأ أثناء حفظ التعديلات');
  }
};

// Delete report with confirmation
window.deleteReportConfirm = async function(dateId, hijriDate) {
  const confirmed = confirm(`⚠️ هل أنت متأكد من حذف تقييم:\n${hijriDate}؟\n\nلا يمكن التراجع عن هذا الإجراء.`);
  
  if (!confirmed) {
    return;
  }
  
  try {
    const reportRef = doc(db, 'studentProgress', currentTeacherStudentId, 'dailyReports', dateId);
    await deleteDoc(reportRef);
    
    alert('✅ تم حذف التقييم بنجاح!');
    
    // Reload reports
    window.showPastReports();
    
    // Update monthly scores and rankings
    await loadMonthlyScores(currentTeacherClassId);
    updateStudentScoreDisplay(currentTeacherStudentId);
    
  } catch (error) {
    console.error('Error deleting report:', error);
    alert('❌ حدث خطأ أثناء حذف التقييم');
  }
};

// Share struggling students data to clipboard
window.shareStrugglingStudents = async function() {
  if (!window.strugglingDataForSharing || !window.strugglingDataForSharing.students || window.strugglingDataForSharing.students.length === 0) {
    alert('❌ لا توجد بيانات للمشاركة');
    return;
  }
  
  const data = window.strugglingDataForSharing;
  const students = data.students;
  const date = data.date;
  const dayName = data.dayName;
  
  // Build the message
  let message = `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 تقرير الطلاب المتعثرين\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📅 التاريخ الهجري: ${date}\n`;
  message += `📆 اليوم: ${dayName}\n`;
  message += `👥 عدد الطلاب المتعثرين: ${students.length}\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📝 قائمة الطلاب والتعثرات:\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  students.forEach((student, index) => {
    message += `${index + 1}. 👤 ${student.name} (${student.id})\n`;
    message += `   ⚠️ التعثرات:\n`;
    student.issues.forEach(issue => {
      message += `      • ${issue}\n`;
    });
    message += `\n`;
  });
  
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 توجيه للطالب وولي الأمر:\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `الطالب العزيز / ولي الأمر الكريم،\n\n`;
  message += `نأمل منكم المتابعة الدقيقة والاجتهاد في حفظ ومراجعة القرآن الكريم.\n`;
  message += `التعثرات المذكورة أعلاه تحتاج إلى اهتمام خاص ومتابعة مستمرة.\n\n`;
  message += `🔹 احرصوا على المراجعة اليومية\n`;
  message += `🔹 التزموا بحضور الحلقة بانتظام\n`;
  message += `🔹 استعينوا بالله وتوكلوا عليه\n\n`;
  message += `﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾\n\n`;
  message += `بارك الله فيكم وفي جهودكم 🤲\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  
  try {
    // Copy to clipboard
    await navigator.clipboard.writeText(message);
    
    // Show success message
    const shareBtn = document.querySelector('.share-struggling-btn');
    const originalText = shareBtn.innerHTML;
    shareBtn.innerHTML = '✅ تم النسخ للحافظة!';
    shareBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    
    setTimeout(() => {
      shareBtn.innerHTML = originalText;
      shareBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 2000);
    
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    
    // Fallback: Show message in alert
    alert('تم إنشاء الرسالة لكن فشل النسخ للحافظة:\n\n' + message);
  }
};

// Send struggling notifications automatically to student only (admin gets daily report at 9 PM)
async function sendStrugglingNotifications(studentId, studentName, assessmentData, dateId) {
  try {
    const teacherName = sessionStorage.getItem('loggedInTeacherName') || 'المعلم';
    
    // Format Hijri date
    const hijriParts = dateId.split('-');
    const hijriYear = hijriParts[0];
    const hijriMonth = parseInt(hijriParts[1]);
    const hijriDay = parseInt(hijriParts[2]);
    
    const monthNames = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const monthName = monthNames[hijriMonth - 1];
    const hijriDate = `${hijriDay} ${monthName} ${hijriYear} هـ`;
    
    // Get day name
    let dayName = '';
    if (assessmentData.gregorianDate) {
      const gregorianParts = assessmentData.gregorianDate.split('-');
      const date = new Date(gregorianParts[0], gregorianParts[1] - 1, gregorianParts[2], 12, 0, 0);
      dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(date);
    }
    
    // Identify struggling areas
    const issues = [];
    if (assessmentData.lessonScore < 5) {
      issues.push(`الدرس: ${assessmentData.lessonScore}/5`);
    }
    if (assessmentData.lessonSideScore < 5) {
      issues.push(`جنب الدرس: ${assessmentData.lessonSideScore}/5`);
    }
    if (assessmentData.revisionScore < 5) {
      issues.push(`المراجعة: ${assessmentData.revisionScore}/5`);
    }
    
    // 1. Send notification to Student
    const studentNotificationRef = doc(collection(db, 'studentNotifications'));
    await setDoc(studentNotificationRef, {
      studentId: studentId,
      title: '⚠️ تنبيه: تعثر في التقييم',
      message: `عزيزي الطالب ${studentName},\n\nتم تسجيل تعثر في تقييم يوم ${dayName} ${hijriDate}:\n\n${issues.map(issue => `• ${issue}`).join('\n')}\n\nالرجاء المراجعة والاجتهاد في التحسين.\n\nالمعلم: ${teacherName}`,
      date: hijriDate,
      dateId: dateId,
      dayName: dayName,
      issues: issues,
      read: false,
      timestamp: serverTimestamp()
    });
    
    console.log('✅ Sent notification to student');
    
    // 2. Add student to daily struggling report (directly to admin)
    await addToTodayStrugglingReport(studentId, studentName, assessmentData, dateId, hijriDate, dayName, issues);
    
  } catch (error) {
    console.error('Error sending struggling notifications:', error);
  }
}

// Add student to today's struggling report (creates or updates the report)
async function addToTodayStrugglingReport(studentId, studentName, assessmentData, dateId, hijriDate, dayName, issues) {
  try {
    if (!currentTeacherClassId) return;
    
    const teacherName = sessionStorage.getItem('loggedInTeacherName') || 'المعلم';
    const reportId = `${currentTeacherClassId}_${dateId}`;
    const reportRef = doc(db, 'strugglingReports', reportId);
    
    // Get existing report or create new structure
    const reportSnap = await getDoc(reportRef);
    
    const studentEntry = {
      id: studentId,
      name: studentName,
      issues: issues,
      scores: {
        lesson: assessmentData.lessonScore,
        lessonSide: assessmentData.lessonSideScore,
        revision: assessmentData.revisionScore
      },
      totalScore: assessmentData.totalScore,
      addedAt: Date.now()
    };
    
    if (reportSnap.exists()) {
      // Update existing report
      const reportData = reportSnap.data();
      const students = reportData.students || [];
      
      // Check if student already in report (update instead of duplicate)
      const existingIndex = students.findIndex(s => s.id === studentId);
      if (existingIndex >= 0) {
        students[existingIndex] = studentEntry;
      } else {
        students.push(studentEntry);
      }
      
      await updateDoc(reportRef, {
        students: students,
        totalCount: students.length,
        lastUpdated: serverTimestamp()
      });
      
      console.log(`📊 Updated struggling report: ${students.length} students`);
    } else {
      // Create new report for today
      await setDoc(reportRef, {
        classId: currentTeacherClassId,
        teacherName: teacherName,
        date: hijriDate,
        dateId: dateId,
        dayName: dayName,
        students: [studentEntry],
        totalCount: 1,
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        autoGenerated: true
      });
      
      console.log(`📊 Created new struggling report for ${hijriDate}`);
    }
    
  } catch (error) {
    console.error('Error adding to struggling report:', error);
  }
}

// Save absent record
async function saveAbsentRecord() {
  // Check if today is a study day
  if (!isTodayAStudyDay()) {
    alert('⚠️ لا يمكن تسجيل الغياب في أيام الإجازة (الجمعة والسبت)');
    return;
  }
  
  const statusDiv = document.getElementById('teacherStatus');
  
  try {
    // Get excuse type
    const excuseType = document.querySelector('input[name="excuseType"]:checked')?.value || 'withoutExcuse';
    
    // Get today's accurate Hijri date
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    const todayHijri = getCurrentHijriDate();
    const dateId = todayHijri?.hijri || getTodayForStorage();
    const gregorianDate = today.toISOString().split('T')[0];
    
    // Save absent record with excuse type
    const absentData = {
      studentId: currentTeacherStudentId,
      studentName: currentTeacherStudentName,
      status: 'absent',
      excuseType: excuseType, // 'withExcuse' or 'withoutExcuse'
      gregorianDate: gregorianDate,
      // Add zero scores to maintain data structure
      lessonScore: 0,
      lessonSideScore: 0,
      revisionScore: 0,
      readingScore: 0,
      asrPrayerScore: 0,
      totalScore: 0,
      timestamp: serverTimestamp()
    };
    
    const targetDoc = doc(db, 'studentProgress', currentTeacherStudentId, 'dailyReports', dateId);
    await setDoc(targetDoc, absentData);
    
    // Reload attendance report if visible to update counts
    if (document.getElementById('classAttendanceReportSection')?.style.display !== 'none') {
      await loadClassAttendanceReport(currentTeacherClassId);
    }
    
    const excuseText = excuseType === 'withExcuse' ? 'بعذر' : 'بدون عذر';
    statusDiv.textContent = `✅ تم تسجيل غياب الطالب (${excuseText}) بنجاح`;
    statusDiv.style.color = '#51cf66';
    
    // Wait a moment before reloading to ensure Firebase sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reload student list to update assessment indicators
    await loadTeacherStudents(currentTeacherClassId);
    
    // Check if a specific date filter is applied
    const dateFilter = document.getElementById('attendanceDateFilter');
    if (dateFilter && dateFilter.value && dateFilter.value !== 'all') {
      // Re-apply the date filter to show the updated status
      await filterAttendanceByDate();
    } else {
      // Reload full attendance data
      await loadClassAttendanceReport(currentTeacherClassId);
    }
    
    setTimeout(() => {
      showNewAssessment();
      // Reset to present
      document.querySelector('input[name="studentStatus"][value="present"]').checked = true;
      toggleAbsentMode();
    }, 2000);
    
  } catch (error) {
    console.error('Error saving absent record:', error);
    statusDiv.textContent = '❌ خطأ في حفظ الغياب: ' + error.message;
    statusDiv.style.color = '#ff6b6b';
  }
}

// Check for not-assessed students at 9 PM daily
function scheduleNotAssessedCheck() {
  const now = new Date();
  const target = new Date();
  target.setHours(21, 0, 0, 0); // 9:00 PM
  
  // If it's already past 9 PM today, schedule for tomorrow
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }
  
  const timeUntilCheck = target - now;
  
  console.log(`⏰ Scheduled 9 PM check in ${Math.round(timeUntilCheck / 1000 / 60)} minutes`);
  console.log(`⏰ Current time: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
  console.log(`⏰ Will run at: 9:00 PM`);
  
  setTimeout(() => {
    console.log('🔔 Running 9 PM check NOW!');
    checkNotAssessedStudents();
    // Schedule next check for tomorrow at 9 PM
    scheduleNotAssessedCheck();
  }, timeUntilCheck);
}

// Check for students who haven't been assessed today
async function checkNotAssessedStudents() {
  if (!currentTeacherClassId) {
    console.log('⚠️ No class selected, skipping not-assessed check');
    return;
  }
  
  console.log('🔍 Running not-assessed students check at 9:55 PM...');
  console.log('📚 Current class ID:', currentTeacherClassId);
  
  try {
    // Get today's Hijri date
    const todayHijri = getCurrentHijriDate();
    const todayHijriId = todayHijri?.hijri || getTodayForStorage();
    
    console.log('📅 Today Hijri ID:', todayHijriId);
    
    // Get Hijri date display
    const [year, month, day] = todayHijriId.split('-');
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const monthName = hijriMonths[parseInt(month) - 1];
    const todayHijriDisplay = `${parseInt(day)} ${monthName} ${year} هـ`;
    
    // Get current day name
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay();
    
    console.log('📆 Day of week:', dayOfWeek, '(0=Sun, 5=Fri, 6=Sat)');
    
    // Skip if it's Friday (5) or Saturday (6)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      console.log('⏭️ Skipping check - today is a weekend');
      return;
    }
    
    const dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(todayDate);
    
    // Get teacher info
    let teacherName = 'المعلم';
    const teacherId = sessionStorage.getItem('userId') || sessionStorage.getItem('teacherId');
    if (teacherId) {
      try {
        const teacherDoc = await getDoc(doc(db, 'users', teacherId));
        if (teacherDoc.exists()) {
          teacherName = teacherDoc.data().name || 'المعلم';
        }
      } catch (err) {
        console.warn('Could not get teacher name:', err);
      }
    }
    
    // Get class info
    let className = currentTeacherClassId;
    try {
      const classDoc = await getDoc(doc(db, 'classes', currentTeacherClassId));
      if (classDoc.exists() && classDoc.data()) {
        className = classDoc.data().name || currentTeacherClassId;
      }
    } catch (err) {
      console.warn('Could not get class name:', err);
    }
    
    console.log(`👤 Teacher: ${teacherName}, 📚 Class: ${className}`);
    
    // Get all students in this class
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', currentTeacherClassId)
    ));
    
    const notAssessedStudents = [];
    
    // Check each student
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentName = studentDoc.data().name || studentId;
      
      // Check if student has a report for today
      const reportRef = doc(db, 'studentProgress', studentId, 'dailyReports', todayHijriId);
      const reportSnap = await getDoc(reportRef);
      
      if (!reportSnap.exists()) {
        console.log(`  ❌ ${studentName} (${studentId}) - لم يُقيَّم`);
        notAssessedStudents.push({ id: studentId, name: studentName });
      } else {
        console.log(`  ✅ ${studentName} (${studentId}) - تم التقييم`);
      }
    }
    
    console.log(`📊 Total not-assessed: ${notAssessedStudents.length} / ${studentsSnap.docs.length}`);
    
    // If there are not-assessed students, send notifications
    if (notAssessedStudents.length > 0) {
      console.log(`🔔 Sending notifications for ${notAssessedStudents.length} not-assessed students`);
      
      // Send notification to admin for each student
      for (const student of notAssessedStudents) {
        console.log(`  📧 Sending notification for ${student.name}`);
        const adminNotificationRef = doc(collection(db, 'adminNotifications'));
        await setDoc(adminNotificationRef, {
          type: 'not-assessed',
          title: 'طالب لم يُقيَّم اليوم',
          message: `الطالب ${student.name} من الحلقة ${className} (المعلم: ${teacherName}) لم يُقيَّم حتى الآن في ${dayName}`,
          studentId: student.id,
          studentName: student.name,
          classId: currentTeacherClassId,
          className: className,
          teacherName: teacherName,
          date: todayHijriDisplay,
          dateId: todayHijriId,
          dayName: dayName,
          read: false,
          timestamp: serverTimestamp()
        });
      }
      
      // Send one notification to teacher with all students
      const studentNames = notAssessedStudents.map(s => s.name).join('، ');
      const teacherNotificationRef = doc(collection(db, 'teacherNotifications'));
      await setDoc(teacherNotificationRef, {
        type: 'not-assessed',
        title: `تنبيه: ${notAssessedStudents.length} طالب لم يُقيَّم`,
        message: `الطلاب التالية أسماؤهم لم يتم تقييمهم اليوم (${dayName}):\n${studentNames}`,
        classId: currentTeacherClassId,
        className: className,
        students: notAssessedStudents,
        date: todayHijriDisplay,
        dateId: todayHijriId,
        dayName: dayName,
        read: false,
        timestamp: serverTimestamp()
      });
      
      console.log('✅ Sent not-assessed notifications to admin and teacher');
    } else {
      console.log('✓ All students assessed today');
    }
    
  } catch (error) {
    console.error('Error checking not-assessed students:', error);
  }
}

// Start the scheduled check when teacher logs in
window.startNotAssessedScheduler = function() {
  scheduleNotAssessedCheck();
  console.log('Started not-assessed student scheduler');
};

// Update notification badge periodically
setInterval(() => {
  updateTeacherNotificationBadge();
}, 30000); // Check every 30 seconds

async function updateTeacherNotificationBadge() {
  if (!currentTeacherClassId) return;
  
  try {
    // Get both old and new style notifications
    const q1 = query(
      collection(db, 'teacherNotifications'),
      where('teacherId', '==', currentTeacherClassId),
      where('read', '==', false)
    );
    
    const q2 = query(
      collection(db, 'teacherNotifications'),
      where('classId', '==', currentTeacherClassId),
      where('read', '==', false)
    );
    
    const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    // Update both old and new badge
    const oldBadge = document.getElementById('inboxBadge');
    const newBadge = document.getElementById('notificationBadge');
    
    const totalCount = snapshot1.size + snapshot2.size;
    
    // Update old badge (if exists)
    if (oldBadge) {
      if (totalCount === 0) {
        oldBadge.style.display = 'none';
      } else {
        oldBadge.textContent = totalCount;
        oldBadge.style.display = 'flex';
      }
    }
    
    // Update new badge (toolbar)
    if (newBadge) {
      if (totalCount === 0) {
        newBadge.style.display = 'none';
      } else {
        newBadge.textContent = totalCount;
        newBadge.style.display = 'flex';
      }
    }
  } catch (error) {
    console.error('Error updating notification badge:', error);
  }
}

// ============================================
// MONTHLY EXAMS MANAGEMENT
// ============================================

// Show monthly exams management section
window.showMonthlyExamsManagement = async function() {
  // Hide other sections
  const attendanceSection = document.getElementById('classAttendanceReportSection');
  if (attendanceSection) attendanceSection.style.display = 'none';
  
  // Show exams section
  document.getElementById('monthlyExamsManagementSection').style.display = 'block';
  
  // Load exams
  await loadMonthlyExamsManagement();
};

// Hide monthly exams management section
window.hideMonthlyExamsManagement = function() {
  document.getElementById('monthlyExamsManagementSection').style.display = 'none';
};

// Load monthly exams for the class
async function loadMonthlyExamsManagement() {
  const displayContainer = document.getElementById('monthlyExamsDisplay');
  const monthFilter = document.getElementById('examMonthFilter');
  
  displayContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">جاري تحميل البيانات...</div>';
  
  try {
    // Get all students in the class
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', currentTeacherClassId)
    ));
    
    const allExams = [];
    const monthsSet = new Set();
    
    // Get exams for each student
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentName = studentDoc.data().name || studentId;
      
      const examsSnap = await getDocs(collection(db, 'monthlyExams', studentId, 'exams'));
      
      examsSnap.forEach(examDoc => {
        const examData = examDoc.data();
        
        // Extract month from date
        if (examData.hijriDate) {
          const month = examData.hijriDate.split(' ')[1]; // e.g., "جمادى الآخرة"
          monthsSet.add(month);
        }
        
        allExams.push({
          id: examDoc.id,
          studentId: studentId,
          studentName: studentName,
          ...examData
        });
      });
    }
    
    // Populate month filter
    monthFilter.innerHTML = '<option value="all">جميع الأشهر</option>';
    const months = Array.from(monthsSet).sort();
    months.forEach(month => {
      const option = document.createElement('option');
      option.value = month;
      option.textContent = month;
      monthFilter.appendChild(option);
    });
    
    // Store all exams globally for filtering
    window.currentMonthlyExams = allExams;
    
    // Display all exams
    displayMonthlyExams(allExams);
    
  } catch (error) {
    console.error('Error loading monthly exams:', error);
    displayContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc3545;">❌ حدث خطأ في تحميل البيانات</div>';
  }
}

// Display monthly exams as responsive cards
function displayMonthlyExams(exams) {
  const displayContainer = document.getElementById('monthlyExamsDisplay');
  
  if (exams.length === 0) {
    displayContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">لا توجد اختبارات شهرية</div>';
    updateExamsStats(0, 0, 0);
    return;
  }
  
  // Sort by date descending
  exams.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return b.timestamp.toDate() - a.timestamp.toDate();
    }
    return 0;
  });
  
  // Calculate stats
  const passedCount = exams.filter(e => e.isPassed).length;
  const failedCount = exams.length - passedCount;
  updateExamsStats(exams.length, passedCount, failedCount);
  
  // Display exams as mobile-friendly cards
  displayContainer.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
      ${exams.map((exam, index) => {
        const percentage = ((exam.totalScore / exam.maxScore) * 100).toFixed(1);
        const resultColor = exam.isPassed ? '#28a745' : '#dc3545';
        const resultBg = exam.isPassed ? 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' : 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)';
        const resultText = exam.isPassed ? '✅ ناجح' : '❌ راسب';
        const borderColor = exam.isPassed ? '#28a745' : '#dc3545';
        
        return `
          <div style="background: white; border: 2px solid ${borderColor}; border-radius: 12px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 16px; color: #333; margin-bottom: 4px;">${exam.studentName}</div>
                <div style="font-size: 12px; color: #666;">📅 ${exam.hijriDate || '-'}</div>
              </div>
              <div style="background: ${resultBg}; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; color: ${resultColor}; white-space: nowrap;">
                ${resultText}
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; color: #666;">📊 الدرجة النهائية:</span>
                <span style="font-size: 24px; font-weight: bold; color: ${resultColor};">${exam.totalScore} / ${exam.maxScore}</span>
              </div>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <button onclick="window.viewExamDetails('${exam.studentId}', '${exam.id}')" style="flex: 1; background: #007bff; color: white; padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">
                👁️ عرض
              </button>
              <button onclick="window.deleteMonthlyExam('${exam.studentId}', '${exam.id}')" style="flex: 1; background: #dc3545; color: white; padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">
                🗑️ حذف
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Update exams statistics
function updateExamsStats(total, passed, failed) {
  document.getElementById('totalExamsCount').textContent = total;
  document.getElementById('passedExamsCount').textContent = passed;
  document.getElementById('failedExamsCount').textContent = failed;
}

// Filter exams by month
window.filterExamsByMonth = function() {
  const selectedMonth = document.getElementById('examMonthFilter').value;
  
  if (!window.currentMonthlyExams) return;
  
  if (selectedMonth === 'all') {
    displayMonthlyExams(window.currentMonthlyExams);
  } else {
    const filtered = window.currentMonthlyExams.filter(exam => {
      if (!exam.hijriDate) return false;
      const month = exam.hijriDate.split(' ')[1];
      return month === selectedMonth;
    });
    displayMonthlyExams(filtered);
  }
};

// View exam details
window.viewExamDetails = async function(studentId, examId) {
  try {
    const examDoc = await getDoc(doc(db, 'monthlyExams', studentId, 'exams', examId));
    
    if (!examDoc.exists()) {
      alert('الاختبار غير موجود');
      return;
    }
    
    const examData = examDoc.data();
    const content = document.getElementById('examDetailsContent');
    
    const resultColor = examData.isPassed ? '#28a745' : '#dc3545';
    const resultText = examData.isPassed ? '✅ ناجح' : '❌ راسب';
    
    let html = `
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 15px 0; color: #9c27b0;">معلومات الاختبار</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
          <div>
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">👤 اسم الطالب</div>
            <div style="font-weight: bold; font-size: 16px;">${examData.studentName}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">👨‍🏫 اسم المعلم</div>
            <div style="font-weight: bold; font-size: 16px;">${examData.teacherName}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📅 التاريخ</div>
            <div style="font-weight: bold; font-size: 16px;">${examData.hijriDate}</div>
          </div>
        </div>
      </div>
      
      <div style="background: white; border: 2px solid ${resultColor}; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 15px 0; color: ${resultColor};">النتيجة النهائية</h4>
        <div style="display: flex; justify-content: space-around; align-items: center; gap: 20px; flex-wrap: wrap;">
          <div style="text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 5px;">📊 الدرجة النهائية</div>
            <div style="font-weight: bold; font-size: 32px; color: ${resultColor};">${examData.totalScore} / ${examData.maxScore}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 14px; color: #666; margin-bottom: 5px;">الحالة</div>
            <div style="font-weight: bold; font-size: 28px; color: ${resultColor};">${resultText}</div>
          </div>
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 15px; border-radius: 10px;">
        <h4 style="margin: 0 0 15px 0; color: #9c27b0;">تفاصيل الأسئلة</h4>
    `;
    
    // Display questions
    if (examData.questions && examData.questions.length > 0) {
      examData.questions.forEach((q, i) => {
        const hasErrors = (q.errors?.tanbih || 0) + (q.errors?.khata || 0) + (q.errors?.tajweed || 0) + (q.errors?.lahn || 0) > 0;
        const qColor = hasErrors ? '#dc3545' : '#28a745';
        
        html += `
          <div style="background: white; padding: 15px; border-right: 4px solid ${qColor}; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
              <div style="font-weight: bold; color: #333; font-size: 16px;">📝 السؤال ${q.number || i + 1}</div>
              <div style="background: ${qColor}; color: white; padding: 6px 15px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                -${q.deductedPoints?.toFixed(2) || 0} نقطة
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
              <div style="color: #666; font-size: 14px; margin-bottom: 6px;">
                <strong>📖 السورة:</strong> ${q.surah || '-'}
              </div>
              ${q.position ? `<div style="color: #666; font-size: 14px;">
                <strong>📍 الموضع:</strong> ${q.position}
              </div>` : ''}
            </div>
            
            ${q.errors ? `
              <div style="background: #fff; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0;">
                <div style="font-weight: bold; color: #333; margin-bottom: 8px; font-size: 14px;">⚠️ الأخطاء المسجلة:</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px;">
                  <div style="background: #ffeaa7; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 3px;">تنبيه</div>
                    <div style="font-weight: bold; font-size: 18px; color: #fdcb6e;">${q.errors.tanbih || 0}</div>
                  </div>
                  <div style="background: #fab1a0; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 3px;">خطأ</div>
                    <div style="font-weight: bold; font-size: 18px; color: #e17055;">${q.errors.khata || 0}</div>
                  </div>
                  <div style="background: #a29bfe; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 11px; color: #666; margin-bottom: 3px;">تجويد</div>
                    <div style="font-weight: bold; font-size: 18px; color: #6c5ce7;">${q.errors.tajweed || 0}</div>
                  </div>
                  <div style="background: #ff7675; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 11px; color: #fff; margin-bottom: 3px;">لحن جلي</div>
                    <div style="font-weight: bold; font-size: 18px; color: #fff;">${q.errors.lahn || 0}</div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      });
    } else {
      html += '<p style="text-align: center; color: #999; padding: 20px;">لا توجد تفاصيل أسئلة</p>';
    }
    
    html += '</div>';
    
    content.innerHTML = html;
    document.getElementById('examDetailsModal').style.display = 'flex';
    
  } catch (error) {
    console.error('Error viewing exam details:', error);
    alert('حدث خطأ في تحميل تفاصيل الاختبار');
  }
};

// Close exam details modal
window.closeExamDetailsModal = function() {
  document.getElementById('examDetailsModal').style.display = 'none';
};

// Delete monthly exam
window.deleteMonthlyExam = async function(studentId, examId) {
  if (!confirm('هل أنت متأكد من حذف هذا الاختبار؟')) {
    return;
  }
  
  try {
    // Delete exam document
    await deleteDoc(doc(db, 'monthlyExams', studentId, 'exams', examId));
    
    // Delete exam report from studentProgress
    await deleteDoc(doc(db, 'studentProgress', studentId, 'examReports', examId));
    
    // Update student's examScore to 0
    await updateDoc(doc(db, 'users', studentId), {
      examScore: 0
    });
    
    alert('✅ تم حذف الاختبار بنجاح');
    
    // Reload exams and refresh monthly scores
    await loadMonthlyExamsManagement();
    await loadMonthlyScores(currentTeacherClassId);
    
  } catch (error) {
    console.error('Error deleting exam:', error);
    alert('❌ حدث خطأ في حذف الاختبار');
  }
};

// ============================================
// DAILY STRUGGLING STUDENTS REPORT (9 PM)
// ============================================

// Send daily struggling report to admin at 9 PM
async function sendDailyStrugglingReport() {
  if (!currentTeacherClassId) return;
  
  try {
    console.log('📊 Starting daily struggling students report...');
    
    // Get current date info
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Skip weekends (Friday=5, Saturday=6)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      console.log('⏭️ Skipping struggling report (weekend)');
      return;
    }
    
    const hijriInfo = getCurrentHijriDate();
    const dateId = hijriInfo?.hijri || getTodayForStorage(); // YYYY-MM-DD
    const hijriDate = hijriInfo.display; // "٥ جمادى الآخرة ١٤٤٧ هـ"
    const dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(today);
    const teacherName = sessionStorage.getItem('loggedInTeacherName') || 'المعلم';
    
    // Get all students in class
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', currentTeacherClassId)
    ));
    
    const strugglingStudents = [];
    
    // Check each student's report for today
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentName = studentDoc.data().name || studentId;
      
      // Check if there's a report for today
      const reportRef = doc(db, 'studentProgress', studentId, 'dailyReports', dateId);
      const reportSnap = await getDoc(reportRef);
      
      if (reportSnap.exists()) {
        const reportData = reportSnap.data();
        
        // Check if student is struggling (any score < 5)
        const isStruggling = reportData.lessonScore < 5 || 
                            reportData.lessonSideScore < 5 || 
                            reportData.revisionScore < 5;
        
        if (isStruggling) {
          const issues = [];
          if (reportData.lessonScore < 5) {
            issues.push(`الدرس: ${reportData.lessonScore}/5`);
          }
          if (reportData.lessonSideScore < 5) {
            issues.push(`جنب الدرس: ${reportData.lessonSideScore}/5`);
          }
          if (reportData.revisionScore < 5) {
            issues.push(`المراجعة: ${reportData.revisionScore}/5`);
          }
          
          strugglingStudents.push({
            id: studentId,
            name: studentName,
            issues: issues,
            scores: {
              lesson: reportData.lessonScore,
              lessonSide: reportData.lessonSideScore,
              revision: reportData.revisionScore
            },
            totalScore: reportData.totalScore
          });
        }
      }
    }
    
    // Send report only if there are struggling students
    if (strugglingStudents.length > 0) {
      const reportRef = doc(db, 'strugglingReports', `${currentTeacherClassId}_${dateId}`);
      await setDoc(reportRef, {
        classId: currentTeacherClassId,
        teacherName: teacherName,
        date: hijriDate,
        dateId: dateId,
        dayName: dayName,
        students: strugglingStudents,
        totalCount: strugglingStudents.length,
        timestamp: serverTimestamp(),
        autoSent: true
      });
      
      console.log(`✅ Sent daily struggling report: ${strugglingStudents.length} students`);
    } else {
      console.log('✅ No struggling students today');
    }
    
  } catch (error) {
    console.error('Error sending daily struggling report:', error);
  }
}

// ============================================
// ONE-TIME CLEANUP: Delete Old Exams
// ============================================

// Check if cleanup button should be shown
window.checkCleanupButton = function() {
  const cleanupDone = localStorage.getItem('oldExamsCleanupDone');
  const cleanupBtn = document.getElementById('cleanupOldExamsBtn');
  
  if (!cleanupDone && cleanupBtn) {
    cleanupBtn.style.display = 'block';
  }
};

// Cleanup old exams (one-time operation)
window.cleanupOldExams = async function() {
  const confirmed = confirm('⚠️ هذه العملية ستحذف جميع الاختبارات القديمة من النظام\n\nهل أنت متأكد؟');
  
  if (!confirmed) return;
  
  const secondConfirm = confirm('⚠️ تأكيد نهائي: هل تريد حذف جميع الاختبارات القديمة؟\n\nلن يمكن التراجع عن هذا الإجراء!');
  
  if (!secondConfirm) return;
  
  const cleanupBtn = document.getElementById('cleanupOldExamsBtn');
  const originalText = cleanupBtn.innerHTML;
  
  try {
    cleanupBtn.innerHTML = '🔄 جاري الحذف...';
    cleanupBtn.disabled = true;
    cleanupBtn.style.opacity = '0.7';
    
    let deletedCount = 0;
    
    // Get all students in the class
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', currentTeacherClassId)
    ));
    
    // Delete examScore field from all students
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      
      // Remove examScore and lastExamDate from user document
      await updateDoc(doc(db, 'users', studentId), {
        examScore: deleteField(),
        lastExamDate: deleteField()
      });
      
      // Delete all exam reports from studentProgress
      const examReportsSnap = await getDocs(
        collection(db, 'studentProgress', studentId, 'examReports')
      );
      
      for (const examReport of examReportsSnap.docs) {
        await deleteDoc(doc(db, 'studentProgress', studentId, 'examReports', examReport.id));
        deletedCount++;
      }
      
      // Delete all exams from monthlyExams (if exists)
      try {
        const monthlyExamsSnap = await getDocs(
          collection(db, 'monthlyExams', studentId, 'exams')
        );
        
        for (const examDoc of monthlyExamsSnap.docs) {
          await deleteDoc(doc(db, 'monthlyExams', studentId, 'exams', examDoc.id));
          deletedCount++;
        }
      } catch (e) {
        // monthlyExams might not exist for all students, that's ok
      }
    }
    
    // Mark cleanup as done
    localStorage.setItem('oldExamsCleanupDone', 'true');
    
    // Hide button permanently
    cleanupBtn.style.display = 'none';
    
    // Reload monthly scores
    await loadMonthlyScores(currentTeacherClassId);
    
    alert(`✅ تم حذف ${deletedCount} اختبار قديم بنجاح!\n\nالآن يمكنك البدء بإضافة الاختبارات الجديدة.`);
    
  } catch (error) {
    console.error('Error cleaning up old exams:', error);
    alert('❌ حدث خطأ أثناء الحذف: ' + error.message);
    
    // Restore button
    cleanupBtn.innerHTML = originalText;
    cleanupBtn.disabled = false;
    cleanupBtn.style.opacity = '1';
  }
};

// ============== NEW TOOLBAR FUNCTIONS ==============

// Show Top Performers
window.showTopPerformers = async function() {
  // Hide all sections
  hideAllSections();
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'topPerformersModal';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;';
  
  modal.innerHTML = `
    <div style="background: white; width: 95%; max-width: 800px; max-height: 85vh; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <h3 style="margin: 0; font-size: 20px;">🏆 ترتيب الأوائل</h3>
        <button onclick="window.closeTopPerformersModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      
      <!-- Month Filter -->
      <div style="padding: 15px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0;">
        <select id="topPerformersMonthFilter" onchange="window.filterTopPerformersByMonth()" style="width: 100%; padding: 10px; border: 2px solid #FFD700; border-radius: 8px; font-size: 15px; background: white; color: #333; cursor: pointer;">
          <option value="">اختر الشهر...</option>
        </select>
      </div>
      
      <div id="topPerformersContent" style="padding: 10px; max-height: calc(85vh - 200px); overflow-y: auto;">
        ⏳ جاري تحميل البيانات...
      </div>
      <div style="text-align: center; padding: 15px; border-top: 1px solid #eee;">
        <button onclick="window.closeTopPerformersModal()" style="background: #6c757d; color: white; padding: 10px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px;">
          إغلاق
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Populate month filter
  await populateTopPerformersMonthFilter();
  
  // Load top performers data for current month
  try {
    const currentHijri = getCurrentHijriDate();
    const currentMonthKey = `${currentHijri.hijriYear}-${String(currentHijri.hijriMonth).padStart(2, '0')}`;
    await loadMonthlyScoresForMonth(currentTeacherClassId, currentMonthKey);
    
    const scoresData = window.currentClassScores || [];
    
    if (scoresData.length === 0) {
      document.getElementById('topPerformersContent').innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد بيانات بعد</p>';
    } else {
      // Use the same format as monthly scores table
      const medals = ['🥇', '🥈', '🥉'];
      
      const html = scoresData.map(student => {
        const rankDisplay = student.rank <= 3 ? medals[student.rank - 1] : `#${student.rank}`;
        const avgDisplay = student.average > 0 ? student.average.toFixed(1) : '0.0';
        const rowBg = student.rank <= 3 ? 
          (student.rank === 1 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' :
           student.rank === 2 ? 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)' :
           'linear-gradient(135deg, #CD7F32 0%, #B8732A 100%)') :
          (student.rank % 2 === 0 ? '#f9f9f9' : 'white');
        
        const textColor = student.rank <= 3 ? 'white' : '#333';
        const subTextColor = student.rank <= 3 ? 'rgba(255,255,255,0.9)' : '#666';
        
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e0e0e0; background: ${rowBg}; border-radius: 8px; margin-bottom: 6px; box-shadow: ${student.rank <= 3 ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)'}; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 150px;">
              <span style="font-size: 24px; font-weight: bold; min-width: 35px;">${rankDisplay}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: ${textColor}; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${student.name}</div>
                <div style="font-size: 11px; color: ${subTextColor};">${student.id}</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: nowrap;">
              <div style="text-align: center; min-width: 55px;">
                <div style="font-size: 10px; color: ${subTextColor}; margin-bottom: 2px;">النقاط</div>
                <div style="font-size: 16px; font-weight: bold; color: ${student.rank <= 3 ? 'white' : '#667eea'};">${student.totalScore}</div>
              </div>
              <div style="text-align: center; min-width: 55px;">
                <div style="font-size: 10px; color: ${subTextColor}; margin-bottom: 2px;">اختبار</div>
                <div style="font-size: 16px; font-weight: bold; color: ${student.rank <= 3 ? 'white' : '#764ba2'};">${student.examScore}</div>
              </div>
              <div style="text-align: center; min-width: 55px; padding: 6px; background: ${student.rank <= 3 ? 'rgba(255,255,255,0.2)' : '#f0f7ff'}; border-radius: 6px;">
                <div style="font-size: 10px; color: ${subTextColor}; margin-bottom: 2px;">معدل</div>
                <div style="font-size: 17px; font-weight: bold; color: ${student.rank <= 3 ? 'white' : '#28a745'};">${avgDisplay}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      document.getElementById('topPerformersContent').innerHTML = html;
    }
    
  } catch (error) {
    console.error('Error loading top performers:', error);
    document.getElementById('topPerformersContent').innerHTML = '<p style="text-align: center; color: #dc3545;">❌ حدث خطأ في تحميل البيانات</p>';
  }
};

window.closeTopPerformersModal = function() {
  const modal = document.getElementById('topPerformersModal');
  if (modal) modal.remove();
};

// Populate month filter for top performers (current + next 6 months)
async function populateTopPerformersMonthFilter() {
  const monthSelect = document.getElementById('topPerformersMonthFilter');
  if (!monthSelect) return;
  
  // Get current Hijri date from accurate calendar
  const currentHijri = getCurrentHijriDate();
  
  const hijriMonthNames = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  // Current month + next 6 months
  monthSelect.innerHTML = '<option value="">اختر الشهر...</option>';
  
  for (let i = 0; i < 7; i++) {
    // Calculate Hijri month by adding months to current Hijri month
    let year = currentHijri.hijriYear;
    let month = currentHijri.hijriMonth + i;
    
    // Handle year overflow (month > 12)
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    
    const monthName = hijriMonthNames[month - 1];
    const monthValue = `${year}-${String(month).padStart(2, '0')}`;
    
    const option = document.createElement('option');
    option.value = monthValue;
    option.textContent = `${monthName} ${year} هـ`;
    
    if (i === 0) {
      option.selected = true;
      option.textContent += ' (الشهر الحالي)';
    }
    
    monthSelect.appendChild(option);
  }
}

// Filter top performers by selected month
window.filterTopPerformersByMonth = async function() {
  const monthSelect = document.getElementById('topPerformersMonthFilter');
  const selectedMonth = monthSelect.value;
  
  if (!selectedMonth) {
    document.getElementById('topPerformersContent').innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">اختر شهراً لعرض الترتيب</p>';
    return;
  }
  
  document.getElementById('topPerformersContent').innerHTML = '⏳ جاري تحميل البيانات...';
  
  try {
    await loadMonthlyScoresForMonth(currentTeacherClassId, selectedMonth);
    
    const scoresData = window.currentClassScores || [];
    
    if (scoresData.length === 0) {
      document.getElementById('topPerformersContent').innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد بيانات لهذا الشهر</p>';
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      
      const html = scoresData.map(student => {
        const rankDisplay = student.rank <= 3 ? medals[student.rank - 1] : `#${student.rank}`;
        const avgDisplay = student.average > 0 ? student.average.toFixed(1) : '0.0';
        const rowBg = student.rank <= 3 ? 
          (student.rank === 1 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' :
           student.rank === 2 ? 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)' :
           'linear-gradient(135deg, #CD7F32 0%, #B8732A 100%)') :
          (student.rank % 2 === 0 ? '#f9f9f9' : 'white');
        
        const textColor = student.rank <= 3 ? 'white' : '#333';
        const subTextColor = student.rank <= 3 ? 'rgba(255,255,255,0.9)' : '#666';
        
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #e0e0e0; background: ${rowBg}; border-radius: 8px; margin-bottom: 6px; box-shadow: ${student.rank <= 3 ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)'}; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 150px;">
              <span style="font-size: 24px; font-weight: bold; min-width: 35px;">${rankDisplay}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; color: ${textColor}; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${student.name}</div>
                <div style="font-size: 11px; color: ${subTextColor};">${student.id}</div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: nowrap;">
              <div style="text-align: center; min-width: 55px;">
                <div style="font-size: 10px; color: ${subTextColor}; margin-bottom: 2px;">النقاط</div>
                <div style="font-size: 16px; font-weight: bold; color: ${student.rank <= 3 ? 'white' : '#667eea'};">${student.totalScore}</div>
              </div>
              <div style="text-align: center; min-width: 55px;">
                <div style="font-size: 10px; color: ${subTextColor}; margin-bottom: 2px;">اختبار</div>
                <div style="font-size: 16px; font-weight: bold; color: ${student.rank <= 3 ? 'white' : '#764ba2'};">${student.examScore}</div>
              </div>
              <div style="text-align: center; min-width: 55px; padding: 6px; background: ${student.rank <= 3 ? 'rgba(255,255,255,0.2)' : '#f0f7ff'}; border-radius: 6px;">
                <div style="font-size: 10px; color: ${subTextColor}; margin-bottom: 2px;">معدل</div>
                <div style="font-size: 17px; font-weight: bold; color: ${student.rank <= 3 ? 'white' : '#28a745'};">${avgDisplay}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      document.getElementById('topPerformersContent').innerHTML = html;
    }
  } catch (error) {
    console.error('Error filtering top performers:', error);
    document.getElementById('topPerformersContent').innerHTML = '<p style="text-align: center; color: #dc3545;">❌ حدث خطأ في تحميل البيانات</p>';
  }
};

// Load monthly scores for specific month
async function loadMonthlyScoresForMonth(classId, monthKey) {
  try {
    // Get all students in this class
    const studentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', classId)
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    const studentsScores = [];
    
    // Calculate scores for each student
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || studentId;
      
      // Get all daily reports for this student in selected month
      const reportsSnap = await getDocs(
        collection(db, 'studentProgress', studentId, 'dailyReports')
      );
      
      let totalScore = 0;
      let daysCount = 0;
      
      reportsSnap.forEach(reportDoc => {
        const reportDateId = reportDoc.id; // This is in Hijri format: YYYY-MM-DD
        
        // Check if report is from selected month (compare YYYY-MM prefix)
        if (reportDateId.startsWith(monthKey)) {
          const reportData = reportDoc.data();
          totalScore += reportData.totalScore || 0;
          daysCount++;
        }
      });
      
      // Get exam score from actual exam reports
      let examScore = 0;
      try {
        const examReportsSnap = await getDocs(
          collection(db, 'studentProgress', studentId, 'examReports')
        );
        
        // Check if there's an exam report for selected month
        examReportsSnap.forEach(examDoc => {
          const examDateId = examDoc.id;
          if (examDateId.startsWith(monthKey)) {
            const examData = examDoc.data();
            examScore = examData.finalScore || 0;
          }
        });
      } catch (error) {
        console.warn(`Could not load exam reports for ${studentId}:`, error);
      }
      
      const average = (examScore > 0) ? ((totalScore + examScore) / 2) : 0;
      
      studentsScores.push({
        id: studentId,
        name: studentName,
        totalScore: totalScore,
        daysCount: daysCount,
        examScore: examScore,
        average: average
      });
    }
    
    // Sort by average (descending)
    studentsScores.sort((a, b) => b.average - a.average);
    
    // Add rank to each student
    studentsScores.forEach((student, index) => {
      student.rank = index + 1;
    });
    
    // Store for later use
    window.currentClassScores = studentsScores;
    
  } catch (error) {
    console.error('Error loading monthly scores for month:', error);
    throw error;
  }
}


// Show Today's Struggling Students Report
window.showTodayStrugglingReport = async function() {
  hideAllSections();
  
  const modal = document.createElement('div');
  modal.id = 'strugglingModal';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;';
  
  // Get accurate Hijri date for display
  const todayHijriData = getCurrentHijriDate();
  const [year, month, day] = todayHijriData.hijri.split('-');
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const monthName = hijriMonths[parseInt(month) - 1];
  const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
  
  modal.innerHTML = `
    <div style="background: white; width: 90%; max-width: 900px; max-height: 80vh; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 22px;">⚠️ طلاب متعثرون اليوم</h3>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${hijriDate}</p>
        </div>
        <button onclick="window.closeStrugglingModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div id="strugglingContent" style="padding: 20px; max-height: calc(80vh - 160px); overflow-y: auto;">
        ⏳ جاري تحميل التقرير...
      </div>
      <div style="text-align: center; padding: 15px; border-top: 1px solid #eee;">
        <button onclick="window.closeStrugglingModal()" style="background: #6c757d; color: white; padding: 10px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px;">
          إغلاق
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Load today's report using accurate Hijri date
  try {
    const dateId = todayHijriData.hijri; // Accurate Hijri date in YYYY-MM-DD format
    
    const reportId = `${currentTeacherClassId}_${dateId}`;
    const reportRef = doc(db, 'strugglingReports', reportId);
    const reportSnap = await getDoc(reportRef);
    
    let html = '';
    
    if (!reportSnap.exists()) {
      html = `
        <div style="text-align: center; padding: 40px; color: #51cf66;">
          <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
          <h3 style="margin: 0; color: #51cf66;">ممتاز!</h3>
          <p style="color: #666; margin-top: 10px;">لا يوجد طلاب متعثرون اليوم</p>
        </div>
      `;
    } else {
      const reportData = reportSnap.data();
      const students = reportData.students || [];
      
      html = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 16px; color: #666;">عدد الطلاب المتعثرين</div>
          <div style="font-size: 32px; font-weight: bold; color: #dc3545;">${students.length}</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 15px;">
      `;
      
      students.forEach((student, index) => {
        html += `
          <div style="background: #fff; border: 2px solid #ffcccb; border-radius: 10px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
              <div>
                <h4 style="margin: 0; color: #dc3545; font-size: 18px;">${index + 1}. ${student.name}</h4>
                <p style="margin: 3px 0; color: #666; font-size: 13px;">الرقم: ${student.id}</p>
              </div>
              <div style="background: #dc3545; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px; font-weight: bold;">
                ${student.totalScore}/30
              </div>
            </div>
            <div style="background: #fff5f5; padding: 10px; border-radius: 8px;">
              <div style="font-size: 13px; font-weight: bold; color: #333; margin-bottom: 5px;">⚠️ المشاكل:</div>
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                ${student.issues.map(issue => `
                  <span style="background: #ffe6e6; color: #dc3545; padding: 4px 10px; border-radius: 15px; font-size: 12px;">
                    ${issue}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    document.getElementById('strugglingContent').innerHTML = html;
    
  } catch (error) {
    console.error('Error loading struggling report:', error);
    document.getElementById('strugglingContent').innerHTML = '<p style="text-align: center; color: #dc3545;">❌ حدث خطأ في تحميل التقرير</p>';
  }
};

window.closeStrugglingModal = function() {
  const modal = document.getElementById('strugglingModal');
  if (modal) modal.remove();
};

// Show Notifications Box
window.showNotificationsBox = async function() {
  hideAllSections();
  
  const modal = document.createElement('div');
  modal.id = 'notificationsModal';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;';
  
  modal.innerHTML = `
    <div style="background: white; width: 90%; max-width: 700px; max-height: 80vh; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 22px;">🔔 الإشعارات</h3>
        <button onclick="window.closeNotificationsModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div id="notificationsContent" style="padding: 20px; max-height: calc(80vh - 160px); overflow-y: auto;">
        ⏳ جاري تحميل الإشعارات...
      </div>
      <div style="text-align: center; padding: 15px; border-top: 1px solid #eee;">
        <button onclick="window.closeNotificationsModal()" style="background: #6c757d; color: white; padding: 10px 30px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px;">
          إغلاق
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Load notifications
  try {
    const q1 = query(
      collection(db, 'teacherNotifications'),
      where('teacherId', '==', currentTeacherClassId)
    );
    
    const q2 = query(
      collection(db, 'teacherNotifications'),
      where('classId', '==', currentTeacherClassId)
    );
    
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    const notifications = [];
    snap1.forEach(d => notifications.push({ id: d.id, ...d.data() }));
    snap2.forEach(d => {
      if (!notifications.find(n => n.id === d.id)) {
        notifications.push({ id: d.id, ...d.data() });
      }
    });
    
    // Sort by createdAt or timestamp
    notifications.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.timestamp || 0;
      const timeB = b.createdAt?.toMillis?.() || b.timestamp || 0;
      return timeB - timeA;
    });
    
    // Limit to 50 most recent
    const recentNotifications = notifications.slice(0, 50);
    
    let html = '';
    
    if (recentNotifications.length === 0) {
      html = `
        <div style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
          <p>لا توجد إشعارات</p>
        </div>
      `;
    } else {
      html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
      
      recentNotifications.forEach(notif => {
        const isRead = notif.read || false;
        const bgColor = isRead ? '#f8f9fa' : '#e7f3ff';
        const borderColor = isRead ? '#dee2e6' : '#667eea';
        
        // Get date display
        let dateDisplay = '';
        if (notif.completionDateHijri) {
          dateDisplay = notif.completionDateHijri;
        } else if (notif.date) {
          dateDisplay = notif.date;
        } else if (notif.createdAt?.toDate) {
          dateDisplay = notif.createdAt.toDate().toLocaleString('ar-SA');
        } else if (notif.timestamp) {
          dateDisplay = new Date(notif.timestamp).toLocaleString('ar-SA');
        } else {
          dateDisplay = 'تاريخ غير محدد';
        }
        
        html += `
          <div style="background: ${bgColor}; border-right: 4px solid ${borderColor}; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="font-size: 15px; color: #333; margin-bottom: 5px; font-weight: ${isRead ? 'normal' : 'bold'}; white-space: pre-line;">
              ${notif.message || notif.title || 'إشعار'}
            </div>
            <div style="font-size: 12px; color: #666;">
              ${dateDisplay}
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    document.getElementById('notificationsContent').innerHTML = html;
    
    // Mark as read
    notifications.forEach(async (notif) => {
      if (!notif.read) {
        await updateDoc(doc(db, 'teacherNotifications', notif.id), { read: true });
      }
    });
    
    // Update badge
    updateTeacherNotificationBadge();
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    document.getElementById('notificationsContent').innerHTML = '<p style="text-align: center; color: #dc3545;">❌ حدث خطأ في تحميل الإشعارات</p>';
  }
};

window.closeNotificationsModal = function() {
  const modal = document.getElementById('notificationsModal');
  if (modal) modal.remove();
};

// Show Class Attendance Report
window.showClassAttendanceReport = function() {
  console.log('🔵 showClassAttendanceReport: Start');
  hideAllSections();
  
  // Show the class attendance section (for all students)
  const classSection = document.getElementById('classAttendanceReportSection');
  console.log('🔵 classAttendanceReportSection element:', classSection);
  if (classSection) {
    classSection.style.display = 'block';
    console.log('✅ Section displayed, calling loadClassAttendanceReport...');
    loadClassAttendanceReport(currentTeacherClassId);
    classSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    console.error('❌ Section not found!');
    alert('⚠️ قسم تقرير الحضور غير موجود');
  }
};

// Show Monthly Exams Report
window.showMonthlyExamsReport = function() {
  hideAllSections();
  window.showMonthlyExamsManagement();
};

// Helper function to hide all sections
function hideAllSections() {
  const sections = [
    'newAssessmentForm',
    'pastReportsSection',
    'strugglesSection',
    'monthlyExamSection',
    'attendanceReportSection',
    'classAttendanceReportSection',
    'monthlyScoresSection'
  ];
  
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}


// Monthly Exams System JavaScript
import { db, collection, getDocs, addDoc, query, where, orderBy, serverTimestamp } from '../firebase-config.js';
import { getCurrentHijriDate } from './hijri-date.js';

// Global variables
let allExams = [];
let filteredExams = [];
let allTeachers = {};
let currentFilteredStudents = [];

/**
 * Initialize Exams Date Dropdowns
 */
async function initExamsDateDropdowns() {
  const daySelect = document.getElementById('examDay');
  const monthSelect = document.getElementById('examMonth');
  const yearSelect = document.getElementById('examYear');
  
  if (!daySelect || !monthSelect || !yearSelect) return;
  
  // Clear existing options
  daySelect.innerHTML = '<option value="">اليوم</option>';
  monthSelect.innerHTML = '<option value="">الشهر</option>';
  yearSelect.innerHTML = '<option value="">السنة</option>';
  
  // Fill days (1-30)
  for (let i = 1; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = String(i).padStart(2, '0');
    option.textContent = i;
    daySelect.appendChild(option);
  }
  
  // Fill Hijri months
  const hijriMonths = [
    'المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  hijriMonths.forEach((month, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1).padStart(2, '0');
    option.textContent = month;
    monthSelect.appendChild(option);
  });
  
  // Fill years (current and previous 2 years)
  const currentHijriData = getCurrentHijriDate();
  const currentYear = currentHijriData.hijriYear;
  
  for (let i = 0; i < 3; i++) {
    const year = currentYear - i;
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = `${year} هـ`;
    yearSelect.appendChild(option);
  }
  
  // Set today's date as default
  await setExamDateToday();
}

/**
 * Set Exam Date to Today
 */
window.setExamDateToday = async function() {
  try {
    const currentHijriData = getCurrentHijriDate();
    const day = String(currentHijriData.hijriDay).padStart(2, '0');
    const month = String(currentHijriData.hijriMonth).padStart(2, '0');
    const year = String(currentHijriData.hijriYear);
    
    const daySelect = document.getElementById('examDay');
    const monthSelect = document.getElementById('examMonth');
    const yearSelect = document.getElementById('examYear');
    
    if (daySelect && monthSelect && yearSelect) {
      daySelect.value = day;
      monthSelect.value = month;
      yearSelect.value = year;
    }
  } catch (error) {
    console.error('Error setting today date:', error);
  }
};

/**
 * Load Teachers for Exam Form
 */
async function loadExamTeachers() {
  const teacherSelect = document.getElementById('examTeacherSelect');
  if (!teacherSelect) return;
  
  const teachers = {
    'ABD01': 'عبدالرحمن السيسي',
    'AMR01': 'عامر هوساوي',
    'ANS01': 'الأستاذ أنس',
    'HRT01': 'حارث',
    'IBR01': 'إبراهيم الطارقي',
    'JHD01': 'الأستاذ جهاد',
    'JWD01': 'عبدالرحمن جاويد',
    'MZB01': 'مازن البلوشي',
    'MZN01': 'الأستاذ مازن',
    'NBL01': 'الأستاذ نبيل',
    'OMR01': 'الأستاذ عمر',
    'OSM01': 'أسامة حبيب',
    'SLM01': 'سلمان رفيق'
  };
  
  teacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
  
  Object.entries(teachers).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    teacherSelect.appendChild(option);
  });
}

/**
 * Load Students for Selected Teacher
 */
window.loadExamStudents = async function() {
  const teacherId = document.getElementById('examTeacherSelect')?.value;
  const studentSelect = document.getElementById('examStudentSelect');
  
  if (!studentSelect) return;
  
  studentSelect.innerHTML = '<option value="">-- اختر المعلم أولاً --</option>';
  
  if (!teacherId) return;
  
  try {
    studentSelect.innerHTML = '<option value="">⏳ جاري التحميل...</option>';
    
    const studentsSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', teacherId)
    ));
    
    studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>';
    
    studentsSnap.forEach(doc => {
      const student = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = student.name;
      studentSelect.appendChild(option);
    });
    
    if (studentsSnap.empty) {
      studentSelect.innerHTML = '<option value="">لا يوجد طلاب</option>';
    }
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
  }
};

/**
 * Save Monthly Exam
 */
window.saveMonthlyExam = async function() {
  const day = document.getElementById('examDay')?.value;
  const month = document.getElementById('examMonth')?.value;
  const year = document.getElementById('examYear')?.value;
  const teacherId = document.getElementById('examTeacherSelect')?.value;
  const studentId = document.getElementById('examStudentSelect')?.value;
  const scope = document.getElementById('examScope')?.value.trim();
  const score = parseInt(document.getElementById('examScore')?.value);
  const notes = document.getElementById('examNotes')?.value.trim();
  
  const messageBox = document.getElementById('examFormMessage');
  
  // Validation
  if (!day || !month || !year) {
    showMessage(messageBox, 'error', 'يرجى اختيار التاريخ الهجري');
    return;
  }
  
  if (!teacherId) {
    showMessage(messageBox, 'error', 'يرجى اختيار المعلم');
    return;
  }
  
  if (!studentId) {
    showMessage(messageBox, 'error', 'يرجى اختيار الطالب');
    return;
  }
  
  if (!scope) {
    showMessage(messageBox, 'error', 'يرجى إدخال مقدار الاختبار');
    return;
  }
  
  if (isNaN(score) || score < 0 || score > 100) {
    showMessage(messageBox, 'error', 'يرجى إدخال درجة صحيحة (0-100)');
    return;
  }
  
  try {
    // Get teacher and student names
    const teacherSelect = document.getElementById('examTeacherSelect');
    const studentSelect = document.getElementById('examStudentSelect');
    const teacherName = teacherSelect.options[teacherSelect.selectedIndex]?.text || '';
    const studentName = studentSelect.options[studentSelect.selectedIndex]?.text || '';
    
    const hijriDate = `${year}-${month}-${day}`;
    const monthKey = `${year}-${month}`;
    
    // Create exam document
    const examData = {
      hijriDate: hijriDate,
      hijriMonth: monthKey,
      hijriYear: year,
      teacherId: teacherId,
      teacherName: teacherName,
      studentId: studentId,
      studentName: studentName,
      examScope: scope,
      score: score,
      notes: notes || '',
      createdAt: serverTimestamp(),
      createdBy: sessionStorage.getItem('loggedInViewer') || 'unknown'
    };
    
    // Save to Firestore
    await addDoc(collection(db, 'monthlyExams'), examData);
    
    showMessage(messageBox, 'success', '✅ تم حفظ الدرجة بنجاح');
    
    // Clear form
    setTimeout(() => {
      document.getElementById('examStudentSelect').value = '';
      document.getElementById('examScope').value = '';
      document.getElementById('examScore').value = '';
      document.getElementById('examNotes').value = '';
      
      // Reload exams list
      loadMonthlyExams();
      
      messageBox.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('Error saving exam:', error);
    showMessage(messageBox, 'error', '❌ حدث خطأ أثناء الحفظ');
  }
};

/**
 * Show Message
 */
function showMessage(element, type, message) {
  if (!element) return;
  element.className = `form-message ${type}`;
  element.textContent = message;
  element.style.display = 'block';
}

/**
 * Load Monthly Exams
 */
window.loadMonthlyExams = async function() {
  const container = document.getElementById('examsTableContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>جاري تحميل السجلات...</p></div>';
  
  try {
    // Load all exams ordered by date descending
    const examsSnap = await getDocs(query(
      collection(db, 'monthlyExams'),
      orderBy('hijriDate', 'desc')
    ));
    
    allExams = [];
    examsSnap.forEach(doc => {
      allExams.push({ id: doc.id, ...doc.data() });
    });
    
    filteredExams = [...allExams];
    
    // Initialize filters
    await initializeFilters();
    
    // Display exams
    displayExams();
    
  } catch (error) {
    console.error('Error loading exams:', error);
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">حدث خطأ أثناء تحميل السجلات</p></div>';
  }
};

/**
 * Load Teachers from Classes Collection
 */
async function loadTeachersForFilter() {
  try {
    // Get all classes
    const classesSnap = await getDocs(collection(db, 'classes'));
    
    allTeachers = {
      'ABD01': 'عبدالرحمن السيسي',
      'AMR01': 'عامر هوساوي',
      'ANS01': 'الأستاذ أنس',
      'HRT01': 'حارث',
      'IBR01': 'إبراهيم الطارقي',
      'JHD01': 'الأستاذ جهاد',
      'JWD01': 'عبدالرحمن جاويد',
      'MZB01': 'مازن البلوشي',
      'MZN01': 'الأستاذ مازن',
      'NBL01': 'الأستاذ نبيل',
      'OMR01': 'الأستاذ عمر',
      'OSM01': 'أسامة حبيب',
      'SLM01': 'سلمان رفيق'
    };
    
  } catch (error) {
    console.error('Error loading teachers:', error);
  }
}

/**
 * Initialize Month Filter with Smart Defaults
 */
function initializeMonthFilter() {
  const monthFilter = document.getElementById('filterExamMonth');
  if (!monthFilter) return;
  
  // Get unique months from exams
  const months = new Set();
  allExams.forEach(exam => {
    if (exam.hijriMonth) months.add(exam.hijriMonth);
  });
  
  const monthsArray = Array.from(months).sort().reverse();
  const hijriMonths = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  monthFilter.innerHTML = '<option value="">جميع الأشهر</option>';
  monthsArray.forEach(monthKey => {
    const [year, month] = monthKey.split('-');
    const monthName = hijriMonths[parseInt(month) - 1];
    const option = document.createElement('option');
    option.value = monthKey;
    option.textContent = `${monthName} ${year} هـ`;
    monthFilter.appendChild(option);
  });
  
  // Set current month as default
  const currentHijriData = getCurrentHijriDate();
  const currentYear = String(currentHijriData.hijriYear);
  const currentMonth = String(currentHijriData.hijriMonth).padStart(2, '0');
  const currentMonthKey = `${currentYear}-${currentMonth}`;
  if (monthsArray.includes(currentMonthKey)) {
    monthFilter.value = currentMonthKey;
  }
}

/**
 * Initialize Teacher Filter with All Teachers
 */
function initializeTeacherFilter() {
  const teacherFilter = document.getElementById('filterExamTeacher');
  if (!teacherFilter) return;
  
  teacherFilter.innerHTML = '<option value="">جميع المعلمين</option>';
  
  // Sort teachers by name
  const sortedTeachers = Object.entries(allTeachers).sort((a, b) => 
    a[1].localeCompare(b[1], 'ar')
  );
  
  sortedTeachers.forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    teacherFilter.appendChild(option);
  });
}

/**
 * Initialize Student Filter (Dynamic based on teacher)
 */
async function initializeStudentFilter(teacherId = '') {
  const studentFilter = document.getElementById('filterExamStudent');
  if (!studentFilter) return;
  
  studentFilter.innerHTML = '<option value="">⏳ جاري التحميل...</option>';
  studentFilter.disabled = true;
  
  try {
    if (!teacherId) {
      // No teacher selected - show all students from exams
      const students = new Set();
      allExams.forEach(exam => {
        if (exam.studentId && exam.studentName) {
          students.add(JSON.stringify({ id: exam.studentId, name: exam.studentName }));
        }
      });
      
      currentFilteredStudents = Array.from(students).map(s => JSON.parse(s));
      
      studentFilter.innerHTML = '<option value="">جميع الطلاب</option>';
      currentFilteredStudents
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
        .forEach(student => {
          const option = document.createElement('option');
          option.value = student.id;
          option.textContent = student.name;
          studentFilter.appendChild(option);
        });
    } else {
      // Teacher selected - load students from Firestore
      const studentsSnap = await getDocs(query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('classId', '==', teacherId)
      ));
      
      currentFilteredStudents = [];
      studentsSnap.forEach(doc => {
        currentFilteredStudents.push({
          id: doc.id,
          name: doc.data().name
        });
      });
      
      studentFilter.innerHTML = '<option value="">جميع الطلاب</option>';
      
      if (currentFilteredStudents.length === 0) {
        studentFilter.innerHTML = '<option value="">لا يوجد طلاب</option>';
      } else {
        currentFilteredStudents
          .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
          .forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = student.name;
            studentFilter.appendChild(option);
          });
      }
    }
    
    studentFilter.disabled = false;
    
  } catch (error) {
    console.error('Error loading students:', error);
    studentFilter.innerHTML = '<option value="">خطأ في التحميل</option>';
    studentFilter.disabled = false;
  }
}

/**
 * Initialize All Filters
 */
async function initializeFilters() {
  await loadTeachersForFilter();
  initializeMonthFilter();
  initializeTeacherFilter();
  await initializeStudentFilter();
}

/**
 * Handle Teacher Filter Change
 */
window.onTeacherFilterChange = async function() {
  const teacherId = document.getElementById('filterExamTeacher')?.value;
  
  // Reset student filter
  document.getElementById('filterExamStudent').value = '';
  
  // Reload student filter based on selected teacher
  await initializeStudentFilter(teacherId);
  
  // Apply filters
  window.filterExams();
};

/**
 * Smart Filter Exams with Live Updates
 */
window.filterExams = function() {
  const monthFilter = document.getElementById('filterExamMonth')?.value;
  const teacherFilter = document.getElementById('filterExamTeacher')?.value;
  const studentFilter = document.getElementById('filterExamStudent')?.value;
  
  filteredExams = allExams.filter(exam => {
    // Filter by month
    if (monthFilter && exam.hijriMonth !== monthFilter) return false;
    
    // Filter by teacher
    if (teacherFilter && exam.teacherId !== teacherFilter) return false;
    
    // Filter by student (exact match on ID)
    if (studentFilter && exam.studentId !== studentFilter) return false;
    
    return true;
  });
  
  displayExams();
};

/**
 * Display Exams
 */
function displayExams() {
  const container = document.getElementById('examsTableContainer');
  if (!container) return;
  
  if (filteredExams.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><p class="empty-state-text">لا توجد اختبارات مسجلة</p></div>';
    return;
  }
  
  // Create table
  let tableHTML = `
    <table class="exams-table">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الطالب</th>
          <th>المعلم</th>
          <th>مقدار الاختبار</th>
          <th>الدرجة</th>
          <th>الملاحظات</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filteredExams.forEach(exam => {
    const [year, month, day] = exam.hijriDate.split('-');
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const monthName = hijriMonths[parseInt(month) - 1];
    const dateStr = `${day} ${monthName} ${year}`;
    
    // Determine score class
    let scoreClass = '';
    if (exam.score >= 90) scoreClass = 'score-excellent';
    else if (exam.score >= 75) scoreClass = 'score-good';
    else if (exam.score >= 60) scoreClass = 'score-average';
    else scoreClass = 'score-poor';
    
    tableHTML += `
      <tr>
        <td data-label="التاريخ">${dateStr}</td>
        <td data-label="الطالب"><strong>${exam.studentName}</strong></td>
        <td data-label="المعلم">${exam.teacherName}</td>
        <td data-label="المقدار">${exam.examScope}</td>
        <td data-label="الدرجة"><span class="exam-score-badge ${scoreClass}">${exam.score}/100</span></td>
        <td data-label="الملاحظات">${exam.notes || '-'}</td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  container.innerHTML = tableHTML;
}

/**
 * Switch between tabs
 */
window.switchExamTab = function(tabName) {
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
  
  // Load data if needed
  if (tabName === 'history') {
    loadMonthlyExams();
  }
};

/**
 * Initialize Exams Section
 */
export async function initExamsSection() {
  await initExamsDateDropdowns();
  await loadExamTeachers();
  
  // Load history tab data in background
  setTimeout(() => {
    loadMonthlyExams();
  }, 100);
  
  // Set default tab to 'new'
  window.switchExamTab('new');
}

// Make function available globally
window.initExamsSection = initExamsSection;

// Monthly Exams System JavaScript
import { db, collection, getDocs, addDoc, query, where, orderBy, serverTimestamp } from '../firebase-config.js';
import { getCurrentHijriDate } from './hijri-date.js';

// Global variables
let allExams = [];
let filteredExams = [];

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
  const currentHijriDate = getCurrentHijriDate();
  const currentYear = parseInt(currentHijriDate.split('-')[0]);
  
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
    const currentHijriDate = getCurrentHijriDate();
    const [year, month, day] = currentHijriDate.split('-');
    
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
 * Initialize Filters
 */
async function initializeFilters() {
  // Fill month filter
  const monthFilter = document.getElementById('filterExamMonth');
  const teacherFilter = document.getElementById('filterExamTeacher');
  
  if (monthFilter) {
    const months = new Set();
    allExams.forEach(exam => {
      if (exam.hijriMonth) months.add(exam.hijriMonth);
    });
    
    const monthsArray = Array.from(months).sort().reverse();
    const hijriMonths = [
      'المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
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
    const currentHijriDate = getCurrentHijriDate();
    const [currentYear, currentMonth] = currentHijriDate.split('-');
    const currentMonthKey = `${currentYear}-${currentMonth}`;
    if (monthsArray.includes(currentMonthKey)) {
      monthFilter.value = currentMonthKey;
    }
  }
  
  // Fill teacher filter
  if (teacherFilter) {
    const teachers = new Set();
    allExams.forEach(exam => {
      if (exam.teacherId && exam.teacherName) {
        teachers.add(JSON.stringify({ id: exam.teacherId, name: exam.teacherName }));
      }
    });
    
    teacherFilter.innerHTML = '<option value="">جميع المعلمين</option>';
    Array.from(teachers).forEach(teacherStr => {
      const teacher = JSON.parse(teacherStr);
      const option = document.createElement('option');
      option.value = teacher.id;
      option.textContent = teacher.name;
      teacherFilter.appendChild(option);
    });
  }
}

/**
 * Filter Exams
 */
window.filterExams = function() {
  const monthFilter = document.getElementById('filterExamMonth')?.value;
  const teacherFilter = document.getElementById('filterExamTeacher')?.value;
  const studentFilter = document.getElementById('filterExamStudent')?.value.trim().toLowerCase();
  
  filteredExams = allExams.filter(exam => {
    // Filter by month
    if (monthFilter && exam.hijriMonth !== monthFilter) return false;
    
    // Filter by teacher
    if (teacherFilter && exam.teacherId !== teacherFilter) return false;
    
    // Filter by student
    if (studentFilter && !exam.studentName.toLowerCase().includes(studentFilter)) return false;
    
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
        <td>${dateStr}</td>
        <td><strong>${exam.studentName}</strong></td>
        <td>${exam.teacherName}</td>
        <td>${exam.examScope}</td>
        <td><span class="exam-score-badge ${scoreClass}">${exam.score}/100</span></td>
        <td>${exam.notes || '-'}</td>
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
 * Initialize Exams Section
 */
export async function initExamsSection() {
  await initExamsDateDropdowns();
  await loadExamTeachers();
  await loadMonthlyExams();
}

// Make function available globally
window.initExamsSection = initExamsSection;

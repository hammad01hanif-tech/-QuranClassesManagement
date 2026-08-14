// Monthly Exams System JavaScript
import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from '../firebase-config.js';
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
    'FSL01': 'فيصل جاويد',
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
  const score = parseFloat(document.getElementById('examScore')?.value);
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
      'FSL01': 'فيصل جاويد',
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
window.filterExams = async function() {
  const monthFilter = document.getElementById('filterExamMonth')?.value;
  const teacherFilter = document.getElementById('filterExamTeacher')?.value;
  const studentFilter = document.getElementById('filterExamStudent')?.value;
  const statusFilter = document.getElementById('filterExamStatus')?.value || 'all';
  
  // Handle "not-tested" status filter
  if (statusFilter === 'not-tested') {
    await displayNotTestedStudents(monthFilter, teacherFilter);
    return;
  }
  
  // Standard filtering for "all" or "tested"
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
/**
 * Display Exams as Minimal Cards
 */
function displayExams() {
  const container = document.getElementById('examsTableContainer');
  if (!container) return;
  
  if (filteredExams.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p class="empty-state-text">لا توجد اختبارات مسجلة</p>
        <p class="empty-state-hint">جرب تغيير الفلاتر أو أضف اختبار جديد</p>
      </div>
    `;
    return;
  }
  
  // Create export header with PDF button
  let cardsHTML = `
    <div class="export-header">
      <button class="export-pdf-btn" onclick="window.exportMonthlyExamsPDF()">
        <span>تصدير PDF</span>
      </button>
    </div>
  `;
  
  // Create cards grid
  cardsHTML += '<div class="exams-cards-grid">';
  
  filteredExams.forEach(exam => {
    // Determine score class
    let scoreClass = '';
    if (exam.score >= 90) scoreClass = 'score-excellent';
    else if (exam.score >= 75) scoreClass = 'score-good';
    else if (exam.score >= 60) scoreClass = 'score-average';
    else scoreClass = 'score-poor';
    
    cardsHTML += `
      <div class="exam-mini-card" onclick="window.openExamDetails('${exam.id}')">
        <div class="mini-card-header">
          <div class="mini-card-student">
            <span class="mini-card-icon">🧑‍🎓</span>
            <span class="mini-card-name">${exam.studentName}</span>
          </div>
        </div>
        <div class="mini-card-score ${scoreClass}">
          <span class="score-icon">🎯</span>
          <span class="score-value">${exam.score}</span>
          <span class="score-total">/100</span>
        </div>
      </div>
    `;
  });
  
  cardsHTML += '</div>';
  container.innerHTML = cardsHTML;
}

/**
 * Display Students Who Have NOT Tested
 */
async function displayNotTestedStudents(monthFilter, teacherFilter) {
  const container = document.getElementById('examsTableContainer');
  if (!container) return;
  
  container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>جاري التحميل...</p></div>';
  
  try {
    // Get all students
    let studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
    if (teacherFilter) {
      studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', teacherFilter));
    }
    
    const studentsSnap = await getDocs(studentsQuery);
    const allStudents = [];
    studentsSnap.forEach(doc => {
      allStudents.push({
        id: doc.id,
        name: doc.data().name,
        teacherId: doc.data().classId || doc.data().teacherId,
        teacherName: allTeachers[doc.data().classId || doc.data().teacherId] || 'غير محدد'
      });
    });
    
    // Get students who tested in the selected month
    let testedStudentIds = new Set();
    
    if (monthFilter) {
      // Filter by specific month
      testedStudentIds = new Set(
        allExams
          .filter(exam => exam.hijriMonth === monthFilter && (!teacherFilter || exam.teacherId === teacherFilter))
          .map(exam => exam.studentId)
      );
    } else {
      // All months - get students who have ANY exam
      testedStudentIds = new Set(
        allExams
          .filter(exam => !teacherFilter || exam.teacherId === teacherFilter)
          .map(exam => exam.studentId)
      );
    }
    
    // Find students who have NOT tested
    const notTestedStudents = allStudents.filter(student => !testedStudentIds.has(student.id));
    
    // Sort by name
    notTestedStudents.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Display results
    if (notTestedStudents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <p class="empty-state-text">جميع الطلاب اختبروا</p>
          <p class="empty-state-hint">لا يوجد طلاب بدون اختبار في الفترة المحددة</p>
        </div>
      `;
      return;
    }
    
    // Create not-tested students view
    let html = `
      <div class="export-header">
        <button class="export-pdf-btn" onclick="window.exportNotTestedPDF()">
          <span>تصدير PDF</span>
        </button>
      </div>
      <div class="not-tested-header">
        <h4 class="not-tested-title">الطلاب الذين لم يختبروا</h4>
        <span class="not-tested-count">${notTestedStudents.length} طالب</span>
      </div>
      <div class="not-tested-grid">
    `;
    
    notTestedStudents.forEach(student => {
      html += `
        <div class="not-tested-card">
          <div class="not-tested-info">
            <div class="not-tested-name">${student.name}</div>
            <div class="not-tested-teacher">${student.teacherName}</div>
          </div>
          <button class="add-exam-btn" onclick="window.openAddExamForStudent('${student.id}', '${student.name}', '${student.teacherId}')" title="إضافة درجة">
            <span>إضافة درجة</span>
          </button>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading not-tested students:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p class="empty-state-text">حدث خطأ أثناء التحميل</p>
      </div>
    `;
  }
}

/**
 * Open Add Exam Form for Specific Student
 */
window.openAddExamForStudent = function(studentId, studentName, teacherId) {
  // Switch to "add" tab
  const addTab = document.querySelector('[data-exam-tab="add"]');
  if (addTab) addTab.click();
  
  // Pre-fill the form
  setTimeout(() => {
    const teacherSelect = document.getElementById('examTeacherSelect');
    const studentSelect = document.getElementById('examStudentSelect');
    
    if (teacherSelect) {
      teacherSelect.value = teacherId;
      // Trigger change to load students
      teacherSelect.dispatchEvent(new Event('change'));
      
      // Wait for students to load, then select the student
      setTimeout(() => {
        if (studentSelect) {
          studentSelect.value = studentId;
        }
      }, 500);
    }
  }, 100);
};

/**
 * Export Monthly Exams to PDF
 */
window.exportMonthlyExamsPDF = async function() {
  if (filteredExams.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  
  // Group exams by teacher
  const examsByTeacher = {};
  filteredExams.forEach(exam => {
    const teacherId = exam.teacherId;
    const teacherName = exam.teacherName || allTeachers[teacherId] || 'غير محدد';
    
    if (!examsByTeacher[teacherId]) {
      examsByTeacher[teacherId] = {
        teacherName: teacherName,
        students: []
      };
    }
    
    examsByTeacher[teacherId].students.push({
      name: exam.studentName,
      score: exam.score,
      date: exam.hijriDate,
      scope: exam.examScope || '-'
    });
  });
  
  // Sort students by name within each teacher
  Object.values(examsByTeacher).forEach(teacher => {
    teacher.students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  });
  
  // Get filter info for title
  const monthFilter = document.getElementById('filterExamMonth')?.value;
  const teacherFilter = document.getElementById('filterExamTeacher')?.value;
  let filterTitle = 'جميع الاختبارات';
  
  if (monthFilter) {
    const [year, month] = monthFilter.split('-');
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const monthName = hijriMonths[parseInt(month) - 1];
    filterTitle = `${monthName} ${year} هـ`;
  }
  
  // Create PDF content
  let pdfHTML = `
    <div id="pdfExportContent" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: white;">
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #667eea; padding-bottom: 20px;">
        <h1 style="margin: 0 0 10px 0; color: #1f2937; font-size: 28px;">تقرير الاختبارات الشهرية</h1>
        <p style="margin: 0; color: #6b7280; font-size: 16px;">${filterTitle}</p>
        <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 13px;">تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</p>
      </div>
  `;
  
  // Create table for each teacher
  Object.entries(examsByTeacher).forEach(([teacherId, teacherData]) => {
    pdfHTML += `
      <div style="margin-bottom: 40px; page-break-inside: avoid;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; font-size: 18px; font-weight: 700;">
          المعلم: ${teacherData.teacherName}
        </div>
        <table style="width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: #374151;">#</th>
              <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: 700; color: #374151;">اسم الطالب</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: #374151;">الدرجة</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: #374151;">المقدار</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: #374151;">التاريخ</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    teacherData.students.forEach((student, index) => {
      const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const scoreColor = student.score >= 90 ? '#10b981' : student.score >= 75 ? '#3b82f6' : student.score >= 60 ? '#f59e0b' : '#ef4444';
      
      pdfHTML += `
        <tr style="background: ${rowBg};">
          <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; color: #6b7280;">${index + 1}</td>
          <td style="padding: 10px; text-align: right; border: 1px solid #e5e7eb; color: #1f2937; font-weight: 600;">${student.name}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; font-weight: 700; color: ${scoreColor}; font-size: 16px;">${student.score}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; color: #6b7280;">${student.scope}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">${student.date}</td>
        </tr>
      `;
    });
    
    // Add summary row
    const avgScore = (teacherData.students.reduce((sum, s) => sum + s.score, 0) / teacherData.students.length).toFixed(2);
    pdfHTML += `
          </tbody>
          <tfoot>
            <tr style="background: #f3f4f6; font-weight: 700;">
              <td colspan="2" style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; color: #374151;">المجموع: ${teacherData.students.length} طالب</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; color: #667eea; font-size: 16px;">${avgScore}</td>
              <td colspan="2" style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; color: #6b7280;">المعدل</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  });
  
  pdfHTML += '</div>';
  
  // Add to document temporarily
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = pdfHTML;
  document.body.appendChild(tempDiv);
  
  // Generate PDF using html2canvas
  try {
    const content = document.getElementById('pdfExportContent');
    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF with jsPDF from window object
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297; // A4 height in mm
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }
    
    // Save PDF
    const fileName = `monthly-exams-${filterTitle.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    pdf.save(fileName);
    
    // Remove temporary div
    document.body.removeChild(tempDiv);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('حدث خطأ أثناء إنشاء ملف PDF');
    document.body.removeChild(tempDiv);
  }
};

/**
 * Export Not-Tested Students to PDF
 */
window.exportNotTestedPDF = async function() {
  const container = document.getElementById('examsTableContainer');
  if (!container) return;
  
  // Get filter info
  const monthFilter = document.getElementById('filterExamMonth')?.value;
  const teacherFilter = document.getElementById('filterExamTeacher')?.value;
  
  let filterTitle = 'الطلاب الذين لم يختبروا';
  if (monthFilter) {
    const [year, month] = monthFilter.split('-');
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const monthName = hijriMonths[parseInt(month) - 1];
    filterTitle += ` - ${monthName} ${year} هـ`;
  }
  
  // Get students from current view
  const notTestedCards = container.querySelectorAll('.not-tested-card');
  if (notTestedCards.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }
  
  // Extract data from cards
  const students = [];
  notTestedCards.forEach(card => {
    const name = card.querySelector('.not-tested-name')?.textContent || '';
    const teacher = card.querySelector('.not-tested-teacher')?.textContent || '';
    students.push({ name, teacher });
  });
  
  // Group by teacher
  const byTeacher = {};
  students.forEach(student => {
    if (!byTeacher[student.teacher]) {
      byTeacher[student.teacher] = [];
    }
    byTeacher[student.teacher].push(student.name);
  });
  
  // Create PDF content
  let pdfHTML = `
    <div id="pdfNotTestedContent" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; background: white;">
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 3px solid #ffc107; padding-bottom: 20px;">
        <h1 style="margin: 0 0 10px 0; color: #1f2937; font-size: 28px;">${filterTitle}</h1>
        <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 13px;">تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</p>
      </div>
  `;
  
  Object.entries(byTeacher).forEach(([teacher, studentNames]) => {
    pdfHTML += `
      <div style="margin-bottom: 30px; page-break-inside: avoid;">
        <div style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; font-size: 18px; font-weight: 700;">
          المعلم: ${teacher} (${studentNames.length} طالب)
        </div>
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    `;
    
    studentNames.forEach((name, index) => {
      pdfHTML += `
        <div style="padding: 10px; border-bottom: 1px solid #f3f4f6; color: #1f2937;">
          ${index + 1}. ${name}
        </div>
      `;
    });
    
    pdfHTML += '</div></div>';
  });
  
  pdfHTML += '</div>';
  
  // Generate PDF
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = pdfHTML;
  document.body.appendChild(tempDiv);
  
  try {
    const content = document.getElementById('pdfNotTestedContent');
    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF with jsPDF from window object
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
    }
    
    const fileName = `not-tested-students-${Date.now()}.pdf`;
    pdf.save(fileName);
    
    document.body.removeChild(tempDiv);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('حدث خطأ أثناء إنشاء ملف PDF');
    document.body.removeChild(tempDiv);
  }
};

/**
 * Open Exam Details Modal
 */
window.openExamDetails = function(examId) {
  const exam = filteredExams.find(e => e.id === examId);
  if (!exam) return;
  
  // Format Hijri Date
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
  
  // Create modal HTML
  const modalHTML = `
    <div class="exam-details-overlay" onclick="window.closeExamDetails()">
      <div class="exam-details-modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">📋 تفاصيل الاختبار</h3>
          <button class="modal-close-btn" onclick="window.closeExamDetails()">
            <span>✕</span>
          </button>
        </div>
        
        <div class="modal-content">
          <div class="exam-detail-row">
            <span class="detail-label">🧑‍🎓 الطالب</span>
            <span class="detail-value">${exam.studentName}</span>
          </div>
          
          <div class="exam-detail-row">
            <span class="detail-label">👨‍🏫 المعلم</span>
            <span class="detail-value">${exam.teacherName}</span>
          </div>
          
          <div class="exam-detail-row">
            <span class="detail-label">📅 التاريخ</span>
            <span class="detail-value">${dateStr}</span>
          </div>
          
          <div class="exam-detail-row">
            <span class="detail-label">📖 مقدار الاختبار</span>
            <span class="detail-value">${exam.examScope}</span>
          </div>
          
          <div class="exam-detail-row highlight">
            <span class="detail-label">🎯 الدرجة</span>
            <span class="detail-value ${scoreClass}">${exam.score} / 100</span>
          </div>
          
          <div class="exam-detail-row full-width">
            <span class="detail-label">📝 الملاحظات</span>
            <p class="detail-notes">${exam.notes || 'لا توجد ملاحظات'}</p>
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="modal-action-btn edit-btn" onclick="window.openEditExam('${exam.id}')">
            <span class="btn-icon">✏️</span>
            <span>تعديل</span>
          </button>
          <button class="modal-action-btn delete-btn" onclick="window.confirmDeleteExam('${exam.id}')">
            <span class="btn-icon">🗑️</span>
            <span>حذف</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to body
  const modalContainer = document.createElement('div');
  modalContainer.id = 'examDetailsModal';
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);
  
  // Trigger animation
  setTimeout(() => {
    const overlay = modalContainer.querySelector('.exam-details-overlay');
    const modal = modalContainer.querySelector('.exam-details-modal');
    if (overlay) overlay.classList.add('active');
    if (modal) modal.classList.add('active');
  }, 10);
};

/**
 * Close Exam Details Modal
 */
window.closeExamDetails = function() {
  const modalContainer = document.getElementById('examDetailsModal');
  if (!modalContainer) return;
  
  const overlay = modalContainer.querySelector('.exam-details-overlay');
  const modal = modalContainer.querySelector('.exam-details-modal');
  
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
  
  setTimeout(() => {
    modalContainer.remove();
  }, 300);
};

/**
 * Open Edit Exam Form
 */
window.openEditExam = function(examId) {
  const exam = filteredExams.find(e => e.id === examId);
  if (!exam) return;
  
  // Close details modal
  window.closeExamDetails();
  
  // Create edit form modal
  const editModalHTML = `
    <div class="exam-details-overlay active" onclick="window.closeEditExam()">
      <div class="exam-details-modal active" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">✏️ تعديل الاختبار</h3>
          <button class="modal-close-btn" onclick="window.closeEditExam()">
            <span>✕</span>
          </button>
        </div>
        
        <div class="modal-content">
          <form id="editExamForm" class="edit-exam-form">
            <div class="form-field">
              <label class="form-label">🧑‍🎓 الطالب</label>
              <input type="text" value="${exam.studentName}" disabled class="form-input disabled">
            </div>
            
            <div class="form-field">
              <label class="form-label">📖 مقدار الاختبار</label>
              <input type="text" id="editExamScope" value="${exam.examScope}" class="form-input" required>
            </div>
            
            <div class="form-field">
              <label class="form-label">🎯 الدرجة (من 100)</label>
              <input type="number" id="editExamScore" value="${exam.score}" min="0" max="100" class="form-input" required>
            </div>
            
            <div class="form-field">
              <label class="form-label">📝 الملاحظات</label>
              <textarea id="editExamNotes" class="form-textarea" rows="3">${exam.notes || ''}</textarea>
            </div>
            
            <div id="editFormMessage" class="form-message" style="display: none;"></div>
          </form>
        </div>
        
        <div class="modal-actions">
          <button class="modal-action-btn cancel-btn" onclick="window.closeEditExam()">
            <span>إلغاء</span>
          </button>
          <button class="modal-action-btn save-btn" onclick="window.saveEditExam('${exam.id}')">
            <span class="btn-icon">💾</span>
            <span>حفظ التعديلات</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  const editModalContainer = document.createElement('div');
  editModalContainer.id = 'editExamModal';
  editModalContainer.innerHTML = editModalHTML;
  document.body.appendChild(editModalContainer);
};

/**
 * Close Edit Exam Modal
 */
window.closeEditExam = function() {
  const modalContainer = document.getElementById('editExamModal');
  if (!modalContainer) return;
  
  const overlay = modalContainer.querySelector('.exam-details-overlay');
  const modal = modalContainer.querySelector('.exam-details-modal');
  
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
  
  setTimeout(() => {
    modalContainer.remove();
  }, 300);
};

/**
 * Save Edit Exam
 */
window.saveEditExam = async function(examId) {
  const scope = document.getElementById('editExamScope')?.value.trim();
  const score = parseFloat(document.getElementById('editExamScore')?.value);
  const notes = document.getElementById('editExamNotes')?.value.trim();
  const messageDiv = document.getElementById('editFormMessage');
  
  if (!scope || isNaN(score) || score < 0 || score > 100) {
    messageDiv.textContent = '⚠️ يرجى ملء جميع الحقول بشكل صحيح';
    messageDiv.className = 'form-message error';
    messageDiv.style.display = 'block';
    return;
  }
  
  try {
    const examRef = doc(db, 'monthlyExams', examId);
    await updateDoc(examRef, {
      examScope: scope,
      score: score,
      notes: notes,
      updatedAt: new Date()
    });
    
    // Update local data
    const examIndex = allExams.findIndex(e => e.id === examId);
    if (examIndex !== -1) {
      allExams[examIndex].examScope = scope;
      allExams[examIndex].score = score;
      allExams[examIndex].notes = notes;
    }
    
    // Re-filter and display
    filterExams();
    
    messageDiv.textContent = '✅ تم حفظ التعديلات بنجاح';
    messageDiv.className = 'form-message success';
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      window.closeEditExam();
    }, 1500);
    
  } catch (error) {
    console.error('Error updating exam:', error);
    messageDiv.textContent = '❌ حدث خطأ أثناء الحفظ';
    messageDiv.className = 'form-message error';
    messageDiv.style.display = 'block';
  }
};

/**
 * Confirm Delete Exam
 */
window.confirmDeleteExam = function(examId) {
  const exam = filteredExams.find(e => e.id === examId);
  if (!exam) return;
  
  // Close details modal
  window.closeExamDetails();
  
  // Create confirmation dialog
  const confirmHTML = `
    <div class="exam-details-overlay active" onclick="window.closeDeleteConfirm()">
      <div class="exam-details-modal confirm-modal active" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">⚠️ تأكيد الحذف</h3>
        </div>
        
        <div class="modal-content">
          <p class="confirm-message">هل أنت متأكد من حذف اختبار:</p>
          <p class="confirm-student-name">🧑‍🎓 ${exam.studentName}</p>
          <p class="confirm-warning">⚠️ لا يمكن التراجع عن هذا الإجراء</p>
        </div>
        
        <div class="modal-actions">
          <button class="modal-action-btn cancel-btn" onclick="window.closeDeleteConfirm()">
            <span>إلغاء</span>
          </button>
          <button class="modal-action-btn delete-confirm-btn" onclick="window.deleteExam('${exam.id}')">
            <span class="btn-icon">🗑️</span>
            <span>تأكيد الحذف</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  const confirmContainer = document.createElement('div');
  confirmContainer.id = 'deleteConfirmModal';
  confirmContainer.innerHTML = confirmHTML;
  document.body.appendChild(confirmContainer);
};

/**
 * Close Delete Confirmation
 */
window.closeDeleteConfirm = function() {
  const modalContainer = document.getElementById('deleteConfirmModal');
  if (!modalContainer) return;
  
  const overlay = modalContainer.querySelector('.exam-details-overlay');
  const modal = modalContainer.querySelector('.exam-details-modal');
  
  if (overlay) overlay.classList.remove('active');
  if (modal) modal.classList.remove('active');
  
  setTimeout(() => {
    modalContainer.remove();
  }, 300);
};

/**
 * Delete Exam
 */
window.deleteExam = async function(examId) {
  try {
    // Delete from Firestore
    await deleteDoc(doc(db, 'monthlyExams', examId));
    
    // Remove from local arrays
    allExams = allExams.filter(e => e.id !== examId);
    filteredExams = filteredExams.filter(e => e.id !== examId);
    
    // Close confirmation modal
    window.closeDeleteConfirm();
    
    // Re-display exams with animation
    displayExams();
    
    // Show success notification
    showNotification('✅ تم حذف الاختبار بنجاح', 'success');
    
  } catch (error) {
    console.error('Error deleting exam:', error);
    showNotification('❌ حدث خطأ أثناء الحذف', 'error');
  }
};

/**
 * Show Notification Toast
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification-toast ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('active'), 10);
  
  setTimeout(() => {
    notification.classList.remove('active');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
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

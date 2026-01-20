// Main JavaScript - Role Selection and Navigation
import { initAdmin } from './admin.js';
import { initTeacher, stopNotificationsListener } from './teacher.js';
import { initViewer, stopViewerNotificationsListener } from './viewer.js';
import { initStudent, stopStudentNotificationsListener } from './student.js';
import { db, collection, getDocs, getDoc, doc, query, where } from '../firebase-config.js';
import { formatAccurateHijriDate, getTodayAccurateHijri } from './accurate-hijri-dates.js';

console.log('✅ Main.js is loading - defining window.selectRole');

// Global role selection function - defined immediately
window.selectRole = function(role) {
  console.log('Selected role:', role);
  
  // Hide role selection
  document.getElementById('roleSelection').style.display = 'none';
  
  // Hide all sections first
  document.getElementById('adminSection').style.display = 'none';
  document.getElementById('teacherSection').style.display = 'none';
  document.getElementById('studentSection').style.display = 'none';
  document.getElementById('viewerSection').style.display = 'none';
  
  if (role === 'admin') {
    // Admin password verification
    const password = prompt('🔒 أدخل كلمة السر للمدير:');
    if (password !== 'admin123') {
      alert('❌ كلمة السر خاطئة!');
      document.getElementById('roleSelection').style.display = 'flex';
      return;
    }
    
    // Save admin session
    sessionStorage.setItem('loggedInAdmin', 'true');
    
    document.getElementById('adminSection').style.display = 'block';
    updateDateTime();
    initAdmin();
  } else if (role === 'teacher') {
    document.getElementById('teacherSection').style.display = 'block';
    document.getElementById('teacherLogin').style.display = 'block';
    document.getElementById('teacherDashboard').style.display = 'none';
  } else if (role === 'student') {
    document.getElementById('studentSection').style.display = 'block';
    document.getElementById('studentLogin').style.display = 'block';
    document.getElementById('studentDashboard').style.display = 'none';
    loadTeachersForStudent(); // Load teachers list
  } else if (role === 'viewer') {
    document.getElementById('viewerSection').style.display = 'block';
    document.getElementById('viewerLogin').style.display = 'block';
    document.getElementById('viewerDashboard').style.display = 'none';
  }
};

// Initialize date and time display with Hijri calendar
function updateDateTime() {
  const now = new Date();
  
  // Get accurate Hijri date
  const hijriData = getTodayAccurateHijri();
  const hijriDateFormatted = formatAccurateHijriDate(hijriData);
  
  // Get day name in Arabic
  const dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(now);
  
  // Get time
  const timeOptions = { 
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  const time = now.toLocaleTimeString('ar-SA', timeOptions);
  
  // Combine: "الأربعاء 13 جمادى الآخرة 1447 هـ - 20:30"
  const fullDateTime = `${dayName} ${hijriDateFormatted} - ${time}`;
  
  // Update all date-time displays
  const adminDateTime = document.getElementById('adminDateTime');
  const teacherDateTime = document.getElementById('teacherDateTime');
  const studentDateTime = document.getElementById('studentDateTime');
  const viewerDateTime = document.getElementById('viewerDateTime');
  
  if (adminDateTime) adminDateTime.textContent = fullDateTime;
  if (teacherDateTime) teacherDateTime.textContent = fullDateTime;
  if (studentDateTime) studentDateTime.textContent = fullDateTime;
  if (viewerDateTime) viewerDateTime.textContent = fullDateTime;
}

// Update time every minute
setInterval(updateDateTime, 60000);

// Show role selection page
window.showRoleSelection = function() {
  document.getElementById('roleSelection').style.display = 'flex';
  document.getElementById('adminSection').style.display = 'none';
  document.getElementById('teacherSection').style.display = 'none';
  document.getElementById('studentSection').style.display = 'none';
  document.getElementById('viewerSection').style.display = 'none';
  document.getElementById('teacherLogin').style.display = 'none';
  document.getElementById('teacherDashboard').style.display = 'none';
  
  const studentLogin = document.getElementById('studentLogin');
  const studentDashboard = document.getElementById('studentDashboard');
  if (studentLogin) studentLogin.style.display = 'none';
  if (studentDashboard) studentDashboard.style.display = 'none';
};

// Logout function
window.logout = function() {
  sessionStorage.clear();
  stopNotificationsListener(); // Stop teacher notifications listener
  stopViewerNotificationsListener(); // Stop viewer notifications listener
  stopStudentNotificationsListener(); // Stop student notifications listener
  window.showRoleSelection();
};

// Load teachers list for student login
async function loadTeachersForStudent() {
  const teacherSelect = document.getElementById('studentTeacherSelect');
  const studentSelect = document.getElementById('studentNameSelect');
  
  // Hard-coded teacher list (same as in teacher login)
  const teachersList = {
    'ABD01': 'عبدالرحمن السيسي',
    'AMR01': 'عامر هوساوي',
    'ANS01': 'الأستاذ أنس',
    'HRT01': 'حارث',
    'JHD01': 'الأستاذ جهاد',
    'JWD01': 'عبدالرحمن جاويد',
    'MZN01': 'الأستاذ مازن',
    'NBL01': 'الأستاذ نبيل',
    'OMR01': 'الأستاذ عمر',
    'OSM01': 'أسامة حبيب',
    'SLM01': 'سلمان رفيق'
  };
  
  try {
    teacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
    
    // Add all teachers to dropdown
    Object.keys(teachersList).forEach(teacherId => {
      const option = document.createElement('option');
      option.value = teacherId;
      option.textContent = teachersList[teacherId];
      teacherSelect.appendChild(option);
    });
    
    // When teacher is selected, load students
    teacherSelect.addEventListener('change', async (e) => {
      const teacherId = e.target.value;
      studentSelect.innerHTML = '<option value="">-- اختر اسمك --</option>';
      
      if (!teacherId) {
        studentSelect.disabled = true;
        return;
      }
      
      try {
        // Teacher ID is the same as classId (e.g., AMR01, ANS01)
        const classId = teacherId;
        
        // Load students in this class
        const studentsSnap = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('classId', '==', classId)
        ));
        
        if (studentsSnap.empty) {
          studentSelect.innerHTML = '<option value="">-- لا يوجد طلاب في هذه الحلقة --</option>';
          studentSelect.disabled = true;
          return;
        }
        
        studentsSnap.forEach(doc => {
          const student = doc.data();
          const option = document.createElement('option');
          option.value = doc.id;
          option.textContent = student.name || doc.id;
          studentSelect.appendChild(option);
        });
        
        studentSelect.disabled = false;
      } catch (error) {
        console.error('Error loading students:', error);
        studentSelect.innerHTML = '<option value="">-- خطأ في تحميل الطلاب --</option>';
        studentSelect.disabled = true;
      }
    });
    
  } catch (error) {
    console.error('Error loading teachers:', error);
    teacherSelect.innerHTML = '<option value="">-- خطأ في تحميل المعلمين --</option>';
  }
}

// Student login function
window.loginStudent = async function() {
  const studentSelect = document.getElementById('studentNameSelect');
  const studentId = studentSelect.value;
  const studentName = studentSelect.options[studentSelect.selectedIndex].text;
  const password = document.getElementById('studentPasswordInput').value;
  const errorDiv = document.getElementById('studentLoginError');
  
  if (!studentId || studentId === '') {
    errorDiv.textContent = 'يرجى اختيار اسمك من القائمة';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (!password) {
    errorDiv.textContent = 'يرجى إدخال الرقم السري';
    errorDiv.style.display = 'block';
    return;
  }
  
  // Validate password
  if (password === 's12345') {
    // Save student info in session
    sessionStorage.setItem('loggedInStudent', studentId);
    sessionStorage.setItem('loggedInStudentName', studentName);
    
    document.getElementById('studentLogin').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'block';
    updateDateTime();
    
    // Initialize student dashboard
    initStudent();
  } else {
    errorDiv.textContent = 'الرقم السري غير صحيح';
    errorDiv.style.display = 'block';
  }
};

// Teacher login function
window.loginTeacher = async function() {
  const teacherSelect = document.getElementById('teacherIdSelect');
  const teacherId = teacherSelect.value;
  const teacherName = teacherSelect.options[teacherSelect.selectedIndex].text;
  const password = document.getElementById('teacherPasswordInput').value;
  const errorDiv = document.getElementById('loginError');
  
  // Teacher names mapping
  const teacherNames = {
    'ABD01': 'عبدالرحمن السيسي',
    'AMR01': 'عامر هوساوي',
    'ANS01': 'الأستاذ أنس',
    'HRT01': 'حارث',
    'JHD01': 'الأستاذ جهاد',
    'JWD01': 'عبدالرحمن جاويد',
    'MZN01': 'الأستاذ مازن',
    'NBL01': 'الأستاذ نبيل',
    'OMR01': 'الأستاذ عمر',
    'OSM01': 'أسامة حبيب',
    'SLM01': 'سلمان رفيق'
  };
  
  if (!teacherId || !password) {
    errorDiv.textContent = 'الرجاء اختيار المعلم وإدخال الرقم السري';
    errorDiv.classList.add('show');
    return;
  }
  
  if (password !== 't12345') {
    errorDiv.textContent = 'الرقم السري غير صحيح';
    errorDiv.classList.add('show');
    return;
  }
  
  // Login successful
  errorDiv.classList.remove('show');
  document.getElementById('teacherLogin').style.display = 'none';
  document.getElementById('teacherDashboard').style.display = 'block';
  document.getElementById('teacherClassDisplay').textContent = teacherId;
  document.getElementById('teacherNameDisplay').textContent = teacherNames[teacherId];
  
  // Update date and time
  updateDateTime();
  
  // Store logged in teacher
  sessionStorage.setItem('loggedInTeacher', teacherId);
  sessionStorage.setItem('loggedInTeacherName', teacherNames[teacherId]);
  
  // Initialize teacher with this class
  initTeacher(teacherId);
  
  // Check if cleanup button should be shown
  if (typeof window.checkCleanupButton === 'function') {
    window.checkCleanupButton();
  }
};

// Teacher logout function
window.logoutTeacher = function() {
  stopNotificationsListener(); // Stop listening for notifications
  sessionStorage.removeItem('loggedInTeacher');
  sessionStorage.removeItem('loggedInTeacherName');
  document.getElementById('teacherIdSelect').value = '';
  document.getElementById('teacherPasswordInput').value = '';
  window.showRoleSelection();
};

// Switch tabs function
window.switchTab = function(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  document.getElementById(tabName + 'Tab').classList.add('active');
  event.target.classList.add('active');
  
  // Save active tab to sessionStorage
  sessionStorage.setItem('activeTab', tabName);
};

// Restore active tab
function restoreActiveTab() {
  const activeTab = sessionStorage.getItem('activeTab');
  if (activeTab) {
    console.log('🔄 Restoring active tab:', activeTab);
    
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // Activate saved tab
    const tabContent = document.getElementById(activeTab + 'Tab');
    if (tabContent) {
      tabContent.classList.add('active');
    }
    
    // Activate corresponding button
    document.querySelectorAll('.tab').forEach(tab => {
      if (tab.getAttribute('onclick')?.includes(`'${activeTab}'`)) {
        tab.classList.add('active');
      }
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  updateDateTime();
  console.log('Main.js loaded successfully');
  
  // Check if user is already logged in and restore their session
  restoreUserSession();
});

// Restore user session on page reload
function restoreUserSession() {
  // Check for Admin session
  const loggedInAdmin = sessionStorage.getItem('loggedInAdmin');
  
  if (loggedInAdmin === 'true') {
    console.log('🔄 Restoring admin session');
    
    // Hide role selection and show admin section
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'block';
    
    // Initialize admin dashboard
    updateDateTime();
    initAdmin();
    
    // Restore active tab after a small delay to ensure DOM is ready
    setTimeout(() => restoreActiveTab(), 100);
    
    return; // Exit early
  }
  
  // Check for Teacher session
  const loggedInTeacher = sessionStorage.getItem('loggedInTeacher');
  const loggedInTeacherName = sessionStorage.getItem('loggedInTeacherName');
  
  if (loggedInTeacher && loggedInTeacherName) {
    console.log('🔄 Restoring teacher session:', loggedInTeacher);
    
    // Hide role selection and show teacher dashboard
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('teacherSection').style.display = 'block';
    document.getElementById('teacherLogin').style.display = 'none';
    document.getElementById('teacherDashboard').style.display = 'block';
    
    // Restore teacher info display
    document.getElementById('teacherClassDisplay').textContent = loggedInTeacher;
    document.getElementById('teacherNameDisplay').textContent = loggedInTeacherName;
    
    // Initialize teacher dashboard
    updateDateTime();
    initTeacher(loggedInTeacher);
    
    if (typeof window.checkCleanupButton === 'function') {
      window.checkCleanupButton();
    }
    
    // Restore active tab after a small delay to ensure DOM is ready
    setTimeout(() => restoreActiveTab(), 100);
    
    return; // Exit early
  }
  
  // Check for Student session
  const loggedInStudent = sessionStorage.getItem('loggedInStudent');
  const loggedInStudentName = sessionStorage.getItem('loggedInStudentName');
  
  if (loggedInStudent && loggedInStudentName) {
    console.log('🔄 Restoring student session:', loggedInStudent);
    
    // Hide role selection and show student dashboard
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('studentSection').style.display = 'block';
    document.getElementById('studentLogin').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'block';
    
    // Initialize student dashboard
    updateDateTime();
    initStudent();
    
    return; // Exit early
  }
  
  // Check for Viewer session
  const loggedInViewer = sessionStorage.getItem('loggedInViewer');
  const loggedInViewerName = sessionStorage.getItem('loggedInViewerName');
  
  if (loggedInViewer && loggedInViewerName) {
    console.log('🔄 Restoring viewer session:', loggedInViewer);
    
    // Hide role selection and show viewer dashboard
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('viewerSection').style.display = 'block';
    document.getElementById('viewerLogin').style.display = 'none';
    document.getElementById('viewerDashboard').style.display = 'block';
    
    // Initialize viewer dashboard
    updateDateTime();
    initViewer();
    
    return; // Exit early
  }
  
  // No session found - show role selection
  console.log('👤 No active session - showing role selection');
  document.getElementById('roleSelection').style.display = 'flex';
}

// ===== Viewer Functions =====

// Viewer login function
window.loginViewer = function() {
  const viewerId = document.getElementById('viewerIdInput').value;
  const password = document.getElementById('viewerPasswordInput').value;
  const errorDiv = document.getElementById('viewerLoginError');
  
  if (!password) {
    errorDiv.textContent = 'الرجاء إدخال الرقم السري';
    errorDiv.style.display = 'block';
    return;
  }
  
  if (password !== 'v12345') {
    errorDiv.textContent = 'الرقم السري غير صحيح';
    errorDiv.style.display = 'block';
    return;
  }
  
  // Login successful
  errorDiv.style.display = 'none';
  document.getElementById('viewerLogin').style.display = 'none';
  document.getElementById('viewerDashboard').style.display = 'block';
  
  // Update date and time
  updateDateTime();
  
  // Initialize viewer
  initViewer();
  
  // Store logged in viewer
  sessionStorage.setItem('loggedInViewer', viewerId);
  sessionStorage.setItem('loggedInViewerName', 'مازن البلوشي');
};

// Show Juz List
window.viewerShowJuzList = function() {
  const displayArea = document.getElementById('viewerDisplayArea');
  
  let html = '<h3 style="color: #667eea; margin: 0 0 20px 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📖 قائمة الأجزاء القرآنية</h3>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">';
  
  for (let i = 1; i <= 30; i++) {
    html += `
      <div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white; text-align: center; box-shadow: 0 3px 8px rgba(0,0,0,0.15);">
        <div style="font-size: 32px; font-weight: bold; margin-bottom: 5px;">${i}</div>
        <div style="font-size: 14px; opacity: 0.9;">الجزء ${i}</div>
      </div>
    `;
  }
  
  html += '</div>';
  displayArea.innerHTML = html;
};

// Show Surah List
window.viewerShowSurahList = async function() {
  const displayArea = document.getElementById('viewerDisplayArea');
  
  // Import quran data
  const { default: surahData } = await import('./quran-data.js');
  
  let html = '<h3 style="color: #667eea; margin: 0 0 20px 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📋 قائمة سور القرآن الكريم</h3>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">';
  
  surahData.forEach((surah, index) => {
    const gradient = index % 3 === 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                     index % 3 === 1 ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' :
                     'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    
    html += `
      <div style="padding: 15px; background: ${gradient}; border-radius: 10px; color: white; box-shadow: 0 3px 8px rgba(0,0,0,0.15);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 20px; font-weight: bold;">${surah.number}</span>
          <span style="font-size: 14px; opacity: 0.9;">${surah.verses} آية</span>
        </div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${surah.name}</div>
        <div style="font-size: 14px; opacity: 0.9;">${surah.englishName}</div>
      </div>
    `;
  });
  
  html += '</div>';
  displayArea.innerHTML = html;
};

// Show Statistics
window.viewerShowStats = function() {
  const displayArea = document.getElementById('viewerDisplayArea');
  
  const stats = [
    { title: 'عدد السور', value: '114', icon: '📋', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { title: 'عدد الأجزاء', value: '30', icon: '📖', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { title: 'عدد الآيات', value: '6236', icon: '📝', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
    { title: 'عدد الأحزاب', value: '60', icon: '📚', color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
    { title: 'السور المكية', value: '86', icon: '🕋', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    { title: 'السور المدنية', value: '28', icon: '🕌', color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)' }
  ];
  
  let html = '<h3 style="color: #667eea; margin: 0 0 20px 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📊 إحصائيات القرآن الكريم</h3>';
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">';
  
  stats.forEach(stat => {
    html += `
      <div style="padding: 25px; background: ${stat.color}; border-radius: 12px; color: white; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
        <div style="font-size: 50px; margin-bottom: 10px;">${stat.icon}</div>
        <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">${stat.value}</div>
        <div style="font-size: 16px; opacity: 0.95;">${stat.title}</div>
      </div>
    `;
  });
  
  html += '</div>';
  
  html += `
    <div style="margin-top: 30px; padding: 25px; background: white; border: 2px solid #667eea; border-radius: 12px;">
      <h4 style="color: #667eea; margin: 0 0 15px 0;">ℹ️ معلومات إضافية</h4>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 10px; border-bottom: 1px solid #eee;">📌 أطول سورة: البقرة (286 آية)</li>
        <li style="padding: 10px; border-bottom: 1px solid #eee;">📌 أقصر سورة: الكوثر (3 آيات)</li>
        <li style="padding: 10px; border-bottom: 1px solid #eee;">📌 عدد الصفحات: 604 صفحة</li>
        <li style="padding: 10px;">📌 عدد الكلمات: تقريباً 77,439 كلمة</li>
      </ul>
    </div>
  `;
  
  displayArea.innerHTML = html;
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Main.js loaded - selectRole is available');
  updateDateTime();
});

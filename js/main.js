// Main JavaScript - Role Selection and Navigation
import { initAdmin } from './admin.js';
import { initTeacher, stopNotificationsListener } from './teacher.js';
import { initViewer, stopViewerNotificationsListener } from './viewer.js';
import { initStudent, stopStudentNotificationsListener } from './student.js';
import { db, collection, getDocs, getDoc, doc, query, where, setDoc, addDoc, serverTimestamp } from '../firebase-config.js';
import { formatAccurateHijriDate, getTodayAccurateHijri } from './accurate-hijri-dates.js';

console.log('✅ Main.js is loading - defining window.selectRole');

// Global role selection function - defined immediately
window.selectRole = function(role) {
  console.log('🎯 ========== selectRole called ==========');
  console.log('🎯 Selected role:', role);
  
  // Hide role selection
  document.getElementById('roleSelection').style.display = 'none';
  
  // Hide all sections first
  document.getElementById('adminSection').style.display = 'none';
  document.getElementById('teacherSection').style.display = 'none';
  document.getElementById('studentSection').style.display = 'none';
  document.getElementById('viewerSection').style.display = 'none';
  
  // Hide new viewer design
  const newViewerDesign = document.getElementById('newViewerDesign');
  console.log('🎯 newViewerDesign element found:', !!newViewerDesign);
  if (newViewerDesign) {
    console.log('🎯 newViewerDesign display BEFORE hiding:', newViewerDesign.style.display);
    newViewerDesign.style.display = 'none';
    console.log('🎯 newViewerDesign display AFTER hiding:', newViewerDesign.style.display);
  } else {
    console.error('❌ newViewerDesign element NOT FOUND!');
  }
  
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
    
    // Initialize new mobile-first design (wait for DOM and modules to load)
    setTimeout(async () => {
      if (window.initNewAdminDesign) {
        await window.initNewAdminDesign();
      } else {
        console.error('❌ initNewAdminDesign not found!');
      }
    }, 100);
  } else if (role === 'teacher') {
    const teacherSection = document.getElementById('teacherSection');
    const teacherLogin = document.getElementById('teacherLogin');
    const teacherDashboard = document.getElementById('teacherDashboard');
    
    console.log('🔍 TEACHER - teacherSection found:', !!teacherSection);
    console.log('🔍 TEACHER - teacherLogin found:', !!teacherLogin);
    console.log('🔍 TEACHER - teacherDashboard found:', !!teacherDashboard);
    
    teacherSection.style.display = 'block';
    teacherLogin.style.display = 'block';
    teacherDashboard.style.display = 'none';
    
    console.log('✅ TEACHER - teacherSection computed display:', window.getComputedStyle(teacherSection).display);
    console.log('✅ TEACHER - teacherSection offsetHeight:', teacherSection.offsetHeight);
    console.log('✅ TEACHER - teacherLogin computed display:', window.getComputedStyle(teacherLogin).display);
    console.log('✅ TEACHER - teacherLogin offsetHeight:', teacherLogin.offsetHeight);
    console.log('✅ TEACHER - teacherLogin offsetWidth:', teacherLogin.offsetWidth);
    
    loadStaffForLogin(); // Load all staff members (teachers + viewers + admins)
  } else if (role === 'student') {
    const studentSection = document.getElementById('studentSection');
    const studentLogin = document.getElementById('studentLogin');
    const studentDashboard = document.getElementById('studentDashboard');
    
    console.log('🔍 studentSection found:', !!studentSection);
    console.log('🔍 studentLogin found:', !!studentLogin);
    console.log('🔍 studentDashboard found:', !!studentDashboard);
    
    studentSection.style.display = 'block';
    studentLogin.style.display = 'block';
    studentDashboard.style.display = 'none';
    
    console.log('✅ studentSection displayed');
    console.log('✅ studentLogin computed display:', window.getComputedStyle(studentLogin).display);
    console.log('✅ studentLogin offsetHeight:', studentLogin.offsetHeight);
    console.log('✅ studentLogin offsetWidth:', studentLogin.offsetWidth);
    
    loadTeachersForStudent(); // Load teachers list
  } else if (role === 'viewer') {
    console.log('🎯 ========== VIEWER ROLE SELECTED ==========');
    
    const viewerSection = document.getElementById('viewerSection');
    const viewerLogin = document.getElementById('viewerLogin');
    const viewerDashboard = document.getElementById('viewerDashboard');
    
    console.log('🔍 viewerSection found:', !!viewerSection);
    console.log('🔍 viewerLogin found:', !!viewerLogin);
    console.log('🔍 viewerDashboard found:', !!viewerDashboard);
    
    viewerSection.style.display = 'block';
    viewerLogin.style.display = 'block';
    viewerDashboard.style.display = 'none';
    
    console.log('✅ viewerSection displayed');
    console.log('✅ viewerLogin computed display:', window.getComputedStyle(viewerLogin).display);
    console.log('✅ viewerLogin offsetHeight:', viewerLogin.offsetHeight);
    console.log('✅ viewerLogin offsetWidth:', viewerLogin.offsetWidth);
    console.log('✅ viewerSection computed display:', window.getComputedStyle(viewerSection).display);
    console.log('✅ viewerSection offsetHeight:', viewerSection.offsetHeight);
    
    // FULL CSS DEBUG
    const vsStyle = window.getComputedStyle(viewerSection);
    console.log('🔍 viewerSection FULL CSS:');
    console.log('  - position:', vsStyle.position);
    console.log('  - top:', vsStyle.top);
    console.log('  - left:', vsStyle.left);
    console.log('  - width:', vsStyle.width);
    console.log('  - height:', vsStyle.height);
    console.log('  - overflow:', vsStyle.overflow);
    console.log('  - visibility:', vsStyle.visibility);
    console.log('  - opacity:', vsStyle.opacity);
    console.log('  - transform:', vsStyle.transform);
    console.log('  - margin:', vsStyle.margin);
    console.log('  - padding:', vsStyle.padding);
    console.log('  - font-size:', vsStyle.fontSize);
    console.log('  - max-width:', vsStyle.maxWidth);
    console.log('  - max-height:', vsStyle.maxHeight);
    
    const vlStyle = window.getComputedStyle(viewerLogin);
    console.log('🔍 viewerLogin FULL CSS:');
    console.log('  - position:', vlStyle.position);
    console.log('  - display:', vlStyle.display);
    console.log('  - width:', vlStyle.width);
    console.log('  - height:', vlStyle.height);
    console.log('  - margin:', vlStyle.margin);
    console.log('  - padding:', vlStyle.padding);
    console.log('  - font-size:', vlStyle.fontSize);
    console.log('  - line-height:', vlStyle.lineHeight);
    console.log('  - max-width:', vlStyle.maxWidth);
    console.log('  - max-height:', vlStyle.maxHeight);
    console.log('  - min-width:', vlStyle.minWidth);
    console.log('  - min-height:', vlStyle.minHeight);
    console.log('  - box-sizing:', vlStyle.boxSizing);
    console.log('  - float:', vlStyle.float);
    console.log('  🚨 scrollHeight:', viewerLogin.scrollHeight);
    console.log('  🚨 scrollWidth:', viewerLogin.scrollWidth);
    console.log('  🚨 clientHeight:', viewerLogin.clientHeight);
    console.log('  🚨 clientWidth:', viewerLogin.clientWidth);
    
    // CHECK CHILDREN
    console.log('🔍 viewerLogin CHILDREN:');
    console.log('  - childNodes count:', viewerLogin.childNodes.length);
    console.log('  - children count:', viewerLogin.children.length);
    
    // FIRST CHILD DEEP ANALYSIS
    if (viewerLogin.children.length > 0) {
      const firstChild = viewerLogin.children[0];
      const fcStyle = window.getComputedStyle(firstChild);
      console.log('🚨 FIRST CHILD (H2) DEEP CSS:');
      console.log('  - tagName:', firstChild.tagName);
      console.log('  - innerHTML:', firstChild.innerHTML.substring(0, 50));
      console.log('  - display:', fcStyle.display);
      console.log('  - width:', fcStyle.width);
      console.log('  - height:', fcStyle.height);
      console.log('  - font-size:', fcStyle.fontSize);
      console.log('  - color:', fcStyle.color);
      console.log('  - float:', fcStyle.float);
      console.log('  - position:', fcStyle.position);
      console.log('  - box-sizing:', fcStyle.boxSizing);
      console.log('  - overflow:', fcStyle.overflow);
      console.log('  - margin:', fcStyle.margin);
      console.log('  - padding:', fcStyle.padding);
      console.log('  - offsetHeight:', firstChild.offsetHeight);
      console.log('  - offsetWidth:', firstChild.offsetWidth);
      console.log('  - scrollHeight:', firstChild.scrollHeight);
      console.log('  - scrollWidth:', firstChild.scrollWidth);
      console.log('  - clientHeight:', firstChild.clientHeight);
      console.log('  - clientWidth:', firstChild.clientWidth);
    }
    
    Array.from(viewerLogin.children).forEach((child, i) => {
      const childStyle = window.getComputedStyle(child);
      console.log(`  [${i}] ${child.tagName}#${child.id || 'no-id'}.${child.className}:`, 
        'display:', childStyle.display,
        'height:', child.offsetHeight,
        'width:', child.offsetWidth);
    });
    
    // CHECK TEST ELEMENT
    const testElements = viewerSection.querySelectorAll('[style*="background: red"]');
    console.log('🚨 TEST ELEMENTS found:', testElements.length);
    if (testElements.length > 0) {
      testElements.forEach((el, i) => {
        console.log(`  TEST[${i}]:`, 'offsetHeight:', el.offsetHeight, 'offsetWidth:', el.offsetWidth);
      });
    }
    
    // Hide new design until login
    const newViewerDesign2 = document.getElementById('newViewerDesign');
    console.log('🎯 Checking newViewerDesign again in viewer section:', !!newViewerDesign2);
    if (newViewerDesign2) {
      console.log('🎯 newViewerDesign2 display BEFORE hiding:', newViewerDesign2.style.display);
      console.log('🎯 newViewerDesign2 computed display BEFORE:', window.getComputedStyle(newViewerDesign2).display);
      newViewerDesign2.style.display = 'none';
      console.log('🎯 newViewerDesign2 display AFTER hiding:', newViewerDesign2.style.display);
      console.log('🎯 newViewerDesign2 computed display AFTER:', window.getComputedStyle(newViewerDesign2).display);
      console.log('🎯 newViewerDesign2 parent element:', newViewerDesign2.parentElement?.id);
      console.log('🎯 newViewerDesign2 classList:', newViewerDesign2.classList.toString());
    } else {
      console.error('❌ newViewerDesign2 element NOT FOUND in viewer section!');
    }
    
    console.log('🎯 ========== END VIEWER ROLE ==========');
  }
};

// Mark that selectRole is ready (for the stub function in index.html)
window.selectRoleReady = true;
console.log('✅ window.selectRole is now ready');

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
  
  // Hide new viewer design
  const newViewerDesign = document.getElementById('newViewerDesign');
  if (newViewerDesign) {
    newViewerDesign.style.display = 'none';
  }
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
// ============================================
// Load all staff (teachers + viewers + admins) for login
// ============================================
window.staffMembersCache = {}; // Global cache for staff members

async function loadStaffForLogin() {
  const staffSelect = document.getElementById('teacherIdSelect');
  
  try {
    staffSelect.innerHTML = '<option value="">🔄 جاري التحميل...</option>';
    
    // Fetch all staff from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    
    if (classesSnapshot.empty) {
      staffSelect.innerHTML = '<option value="">⚠️ لا يوجد موظفين في النظام</option>';
      return;
    }
    
    // Clear cache and rebuild
    window.staffMembersCache = {};
    const staffList = [];
    
    classesSnapshot.forEach(doc => {
      const data = doc.data();
      const staffId = doc.id;
      const staffName = data.teacherName || data.presenterName || data.adminName || data.className || 'بدون اسم';
      const role = data.role || 'غير محدد';
      
      // Store in cache
      window.staffMembersCache[staffId] = {
        name: staffName,
        role: role
      };
      
      // Add to list
      staffList.push({ id: staffId, name: staffName, role: role });
    });
    
    // Sort by name
    staffList.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Populate dropdown
    staffSelect.innerHTML = '<option value="">-- اختر اسمك من القائمة --</option>';
    
    staffList.forEach(staff => {
      const option = document.createElement('option');
      option.value = staff.id;
      
      // Add role icon
      let roleIcon = '';
      if (staff.role === 'teacher') roleIcon = '👨‍🏫';
      else if (staff.role === 'viewer') roleIcon = '👁️';
      else if (staff.role === 'admin') roleIcon = '⚙️';
      else if (staff.role === 'presenter') roleIcon = '🎤';
      
      option.textContent = `${roleIcon} ${staff.name} (${staff.id})`;
      staffSelect.appendChild(option);
    });
    
    console.log('✅ Loaded', staffList.length, 'staff members');
    
  } catch (error) {
    console.error('❌ Error loading staff:', error);
    staffSelect.innerHTML = '<option value="">⚠️ خطأ في تحميل القائمة</option>';
  }
}

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
    'MZB01': 'مازن البلوشي',
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

// Teacher/Staff login function
window.loginTeacher = async function() {
  const staffSelect = document.getElementById('teacherIdSelect');
  const staffId = staffSelect.value;
  const password = document.getElementById('teacherPasswordInput').value;
  const errorDiv = document.getElementById('loginError');
  
  if (!staffId || !password) {
    errorDiv.textContent = 'الرجاء اختيار الاسم وإدخال الرقم السري';
    errorDiv.classList.add('show');
    return;
  }
  
  // Get staff info from cache
  const staffInfo = window.staffMembersCache[staffId];
  if (!staffInfo) {
    errorDiv.textContent = 'خطأ: لم يتم العثور على بيانات الموظف';
    errorDiv.classList.add('show');
    return;
  }
  
  const staffName = staffInfo.name;
  const staffRole = staffInfo.role;
  
  if (password !== 't12345') {
    errorDiv.textContent = 'الرقم السري غير صحيح';
    errorDiv.classList.add('show');
    return;
  }
  
  // Login successful
  errorDiv.classList.remove('show');
  document.getElementById('teacherLogin').style.display = 'none';
  
  // Show NEW design instead of old
  document.getElementById('newTeacherDesign').style.display = 'block';
  document.getElementById('oldTeacherDesign').style.display = 'none';
  
  // Update staff name in header
  const teacherNameHeader = document.getElementById('teacherNameHeader');
  if (teacherNameHeader) {
    teacherNameHeader.textContent = staffName || staffId;
  }
  
  // OLD CODE (preserved but hidden)
  document.getElementById('teacherDashboard').style.display = 'block';
  document.getElementById('teacherClassDisplay').textContent = staffId;
  document.getElementById('teacherNameDisplay').textContent = staffName;
  
  // Update date and time
  updateDateTime();
  
  // Store logged in staff member (using teacher keys for compatibility)
  sessionStorage.setItem('loggedInTeacher', staffId);
  sessionStorage.setItem('loggedInTeacherName', staffName);
  sessionStorage.setItem('loggedInStaffRole', staffRole);
  
  // Initialize staff member with this ID (works for all roles)
  initTeacher(staffId);
  
  // Load home section for new design
  setTimeout(() => {
    if (typeof window.switchTeacherSection === 'function') {
      window.switchTeacherSection('home');
    }
  }, 100);
  
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
  
  // Hide new design
  document.getElementById('newTeacherDesign').style.display = 'none';
  document.getElementById('oldTeacherDesign').style.display = 'none';
  
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
    
    // Hide role selection and teacher login
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('teacherSection').style.display = 'block';
    document.getElementById('teacherLogin').style.display = 'none';
    
    // Show NEW design instead of old
    document.getElementById('newTeacherDesign').style.display = 'block';
    document.getElementById('oldTeacherDesign').style.display = 'none';
    
    // OLD design (preserved but hidden)
    document.getElementById('teacherDashboard').style.display = 'block';
    
    // Restore teacher info in OLD design
    document.getElementById('teacherClassDisplay').textContent = loggedInTeacher;
    document.getElementById('teacherNameDisplay').textContent = loggedInTeacherName;
    
    // Update teacher name in NEW design header
    const teacherNameHeader = document.getElementById('teacherNameHeader');
    if (teacherNameHeader) {
      teacherNameHeader.textContent = loggedInTeacherName;
    }
    
    // Initialize teacher dashboard
    updateDateTime();
    initTeacher(loggedInTeacher);
    
    if (typeof window.checkCleanupButton === 'function') {
      window.checkCleanupButton();
    }
    
    // Load home section for new design
    setTimeout(() => {
      if (typeof window.switchTeacherSection === 'function') {
        window.switchTeacherSection('home');
      }
    }, 100);
    
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
    
    // Hide role selection and show viewer section
    document.getElementById('roleSelection').style.display = 'none';
    document.getElementById('viewerSection').style.display = 'block';
    document.getElementById('viewerLogin').style.display = 'none';
    
    // Show new design
    const newViewerDesign = document.getElementById('newViewerDesign');
    if (newViewerDesign) {
      newViewerDesign.style.display = 'block';
    }
    
    // Update Hijri date
    updateViewerHijriDate();
    
    // Initialize viewer dashboard
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
  
  // Show new design
  document.getElementById('newViewerDesign').style.display = 'block';
  
  // Update Hijri date
  updateViewerHijriDate();
  
  // Initialize viewer
  initViewer();
  
  // Store logged in viewer
  sessionStorage.setItem('loggedInViewer', viewerId);
  sessionStorage.setItem('loggedInViewerName', 'مازن البلوشي');
};

// Update Viewer Hijri Date
function updateViewerHijriDate() {
  const dateText = document.getElementById('viewerHijriDateText');
  if (!dateText) return;
  
  try {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Riyadh'
    });
    dateText.textContent = formatter.format(today);
  } catch (error) {
    console.error('Error formatting Hijri date:', error);
    dateText.textContent = 'التاريخ الهجري';
  }
}

// Switch Viewer Section
window.switchViewerSection = function(section) {
  // Hide all sections
  const sections = document.querySelectorAll('.viewer-main-section');
  sections.forEach(s => s.classList.remove('active-section'));
  
  // Show selected section
  const sectionMap = {
    'home': 'viewerHomeSection',
    'reports': 'viewerReportsSection',
    'register': 'viewerRegisterSection',
    'tasks': 'viewerTasksSection',
    'more': 'viewerMoreSection'
  };
  
  const targetSection = document.getElementById(sectionMap[section]);
  if (targetSection) {
    targetSection.classList.add('active-section');
  }
  
  // Update nav buttons
  const navButtons = document.querySelectorAll('.bottom-nav-bar .nav-item');
  navButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-section') === section) {
      btn.classList.add('active');
    }
  });
  
  // Load section-specific data
  if (section === 'home') {
    // Initialize queue tabs and load first tab (Hizb)
    window.switchQueueType('hizb');
  } else if (section === 'register') {
    // Initialize registration form
    window.switchRegistrationType('hizb');
  } else if (section === 'reports') {
    // Load reports if needed
    if (typeof window.loadViewerReports === 'function') {
      window.loadViewerReports();
    }
  }
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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Main.js loaded - selectRole is available');
  updateDateTime();
  
  // Check if admin was logged in (restore session after page refresh)
  const wasAdminLoggedIn = sessionStorage.getItem('loggedInAdmin');
  if (wasAdminLoggedIn === 'true') {
    console.log('🔄 Restoring admin session after page refresh...');
    
    // Hide role selection
    document.getElementById('roleSelection').style.display = 'none';
    
    // Show admin section
    document.getElementById('adminSection').style.display = 'block';
    
    // Initialize admin
    await initAdmin();
    console.log('✅ initAdmin() completed');
    
    // Initialize new admin design after ensuring everything is ready
    setTimeout(async () => {
      if (window.initNewAdminDesign) {
        console.log('✅ Calling initNewAdminDesign after session restore');
        await window.initNewAdminDesign();
        console.log('✅ initNewAdminDesign() completed');
      } else {
        console.error('❌ initNewAdminDesign not found after session restore!');
      }
    }, 300);
  }
});

// =====================================================
// REGISTRATION SECTION - NEW FUNCTIONS
// =====================================================

/**
 * Switch between registration types (Hizb, Juz, Stage)
 */
window.switchRegistrationType = function(type) {
  console.log('🔄 Switching registration type to:', type);
  
  // Update tab active states
  document.querySelectorAll('.reg-type-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.type === type) {
      tab.classList.add('active');
    }
  });
  
  // Update form visibility
  document.querySelectorAll('.reg-form').forEach(form => {
    form.classList.remove('active');
  });
  
  const activeForm = document.getElementById(`regForm${type.charAt(0).toUpperCase() + type.slice(1)}`);
  if (activeForm) {
    activeForm.classList.add('active');
  }
  
  // Load initial data for the selected form
  initializeRegistrationForm(type);
};

/**
 * Switch Queue Type (Hizb, Juz, Stage)
 */
window.switchQueueType = function(type) {
  console.log('🔄 Switching queue type to:', type);
  
  // Update tab active states
  document.querySelectorAll('.queue-type-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.type === type) {
      tab.classList.add('active');
    }
  });
  
  // Update table visibility
  document.querySelectorAll('.queue-table-container').forEach(container => {
    container.classList.remove('active');
  });
  
  const activeContainer = document.getElementById(`queueTable${type.charAt(0).toUpperCase() + type.slice(1)}`);
  if (activeContainer) {
    activeContainer.classList.add('active');
  }
  
  // Load queue data based on type
  if (type === 'hizb') {
    // Check if hizbQueueContainer is empty or has only loading message
    const hizbContainer = document.getElementById('hizbQueueContainer');
    if (hizbContainer && (hizbContainer.children.length === 0 || 
        hizbContainer.querySelector('.loading-message') || 
        hizbContainer.textContent.includes('جاري تحميل'))) {
      if (typeof window.loadHizbQueue === 'function') {
        window.loadHizbQueue();
      } else {
        console.warn('⚠️ loadHizbQueue function not yet implemented');
        hizbContainer.innerHTML = `
          <div style="text-align: center; padding: 40px 20px;">
            <p style="color: #999; font-size: 15px;">نظام عرض الأحزاب قيد التطوير 🔧</p>
          </div>
        `;
      }
    }
  } else if (type === 'juz') {
    // Load Juz queue if not already loaded
    const juzContainer = document.getElementById('dailyQueueContainer');
    if (juzContainer && (juzContainer.children.length === 0 || 
        juzContainer.textContent.includes('جاري التحميل'))) {
      if (typeof window.loadDailyQueue === 'function') {
        window.loadDailyQueue();
      }
    }
  }
  // Stage tab doesn't need loading (placeholder only)
};

/**
 * Initialize registration form data
 */
async function initializeRegistrationForm(type) {
  console.log('📝 Initializing registration form for:', type);
  
  // Load teachers
  await loadTeachersForRegistration(type);
  
  // Load Hizb numbers (1-60)
  if (type === 'hizb') {
    loadHizbNumbers();
  }
  
  // Load Juz numbers (1-30)
  if (type === 'juz') {
    loadJuzNumbersForReg();
  }
  
  // Load Hijri date dropdowns (smart + auto-fill today's date)
  await loadHijriDateDropdowns(type);
}

/**
 * Load teachers into registration form
 */
async function loadTeachersForRegistration(type) {
  const selectId = `reg${type.charAt(0).toUpperCase() + type.slice(1)}Teacher`;
  const teacherSelect = document.getElementById(selectId);
  
  if (!teacherSelect) return;
  
  const teachersList = {
    'ABD01': 'عبدالرحمن السيسي',
    'AMR01': 'عامر هوساوي',
    'ANS01': 'الأستاذ أنس',
    'HRT01': 'حارث',
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
  
  Object.keys(teachersList).forEach(teacherId => {
    const option = document.createElement('option');
    option.value = teacherId;
    option.textContent = teachersList[teacherId];
    teacherSelect.appendChild(option);
  });
}

/**
 * Load students when teacher is selected
 */
window.loadStudentsForReg = async function(type) {
  const teacherSelectId = `reg${type.charAt(0).toUpperCase() + type.slice(1)}Teacher`;
  const studentSelectId = `reg${type.charAt(0).toUpperCase() + type.slice(1)}Student`;
  
  const teacherId = document.getElementById(teacherSelectId)?.value;
  const studentSelect = document.getElementById(studentSelectId);
  
  if (!teacherId || !studentSelect) {
    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">-- اختر المعلم أولاً --</option>';
    }
    return;
  }
  
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
 * Load Hizb numbers (1-60)
 */
function loadHizbNumbers() {
  const hizbSelect = document.getElementById('regHizbNumber');
  if (!hizbSelect) return;
  
  hizbSelect.innerHTML = '<option value="">-- اختر الحزب --</option>';
  
  for (let i = 1; i <= 60; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `الحزب ${i}`;
    hizbSelect.appendChild(option);
  }
}

/**
 * Load Juz numbers (1-30)
 */
function loadJuzNumbersForReg() {
  const juzSelect = document.getElementById('regJuzNumber');
  if (!juzSelect) return;
  
  juzSelect.innerHTML = '<option value="">-- اختر الجزء --</option>';
  
  for (let i = 1; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `الجزء ${i}`;
    juzSelect.appendChild(option);
  }
}

/**
 * Load stages dynamically based on selected pathway
 */
window.loadStagesByPathway = async function() {
  const pathwaySelect = document.getElementById('regStagePathway');
  const stageSelect = document.getElementById('regStageLevel');
  
  if (!pathwaySelect || !stageSelect) return;
  
  const pathway = pathwaySelect.value;
  
  if (!pathway) {
    stageSelect.innerHTML = '<option value="">-- اختر المسار أولاً --</option>';
    return;
  }
  
  try {
    // Import marahil data
    const { getMarahilByPathway } = await import('./quran-marahil.js');
    const marahil = getMarahilByPathway(pathway);
    
    stageSelect.innerHTML = '<option value="">-- اختر المرحلة --</option>';
    
    marahil.forEach(marhalah => {
      const option = document.createElement('option');
      option.value = marhalah.id;
      option.textContent = `${marhalah.icon} ${marhalah.description} (${marhalah.juzCount} أجزاء)`;
      stageSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading stages:', error);
    stageSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
  }
};

/**
 * Load Hijri date dropdowns (Day, Month, Year) - SMART version from accurateHijriDates
 */
async function loadHijriDateDropdowns(type) {
  const prefix = `reg${type.charAt(0).toUpperCase() + type.slice(1)}`;
  
  const daySelect = document.getElementById(`${prefix}Day`);
  const monthSelect = document.getElementById(`${prefix}Month`);
  const yearSelect = document.getElementById(`${prefix}Year`);
  
  if (!daySelect || !monthSelect || !yearSelect) return;
  
  try {
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    
    // Extract unique months and years from accurateHijriDates
    const uniqueMonths = new Set();
    const uniqueYears = new Set();
    const monthYearCombinations = new Map(); // Store month-year pairs with their names
    
    accurateHijriDates.forEach(entry => {
      uniqueMonths.add(entry.hijriMonth);
      uniqueYears.add(entry.hijriYear);
      const key = `${entry.hijriYear}-${entry.hijriMonth}`;
      if (!monthYearCombinations.has(key)) {
        monthYearCombinations.set(key, {
          month: entry.hijriMonth,
          year: entry.hijriYear
        });
      }
    });
    
    // Load days (1-30)
    daySelect.innerHTML = '<option value="">اليوم</option>';
    for (let i = 1; i <= 30; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i;
      daySelect.appendChild(option);
    }
    
    // Load months - only available ones
    monthSelect.innerHTML = '<option value="">الشهر</option>';
    const monthNames = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    
    // Sort months and add them
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => a - b);
    sortedMonths.forEach(monthNum => {
      const option = document.createElement('option');
      option.value = monthNum;
      option.textContent = `${monthNum} - ${monthNames[monthNum - 1]}`;
      monthSelect.appendChild(option);
    });
    
    // Load years - only available ones
    yearSelect.innerHTML = '<option value="">السنة</option>';
    const sortedYears = Array.from(uniqueYears).sort((a, b) => a - b);
    sortedYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
    
    // After loading dropdowns, load today's date automatically
    await setTodayDateForReg(type);
    
  } catch (error) {
    console.error('Error loading smart Hijri date dropdowns:', error);
    
    // Fallback: Load basic options
    daySelect.innerHTML = '<option value="">اليوم</option>';
    for (let i = 1; i <= 30; i++) {
      daySelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    monthSelect.innerHTML = '<option value="">الشهر</option>';
    for (let i = 1; i <= 12; i++) {
      monthSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    yearSelect.innerHTML = '<option value="">السنة</option>';
    for (let i = 1447; i <= 1448; i++) {
      yearSelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
  }
}

/**
 * Set today's Hijri date in the form
 */
window.setTodayDateForReg = async function(type) {
  const prefix = `reg${type.charAt(0).toUpperCase() + type.slice(1)}`;
  
  try {
    const { getTodayAccurateHijri } = await import('./accurate-hijri-dates.js');
    const today = getTodayAccurateHijri();
    
    if (today) {
      // today is an object with: hijriDay, hijriMonth, hijriYear
      const day = today.hijriDay;
      const month = today.hijriMonth;
      const year = today.hijriYear;
      
      const daySelect = document.getElementById(`${prefix}Day`);
      const monthSelect = document.getElementById(`${prefix}Month`);
      const yearSelect = document.getElementById(`${prefix}Year`);
      
      if (daySelect) daySelect.value = day;
      if (monthSelect) monthSelect.value = month;
      if (yearSelect) yearSelect.value = year;
      
      console.log(`✅ تم تعيين التاريخ الهجري: ${day}/${month}/${year}`);
    }
  } catch (error) {
    console.error('Error setting today date:', error);
    alert('خطأ في تعيين تاريخ اليوم');
  }
};

/**
 * Save Hizb Registration
 */
window.saveHizbRegistration = async function() {
  const teacherId = document.getElementById('regHizbTeacher')?.value;
  const studentId = document.getElementById('regHizbStudent')?.value;
  const hizbNumber = parseInt(document.getElementById('regHizbNumber')?.value);
  const day = document.getElementById('regHizbDay')?.value;
  const month = document.getElementById('regHizbMonth')?.value;
  const year = document.getElementById('regHizbYear')?.value;
  
  const messageBox = document.getElementById('regHizbMessage');
  
  // Validation
  if (!teacherId || !studentId || !hizbNumber || !day || !month || !year) {
    messageBox.textContent = '⚠️ يرجى ملء جميع الحقول';
    messageBox.className = 'reg-message error';
    messageBox.style.display = 'block';
    return;
  }
  
  const hijriDate = `${year}-${month}-${day}`; // Format: YYYY-MM-DD for storage
  
  try {
    // Get student and teacher names
    const teacherSelect = document.getElementById('regHizbTeacher');
    const studentSelect = document.getElementById('regHizbStudent');
    const teacherName = teacherSelect.options[teacherSelect.selectedIndex]?.text || 'غير محدد';
    const studentName = studentSelect.options[studentSelect.selectedIndex]?.text || 'غير محدد';
    
    console.log('💾 Saving Hizb registration:', {
      studentId, studentName, teacherId, teacherName, hizbNumber, hijriDate
    });
    
    // Create hizbDisplay document for display queue
    const hizbDisplayData = {
      studentId: studentId,
      studentName: studentName,
      teacherId: teacherId,
      teacherName: teacherName,
      hizbNumber: hizbNumber,
      lastLessonDate: hijriDate,
      lastAttemptDate: null,
      displayDate: '', // Empty until viewer completes
      viewerName: '',
      viewerId: '',
      status: 'incomplete',
      failedAttempts: [],
      notes: [],
      createdAt: serverTimestamp(),
      createdFromRegistration: true
    };
    
    // Save to Firestore hizbDisplays collection
    await addDoc(collection(db, 'hizbDisplays'), hizbDisplayData);
    
    console.log('✅ Hizb display created successfully');
    
    messageBox.textContent = `✅ تم حفظ تسجيل الحزب ${hizbNumber} بنجاح وإضافته لجدول العرض`;
    messageBox.className = 'reg-message success';
    messageBox.style.display = 'block';
    
    // Reload Hizb queue if it's visible
    if (typeof window.loadHizbQueue === 'function') {
      setTimeout(() => window.loadHizbQueue(), 500);
    }
    
    // Clear form after 2 seconds
    setTimeout(() => {
      document.getElementById('regHizbStudent').value = '';
      document.getElementById('regHizbNumber').value = '';
      document.getElementById('regHizbDay').value = '';
      document.getElementById('regHizbMonth').value = '';
      document.getElementById('regHizbYear').value = '';
      messageBox.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error saving Hizb registration:', error);
    messageBox.textContent = '❌ خطأ في حفظ التسجيل: ' + error.message;
    messageBox.className = 'reg-message error';
    messageBox.style.display = 'block';
  }
};

/**
 * Save Juz Registration
 */
window.saveJuzRegistration = async function() {
  const teacherId = document.getElementById('regJuzTeacher')?.value;
  const studentId = document.getElementById('regJuzStudent')?.value;
  const juzNumber = parseInt(document.getElementById('regJuzNumber')?.value);
  const day = document.getElementById('regJuzDay')?.value;
  const month = document.getElementById('regJuzMonth')?.value;
  const year = document.getElementById('regJuzYear')?.value;
  
  const messageBox = document.getElementById('regJuzMessage');
  
  // Validation
  if (!teacherId || !studentId || !juzNumber || !day || !month || !year) {
    messageBox.textContent = '⚠️ يرجى ملء جميع الحقول';
    messageBox.className = 'reg-message error';
    messageBox.style.display = 'block';
    return;
  }
  
  const hijriDate = `${year}-${month}-${day}`; // Format: YYYY-MM-DD for storage
  
  try {
    // Get student and teacher names
    const teacherSelect = document.getElementById('regJuzTeacher');
    const studentSelect = document.getElementById('regJuzStudent');
    const teacherName = teacherSelect.options[teacherSelect.selectedIndex]?.text || 'غير محدد';
    const studentName = studentSelect.options[studentSelect.selectedIndex]?.text || 'غير محدد';
    
    console.log('💾 Saving Juz registration:', {
      studentId, studentName, teacherId, teacherName, juzNumber, hijriDate
    });
    
    // Create juzDisplay document for display queue
    const juzDisplayData = {
      studentId: studentId,
      studentName: studentName,
      teacherId: teacherId,
      teacherName: teacherName,
      juzNumber: juzNumber,
      lastLessonDate: hijriDate,
      lastAttemptDate: null,
      displayDate: '', // Empty until viewer completes
      viewerName: '',
      viewerId: '',
      status: 'incomplete',
      failedAttempts: [],
      notes: [],
      createdAt: serverTimestamp(),
      createdFromRegistration: true
    };
    
    // Save to Firestore juzDisplays collection
    await addDoc(collection(db, 'juzDisplays'), juzDisplayData);
    
    console.log('✅ Juz display created successfully');
    
    messageBox.textContent = `✅ تم حفظ تسجيل الجزء ${juzNumber} بنجاح وإضافته لجدول العرض`;
    messageBox.className = 'reg-message success';
    messageBox.style.display = 'block';
    
    // Reload Juz queue if it's visible
    if (typeof window.loadDailyQueue === 'function') {
      setTimeout(() => window.loadDailyQueue(), 500);
    }
    
    // Clear form after 2 seconds
    setTimeout(() => {
      document.getElementById('regJuzStudent').value = '';
      document.getElementById('regJuzNumber').value = '';
      document.getElementById('regJuzDay').value = '';
      document.getElementById('regJuzMonth').value = '';
      document.getElementById('regJuzYear').value = '';
      messageBox.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error saving Juz registration:', error);
    messageBox.textContent = '❌ خطأ في حفظ التسجيل: ' + error.message;
    messageBox.className = 'reg-message error';
    messageBox.style.display = 'block';
  }
};

/**
 * Save Stage Registration
 */
window.saveStageRegistration = async function() {
  const teacherId = document.getElementById('regStageTeacher')?.value;
  const studentId = document.getElementById('regStageStudent')?.value;
  const pathway = document.getElementById('regStagePathway')?.value;
  const stageId = document.getElementById('regStageLevel')?.value;
  const day = document.getElementById('regStageDay')?.value;
  const month = document.getElementById('regStageMonth')?.value;
  const year = document.getElementById('regStageYear')?.value;
  
  const messageBox = document.getElementById('regStageMessage');
  
  // Validation
  if (!teacherId || !studentId || !pathway || !stageId || !day || !month || !year) {
    messageBox.textContent = '⚠️ يرجى ملء جميع الحقول';
    messageBox.className = 'reg-message error';
    return;
  }
  
  const hijriDate = `${day}-${month}-${year}`;
  
  try {
    // Get stage info
    const { getMarhalahById } = await import('./quran-marahil.js');
    const marhalah = getMarhalahById(stageId);
    
    // Save to Firestore
    messageBox.textContent = `✅ تم حفظ تسجيل ${marhalah.title} بنجاح`;
    messageBox.className = 'reg-message success';
    
    // Clear form after 2 seconds
    setTimeout(() => {
      document.getElementById('regStageStudent').value = '';
      document.getElementById('regStagePathway').value = '';
      document.getElementById('regStageLevel').value = '';
      document.getElementById('regStageDay').value = '';
      document.getElementById('regStageMonth').value = '';
      document.getElementById('regStageYear').value = '';
      messageBox.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('Error saving Stage registration:', error);
    messageBox.textContent = '❌ خطأ في حفظ التسجيل';
    messageBox.className = 'reg-message error';
  }
};

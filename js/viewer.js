// Viewer Section JavaScript
import { 
  db, 
  collection, 
  getDocs,
  getDoc,
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot
} from '../firebase-config.js';

import { getTodayForStorage, getCurrentHijriDate, formatHijriDate, getHijriDayName } from './hijri-date.js';
import { accurateHijriDates, gregorianToAccurateHijri, accurateHijriToGregorian } from './accurate-hijri-dates.js';

let viewerNotificationsListener = null;

// ============================================
// VIEWERS LIST - قائمة العارضين
// ============================================
const VIEWERS_LIST = [
  'مازن البلوشي',
  'بدر بن عفيف',
  'محمد عثمان',
  'سليمان موسى',
  'فيض مهاجر',
  'إبراهيم الطارقي'
];

// Show viewer selection popup
async function selectViewerName(defaultViewer = 'مازن البلوشي') {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'viewerSelectionOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10001;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    `;
    
    // Build options HTML
    let optionsHTML = '';
    VIEWERS_LIST.forEach(viewer => {
      const isDefault = viewer === defaultViewer;
      optionsHTML += `
        <div class="viewer-option" data-viewer="${viewer}" style="
          padding: 12px 20px;
          background: ${isDefault ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa'};
          color: ${isDefault ? 'white' : '#333'};
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          font-size: 15px;
          font-weight: ${isDefault ? 'bold' : 'normal'};
          transition: all 0.2s;
          border: 2px solid ${isDefault ? '#667eea' : '#dee2e6'};
        ">
          ${isDefault ? '✅ ' : ''}${viewer}
        </div>
      `;
    });
    
    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 15px;
        padding: 25px;
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        direction: rtl;
      ">
        <style>
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .viewer-option:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
        </style>
        
        <h2 style="color: #667eea; margin: 0 0 20px 0; text-align: center; font-size: 20px;">
          👤 اختر اسم العارض
        </h2>
        
        <div id="viewersContainer">
          ${optionsHTML}
        </div>
        
        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #f0f0f0;">
          <div class="viewer-option" data-viewer="other" style="
            padding: 12px 20px;
            background: #6c757d;
            color: white;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
            font-weight: bold;
            text-align: center;
            transition: all 0.2s;
            border: 2px solid #6c757d;
          ">
            ➕ آخر (إدخال يدوي)
          </div>
        </div>
        
        <button onclick="this.closest('#viewerSelectionOverlay').remove()" style="
          width: 100%;
          padding: 10px;
          margin-top: 15px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
        ">
          ❌ إلغاء
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Handle option clicks
    overlay.querySelectorAll('.viewer-option').forEach(option => {
      option.addEventListener('click', function() {
        const selectedViewer = this.getAttribute('data-viewer');
        
        if (selectedViewer === 'other') {
          // Manual input
          const customName = prompt('📝 أدخل اسم العارض:');
          if (customName && customName.trim()) {
            overlay.remove();
            resolve(customName.trim());
          }
        } else {
          overlay.remove();
          resolve(selectedViewer);
        }
      });
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null); // User cancelled
      }
    });
  });
}

// Get today's Hijri date in YYYY-MM-DD format (accurate)
window.getTodayHijriAccurate = function() {
  return getTodayForStorage(); // Returns accurate format: YYYY-MM-DD
};

// Get today's Hijri date in DD-MM-YYYY format (for inline buttons) - DEPRECATED
window.getTodayHijriSimple = function() {
  const accurate = getTodayForStorage(); // YYYY-MM-DD
  const [year, month, day] = accurate.split('-');
  return `${day}-${month}-${year}`; // Convert to DD-MM-YYYY for old format
};

// Format date for display: convert YYYY-MM-DD to DD-MM-YYYY
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  // Check if already in DD-MM-YYYY format
  if (parseInt(parts[0]) < 32 && parseInt(parts[2]) > 1000) {
    return dateStr; // Already in DD-MM-YYYY
  }
  
  // Convert YYYY-MM-DD to DD-MM-YYYY
  if (parseInt(parts[0]) > 1000) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  
  return dateStr;
}

// Initialize viewer section
export async function initViewer() {
  await loadViewerTeachers();
  populateJuzNumbers();
  startViewerNotificationsListener();
  await loadDailyQueue(); // Load daily queue on init
}

// Populate Juz numbers (1-30)
function populateJuzNumbers() {
  const juzSelect = document.getElementById('viewerJuzNumber');
  juzSelect.innerHTML = '<option value="">-- اختر الجزء --</option>';
  
  for (let i = 1; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `الجزء ${i}`;
    juzSelect.appendChild(option);
  }
}

// Load teachers list
async function loadViewerTeachers() {
  const teacherSelect = document.getElementById('viewerTeacherSelect');
  const reportTeacherSelect = document.getElementById('viewerReportTeacherSelect');
  
  teacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
  reportTeacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
  
  const teachers = {
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
  
  for (const [id, name] of Object.entries(teachers)) {
    const option1 = document.createElement('option');
    option1.value = id;
    option1.textContent = `${id} - ${name}`;
    teacherSelect.appendChild(option1);
    
    const option2 = document.createElement('option');
    option2.value = id;
    option2.textContent = `${id} - ${name}`;
    reportTeacherSelect.appendChild(option2);
  }
}

// Load students by selected teacher
window.loadStudentsByTeacher = async function() {
  const teacherId = document.getElementById('viewerTeacherSelect').value;
  const studentSelect = document.getElementById('viewerStudentSelect');
  
  studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>';
  
  if (!teacherId) {
    studentSelect.innerHTML = '<option value="">-- اختر المعلم أولاً --</option>';
    return;
  }
  
  console.log('Loading students for teacher:', teacherId);
  
  try {
    // Get students from users collection where classId matches teacherId
    const q = query(
      collection(db, 'users'), 
      where('role', '==', 'student'),
      where('classId', '==', teacherId)
    );
    const studentsSnap = await getDocs(q);
    
    console.log('Found students:', studentsSnap.size);
    
    if (studentsSnap.empty) {
      studentSelect.innerHTML = '<option value="">-- لا يوجد طلاب لهذا المعلم --</option>';
      return;
    }
    
    const students = [];
    studentsSnap.forEach(studentDoc => {
      const student = studentDoc.data();
      students.push({
        id: studentDoc.id,
        name: student.name || '(بدون اسم)'
      });
    });
    
    // Sort by student ID
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    // Add students to select
    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      option.dataset.classId = teacherId;
      option.textContent = `${student.id} — ${student.name}`;
      studentSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelect.innerHTML = '<option value="">-- خطأ في تحميل الطلاب --</option>';
  }
};

// Show/Hide tabs
window.showViewerTab = function(tab) {
  const newJuzTab = document.getElementById('viewerTabNewJuz');
  const reportsTab = document.getElementById('viewerTabReports');
  const newJuzBtn = document.getElementById('tabNewJuz');
  const reportsBtn = document.getElementById('tabReports');
  
  if (tab === 'newJuz') {
    newJuzTab.style.display = 'block';
    reportsTab.style.display = 'none';
    newJuzBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    newJuzBtn.style.color = 'white';
    newJuzBtn.style.border = 'none';
    reportsBtn.style.background = 'white';
    reportsBtn.style.color = '#667eea';
    reportsBtn.style.border = '2px solid #667eea';
  } else {
    newJuzTab.style.display = 'none';
    reportsTab.style.display = 'block';
    reportsBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    reportsBtn.style.color = 'white';
    reportsBtn.style.border = 'none';
    newJuzBtn.style.background = 'white';
    newJuzBtn.style.color = '#667eea';
    newJuzBtn.style.border = '2px solid #667eea';
  }
};

// Save new Juz display registration
window.saveNewJuzDisplay = async function() {
  const studentSelect = document.getElementById('viewerStudentSelect');
  const teacherId = document.getElementById('viewerTeacherSelect').value;
  const juzNumber = document.getElementById('viewerJuzNumber').value;
  let lastLessonDate = document.getElementById('viewerLastLessonDate').value.trim();
  let displayDate = document.getElementById('viewerDisplayDate').value.trim();
  const viewerName = document.getElementById('viewerName').value; // Get selected viewer name
  const messageDiv = document.getElementById('viewerNewJuzMessage');
  
  // Validation
  if (!studentSelect.value || !teacherId || !juzNumber || !lastLessonDate) {
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#ffebee';
    messageDiv.style.color = '#c62828';
    messageDiv.textContent = '❌ يرجى ملء جميع الحقول المطلوبة';
    return;
  }
  
  // Normalize dates to YYYY-MM-DD format
  const normalizedLastLessonDate = normalizeDateFormat(lastLessonDate);
  if (!normalizedLastLessonDate) {
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#ffebee';
    messageDiv.style.color = '#c62828';
    messageDiv.textContent = '❌ صيغة تاريخ آخر درس غير صحيحة. استخدم: DD-MM-YYYY (مثال: 5-6-1447)';
    return;
  }
  
  let normalizedDisplayDate = null;
  if (displayDate) {
    normalizedDisplayDate = normalizeDateFormat(displayDate);
    if (!normalizedDisplayDate) {
      messageDiv.style.display = 'block';
      messageDiv.style.background = '#ffebee';
      messageDiv.style.color = '#c62828';
      messageDiv.textContent = '❌ صيغة تاريخ العرض غير صحيحة. استخدم: DD-MM-YYYY (مثال: 7-6-1447)';
      return;
    }
  }
  
  const studentId = studentSelect.value;
  const studentName = studentSelect.options[studentSelect.selectedIndex].text;
  
  // Get teacher name from select
  const teacherSelect = document.getElementById('viewerTeacherSelect');
  const teacherName = teacherSelect.options[teacherSelect.selectedIndex].text.split(' - ')[1] || 'غير محدد';
  
  try {
    // Generate unique ID
    const reportId = `JUZ_${studentId}_${juzNumber}_${Date.now()}`;
    
    // Save to Firebase
    await setDoc(doc(db, 'juzDisplays', reportId), {
      studentId: studentId,
      studentName: studentName,
      teacherId: teacherId,
      teacherName: teacherName,
      juzNumber: parseInt(juzNumber),
      lastLessonDate: normalizedLastLessonDate, // Stored in YYYY-MM-DD format
      displayDate: normalizedDisplayDate || null,
      viewerName: viewerName, // Use selected viewer name
      viewerId: 'MZNBL01',
      createdAt: serverTimestamp(),
      status: normalizedDisplayDate ? 'completed' : 'incomplete'
    });
    
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#e8f5e9';
    messageDiv.style.color = '#2e7d32';
    messageDiv.textContent = '✅ تم حفظ التسجيل بنجاح!';
    
    // Reload daily queue
    await loadDailyQueue();
    
    // Clear form
    document.getElementById('viewerStudentSelect').value = '';
    document.getElementById('viewerTeacherSelect').value = '';
    document.getElementById('viewerJuzNumber').value = '';
    document.getElementById('viewerLastLessonDate').value = '';
    document.getElementById('viewerDisplayDate').value = '';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
    
  } catch (error) {
    console.error('Error saving:', error);
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#ffebee';
    messageDiv.style.color = '#c62828';
    messageDiv.textContent = '❌ حدث خطأ أثناء الحفظ';
  }
};

// Load students by teacher for reports
window.loadViewerStudentsByTeacher = async function() {
  const teacherId = document.getElementById('viewerReportTeacherSelect').value;
  const studentSelect = document.getElementById('viewerReportStudentSelect');
  
  studentSelect.innerHTML = '<option value="">-- جاري التحميل... --</option>';
  document.getElementById('viewerReportsContainer').innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">اختر الطالب لعرض التقارير</p>';
  
  if (!teacherId) return;
  
  try {
    console.log('🔍 Loading students for teacher:', teacherId);
    const startTime = performance.now();
    
    // Get students from users collection where classId matches teacherId
    const studentsQuery = query(
      collection(db, 'users'), 
      where('role', '==', 'student'),
      where('classId', '==', teacherId)
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    if (studentsSnap.empty) {
      studentSelect.innerHTML = '<option value="">-- لا يوجد طلاب لهذا المعلم --</option>';
      return;
    }
    
    // Get ALL juzDisplays for this teacher in ONE query (much faster!)
    const juzQuery = query(
      collection(db, 'juzDisplays'),
      where('teacherId', '==', teacherId)
    );
    const allJuzSnap = await getDocs(juzQuery);
    
    // Create a map of studentId -> juz reports for quick lookup
    const studentJuzMap = new Map();
    allJuzSnap.forEach(doc => {
      const data = doc.data();
      const studentId = data.studentId;
      
      if (!studentJuzMap.has(studentId)) {
        studentJuzMap.set(studentId, []);
      }
      
      studentJuzMap.get(studentId).push({
        juzNumber: data.juzNumber,
        status: data.status,
        displayDate: data.displayDate
      });
    });
    
    console.log(`📊 Total juzDisplays loaded: ${allJuzSnap.size}`);
    
    // Process students
    const students = [];
    studentsSnap.forEach(studentDoc => {
      const student = studentDoc.data();
      const studentId = studentDoc.id;
      
      // Check if student has incomplete Juz displays
      let hasIncomplete = false;
      const studentJuzReports = studentJuzMap.get(studentId) || [];
      
      for (const report of studentJuzReports) {
        if (!report.displayDate || report.displayDate === '' || report.status === 'incomplete') {
          hasIncomplete = true;
          break;
        }
      }
      
      students.push({
        id: studentId,
        name: student.name || '(بدون اسم)',
        hasIncomplete: hasIncomplete
      });
    });
    
    // Sort by student ID
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    // Clear and repopulate select
    studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>';
    
    // Add students to select with indicator for incomplete Juz
    students.forEach(student => {
      const option = document.createElement('option');
      option.value = student.id;
      
      // Add red indicator 🔴 if student has incomplete Juz display
      const indicator = student.hasIncomplete ? '🔴 ' : '';
      option.textContent = `${indicator}${student.id} — ${student.name}`;
      
      // Add special styling for incomplete students
      if (student.hasIncomplete) {
        option.style.color = '#dc3545';
        option.style.fontWeight = 'bold';
      }
      
      studentSelect.appendChild(option);
    });
    
    const endTime = performance.now();
    console.log(`✅ Students loaded in ${Math.round(endTime - startTime)}ms`);
    console.log(`📊 Total students: ${students.length}`);
    
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelect.innerHTML = '<option value="">-- خطأ في تحميل الطلاب --</option>';
  }
};

// Load Juz reports for selected student
window.loadViewerJuzReports = async function() {
  const teacherId = document.getElementById('viewerReportTeacherSelect').value;
  const studentId = document.getElementById('viewerReportStudentSelect').value;
  const container = document.getElementById('viewerReportsContainer');
  
  if (!teacherId || !studentId) return;
  
  // Show loading
  container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 40px;"><span style="font-size: 40px;">⏳</span><br>جاري تحميل التقارير...</p>';
  
  try {
    const startTime = performance.now();
    
    const q = query(
      collection(db, 'juzDisplays'),
      where('teacherId', '==', teacherId),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    
    const endTime = performance.now();
    console.log(`✅ Reports loaded in ${Math.round(endTime - startTime)}ms`);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد تقارير لهذا الطالب</p>';
      return;
    }
    
    let html = '';
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const reportId = docSnapshot.id;
      
      // Format dates for display (convert YYYY-MM-DD to DD-MM-YYYY for easier reading)
      const displayLastLessonDate = data.lastLessonDate ? formatDateForDisplay(data.lastLessonDate) : 'غير محدد';
      const displayDateValue = data.displayDate ? formatDateForDisplay(data.displayDate) : '';
      
      // Calculate duration if both dates exist
      let durationHtml = '';
      let durationDays = 0;
      if (data.lastLessonDate && data.displayDate) {
        durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
        const durationColor = durationDays <= 7 ? '#28a745' : durationDays <= 14 ? '#ffc107' : '#dc3545';
        durationHtml = `
          <div>
            <strong style="color: #667eea;">المدة المستغرقة:</strong>
            <div style="margin-top: 5px; padding: 8px; background: ${durationColor}; color: white; border-radius: 5px; text-align: center; font-weight: bold;">
              ⏱️ ${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}
            </div>
          </div>
        `;
      }
      
      // Display attempts count if exists
      let attemptsHtml = '';
      if (data.attemptsCount) {
        const attemptsColor = data.attemptsCount === 1 ? '#28a745' : data.attemptsCount === 2 ? '#ffc107' : '#dc3545';
        attemptsHtml = `
          <div>
            <strong style="color: #667eea;">عدد مرات التسميع:</strong>
            <div style="margin-top: 5px; padding: 8px; background: ${attemptsColor}; color: white; border-radius: 5px; text-align: center; font-weight: bold;">
              🔄 ${data.attemptsCount} ${data.attemptsCount === 1 ? 'مرة' : data.attemptsCount === 2 ? 'مرتان' : 'مرات'}
            </div>
          </div>
        `;
      }
      
      // Action buttons (only show if display date exists)
      let actionButtonsHtml = '';
      if (data.displayDate) {
        actionButtonsHtml = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
            <button onclick="window.sendReportToTeacher('${reportId}')" 
              style="padding: 12px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
              📤 إرسال للمعلم
            </button>
            <button onclick="window.shareReport('${reportId}')" 
              style="padding: 12px; background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
              📋 مشاركة التقرير
            </button>
          </div>
        `;
      }
      
      html += `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 15px; border: 2px solid #dee2e6;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <strong style="color: #667eea;">الجزء:</strong> ${data.juzNumber}
            </div>
            <div>
              <strong style="color: #667eea;">تاريخ آخر درس:</strong> ${displayLastLessonDate}
            </div>
            <div>
              <strong style="color: #667eea;">تاريخ العرض:</strong>
              <div style="display: flex; gap: 5px; margin-top: 5px;">
                <input type="text" id="displayDate_${reportId}" value="${displayDateValue}" placeholder="DD-MM-YYYY"
                  style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; text-align: center;">
                <button onclick="window.setTodayHijriDate('${reportId}')" 
                  style="padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; white-space: nowrap;">
                  📅 اليوم
                </button>
              </div>
              <small style="color: #666; font-size: 11px; display: block; margin-top: 3px;">مثال: 5-6-1447 (اليوم-الشهر-السنة)</small>
            </div>
            <div>
              <strong style="color: #667eea;">الحالة:</strong> 
              <span style="padding: 5px 15px; border-radius: 20px; background: ${data.status === 'completed' ? '#28a745' : '#ffc107'}; color: white; font-weight: bold;">
                ${data.status === 'completed' ? '✅ مكتمل' : '⏳ معلق'}
              </span>
            </div>
            ${durationHtml}
            ${attemptsHtml}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 15px;">
            <button onclick="window.updateJuzDisplayDate('${reportId}')" 
              style="padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
              💾 حفظ التحديثات
            </button>
            <button onclick="window.editJuzReport('${reportId}')" 
              style="padding: 12px; background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
              ✏️ تعديل
            </button>
            <button onclick="window.deleteJuzReport('${reportId}')" 
              style="padding: 12px; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
              🗑️ حذف
            </button>
          </div>
          ${actionButtonsHtml}
          <div id="reportMessage_${reportId}" style="margin-top: 10px; padding: 10px; border-radius: 5px; display: none;"></div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading reports:', error);
    container.innerHTML = '<p style="text-align: center; color: #f44336; padding: 40px;">حدث خطأ في تحميل التقارير</p>';
  }
};

// Set today's Hijri date in DD-MM-YYYY format using ACCURATE calendar
window.setTodayHijriDate = function(reportId) {
  const today = new Date();
  
  // Use accurate Hijri calendar conversion
  const accurateHijri = gregorianToAccurateHijri(today);
  const hijriDateYMD = accurateHijri.hijri; // YYYY-MM-DD format
  
  // Convert YYYY-MM-DD to DD-MM-YYYY for display
  const parts = hijriDateYMD.split('-');
  const hijriDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  
  document.getElementById(`displayDate_${reportId}`).value = hijriDate;
  
  console.log('✅ Set accurate Hijri date:', {
    gregorian: today.toISOString().split('T')[0],
    hijriYMD: hijriDateYMD,
    hijriDisplay: hijriDate,
    dayName: accurateHijri.dayName
  });
};

// Normalize date format: accepts DD-MM-YYYY or YYYY-MM-DD, returns YYYY-MM-DD
function normalizeDateFormat(dateStr) {
  if (!dateStr) return null;
  
  // Handle Arabic formatted dates (e.g., "٦ جمادى الآخرة ١٤٤٧ هـ")
  if (dateStr.includes('هـ') || dateStr.includes('جمادى') || dateStr.includes('رجب') || /[\u0660-\u0669]/.test(dateStr)) {
    console.warn('⚠️ Arabic date format detected, cannot parse:', dateStr);
    return null;
  }
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  let normalizedDate = null;
  
  // Check if it's DD-MM-YYYY (day < 32 and year > 1000)
  if (parseInt(parts[0]) < 32 && parseInt(parts[2]) > 1000) {
    // Convert DD-MM-YYYY to YYYY-MM-DD
    normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  // Already in YYYY-MM-DD format
  else if (parseInt(parts[0]) > 1000) {
    normalizedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  
  // Verify date exists in accurate calendar
  if (normalizedDate) {
    const dateExists = accurateHijriDates.some(entry => entry.hijri === normalizedDate);
    if (!dateExists) {
      console.warn(`⚠️ Date ${normalizedDate} not found in accurate calendar!`);
      // Still return it but log warning
    }
  }
  
  return normalizedDate;
}

// Calculate difference in days between two Hijri dates
// Both dates should be in Hijri YYYY-MM-DD format (e.g., "1447-06-05")
function calculateHijriDaysDifference(date1Str, date2Str) {
  try {
    console.log('🔍 Calculating duration (Accurate Hijri):', { date1Str, date2Str });
    
    // Normalize both dates to YYYY-MM-DD format
    const normalizedDate1 = normalizeDateFormat(date1Str);
    const normalizedDate2 = normalizeDateFormat(date2Str);
    
    console.log('📅 Normalized dates:', { normalizedDate1, normalizedDate2 });
    
    if (!normalizedDate1 || !normalizedDate2) {
      console.error('❌ Invalid date format');
      return 0;
    }
    
    // Find dates in accurate calendar
    const entry1 = accurateHijriDates.find(e => e.hijri === normalizedDate1);
    const entry2 = accurateHijriDates.find(e => e.hijri === normalizedDate2);
    
    if (!entry1 || !entry2) {
      console.warn('⚠️ Date not found in accurate calendar, using approximation');
      // Fallback to approximation if date not in calendar
      const [year1, month1, day1] = normalizedDate1.split('-').map(Number);
      const [year2, month2, day2] = normalizedDate2.split('-').map(Number);
      const days1 = (year1 * 354.36) + ((month1 - 1) * 29.53) + day1;
      const days2 = (year2 * 354.36) + ((month2 - 1) * 29.53) + day2;
      return Math.abs(Math.round(days2 - days1));
    }
    
    // Use accurate Gregorian dates for precise calculation
    const gregorian1 = new Date(entry1.gregorian + 'T12:00:00');
    const gregorian2 = new Date(entry2.gregorian + 'T12:00:00');
    
    // Calculate difference in milliseconds, then convert to days
    const diffInMs = Math.abs(gregorian2 - gregorian1);
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
    
    console.log('⏱️ Accurate duration calculation:', {
      hijri1: entry1.hijri,
      gregorian1: entry1.gregorian,
      hijri2: entry2.hijri,
      gregorian2: entry2.gregorian,
      durationDays: diffInDays
    });
    
    return diffInDays;
  } catch (error) {
    console.error('❌ Error calculating date difference:', error);
    return 0;
  }
}

// Update Juz display date
window.updateJuzDisplayDate = async function(reportId) {
  let displayDate = document.getElementById(`displayDate_${reportId}`).value.trim();
  
  if (!displayDate) {
    alert('يرجى إدخال تاريخ العرض أو الضغط على زر "اليوم"');
    return;
  }
  
  // Normalize date format to YYYY-MM-DD for storage
  const normalizedDate = normalizeDateFormat(displayDate);
  
  if (!normalizedDate) {
    alert('❌ صيغة التاريخ غير صحيحة!\nالرجاء استخدام: DD-MM-YYYY\nمثال: 5-6-1447');
    return;
  }
  
  try {
    // Get current report data to calculate attempts
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    const currentData = reportDoc.data();
    const currentAttempts = currentData.attemptsCount || 0;
    const failedAttempts = currentData.failedAttempts || [];
    
    // Calculate total attempts = 1 (current success) + failed attempts
    const totalAttempts = failedAttempts.length + 1;
    
    await updateDoc(doc(db, 'juzDisplays', reportId), {
      displayDate: normalizedDate, // Store in YYYY-MM-DD format
      status: 'completed',
      attemptsCount: totalAttempts,
      updatedAt: serverTimestamp()
    });
    
    alert('✅ تم تحديث التاريخ بنجاح!');
    
    // Reload daily queue (student removed from queue)
    await loadDailyQueue();
    
    // Reload reports to show updated duration
    const teacherId = document.getElementById('viewerReportTeacherSelect').value;
    const studentId = document.getElementById('viewerReportStudentSelect').value;
    if (teacherId && studentId) {
      loadViewerJuzReports();
    }
  } catch (error) {
    console.error('Error updating display date:', error);
    alert('❌ حدث خطأ في تحديث التاريخ');
  }
};

// Send report to teacher (save notification in Firebase)
window.sendReportToTeacher = async function(reportId) {
  try {
    // Get report data
    const reportDoc = await getDocs(query(collection(db, 'juzDisplays'), where('__name__', '==', reportId)));
    if (reportDoc.empty) {
      alert('❌ لم يتم العثور على التقرير');
      return;
    }
    
    const data = reportDoc.docs[0].data();
    
    // Verify display date exists
    if (!data.displayDate) {
      alert('⚠️ يرجى إضافة تاريخ العرض أولاً');
      return;
    }
    
    // Calculate duration
    const durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
    const durationText = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
    
    // Get failed attempts count
    const attemptCount = (data.failedAttempts && data.failedAttempts.length) || 0;
    const totalAttempts = attemptCount + 1; // Include the final successful attempt
    
    // Create notification message
    const notificationMessage = `🎉 رسالة اجتياز\n\n✅ الطالب: ${data.studentName}\n👨‍🏫 المعلم: ${data.teacherName || 'غير محدد'}\n📖 الجزء: ${data.juzNumber}\n📅 تاريخ العرض: ${data.displayDate}\n⏱️ المدة المستغرقة: ${durationText}\n👤 العارض: ${data.viewerName}\n🔄 عدد مرات التسميع: ${totalAttempts}`;
    
    console.log('📤 Sending notification:', {
      teacherId: data.teacherId,
      studentId: data.studentId,
      teacherName: data.teacherName,
      message: notificationMessage
    });
    
    const notificationData = {
      type: 'juz_passed',
      teacherId: data.teacherId,
      studentId: data.studentId,
      studentName: data.studentName,
      teacherName: data.teacherName || 'غير محدد',
      juzNumber: data.juzNumber,
      displayDate: data.displayDate,
      duration: durationText,
      viewerName: data.viewerName,
      viewerId: data.viewerId || 'MZNBL01',
      totalAttempts: totalAttempts,
      message: notificationMessage,
      createdAt: serverTimestamp(),
      read: false
    };
    
    // Save to teacherNotifications collection
    await setDoc(doc(collection(db, 'teacherNotifications')), notificationData);
    console.log('✅ Teacher notification saved');
    
    // Save to studentNotifications collection (for the student)
    await setDoc(doc(collection(db, 'studentNotifications')), {
      ...notificationData,
      studentId: data.studentId
    });
    console.log('✅ Student notification saved for studentId:', data.studentId);
    
    // Show success message
    const messageDiv = document.getElementById(`reportMessage_${reportId}`);
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#d4edda';
    messageDiv.style.color = '#155724';
    messageDiv.style.border = '1px solid #c3e6cb';
    messageDiv.innerHTML = '✅ تم إرسال التقرير للمعلم والطالب بنجاح!';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
    
  } catch (error) {
    console.error('Error sending report:', error);
    alert('❌ حدث خطأ في إرسال التقرير');
  }
};

// Share report (copy to clipboard)
window.shareReport = async function(reportId) {
  try {
    // Get report data
    const reportDoc = await getDocs(query(collection(db, 'juzDisplays'), where('__name__', '==', reportId)));
    if (reportDoc.empty) {
      alert('❌ لم يتم العثور على التقرير');
      return;
    }
    
    const data = reportDoc.docs[0].data();
    
    // Verify display date exists
    if (!data.displayDate) {
      alert('⚠️ يرجى إضافة تاريخ العرض أولاً');
      return;
    }
    
    // Calculate duration
    const durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
    const durationText = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
    
    // Get failed attempts count
    const attemptCount = (data.failedAttempts && data.failedAttempts.length) || 0;
    const totalAttempts = attemptCount + 1; // Include the final successful attempt
    
    // Create shareable text
    const shareText = `━━━━━━━━━━━━━━━━━━━━
🎉 رسالة اجتياز
━━━━━━━━━━━━━━━━━━━━

✅ الطالب: ${data.studentName}
👨‍🏫 المعلم: ${data.teacherName || 'غير محدد'}
📖 الجزء: ${data.juzNumber}
📅 تاريخ العرض: ${data.displayDate}
⏱️ المدة المستغرقة: ${durationText}
👤 العارض: ${data.viewerName}
🔄 عدد مرات التسميع: ${totalAttempts}`;
    
    // Save notification for teacher
    await setDoc(doc(collection(db, 'teacherNotifications')), {
      type: 'juz_shared',
      teacherId: data.teacherId,
      studentId: data.studentId,
      studentName: data.studentName,
      teacherName: data.teacherName || 'غير محدد',
      juzNumber: data.juzNumber,
      displayDate: data.displayDate,
      duration: durationText,
      viewerName: data.viewerName,
      totalAttempts: totalAttempts,
      message: shareText,
      createdAt: serverTimestamp(),
      read: false
    });
    
    // Save notification for student
    await setDoc(doc(collection(db, 'studentNotifications')), {
      type: 'juz_shared',
      studentId: data.studentId,
      teacherId: data.teacherId,
      studentName: data.studentName,
      teacherName: data.teacherName || 'غير محدد',
      juzNumber: data.juzNumber,
      displayDate: data.displayDate,
      duration: durationText,
      viewerName: data.viewerName,
      totalAttempts: totalAttempts,
      message: shareText,
      createdAt: serverTimestamp(),
      read: false
    });
    
    // Copy to clipboard
    await navigator.clipboard.writeText(shareText);
    
    // Show success message
    const messageDiv = document.getElementById(`reportMessage_${reportId}`);
    messageDiv.style.display = 'block';
    messageDiv.style.background = '#d1ecf1';
    messageDiv.style.color = '#0c5460';
    messageDiv.style.border = '1px solid #bee5eb';
    messageDiv.innerHTML = '📋 تم نسخ التقرير وإرساله للمعلم والطالب!';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 3000);
    
  } catch (error) {
    console.error('Error sharing report:', error);
    alert('❌ حدث خطأ في نسخ التقرير');
  }
};

// ============================================
// VIEWER INBOX NOTIFICATIONS SYSTEM
// ============================================

// Start real-time listener for viewer notifications
function startViewerNotificationsListener() {
  try {
    const q = query(
      collection(db, 'viewerNotifications'),
      where('read', '==', false)
    );
    
    // Real-time listener
    viewerNotificationsListener = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      updateViewerInboxBadge(count);
    });
  } catch (error) {
    console.error('Error starting viewer notifications listener:', error);
  }
}

// Update viewer inbox badge count
function updateViewerInboxBadge(count) {
  const badge = document.getElementById('viewerInboxBadge');
  const btn = document.getElementById('viewerInboxBtn');
  
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
    btn.style.animation = 'pulse 1.5s infinite';
  } else {
    badge.style.display = 'none';
    btn.style.animation = 'none';
  }
}

// Toggle viewer inbox modal
window.toggleViewerInbox = async function() {
  const modal = document.getElementById('viewerInboxModal');
  const isVisible = modal.style.display === 'block';
  
  if (isVisible) {
    modal.style.display = 'none';
  } else {
    modal.style.display = 'block';
    await loadViewerNotifications();
  }
};

// Load and display viewer notifications
async function loadViewerNotifications() {
  const container = document.getElementById('viewerInboxNotificationsList');
  
  try {
    const q = query(
      collection(db, 'viewerNotifications'),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد إشعارات جديدة</p>';
      return;
    }
    
    let html = '';
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const notificationId = docSnapshot.id;
      
      // Format timestamp
      let dateStr = 'الآن';
      if (data.createdAt && data.createdAt.toDate) {
        const date = data.createdAt.toDate();
        dateStr = date.toLocaleString('ar-SA', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      html += `
        <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 20px; border-radius: 10px; margin-bottom: 15px; border-right: 5px solid #ff9800; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <div>
              <span style="background: #ff9800; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">🎊 إنجاز جديد</span>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">⏰ ${dateStr}</p>
            </div>
            <button onclick="window.markViewerNotificationAsRead('${notificationId}')" style="background: #999; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.3s;">
              ✓ تم القراءة
            </button>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; white-space: pre-line; line-height: 1.8; color: #333; margin-bottom: 15px;">
            ${data.message || ''}
          </div>
          
          <button onclick="window.registerFromNotification('${data.studentId}', '${data.studentName}', '${data.teacherId}', '${data.teacherName}', ${data.juzNumber}, '${data.completionDate}', '${notificationId}')" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px;">
            ✅ تسجيل الطالب للعرض
          </button>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading viewer notifications:', error);
    container.innerHTML = '<p style="text-align: center; color: #f44336; padding: 40px;">حدث خطأ في تحميل الإشعارات</p>';
  }
}

// Mark viewer notification as read
window.markViewerNotificationAsRead = async function(notificationId) {
  try {
    await deleteDoc(doc(db, 'viewerNotifications', notificationId));
    await loadViewerNotifications();
    
    const tempMsg = document.createElement('div');
    tempMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #28a745; color: white; padding: 20px 40px; border-radius: 10px; font-weight: bold; z-index: 10000; box-shadow: 0 5px 20px rgba(0,0,0,0.3);';
    tempMsg.textContent = '✅ تم وضع علامة كمقروء';
    document.body.appendChild(tempMsg);
    
    setTimeout(() => tempMsg.remove(), 2000);
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
    alert('❌ حدث خطأ في تحديث الإشعار');
  }
};

// Edit Juz Report (allow editing all fields)
window.editJuzReport = async function(reportId) {
  try {
    // Get current report data
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ لم يتم العثور على التقرير');
      return;
    }
    
    const data = reportDoc.data();
    
    // Format dates for display
    const lastLessonDate = data.lastLessonDate ? formatDateForDisplay(data.lastLessonDate) : '';
    const displayDate = data.displayDate ? formatDateForDisplay(data.displayDate) : '';
    
    // Ask for new values (or keep current)
    const newJuzNumber = prompt('🔢 رقم الجزء:', data.juzNumber);
    if (!newJuzNumber) return; // User cancelled
    
    const newLastLessonDate = prompt('📅 تاريخ آخر درس (DD-MM-YYYY):', lastLessonDate);
    if (!newLastLessonDate) return;
    
    const newDisplayDate = prompt('📅 تاريخ العرض (DD-MM-YYYY) - اتركه فارغاً إذا لم يتم العرض بعد:', displayDate);
    
    // Normalize dates
    const normalizedLastLesson = normalizeDateFormat(newLastLessonDate);
    if (!normalizedLastLesson) {
      alert('❌ صيغة تاريخ آخر درس غير صحيحة!');
      return;
    }
    
    let normalizedDisplay = null;
    let newStatus = 'incomplete';
    if (newDisplayDate && newDisplayDate.trim() !== '') {
      normalizedDisplay = normalizeDateFormat(newDisplayDate);
      if (!normalizedDisplay) {
        alert('❌ صيغة تاريخ العرض غير صحيحة!');
        return;
      }
      newStatus = 'completed';
    }
    
    // Update in Firebase
    await updateDoc(doc(db, 'juzDisplays', reportId), {
      juzNumber: parseInt(newJuzNumber),
      lastLessonDate: normalizedLastLesson,
      displayDate: normalizedDisplay,
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    
    alert('✅ تم تحديث التقرير بنجاح!');
    
    // Reload reports
    loadViewerJuzReports();
    
  } catch (error) {
    console.error('Error editing report:', error);
    alert('❌ حدث خطأ في تحديث التقرير');
  }
};

// Delete Juz Report
window.deleteJuzReport = async function(reportId) {
  try {
    // Get report data for confirmation
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ لم يتم العثور على التقرير');
      return;
    }
    
    const data = reportDoc.data();
    
    // Confirm deletion
    const confirmed = confirm(
      `⚠️ هل أنت متأكد من حذف هذا التقرير؟\n\n` +
      `الطالب: ${data.studentName}\n` +
      `الجزء: ${data.juzNumber}\n` +
      `تاريخ آخر درس: ${data.lastLessonDate ? formatDateForDisplay(data.lastLessonDate) : 'غير محدد'}\n\n` +
      `⚠️ هذا الإجراء لا يمكن التراجع عنه!`
    );
    
    if (!confirmed) return;
    
    // Delete from Firebase
    await deleteDoc(doc(db, 'juzDisplays', reportId));
    
    alert('✅ تم حذف التقرير بنجاح!');
    
    // Reload reports
    loadViewerJuzReports();
    
    // Reload student list to update indicators
    loadViewerStudentsByTeacher();
    
  } catch (error) {
    console.error('Error deleting report:', error);
    alert('❌ حدث خطأ في حذف التقرير');
  }
};

// Register student from notification (quick registration)
window.registerFromNotification = async function(studentId, studentName, teacherId, teacherName, juzNumber, completionDate, notificationId) {
  try {
    // Create juz display record
    const juzDisplayData = {
      studentId: studentId,
      studentName: studentName,
      teacherId: teacherId,
      teacherName: teacherName,
      juzNumber: juzNumber,
      lastLessonDate: completionDate,
      displayDate: '', // To be filled later
      viewerName: 'مازن البلوشي',
      viewerId: 'MZNBL01',
      createdAt: serverTimestamp(),
      status: 'incomplete',
      createdFromNotification: true
    };
    
    await setDoc(doc(collection(db, 'juzDisplays')), juzDisplayData);
    
    // Delete notification
    await deleteDoc(doc(db, 'viewerNotifications', notificationId));
    
    // Close modal and show success
    document.getElementById('viewerInboxModal').style.display = 'none';
    
    alert(`✅ تم تسجيل الطالب ${studentName} للجزء ${juzNumber} بنجاح!\nيمكنك الآن إضافة تاريخ العرض من تبويب التقارير.`);
    
    // Reload notifications
    await loadViewerNotifications();
    
  } catch (error) {
    console.error('Error registering from notification:', error);
    alert('❌ حدث خطأ في تسجيل الطالب');
  }
};

// Stop viewer notifications listener
export function stopViewerNotificationsListener() {
  if (viewerNotificationsListener) {
    viewerNotificationsListener();
    viewerNotificationsListener = null;
  }
}

// ============================================
// HIJRI CALENDAR SYSTEM
// ============================================

let currentHijriYear = null;
let currentHijriMonth = null;
let targetInputId = null;

// Open Hijri Calendar
window.openHijriCalendar = function(inputId) {
  targetInputId = inputId;
  
  // Get current Hijri date
  const today = new Date();
  const hijriFormatter = new Intl.DateTimeFormat('en-SA-u-ca-islamic', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  
  const parts = hijriFormatter.formatToParts(today);
  currentHijriYear = parseInt(parts.find(p => p.type === 'year').value);
  currentHijriMonth = parseInt(parts.find(p => p.type === 'month').value);
  
  renderHijriCalendar();
  document.getElementById('hijriCalendarModal').style.display = 'flex';
};

// Change month (direction: -1 for previous, +1 for next)
window.changeHijriMonth = function(direction) {
  currentHijriMonth += direction;
  
  if (currentHijriMonth > 12) {
    currentHijriMonth = 1;
    currentHijriYear++;
  } else if (currentHijriMonth < 1) {
    currentHijriMonth = 12;
    currentHijriYear--;
  }
  
  renderHijriCalendar();
};

// Select today's date
window.selectTodayHijri = function() {
  const todayHijri = getTodayHijriSimple();
  if (targetInputId) {
    document.getElementById(targetInputId).value = todayHijri;
  }
  document.getElementById('hijriCalendarModal').style.display = 'none';
};

// Render calendar grid
function renderHijriCalendar() {
  const hijriMonths = [
    'المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  // Update header
  document.getElementById('hijriMonthYear').textContent = 
    `${hijriMonths[currentHijriMonth - 1]} ${currentHijriYear} هـ`;
  
  // Get days from accurate calendar for this month
  const monthKey = `${currentHijriYear}-${String(currentHijriMonth).padStart(2, '0')}`;
  const monthDates = accurateHijriDates.filter(entry => entry.hijri.startsWith(monthKey));
  
  // Get first day of month from accurate data
  let firstDayOfWeek = 0;
  if (monthDates.length > 0) {
    const firstDate = new Date(monthDates[0].gregorian + 'T12:00:00');
    firstDayOfWeek = firstDate.getDay();
  }
  
  // Get today's accurate Hijri date for highlighting
  const todayHijri = getTodayForStorage(); // YYYY-MM-DD format
  
  // Build calendar grid
  const grid = document.getElementById('hijriCalendarGrid');
  grid.innerHTML = '';
  
  // Add day headers
  const dayHeaders = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  dayHeaders.forEach(day => {
    const header = document.createElement('div');
    header.className = 'hijri-calendar-header';
    header.textContent = day;
    grid.appendChild(header);
  });
  
  // Add empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    grid.appendChild(emptyCell);
  }
  
  // Add day cells from accurate calendar
  monthDates.forEach(entry => {
    const day = entry.hijriDay;
    const dayCell = document.createElement('div');
    dayCell.className = 'hijri-calendar-day';
    dayCell.textContent = day;
    
    // Highlight today
    if (entry.hijri === todayHijri) {
      dayCell.classList.add('today');
    }
    
    // Click handler
    dayCell.onclick = () => selectHijriDate(day);
    
    grid.appendChild(dayCell);
  });
}

// Select a specific date
function selectHijriDate(day) {
  const formattedDate = `${day}-${String(currentHijriMonth).padStart(2, '0')}-${currentHijriYear}`;
  
  if (targetInputId) {
    document.getElementById(targetInputId).value = formattedDate;
  }
  
  document.getElementById('hijriCalendarModal').style.display = 'none';
}

// Convert Hijri to Gregorian (approximation for calendar display)
function hijriToGregorianApprox(hijriYear, hijriMonth, hijriDay) {
  const hijriEpoch = new Date('622-07-16');
  const daysFromEpoch = (hijriYear - 1) * 354.36 + (hijriMonth - 1) * 29.53 + hijriDay;
  return new Date(hijriEpoch.getTime() + daysFromEpoch * 24 * 60 * 60 * 1000);
}

// ============================================
// DAILY QUEUE SYSTEM - جدول الطلاب الجاهزين
// ============================================

// Load daily queue of students ready for display
window.loadDailyQueue = async function() {
  const container = document.getElementById('dailyQueueContainer');
  
  if (!container) return;
  
  container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 20px;">⏳ جاري التحميل...</p>';
  
  try {
    console.log('📋 Loading daily queue...');
    const startTime = performance.now();
    
    // Get today's Hijri date
    const todayHijri = getTodayForStorage(); // Returns YYYY-MM-DD
    
    // Get all juzDisplays that don't have displayDate yet (pending displays)
    const q = query(
      collection(db, 'juzDisplays'),
      where('status', '==', 'incomplete')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">✅ لا توجد طلاب في قائمة الانتظار</p>';
      return;
    }
    
    // Process students
    const queue = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const reportId = doc.id;
      
      // Only include if displayDate is empty or null
      if (!data.displayDate || data.displayDate === '') {
        // Smart priority calculation:
        // - If student has attempted (failed), use lastAttemptDate
        // - Otherwise, use lastLessonDate
        let priorityDate = data.lastLessonDate;
        let daysSinceAttempt = 0;
        let daysSinceLesson = 0;
        
        // Always calculate days since last lesson (used as secondary sort)
        daysSinceLesson = calculateHijriDaysDifference(data.lastLessonDate, todayHijri);
        
        if (data.lastAttemptDate) {
          // Student has attempted before - use last attempt date for priority
          priorityDate = data.lastAttemptDate;
          daysSinceAttempt = calculateHijriDaysDifference(data.lastAttemptDate, todayHijri);
        } else {
          // New student - never attempted - use last lesson date
          daysSinceAttempt = daysSinceLesson;
        }
        
        queue.push({
          reportId: reportId,
          studentId: data.studentId,
          studentName: data.studentName,
          teacherId: data.teacherId,
          teacherName: data.teacherName || 'غير محدد',
          juzNumber: data.juzNumber,
          lastLessonDate: data.lastLessonDate,
          lastAttemptDate: data.lastAttemptDate || null,
          failedAttempts: data.failedAttempts || [],
          priorityDate: priorityDate,
          daysSinceAttempt: daysSinceAttempt,
          daysSinceLesson: daysSinceLesson
        });
      }
    });
    
    // Sort by two criteria:
    // 1. Primary: daysSinceAttempt (descending - oldest attempt first)
    // 2. Secondary: daysSinceLesson (descending - oldest lesson first)
    // This ensures students who failed on same day are sorted by lesson date
    queue.sort((a, b) => {
      // If attempt days are different, sort by attempt days
      if (b.daysSinceAttempt !== a.daysSinceAttempt) {
        return b.daysSinceAttempt - a.daysSinceAttempt;
      }
      // If attempt days are same, sort by lesson days (older lesson = higher priority)
      return b.daysSinceLesson - a.daysSinceLesson;
    });
    
    const endTime = performance.now();
    console.log(`✅ Queue loaded in ${Math.round(endTime - startTime)}ms`);
    console.log(`📊 Total students in queue: ${queue.length}`);
    
    // Build table HTML
    if (queue.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">✅ لا توجد طلاب في قائمة الانتظار</p>';
      return;
    }
    
    let tableHTML = `
      <table class="keep-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 12px; text-align: right; border-radius: 8px 0 0 0;">#</th>
            <th style="padding: 12px; text-align: right;">اسم الطالب</th>
            <th style="padding: 12px; text-align: right;">اسم المعلم</th>
            <th style="padding: 12px; text-align: center;">الجزء</th>
            <th style="padding: 12px; text-align: center; border-radius: 0 8px 0 0;">منذ</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    queue.forEach((student, index) => {
      const rowColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      // Color based on days since LESSON (not attempt) - shows urgency of last lesson
      const priorityColor = student.daysSinceLesson >= 7 ? '#dc3545' : student.daysSinceLesson >= 5 ? '#ffc107' : '#28a745';
      // Display days since LESSON (not attempt) - this is what "منذ" means
      const daysText = student.daysSinceLesson === 1 ? 'يوم واحد' : student.daysSinceLesson === 2 ? 'يومان' : `${student.daysSinceLesson} أيام`;
      
      tableHTML += `
        <tr onclick="window.showJuzDisplayOptions('${student.reportId}', '${student.studentName}', ${student.juzNumber})" style="background: ${rowColor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='${rowColor}'">
          <td style="padding: 12px; font-weight: bold; color: #667eea;">${index + 1}</td>
          <td style="padding: 12px; font-weight: bold;">${student.studentName}</td>
          <td style="padding: 12px; color: #666;">${student.teacherName}</td>
          <td style="padding: 12px; text-align: center; font-weight: bold; color: #764ba2;">الجزء ${student.juzNumber}</td>
          <td style="padding: 12px; text-align: center;">
            <span style="padding: 5px 12px; background: ${priorityColor}; color: white; border-radius: 15px; font-weight: bold; font-size: 13px;">
              ${daysText}
            </span>
          </td>
        </tr>
      `;
    });
    
    tableHTML += '</tbody></table>';
    
    container.innerHTML = tableHTML;
    
  } catch (error) {
    console.error('Error loading daily queue:', error);
    container.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">❌ حدث خطأ في تحميل الجدول</p>';
  }
};

// Open report from queue
window.openQueueReport = async function(reportId) {
  try {
    console.log('📂 Opening report:', reportId);
    
    // Switch to reports tab
    window.showViewerTab('reports');
    
    // Get report data
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const data = reportDoc.data();
    
    // Set teacher select
    const teacherSelect = document.getElementById('viewerReportTeacherSelect');
    teacherSelect.value = data.teacherId;
    
    // Load students for this teacher
    await loadViewerStudentsByTeacher();
    
    // Set student select
    const studentSelect = document.getElementById('viewerReportStudentSelect');
    studentSelect.value = data.studentId;
    
    // Load reports for this student
    await loadViewerJuzReports();
    
    // Scroll to the specific report
    setTimeout(() => {
      const reportElement = document.getElementById(`displayDate_${reportId}`);
      if (reportElement) {
        reportElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        reportElement.focus();
        reportElement.style.border = '3px solid #667eea';
        setTimeout(() => {
          reportElement.style.border = '1px solid #ddd';
        }, 2000);
      }
    }, 500);
    
  } catch (error) {
    console.error('Error opening report:', error);
    alert('❌ حدث خطأ في فتح التقرير');
  }
};

// Show Juz Display Options Popup
window.showJuzDisplayOptions = async function(reportId, studentName, juzNumber) {
  try {
    console.log('📋 Opening options for report:', reportId);
    
    // Get report data
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const reportData = reportDoc.data();
    const previousNotes = reportData.notes || [];
    const failedAttempts = reportData.failedAttempts || [];
    const lastAttemptDate = reportData.lastAttemptDate;
    const lastLessonDate = reportData.lastLessonDate;
    
    // Format dates in Hijri
    let lastAttemptHtml = '';
    if (lastAttemptDate && failedAttempts.length > 0) {
      const formattedAttemptDate = formatDateForDisplay(lastAttemptDate); // DD-MM-YYYY
      // Convert Hijri to Gregorian to get day name
      const attemptGregorianDate = accurateHijriToGregorian(lastAttemptDate);
      const attemptDayName = getHijriDayName(attemptGregorianDate);
      lastAttemptHtml = `
        <div onclick="window.showAttemptsHistory('${reportId}')" style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-right: 3px solid #ffc107; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#ffe082'" onmouseout="this.style.background='#fff3cd'">
          <div style="font-size: 12px; color: #856404; margin-bottom: 3px;">
            <strong>📅 آخر محاولة تسميع:</strong> <span style="font-size: 10px; opacity: 0.8;">(اضغط لعرض السجل)</span>
          </div>
          <div style="font-size: 14px; font-weight: bold; color: #333;">
            ${attemptDayName} - ${formattedAttemptDate}
          </div>
          <div style="font-size: 11px; color: #856404; margin-top: 3px;">
            📊 إجمالي المحاولات: ${failedAttempts.length}
          </div>
        </div>
      `;
    }
    
    // Format last lesson date
    const formattedLessonDate = formatDateForDisplay(lastLessonDate);
    // Convert Hijri to Gregorian to get day name
    const lessonGregorianDate = accurateHijriToGregorian(lastLessonDate);
    const lessonDayName = getHijriDayName(lessonGregorianDate);
    
    // Display attempts count
    let attemptsCountHtml = '';
    if (failedAttempts.length > 0) {
      const totalAttempts = failedAttempts.length; // Just failed attempts (successful not counted yet)
      const attemptsColor = totalAttempts === 1 ? '#ffc107' : totalAttempts === 2 ? '#ff9800' : '#dc3545';
      attemptsCountHtml = `
        <div style="background: ${attemptsColor}; padding: 10px; border-radius: 6px; margin-bottom: 10px; text-align: center;">
          <div style="font-size: 12px; color: white; margin-bottom: 2px;">
            عدد مرات التسميع حتى الآن
          </div>
          <div style="font-size: 20px; font-weight: bold; color: white;">
            🔄 ${totalAttempts} ${totalAttempts === 1 ? 'مرة' : totalAttempts === 2 ? 'مرتان' : 'مرات'}
          </div>
          <div style="font-size: 11px; color: white; margin-top: 2px; opacity: 0.9;">
            (لم يجتاز بعد)
          </div>
        </div>
      `;
    } else {
      attemptsCountHtml = `
        <div style="background: #d4edda; padding: 10px; border-radius: 6px; margin-bottom: 10px; text-align: center; border: 2px solid #28a745;">
          <div style="font-size: 13px; color: #155724; font-weight: bold;">
            ✨ أول محاولة تسميع
          </div>
        </div>
      `;
    }
    
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'juzDisplayOptionsOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(3px);
      animation: fadeIn 0.2s ease;
    `;
    
    // Create popup container
    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 20px;
      width: 90%;
      max-width: 420px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
      animation: slideUp 0.3s ease;
      direction: rtl;
    `;
    
    popup.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .option-btn {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          margin-bottom: 8px;
        }
        .option-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .pass-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        .fail-btn {
          background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%);
          color: white;
        }
        .notes-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin-top: 12px;
        }
        .new-note-input {
          width: 100%;
          min-height: 80px;
          padding: 10px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          transition: border 0.3s;
        }
        .new-note-input:focus {
          outline: none;
          border-color: #667eea;
        }
        .save-note-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
        }
        .save-note-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .previous-notes {
          margin-top: 12px;
          max-height: 180px;
          overflow-y: auto;
        }
        .note-item {
          background: white;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 8px;
          border-right: 3px solid #667eea;
        }
        .note-date {
          font-size: 11px;
          color: #666;
          margin-bottom: 4px;
        }
        .note-text {
          font-size: 13px;
          color: #333;
          line-height: 1.5;
        }
        .close-btn {
          background: #6c757d;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          margin-top: 12px;
          width: 100%;
        }
        .close-btn:hover {
          background: #5a6268;
        }
        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 10px;
        }
        .note-tag {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 5px 10px;
          border-radius: 12px;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
          white-space: nowrap;
        }
        .note-tag:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }
        .note-tag:active {
          transform: translateY(0);
        }
      </style>
      
      <h2 style="color: #667eea; margin-bottom: 8px; font-size: 18px; text-align: center;">
        📋 خيارات عرض الجزء
      </h2>
      
      <div style="text-align: center; color: #666; margin-bottom: 12px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
        <div style="font-weight: bold; font-size: 15px; color: #333;">${studentName}</div>
        <div style="margin-top: 3px; color: #764ba2; font-weight: bold; font-size: 14px;">الجزء ${juzNumber}</div>
      </div>
      
      <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-right: 3px solid #28a745;">
        <div style="font-size: 12px; color: #2e7d32; margin-bottom: 3px;">
          <strong>📚 تاريخ آخر درس:</strong>
        </div>
        <div style="font-size: 14px; font-weight: bold; color: #333;">
          ${lessonDayName} - ${formattedLessonDate}
        </div>
      </div>
      
      ${lastAttemptHtml}
      ${attemptsCountHtml}
      
      <div style="margin-bottom: 12px;">
        <button class="option-btn pass-btn" onclick="window.handleJuzPass('${reportId}')">
          ✅ اجتاز
        </button>
        
        <button class="option-btn fail-btn" onclick="window.handleJuzFail('${reportId}')">
          ❌ لم يجتاز
        </button>
      </div>
      
      <div class="notes-section">
        <h3 style="color: #667eea; margin-bottom: 10px; font-size: 15px;">
          📝 الملاحظات
        </h3>
        
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; color: #666; margin-bottom: 5px;">🏷️ اختصارات سريعة:</div>
          <div class="tags-container">
            <button class="note-tag" onclick="window.addNoteTag('ضعف في التجويد')">ضعف في التجويد</button>
            <button class="note-tag" onclick="window.addNoteTag('ضعف في الحفظ')">ضعف في الحفظ</button>
            <button class="note-tag" onclick="window.addNoteTag('القراءة سريعة')">القراءة سريعة</button>
            <button class="note-tag" onclick="window.addNoteTag('ألحان جلية كثيرة')">ألحان جلية كثيرة</button>
          </div>
        </div>
        
        <textarea 
          id="newNoteInput" 
          class="new-note-input" 
          placeholder="أضف ملاحظة جديدة..."
        ></textarea>
        
        <button class="save-note-btn" onclick="window.saveJuzNote('${reportId}')">
          💾 حفظ الملاحظة
        </button>
        
        <div class="previous-notes" id="previousNotesList">
          ${previousNotes.length === 0 ? 
            '<p style="text-align: center; color: #999; padding: 12px; font-size: 13px;">لا توجد ملاحظات سابقة</p>' :
            previousNotes.map(note => `
              <div class="note-item">
                <div class="note-date">${note.date || 'غير محدد'}</div>
                <div class="note-text">${note.text}</div>
              </div>
            `).join('')
          }
        </div>
      </div>
      
      <button class="close-btn" onclick="document.getElementById('juzDisplayOptionsOverlay').remove()">
        إغلاق
      </button>>
        إغلاق
      </button>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
  } catch (error) {
    console.error('Error showing options:', error);
    alert('❌ حدث خطأ في عرض الخيارات');
  }
};

// Handle Juz Pass - Opens report for updating display date
window.handleJuzPass = async function(reportId) {
  try {
    console.log('✅ Pass clicked for report:', reportId);
    
    // Close the options popup
    const overlay = document.getElementById('juzDisplayOptionsOverlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Select viewer name
    const viewerName = await selectViewerName('مازن البلوشي');
    
    if (!viewerName) {
      console.log('❌ User cancelled viewer selection');
      return;
    }
    
    // Update viewerName in the report
    await updateDoc(doc(db, 'juzDisplays', reportId), {
      viewerName: viewerName,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Viewer name updated:', viewerName);
    
    // Open the report (same as openQueueReport)
    await window.openQueueReport(reportId);
    
  } catch (error) {
    console.error('Error handling pass:', error);
    alert('❌ حدث خطأ');
  }
};

// Handle Juz Fail - Records failed attempt and moves to bottom of queue
window.handleJuzFail = async function(reportId) {
  try {
    console.log('❌ Fail clicked for report:', reportId);
    
    // Select viewer name first
    const viewerName = await selectViewerName('مازن البلوشي');
    
    if (!viewerName) {
      console.log('❌ User cancelled viewer selection');
      return;
    }
    
    // Show attempt details form
    const attemptDetails = await showAttemptDetailsForm(viewerName);
    
    if (!attemptDetails) {
      console.log('❌ User cancelled attempt details');
      return;
    }
    
    // Get current report data
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const currentData = reportDoc.data();
    const failedAttempts = currentData.failedAttempts || [];
    
    // Add failed attempt record with full details
    const failedAttempt = {
      attemptNumber: failedAttempts.length + 1,
      date: getTodayForStorage(), // YYYY-MM-DD format
      timestamp: new Date(),
      viewerName: viewerName,
      warnings: attemptDetails.warnings,
      mistakes: attemptDetails.mistakes,
      majorMelodies: attemptDetails.majorMelodies
    };
    
    failedAttempts.push(failedAttempt);
    
    // Update report: record failed attempt with lastAttemptDate and viewerName
    await updateDoc(doc(db, 'juzDisplays', reportId), {
      failedAttempts: failedAttempts,
      lastAttemptDate: getTodayForStorage(),
      viewerName: viewerName,
      updatedAt: serverTimestamp()
    });
    
    // Close popup
    const overlay = document.getElementById('juzDisplayOptionsOverlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Reload queue to show updated order
    await loadDailyQueue();
    
    // Show success message
    alert(
      `✅ تم تسجيل محاولة فاشلة\n\n` +
      `📊 التفاصيل:\n` +
      `• العارض: ${viewerName}\n` +
      `• رقم المحاولة: ${failedAttempt.attemptNumber}\n` +
      `• التنبيهات: ${attemptDetails.warnings}\n` +
      `• الغلطات: ${attemptDetails.mistakes}\n` +
      `• الألحان الجلية: ${attemptDetails.majorMelodies}\n\n` +
      `تم نقل الطالب لأسفل القائمة`
    );
    
  } catch (error) {
    console.error('Error handling fail:', error);
    alert('❌ حدث خطأ في تسجيل المحاولة الفاشلة');
  }
};

// Show attempt details form (warnings, mistakes, major melodies counters)
async function showAttemptDetailsForm(viewerName) {
  return new Promise((resolve) => {
    let warnings = 0;
    let mistakes = 0;
    let majorMelodies = 0;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'attemptDetailsOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10002;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    `;
    
    const updateDisplay = () => {
      document.getElementById('warningsCount').textContent = warnings;
      document.getElementById('mistakesCount').textContent = mistakes;
      document.getElementById('melodiesCount').textContent = majorMelodies;
    };
    
    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 15px;
        padding: 25px;
        width: 90%;
        max-width: 450px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        direction: rtl;
      ">
        <style>
          .counter-btn {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
            color: white;
          }
          .counter-btn:hover {
            transform: scale(1.1);
          }
          .counter-btn:active {
            transform: scale(0.95);
          }
          .plus-btn {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          }
          .minus-btn {
            background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%);
          }
          .counter-display {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            min-width: 50px;
            text-align: center;
          }
        </style>
        
        <h2 style="color: #667eea; margin: 0 0 10px 0; text-align: center; font-size: 20px;">
          📊 تفاصيل المحاولة
        </h2>
        
        <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 14px; color: #666; margin-bottom: 3px;">العارض</div>
          <div style="font-size: 16px; font-weight: bold; color: #333;">${viewerName}</div>
        </div>
        
        <!-- Warnings Counter -->
        <div style="background: #fff3cd; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
          <div style="font-size: 14px; color: #856404; margin-bottom: 10px; font-weight: bold; text-align: center;">
            ⚠️ عدد التنبيهات
          </div>
          <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
            <button class="counter-btn minus-btn" onclick="window.decrementCounter('warnings')">−</button>
            <div class="counter-display" id="warningsCount">0</div>
            <button class="counter-btn plus-btn" onclick="window.incrementCounter('warnings')">+</button>
          </div>
        </div>
        
        <!-- Mistakes Counter -->
        <div style="background: #f8d7da; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
          <div style="font-size: 14px; color: #721c24; margin-bottom: 10px; font-weight: bold; text-align: center;">
            ❌ عدد الغلطات
          </div>
          <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
            <button class="counter-btn minus-btn" onclick="window.decrementCounter('mistakes')">−</button>
            <div class="counter-display" id="mistakesCount">0</div>
            <button class="counter-btn plus-btn" onclick="window.incrementCounter('mistakes')">+</button>
          </div>
        </div>
        
        <!-- Major Melodies Counter -->
        <div style="background: #e2d4f7; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #5a2d82; margin-bottom: 10px; font-weight: bold; text-align: center;">
            🎵 عدد الألحان الجلية
          </div>
          <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
            <button class="counter-btn minus-btn" onclick="window.decrementCounter('majorMelodies')">−</button>
            <div class="counter-display" id="melodiesCount">0</div>
            <button class="counter-btn plus-btn" onclick="window.incrementCounter('majorMelodies')">+</button>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button id="confirmDetailsBtn" style="
            flex: 1;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          ">
            ✅ تأكيد
          </button>
          <button id="cancelDetailsBtn" style="
            flex: 1;
            padding: 12px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          ">
            ❌ إلغاء
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Counter functions
    window.incrementCounter = (type) => {
      if (type === 'warnings') warnings++;
      else if (type === 'mistakes') mistakes++;
      else if (type === 'majorMelodies') majorMelodies++;
      updateDisplay();
    };
    
    window.decrementCounter = (type) => {
      if (type === 'warnings' && warnings > 0) warnings--;
      else if (type === 'mistakes' && mistakes > 0) mistakes--;
      else if (type === 'majorMelodies' && majorMelodies > 0) majorMelodies--;
      updateDisplay();
    };
    
    // Confirm button
    document.getElementById('confirmDetailsBtn').addEventListener('click', () => {
      overlay.remove();
      resolve({
        warnings: warnings,
        mistakes: mistakes,
        majorMelodies: majorMelodies
      });
    });
    
    // Cancel button
    document.getElementById('cancelDetailsBtn').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
  });
}

// Add note tag to textarea
window.addNoteTag = function(tagText) {
  const noteInput = document.getElementById('newNoteInput');
  if (!noteInput) return;
  
  const currentText = noteInput.value.trim();
  
  // Add tag to text (with separator if text exists)
  if (currentText) {
    // Check if tag already exists in text
    if (currentText.includes(tagText)) {
      // Tag already exists, don't add duplicate
      return;
    }
    // Add comma separator
    noteInput.value = currentText + '، ' + tagText;
  } else {
    noteInput.value = tagText;
  }
  
  // Focus textarea for immediate editing
  noteInput.focus();
  
  // Move cursor to end
  noteInput.setSelectionRange(noteInput.value.length, noteInput.value.length);
};

// Show attempts history table
window.showAttemptsHistory = async function(reportId) {
  try {
    // Get report data
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const reportData = reportDoc.data();
    const failedAttempts = reportData.failedAttempts || [];
    
    if (failedAttempts.length === 0) {
      alert('ℹ️ لا توجد محاولات مسجلة');
      return;
    }
    
    // Build table rows
    let tableRows = '';
    failedAttempts.forEach((attempt, index) => {
      const formattedDate = formatDateForDisplay(attempt.date);
      const gregorianDate = accurateHijriToGregorian(attempt.date);
      const dayName = getHijriDayName(gregorianDate);
      const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      
      tableRows += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-weight: bold; color: #667eea;">${attempt.attemptNumber || index + 1}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 13px;">
            <div style="font-weight: bold; color: #333;">${dayName}</div>
            <div style="font-size: 11px; color: #666;">${formattedDate}</div>
          </td>
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 13px;">${attempt.viewerName || 'غير محدد'}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #856404; font-weight: bold;">${attempt.warnings || 0}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #721c24; font-weight: bold;">${attempt.mistakes || 0}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; color: #5a2d82; font-weight: bold;">${attempt.majorMelodies || 0}</td>
        </tr>
      `;
    });
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'attemptsHistoryOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10003;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 15px;
        padding: 25px;
        width: 95%;
        max-width: 900px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        direction: rtl;
      ">
        <h2 style="color: #667eea; margin: 0 0 20px 0; text-align: center; font-size: 22px;">
          📊 سجل محاولات التسميع
        </h2>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; color: white; text-align: center;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">إجمالي المحاولات</div>
          <div style="font-size: 28px; font-weight: bold;">🔄 ${failedAttempts.length}</div>
        </div>
        
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <th style="padding: 12px; border: none; border-radius: 8px 0 0 0;">#</th>
                <th style="padding: 12px; border: none;">اليوم والتاريخ</th>
                <th style="padding: 12px; border: none;">العارض</th>
                <th style="padding: 12px; border: none; text-align: center;">⚠️ تنبيهات</th>
                <th style="padding: 12px; border: none; text-align: center;">❌ غلطات</th>
                <th style="padding: 12px; border: none; text-align: center; border-radius: 0 8px 0 0;">🎵 ألحان جلية</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
        
        <button onclick="document.getElementById('attemptsHistoryOverlay').remove()" style="
          width: 100%;
          padding: 12px;
          margin-top: 20px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        ">
          ❌ إغلاق
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
  } catch (error) {
    console.error('Error showing attempts history:', error);
    alert('❌ حدث خطأ في عرض السجل');
  }
};

// Save Juz Note
window.saveJuzNote = async function(reportId) {
  try {
    const noteInput = document.getElementById('newNoteInput');
    const noteText = noteInput.value.trim();
    
    if (!noteText) {
      alert('⚠️ الرجاء كتابة ملاحظة');
      return;
    }
    
    // Get current report data
    const reportDoc = await getDoc(doc(db, 'juzDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const reportData = reportDoc.data();
    const currentNotes = reportData.notes || [];
    
    // Add new note with timestamp
    const newNote = {
      text: noteText,
      date: new Date().toLocaleString('ar-SA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: new Date()
    };
    
    currentNotes.unshift(newNote); // Add to beginning
    
    // Update Firebase
    await updateDoc(doc(db, 'juzDisplays', reportId), {
      notes: currentNotes
    });
    
    // Clear input
    noteInput.value = '';
    
    // Update notes list
    const notesList = document.getElementById('previousNotesList');
    notesList.innerHTML = currentNotes.map(note => `
      <div class="note-item">
        <div class="note-date">${note.date || 'غير محدد'}</div>
        <div class="note-text">${note.text}</div>
      </div>
    `).join('');
    
    // Show success message
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ تم الحفظ';
    btn.style.background = '#28a745';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }, 2000);
    
    console.log('✅ Note saved successfully');
    
  } catch (error) {
    console.error('Error saving note:', error);
    alert('❌ حدث خطأ في حفظ الملاحظة');
  }
};

// ============================================
// JUZ REPORT PDF EXPORT SYSTEM
// ============================================

// Show report options popup
window.showJuzReportOptions = function() {
  // Get current Hijri date for defaults
  const today = getTodayForStorage(); // YYYY-MM-DD
  const todayParts = today.split('-');
  const currentYear = todayParts[0];
  const currentMonth = todayParts[1];
  
  // Generate month options
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  let monthOptions = '';
  
  // Add current year months
  for (let i = 1; i <= 12; i++) {
    const monthKey = `${currentYear}-${String(i).padStart(2, '0')}`;
    const isSelected = String(i).padStart(2, '0') === currentMonth ? 'selected' : '';
    monthOptions += `<option value="${monthKey}" ${isSelected}>${hijriMonths[i-1]} ${currentYear}</option>`;
  }
  
  // Add previous year months (last 3)
  const prevYear = String(parseInt(currentYear) - 1);
  for (let i = 10; i <= 12; i++) {
    const monthKey = `${prevYear}-${String(i).padStart(2, '0')}`;
    monthOptions += `<option value="${monthKey}">${hijriMonths[i-1]} ${prevYear}</option>`;
  }
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'juzReportOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  `;
  
  overlay.innerHTML = `
    <div style="background: white; border-radius: 15px; padding: 25px; width: 90%; max-width: 450px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); animation: slideUp 0.3s ease; direction: rtl;">
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      
      <h2 style="color: #667eea; margin: 0 0 20px 0; text-align: center; font-size: 22px;">
        📊 تصدير تقرير الأجزاء
      </h2>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
          📅 اختر الفترة:
        </label>
        <select id="reportPeriodType" onchange="window.toggleReportDateInputs()" style="width: 100%; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px; cursor: pointer;">
          <option value="month">شهر محدد</option>
          <option value="custom">فترة مخصصة</option>
          <option value="all">جميع الفترات</option>
        </select>
      </div>
      
      <div id="monthSelectContainer" style="margin-bottom: 20px;">
        <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
          🗓️ الشهر:
        </label>
        <select id="reportMonth" style="width: 100%; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
          ${monthOptions}
        </select>
      </div>
      
      <div id="customDateContainer" style="display: none; margin-bottom: 20px;">
        <div style="margin-bottom: 15px;">
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            📅 من تاريخ (DD-MM-YYYY):
          </label>
          <input type="text" id="reportFromDate" placeholder="01-09-1447" style="width: 100%; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;" />
        </div>
        <div>
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            📅 إلى تاريخ (DD-MM-YYYY):
          </label>
          <input type="text" id="reportToDate" placeholder="30-09-1447" style="width: 100%; padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;" />
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 25px;">
        <button onclick="window.generateJuzReport()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
          📥 تصدير PDF
        </button>
        <button onclick="document.getElementById('juzReportOverlay').remove()" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
          ❌ إلغاء
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
};

// Toggle date inputs based on period type
window.toggleReportDateInputs = function() {
  const periodType = document.getElementById('reportPeriodType').value;
  const monthContainer = document.getElementById('monthSelectContainer');
  const customContainer = document.getElementById('customDateContainer');
  
  if (periodType === 'month') {
    monthContainer.style.display = 'block';
    customContainer.style.display = 'none';
  } else if (periodType === 'custom') {
    monthContainer.style.display = 'none';
    customContainer.style.display = 'block';
  } else {
    monthContainer.style.display = 'none';
    customContainer.style.display = 'none';
  }
};

// Generate Juz Report PDF
window.generateJuzReport = async function() {
  try {
    const periodType = document.getElementById('reportPeriodType').value;
    let fromDate = null;
    let toDate = null;
    let periodLabel = '';
    
    // Determine date range
    if (periodType === 'month') {
      const monthKey = document.getElementById('reportMonth').value; // YYYY-MM (e.g., "1447-09")
      const monthParts = monthKey.split('-');
      const selectedYear = parseInt(monthParts[0]);
      const selectedMonth = parseInt(monthParts[1]);
      
      // Find EXACT start and end dates from accurateHijriDates
      const monthDates = accurateHijriDates.filter(entry => 
        entry.hijriYear === selectedYear && entry.hijriMonth === selectedMonth
      );
      
      if (monthDates.length > 0) {
        // Use first and last dates from accurate calendar
        fromDate = monthDates[0].hijri; // First day of month
        toDate = monthDates[monthDates.length - 1].hijri; // Last day of month
        
        console.log(`📅 Accurate month range for ${monthKey}:`, {
          fromDate,
          toDate,
          totalDays: monthDates.length,
          gregorianStart: monthDates[0].gregorian,
          gregorianEnd: monthDates[monthDates.length - 1].gregorian
        });
      } else {
        // Fallback if month not in calendar (shouldn't happen)
        fromDate = `${monthKey}-01`;
        toDate = `${monthKey}-30`;
        console.warn('⚠️ Month not found in accurate calendar, using approximation');
      }
      
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[selectedMonth - 1];
      periodLabel = `${monthName} ${selectedYear}`;
    } else if (periodType === 'custom') {
      const from = document.getElementById('reportFromDate').value.trim();
      const to = document.getElementById('reportToDate').value.trim();
      
      if (!from || !to) {
        alert('⚠️ يرجى إدخال التاريخ من والى');
        return;
      }
      
      fromDate = normalizeDateFormat(from);
      toDate = normalizeDateFormat(to);
      
      if (!fromDate || !toDate) {
        alert('❌ تنسيق التاريخ غير صحيح. استخدم DD-MM-YYYY');
        return;
      }
      
      periodLabel = `من ${formatDateForDisplay(fromDate)} إلى ${formatDateForDisplay(toDate)}`;
    } else {
      // All periods
      periodLabel = 'جميع الفترات';
    }
    
    // Show loading
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'pdfLoadingMsg';
    loadingMsg.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 10001;
      text-align: center;
    `;
    loadingMsg.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
      <div style="font-size: 18px; color: #667eea; font-weight: bold;">جاري إنشاء التقرير...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">يرجى الانتظار</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Fetch all juzDisplays
    const snapshot = await getDocs(collection(db, 'juzDisplays'));
    
    // Filter based on date range with ACCURATE date comparison
    let allReports = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const displayDate = data.displayDate;
      const lastLessonDate = data.lastLessonDate;
      
      // Include based on period type
      if (periodType === 'all') {
        allReports.push(data);
      } else if (data.status === 'completed' && displayDate) {
        // المجتازين: نتحقق من تاريخ الاجتياز
        let normalizedDisplayDate = displayDate;
        if (displayDate.includes('/')) {
          const parts = displayDate.split('/');
          if (parts.length === 3) {
            normalizedDisplayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        
        // حالة 1: اجتاز في الفترة المحددة → يظهر كمجتاز
        if (normalizedDisplayDate >= fromDate && normalizedDisplayDate <= toDate) {
          allReports.push(data);
          console.log('✅ Included as PASSED:', {
            student: data.studentName,
            displayDate: normalizedDisplayDate,
            range: `${fromDate} to ${toDate}`,
            status: 'مجتاز في هذه الفترة'
          });
        }
        // حالة 2: اجتاز بعد الفترة لكن آخر درس كان في/قبل الفترة → يظهر كمتبقي
        else if (lastLessonDate && lastLessonDate <= toDate && normalizedDisplayDate > toDate) {
          allReports.push(data);
          console.log('✅ Included as PENDING (passed later):', {
            student: data.studentName,
            lastLessonDate: lastLessonDate,
            displayDate: normalizedDisplayDate,
            range: `${fromDate} to ${toDate}`,
            status: 'كان متبقي في هذه الفترة (اجتاز لاحقاً)'
          });
        } else {
          console.log('❌ Excluded completed report:', {
            student: data.studentName,
            displayDate: normalizedDisplayDate,
            lastLessonDate: lastLessonDate,
            range: `${fromDate} to ${toDate}`
          });
        }
      } else if (data.status === 'incomplete' && lastLessonDate) {
        // الجاهزين: آخر درس قبل أو خلال نهاية الفترة المحددة
        // يظهر في شهره وجميع الأشهر اللاحقة حتى يجتاز
        if (lastLessonDate <= toDate) {
          allReports.push(data);
          console.log('✅ Included as PENDING:', {
            student: data.studentName,
            lastLessonDate: lastLessonDate,
            toDate: toDate,
            status: 'جاهز - لم يجتاز بعد'
          });
        } else {
          console.log('❌ Excluded incomplete report (lastLesson after period):', {
            student: data.studentName,
            lastLessonDate: lastLessonDate,
            toDate: toDate
          });
        }
      }
    });
    
    console.log(`📊 Total reports found: ${allReports.length} for period: ${periodLabel}`);
    
    // Calculate statistics with accurate status for the period
    const totalStudents = allReports.length;
    
    // احسب المجتازين والمتبقين بناءً على الفترة المحددة
    let passedStudents = 0;
    let remainingStudents = 0;
    
    allReports.forEach(report => {
      // إذا كان مجتاز وتاريخ الاجتياز في الفترة → مجتاز
      if (report.status === 'completed' && report.displayDate) {
        let normalizedDisplayDate = report.displayDate;
        if (report.displayDate.includes('/')) {
          const parts = report.displayDate.split('/');
          if (parts.length === 3) {
            normalizedDisplayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        
        if (normalizedDisplayDate >= fromDate && normalizedDisplayDate <= toDate) {
          passedStudents++; // اجتاز في هذه الفترة
        } else {
          remainingStudents++; // اجتاز لاحقاً، كان متبقي في هذه الفترة
        }
      } else if (report.status === 'incomplete') {
        remainingStudents++; // لم يجتاز بعد
      }
    });
    
    console.log(`📊 Statistics:`, {
      total: totalStudents,
      passed: passedStudents,
      remaining: remainingStudents
    });
    
    // Calculate per teacher
    const teacherStats = {};
    allReports.forEach(report => {
      const teacherId = report.teacherId;
      const teacherName = report.teacherName || 'غير محدد';
      
      if (!teacherStats[teacherId]) {
        teacherStats[teacherId] = {
          name: teacherName,
          total: 0,      // إجمالي المسجلين
          completed: 0,  // المجتازين في هذه الفترة
          remaining: 0   // الجاهزين (المتبقي)
        };
      }
      
      // حساب الإجمالي
      teacherStats[teacherId].total++;
      
      // حساب المجتازين والجاهزين بناءً على الفترة
      if (report.status === 'completed' && report.displayDate) {
        let normalizedDisplayDate = report.displayDate;
        if (report.displayDate.includes('/')) {
          const parts = report.displayDate.split('/');
          if (parts.length === 3) {
            normalizedDisplayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        
        // إذا اجتاز في هذه الفترة → مجتاز
        if (normalizedDisplayDate >= fromDate && normalizedDisplayDate <= toDate) {
          teacherStats[teacherId].completed++;
        } else {
          // اجتاز لاحقاً، كان متبقي في هذه الفترة
          teacherStats[teacherId].remaining++;
        }
      } else if (report.status === 'incomplete') {
        teacherStats[teacherId].remaining++;
      }
    });
    
    console.log('📊 Teacher Statistics:', teacherStats);
    
    // Analyze common notes (based on tags)
    const noteTags = {
      'ضعف في التجويد': 0,
      'ضعف في الحفظ': 0,
      'القراءة سريعة': 0,
      'ألحان جلية كثيرة': 0
    };
    
    allReports.forEach(report => {
      if (report.notes && Array.isArray(report.notes)) {
        report.notes.forEach(note => {
          const text = note.text || '';
          Object.keys(noteTags).forEach(tag => {
            if (text.includes(tag)) {
              noteTags[tag]++;
            }
          });
        });
      }
    });
    
    // 🚀 INNOVATIVE SOLUTION: Create HTML content and convert to PDF using html2canvas
    console.log('🎨 Creating HTML content for PDF...');
    
    const successRate = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;
    const teacherEntries = Object.values(teacherStats).sort((a, b) => b.completed - a.completed);
    const sortedNotes = Object.entries(noteTags).sort((a, b) => b[1] - a[1]);
    
    // Build teacher rows HTML
    let teacherRowsHTML = '';
    teacherEntries.forEach((teacher, index) => {
      const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      teacherRowsHTML += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 14px;">${teacher.name}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; font-weight: bold; color: #667eea;">${teacher.total}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #28a745; font-weight: bold;">${teacher.completed}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #ffc107;">${teacher.remaining}</td>
        </tr>
      `;
    });
    
    // Build notes rows HTML
    let notesRowsHTML = '';
    sortedNotes.forEach(([tag, count], index) => {
      if (count > 0) {
        const percentage = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
        const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        notesRowsHTML += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 14px;">${tag}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; font-weight: bold;">${count}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #667eea; font-weight: bold;">${percentage}%</td>
          </tr>
        `;
      }
    });
    
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
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 32px;">📊 تقرير الأجزاء القرآنية</h1>
        <p style="color: #666; font-size: 18px; margin: 0;">${periodLabel}</p>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; margin-bottom: 30px; color: white;">
        <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">📈 الإحصائيات العامة</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">إجمالي الطلاب</div>
            <div style="font-size: 28px; font-weight: bold;">${totalStudents}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">المجتازين</div>
            <div style="font-size: 28px; font-weight: bold; color: #90ee90;">${passedStudents}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">المتبقي</div>
            <div style="font-size: 28px; font-weight: bold; color: #ffb6c1;">${remainingStudents}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">نسبة النجاح</div>
            <div style="font-size: 28px; font-weight: bold; color: #ffd700;">${successRate}%</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #667eea; margin: 0 0 15px 0; font-size: 22px; border-bottom: 3px solid #667eea; padding-bottom: 10px;">👥 إنجازات المعلمين</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: right; border: none; font-size: 16px; border-radius: 8px 0 0 0;">اسم المعلم</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 16px;">إجمالي المسجلين</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 16px;">المجتازين</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 16px; border-radius: 0 8px 0 0;">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            ${teacherRowsHTML || '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #999;">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #667eea; margin: 0 0 15px 0; font-size: 22px; border-bottom: 3px solid #667eea; padding-bottom: 10px;">📝 الملاحظات الشائعة</h2>
        ${notesRowsHTML ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: right; border: none; font-size: 16px; border-radius: 8px 0 0 0;">الملاحظة</th>
                <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 16px;">العدد</th>
                <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 16px; border-radius: 0 8px 0 0;">النسبة</th>
              </tr>
            </thead>
            <tbody>
              ${notesRowsHTML}
            </tbody>
          </table>
        ` : '<p style="text-align: center; color: #999; padding: 20px;">لا توجد ملاحظات مسجلة</p>'}
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea;">
        <p style="margin: 5px 0; color: #667eea; font-size: 14px; font-style: italic;">📚 نظام إدارة عرض الأجزاء القرآنية</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${formatDateForDisplay(getTodayForStorage())}</p>
      </div>
    `;
    
    document.body.appendChild(container);
    console.log('📸 Converting HTML to canvas...');
    
    // Convert HTML to canvas using html2canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
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
    const fileName = `تقرير_الأجزاء_${periodLabel.replace(/\s/g, '_')}.pdf`;
    doc.save(fileName);
    
    console.log('🎉 PDF saved successfully:', fileName);
    
    // Remove loading and overlay
    loadingMsg.remove();
    document.getElementById('juzReportOverlay').remove();
    
    alert('✅ تم تصدير التقرير بنجاح!');
    
  } catch (error) {
    console.error('Error generating report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

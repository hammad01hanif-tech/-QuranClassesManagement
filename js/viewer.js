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
  orderBy,
  serverTimestamp,
  onSnapshot
} from '../firebase-config.js';

import { getTodayForStorage, getCurrentHijriDate, formatHijriDate, getHijriDayName } from './hijri-date.js';
import { accurateHijriDates, gregorianToAccurateHijri, accurateHijriToGregorian } from './accurate-hijri-dates.js';
import { quranHizbData } from './quran-hizb-data.js';

let viewerNotificationsListener = null;

// ============================================
// AUTOMATIC TEACHER INCENTIVES SYSTEM
// ============================================

/**
 * منح حافز تلقائي للمعلم عند اجتياز طالب لجزء أو حزب
 * Grant automatic incentive to teacher when student passes Juz or Hizb
 * 
 * @param {string} teacherId - معرف المعلم
 * @param {string} teacherName - اسم المعلم
 * @param {string} type - نوع الإنجاز: 'juz' أو 'hizb'
 * @param {number} number - رقم الجزء أو الحزب
 * @param {string} reportId - معرف التقرير (للربط وتجنب التكرار)
 * @param {string} studentName - اسم الطالب
 */
async function grantAutomaticIncentive(teacherId, teacherName, type, number, reportId, studentName) {
  try {
    console.log('🎁 بدء عملية منح حافز تلقائي:', {
      teacherId,
      teacherName,
      type,
      number,
      reportId,
      studentName
    });
    
    // 1️⃣ جلب إعدادات المعلم من staffSettings
    const settingsDoc = await getDoc(doc(db, 'staffSettings', teacherId));
    
    if (!settingsDoc.exists()) {
      console.log('⚠️ لا توجد إعدادات للمعلم - لن يتم منح حافز');
      return;
    }
    
    const settings = settingsDoc.data();
    const automaticSettings = settings.incentiveSettings?.automatic;
    
    if (!automaticSettings) {
      console.log('⚠️ لا توجد إعدادات حوافز تلقائية للمعلم');
      return;
    }
    
    // 2️⃣ تحديد نوع الحافز حسب الإنجاز (juz أو hizb)
    const incentiveKey = type === 'juz' ? 'juzIncentive' : 'hizbIncentive';
    const incentiveConfig = automaticSettings[incentiveKey];
    
    if (!incentiveConfig) {
      console.log(`⚠️ لا توجد إعدادات حافز لـ ${type}`);
      return;
    }
    
    // 3️⃣ التحقق من تفعيل هذا النوع
    if (!incentiveConfig.enabled) {
      console.log(`⚠️ حوافز ${type} غير مفعّلة للمعلم`);
      return;
    }
    
    // 4️⃣ الحصول على المبلغ (تحويل من string إلى number)
    const incentiveAmount = parseFloat(incentiveConfig.amount) || 20;
    const incentiveDescription = `${incentiveConfig.description || (type === 'juz' ? 'حافز اجتياز جزء' : 'حافز اجتياز حزب')} ${number}`;
    const achievementType = type === 'juz' ? 'juz_completion' : 'hizb_completion';
    
    console.log('💰 مبلغ الحافز:', incentiveAmount, 'ريال');
    console.log('📝 وصف الحافز:', incentiveDescription);
    
    console.log('💰 مبلغ الحافز:', incentiveAmount, 'ريال');
    console.log('📝 وصف الحافز:', incentiveDescription);
    
    // 5️⃣ التحقق من عدم وجود حافز مُمنوح مسبقاً لنفس التقرير
    const existingQuery = query(
      collection(db, 'teacherIncentives'),
      where('teacherId', '==', teacherId),
      where('metadata.reportId', '==', reportId)
    );
    
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      console.log('⚠️ يوجد حافز ممنوح مسبقاً لهذا التقرير - لن يتم التكرار');
      return;
    }
    
    // 6️⃣ إنشاء سجل الحافز التلقائي
    const incentiveId = `INC_${teacherId}_${Date.now()}`;
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7); // "2026-06"
    const currentYear = now.getFullYear(); // 2026
    
    const incentiveData = {
      // المعرفات الأساسية
      incentiveId: incentiveId,
      teacherId: teacherId,
      teacherName: teacherName,
      
      // التصنيف
      type: 'automatic',
      source: 'viewer',
      incentiveType: achievementType,
      
      // الوصف والمبلغ
      incentiveName: incentiveDescription,
      reason: `${incentiveDescription} - الطالب: ${studentName}`,
      amount: incentiveAmount,
      currency: 'SAR',
      
      // التواريخ (للدورة الشهرية والتقارير)
      createdAt: serverTimestamp(),
      month: currentMonth,
      year: currentYear,
      
      // معلومات الإنشاء
      grantedBy: 'system',
      grantedByName: 'النظام التلقائي',
      
      // الحالة
      status: 'approved',
      
      // بيانات إضافية (metadata) للربط والاستعلام
      metadata: {
        reportId: reportId,
        studentName: studentName,
        achievementNumber: number,
        collectionName: type === 'juz' ? 'juzDisplays' : 'hizbDisplays'
      }
    };
    
    // حفظ في Firestore
    await setDoc(doc(db, 'teacherIncentives', incentiveId), incentiveData);
    
    console.log('✅ تم منح الحافز التلقائي بنجاح!', {
      incentiveId,
      amount: incentiveAmount,
      description: incentiveDescription
    });
    
    // 7️⃣ إرسال إشعار للمعلم (اختياري)
    try {
      const notificationId = `NOTIF_INCENTIVE_${teacherId}_${Date.now()}`;
      await setDoc(doc(db, 'teacherNotifications', notificationId), {
        notificationId: notificationId,
        teacherId: teacherId,
        type: 'incentive_granted',
        title: '🎁 حافز تلقائي جديد',
        message: `تم منحك حافز ${incentiveAmount} ريال - ${incentiveDescription} للطالب ${studentName}`,
        incentiveId: incentiveId,
        amount: incentiveAmount,
        reason: incentiveDescription,
        createdAt: serverTimestamp(),
        read: false
      });
      
      console.log('✅ تم إرسال إشعار الحافز للمعلم');
    } catch (notifError) {
      console.error('⚠️ خطأ في إرسال الإشعار (لكن الحافز تم منحه):', notifError);
    }
    
  } catch (error) {
    console.error('❌ خطأ في منح الحافز التلقائي:', error);
    // لا نعرض alert للمستخدم لأنها عملية خلفية
  }
}

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

// ============================================
// HELPER FUNCTION - Extract Arabic Name Only
// ============================================
function extractArabicName(fullName) {
  if (!fullName) return '';
  // If name contains " — " separator, extract the Arabic part after it
  if (fullName.includes(' — ')) {
    return fullName.split(' — ')[1].trim();
  }
  // If no separator, return as is
  return fullName;
}

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
async function loadViewerTeachers(selectElementId = null) {
  const teacherSelect = document.getElementById('viewerTeacherSelect');
  const reportTeacherSelect = document.getElementById('viewerReportTeacherSelect');
  
  // If specific element ID provided, only load that one
  if (selectElementId) {
    const targetSelect = document.getElementById(selectElementId);
    if (targetSelect) {
      targetSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
    }
  } else {
    // Load both if no specific ID provided
    if (teacherSelect) teacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
    if (reportTeacherSelect) reportTeacherSelect.innerHTML = '<option value="">-- اختر المعلم --</option>';
  }
  
  // جلب المعلمين من collection classes
  let teachers = {};
  
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      const teacherName = classData.teacherName || classData.className || classId;
      teachers[classId] = teacherName;
    });
    
    // Sort teachers by name
    teachers = Object.fromEntries(
      Object.entries(teachers).sort((a, b) => a[1].localeCompare(b[1], 'ar'))
    );
    
  } catch (error) {
    console.error('Error loading teachers:', error);
    // Fallback to empty if error
    teachers = {};
  }
  
  // Add options to relevant selects
  const selectsToUpdate = selectElementId 
    ? [document.getElementById(selectElementId)].filter(Boolean)
    : [teacherSelect, reportTeacherSelect].filter(Boolean);
  
  selectsToUpdate.forEach(select => {
    for (const [id, name] of Object.entries(teachers)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${id} - ${name}`;
      select.appendChild(option);
    }
  });
}

// Make it global
window.loadViewerTeachers = loadViewerTeachers;

// Load Juz numbers (1-30)
window.loadViewerJuzNumbers = function() {
  const juzSelect = document.getElementById('viewerJuzNumber');
  if (!juzSelect) return;
  
  juzSelect.innerHTML = '<option value="">-- اختر الجزء --</option>';
  
  for (let i = 1; i <= 30; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `الجزء ${i}`;
    juzSelect.appendChild(option);
  }
};

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
    
    console.log('✅ تم حفظ الجزء بنجاح:', reportId);
    
    // 🎁 منح حافز تلقائي إذا تم إدخال تاريخ العرض (completed)
    if (normalizedDisplayDate) {
      console.log('🎁 محاولة منح حافز تلقائي للجزء...');
      await grantAutomaticIncentive(
        teacherId,
        teacherName,
        'juz',
        parseInt(juzNumber),
        reportId,
        studentName
      );
    }
    
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
    console.log(`📊 Total reports found: ${snapshot.size}`);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">لا توجد تقارير لهذا الطالب</p>';
      return;
    }
    
    // Convert to array and sort by createdAt (most recent first) and juzNumber
    const reports = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      reports.push({
        id: doc.id,
        data: data,
        // Convert Firestore timestamp to sortable number
        createdAtTime: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
        juzNumber: data.juzNumber || 0
      });
    });
    
    // Sort: First by juzNumber (ascending), then by createdAt (descending for same juz)
    reports.sort((a, b) => {
      if (a.juzNumber !== b.juzNumber) {
        return a.juzNumber - b.juzNumber; // Ascending juz number
      }
      return b.createdAtTime - a.createdAtTime; // Descending created time for same juz
    });
    
    // Debug: Log all reports details
    const reportsDetails = reports.map(r => ({
      id: r.id,
      juzNumber: r.data.juzNumber,
      lastLessonDate: r.data.lastLessonDate,
      displayDate: r.data.displayDate || 'لم يُعرض بعد',
      status: r.data.status,
      createdAt: r.data.createdAt ? new Date(r.createdAtTime).toLocaleString('ar-SA') : 'غير موجود'
    }));
    console.table(reportsDetails);
    
    let html = '';
    
    // Add header showing total reports count
    html += `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center; font-size: 18px; font-weight: bold;">
        📚 عدد التقارير المحملة: ${reports.length} ${reports.length === 1 ? 'تقرير' : reports.length === 2 ? 'تقريران' : 'تقارير'}
      </div>
    `;
    
    reports.forEach(report => {
      const docSnapshot = { id: report.id, data: () => report.data };
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

/**
 * 📊 حساب عدد أيام الدراسة (بدون الجمعة والسبت)
 * Calculate business days (excluding Friday and Saturday - weekend in Saudi Arabia)
 * @param {Date} startDate - تاريخ البداية (Gregorian Date object)
 * @param {Date} endDate - تاريخ النهاية (Gregorian Date object)
 * @returns {number} عدد أيام الدراسة فقط
 */
function calculateBusinessDays(startDate, endDate) {
  // Ensure we're working with Date objects
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Ensure start is before end
  if (start > end) {
    return calculateBusinessDays(end, start);
  }
  
  let businessDays = 0;
  const currentDate = new Date(start);
  
  // Loop through each day
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    
    // Friday = 5, Saturday = 6 (weekend in Saudi Arabia)
    // Sunday = 0, Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4 (working days)
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      businessDays++;
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return businessDays;
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
    
    // ✅ Calculate BUSINESS DAYS only (excluding Friday & Saturday)
    const diffInDays = calculateBusinessDays(gregorian1, gregorian2);
    
    console.log('⏱️ Accurate duration calculation (Business Days):', {
      hijri1: entry1.hijri,
      gregorian1: entry1.gregorian,
      hijri2: entry2.hijri,
      gregorian2: entry2.gregorian,
      businessDays: diffInDays
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
    
    console.log('✅ تم تحديث تاريخ العرض للجزء:', reportId);
    
    // 🎁 منح حافز تلقائي (الآن أصبح completed)
    console.log('🎁 محاولة منح حافز تلقائي بعد التحديث...');
    await grantAutomaticIncentive(
      currentData.teacherId,
      currentData.teacherName,
      'juz',
      currentData.juzNumber,
      reportId,
      currentData.studentName
    );
    
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
    
    // Extract Arabic name only for display
    const arabicName = extractArabicName(data.studentName);
    
    // Format display date from YYYY-MM-DD to DD-MM-YYYY
    const displayDateFormatted = formatDateForDisplay(data.displayDate);
    
    // Calculate duration in days
    const durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
    const durationText = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
    
    // Calculate total attempts (failed attempts + final success)
    const failedAttempts = data.failedAttempts || [];
    const totalAttempts = failedAttempts.length + 1;
    
    // Create notification message with new format
    const notificationMessage = `🎉 *رسالة اجتياز جزء* 🎉\n\nتم بحمد الله اجتياز الجزء بنجاح ✅\n\n👤 اسم الطالب: ${arabicName}\n👨‍🏫 اسم المعلم: ${data.teacherName || 'غير محدد'}\n📖 رقم الجزء: ${data.juzNumber}\n📅 تاريخ العرض: ${displayDateFormatted}\n⏱️ المدة المستغرقة: ${durationText}\n🔄 عدد مرات التسميع: ${totalAttempts}\n🎙️ المستمع: الشيخ ${data.viewerName}`;
    
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
      viewerName: data.viewerName,
      viewerId: data.viewerId || 'MZNBL01',
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
    
    // Show success alert
    alert('✅ تم إرسال التقرير للمعلم والطالب بنجاح!');
    
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
    
    // Extract Arabic name only for display
    const arabicName = extractArabicName(data.studentName);
    
    // Format display date from YYYY-MM-DD to DD-MM-YYYY
    const displayDateFormatted = formatDateForDisplay(data.displayDate);
    
    // Calculate duration in days
    const durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
    const durationText = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
    
    // Calculate total attempts (failed attempts + final success)
    const failedAttempts = data.failedAttempts || [];
    const totalAttempts = failedAttempts.length + 1;
    
    // Create shareable text with new format
    const shareText = `🎉 *رسالة اجتياز جزء* 🎉\n\nتم بحمد الله اجتياز الجزء بنجاح ✅\n\n👤 اسم الطالب: ${arabicName}\n👨‍🏫 اسم المعلم: ${data.teacherName || 'غير محدد'}\n📖 رقم الجزء: ${data.juzNumber}\n📅 تاريخ العرض: ${displayDateFormatted}\n⏱️ المدة المستغرقة: ${durationText}\n🔄 عدد مرات التسميع: ${totalAttempts}\n🎙️ المستمع: الشيخ ${data.viewerName}`;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(shareText);
    
    // Show success alert
    alert('📋 تم نسخ التقرير إلى الحافظة!');
    
  } catch (error) {
    console.error('Error sharing report:', error);
    alert('❌ حدث خطأ في نسخ التقرير');
  }
};

/**
 * Send Hizb report to teacher and student
 */
window.sendHizbReportToTeacher = async function(reportId) {
  try {
    // Get report data
    const reportDoc = await getDocs(query(collection(db, 'hizbDisplays'), where('__name__', '==', reportId)));
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
    
    // Extract Arabic name only for display
    const arabicName = extractArabicName(data.studentName);
    
    // Format display date from YYYY-MM-DD to DD-MM-YYYY
    const displayDateFormatted = formatDateForDisplay(data.displayDate);
    
    // Get Hizb data description
    const hizbInfo = quranHizbData.find(h => h.number === data.hizbNumber);
    const hizbDescription = hizbInfo ? hizbInfo.description : 'غير محدد';
    
    // Calculate duration in days
    const durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
    const durationText = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
    
    // Calculate total attempts (failed attempts + final success)
    const failedAttempts = data.failedAttempts || [];
    const totalAttempts = failedAttempts.length + 1;
    
    // Create notification message with new format
    const notificationMessage = `🎉 *رسالة اجتياز حزب* 🎉\n\nتم بحمد الله اجتياز الحزب بنجاح ✅\n\n👤 اسم الطالب: ${arabicName}\n👨‍🏫 اسم المعلم: ${data.teacherName || 'غير محدد'}\n📖 رقم الحزب: ${data.hizbNumber}\n📚 مقدار الحزب: ${hizbDescription}\n📅 تاريخ العرض: ${displayDateFormatted}\n⏱️ المدة المستغرقة: ${durationText}\n🔄 عدد مرات التسميع: ${totalAttempts}\n🎙️ المستمع: الشيخ ${data.viewerName}`;
    
    console.log('📤 Sending Hizb notification:', {
      teacherId: data.teacherId,
      studentId: data.studentId,
      teacherName: data.teacherName,
      message: notificationMessage
    });
    
    const notificationData = {
      type: 'hizb_passed',
      teacherId: data.teacherId,
      studentId: data.studentId,
      studentName: data.studentName,
      teacherName: data.teacherName || 'غير محدد',
      hizbNumber: data.hizbNumber,
      displayDate: data.displayDate,
      viewerName: data.viewerName,
      viewerId: data.viewerId || 'MZNBL01',
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
    
    // Show success alert
    alert('✅ تم إرسال التقرير للمعلم والطالب بنجاح!');
    
  } catch (error) {
    console.error('Error sending Hizb report:', error);
    alert('❌ حدث خطأ في إرسال التقرير');
  }
};

/**
 * Share Hizb report (copy to clipboard)
 */
window.shareHizbReport = async function(reportId) {
  try {
    // Get report data
    const reportDoc = await getDocs(query(collection(db, 'hizbDisplays'), where('__name__', '==', reportId)));
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
    
    // Extract Arabic name only for display
    const arabicName = extractArabicName(data.studentName);
    
    // Format display date from YYYY-MM-DD to DD-MM-YYYY
    const displayDateFormatted = formatDateForDisplay(data.displayDate);
    
    // Get Hizb data description
    const hizbInfo = quranHizbData.find(h => h.number === data.hizbNumber);
    const hizbDescription = hizbInfo ? hizbInfo.description : 'غير محدد';
    
    // Calculate duration in days
    const durationDays = calculateHijriDaysDifference(data.lastLessonDate, data.displayDate);
    const durationText = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
    
    // Calculate total attempts (failed attempts + final success)
    const failedAttempts = data.failedAttempts || [];
    const totalAttempts = failedAttempts.length + 1;
    
    // Create shareable text with new format
    const shareText = `🎉 *رسالة اجتياز حزب* 🎉\n\nتم بحمد الله اجتياز الحزب بنجاح ✅\n\n👤 اسم الطالب: ${arabicName}\n👨‍🏫 اسم المعلم: ${data.teacherName || 'غير محدد'}\n📖 رقم الحزب: ${data.hizbNumber}\n📚 مقدار الحزب: ${hizbDescription}\n📅 تاريخ العرض: ${displayDateFormatted}\n⏱️ المدة المستغرقة: ${durationText}\n🔄 عدد مرات التسميع: ${totalAttempts}\n🎙️ المستمع: الشيخ ${data.viewerName}`;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(shareText);
    
    // Show success alert
    alert('📋 تم نسخ التقرير إلى الحافظة!');
    
  } catch (error) {
    console.error('Error sharing Hizb report:', error);
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
  
  if (!badge || !btn) {
    console.warn('⚠️ viewerInboxBadge or viewerInboxBtn not found');
    return;
  }
  
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
    
    // Get teacher names from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
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
        
        // Get teacher name from classes collection based on teacherId
        const teacherName = teacherNamesMap[data.teacherId] || data.teacherName || 'غير محدد';
        
        queue.push({
          reportId: reportId,
          studentId: data.studentId,
          studentName: data.studentName,
          teacherId: data.teacherId,
          teacherName: teacherName,
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
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -15px; padding: 0 15px;">
        <table class="keep-table" style="width: 100%; min-width: 600px; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
              <th style="padding: 10px 8px; text-align: right; border-radius: 8px 0 0 0; width: 40px;">#</th>
              <th style="padding: 10px 8px; text-align: right; min-width: 120px;">اسم الطالب</th>
              <th style="padding: 10px 8px; text-align: right; min-width: 100px;">اسم المعلم</th>
              <th style="padding: 10px 8px; text-align: center; width: 80px;">الجزء</th>
              <th style="padding: 10px 8px; text-align: center; border-radius: 0 8px 0 0; min-width: 100px;">منذ</th>
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
      
      // Extract Arabic name only
      const displayName = extractArabicName(student.studentName);
      
      tableHTML += `
        <tr onclick="window.showJuzDisplayOptions('${student.reportId}', '${student.studentName}', ${student.juzNumber})" style="background: ${rowColor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='${rowColor}'">
          <td style="padding: 10px 8px; font-weight: bold; color: #667eea;">${index + 1}</td>
          <td style="padding: 10px 8px; font-weight: bold;">${displayName}</td>
          <td style="padding: 10px 8px; color: #666;">${student.teacherName}</td>
          <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #764ba2;">الجزء ${student.juzNumber}</td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="padding: 5px 12px; background: ${priorityColor}; color: white; border-radius: 15px; font-weight: bold; font-size: 12px; white-space: nowrap;">
              ${daysText}
            </span>
          </td>
        </tr>
      `;
    });
    
    tableHTML += '</tbody></table></div>';
    
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

/**
 * Load Hizb Queue (similar to loadDailyQueue but for Ahzab)
 */
window.loadHizbQueue = async function() {
  const container = document.getElementById('hizbQueueContainer');
  
  if (!container) return;
  
  container.innerHTML = '<p style="text-align: center; color: #667eea; padding: 20px;">⏳ جاري تحميل جدول الأحزاب...</p>';
  
  try {
    console.log('📗 Loading hizb queue...');
    const startTime = performance.now();
    
    // Get today's Hijri date
    const todayHijri = getTodayForStorage(); // Returns YYYY-MM-DD
    
    // Get all hizbDisplays that don't have displayDate yet (pending displays)
    const q = query(
      collection(db, 'hizbDisplays'),
      where('status', '==', 'incomplete')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">✅ لا توجد طلاب في قائمة انتظار الأحزاب</p>';
      return;
    }
    
    // Process students
    const queue = [];
    
    // Get teacher names from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
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
        
        // Get teacher name from classes collection based on teacherId
        const teacherName = teacherNamesMap[data.teacherId] || data.teacherName || 'غير محدد';
        
        queue.push({
          reportId: reportId,
          studentId: data.studentId,
          studentName: data.studentName,
          teacherId: data.teacherId,
          teacherName: teacherName,
          hizbNumber: data.hizbNumber,
          lastLessonDate: data.lastLessonDate,
          lastAttemptDate: data.lastAttemptDate || null,
          failedAttempts: data.failedAttempts || [],
          priorityDate: priorityDate,
          daysSinceAttempt: daysSinceAttempt,
          daysSinceLesson: daysSinceLesson
        });
      }
    });
    
    // Sort by two criteria (same logic as Juz Queue)
    queue.sort((a, b) => {
      if (b.daysSinceAttempt !== a.daysSinceAttempt) {
        return b.daysSinceAttempt - a.daysSinceAttempt;
      }
      return b.daysSinceLesson - a.daysSinceLesson;
    });
    
    const endTime = performance.now();
    console.log(`✅ Hizb queue loaded in ${Math.round(endTime - startTime)}ms`);
    console.log(`📊 Total students in hizb queue: ${queue.length}`);
    
    // Build table HTML
    if (queue.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">✅ لا توجد طلاب في قائمة انتظار الأحزاب</p>';
      return;
    }
    
    let tableHTML = `
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -15px; padding: 0 15px;">
        <table class="keep-table" style="width: 100%; min-width: 600px; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
              <th style="padding: 10px 8px; text-align: right; border-radius: 8px 0 0 0; width: 40px;">#</th>
              <th style="padding: 10px 8px; text-align: right; min-width: 120px;">اسم الطالب</th>
              <th style="padding: 10px 8px; text-align: right; min-width: 100px;">اسم المعلم</th>
              <th style="padding: 10px 8px; text-align: center; width: 80px;">الحزب</th>
              <th style="padding: 10px 8px; text-align: center; border-radius: 0 8px 0 0; min-width: 100px;">منذ</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    queue.forEach((student, index) => {
      const rowColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      // Color based on days since LESSON
      const priorityColor = student.daysSinceLesson >= 7 ? '#dc3545' : student.daysSinceLesson >= 5 ? '#ffc107' : '#28a745';
      // Display days since LESSON
      const daysText = student.daysSinceLesson === 1 ? 'يوم واحد' : student.daysSinceLesson === 2 ? 'يومان' : `${student.daysSinceLesson} أيام`;
      
      // Extract Arabic name only
      const displayName = extractArabicName(student.studentName);
      
      tableHTML += `
        <tr onclick="window.showHizbDisplayOptions('${student.reportId}', '${student.studentName}', ${student.hizbNumber})" style="background: ${rowColor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='${rowColor}'">
          <td style="padding: 10px 8px; font-weight: bold; color: #667eea;">${index + 1}</td>
          <td style="padding: 10px 8px; font-weight: bold;">${displayName}</td>
          <td style="padding: 10px 8px; color: #666;">${student.teacherName}</td>
          <td style="padding: 10px 8px; text-align: center; font-weight: bold; color: #764ba2;">الحزب ${student.hizbNumber}</td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="padding: 5px 12px; background: ${priorityColor}; color: white; border-radius: 15px; font-weight: bold; font-size: 12px; white-space: nowrap;">
              ${daysText}
            </span>
          </td>
        </tr>
      `;
    });
    
    tableHTML += '</tbody></table></div>';
    
    container.innerHTML = tableHTML;
    
  } catch (error) {
    console.error('Error loading hizb queue:', error);
    container.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">❌ حدث خطأ في تحميل جدول الأحزاب</p>';
  }
};

/**
 * Show Hizb Display Options Popup (Placeholder for now)
 */
window.showHizbDisplayOptions = async function(reportId, studentName, hizbNumber) {
  try {
    console.log('📗 Opening options for Hizb report:', reportId);
    
    // Get report data from hizbDisplays collection
    const reportDoc = await getDoc(doc(db, 'hizbDisplays', reportId));
    
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
        <div onclick="window.showHizbAttemptsHistory('${reportId}')" style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-right: 3px solid #ffc107; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#ffe082'" onmouseout="this.style.background='#fff3cd'">
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
      const totalAttempts = failedAttempts.length;
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
    overlay.id = 'hizbDisplayOptionsOverlay';
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
        📗 خيارات عرض الحزب
      </h2>
      
      <div style="text-align: center; color: #666; margin-bottom: 12px; padding: 10px; background: #e3f2fd; border-radius: 6px;">
        <div style="font-weight: bold; font-size: 15px; color: #333;">${studentName}</div>
        <div style="margin-top: 3px; color: #764ba2; font-weight: bold; font-size: 14px;">الحزب ${hizbNumber}</div>
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
        <button class="option-btn pass-btn" onclick="window.handleHizbPass('${reportId}')">
          ✅ اجتاز
        </button>
        
        <button class="option-btn fail-btn" onclick="window.handleHizbFail('${reportId}')">
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
            <button class="note-tag" onclick="window.addHizbNoteTag('ضعف في التجويد')">ضعف في التجويد</button>
            <button class="note-tag" onclick="window.addHizbNoteTag('ضعف في الحفظ')">ضعف في الحفظ</button>
            <button class="note-tag" onclick="window.addHizbNoteTag('القراءة سريعة')">القراءة سريعة</button>
            <button class="note-tag" onclick="window.addHizbNoteTag('ألحان جلية كثيرة')">ألحان جلية كثيرة</button>
          </div>
        </div>
        
        <textarea 
          id="newHizbNoteInput" 
          class="new-note-input" 
          placeholder="أضف ملاحظة جديدة..."
        ></textarea>
        
        <button class="save-note-btn" onclick="window.saveHizbNote('${reportId}')">
          💾 حفظ الملاحظة
        </button>
        
        <div class="previous-notes" id="previousHizbNotesList">
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
      
      <button onclick="window.handleRemoveFromHizbQueue('${reportId}', '${studentName}')" 
              style="background: #dc3545; color: white; padding: 10px 16px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; margin-top: 12px; width: 100%; transition: all 0.2s;" 
              onmouseover="this.style.background='#c82333'" 
              onmouseout="this.style.background='#dc3545'">
        🗑️ حذف من القائمة
      </button>
      
      <button class="close-btn" onclick="document.getElementById('hizbDisplayOptionsOverlay').remove()">
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
    console.error('Error showing Hizb options:', error);
    alert('❌ حدث خطأ في عرض خيارات الحزب');
  }
};

/**
 * Show Hizb Report Options (Placeholder for now)
 */
window.showHizbReportOptions = function() {
  alert('🚧 نظام تصدير تقارير الأحزاب قيد التطوير\n\nسيتم إضافة هذه الميزة قريباً بإذن الله');
};

/**
 * Handle Hizb Pass - Opens report for updating display date
 */
window.handleHizbPass = async function(reportId) {
  try {
    console.log('✅ Hizb Pass clicked for report:', reportId);
    
    // Close the options popup
    const overlay = document.getElementById('hizbDisplayOptionsOverlay');
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
    await updateDoc(doc(db, 'hizbDisplays', reportId), {
      viewerName: viewerName,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Hizb viewer name updated:', viewerName);
    
    // Open display date form modal (instead of showing alert)
    await showDisplayDateModal(reportId, 'hizb', viewerName);
    
  } catch (error) {
    console.error('Error handling Hizb pass:', error);
    alert('❌ حدث خطأ في تسجيل اجتياز الحزب');
  }
};

/**
 * Show Display Date Modal - Universal modal for recording display date after passing Juz or Hizb
 * @param {string} reportId - The report ID
 * @param {string} type - 'juz' or 'hizb'
 * @param {string} viewerName - The name of the viewer who evaluated
 */
async function showDisplayDateModal(reportId, type, viewerName) {
  try {
    console.log(`📅 Opening display date modal for ${type} report:`, reportId);
    
    // Validate type
    if (!['juz', 'hizb'].includes(type)) {
      console.error('Invalid type:', type);
      alert('❌ نوع غير صحيح');
      return;
    }
    
    // Get collection name based on type
    const collectionName = type === 'juz' ? 'juzDisplays' : 'hizbDisplays';
    
    // Fetch report data
    const reportDoc = await getDoc(doc(db, collectionName, reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const reportData = reportDoc.data();
    const studentName = reportData.studentName;
    const itemNumber = type === 'juz' ? reportData.juzNumber : reportData.hizbNumber;
    const itemLabel = type === 'juz' ? 'الجزء' : 'الحزب';
    
    // Create overlay
    const overlayId = `displayDateModal_${type}_${reportId}`;
    const existingOverlay = document.getElementById(overlayId);
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = overlayId;
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
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .date-input-field {
          width: 100%;
          padding: 12px;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          font-size: 16px;
          text-align: center;
          direction: ltr;
          transition: all 0.2s;
        }
        .date-input-field:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .modal-action-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          margin: 5px;
        }
        .modal-action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .today-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        .save-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .close-btn {
          background: #dc3545;
          color: white;
        }
        .action-buttons-container {
          display: none;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #f0f0f0;
        }
      </style>
      
      <div style="
        background: white;
        border-radius: 15px;
        padding: 30px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
        direction: rtl;
      ">
        <h2 style="
          color: #667eea;
          margin: 0 0 10px 0;
          text-align: center;
          font-size: 22px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        ">
          📅 تسجيل اجتياز ${itemLabel} ${itemNumber}
        </h2>
        
        <div style="text-align: center; margin-bottom: 20px; color: #666; font-size: 14px;">
          <div style="margin-bottom: 5px;">
            <strong>الطالب:</strong> ${extractArabicName(studentName)}
          </div>
          <div>
            <strong>العارض:</strong> ${viewerName}
          </div>
        </div>
        
        <div id="formContainer_${reportId}">
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333; font-size: 14px;">
              📅 تاريخ العرض (هجري):
            </label>
            <input 
              type="text" 
              id="displayDateInput_${reportId}" 
              class="date-input-field"
              placeholder="DD-MM-YYYY (مثال: 5-6-1447)"
              autocomplete="off"
            />
          </div>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <button onclick="setTodayDateInModal('${reportId}')" class="modal-action-btn today-btn">
              📅 اليوم
            </button>
          </div>
          
          <button onclick="saveDisplayDateFromModal('${reportId}', '${type}')" class="modal-action-btn save-btn" style="width: 100%;">
            💾 حفظ وإنهاء
          </button>
        </div>
        
        <div id="successContainer_${reportId}" class="action-buttons-container">
          <div style="text-align: center; margin-bottom: 15px; color: #28a745; font-size: 16px; font-weight: bold;">
            ✅ تم حفظ تاريخ العرض بنجاح!
          </div>
          
          <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
            <button onclick="sendReportToTeacherFromModal('${reportId}', '${type}')" class="modal-action-btn" style="background: #28a745; color: white; flex: 1; min-width: 200px;">
              📤 إرسال للمعلم
            </button>
            <button onclick="shareReportFromModal('${reportId}', '${type}')" class="modal-action-btn" style="background: #17a2b8; color: white; flex: 1; min-width: 200px;">
              📋 مشاركة التقرير
            </button>
            <button onclick="editReportFromModal('${reportId}', '${type}')" class="modal-action-btn" style="background: #ffc107; color: #333; flex: 1; min-width: 200px;">
              ✏️ تعديل البيانات
            </button>
          </div>
        </div>
        
        <button onclick="document.getElementById('${overlayId}').remove()" class="modal-action-btn close-btn" style="width: 100%; margin-top: 15px;">
          إغلاق
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
  } catch (error) {
    console.error('Error showing display date modal:', error);
    alert('❌ حدث خطأ في عرض نموذج تسجيل التاريخ');
  }
}

/**
 * Set today's date in the modal input field
 */
window.setTodayDateInModal = function(reportId) {
  const input = document.getElementById(`displayDateInput_${reportId}`);
  if (input) {
    const todayAccurate = getTodayForStorage(); // YYYY-MM-DD
    const [year, month, day] = todayAccurate.split('-');
    const todayDisplay = `${day}-${month}-${year}`; // DD-MM-YYYY
    input.value = todayDisplay;
    input.focus();
  }
};

/**
 * Save display date from modal
 */
window.saveDisplayDateFromModal = async function(reportId, type) {
  try {
    const input = document.getElementById(`displayDateInput_${reportId}`);
    let displayDate = input.value.trim();
    
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
    
    // Get collection name
    const collectionName = type === 'juz' ? 'juzDisplays' : 'hizbDisplays';
    
    // Get current report data to calculate attempts
    const reportDoc = await getDoc(doc(db, collectionName, reportId));
    const currentData = reportDoc.data();
    const failedAttempts = currentData.failedAttempts || [];
    
    // Calculate total attempts = 1 (current success) + failed attempts
    const totalAttempts = failedAttempts.length + 1;
    
    // Update Firestore
    await updateDoc(doc(db, collectionName, reportId), {
      displayDate: normalizedDate, // Store in YYYY-MM-DD format
      status: 'completed',
      attemptsCount: totalAttempts,
      updatedAt: serverTimestamp()
    });
    
    console.log(`✅ ${type} display date saved:`, normalizedDate);
    
    // 🎁 منح حافز تلقائي (الآن أصبح completed)
    console.log(`🎁 محاولة منح حافز تلقائي للـ ${type}...`);
    await grantAutomaticIncentive(
      currentData.teacherId,
      currentData.teacherName,
      type, // 'juz' أو 'hizb'
      type === 'juz' ? currentData.juzNumber : currentData.hizbNumber,
      reportId,
      currentData.studentName
    );
    
    // Hide form, show success and action buttons
    const formContainer = document.getElementById(`formContainer_${reportId}`);
    const successContainer = document.getElementById(`successContainer_${reportId}`);
    
    if (formContainer) formContainer.style.display = 'none';
    if (successContainer) successContainer.style.display = 'block';
    
    // Reload appropriate queue (student removed from queue)
    if (type === 'juz') {
      await loadDailyQueue();
    } else {
      await loadHizbQueue();
    }
    
  } catch (error) {
    console.error('Error saving display date:', error);
    alert('❌ حدث خطأ في حفظ تاريخ العرض');
  }
};

/**
 * Send report to teacher from modal
 */
window.sendReportToTeacherFromModal = async function(reportId, type) {
  try {
    // Close modal first
    const overlayId = `displayDateModal_${type}_${reportId}`;
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    
    // Call existing send function based on type
    if (type === 'juz') {
      await window.sendReportToTeacher(reportId);
    } else {
      await window.sendHizbReportToTeacher(reportId);
    }
  } catch (error) {
    console.error('Error sending report:', error);
    alert('❌ حدث خطأ في إرسال التقرير');
  }
};

/**
 * Share report from modal
 */
window.shareReportFromModal = async function(reportId, type) {
  try {
    // Close modal first
    const overlayId = `displayDateModal_${type}_${reportId}`;
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    
    // Call existing share function based on type
    if (type === 'juz') {
      await window.shareReport(reportId);
    } else {
      await window.shareHizbReport(reportId);
    }
  } catch (error) {
    console.error('Error sharing report:', error);
    alert('❌ حدث خطأ في مشاركة التقرير');
  }
};

/**
 * Edit report from modal
 */
window.editReportFromModal = function(reportId, type) {
  try {
    // Close modal first
    const overlayId = `displayDateModal_${type}_${reportId}`;
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.remove();
    
    // Reopen the appropriate options modal
    if (type === 'juz') {
      // We need to get student name and juz number - open report in reports tab
      window.openQueueReport(reportId);
    } else {
      // For Hizb, we can reopen showHizbDisplayOptions
      // But we need student name and hizbNumber - let's open report
      alert('🚧 للتعديل، يرجى الذهاب لقسم التقارير واختيار الطالب والمعلم');
    }
  } catch (error) {
    console.error('Error editing report:', error);
    alert('❌ حدث خطأ في فتح نموذج التعديل');
  }
};

/**
 * Handle Hizb Fail - Records failed attempt and moves to bottom of queue
 */
window.handleHizbFail = async function(reportId) {
  try {
    console.log('❌ Hizb Fail clicked for report:', reportId);
    
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
    
    // Get current report data from hizbDisplays
    const reportDoc = await getDoc(doc(db, 'hizbDisplays', reportId));
    
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
    await updateDoc(doc(db, 'hizbDisplays', reportId), {
      failedAttempts: failedAttempts,
      lastAttemptDate: getTodayForStorage(),
      viewerName: viewerName,
      updatedAt: serverTimestamp()
    });
    
    // Close popup
    const overlay = document.getElementById('hizbDisplayOptionsOverlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Reload Hizb queue to show updated order
    if (typeof window.loadHizbQueue === 'function') {
      await window.loadHizbQueue();
    }
    
    // Show success message
    alert(
      `✅ تم تسجيل محاولة فاشلة للحزب\n\n` +
      `📊 التفاصيل:\n` +
      `• العارض: ${viewerName}\n` +
      `• رقم المحاولة: ${failedAttempt.attemptNumber}\n` +
      `• التنبيهات: ${attemptDetails.warnings}\n` +
      `• الغلطات: ${attemptDetails.mistakes}\n` +
      `• الألحان الجلية: ${attemptDetails.majorMelodies}\n\n` +
      `تم نقل الطالب لأسفل القائمة`
    );
    
  } catch (error) {
    console.error('Error handling Hizb fail:', error);
    alert('❌ حدث خطأ في تسجيل المحاولة الفاشلة للحزب');
  }
};

/**
 * Handle Remove from Hizb Queue - Delete student from Hizb queue completely
 */
window.handleRemoveFromHizbQueue = async function(reportId, studentName) {
  try {
    // Confirm deletion
    const confirmed = confirm(
      `⚠️ تأكيد الحذف\n\n` +
      `هل أنت متأكد من حذف الطالب:\n"${studentName}"\n\n` +
      `من قائمة الجاهزين لعرض الحزب؟\n\n` +
      `⚠️ سيتم حذف جميع البيانات المرتبطة بهذا الحزب\n` +
      `(الملاحظات، المحاولات الفاشلة، إلخ...)\n\n` +
      `هذا الإجراء لا يمكن التراجع عنه!`
    );
    
    if (!confirmed) {
      console.log('❌ User cancelled deletion');
      return;
    }
    
    console.log('🗑️ Deleting Hizb report:', reportId);
    
    // Delete the document from hizbDisplays collection
    await deleteDoc(doc(db, 'hizbDisplays', reportId));
    
    console.log('✅ Hizb report deleted successfully');
    
    // Close the popup
    const overlay = document.getElementById('hizbDisplayOptionsOverlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Reload Hizb queue to show updated list
    if (typeof window.loadHizbQueue === 'function') {
      await window.loadHizbQueue();
    }
    
    // Show success message
    alert(`✅ تم حذف الطالب من قائمة الأحزاب بنجاح\n\n${studentName}`);
    
  } catch (error) {
    console.error('Error removing from Hizb queue:', error);
    alert('❌ حدث خطأ في حذف الطالب من قائمة الأحزاب');
  }
};

/**
 * Add note tag to Hizb note input
 */
window.addHizbNoteTag = function(tag) {
  const input = document.getElementById('newHizbNoteInput');
  if (input) {
    const currentValue = input.value.trim();
    input.value = currentValue ? `${currentValue}\n• ${tag}` : `• ${tag}`;
    input.focus();
  }
};

/**
 * Save Hizb note
 */
window.saveHizbNote = async function(reportId) {
  try {
    const input = document.getElementById('newHizbNoteInput');
    const noteText = input.value.trim();
    
    if (!noteText) {
      alert('⚠️ يرجى كتابة ملاحظة أولاً');
      return;
    }
    
    // Get current notes
    const reportDoc = await getDoc(doc(db, 'hizbDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const currentNotes = reportDoc.data().notes || [];
    
    // Add new note
    const newNote = {
      text: noteText,
      date: getTodayForStorage(),
      timestamp: new Date()
    };
    
    currentNotes.push(newNote);
    
    // Update in Firestore
    await updateDoc(doc(db, 'hizbDisplays', reportId), {
      notes: currentNotes,
      updatedAt: serverTimestamp()
    });
    
    // Clear input
    input.value = '';
    
    // Reload notes list
    const notesList = document.getElementById('previousHizbNotesList');
    if (notesList) {
      notesList.innerHTML = currentNotes.map(note => `
        <div class="note-item">
          <div class="note-date">${note.date || 'غير محدد'}</div>
          <div class="note-text">${note.text}</div>
        </div>
      `).join('');
    }
    
    alert('✅ تم حفظ الملاحظة بنجاح');
    
  } catch (error) {
    console.error('Error saving Hizb note:', error);
    alert('❌ حدث خطأ في حفظ الملاحظة');
  }
};

/**
 * Show Hizb Attempts History
 */
window.showHizbAttemptsHistory = async function(reportId) {
  try {
    const reportDoc = await getDoc(doc(db, 'hizbDisplays', reportId));
    
    if (!reportDoc.exists()) {
      alert('❌ التقرير غير موجود');
      return;
    }
    
    const failedAttempts = reportDoc.data().failedAttempts || [];
    
    if (failedAttempts.length === 0) {
      alert('ℹ️ لا توجد محاولات سابقة لهذا الحزب');
      return;
    }
    
    // Create overlay
    const overlay = document.createElement('div');
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
      backdrop-filter: blur(3px);
    `;
    
    // Create popup
    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 20px;
      width: 90%;
      max-width: 500px;
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      direction: rtl;
    `;
    
    let attemptsHtml = `
      <h2 style="color: #667eea; margin-bottom: 15px; text-align: center;">
        📊 سجل المحاولات الفاشلة - الحزب
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 10px; text-align: center; border-radius: 6px 0 0 0;">#</th>
            <th style="padding: 10px; text-align: right;">التاريخ</th>
            <th style="padding: 10px; text-align: right;">العارض</th>
            <th style="padding: 10px; text-align: center;">⚠️</th>
            <th style="padding: 10px; text-align: center;">❌</th>
            <th style="padding: 10px; text-align: center; border-radius: 0 6px 0 0;">🎵</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    failedAttempts.forEach((attempt, index) => {
      const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      const formattedDate = formatDateForDisplay(attempt.date);
      
      attemptsHtml += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; text-align: center; font-weight: bold; color: #667eea;">${attempt.attemptNumber}</td>
          <td style="padding: 10px; font-size: 13px;">${formattedDate}</td>
          <td style="padding: 10px; font-size: 13px;">${attempt.viewerName}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold; color: #ffc107;">${attempt.warnings || 0}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold; color: #dc3545;">${attempt.mistakes || 0}</td>
          <td style="padding: 10px; text-align: center; font-weight: bold; color: #e83e8c;">${attempt.majorMelodies || 0}</td>
        </tr>
      `;
    });
    
    attemptsHtml += `
        </tbody>
      </table>
      <button onclick="this.closest('div').parentElement.remove()" 
              style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-top: 15px; width: 100%;">
        إغلاق
      </button>
    `;
    
    popup.innerHTML = attemptsHtml;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
  } catch (error) {
    console.error('Error showing Hizb attempts history:', error);
    alert('❌ حدث خطأ في عرض سجل المحاولات');
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
      
      <button onclick="window.handleRemoveFromQueue('${reportId}', '${studentName}')" 
              style="background: #dc3545; color: white; padding: 10px 16px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; margin-top: 12px; width: 100%; transition: all 0.2s;" 
              onmouseover="this.style.background='#c82333'" 
              onmouseout="this.style.background='#dc3545'">
        🗑️ حذف من القائمة
      </button>
      
      <button class="close-btn" onclick="document.getElementById('juzDisplayOptionsOverlay').remove()">
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
    
    // Open display date form modal (instead of going to reports tab)
    await showDisplayDateModal(reportId, 'juz', viewerName);
    
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

// Handle Remove from Queue - Delete student from queue completely
window.handleRemoveFromQueue = async function(reportId, studentName) {
  try {
    // Confirm deletion
    const confirmed = confirm(
      `⚠️ تأكيد الحذف\n\n` +
      `هل أنت متأكد من حذف الطالب:\n"${studentName}"\n\n` +
      `من قائمة الجاهزين للعرض؟\n\n` +
      `⚠️ سيتم حذف جميع البيانات المرتبطة بهذا الجزء\n` +
      `(الملاحظات، المحاولات الفاشلة، إلخ...)\n\n` +
      `هذا الإجراء لا يمكن التراجع عنه!`
    );
    
    if (!confirmed) {
      console.log('❌ User cancelled deletion');
      return;
    }
    
    console.log('🗑️ Deleting report:', reportId);
    
    // Delete the document from juzDisplays collection
    await deleteDoc(doc(db, 'juzDisplays', reportId));
    
    console.log('✅ Report deleted successfully');
    
    // Close the popup
    const overlay = document.getElementById('juzDisplayOptionsOverlay');
    if (overlay) {
      overlay.remove();
    }
    
    // Reload queue to show updated list
    await loadDailyQueue();
    
    // Show success message
    alert(`✅ تم حذف الطالب من القائمة بنجاح\n\n${studentName}`);
    
  } catch (error) {
    console.error('Error removing from queue:', error);
    alert('❌ حدث خطأ في حذف الطالب من القائمة');
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

// Show report type selection (General or Class-specific)
window.showJuzReportOptions = function() {
  const overlay = document.createElement('div');
  overlay.id = 'reportTypeOverlay';
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
    <div style="background: white; border-radius: 15px; padding: 30px; width: 90%; max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); animation: slideUp 0.3s ease; direction: rtl;">
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
      
      <h2 style="color: #667eea; margin: 0 0 25px 0; text-align: center; font-size: 24px;">
        📊 اختر نوع التقرير
      </h2>
      
      <button onclick="document.getElementById('reportTypeOverlay').remove(); window.showGeneralReportOptions();" 
        style="width: 100%; padding: 18px; margin-bottom: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        📈 التقرير العام
        <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">إحصائيات شاملة لجميع الحلقات</div>
      </button>
      
      <button onclick="document.getElementById('reportTypeOverlay').remove(); window.showClassReportOptions();" 
        style="width: 100%; padding: 18px; margin-bottom: 15px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);">
        👥 تقرير حلقة
        <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">تفاصيل طلاب حلقة معينة</div>
      </button>
      
      <button onclick="document.getElementById('reportTypeOverlay').remove();" 
        style="width: 100%; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
        ❌ إلغاء
      </button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
};

// Show general report options (original function)
window.showGeneralReportOptions = function() {
  // Use the accurate Hijri months generation function
  const monthOptions = generateHijriMonthsOptions();
  
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
        <!-- From Date -->
        <div style="margin-bottom: 15px;">
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            📅 من تاريخ:
          </label>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
            <select id="reportFromDay" style="padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
              <option value="">اليوم</option>
            </select>
            <select id="reportFromMonth" onchange="window.updateDaysForDatePicker('reportFromYear', 'reportFromMonth', 'reportFromDay')" style="padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
              ${generateMonthsForYear()}
            </select>
            <select id="reportFromYear" onchange="window.updateMonthsForYear('reportFromYear', 'reportFromMonth', 'reportFromDay')" style="padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
              ${generateHijriYearsOptions()}
            </select>
          </div>
        </div>
        <!-- To Date -->
        <div>
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            📅 إلى تاريخ:
          </label>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
            <select id="reportToDay" style="padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
              <option value="">اليوم</option>
            </select>
            <select id="reportToMonth" onchange="window.updateDaysForDatePicker('reportToYear', 'reportToMonth', 'reportToDay')" style="padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
              ${generateMonthsForYear()}
            </select>
            <select id="reportToYear" onchange="window.updateMonthsForYear('reportToYear', 'reportToMonth', 'reportToDay')" style="padding: 10px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px;">
              ${generateHijriYearsOptions()}
            </select>
          </div>
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
  
  // Initialize current date in custom range fields
  setTimeout(() => {
    initializeCurrentDateInModal('report');
  }, 100);
  
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

// Show class (teacher) report options
window.showClassReportOptions = async function() {
  try {
    // Use the accurate Hijri months generation function
    const monthOptions = generateHijriMonthsOptions();
    
    // جلب المعلمين من collection classes
    let teachers = {};
    
    try {
      const classesSnapshot = await getDocs(collection(db, 'classes'));
      classesSnapshot.forEach(classDoc => {
        const classData = classDoc.data();
        const classId = classData.classId || classDoc.id;
        const teacherName = classData.teacherName || classData.className || classId;
        teachers[classId] = teacherName;
      });
      
      // Sort teachers by name
      teachers = Object.fromEntries(
        Object.entries(teachers).sort((a, b) => a[1].localeCompare(b[1], 'ar'))
      );
      
    } catch (error) {
      console.error('Error loading teachers:', error);
      // Fallback to empty if error
      teachers = {};
    }
    
    let teacherOptions = '';
    for (const [id, name] of Object.entries(teachers)) {
      teacherOptions += `<option value="${id}">${name}</option>`;
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'classReportOverlay';
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
        <h2 style="color: #28a745; margin: 0 0 20px 0; text-align: center; font-size: 22px;">
          👥 تقرير حلقة
        </h2>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            👨‍🏫 اختر المعلم (الحلقة):
          </label>
          <select id="classReportTeacher" style="width: 100%; padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px; cursor: pointer;">
            ${teacherOptions}
          </select>
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            📅 اختر الفترة:
          </label>
          <select id="classReportPeriodType" onchange="window.toggleClassReportDateInputs()" style="width: 100%; padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px; cursor: pointer;">
            <option value="month">شهر محدد</option>
            <option value="custom">فترة مخصصة</option>
            <option value="all">جميع الفترات</option>
          </select>
        </div>
        
        <div id="classMonthSelectContainer" style="margin-bottom: 20px;">
          <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
            🗓️ الشهر:
          </label>
          <select id="classReportMonth" style="width: 100%; padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
            ${monthOptions}
          </select>
        </div>
        
        <div id="classCustomDateContainer" style="display: none; margin-bottom: 20px;">
          <!-- From Date -->
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
              📅 من تاريخ:
            </label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <select id="classReportFromDay" style="padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
                <option value="">اليوم</option>
              </select>
              <select id="classReportFromMonth" onchange="window.updateDaysForDatePicker('classReportFromYear', 'classReportFromMonth', 'classReportFromDay')" style="padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
                ${generateMonthsForYear()}
              </select>
              <select id="classReportFromYear" onchange="window.updateMonthsForYear('classReportFromYear', 'classReportFromMonth', 'classReportFromDay')" style="padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
                ${generateHijriYearsOptions()}
              </select>
            </div>
          </div>
          <!-- To Date -->
          <div>
            <label style="display: block; color: #333; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
              📅 إلى تاريخ:
            </label>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
              <select id="classReportToDay" style="padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
                <option value="">اليوم</option>
              </select>
              <select id="classReportToMonth" onchange="window.updateDaysForDatePicker('classReportToYear', 'classReportToMonth', 'classReportToDay')" style="padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
                ${generateMonthsForYear()}
              </select>
              <select id="classReportToYear" onchange="window.updateMonthsForYear('classReportToYear', 'classReportToMonth', 'classReportToDay')" style="padding: 10px; border: 2px solid #28a745; border-radius: 8px; font-size: 14px;">
                ${generateHijriYearsOptions()}
              </select>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 25px;">
          <button onclick="window.generateClassReport()" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            📥 تصدير PDF
          </button>
          <button onclick="document.getElementById('classReportOverlay').remove()" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            ❌ إلغاء
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Initialize current date in custom range fields
    setTimeout(() => {
      initializeCurrentDateInModal('classReport');
    }, 100);
    
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
  } catch (error) {
    console.error('Error loading teachers:', error);
    alert('❌ حدث خطأ في تحميل قائمة المعلمين');
  }
};

// Toggle date inputs for class report
window.toggleClassReportDateInputs = function() {
  const periodType = document.getElementById('classReportPeriodType').value;
  const monthContainer = document.getElementById('classMonthSelectContainer');
  const customContainer = document.getElementById('classCustomDateContainer');
  
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
      // Read from dropdown selects instead of text inputs
      const fromYear = document.getElementById('reportFromYear')?.value;
      const fromMonth = document.getElementById('reportFromMonth')?.value;
      const fromDay = document.getElementById('reportFromDay')?.value;
      const toYear = document.getElementById('reportToYear')?.value;
      const toMonth = document.getElementById('reportToMonth')?.value;
      const toDay = document.getElementById('reportToDay')?.value;
      
      if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) {
        alert('⚠️ يرجى إكمال جميع حقول التاريخ (اليوم/الشهر/السنة)');
        return;
      }
      
      // Build YYYY-MM-DD format
      fromDate = `${fromYear}-${fromMonth}-${fromDay}`;
      toDate = `${toYear}-${toMonth}-${toDay}`;
      
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
    
    // Fetch teacher names from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
    // Fetch all juzDisplays
    const snapshot = await getDocs(collection(db, 'juzDisplays'));
    
    // استخدام Map لمنع التكرار - المفتاح: اسم الطالب + رقم الجزء
    const reportsMap = new Map();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const displayDate = data.displayDate;
      const lastLessonDate = data.lastLessonDate;
      const studentName = data.studentName || 'غير محدد';
      const juzNumber = data.juzNumber || '-';
      const uniqueKey = `${studentName}-${juzNumber}`;
      
      // تحديد ما إذا كان السجل يجب تضمينه
      let shouldInclude = false;
      
      // Include based on period type
      if (periodType === 'all') {
        shouldInclude = true;
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
          shouldInclude = true;
          console.log('✅ Included as PASSED:', {
            student: data.studentName,
            displayDate: normalizedDisplayDate,
            range: `${fromDate} to ${toDate}`,
            status: 'مجتاز في هذه الفترة'
          });
        }
        // حالة 2: اجتاز بعد الفترة لكن آخر درس كان في/قبل الفترة → يظهر كمتبقي
        else if (lastLessonDate && lastLessonDate <= toDate && normalizedDisplayDate > toDate) {
          shouldInclude = true;
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
          shouldInclude = true;
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
      
      // إضافة السجل مع فحص التكرار
      if (shouldInclude) {
        const existingRecord = reportsMap.get(uniqueKey);
        
        if (existingRecord) {
          // أولوية للسجل المكتمل على غير المكتمل
          if (data.status === 'completed' && existingRecord.status === 'incomplete') {
            reportsMap.set(uniqueKey, data);
            console.log(`⚠️ تكرار في التقرير العام: ${studentName} - جزء ${juzNumber} - تم اختيار السجل المكتمل`);
          } else {
            console.log(`⚠️ تجاهل تكرار في التقرير العام: ${studentName} - جزء ${juzNumber}`);
          }
        } else {
          reportsMap.set(uniqueKey, data);
        }
      }
    });
    
    // تحويل Map إلى Array
    const allReports = Array.from(reportsMap.values());
    
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
      const teacherName = teacherNamesMap[report.teacherId] || report.teacherName || 'غير محدد';
      
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

// Generate Class (Teacher) Report PDF
window.generateClassReport = async function() {
  try {
    const teacherId = document.getElementById('classReportTeacher').value;
    
    if (!teacherId) {
      alert('⚠️ يرجى اختيار المعلم');
      return;
    }
    
    // Get period selection
    const periodType = document.getElementById('classReportPeriodType').value;
    let fromDate = null;
    let toDate = null;
    let periodLabel = '';
    
    // Determine date range
    if (periodType === 'month') {
      const monthKey = document.getElementById('classReportMonth').value; // YYYY-MM
      const monthParts = monthKey.split('-');
      const selectedYear = parseInt(monthParts[0]);
      const selectedMonth = parseInt(monthParts[1]);
      
      // Find EXACT start and end dates from accurateHijriDates
      const monthDates = accurateHijriDates.filter(entry => 
        entry.hijriYear === selectedYear && entry.hijriMonth === selectedMonth
      );
      
      if (monthDates.length > 0) {
        fromDate = monthDates[0].hijri;
        toDate = monthDates[monthDates.length - 1].hijri;
        
        console.log(`📅 Accurate month range for ${monthKey}:`, {
          fromDate,
          toDate,
          totalDays: monthDates.length
        });
      } else {
        fromDate = `${monthKey}-01`;
        toDate = `${monthKey}-30`;
        console.warn('⚠️ Month not found in accurate calendar');
      }
      
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[selectedMonth - 1];
      periodLabel = `${monthName} ${selectedYear}`;
    } else if (periodType === 'custom') {
      // Read from dropdown selects instead of text inputs
      const fromYear = document.getElementById('classReportFromYear')?.value;
      const fromMonth = document.getElementById('classReportFromMonth')?.value;
      const fromDay = document.getElementById('classReportFromDay')?.value;
      const toYear = document.getElementById('classReportToYear')?.value;
      const toMonth = document.getElementById('classReportToMonth')?.value;
      const toDay = document.getElementById('classReportToDay')?.value;
      
      if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) {
        alert('⚠️ يرجى إكمال جميع حقول التاريخ (اليوم/الشهر/السنة)');
        return;
      }
      
      // Build YYYY-MM-DD format
      fromDate = `${fromYear}-${fromMonth}-${fromDay}`;
      toDate = `${toYear}-${toMonth}-${toDay}`;
      
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
      <div style="font-size: 18px; color: #28a745; font-weight: bold;">جاري إنشاء تقرير الحلقة...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">يرجى الانتظار</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Get teacher name from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    const teacherName = teacherNamesMap[teacherId] || 'المعلم';
    
    // 🆕 STEP 1: جلب جميع طلاب الحلقة من users collection
    const allStudentsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('classId', '==', teacherId)
    );
    const allStudentsSnapshot = await getDocs(allStudentsQuery);
    
    // بناء قائمة بجميع الطلاب
    const allStudentsMap = new Map(); // Key: studentName, Value: student data
    allStudentsSnapshot.forEach(studentDoc => {
      const studentData = studentDoc.data();
      const studentName = studentData.name || 'غير محدد';
      allStudentsMap.set(studentName, {
        id: studentDoc.id,
        name: studentName
      });
    });
    
    console.log(`📚 إجمالي طلاب الحلقة: ${allStudentsMap.size}`);
    
    // 🆕 STEP 2: جلب جميع سجلات العرض للحلقة
    const juzDisplaysQuery = query(
      collection(db, 'juzDisplays'),
      where('teacherId', '==', teacherId)
    );
    const juzDisplaysSnapshot = await getDocs(juzDisplaysQuery);
    
    const today = getTodayForStorage();
    const todayEntry = accurateHijriDates.find(e => e.hijri === today);
    const todayGregorian = todayEntry ? new Date(todayEntry.gregorian) : new Date();
    
    // 🆕 STEP 3: ربط البيانات - بناء قائمة السجلات
    const allRecords = []; // كل سجل = صف في التقرير
    
    // أولاً: نضيف جميع السجلات من juzDisplays
    juzDisplaysSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const studentName = data.studentName || 'غير محدد';
      const juzNumber = data.juzNumber || '-';
      const status = data.status || 'incomplete';
      let lastLessonDate = data.lastLessonDate;
      let displayDate = data.displayDate;
      
      // 🔧 Normalize lastLessonDate format (add padding if missing)
      if (lastLessonDate && typeof lastLessonDate === 'string') {
        const parts = lastLessonDate.split('-');
        if (parts.length === 3) {
          lastLessonDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
      
      // 🔧 Normalize displayDate format
      if (displayDate && displayDate.includes('/')) {
        const parts = displayDate.split('/');
        if (parts.length === 3) {
          displayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (displayDate && typeof displayDate === 'string') {
        const parts = displayDate.split('-');
        if (parts.length === 3) {
          displayDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
      
      // فلتر حسب الفترة المختارة
      let includeRecord = false;
      
      if (periodType === 'all') {
        includeRecord = true;
      } else if (status === 'completed' && displayDate) {
        // المجتازين: اجتاز في الفترة أو كان في الفترة واجتاز بعدها
        if (displayDate >= fromDate && displayDate <= toDate) {
          includeRecord = true;
        } else if (lastLessonDate && lastLessonDate <= toDate && displayDate > toDate) {
          includeRecord = true;
        }
      } else if (status === 'incomplete' && lastLessonDate) {
        // الجاهزين: آخر درس في الفترة أو قبلها
        if (lastLessonDate <= toDate) {
          includeRecord = true;
        }
      }
      
      if (!includeRecord) return;
      
      // 📊 العمود الذكي: المدة والتفاصيل (أيام الدراسة فقط)
      let durationText = '-';
      let durationColor = '#999';
      
      if (status === 'incomplete' && lastLessonDate) {
        // للطلاب المسجلين: عرض كم يوم منذ آخر درس
        const lastLessonEntry = accurateHijriDates.find(e => e.hijri === lastLessonDate);
        if (lastLessonEntry) {
          const lastLessonGregorian = new Date(lastLessonEntry.gregorian);
          const diffDays = calculateBusinessDays(lastLessonGregorian, todayGregorian);
          
          // مؤشر بصري حسب المدة
          let indicator = '●';
          if (diffDays < 7) {
            durationColor = '#28a745'; // أخضر
          } else if (diffDays <= 14) {
            durationColor = '#ff9800'; // برتقالي
          } else {
            durationColor = '#dc3545'; // أحمر
          }
          
          const dayWord = diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومان' : 'أيام';
          durationText = `${indicator} منذ ${diffDays} ${dayWord}`;
        }
      } else if (status === 'completed' && lastLessonDate && displayDate) {
        // للطلاب المجتازين: عرض المدة المستغرقة
        const durationDays = calculateHijriDaysDifference(lastLessonDate, displayDate);
        const dayWord = durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام';
        
        // مؤشر بصري حسب الأداء
        let indicator = '';
        if (durationDays < 3) {
          indicator = '⚡'; // ممتاز
          durationColor = '#28a745';
        } else if (durationDays <= 7) {
          indicator = '✓'; // جيد
          durationColor = '#28a745';
        } else {
          durationColor = '#666'; // عادي
        }
        
        durationText = `${indicator} أنجز في ${durationDays} ${dayWord}`;
      }
      
      // تحديد الحالة النصية
      let statusText = '';
      let statusColor = '';
      if (status === 'completed') {
        statusText = '🟢 اجتاز';
        statusColor = '#28a745';
      } else {
        statusText = '🟡 سجّل';
        statusColor = '#ffc107';
      }
      
      allRecords.push({
        name: studentName,
        juzNumber: juzNumber,
        status: status,
        statusText: statusText,
        statusColor: statusColor,
        lastLessonDate: lastLessonDate || '-',
        displayDate: displayDate || '-',
        durationText: durationText,
        durationColor: durationColor,
        hasRecord: true
      });
      
      // حذف الطالب من قائمة الطلاب بدون سجلات (لأنه أصبح له سجل)
      // سنتعامل معها لاحقاً
    });
    
    // 🆕 STEP 4: إضافة الطلاب الذين ليس لهم أي سجل
    // نجمع أسماء الطلاب الذين لهم سجلات
    const studentsWithRecords = new Set(allRecords.map(r => r.name));
    
    // نضيف الطلاب الذين ليس لهم سجلات
    allStudentsMap.forEach((student, studentName) => {
      if (!studentsWithRecords.has(studentName)) {
        allRecords.push({
          name: studentName,
          juzNumber: '-',
          status: 'not_registered',
          statusText: '🔴 لم يسجل',
          statusColor: '#dc3545',
          lastLessonDate: '-',
          displayDate: '-',
          durationText: '-',
          durationColor: '#999',
          hasRecord: false
        });
      }
    });
    
    // 🆕 STEP 5: ترتيب السجلات
    // حسب الحالة: غير المسجلين أولاً، ثم المسجلين، ثم المجتازين
    allRecords.sort((a, b) => {
      // ترتيب حسب الحالة
      const statusOrder = { 'not_registered': 0, 'incomplete': 1, 'completed': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      
      // ثم حسب الاسم
      return a.name.localeCompare(b.name, 'ar');
    });
    
    console.log(`📊 إجمالي السجلات في التقرير: ${allRecords.length}`);
    
    // Calculate statistics
    const totalRecords = allRecords.length;
    const passedRecords = allRecords.filter(r => r.status === 'completed').length;
    const registeredRecords = allRecords.filter(r => r.status === 'incomplete').length;
    const notRegisteredRecords = allRecords.filter(r => r.status === 'not_registered').length;
    
    const totalStudents = allStudentsMap.size;
    const passedStudents = passedRecords;
    const pendingStudents = registeredRecords + notRegisteredRecords;
    
    // 🆕 بناء صفوف الجدول مع الأعمدة الجديدة
    let studentsRowsHTML = '';
    allRecords.forEach((record, index) => {
      const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      
      // تنسيق رقم الجزء
      const juzText = record.juzNumber !== '-' ? `جزء ${record.juzNumber}` : '-';
      
      // تنسيق التواريخ
      const registrationDateText = record.lastLessonDate !== '-' ? formatDateForDisplay(record.lastLessonDate) : '-';
      const passDateText = record.displayDate !== '-' ? formatDateForDisplay(record.displayDate) : '-';
      
      studentsRowsHTML += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 14px;">${record.name}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px;">${juzText}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px; font-weight: bold; color: ${record.statusColor};">${record.statusText}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${registrationDateText}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${passDateText}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px; color: ${record.durationColor}; font-weight: bold;">${record.durationText}</td>
        </tr>
      `;
    });
    
    if (allRecords.length === 0) {
      studentsRowsHTML = `
        <tr>
          <td colspan="6" style="padding: 20px; text-align: center; color: #999; font-size: 14px;">
            لا يوجد بيانات للعرض
          </td>
        </tr>
      `;
    }
    
    // Create HTML content
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1100px;
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      text-align: right;
    `;
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #28a745; margin: 0 0 10px 0; font-size: 32px;">👥 تقرير حلقة</h1>
        <h2 style="color: #667eea; margin: 0; font-size: 24px;">الأستاذ: ${teacherName}</h2>
        <p style="color: #666; font-size: 16px; margin: 8px 0 0 0; font-weight: bold;">${periodLabel}</p>
        <p style="color: #999; font-size: 14px; margin: 5px 0 0 0;">تاريخ التقرير: ${formatDateForDisplay(today)}</p>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 20px; border-bottom: 3px solid #28a745; padding-bottom: 10px;">
          📋 قائمة جميع الطلاب
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: right; border: none; font-size: 14px; border-radius: 8px 0 0 0; width: 20%;">اسم الطالب</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 12%;">الجزء</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 13%;">الحالة</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 15%;">تاريخ التسجيل</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 15%;">تاريخ الاجتياز</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; border-radius: 0 8px 0 0; width: 25%;">المدة والتفاصيل</th>
            </tr>
          </thead>
          <tbody>
            ${studentsRowsHTML}
          </tbody>
        </table>
      </div>
      
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 25px; border-radius: 12px; color: white;">
        <h3 style="margin: 0 0 20px 0; font-size: 22px; text-align: center;">📊 الإحصائيات</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">عدد المسجلين</div>
            <div style="font-size: 28px; font-weight: bold;">${totalStudents}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">عدد المجتازين</div>
            <div style="font-size: 28px; font-weight: bold; color: #90ee90;">${passedStudents}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">عدد الغير مجتازين</div>
            <div style="font-size: 28px; font-weight: bold; color: #ffb6c1;">${pendingStudents}</div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Generate PDF using html2canvas and jsPDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    const fileName = `تقرير_حلقة_${teacherName.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
    
    console.log('🎉 Class report PDF saved:', fileName);
    
    // Remove loading and overlay
    loadingMsg.remove();
    document.getElementById('classReportOverlay').remove();
    
    alert('✅ تم تصدير تقرير الحلقة بنجاح!');
    
  } catch (error) {
    console.error('Error generating class report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء تقرير الحلقة');
  }
};

// ==========================================
// REPORTS SECTION - Modern Modal System
// ==========================================

/**
 * Open Report Modal - Unified function for all report types
 * @param {string} reportType - 'hizb', 'juz', or 'stage'
 */
window.openReportModal = function(reportType) {
  console.log('Opening report modal for:', reportType);
  
  // Stage reports are not implemented yet
  if (reportType === 'stage') {
    alert('🚧 نظام تقارير المراحل قيد التطوير\nسيتم إضافته في التحديثات القادمة بإذن الله');
    return;
  }
  
  // Report config object
  const config = {
    hizb: {
      icon: '📗',
      title: 'تقارير الأحزاب',
      color: '#667eea',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    juz: {
      icon: '📘',
      title: 'تقارير الأجزاء',
      color: '#28a745',
      gradient: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
    }
  };
  
  const reportConfig = config[reportType];
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'reportModalOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
    animation: fadeIn 0.3s ease;
  `;
  
  overlay.innerHTML = `
    <div style="background: white; border-radius: 20px; padding: 0; width: 90%; max-width: 450px; box-shadow: 0 15px 50px rgba(0,0,0,0.3); animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); direction: rtl; overflow: hidden;">
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .report-modal-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        }
        .report-modal-btn:active {
          transform: translateY(0);
        }
      </style>
      
      <!-- Modal Header -->
      <div style="background: ${reportConfig.gradient}; color: white; padding: 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">${reportConfig.icon}</div>
        <h2 style="margin: 0; font-size: 24px; font-weight: 700;">${reportConfig.title}</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">اختر نوع التقرير المطلوب</p>
      </div>
      
      <!-- Modal Body -->
      <div style="padding: 25px;">
        <button class="report-modal-btn" onclick="document.getElementById('reportModalOverlay').remove(); window.showGeneralReportFor('${reportType}');" 
          style="width: 100%; padding: 20px; margin-bottom: 12px; background: white; border: 2px solid ${reportConfig.color}; color: ${reportConfig.color}; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 15px; justify-content: flex-start;">
          <span style="font-size: 32px;">📈</span>
          <div style="text-align: right; flex: 1;">
            <div style="font-size: 17px; margin-bottom: 3px;">التقرير العام</div>
            <div style="font-size: 12px; opacity: 0.7; font-weight: 500;">إحصائيات شاملة لجميع الحلقات</div>
          </div>
        </button>
        
        <button class="report-modal-btn" onclick="document.getElementById('reportModalOverlay').remove(); window.showClassReportFor('${reportType}');" 
          style="width: 100%; padding: 20px; margin-bottom: 12px; background: white; border: 2px solid ${reportConfig.color}; color: ${reportConfig.color}; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 15px; justify-content: flex-start;">
          <span style="font-size: 32px;">👥</span>
          <div style="text-align: right; flex: 1;">
            <div style="font-size: 17px; margin-bottom: 3px;">تقرير حلقة</div>
            <div style="font-size: 12px; opacity: 0.7; font-weight: 500;">تفاصيل طلاب حلقة معينة</div>
          </div>
        </button>
        
        <button class="report-modal-btn" onclick="document.getElementById('reportModalOverlay').remove(); window.showStudentReportFor('${reportType}');" 
          style="width: 100%; padding: 20px; margin-bottom: 20px; background: white; border: 2px solid ${reportConfig.color}; color: ${reportConfig.color}; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 15px; justify-content: flex-start;">
          <span style="font-size: 32px;">👤</span>
          <div style="text-align: right; flex: 1;">
            <div style="font-size: 17px; margin-bottom: 3px;">تقرير طالب</div>
            <div style="font-size: 12px; opacity: 0.7; font-weight: 500;">سجل إنجازات طالب محدد</div>
          </div>
        </button>
        
        <button onclick="document.getElementById('reportModalOverlay').remove();" 
          style="width: 100%; padding: 14px; background: #f1f3f5; color: #495057; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
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

/**
 * Show general report options for specific type
 */
window.showGeneralReportFor = function(reportType) {
  if (reportType === 'hizb') {
    showHizbGeneralReportModal();
  } else if (reportType === 'juz') {
    // Use existing function
    window.showGeneralReportOptions();
  }
};

/**
 * Show class report options for specific type
 */
window.showClassReportFor = function(reportType) {
  if (reportType === 'hizb') {
    showHizbClassReportModal();
  } else if (reportType === 'juz') {
    // Use existing function
    window.showClassReportOptions();
  }
};

/**
 * Show student report options for specific type
 */
window.showStudentReportFor = function(reportType) {
  if (reportType === 'hizb') {
    showHizbStudentReportModal();
  } else if (reportType === 'juz') {
    showJuzStudentReportModal();
  }
};

// ==========================================
// HIZB REPORTS MODALS - Advanced System
// ==========================================

/**
 * Generate Hijri months options for select dropdowns
 * Automatically selects current month based on system date
 */
function generateHijriMonthsOptions() {
  if (!accurateHijriDates || !Array.isArray(accurateHijriDates)) {
    console.error('accurateHijriDates not available');
    return '<option value="">لا توجد بيانات</option>';
  }
  
  // Get current Hijri date from system (YYYY-MM-DD format)
  const today = getTodayForStorage();
  const [currentYear, currentMonth] = today.split('-').map(Number);
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  
  let options = '<option value="">-- اختر الشهر --</option>';
  
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  // Extract unique year-month combinations from accurate dates
  const availableMonths = new Map();
  accurateHijriDates.forEach(entry => {
    const monthKey = `${entry.hijriYear}-${String(entry.hijriMonth).padStart(2, '0')}`;
    if (!availableMonths.has(monthKey)) {
      availableMonths.set(monthKey, {
        year: entry.hijriYear,
        month: entry.hijriMonth,
        name: hijriMonths[entry.hijriMonth - 1] || `شهر ${entry.hijriMonth}`,
        key: monthKey
      });
    }
  });
  
  // Sort months chronologically (oldest to newest)
  const sortedMonths = Array.from(availableMonths.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year; // Ascending year
    return a.month - b.month; // Ascending month
  });
  
  // Build options with current month selected
  sortedMonths.forEach(m => {
    const value = m.key;
    const label = `${m.name} ${m.year}`;
    const isCurrentMonth = (value === currentMonthKey);
    const selected = isCurrentMonth ? ' selected' : '';
    
    options += `<option value="${value}"${selected}>${label}</option>`;
  });
  
  console.log(`📅 Generated ${sortedMonths.length} months, current: ${currentMonthKey}`);
  
  return options;
}

/**
 * Generate years options
 */
function generateHijriYearsOptions() {
  if (!accurateHijriDates) return '<option value="">السنة</option>';
  
  // Extract unique years
  const yearsSet = new Set();
  accurateHijriDates.forEach(entry => {
    yearsSet.add(entry.hijriYear);
  });
  
  const years = Array.from(yearsSet).sort((a, b) => b - a);
  let options = '<option value="">السنة</option>';
  
  years.forEach(year => {
    options += `<option value="${year}">${year}</option>`;
  });
  
  return options;
}

/**
 * Generate months options for specific year from accurate data
 */
function generateMonthsForYear(year) {
  const hijriMonths = [
    'المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  let options = '<option value="">الشهر</option>';
  
  if (!year || !accurateHijriDates) {
    // Return all months if no year selected
    hijriMonths.forEach((month, index) => {
      const value = String(index + 1).padStart(2, '0');
      options += `<option value="${value}">${month}</option>`;
    });
  } else {
    // Return only available months for this year
    const availableMonths = new Set();
    accurateHijriDates.forEach(entry => {
      if (entry.hijriYear === parseInt(year)) {
        availableMonths.add(entry.hijriMonth);
      }
    });
    
    const sortedMonths = Array.from(availableMonths).sort((a, b) => a - b);
    sortedMonths.forEach(monthNum => {
      const value = String(monthNum).padStart(2, '0');
      const name = hijriMonths[monthNum - 1];
      options += `<option value="${value}">${name}</option>`;
    });
  }
  
  return options;
}

/**
 * Update months dropdown when year changes
 */
window.updateMonthsForYear = function(yearId, monthId, dayId) {
  const yearSelect = document.getElementById(yearId);
  const monthSelect = document.getElementById(monthId);
  const daySelect = document.getElementById(dayId);
  
  if (!yearSelect || !monthSelect || !daySelect) return;
  
  const year = yearSelect.value;
  const currentMonth = monthSelect.value;
  
  // Update months based on selected year
  monthSelect.innerHTML = generateMonthsForYear(year);
  
  // Try to restore previous month if still available
  if (currentMonth) {
    const option = monthSelect.querySelector(`option[value="${currentMonth}"]`);
    if (option) {
      monthSelect.value = currentMonth;
    }
  }
  
  // Update days
  updateDaysForDatePicker(yearId, monthId, dayId);
}

/**
 * Update days dropdown based on selected year and month
 */
function updateDaysForDatePicker(yearId, monthId, dayId) {
  const yearSelect = document.getElementById(yearId);
  const monthSelect = document.getElementById(monthId);
  const daySelect = document.getElementById(dayId);
  
  if (!yearSelect || !monthSelect || !daySelect) return;
  
  const year = yearSelect.value;
  const monthNum = monthSelect.value;
  
  if (!year || !monthNum) {
    daySelect.innerHTML = '<option value="">اليوم</option>';
    return;
  }
  
  // Find days count for this month from accurateHijriDates
  const monthKey = `${year}-${monthNum}`;
  const daysInMonth = accurateHijriDates.filter(entry => {
    const entryKey = `${entry.hijriYear}-${String(entry.hijriMonth).padStart(2, '0')}`;
    return entryKey === monthKey;
  });
  
  const daysCount = daysInMonth.length > 0 ? daysInMonth.length : 30;
  
  const currentDay = daySelect.value;
  daySelect.innerHTML = '<option value="">اليوم</option>';
  
  for (let i = 1; i <= daysCount; i++) {
    const option = document.createElement('option');
    option.value = String(i).padStart(2, '0');
    option.textContent = i;
    if (currentDay === option.value) {
      option.selected = true;
    }
    daySelect.appendChild(option);
  }
}

/**
 * Show Hizb General Report Modal
 */
function showHizbGeneralReportModal() {
  const overlay = document.createElement('div');
  overlay.id = 'hizbGeneralModal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
    backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease;
    overflow-y: auto;
    padding: 20px;
  `;
  
  overlay.innerHTML = `
    <div style="background: white; border-radius: 25px; width: 100%; max-width: 550px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); direction: rtl; overflow: hidden; margin: auto;">
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .luxury-select {
          width: 100%;
          padding: 14px 18px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 15px;
          font-family: 'Cairo', sans-serif;
          background: white;
          color: #2d3748;
          cursor: pointer;
          transition: all 0.3s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667eea' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: left 15px center;
          padding-left: 40px;
        }
        
        .luxury-select:hover {
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
          transform: translateY(-1px);
        }
        
        .luxury-select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
        }
        
        .date-picker-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        
        .date-picker-small {
          padding: 12px;
          text-align: center;
          font-size: 14px;
        }
        
        .period-section {
          display: none;
          animation: fadeInSlide 0.3s ease;
        }
        
        .period-section.active {
          display: block;
        }
        
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .export-button {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .export-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
        }
        
        .export-button:active {
          transform: translateY(0);
        }
      </style>
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
        <div style="font-size: 52px; margin-bottom: 12px;">📊</div>
        <h2 style="margin: 0; font-size: 26px; font-weight: 700;">التقرير العام للأحزاب</h2>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">اختر الفترة الزمنية لتصدير التقرير</p>
      </div>
      
      <!-- Body -->
      <div style="padding: 30px;">
        
        <!-- Period Type Selection -->
        <div style="margin-bottom: 25px;">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            📅 نوع الفترة
          </label>
          <select class="luxury-select" id="hizbGenPeriodType" onchange="window.toggleHizbGenPeriod()">
            <option value="month">شهر محدد</option>
            <option value="custom">فترة مخصصة</option>
          </select>
        </div>
        
        <!-- Month Selection -->
        <div id="hizbGenMonthSection" class="period-section active">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            🗓️ اختر الشهر الهجري
          </label>
          <select class="luxury-select" id="hizbGenMonth" style="font-size: 14px;">
            ${generateHijriMonthsOptions()}
          </select>
        </div>
        
        <!-- Custom Range Selection -->
        <div id="hizbGenCustomSection" class="period-section">
          
          <!-- From Date -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
              📅 من تاريخ
            </label>
            <div class="date-picker-row">
              <select class="luxury-select date-picker-small" id="hizbGenFromDay">
                <option value="">اليوم</option>
              </select>
              <select class="luxury-select date-picker-small" id="hizbGenFromMonth" onchange="window.updateDaysForDatePicker('hizbGenFromYear', 'hizbGenFromMonth', 'hizbGenFromDay')">
                ${generateMonthsForYear()}
              </select>
              <select class="luxury-select date-picker-small" id="hizbGenFromYear" onchange="window.updateMonthsForYear('hizbGenFromYear', 'hizbGenFromMonth', 'hizbGenFromDay')">
                ${generateHijriYearsOptions()}
              </select>
            </div>
          </div>
          
          <!-- To Date -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
              📅 إلى تاريخ
            </label>
            <div class="date-picker-row">
              <select class="luxury-select date-picker-small" id="hizbGenToDay">
                <option value="">اليوم</option>
              </select>
              <select class="luxury-select date-picker-small" id="hizbGenToMonth" onchange="window.updateDaysForDatePicker('hizbGenToYear', 'hizbGenToMonth', 'hizbGenToDay')">
                ${generateMonthsForYear()}
              </select>
              <select class="luxury-select date-picker-small" id="hizbGenToYear" onchange="window.updateMonthsForYear('hizbGenToYear', 'hizbGenToMonth', 'hizbGenToDay')">
                ${generateHijriYearsOptions()}
              </select>
            </div>
          </div>
          
        </div>
        
        <!-- Export Button -->
        <button class="export-button" onclick="window.exportHizbGeneralReport()">
          <span style="font-size: 24px;">📥</span>
          <span>تصدير التقرير</span>
        </button>
        
        <!-- Cancel Button -->
        <button onclick="document.getElementById('hizbGeneralModal').remove();" 
          style="width: 100%; padding: 12px; margin-top: 12px; background: #f1f3f5; color: #495057; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          ❌ إلغاء
        </button>
        
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Initialize current date in custom range fields
  setTimeout(() => {
    initializeCurrentDateInModal('hizbGen');
  }, 100);
  
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

/**
 * Initialize current Hijri date in modal date pickers
 */
function initializeCurrentDateInModal(prefix) {
  try {
    const today = getTodayForStorage(); // YYYY-MM-DD format
    const [year, month, day] = today.split('-').map(Number);
    
    // Set From date to today
    const fromYearSelect = document.getElementById(`${prefix}FromYear`);
    const fromMonthSelect = document.getElementById(`${prefix}FromMonth`);
    const fromDaySelect = document.getElementById(`${prefix}FromDay`);
    
    if (fromYearSelect) {
      fromYearSelect.value = year;
      window.updateMonthsForYear(`${prefix}FromYear`, `${prefix}FromMonth`, `${prefix}FromDay`);
      
      setTimeout(() => {
        if (fromMonthSelect) {
          fromMonthSelect.value = String(month).padStart(2, '0');
          window.updateDaysForDatePicker(`${prefix}FromYear`, `${prefix}FromMonth`, `${prefix}FromDay`);
          
          setTimeout(() => {
            if (fromDaySelect) {
              fromDaySelect.value = String(day).padStart(2, '0');
            }
          }, 50);
        }
      }, 50);
    }
    
    // Set To date to today (can be changed by user)
    const toYearSelect = document.getElementById(`${prefix}ToYear`);
    const toMonthSelect = document.getElementById(`${prefix}ToMonth`);
    const toDaySelect = document.getElementById(`${prefix}ToDay`);
    
    if (toYearSelect) {
      toYearSelect.value = year;
      window.updateMonthsForYear(`${prefix}ToYear`, `${prefix}ToMonth`, `${prefix}ToDay`);
      
      setTimeout(() => {
        if (toMonthSelect) {
          toMonthSelect.value = String(month).padStart(2, '0');
          window.updateDaysForDatePicker(`${prefix}ToYear`, `${prefix}ToMonth`, `${prefix}ToDay`);
          
          setTimeout(() => {
            if (toDaySelect) {
              toDaySelect.value = String(day).padStart(2, '0');
            }
          }, 50);
        }
      }, 50);
    }
  } catch (error) {
    console.error('Error initializing date in modal:', error);
  }
}

/**
 * Toggle period type for Hizb General Report
 */
window.toggleHizbGenPeriod = function() {
  const type = document.getElementById('hizbGenPeriodType')?.value;
  const monthSection = document.getElementById('hizbGenMonthSection');
  const customSection = document.getElementById('hizbGenCustomSection');
  
  if (type === 'month') {
    monthSection?.classList.add('active');
    customSection?.classList.remove('active');
  } else {
    monthSection?.classList.remove('active');
    customSection?.classList.add('active');
  }
};

/**
 * Export Hizb General Report
 */
window.exportHizbGeneralReport = async function() {
  try {
    const periodType = document.getElementById('hizbGenPeriodType')?.value;
    let fromDate = null;
    let toDate = null;
    let periodLabel = '';
    
    // Determine date range
    if (periodType === 'month') {
      const monthKey = document.getElementById('hizbGenMonth')?.value; // YYYY-MM (e.g., "1447-09")
      if (!monthKey) {
        alert('⚠️ الرجاء اختيار الشهر');
        return;
      }
      
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
      } else {
        // Fallback if month not in calendar
        fromDate = `${monthKey}-01`;
        toDate = `${monthKey}-30`;
      }
      
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[selectedMonth - 1];
      periodLabel = `${monthName} ${selectedYear}`;
    } else {
      // Custom range
      const fromYear = document.getElementById('hizbGenFromYear')?.value;
      const fromMonth = document.getElementById('hizbGenFromMonth')?.value;
      const fromDay = document.getElementById('hizbGenFromDay')?.value;
      const toYear = document.getElementById('hizbGenToYear')?.value;
      const toMonth = document.getElementById('hizbGenToMonth')?.value;
      const toDay = document.getElementById('hizbGenToDay')?.value;
      
      if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) {
        alert('⚠️ الرجاء إكمال جميع حقول التاريخ');
        return;
      }
      
      // Build YYYY-MM-DD format
      fromDate = `${fromYear}-${fromMonth}-${fromDay}`;
      toDate = `${toYear}-${toMonth}-${toDay}`;
      
      periodLabel = `من ${formatDateForDisplay(fromDate)} إلى ${formatDateForDisplay(toDate)}`;
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
      <div style="font-size: 18px; color: #667eea; font-weight: bold;">جاري إنشاء تقرير الأحزاب...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">يرجى الانتظار</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Fetch teacher names from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
    // Fetch all hizbDisplays
    const snapshot = await getDocs(collection(db, 'hizbDisplays'));
    
    // استخدام Map لمنع التكرار - المفتاح: اسم الطالب + رقم الحزب
    const reportsMap = new Map();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const displayDate = data.displayDate;
      const lastLessonDate = data.lastLessonDate;
      const studentName = data.studentName || 'غير محدد';
      const hizbNumber = data.hizbNumber || '-';
      const uniqueKey = `${studentName}-${hizbNumber}`;
      
      // تحديد ما إذا كان السجل يجب تضمينه
      let shouldInclude = false;
      
      // Apply same filtering logic as Juz reports
      if (data.status === 'completed' && displayDate) {
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
          shouldInclude = true;
        }
        // حالة 2: اجتاز بعد الفترة لكن آخر درس كان في/قبل الفترة → يظهر كمتبقي
        else if (lastLessonDate && lastLessonDate <= toDate && normalizedDisplayDate > toDate) {
          shouldInclude = true;
        }
      } else if (data.status === 'incomplete' && lastLessonDate) {
        // الجاهزين: آخر درس قبل أو خلال نهاية الفترة المحددة
        if (lastLessonDate <= toDate) {
          shouldInclude = true;
        }
      }
      
      // إضافة السجل مع فحص التكرار
      if (shouldInclude) {
        const existingRecord = reportsMap.get(uniqueKey);
        
        if (existingRecord) {
          // أولوية للسجل المكتمل على غير المكتمل
          if (data.status === 'completed' && existingRecord.status === 'incomplete') {
            reportsMap.set(uniqueKey, data);
            console.log(`⚠️ تكرار في التقرير العام: ${studentName} - حزب ${hizbNumber} - تم اختيار السجل المكتمل`);
          } else {
            console.log(`⚠️ تجاهل تكرار في التقرير العام: ${studentName} - حزب ${hizbNumber}`);
          }
        } else {
          reportsMap.set(uniqueKey, data);
        }
      }
    });
    
    // تحويل Map إلى Array
    const allReports = Array.from(reportsMap.values());
    
    // Calculate statistics
    const totalStudents = allReports.length;
    let passedStudents = 0;
    let remainingStudents = 0;
    
    allReports.forEach(report => {
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
    
    // Calculate per teacher
    const teacherStats = {};
    allReports.forEach(report => {
      const teacherId = report.teacherId;
      const teacherName = teacherNamesMap[report.teacherId] || report.teacherName || 'غير محدد';
      
      if (!teacherStats[teacherId]) {
        teacherStats[teacherId] = {
          name: teacherName,
          total: 0,
          completed: 0,
          remaining: 0
        };
      }
      
      teacherStats[teacherId].total++;
      
      if (report.status === 'completed' && report.displayDate) {
        let normalizedDisplayDate = report.displayDate;
        if (report.displayDate.includes('/')) {
          const parts = report.displayDate.split('/');
          if (parts.length === 3) {
            normalizedDisplayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        
        if (normalizedDisplayDate >= fromDate && normalizedDisplayDate <= toDate) {
          teacherStats[teacherId].completed++;
        } else {
          teacherStats[teacherId].remaining++;
        }
      } else if (report.status === 'incomplete') {
        teacherStats[teacherId].remaining++;
      }
    });
    
    // Build HTML content
    const successRate = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;
    const teacherEntries = Object.values(teacherStats).sort((a, b) => b.completed - a.completed);
    
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
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 32px;">📊 تقرير الأحزاب القرآنية</h1>
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
            ${teacherRowsHTML || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea;">
        <p style="margin: 5px 0; color: #667eea; font-size: 14px; font-style: italic;">📚 نظام إدارة عرض الأحزاب القرآنية</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${formatDateForDisplay(getTodayForStorage())}</p>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Convert HTML to canvas using html2canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Remove temporary container
    document.body.removeChild(container);
    
    // Create PDF from canvas
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
    
    // Save PDF
    const fileName = `تقرير_الأحزاب_${periodLabel.replace(/\s/g, '_')}.pdf`;
    doc.save(fileName);
    
    // Remove loading and overlay
    loadingMsg.remove();
    document.getElementById('hizbGeneralModal')?.remove();
    
    alert('✅ تم تصدير التقرير بنجاح!');
    
  } catch (error) {
    console.error('Error generating Hizb report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

/**
 * Show Hizb Class Report Modal - Bottom Sheet with Checkboxes
 */
async function showHizbClassReportModal() {
  // جلب المعلمين من collection classes
  let teachers = {};
  
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      const teacherName = classData.teacherName || classData.className || classId;
      teachers[classId] = teacherName;
    });
    
    // Sort teachers by name
    teachers = Object.fromEntries(
      Object.entries(teachers).sort((a, b) => a[1].localeCompare(b[1], 'ar'))
    );
    
  } catch (error) {
    console.error('Error loading teachers:', error);
    teachers = {};
  }
  
  // Build teachers checkboxes HTML
  let teachersHTML = '';
  for (const [id, name] of Object.entries(teachers)) {
    teachersHTML += `
      <label class="teacher-checkbox-item">
        <input type="checkbox" value="${id}" class="teacher-checkbox" onchange="window.updateSelectedTeachersCount()">
        <span class="teacher-checkbox-label">${name}</span>
        <span class="teacher-checkbox-check">✓</span>
      </label>
    `;
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'hizbClassModal';
  overlay.className = 'bottom-sheet-overlay';
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
    }
  };
  
  overlay.innerHTML = `
    <div class="bottom-sheet hizbclass-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      
      <!-- Header -->
      <div class="sheet-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 20px 20px 0 0;">
        <h3 style="margin: 0; font-size: 22px; font-weight: 700;">👥 تقرير حلقة معينة</h3>
        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">اختر الحلقات والفترة الزمنية</p>
      </div>
      
      <div class="sheet-content" style="max-height: 70vh; overflow-y: auto; padding: 25px;">
        
        <!-- Teachers Selection -->
        <div style="margin-bottom: 25px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <label style="font-weight: 700; color: #2d3748; font-size: 15px;">
              👨‍🏫 اختر الحلقات (المعلمين)
            </label>
            <div style="display: flex; gap: 10px; align-items: center;">
              <span id="selectedTeachersCount" style="font-size: 13px; color: #667eea; font-weight: 600;">لم يتم الاختيار</span>
              <button onclick="window.toggleSelectAllTeachers()" class="select-all-btn">
                ✓ اختيار الكل
              </button>
            </div>
          </div>
          
          <div class="teachers-checkboxes-container">
            ${teachersHTML}
          </div>
        </div>
        
        <!-- Period Type Selection -->
        <div style="margin-bottom: 25px;">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            📅 نوع الفترة
          </label>
          <select class="luxury-select" id="hizbClassPeriodType" onchange="window.toggleHizbClassPeriod()">
            <option value="month">شهر محدد</option>
            <option value="custom">فترة مخصصة</option>
          </select>
        </div>
        
        <!-- Month Selection -->
        <div id="hizbClassMonthSection" class="period-section active">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            🗓️ اختر الشهر الهجري
          </label>
          <select class="luxury-select" id="hizbClassMonth" style="font-size: 14px;">
            ${generateHijriMonthsOptions()}
          </select>
        </div>
        
        <!-- Custom Range Selection -->
        <div id="hizbClassCustomSection" class="period-section">
          
          <!-- From Date -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
              📅 من تاريخ
            </label>
            <div class="date-picker-row">
              <select class="luxury-select date-picker-small" id="hizbClassFromDay">
                <option value="">اليوم</option>
              </select>
              <select class="luxury-select date-picker-small" id="hizbClassFromMonth" onchange="window.updateDaysForDatePicker('hizbClassFromYear', 'hizbClassFromMonth', 'hizbClassFromDay')">
                ${generateMonthsForYear()}
              </select>
              <select class="luxury-select date-picker-small" id="hizbClassFromYear" onchange="window.updateMonthsForYear('hizbClassFromYear', 'hizbClassFromMonth', 'hizbClassFromDay')">
                ${generateHijriYearsOptions()}
              </select>
            </div>
          </div>
          
          <!-- To Date -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
              📅 إلى تاريخ
            </label>
            <div class="date-picker-row">
              <select class="luxury-select date-picker-small" id="hizbClassToDay">
                <option value="">اليوم</option>
              </select>
              <select class="luxury-select date-picker-small" id="hizbClassToMonth" onchange="window.updateDaysForDatePicker('hizbClassToYear', 'hizbClassToMonth', 'hizbClassToDay')">
                ${generateMonthsForYear()}
              </select>
              <select class="luxury-select date-picker-small" id="hizbClassToYear" onchange="window.updateMonthsForYear('hizbClassToYear', 'hizbClassToMonth', 'hizbClassToDay')">
                ${generateHijriYearsOptions()}
              </select>
            </div>
          </div>
          
        </div>
      </div>
      
      <div class="sheet-actions" style="padding: 20px; border-top: 1px solid #e2e8f0;">
        <button class="sheet-btn save" onclick="window.exportHizbClassReport()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="font-size: 20px;">📥</span>
          <span>تصدير تقرير الحلقة</span>
        </button>
        <button onclick="document.getElementById('hizbClassModal').classList.remove('active'); setTimeout(() => document.getElementById('hizbClassModal').remove(), 300);" 
          style="width: 100%; padding: 12px; margin-top: 10px; background: #f1f3f5; color: #495057; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          ❌ إلغاء
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Animate in
  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);
  
  // Initialize current date in custom range fields
  setTimeout(() => {
    initializeCurrentDateInModal('hizbClass');
  }, 100);
}

/**
 * Toggle Select All Teachers
 */
window.toggleSelectAllTeachers = function() {
  const checkboxes = document.querySelectorAll('.teacher-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });
  
  window.updateSelectedTeachersCount();
};

/**
 * Update Selected Teachers Count
 */
window.updateSelectedTeachersCount = function() {
  const checkboxes = document.querySelectorAll('.teacher-checkbox:checked');
  const count = checkboxes.length;
  const countSpan = document.getElementById('selectedTeachersCount');
  
  if (count === 0) {
    countSpan.textContent = 'لم يتم الاختيار';
    countSpan.style.color = '#999';
  } else if (count === 1) {
    countSpan.textContent = 'حلقة واحدة';
    countSpan.style.color = '#667eea';
  } else if (count === 2) {
    countSpan.textContent = 'حلقتان';
    countSpan.style.color = '#667eea';
  } else {
    countSpan.textContent = `${count} حلقات`;
    countSpan.style.color = '#667eea';
  }
  
  // Update "Select All" button text
  const allCheckboxes = document.querySelectorAll('.teacher-checkbox');
  const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
  const selectAllBtn = document.querySelector('.select-all-btn');
  if (selectAllBtn) {
    if (allChecked) {
      selectAllBtn.textContent = '✗ إلغاء الكل';
    } else {
      selectAllBtn.textContent = '✓ اختيار الكل';
    }
  }
};

/**
 * Get modal styles (reusable)
 */
function getModalStyles() {
  return `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    
    .luxury-select {
      width: 100%;
      padding: 14px 18px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 15px;
      font-family: 'Cairo', sans-serif;
      background: white;
      color: #2d3748;
      cursor: pointer;
      transition: all 0.3s ease;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667eea' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: left 15px center;
      padding-left: 40px;
    }
    
    .luxury-select:hover {
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
      transform: translateY(-1px);
    }
    
    .luxury-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
    }
    
    .date-picker-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    
    .date-picker-small {
      padding: 12px;
      text-align: center;
      font-size: 14px;
    }
    
    .period-section {
      display: none;
      animation: fadeInSlide 0.3s ease;
    }
    
    .period-section.active {
      display: block;
    }
    
    @keyframes fadeInSlide {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    .export-button {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    
    .export-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
    }
    
    .export-button:active {
      transform: translateY(0);
    }
  `;
}

/**
 * Get teachers list from Firebase
 */
async function getTeachersList() {
  try {
    // Get unique teachers from hizbDisplays collection
    const hizbSnapshot = await getDocs(collection(db, 'hizbDisplays'));
    const teachersSet = new Set();
    
    hizbSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.teacherName) {
        teachersSet.add(data.teacherName);
      }
    });
    
    // Get unique teachers from juzDisplays collection
    const juzSnapshot = await getDocs(collection(db, 'juzDisplays'));
    juzSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.teacherName) {
        teachersSet.add(data.teacherName);
      }
    });
    
    // Also get teachers from teachers collection
    const teachersSnapshot = await getDocs(collection(db, 'teachers'));
    teachersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        teachersSet.add(data.name);
      }
    });
    
    return Array.from(teachersSet).sort();
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
}

/**
 * Toggle period type for Hizb Class Report
 */
window.toggleHizbClassPeriod = function() {
  const type = document.getElementById('hizbClassPeriodType')?.value;
  const monthSection = document.getElementById('hizbClassMonthSection');
  const customSection = document.getElementById('hizbClassCustomSection');
  
  if (type === 'month') {
    monthSection?.classList.add('active');
    customSection?.classList.remove('active');
  } else {
    monthSection?.classList.remove('active');
    customSection?.classList.add('active');
  }
};

/**
 * Toggle period type for Hizb Student Report
 */
window.toggleHizbStudentPeriod = function() {
  const type = document.getElementById('hizbStudPeriodType')?.value;
  const monthSection = document.getElementById('hizbStudMonthSection');
  const customSection = document.getElementById('hizbStudCustomSection');
  
  if (type === 'month') {
    monthSection?.classList.add('active');
    customSection?.classList.remove('active');
  } else {
    monthSection?.classList.remove('active');
    customSection?.classList.add('active');
  }
};

/**
 * Export Hizb Class Report - Multiple Teachers Support
 * تصدير تقرير حلقة الأحزاب - دعم أكثر من معلم
 */
window.exportHizbClassReport = async function() {
  try {
    // جمع المعلمين المحددين من checkboxes
    const selectedCheckboxes = document.querySelectorAll('.teacher-checkbox:checked');
    const selectedTeachers = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedTeachers.length === 0) {
      alert('⚠️ الرجاء اختيار معلم واحد على الأقل');
      return;
    }
    
    const periodType = document.getElementById('hizbClassPeriodType')?.value;
    
    let fromDate = null;
    let toDate = null;
    let periodLabel = '';
    
    // Determine date range
    if (periodType === 'month') {
      const monthKey = document.getElementById('hizbClassMonth')?.value;
      if (!monthKey) {
        alert('⚠️ الرجاء اختيار الشهر');
        return;
      }
      
      const monthParts = monthKey.split('-');
      const selectedYear = parseInt(monthParts[0]);
      const selectedMonth = parseInt(monthParts[1]);
      
      // Find EXACT start and end dates from accurateHijriDates
      const monthDates = accurateHijriDates.filter(entry => 
        entry.hijriYear === selectedYear && entry.hijriMonth === selectedMonth
      );
      
      if (monthDates.length > 0) {
        fromDate = monthDates[0].hijri;
        toDate = monthDates[monthDates.length - 1].hijri;
      } else {
        fromDate = `${monthKey}-01`;
        toDate = `${monthKey}-30`;
      }
      
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[selectedMonth - 1];
      periodLabel = `${monthName} ${selectedYear}`;
    } else {
      // Custom range
      const fromYear = document.getElementById('hizbClassFromYear')?.value;
      const fromMonth = document.getElementById('hizbClassFromMonth')?.value;
      const fromDay = document.getElementById('hizbClassFromDay')?.value;
      const toYear = document.getElementById('hizbClassToYear')?.value;
      const toMonth = document.getElementById('hizbClassToMonth')?.value;
      const toDay = document.getElementById('hizbClassToDay')?.value;
      
      if (!fromYear || !fromMonth || !fromDay || !toYear || !toMonth || !toDay) {
        alert('⚠️ الرجاء إكمال جميع حقول التاريخ');
        return;
      }
      
      fromDate = `${fromYear}-${fromMonth}-${fromDay}`;
      toDate = `${toYear}-${toMonth}-${toDay}`;
      
      periodLabel = `من ${formatDateForDisplay(fromDate)} إلى ${formatDateForDisplay(toDate)}`;
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
      z-index: 10002;
      text-align: center;
    `;
    loadingMsg.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
      <div style="font-size: 18px; color: #28a745; font-weight: bold;">جاري إنشاء تقرير ${selectedTeachers.length === 1 ? 'الحلقة' : 'الحلقات'}...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">تم اختيار ${selectedTeachers.length} ${selectedTeachers.length === 1 ? 'حلقة' : selectedTeachers.length === 2 ? 'حلقتان' : 'حلقات'}</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Get teacher names from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
    const today = getTodayForStorage();
    const todayEntry = accurateHijriDates.find(e => e.hijri === today);
    const todayGregorian = todayEntry ? new Date(todayEntry.gregorian) : new Date();
    
    // **مصفوفة لتخزين بيانات كل حلقة**
    const allClassesData = [];
    
    // **معالجة كل معلم**
    for (const teacherId of selectedTeachers) {
      const teacherName = teacherNamesMap[teacherId] || teacherId;
      
      // جلب طلاب الحلقة
      const allStudentsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('classId', '==', teacherId)
      );
      const allStudentsSnapshot = await getDocs(allStudentsQuery);
      
      const allStudentsMap = new Map();
      allStudentsSnapshot.forEach(studentDoc => {
        const studentData = studentDoc.data();
        const studentName = studentData.name || 'غير محدد';
        allStudentsMap.set(studentName, {
          id: studentDoc.id,
          name: studentName
        });
      });
      
      // جلب سجلات الأحزاب
      const snapshot = await getDocs(query(
        collection(db, 'hizbDisplays'),
        where('teacherId', '==', teacherId)
      ));
      
      const allRecords = [];
    
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const studentName = data.studentName || 'غير محدد';
      const hizbNumber = data.hizbNumber || '-';
      const status = data.status || 'incomplete';
      let lastLessonDate = data.lastLessonDate;
      let displayDate = data.displayDate;
      
      // 🔧 Normalize lastLessonDate format (add padding if missing)
      if (lastLessonDate && typeof lastLessonDate === 'string') {
        const parts = lastLessonDate.split('-');
        if (parts.length === 3) {
          lastLessonDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
      
      // 🔧 Normalize displayDate format
      if (displayDate && displayDate.includes('/')) {
        const parts = displayDate.split('/');
        if (parts.length === 3) {
          displayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else if (displayDate && typeof displayDate === 'string') {
        const parts = displayDate.split('-');
        if (parts.length === 3) {
          displayDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
      
      let includeRecord = false;
      if (status === 'completed' && displayDate) {
        if (displayDate >= fromDate && displayDate <= toDate) {
          includeRecord = true;
        } else if (lastLessonDate && lastLessonDate <= toDate && displayDate > toDate) {
          includeRecord = true;
        }
      } else if (status === 'incomplete' && lastLessonDate) {
        if (lastLessonDate <= toDate) {
          includeRecord = true;
        }
      }
      
      if (!includeRecord) return;
      
      // 📊 العمود الذكي: المدة والتفاصيل (أيام الدراسة فقط)
      let durationText = '-';
      let durationColor = '#999';
      
      if (status === 'incomplete' && lastLessonDate) {
        // للطلاب المسجلين: عرض كم يوم منذ آخر درس
        const lastLessonEntry = accurateHijriDates.find(e => e.hijri === lastLessonDate);
        if (lastLessonEntry) {
          const lastLessonGregorian = new Date(lastLessonEntry.gregorian);
          const diffDays = calculateBusinessDays(lastLessonGregorian, todayGregorian);
          
          // مؤشر بصري حسب المدة
          let indicator = '●';
          if (diffDays < 7) {
            durationColor = '#28a745'; // أخضر
          } else if (diffDays <= 14) {
            durationColor = '#ff9800'; // برتقالي
          } else {
            durationColor = '#dc3545'; // أحمر
          }
          
          const dayWord = diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومان' : 'أيام';
          durationText = `${indicator} منذ ${diffDays} ${dayWord}`;
        }
      } else if (status === 'completed' && lastLessonDate && displayDate) {
        // للطلاب المجتازين: عرض المدة المستغرقة
        const durationDays = calculateHijriDaysDifference(lastLessonDate, displayDate);
        const dayWord = durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام';
        
        // مؤشر بصري حسب الأداء
        let indicator = '';
        if (durationDays < 3) {
          indicator = '⚡'; // ممتاز
          durationColor = '#28a745';
        } else if (durationDays <= 7) {
          indicator = '✓'; // جيد
          durationColor = '#28a745';
        } else {
          durationColor = '#666'; // عادي
        }
        
        durationText = `${indicator} أنجز في ${durationDays} ${dayWord}`;
      }
      
      let statusText = '', statusColor = '';
      if (status === 'completed') {
        statusText = '🟢 اجتاز';
        statusColor = '#28a745';
      } else {
        statusText = '🟡 سجّل';
        statusColor = '#ffc107';
      }
      
      allRecords.push({
        name: studentName,
        hizbNumber: hizbNumber,
        status: status,
        statusText: statusText,
        statusColor: statusColor,
        lastLessonDate: lastLessonDate || '-',
        displayDate: displayDate || '-',
        durationText: durationText,
        durationColor: durationColor,
        hasRecord: true
      });
    });
      
      // إضافة الطلاب غير المسجلين
      const studentsWithRecords = new Set(allRecords.map(r => r.name));
      allStudentsMap.forEach((student, studentName) => {
        if (!studentsWithRecords.has(studentName)) {
          allRecords.push({
            name: studentName,
            hizbNumber: '-',
            status: 'not_registered',
            statusText: '🔴 لم يسجل',
            statusColor: '#dc3545',
            lastLessonDate: '-',
            displayDate: '-',
            durationText: '-',
            durationColor: '#999',
            hasRecord: false
          });
        }
      });
      
      // ترتيب السجلات
      allRecords.sort((a, b) => {
        const statusOrder = { 'not_registered': 0, 'incomplete': 1, 'completed': 2 };
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return a.name.localeCompare(b.name, 'ar');
      });
      
      const totalStudents = allStudentsMap.size;
      const passedStudents = allRecords.filter(r => r.status === 'completed').length;
      const pendingStudents = totalStudents - passedStudents;
      
      // حفظ بيانات هذه الحلقة
      allClassesData.push({
        teacherId: teacherId,
        teacherName: teacherName,
        records: allRecords,
        totalStudents: totalStudents,
        passedStudents: passedStudents,
        pendingStudents: pendingStudents
      });
    }
    
    // **بناء HTML للتقرير**
    let reportHTML = '';
    
    // **العنوان الرئيسي**
    const reportTitle = selectedTeachers.length === 1 
      ? `الأستاذ: ${allClassesData[0].teacherName}` 
      : `تقرير ${selectedTeachers.length} ${selectedTeachers.length === 2 ? 'حلقتان' : 'حلقات'}`;
    
    reportHTML += `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #28a745; margin: 0 0 10px 0; font-size: 32px;">👥 تقرير حلقة الأحزاب</h1>
        <h2 style="color: #667eea; margin: 0; font-size: 24px;">${reportTitle}</h2>
        <p style="color: #666; font-size: 16px; margin: 8px 0 0 0; font-weight: bold;">${periodLabel}</p>
        <p style="color: #999; font-size: 14px; margin: 5px 0 0 0;">تاريخ التقرير: ${formatDateForDisplay(today)}</p>
      </div>
    `;
    
    // **معالجة كل حلقة**
    allClassesData.forEach((classData, classIndex) => {
      // **فاصل بين الحلقات** (إلا الأولى)
      if (classIndex > 0) {
        reportHTML += `
          <div style="margin: 40px 0; border-top: 4px dashed #667eea; padding-top: 40px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #667eea; margin: 0; font-size: 28px;">━━━━━━━━━━</h2>
            </div>
          </div>
        `;
      }
      
      // **عنوان الحلقة** (إذا كان أكثر من معلم)
      if (selectedTeachers.length > 1) {
        reportHTML += `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: center;">
            <h2 style="color: white; margin: 0; font-size: 26px;">👨‍🏫 حلقة الأستاذ: ${classData.teacherName}</h2>
          </div>
        `;
      }
      
      // **بناء صفوف الجدول**
      let studentsRowsHTML = '';
      classData.records.forEach((record, index) => {
        const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        const hizbText = record.hizbNumber !== '-' ? `حزب ${record.hizbNumber}` : '-';
        const registrationDateText = record.lastLessonDate !== '-' ? formatDateForDisplay(record.lastLessonDate) : '-';
        const passDateText = record.displayDate !== '-' ? formatDateForDisplay(record.displayDate) : '-';
        
        studentsRowsHTML += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 14px;">${record.name}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 14px;">${hizbText}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px; font-weight: bold; color: ${record.statusColor};">${record.statusText}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${registrationDateText}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${passDateText}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px; color: ${record.durationColor}; font-weight: bold;">${record.durationText}</td>
          </tr>
        `;
      });
      
      if (classData.records.length === 0) {
        studentsRowsHTML = `
          <tr>
            <td colspan="6" style="padding: 20px; text-align: center; color: #999; font-size: 14px;">
              لا يوجد بيانات للعرض
            </td>
          </tr>
        `;
      }
      
      // **جدول البيانات**
      reportHTML += `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 20px; border-bottom: 3px solid #28a745; padding-bottom: 10px;">
            📋 قائمة جميع الطلاب
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: right; border: none; font-size: 14px; border-radius: 8px 0 0 0; width: 20%;">اسم الطالب</th>
                <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 12%;">الحزب</th>
                <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 13%;">الحالة</th>
                <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 15%;">تاريخ التسجيل</th>
                <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; width: 15%;">تاريخ الاجتياز</th>
                <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; border-radius: 0 8px 0 0; width: 25%;">المدة والتفاصيل</th>
              </tr>
            </thead>
            <tbody>
              ${studentsRowsHTML}
            </tbody>
          </table>
        </div>
      `;
      
      // **إحصائيات الحلقة**
      reportHTML += `
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 25px; border-radius: 12px; color: white; margin-bottom: 30px;">
          <h3 style="margin: 0 0 20px 0; font-size: 22px; text-align: center;">📊 إحصائيات الحلقة</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">عدد المسجلين</div>
              <div style="font-size: 28px; font-weight: bold;">${classData.totalStudents}</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">عدد المجتازين</div>
              <div style="font-size: 28px; font-weight: bold; color: #90ee90;">${classData.passedStudents}</div>
            </div>
            <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">عدد الغير مجتازين</div>
              <div style="font-size: 28px; font-weight: bold; color: #ffb6c1;">${classData.pendingStudents}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    // **الفوتر**
    reportHTML += `
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #28a745;">
        <p style="margin: 5px 0; color: #28a745; font-size: 14px; font-style: italic;">📚 نظام إدارة عرض الأحزاب القرآنية</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${formatDateForDisplay(today)}</p>
      </div>
    `;
    
    console.log(`📊 إجمالي السجلات (أحزاب): ${allClassesData.reduce((sum, c) => sum + c.records.length, 0)}`);
    
    // إنشاء الحاوية للتقرير HTML
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1100px;
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      text-align: right;
    `;
    container.innerHTML = reportHTML;
    document.body.appendChild(container);
    
    // Generate PDF using html2canvas and jsPDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    const fileTitle = selectedTeachers.length === 1 
      ? `تقرير_حلقة_الأحزاب_${allClassesData[0].teacherName}` 
      : `تقرير_حلقات_الأحزاب_${selectedTeachers.length}_حلقات`;
    const fileName = `${fileTitle}_${periodLabel.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
    
    // Remove loading and overlay
    loadingMsg.remove();
    const modal = document.getElementById('hizbClassModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
    
    alert(`✅ تم تصدير تقرير ${selectedTeachers.length === 1 ? 'الحلقة' : `${selectedTeachers.length} حلقات`} بنجاح!`);
    
  } catch (error) {
    console.error('Error generating multi-teacher Hizb report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

// ============================================
// READY BY DATE REPORT - كشف الجاهزين ليوم محدد
// ============================================

/**
 * Show Ready By Date Modal
 * عرض نافذة تقرير الجاهزين ليوم محدد
 */
window.showReadyByDateModal = async function() {
  try {
    // Fetch teachers from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teachers = [];
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      const teacherName = classData.teacherName || classData.className || classId;
      teachers.push({ id: classId, name: teacherName });
    });
    
    // Sort Arabic alphabetically
    teachers.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    // Build teacher checkboxes HTML
    let teachersCheckboxesHTML = '';
    teachers.forEach(teacher => {
      teachersCheckboxesHTML += `
        <div class="teacher-checkbox-item">
          <input type="checkbox" class="teacher-checkbox-ready" id="ready-${teacher.id}" value="${teacher.id}" onchange="window.updateSelectedReadyTeachersCount()">
          <label for="ready-${teacher.id}" class="teacher-checkbox-label">${teacher.name}</label>
          <span class="teacher-checkbox-check">✓</span>
        </div>
      `;
    });
    
    // Generate Hijri years (current and previous)
    const currentYear = getCurrentHijriDate().split('-')[0];
    let yearsOptions = '';
    for (let y = parseInt(currentYear); y >= parseInt(currentYear) - 2; y--) {
      yearsOptions += `<option value="${y}">${y}</option>`;
    }
    
    // Generate months
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    let monthsOptions = '<option value="">الشهر</option>';
    hijriMonths.forEach((month, index) => {
      monthsOptions += `<option value="${(index + 1).toString().padStart(2, '0')}">${month}</option>`;
    });
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'readyByDateModal';
    modal.className = 'bottom-sheet-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: flex-end;
      z-index: 10002;
      backdrop-filter: blur(8px);
      animation: fadeIn 0.3s ease;
    `;
    
    modal.innerHTML = `
      <div class="bottom-sheet" style="
        background: white;
        width: 100%;
        max-width: 700px;
        border-radius: 25px 25px 0 0;
        box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
        animation: slideUpSheet 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-height: 90vh;
        overflow-y: auto;
        direction: rtl;
      ">
        <div style="padding: 25px 20px;">
          
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
            <h2 style="margin: 0; color: #10b981; font-size: 20px; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📋</span>
              <span>كشف الجاهزين ليوم محدد</span>
            </h2>
            <button onclick="document.getElementById('readyByDateModal').remove()" style="
              background: #f1f5f9;
              border: none;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
            " onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">✕</button>
          </div>
          
          <!-- Date Selection -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #1f2937; font-size: 15px;">
              التاريخ الهجري
            </label>
            <div style="display: flex; gap: 10px;">
              <select class="luxury-select" id="readyDateDay" style="flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: white; transition: all 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e2e8f0'">
                <option value="">اليوم</option>
              </select>
              <select class="luxury-select" id="readyDateMonth" onchange="window.updateReadyDateDays()" style="flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: white; transition: all 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e2e8f0'">
                ${monthsOptions}
              </select>
              <select class="luxury-select" id="readyDateYear" onchange="window.updateReadyDateDays()" style="flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: white; transition: all 0.2s;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e2e8f0'">
                ${yearsOptions}
              </select>
            </div>
          </div>
          
          <!-- Teachers Selection -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <label style="font-weight: 700; color: #1f2937; font-size: 15px;">
                اختر الحلقات
              </label>
              <div style="display: flex; align-items: center; gap: 12px;">
                <button onclick="window.toggleSelectAllReadyTeachers()" id="selectAllReadyBtn" style="
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 8px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s;
                " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                  ✓ تحديد الكل
                </button>
                <span id="readyTeachersCount" style="font-size: 14px; color: #64748b; font-weight: 600;">
                  لم يتم الاختيار
                </span>
              </div>
            </div>
            <div class="teachers-checkboxes-container" style="max-height: 300px; overflow-y: auto; border: 2px solid #e2e8f0; border-radius: 12px; padding: 10px;">
              ${teachersCheckboxesHTML}
            </div>
          </div>
          
          <!-- Export Button -->
          <button onclick="window.exportReadyByDateReport()" style="
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.3)'">
            <span style="font-size: 20px;">📄</span>
            <span>تصدير التقرير PDF</span>
          </button>
          
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize date dropdowns with today's date
    const today = getTodayForStorage();
    const todayParts = today.split('-');
    document.getElementById('readyDateYear').value = todayParts[0];
    document.getElementById('readyDateMonth').value = todayParts[1];
    window.updateReadyDateDays();
    document.getElementById('readyDateDay').value = todayParts[2];
    
  } catch (error) {
    console.error('Error showing ready by date modal:', error);
    alert('❌ حدث خطأ في إظهار النافذة');
  }
};

/**
 * Update days dropdown based on selected month/year
 */
window.updateReadyDateDays = function() {
  const yearSelect = document.getElementById('readyDateYear');
  const monthSelect = document.getElementById('readyDateMonth');
  const daySelect = document.getElementById('readyDateDay');
  
  if (!yearSelect || !monthSelect || !daySelect) return;
  
  const year = yearSelect.value;
  const month = monthSelect.value;
  
  daySelect.innerHTML = '<option value="">اليوم</option>';
  
  if (!year || !month) return;
  
  // Get days for this month from accurateHijriDates
  const monthDates = accurateHijriDates.filter(entry => 
    entry.hijriYear === parseInt(year) && entry.hijriMonth === parseInt(month)
  );
  
  if (monthDates.length > 0) {
    monthDates.forEach(entry => {
      const day = entry.hijriDay.toString().padStart(2, '0');
      daySelect.innerHTML += `<option value="${day}">${day}</option>`;
    });
  } else {
    // Fallback: 1-30
    for (let d = 1; d <= 30; d++) {
      const day = d.toString().padStart(2, '0');
      daySelect.innerHTML += `<option value="${day}">${day}</option>`;
    }
  }
};

/**
 * Update selected teachers count
 */
window.updateSelectedReadyTeachersCount = function() {
  const checkboxes = document.querySelectorAll('.teacher-checkbox-ready');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  const countSpan = document.getElementById('readyTeachersCount');
  const selectAllBtn = document.getElementById('selectAllReadyBtn');
  
  if (checkedCount === 0) {
    countSpan.textContent = 'لم يتم الاختيار';
  } else if (checkedCount === 1) {
    countSpan.textContent = 'حلقة واحدة';
  } else if (checkedCount === 2) {
    countSpan.textContent = 'حلقتان';
  } else {
    countSpan.textContent = `${checkedCount} حلقات`;
  }
  
  // Update "Select All" button text
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  if (allChecked && checkboxes.length > 0) {
    selectAllBtn.textContent = '✗ إلغاء الكل';
  } else {
    selectAllBtn.textContent = '✓ تحديد الكل';
  }
};

/**
 * Toggle select all teachers
 */
window.toggleSelectAllReadyTeachers = function() {
  const checkboxes = document.querySelectorAll('.teacher-checkbox-ready');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });
  
  window.updateSelectedReadyTeachersCount();
};

/**
 * Export Ready By Date Report
 * تصدير تقرير الجاهزين ليوم محدد
 */
window.exportReadyByDateReport = async function() {
  try {
    // Validate date
    const year = document.getElementById('readyDateYear')?.value;
    const month = document.getElementById('readyDateMonth')?.value;
    const day = document.getElementById('readyDateDay')?.value;
    
    if (!year || !month || !day) {
      alert('⚠️ الرجاء اختيار التاريخ بالكامل');
      return;
    }
    
    const selectedDate = `${year}-${month}-${day}`;
    
    // Validate teachers selection
    const selectedCheckboxes = document.querySelectorAll('.teacher-checkbox-ready:checked');
    const selectedTeachers = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedTeachers.length === 0) {
      alert('⚠️ الرجاء اختيار معلم واحد على الأقل');
      return;
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
      z-index: 10003;
      text-align: center;
    `;
    loadingMsg.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
      <div style="font-size: 18px; color: #10b981; font-weight: bold;">جاري إنشاء التقرير...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">اختيار: ${selectedTeachers.length} ${selectedTeachers.length === 1 ? 'حلقة' : selectedTeachers.length === 2 ? 'حلقتان' : 'حلقات'}</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Get teacher names
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
    // Get today for calculations
    const today = getTodayForStorage();
    const todayEntry = accurateHijriDates.find(e => e.hijri === today);
    const todayGregorian = todayEntry ? new Date(todayEntry.gregorian) : new Date();
    
    // Process each teacher
    const allTeachersData = [];
    
    for (const teacherId of selectedTeachers) {
      const teacherName = teacherNamesMap[teacherId] || teacherId;
      
      // Fetch Hizb records
      const hizbQuery = query(
        collection(db, 'hizbDisplays'),
        where('teacherId', '==', teacherId),
        where('status', '==', 'incomplete')
      );
      const hizbSnapshot = await getDocs(hizbQuery);
      
      // Fetch Juz records
      const juzQuery = query(
        collection(db, 'juzDisplays'),
        where('teacherId', '==', teacherId),
        where('status', '==', 'incomplete')
      );
      const juzSnapshot = await getDocs(juzQuery);
      
      const students = [];
      
      // Process Hizb records
      hizbSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        let lastLessonDate = data.lastLessonDate;
        
        // Normalize date format
        if (lastLessonDate && typeof lastLessonDate === 'string') {
          const parts = lastLessonDate.split('-');
          if (parts.length === 3) {
            lastLessonDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
        
        if (lastLessonDate && lastLessonDate <= selectedDate) {
          // Calculate days since last lesson
          const lastLessonEntry = accurateHijriDates.find(e => e.hijri === lastLessonDate);
          let daysSince = '-';
          if (lastLessonEntry) {
            const lastLessonGregorian = new Date(lastLessonEntry.gregorian);
            const diffDays = calculateBusinessDays(lastLessonGregorian, todayGregorian);
            daysSince = `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومان' : 'أيام'}`;
          }
          
          students.push({
            name: data.studentName || 'غير محدد',
            type: 'حزب',
            number: data.hizbNumber || '-',
            registrationDate: formatDateForDisplay(lastLessonDate),
            daysSince: daysSince
          });
        }
      });
      
      // Process Juz records
      juzSnapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        let lastLessonDate = data.lastLessonDate;
        
        // Normalize date format
        if (lastLessonDate && typeof lastLessonDate === 'string') {
          const parts = lastLessonDate.split('-');
          if (parts.length === 3) {
            lastLessonDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
        
        if (lastLessonDate && lastLessonDate <= selectedDate) {
          // Calculate days since last lesson
          const lastLessonEntry = accurateHijriDates.find(e => e.hijri === lastLessonDate);
          let daysSince = '-';
          if (lastLessonEntry) {
            const lastLessonGregorian = new Date(lastLessonEntry.gregorian);
            const diffDays = calculateBusinessDays(lastLessonGregorian, todayGregorian);
            daysSince = `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومان' : 'أيام'}`;
          }
          
          students.push({
            name: data.studentName || 'غير محدد',
            type: 'جزء',
            number: data.juzNumber || '-',
            registrationDate: formatDateForDisplay(lastLessonDate),
            daysSince: daysSince
          });
        }
      });
      
      // Sort students by name
      students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      
      allTeachersData.push({
        teacherId: teacherId,
        teacherName: teacherName,
        students: students
      });
    }
    
    // Build HTML report
    let reportHTML = '';
    
    // Report title
    const dateLabel = formatDateForDisplay(selectedDate);
    reportHTML += `
      <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #10b981;">
        <h1 style="color: #10b981; margin: 0 0 12px 0; font-size: 28px; font-weight: 700;">كشف الطلاب الجاهزين للتسميع</h1>
        <p style="color: #64748b; margin: 0; font-size: 18px; font-weight: 600;">(${dateLabel})</p>
      </div>
    `;
    
    // Process each teacher
    allTeachersData.forEach((teacherData, teacherIndex) => {
      // Separator between teachers (except first)
      if (teacherIndex > 0) {
        reportHTML += `<div style="margin: 40px 0; border-top: 2px dashed #cbd5e1;"></div>`;
      }
      
      // Teacher header
      reportHTML += `
        <div style="background: #f8fafc; padding: 16px 20px; border-radius: 10px; margin-bottom: 20px; border-right: 5px solid #10b981;">
          <h2 style="margin: 0; color: #1f2937; font-size: 20px; font-weight: 700;">الأستاذ: ${teacherData.teacherName}</h2>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">عدد الطلاب الجاهزين: ${teacherData.students.length}</p>
        </div>
      `;
      
      // Students table
      if (teacherData.students.length > 0) {
        let studentsRowsHTML = '';
        teacherData.students.forEach((student, index) => {
          const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
          const typeText = student.type === 'جزء' ? `جزء ${student.number}` : `حزب ${student.number}`;
          
          studentsRowsHTML += `
            <tr style="background: ${bgColor};">
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; font-size: 15px; color: #1f2937;">${student.name}</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: center; font-size: 15px; color: #475569;">${typeText}</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: center; font-size: 14px; color: #64748b;">${student.registrationDate}</td>
              <td style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: center; font-size: 14px; color: #10b981; font-weight: 600;">${student.daysSince}</td>
            </tr>
          `;
        });
        
        reportHTML += `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr>
                <th style="background: #10b981; color: white; padding: 14px 16px; text-align: right; border: none; font-size: 15px; font-weight: 600; width: 35%;">اسم الطالب</th>
                <th style="background: #10b981; color: white; padding: 14px 16px; text-align: center; border: none; font-size: 15px; font-weight: 600; width: 20%;">رقم الحزب/الجزء</th>
                <th style="background: #10b981; color: white; padding: 14px 16px; text-align: center; border: none; font-size: 15px; font-weight: 600; width: 22%;">تاريخ التسجيل</th>
                <th style="background: #10b981; color: white; padding: 14px 16px; text-align: center; border: none; font-size: 15px; font-weight: 600; width: 23%;">كم مضى على آخر درس</th>
              </tr>
            </thead>
            <tbody>
              ${studentsRowsHTML}
            </tbody>
          </table>
        `;
      } else {
        reportHTML += `
          <div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 10px; color: #94a3b8;">
            <p style="margin: 0; font-size: 15px;">لا يوجد طلاب جاهزون في هذا التاريخ</p>
          </div>
        `;
      }
    });
    
    // Footer
    reportHTML += `
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
        <p style="margin: 5px 0; color: #10b981; font-size: 13px;">نظام إدارة حلقات القرآن الكريم</p>
        <p style="margin: 5px 0; color: #94a3b8; font-size: 12px;">تاريخ التصدير: ${formatDateForDisplay(today)}</p>
      </div>
    `;
    
    // Create container for PDF generation
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 900px;
      background: white;
      padding: 40px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      text-align: right;
    `;
    container.innerHTML = reportHTML;
    document.body.appendChild(container);
    
    // Generate PDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    const fileName = `كشف_الجاهزين_${dateLabel.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
    
    // Remove loading and modal
    loadingMsg.remove();
    document.getElementById('readyByDateModal')?.remove();
    
    alert('✅ تم تصدير التقرير بنجاح!');
    
  } catch (error) {
    console.error('Error exporting ready by date report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

/**
 * Show Hizb Student Report Modal
 */
async function showHizbStudentReportModal() {
  const teachers = await getTeachersList();
  
  const overlay = document.createElement('div');
  overlay.id = 'hizbStudentModal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
    backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease;
    overflow-y: auto;
    padding: 20px;
  `;
  
  let teachersOptions = '<option value="">-- اختر المعلم --</option>';
  teachers.forEach(teacher => {
    teachersOptions += `<option value="${teacher}">${teacher}</option>`;
  });
  
  overlay.innerHTML = `
    <div style="background: white; border-radius: 25px; width: 100%; max-width: 700px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); direction: rtl; overflow: hidden; margin: auto;">
      <style>
        ${getModalStyles()}
        
        .hizb-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
          gap: 12px;
          margin-top: 20px;
        }
        
        .hizb-cell {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-weight: 700;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }
        
        .hizb-cell::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        
        .hizb-cell:hover::before {
          opacity: 1;
        }
        
        .hizb-cell.completed {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        
        .hizb-cell.pending {
          background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
        }
        
        .hizb-cell:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }
        
        .hizb-number {
          font-size: 20px;
          margin-bottom: 4px;
        }
        
        .hizb-icon {
          font-size: 16px;
        }
        
        .progress-bar-container {
          width: 100%;
          height: 14px;
          background: #e2e8f0;
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .progress-bar-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .stats-row {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }
        
        .stat-badge.success {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        
        .stat-badge.pending {
          background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
          color: white;
        }
        
        #hizbStudentRecordsContainer {
          display: none;
        }
        
        #hizbStudentRecordsContainer.show {
          display: block;
          animation: fadeInUp 0.4s ease;
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
        <div style="font-size: 52px; margin-bottom: 12px;">👤</div>
        <h2 style="margin: 0; font-size: 26px; font-weight: 700;">تقرير طالب معين</h2>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">اختر المعلم والطالب لعرض السجل</p>
      </div>
      
      <!-- Body -->
      <div style="padding: 30px;">
        
        <!-- Teacher Selection -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            👨‍🏫 اختر المعلم
          </label>
          <select class="luxury-select" id="hizbStudModalTeacher" onchange="window.loadHizbStudentsForModal()">
            ${teachersOptions}
          </select>
        </div>
        
        <!-- Student Selection -->
        <div style="margin-bottom: 25px;">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            👨‍🎓 اختر الطالب
          </label>
          <select class="luxury-select" id="hizbStudModalStudent">
            <option value="">-- اختر المعلم أولاً --</option>
          </select>
        </div>
        
        <!-- View Button -->
        <button class="export-button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);" onclick="window.viewHizbStudentRecordsModal()">
          <span style="font-size: 24px;">👁️</span>
          <span>استعراض التقرير</span>
        </button>
        
        <!-- Records Container -->
        <div id="hizbStudentRecordsContainer" style="margin-top: 30px;">
          <!-- Will be populated dynamically -->
        </div>
        
        <!-- Cancel Button -->
        <button onclick="document.getElementById('hizbStudentModal').remove();" 
          style="width: 100%; padding: 12px; margin-top: 15px; background: #f1f3f5; color: #495057; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          ❌ إغلاق
        </button>
        
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

/**
 * Load students for selected teacher in student modal
 */
window.loadHizbStudentsForModal = async function() {
  const teacherSelect = document.getElementById('hizbStudModalTeacher');
  const studentSelect = document.getElementById('hizbStudModalStudent');
  
  if (!teacherSelect || !studentSelect) return;
  
  const teacher = teacherSelect.value;
  if (!teacher) {
    studentSelect.innerHTML = '<option value="">-- اختر المعلم أولاً --</option>';
    return;
  }
  
  studentSelect.innerHTML = '<option value="">جاري التحميل...</option>';
  
  try {
    const q = query(
      collection(db, 'hizbDisplays'),
      where('teacherName', '==', teacher)
    );
    const snapshot = await getDocs(q);
    
    const students = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.studentName) {
        students.add(data.studentName);
      }
    });
    
    studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>';
    Array.from(students).sort().forEach(student => {
      const option = document.createElement('option');
      option.value = student;
      option.textContent = student;
      studentSelect.appendChild(option);
    });
    
    console.log(`Loaded ${students.size} students for teacher ${teacher}`);
    
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelect.innerHTML = '<option value="">❌ حدث خطأ في التحميل</option>';
  }
};

/**
 * View Hizb student records in modal
 */
window.viewHizbStudentRecordsModal = async function() {
  const teacherSelect = document.getElementById('hizbStudModalTeacher');
  const studentSelect = document.getElementById('hizbStudModalStudent');
  const recordsContainer = document.getElementById('hizbStudentRecordsContainer');
  
  if (!teacherSelect || !studentSelect || !recordsContainer) return;
  
  const teacher = teacherSelect.value;
  const student = studentSelect.value;
  
  if (!teacher || !student) {
    alert('الرجاء اختيار المعلم والطالب');
    return;
  }
  
  recordsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">جاري التحميل...</div>';
  recordsContainer.classList.add('show');
  
  try {
    // Fetch ALL hizb records (completed + incomplete)
    const q = query(
      collection(db, 'hizbDisplays'),
      where('teacherName', '==', teacher),
      where('studentName', '==', student)
    );
    const snapshot = await getDocs(q);
    
    // Build map: hizbNumber -> {status, data, docId}
    const hizbDataMap = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.hizbNumber) {
        const existing = hizbDataMap.get(data.hizbNumber);
        // Prioritize completed over incomplete
        if (!existing || (data.status === 'completed' && existing.status !== 'completed')) {
          hizbDataMap.set(data.hizbNumber, {
            docId: doc.id,
            status: data.status || 'incomplete',
            displayDate: data.displayDate || '',
            lastLessonDate: data.lastLessonDate || '',
            firstLessonDate: data.firstLessonDate || data.lastLessonDate || '',
            viewerName: data.viewerName || '',
            duration: ''
          });
        }
      }
    });
    
    // Calculate durations for completed records
    hizbDataMap.forEach((record, hizbNum) => {
      if (record.status === 'completed' && record.firstLessonDate && record.displayDate) {
        const firstEntry = accurateHijriDates.find(e => e.hijri === record.firstLessonDate);
        let displayDateNormalized = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            displayDateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const lastEntry = accurateHijriDates.find(e => e.hijri === displayDateNormalized);
        
        if (firstEntry && lastEntry) {
          const firstDate = new Date(firstEntry.gregorian);
          const lastDate = new Date(lastEntry.gregorian);
          const diffDays = calculateBusinessDays(firstDate, lastDate);
          record.duration = `${diffDays} يوم`;
        }
      }
    });
    
    const totalHizbs = 60;
    const completedCount = Array.from(hizbDataMap.values()).filter(r => r.status === 'completed').length;
    const incompleteCount = Array.from(hizbDataMap.values()).filter(r => r.status === 'incomplete').length;
    const notStartedCount = totalHizbs - completedCount - incompleteCount;
    const progressPercent = Math.round((completedCount / totalHizbs) * 100);
    
    // Generate modern list
    let listHTML = '';
    for (let i = 1; i <= totalHizbs; i++) {
      const record = hizbDataMap.get(i);
      let statusIndicator = '';
      let statusClass = '';
      let statusText = '';
      
      if (record) {
        if (record.status === 'completed') {
          statusIndicator = '<div class="status-dot completed"></div>';
          statusClass = 'completed';
          statusText = 'مجتاز';
        } else {
          statusIndicator = '<div class="status-dot incomplete"></div>';
          statusClass = 'incomplete';
          statusText = 'معلق';
        }
      } else {
        statusIndicator = '<div class="status-dot not-started"></div>';
        statusClass = 'not-started';
        statusText = 'لم يسجل';
      }
      
      listHTML += `
        <div class="record-item ${statusClass}" onclick="window.showHizbDetailsBottomSheet(${i}, '${teacher}', '${student}')" style="animation-delay: ${i * 10}ms;">
          ${statusIndicator}
          <span class="record-number">حزب ${i}</span>
          <span class="record-status-text">${statusText}</span>
          <div class="record-arrow">›</div>
        </div>
      `;
    }
    
    recordsContainer.innerHTML = `
      <div class="modern-records-container">
        <div class="records-header">
          <h3>سجل أحزاب الطالب</h3>
          <p class="student-name">${student}</p>
        </div>
        
        <div class="progress-section">
          <div class="progress-info">
            <span>نسبة الإنجاز</span>
            <span class="progress-percent">${progressPercent}%</span>
          </div>
          <div class="progress-bar-modern">
            <div class="progress-fill-modern" style="width: ${progressPercent}%"></div>
          </div>
        </div>
        
        <div class="stats-modern">
          <div class="stat-item">
            <div class="stat-dot completed"></div>
            <span>${completedCount} مجتاز</span>
          </div>
          <div class="stat-item">
            <div class="stat-dot incomplete"></div>
            <span>${incompleteCount} معلق</span>
          </div>
          <div class="stat-item">
            <div class="stat-dot not-started"></div>
            <span>${notStartedCount} لم يسجل</span>
          </div>
        </div>
        
        <div class="records-list">
          ${listHTML}
        </div>
        
        <button class="export-btn-modern" onclick="window.exportHizbStudentReport()">
          تصدير PDF
        </button>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading student records:', error);
    recordsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">حدث خطأ في تحميل السجلات</div>';
  }
};

/**
 * Export Hizb student report
 */
window.exportHizbStudentReport = async function() {
  try {
    const teacherSelect = document.getElementById('hizbStudModalTeacher');
    const studentSelect = document.getElementById('hizbStudModalStudent');
    
    if (!teacherSelect || !studentSelect) {
      alert('⚠️ حدث خطأ في تحميل النموذج');
      return;
    }
    
    const teacher = teacherSelect.value;
    const student = studentSelect.value;
    
    if (!teacher || !student) {
      alert('⚠️ الرجاء اختيار المعلم والطالب');
      return;
    }
    
    const periodLabel = 'السجل الكامل';
    
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
      z-index: 10002;
      text-align: center;
    `;
    loadingMsg.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
      <div style="font-size: 18px; color: #667eea; font-weight: bold;">جاري إنشاء تقرير الطالب...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">يرجى الانتظار</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Fetch all hizbDisplays for this student and teacher
    const q = query(
      collection(db, 'hizbDisplays'),
      where('teacherName', '==', teacher),
      where('studentName', '==', student)
    );
    const snapshot = await getDocs(q);
    
    // Build a map: hizbNumber -> record data
    const hizbRecordsMap = new Map();
    
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const hizbNumber = data.hizbNumber;
      
      if (!hizbNumber) return;
      
      // Store record if not exists or replace with completed status
      const existing = hizbRecordsMap.get(hizbNumber);
      if (!existing || (data.status === 'completed' && existing.status === 'incomplete')) {
        hizbRecordsMap.set(hizbNumber, {
          hizbNumber: hizbNumber,
          status: data.status || 'incomplete',
          displayDate: data.displayDate || '',
          lastLessonDate: data.lastLessonDate || '',
          firstLessonDate: data.firstLessonDate || data.lastLessonDate || '',
          viewerName: data.viewerName || '-',
          duration: ''
        });
      }
    });
    
    // Calculate duration for completed records
    hizbRecordsMap.forEach((record, hizbNum) => {
      if (record.status === 'completed' && record.firstLessonDate && record.displayDate) {
        const firstEntry = accurateHijriDates.find(e => e.hijri === record.firstLessonDate);
        let displayDateNormalized = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            displayDateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const lastEntry = accurateHijriDates.find(e => e.hijri === displayDateNormalized);
        
        if (firstEntry && lastEntry) {
          const firstDate = new Date(firstEntry.gregorian);
          const lastDate = new Date(lastEntry.gregorian);
          // ✅ حساب أيام الدراسة فقط (بدون الجمعة والسبت)
          const diffDays = calculateBusinessDays(firstDate, lastDate);
          record.duration = `${diffDays} يوم`;
        }
      }
    });
    
    // Build table rows for ALL 60 ahzab
    let tableRowsHTML = '';
    for (let hizbNum = 1; hizbNum <= 60; hizbNum++) {
      const record = hizbRecordsMap.get(hizbNum);
      
      const bgColor = hizbNum % 2 === 0 ? '#f8f9fa' : 'white';
      const statusText = record && record.status === 'completed' ? '✅' : '⏳';
      const statusColor = record && record.status === 'completed' ? '#28a745' : '#999';
      
      let displayDateText = '-';
      if (record && record.status === 'completed' && record.displayDate) {
        let normalizedDate = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        displayDateText = formatDateForDisplay(normalizedDate);
      }
      
      const durationText = record && record.duration ? record.duration : '-';
      const listenerText = record && record.viewerName ? record.viewerName : '-';
      
      tableRowsHTML += `
        <tr style="background: ${bgColor};">
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px; font-weight: 600;">حزب ${hizbNum}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px; color: ${statusColor}; font-weight: 600;">${statusText}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #495057;">${displayDateText}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #495057;">${durationText}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right; font-size: 14px; color: #495057;">${listenerText}</td>
        </tr>
      `;
    }
    
    // Calculate statistics
    const completedCount = Array.from(hizbRecordsMap.values()).filter(r => r.status === 'completed').length;
    const totalCount = 60;
    const pendingCount = totalCount - completedCount;
    const progressPercent = Math.round((completedCount / totalCount) * 100);
    
    const today = getTodayForStorage();
    
    // Create HTML content for PDF
    const container = document.createElement('div');
    container.style.cssText = `
      direction: rtl;
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
      padding: 40px;
      width: 210mm;
      min-height: 297mm;
      box-sizing: border-box;
    `;
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 32px;">� التقرير الشامل لسجل الأحزاب</h1>
        <h2 style="color: #2d3748; margin: 0 0 5px 0; font-size: 24px;">الطالب: ${student}</h2>
        <h3 style="color: #495057; margin: 0 0 5px 0; font-size: 20px;">المعلم: ${teacher}</h3>
        <p style="color: #666; font-size: 16px; margin: 8px 0 0 0; font-weight: bold;">${periodLabel}</p>
        <p style="color: #999; font-size: 14px; margin: 5px 0 0 0;">تاريخ التقرير: ${formatDateForDisplay(today)}</p>
      </div>
      
      <div style="margin-bottom: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px;">
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">مجموع الأحزاب</div>
            <div style="font-size: 24px; font-weight: bold;">${totalCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">مجتاز</div>
            <div style="font-size: 24px; font-weight: bold; color: #90ee90;">${completedCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">متبقي</div>
            <div style="font-size: 24px; font-weight: bold; color: #ffb6c1;">${pendingCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">نسبة الإنجاز</div>
            <div style="font-size: 24px; font-weight: bold;">${progressPercent}%</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 20px; border-bottom: 3px solid #667eea; padding-bottom: 10px;">
          📊 سجل الأحزاب
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; border-radius: 8px 0 0 0; width: 15%;">رقم الحزب</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; width: 15%;">الحالة</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; width: 20%;">تاريخ الاجتياز</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; width: 15%;">المدة المستغرقة</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: right; border: none; font-size: 15px; border-radius: 0 8px 0 0; width: 35%;">اسم المستمع</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea;">
        <p style="margin: 5px 0; color: #667eea; font-size: 14px; font-style: italic;">📚 نظام إدارة عرض الأحزاب القرآنية</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${formatDateForDisplay(today)}</p>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Generate PDF using html2canvas and jsPDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    const fileName = `تقرير_طالب_${student}_${periodLabel.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
    
    // Remove loading and overlay
    loadingMsg.remove();
    document.getElementById('hizbStudentModal')?.remove();
    
    alert('✅ تم تصدير تقرير الطالب بنجاح!');
    
  } catch (error) {
    console.error('Error generating Hizb student report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

// ==========================================
// JUZ STUDENT REPORT - Individual Student Report System
// ==========================================

/**
 * Show Juz Student Report Modal
 */
async function showJuzStudentReportModal() {
  const teachers = await getTeachersList();
  
  const overlay = document.createElement('div');
  overlay.id = 'juzStudentModal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10001;
    backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease;
    overflow-y: auto;
    padding: 20px;
  `;
  
  let teachersOptions = '<option value="">-- اختر المعلم --</option>';
  teachers.forEach(teacher => {
    teachersOptions += `<option value="${teacher}">${teacher}</option>`;
  });
  
  overlay.innerHTML = `
    <div style="background: white; border-radius: 25px; width: 100%; max-width: 700px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1); direction: rtl; overflow: hidden; margin: auto;">
      <style>
        ${getModalStyles()}
        
        .juz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 12px;
          margin-top: 20px;
        }
        
        .juz-cell {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          font-weight: 700;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }
        
        .juz-cell::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        
        .juz-cell:hover::before {
          opacity: 1;
        }
        
        .juz-cell.completed {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        
        .juz-cell.pending {
          background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
        }
        
        .juz-cell:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }
        
        .juz-number {
          font-size: 22px;
          margin-bottom: 4px;
        }
        
        .juz-icon {
          font-size: 16px;
        }
        
        .progress-bar-container {
          width: 100%;
          height: 14px;
          background: #e2e8f0;
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
          border-radius: 20px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        
        .progress-bar-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .stats-row {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }
        
        .stat-badge.success {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        
        .stat-badge.pending {
          background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
          color: white;
        }
        
        #juzStudentRecordsContainer {
          display: none;
        }
        
        #juzStudentRecordsContainer.show {
          display: block;
          animation: fadeInUp 0.4s ease;
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center;">
        <div style="font-size: 52px; margin-bottom: 12px;">👤</div>
        <h2 style="margin: 0; font-size: 26px; font-weight: 700;">تقرير طالب معين</h2>
        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">اختر المعلم والطالب لعرض السجل</p>
      </div>
      
      <!-- Body -->
      <div style="padding: 30px;">
        
        <!-- Teacher Selection -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            👨‍🏫 اختر المعلم
          </label>
          <select class="luxury-select" id="juzStudModalTeacher" onchange="window.loadJuzStudentsForModal()">
            ${teachersOptions}
          </select>
        </div>
        
        <!-- Student Selection -->
        <div style="margin-bottom: 25px;">
          <label style="display: block; font-weight: 700; margin-bottom: 12px; color: #2d3748; font-size: 15px;">
            👨‍🎓 اختر الطالب
          </label>
          <select class="luxury-select" id="juzStudModalStudent">
            <option value="">-- اختر المعلم أولاً --</option>
          </select>
        </div>
        
        <!-- View Button -->
        <button class="export-button" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);" onclick="window.viewJuzStudentRecordsModal()">
          <span style="font-size: 24px;">👁️</span>
          <span>استعراض التقرير</span>
        </button>
        
        <!-- Records Container -->
        <div id="juzStudentRecordsContainer" style="margin-top: 30px;">
          <!-- Will be populated dynamically -->
        </div>
        
        <!-- Cancel Button -->
        <button onclick="document.getElementById('juzStudentModal').remove();" 
          style="width: 100%; padding: 12px; margin-top: 15px; background: #f1f3f5; color: #495057; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
          ❌ إغلاق
        </button>
        
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

/**
 * Load students for selected teacher in student modal (Juz)
 */
window.loadJuzStudentsForModal = async function() {
  const teacherSelect = document.getElementById('juzStudModalTeacher');
  const studentSelect = document.getElementById('juzStudModalStudent');
  
  if (!teacherSelect || !studentSelect) return;
  
  const teacher = teacherSelect.value;
  if (!teacher) {
    studentSelect.innerHTML = '<option value="">-- اختر المعلم أولاً --</option>';
    return;
  }
  
  studentSelect.innerHTML = '<option value="">جاري التحميل...</option>';
  
  try {
    const q = query(
      collection(db, 'juzDisplays'),
      where('teacherName', '==', teacher)
    );
    const snapshot = await getDocs(q);
    
    const students = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.studentName) {
        students.add(data.studentName);
      }
    });
    
    studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>';
    Array.from(students).sort().forEach(student => {
      const option = document.createElement('option');
      option.value = student;
      option.textContent = student;
      studentSelect.appendChild(option);
    });
    
    console.log(`Loaded ${students.size} students for teacher ${teacher}`);
    
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelect.innerHTML = '<option value="">❌ حدث خطأ في التحميل</option>';
  }
};

/**
 * View Juz student records in modal
 */
window.viewJuzStudentRecordsModal = async function() {
  const teacherSelect = document.getElementById('juzStudModalTeacher');
  const studentSelect = document.getElementById('juzStudModalStudent');
  const recordsContainer = document.getElementById('juzStudentRecordsContainer');
  
  if (!teacherSelect || !studentSelect || !recordsContainer) return;
  
  const teacher = teacherSelect.value;
  const student = studentSelect.value;
  
  if (!teacher || !student) {
    alert('الرجاء اختيار المعلم والطالب');
    return;
  }
  
  recordsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">جاري التحميل...</div>';
  recordsContainer.classList.add('show');
  
  try {
    // Fetch ALL juz records (completed + incomplete)
    const q = query(
      collection(db, 'juzDisplays'),
      where('teacherName', '==', teacher),
      where('studentName', '==', student)
    );
    const snapshot = await getDocs(q);
    
    // Build map: juzNumber -> {status, data, docId}
    const juzDataMap = new Map();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.juzNumber) {
        const existing = juzDataMap.get(data.juzNumber);
        // Prioritize completed over incomplete
        if (!existing || (data.status === 'completed' && existing.status !== 'completed')) {
          juzDataMap.set(data.juzNumber, {
            docId: doc.id,
            status: data.status || 'incomplete',
            displayDate: data.displayDate || '',
            lastLessonDate: data.lastLessonDate || '',
            firstLessonDate: data.firstLessonDate || data.lastLessonDate || '',
            viewerName: data.viewerName || '',
            duration: ''
          });
        }
      }
    });
    
    // Calculate durations for completed records
    juzDataMap.forEach((record, juzNum) => {
      if (record.status === 'completed' && record.firstLessonDate && record.displayDate) {
        const firstEntry = accurateHijriDates.find(e => e.hijri === record.firstLessonDate);
        let displayDateNormalized = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            displayDateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const lastEntry = accurateHijriDates.find(e => e.hijri === displayDateNormalized);
        
        if (firstEntry && lastEntry) {
          const firstDate = new Date(firstEntry.gregorian);
          const lastDate = new Date(lastEntry.gregorian);
          const diffDays = calculateBusinessDays(firstDate, lastDate);
          record.duration = `${diffDays} يوم`;
        }
      }
    });
    
    const totalJuzs = 30;
    const completedCount = Array.from(juzDataMap.values()).filter(r => r.status === 'completed').length;
    const incompleteCount = Array.from(juzDataMap.values()).filter(r => r.status === 'incomplete').length;
    const notStartedCount = totalJuzs - completedCount - incompleteCount;
    const progressPercent = Math.round((completedCount / totalJuzs) * 100);
    
    // Generate modern list
    let listHTML = '';
    for (let i = 1; i <= totalJuzs; i++) {
      const record = juzDataMap.get(i);
      let statusIndicator = '';
      let statusClass = '';
      let statusText = '';
      
      if (record) {
        if (record.status === 'completed') {
          statusIndicator = '<div class="status-dot completed"></div>';
          statusClass = 'completed';
          statusText = 'مجتاز';
        } else {
          statusIndicator = '<div class="status-dot incomplete"></div>';
          statusClass = 'incomplete';
          statusText = 'معلق';
        }
      } else {
        statusIndicator = '<div class="status-dot not-started"></div>';
        statusClass = 'not-started';
        statusText = 'لم يسجل';
      }
      
      listHTML += `
        <div class="record-item ${statusClass}" onclick="window.showJuzDetailsBottomSheet(${i}, '${teacher}', '${student}')" style="animation-delay: ${i * 20}ms;">
          ${statusIndicator}
          <span class="record-number">جزء ${i}</span>
          <span class="record-status-text">${statusText}</span>
          <div class="record-arrow">›</div>
        </div>
      `;
    }
    
    recordsContainer.innerHTML = `
      <div class="modern-records-container">
        <div class="records-header">
          <h3>سجل أجزاء الطالب</h3>
          <p class="student-name">${student}</p>
        </div>
        
        <div class="progress-section">
          <div class="progress-info">
            <span>نسبة الإنجاز</span>
            <span class="progress-percent">${progressPercent}%</span>
          </div>
          <div class="progress-bar-modern">
            <div class="progress-fill-modern" style="width: ${progressPercent}%"></div>
          </div>
        </div>
        
        <div class="stats-modern">
          <div class="stat-item">
            <div class="stat-dot completed"></div>
            <span>${completedCount} مجتاز</span>
          </div>
          <div class="stat-item">
            <div class="stat-dot incomplete"></div>
            <span>${incompleteCount} معلق</span>
          </div>
          <div class="stat-item">
            <div class="stat-dot not-started"></div>
            <span>${notStartedCount} لم يسجل</span>
          </div>
        </div>
        
        <div class="records-list">
          ${listHTML}
        </div>
        
        <button class="export-btn-modern" onclick="window.exportJuzStudentReport()">
          تصدير PDF
        </button>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading student records:', error);
    recordsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc3545;">حدث خطأ في تحميل السجلات</div>';
  }
};

/**
 * Toggle period type for Juz Student Report
 */
window.toggleJuzStudentPeriod = function() {
  const type = document.getElementById('juzStudPeriodType')?.value;
  const monthSection = document.getElementById('juzStudMonthSection');
  const customSection = document.getElementById('juzStudCustomSection');
  
  if (type === 'month') {
    monthSection?.classList.add('active');
    customSection?.classList.remove('active');
  } else {
    monthSection?.classList.remove('active');
    customSection?.classList.add('active');
  }
};

/**
 * Show Juz details in bottom sheet
 */
window.showJuzDetailsBottomSheet = async function(juzNumber, teacher, student) {
  try {
    // Query for this specific juz
    const q = query(
      collection(db, 'juzDisplays'),
      where('teacherName', '==', teacher),
      where('studentName', '==', student),
      where('juzNumber', '==', juzNumber)
    );
    const snapshot = await getDocs(q);
    
    let record = null;
    let docId = null;
    
    // Get the record (prioritize completed)
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!record || (data.status === 'completed' && record.status !== 'completed')) {
        record = data;
        docId = doc.id;
      }
    });
    
    // Create bottom sheet
    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet-overlay';
    sheet.onclick = (e) => {
      if (e.target === sheet) closeBottomSheet();
    };
    
    let contentHTML = '';
    
    if (record) {
      // Calculate duration
      let durationText = '';
      if (record.status === 'completed' && record.firstLessonDate && record.displayDate) {
        const firstEntry = accurateHijriDates.find(e => e.hijri === record.firstLessonDate);
        let displayDateNormalized = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            displayDateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const lastEntry = accurateHijriDates.find(e => e.hijri === displayDateNormalized);
        
        if (firstEntry && lastEntry) {
          const firstDate = new Date(firstEntry.gregorian);
          const lastDate = new Date(lastEntry.gregorian);
          const diffDays = calculateBusinessDays(firstDate, lastDate);
          durationText = `${diffDays} يوم`;
        }
      }
      
      const statusText = record.status === 'completed' ? 'مجتاز' : 'معلق';
      const statusClass = record.status === 'completed' ? 'completed' : 'incomplete';
      
      contentHTML = `
        <div class="bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <h3>جزء رقم ${juzNumber}</h3>
            <div class="status-badge-large ${statusClass}">${statusText}</div>
          </div>
          
          <div class="sheet-content">
            <div class="detail-row">
              <span class="detail-label">المعلم</span>
              <span class="detail-value">${teacher}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">الطالب</span>
              <span class="detail-value">${student}</span>
            </div>
            
            ${record.status === 'completed' ? `
              <div class="detail-row">
                <span class="detail-label">تاريخ الإجازة</span>
                <span class="detail-value">${formatDateForDisplay(record.displayDate)}</span>
              </div>
            ` : ''}
            
            ${record.lastLessonDate ? `
              <div class="detail-row">
                <span class="detail-label">${record.status === 'completed' ? 'آخر درس' : 'تاريخ التسجيل'}</span>
                <span class="detail-value">${formatDateForDisplay(record.lastLessonDate)}</span>
              </div>
            ` : ''}
            
            ${durationText ? `
              <div class="detail-row">
                <span class="detail-label">المدة</span>
                <span class="detail-value">${durationText}</span>
              </div>
            ` : ''}
            
            ${record.viewerName ? `
              <div class="detail-row">
                <span class="detail-label">المستمع</span>
                <span class="detail-value">${record.viewerName}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="sheet-actions">
            <button class="sheet-btn edit" onclick="editJuzRecord('${docId}', ${juzNumber}, '${teacher}', '${student}')">
              تعديل
            </button>
            <button class="sheet-btn delete" onclick="deleteJuzRecord('${docId}', ${juzNumber}, '${teacher}', '${student}')">
              حذف
            </button>
            <button class="sheet-btn cancel" onclick="closeBottomSheet()">
              إغلاق
            </button>
          </div>
        </div>
      `;
    } else {
      // No record - not started
      contentHTML = `
        <div class="bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <h3>جزء رقم ${juzNumber}</h3>
            <div class="status-badge-large not-started">لم يسجل</div>
          </div>
          
          <div class="sheet-content">
            <div class="empty-state">
              <p>لم يتم تسجيل هذا الجزء بعد</p>
            </div>
          </div>
          
          <div class="sheet-actions">
            <button class="sheet-btn cancel" onclick="closeBottomSheet()">
              إغلاق
            </button>
          </div>
        </div>
      `;
    }
    
    sheet.innerHTML = contentHTML;
    document.body.appendChild(sheet);
    
    // Trigger animation
    setTimeout(() => {
      sheet.classList.add('active');
    }, 10);
    
  } catch (error) {
    console.error('Error showing details:', error);
    alert('حدث خطأ في عرض التفاصيل');
  }
};

/**
 * Show Hizb details in bottom sheet
 */
window.showHizbDetailsBottomSheet = async function(hizbNumber, teacher, student) {
  try {
    // Query for this specific hizb
    const q = query(
      collection(db, 'hizbDisplays'),
      where('teacherName', '==', teacher),
      where('studentName', '==', student),
      where('hizbNumber', '==', hizbNumber)
    );
    const snapshot = await getDocs(q);
    
    let record = null;
    let docId = null;
    
    // Get the record (prioritize completed)
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!record || (data.status === 'completed' && record.status !== 'completed')) {
        record = data;
        docId = doc.id;
      }
    });
    
    // Create bottom sheet
    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet-overlay';
    sheet.onclick = (e) => {
      if (e.target === sheet) closeBottomSheet();
    };
    
    let contentHTML = '';
    
    if (record) {
      // Calculate duration
      let durationText = '';
      if (record.status === 'completed' && record.firstLessonDate && record.displayDate) {
        const firstEntry = accurateHijriDates.find(e => e.hijri === record.firstLessonDate);
        let displayDateNormalized = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            displayDateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const lastEntry = accurateHijriDates.find(e => e.hijri === displayDateNormalized);
        
        if (firstEntry && lastEntry) {
          const firstDate = new Date(firstEntry.gregorian);
          const lastDate = new Date(lastEntry.gregorian);
          const diffDays = calculateBusinessDays(firstDate, lastDate);
          durationText = `${diffDays} يوم`;
        }
      }
      
      const statusText = record.status === 'completed' ? 'مجتاز' : 'معلق';
      const statusClass = record.status === 'completed' ? 'completed' : 'incomplete';
      
      contentHTML = `
        <div class="bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <h3>حزب رقم ${hizbNumber}</h3>
            <div class="status-badge-large ${statusClass}">${statusText}</div>
          </div>
          
          <div class="sheet-content">
            <div class="detail-row">
              <span class="detail-label">المعلم</span>
              <span class="detail-value">${teacher}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">الطالب</span>
              <span class="detail-value">${student}</span>
            </div>
            
            ${record.status === 'completed' ? `
              <div class="detail-row">
                <span class="detail-label">تاريخ الإجازة</span>
                <span class="detail-value">${formatDateForDisplay(record.displayDate)}</span>
              </div>
            ` : ''}
            
            ${record.lastLessonDate ? `
              <div class="detail-row">
                <span class="detail-label">${record.status === 'completed' ? 'آخر درس' : 'تاريخ التسجيل'}</span>
                <span class="detail-value">${formatDateForDisplay(record.lastLessonDate)}</span>
              </div>
            ` : ''}
            
            ${durationText ? `
              <div class="detail-row">
                <span class="detail-label">المدة</span>
                <span class="detail-value">${durationText}</span>
              </div>
            ` : ''}
            
            ${record.viewerName ? `
              <div class="detail-row">
                <span class="detail-label">المستمع</span>
                <span class="detail-value">${record.viewerName}</span>
              </div>
            ` : ''}
          </div>
          
          <div class="sheet-actions">
            <button class="sheet-btn edit" onclick="editHizbRecord('${docId}', ${hizbNumber}, '${teacher}', '${student}')">
              تعديل
            </button>
            <button class="sheet-btn delete" onclick="deleteHizbRecord('${docId}', ${hizbNumber}, '${teacher}', '${student}')">
              حذف
            </button>
            <button class="sheet-btn cancel" onclick="closeBottomSheet()">
              إغلاق
            </button>
          </div>
        </div>
      `;
    } else {
      // No record - not started
      contentHTML = `
        <div class="bottom-sheet" onclick="event.stopPropagation()">
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <h3>حزب رقم ${hizbNumber}</h3>
            <div class="status-badge-large not-started">لم يسجل</div>
          </div>
          
          <div class="sheet-content">
            <div class="empty-state">
              <p>لم يتم تسجيل هذا الحزب بعد</p>
            </div>
          </div>
          
          <div class="sheet-actions">
            <button class="sheet-btn cancel" onclick="closeBottomSheet()">
              إغلاق
            </button>
          </div>
        </div>
      `;
    }
    
    sheet.innerHTML = contentHTML;
    document.body.appendChild(sheet);
    
    // Trigger animation
    setTimeout(() => {
      sheet.classList.add('active');
    }, 10);
    
  } catch (error) {
    console.error('Error showing details:', error);
    alert('حدث خطأ في عرض التفاصيل');
  }
};

/**
 * Close bottom sheet
 */
window.closeBottomSheet = function() {
  const sheet = document.querySelector('.bottom-sheet-overlay');
  if (sheet) {
    sheet.classList.remove('active');
    setTimeout(() => {
      sheet.remove();
    }, 300);
  }
};

/**
 * Edit Juz record
 */
window.editJuzRecord = async function(docId, juzNumber, teacher, student) {
  try {
    // Get the current record data
    const docRef = doc(db, 'juzDisplays', docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      alert('السجل غير موجود');
      return;
    }
    
    const currentData = docSnap.data();
    
    // Close current sheet and open edit sheet
    const currentSheet = document.querySelector('.bottom-sheet-overlay');
    if (currentSheet) {
      currentSheet.classList.remove('active');
      setTimeout(() => {
        currentSheet.remove();
        showEditJuzSheet(docId, juzNumber, teacher, student, currentData);
      }, 300);
    } else {
      showEditJuzSheet(docId, juzNumber, teacher, student, currentData);
    }
  } catch (error) {
    console.error('Error loading record:', error);
    alert('حدث خطأ في تحميل البيانات');
  }
};

/**
 * Show Edit Juz Sheet
 */
async function showEditJuzSheet(docId, juzNumber, teacher, student, currentData) {
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet-overlay';
  sheet.onclick = (e) => {
    if (e.target === sheet) {
      if (confirm('هل تريد إلغاء التعديل؟')) {
        closeBottomSheet();
      }
    }
  };
  
  // Parse display date (YYYY-MM-DD format)
  let displayDay = '', displayMonth = '', displayYear = '';
  if (currentData.displayDate) {
    const parts = currentData.displayDate.split('-');
    if (parts.length === 3) {
      displayYear = parts[0];
      displayMonth = parts[1];
      displayDay = parts[2];
    }
  }
  
  // Parse last lesson date (YYYY-MM-DD format)
  let lastDay = '', lastMonth = '', lastYear = '';
  if (currentData.lastLessonDate) {
    const parts = currentData.lastLessonDate.split('-');
    if (parts.length === 3) {
      lastYear = parts[0];
      lastMonth = parts[1];
      lastDay = parts[2];
    }
  }
  
  const viewerValue = currentData.viewerName || '';
  const statusValue = currentData.status || 'incomplete';
  
  sheet.innerHTML = `
    <div class="bottom-sheet edit-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>تعديل جزء رقم ${juzNumber}</h3>
      </div>
      
      <div class="sheet-content">
        <form id="editJuzForm" class="edit-form">
          <!-- Status -->
          <div class="form-group">
            <label class="form-label">حالة السجل</label>
            <div class="status-toggle">
              <label class="status-option ${statusValue === 'completed' ? 'active' : ''}">
                <input type="radio" name="status" value="completed" ${statusValue === 'completed' ? 'checked' : ''}>
                <span>مجتاز</span>
              </label>
              <label class="status-option ${statusValue === 'incomplete' ? 'active' : ''}">
                <input type="radio" name="status" value="incomplete" ${statusValue === 'incomplete' ? 'checked' : ''}>
                <span>معلق</span>
              </label>
            </div>
            <p class="form-hint">عند التغيير إلى "معلق" سيظهر الطالب في قائمة الجاهزين</p>
          </div>
          
          <!-- Display Date (only for completed) -->
          <div class="form-group" id="displayDateGroup" style="display: ${statusValue === 'completed' ? 'block' : 'none'}">
            <label class="form-label">تاريخ الإجازة (هجري)</label>
            <div class="date-picker-group-edit">
              <select id="editDisplayDay" class="date-select-edit">
                <option value="">اليوم</option>
              </select>
              <select id="editDisplayMonth" class="date-select-edit">
                <option value="">الشهر</option>
              </select>
              <select id="editDisplayYear" class="date-select-edit">
                <option value="">السنة</option>
              </select>
            </div>
            <button type="button" class="date-today-btn-edit" onclick="setTodayForEditJuz('display')">
              تعيين تاريخ اليوم
            </button>
          </div>
          
          <!-- Last Lesson Date -->
          <div class="form-group">
            <label class="form-label">تاريخ آخر درس (هجري)</label>
            <div class="date-picker-group-edit">
              <select id="editLastDay" class="date-select-edit">
                <option value="">اليوم</option>
              </select>
              <select id="editLastMonth" class="date-select-edit">
                <option value="">الشهر</option>
              </select>
              <select id="editLastYear" class="date-select-edit">
                <option value="">السنة</option>
              </select>
            </div>
            <button type="button" class="date-today-btn-edit" onclick="setTodayForEditJuz('last')">
              تعيين تاريخ اليوم
            </button>
          </div>
          
          <!-- Viewer Name -->
          <div class="form-group">
            <label class="form-label">اسم المستمع</label>
            <input type="text" id="editViewer" class="form-input" value="${viewerValue}" placeholder="اسم المستمع">
          </div>
        </form>
      </div>
      
      <div class="sheet-actions">
        <button class="sheet-btn save" onclick="saveJuzEdit('${docId}', ${juzNumber}, '${teacher}', '${student}')">
          حفظ التعديلات
        </button>
        <button class="sheet-btn cancel" onclick="cancelEditAndReturn('${docId}', ${juzNumber}, '${teacher}', '${student}')">
          إلغاء
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(sheet);
  
  // Load Hijri date dropdowns
  await loadHijriDateDropdownsEdit();
  
  // Set current values
  if (displayDay && displayMonth && displayYear) {
    document.getElementById('editDisplayDay').value = parseInt(displayDay);
    document.getElementById('editDisplayMonth').value = parseInt(displayMonth);
    document.getElementById('editDisplayYear').value = parseInt(displayYear);
  }
  
  if (lastDay && lastMonth && lastYear) {
    document.getElementById('editLastDay').value = parseInt(lastDay);
    document.getElementById('editLastMonth').value = parseInt(lastMonth);
    document.getElementById('editLastYear').value = parseInt(lastYear);
  }
  
  // Add status toggle listeners
  setTimeout(() => {
    const form = document.getElementById('editJuzForm');
    const statusRadios = form.querySelectorAll('input[name="status"]');
    const displayDateGroup = document.getElementById('displayDateGroup');
    
    statusRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        // Update visual state
        form.querySelectorAll('.status-option').forEach(opt => opt.classList.remove('active'));
        e.target.closest('.status-option').classList.add('active');
        
        // Show/hide display date
        if (e.target.value === 'completed') {
          displayDateGroup.style.display = 'block';
        } else {
          displayDateGroup.style.display = 'none';
        }
      });
    });
    
    sheet.classList.add('active');
  }, 10);
}

/**
 * Save Juz Edit
 */
window.saveJuzEdit = async function(docId, juzNumber, teacher, student) {
  try {
    const form = document.getElementById('editJuzForm');
    const status = form.querySelector('input[name="status"]:checked').value;
    
    // Read Hijri date from dropdowns
    const lastDay = document.getElementById('editLastDay').value;
    const lastMonth = document.getElementById('editLastMonth').value;
    const lastYear = document.getElementById('editLastYear').value;
    const viewer = document.getElementById('editViewer').value.trim();
    
    if (!lastDay || !lastMonth || !lastYear) {
      alert('الرجاء اختيار تاريخ آخر درس كاملاً (اليوم، الشهر، السنة)');
      return;
    }
    
    // Format date as YYYY-MM-DD
    const lastLesson = `${lastYear}-${lastMonth.padStart(2, '0')}-${lastDay.padStart(2, '0')}`;
    
    const updateData = {
      status: status,
      lastLessonDate: lastLesson,
      viewerName: viewer || '',
      firstLessonDate: lastLesson // Update first lesson date as well
    };
    
    if (status === 'completed') {
      const displayDay = document.getElementById('editDisplayDay').value;
      const displayMonth = document.getElementById('editDisplayMonth').value;
      const displayYear = document.getElementById('editDisplayYear').value;
      
      if (!displayDay || !displayMonth || !displayYear) {
        alert('الرجاء اختيار تاريخ الإجازة كاملاً (اليوم، الشهر، السنة)');
        return;
      }
      
      // Format date as YYYY-MM-DD
      updateData.displayDate = `${displayYear}-${displayMonth.padStart(2, '0')}-${displayDay.padStart(2, '0')}`;
    } else {
      // If changing to incomplete, remove display date
      updateData.displayDate = '';
    }
    
    // Update Firestore
    const docRef = doc(db, 'juzDisplays', docId);
    await updateDoc(docRef, updateData);
    
    // Close sheet and refresh
    closeBottomSheet();
    await viewJuzStudentRecordsModal();
    
    // Show success message
    showSuccessToast('تم حفظ التعديلات بنجاح');
    
  } catch (error) {
    console.error('Error saving edit:', error);
    alert('حدث خطأ في حفظ التعديلات');
  }
};

/**
 * Cancel Edit and Return to Details
 */
window.cancelEditAndReturn = function(docId, juzNumber, teacher, student) {
  const sheet = document.querySelector('.bottom-sheet-overlay');
  if (sheet) {
    sheet.classList.remove('active');
    setTimeout(() => {
      sheet.remove();
      // Reopen details sheet
      showJuzDetailsBottomSheet(juzNumber, teacher, student);
    }, 300);
  }
};

/**
 * Delete Juz record
 */
window.deleteJuzRecord = async function(docId, juzNumber, teacher, student) {
  if (!confirm(`هل أنت متأكد من حذف سجل الجزء ${juzNumber}؟`)) return;
  
  try {
    await deleteDoc(doc(db, 'juzDisplays', docId));
    closeBottomSheet();
    // Refresh the records view
    await viewJuzStudentRecordsModal();
    alert('تم حذف السجل بنجاح');
  } catch (error) {
    console.error('Error deleting record:', error);
    alert('حدث خطأ في حذف السجل');
  }
};

/**
 * Edit Hizb record
 */
window.editHizbRecord = async function(docId, hizbNumber, teacher, student) {
  try {
    // Get the current record data
    const docRef = doc(db, 'hizbDisplays', docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      alert('السجل غير موجود');
      return;
    }
    
    const currentData = docSnap.data();
    
    // Close current sheet and open edit sheet
    const currentSheet = document.querySelector('.bottom-sheet-overlay');
    if (currentSheet) {
      currentSheet.classList.remove('active');
      setTimeout(() => {
        currentSheet.remove();
        showEditHizbSheet(docId, hizbNumber, teacher, student, currentData);
      }, 300);
    } else {
      showEditHizbSheet(docId, hizbNumber, teacher, student, currentData);
    }
  } catch (error) {
    console.error('Error loading record:', error);
    alert('حدث خطأ في تحميل البيانات');
  }
};

/**
 * Show Edit Hizb Sheet
 */
async function showEditHizbSheet(docId, hizbNumber, teacher, student, currentData) {
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet-overlay';
  sheet.onclick = (e) => {
    if (e.target === sheet) {
      if (confirm('هل تريد إلغاء التعديل؟')) {
        closeBottomSheet();
      }
    }
  };
  
  // Parse display date (YYYY-MM-DD format)
  let displayDay = '', displayMonth = '', displayYear = '';
  if (currentData.displayDate) {
    const parts = currentData.displayDate.split('-');
    if (parts.length === 3) {
      displayYear = parts[0];
      displayMonth = parts[1];
      displayDay = parts[2];
    }
  }
  
  // Parse last lesson date (YYYY-MM-DD format)
  let lastDay = '', lastMonth = '', lastYear = '';
  if (currentData.lastLessonDate) {
    const parts = currentData.lastLessonDate.split('-');
    if (parts.length === 3) {
      lastYear = parts[0];
      lastMonth = parts[1];
      lastDay = parts[2];
    }
  }
  
  const viewerValue = currentData.viewerName || '';
  const statusValue = currentData.status || 'incomplete';
  
  sheet.innerHTML = `
    <div class="bottom-sheet edit-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <h3>تعديل حزب رقم ${hizbNumber}</h3>
      </div>
      
      <div class="sheet-content">
        <form id="editHizbForm" class="edit-form">
          <!-- Status -->
          <div class="form-group">
            <label class="form-label">حالة السجل</label>
            <div class="status-toggle">
              <label class="status-option ${statusValue === 'completed' ? 'active' : ''}">
                <input type="radio" name="status" value="completed" ${statusValue === 'completed' ? 'checked' : ''}>
                <span>مجتاز</span>
              </label>
              <label class="status-option ${statusValue === 'incomplete' ? 'active' : ''}">
                <input type="radio" name="status" value="incomplete" ${statusValue === 'incomplete' ? 'checked' : ''}>
                <span>معلق</span>
              </label>
            </div>
            <p class="form-hint">عند التغيير إلى "معلق" سيظهر الطالب في قائمة الجاهزين</p>
          </div>
          
          <!-- Display Date (only for completed) -->
          <div class="form-group" id="displayDateGroupHizb" style="display: ${statusValue === 'completed' ? 'block' : 'none'}">
            <label class="form-label">تاريخ الإجازة (هجري)</label>
            <div class="date-picker-group-edit">
              <select id="editDisplayDayHizb" class="date-select-edit">
                <option value="">اليوم</option>
              </select>
              <select id="editDisplayMonthHizb" class="date-select-edit">
                <option value="">الشهر</option>
              </select>
              <select id="editDisplayYearHizb" class="date-select-edit">
                <option value="">السنة</option>
              </select>
            </div>
            <button type="button" class="date-today-btn-edit" onclick="setTodayForEditHizb('display')">
              تعيين تاريخ اليوم
            </button>
          </div>
          
          <!-- Last Lesson Date -->
          <div class="form-group">
            <label class="form-label">تاريخ آخر درس (هجري)</label>
            <div class="date-picker-group-edit">
              <select id="editLastDayHizb" class="date-select-edit">
                <option value="">اليوم</option>
              </select>
              <select id="editLastMonthHizb" class="date-select-edit">
                <option value="">الشهر</option>
              </select>
              <select id="editLastYearHizb" class="date-select-edit">
                <option value="">السنة</option>
              </select>
            </div>
            <button type="button" class="date-today-btn-edit" onclick="setTodayForEditHizb('last')">
              تعيين تاريخ اليوم
            </button>
          </div>
          
          <!-- Viewer Name -->
          <div class="form-group">
            <label class="form-label">اسم المستمع</label>
            <input type="text" id="editViewerHizb" class="form-input" value="${viewerValue}" placeholder="اسم المستمع">
          </div>
        </form>
      </div>
      
      <div class="sheet-actions">
        <button class="sheet-btn save" onclick="saveHizbEdit('${docId}', ${hizbNumber}, '${teacher}', '${student}')">
          حفظ التعديلات
        </button>
        <button class="sheet-btn cancel" onclick="cancelHizbEditAndReturn('${docId}', ${hizbNumber}, '${teacher}', '${student}')">
          إلغاء
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(sheet);
  
  // Load Hijri date dropdowns
  await loadHijriDateDropdownsEdit('Hizb');
  
  // Set current values
  if (displayDay && displayMonth && displayYear) {
    document.getElementById('editDisplayDayHizb').value = parseInt(displayDay);
    document.getElementById('editDisplayMonthHizb').value = parseInt(displayMonth);
    document.getElementById('editDisplayYearHizb').value = parseInt(displayYear);
  }
  
  if (lastDay && lastMonth && lastYear) {
    document.getElementById('editLastDayHizb').value = parseInt(lastDay);
    document.getElementById('editLastMonthHizb').value = parseInt(lastMonth);
    document.getElementById('editLastYearHizb').value = parseInt(lastYear);
  }
  
  // Add status toggle listeners
  setTimeout(() => {
    const form = document.getElementById('editHizbForm');
    const statusRadios = form.querySelectorAll('input[name="status"]');
    const displayDateGroup = document.getElementById('displayDateGroupHizb');
    
    statusRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        // Update visual state
        form.querySelectorAll('.status-option').forEach(opt => opt.classList.remove('active'));
        e.target.closest('.status-option').classList.add('active');
        
        // Show/hide display date
        if (e.target.value === 'completed') {
          displayDateGroup.style.display = 'block';
        } else {
          displayDateGroup.style.display = 'none';
        }
      });
    });
    
    sheet.classList.add('active');
  }, 10);
}

/**
 * Save Hizb Edit
 */
window.saveHizbEdit = async function(docId, hizbNumber, teacher, student) {
  try {
    const form = document.getElementById('editHizbForm');
    const status = form.querySelector('input[name="status"]:checked').value;
    
    // Read Hijri date from dropdowns
    const lastDay = document.getElementById('editLastDayHizb').value;
    const lastMonth = document.getElementById('editLastMonthHizb').value;
    const lastYear = document.getElementById('editLastYearHizb').value;
    const viewer = document.getElementById('editViewerHizb').value.trim();
    
    if (!lastDay || !lastMonth || !lastYear) {
      alert('الرجاء اختيار تاريخ آخر درس كاملاً (اليوم، الشهر، السنة)');
      return;
    }
    
    // Format date as YYYY-MM-DD
    const lastLesson = `${lastYear}-${lastMonth.padStart(2, '0')}-${lastDay.padStart(2, '0')}`;
    
    const updateData = {
      status: status,
      lastLessonDate: lastLesson,
      viewerName: viewer || '',
      firstLessonDate: lastLesson // Update first lesson date as well
    };
    
    if (status === 'completed') {
      const displayDay = document.getElementById('editDisplayDayHizb').value;
      const displayMonth = document.getElementById('editDisplayMonthHizb').value;
      const displayYear = document.getElementById('editDisplayYearHizb').value;
      
      if (!displayDay || !displayMonth || !displayYear) {
        alert('الرجاء اختيار تاريخ الإجازة كاملاً (اليوم، الشهر، السنة)');
        return;
      }
      
      // Format date as YYYY-MM-DD
      updateData.displayDate = `${displayYear}-${displayMonth.padStart(2, '0')}-${displayDay.padStart(2, '0')}`;
    } else {
      // If changing to incomplete, remove display date
      updateData.displayDate = '';
    }
    
    // Update Firestore
    const docRef = doc(db, 'hizbDisplays', docId);
    await updateDoc(docRef, updateData);
    
    // Close sheet and refresh
    closeBottomSheet();
    await viewHizbStudentRecordsModal();
    
    // Show success message
    showSuccessToast('تم حفظ التعديلات بنجاح');
    
  } catch (error) {
    console.error('Error saving edit:', error);
    alert('حدث خطأ في حفظ التعديلات');
  }
};

/**
 * Cancel Edit and Return to Details (Hizb)
 */
window.cancelHizbEditAndReturn = function(docId, hizbNumber, teacher, student) {
  const sheet = document.querySelector('.bottom-sheet-overlay');
  if (sheet) {
    sheet.classList.remove('active');
    setTimeout(() => {
      sheet.remove();
      // Reopen details sheet
      showHizbDetailsBottomSheet(hizbNumber, teacher, student);
    }, 300);
  }
};

/**
 * Delete Hizb record
 */
window.deleteHizbRecord = async function(docId, hizbNumber, teacher, student) {
  if (!confirm(`هل أنت متأكد من حذف سجل الحزب ${hizbNumber}؟`)) return;
  
  try {
    await deleteDoc(doc(db, 'hizbDisplays', docId));
    closeBottomSheet();
    // Refresh the records view
    await viewHizbStudentRecordsModal();
    alert('تم حذف السجل بنجاح');
  } catch (error) {
    console.error('Error deleting record:', error);
    alert('حدث خطأ في حذف السجل');
  }
};

/**
 * Load Hijri date dropdowns for Edit modal
 */
async function loadHijriDateDropdownsEdit(type = '') {
  const suffix = type === 'Hizb' ? 'Hizb' : '';
  
  const displayDaySelect = document.getElementById(`editDisplayDay${suffix}`);
  const displayMonthSelect = document.getElementById(`editDisplayMonth${suffix}`);
  const displayYearSelect = document.getElementById(`editDisplayYear${suffix}`);
  const lastDaySelect = document.getElementById(`editLastDay${suffix}`);
  const lastMonthSelect = document.getElementById(`editLastMonth${suffix}`);
  const lastYearSelect = document.getElementById(`editLastYear${suffix}`);
  
  if (!displayDaySelect || !lastDaySelect) return;
  
  try {
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    
    // Extract unique months and years
    const uniqueMonths = new Set();
    const uniqueYears = new Set();
    
    accurateHijriDates.forEach(entry => {
      uniqueMonths.add(entry.hijriMonth);
      uniqueYears.add(entry.hijriYear);
    });
    
    // Month names
    const monthNames = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
      'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
      'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    
    // Load days (1-30) for display date
    displayDaySelect.innerHTML = '<option value="">اليوم</option>';
    for (let i = 1; i <= 30; i++) {
      displayDaySelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    // Load days (1-30) for last lesson date
    lastDaySelect.innerHTML = '<option value="">اليوم</option>';
    for (let i = 1; i <= 30; i++) {
      lastDaySelect.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    // Load months for display date
    displayMonthSelect.innerHTML = '<option value="">الشهر</option>';
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => a - b);
    sortedMonths.forEach(monthNum => {
      displayMonthSelect.innerHTML += `<option value="${monthNum}">${monthNum} - ${monthNames[monthNum - 1]}</option>`;
    });
    
    // Load months for last lesson date
    lastMonthSelect.innerHTML = '<option value="">الشهر</option>';
    sortedMonths.forEach(monthNum => {
      lastMonthSelect.innerHTML += `<option value="${monthNum}">${monthNum} - ${monthNames[monthNum - 1]}</option>`;
    });
    
    // Load years for display date
    displayYearSelect.innerHTML = '<option value="">السنة</option>';
    const sortedYears = Array.from(uniqueYears).sort((a, b) => a - b);
    sortedYears.forEach(year => {
      displayYearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });
    
    // Load years for last lesson date
    lastYearSelect.innerHTML = '<option value="">السنة</option>';
    sortedYears.forEach(year => {
      lastYearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    });
    
  } catch (error) {
    console.error('Error loading Hijri date dropdowns:', error);
  }
}

/**
 * Set today's Hijri date for Edit Juz modal
 */
window.setTodayForEditJuz = async function(type) {
  try {
    const { getTodayAccurateHijri } = await import('./accurate-hijri-dates.js');
    const today = getTodayAccurateHijri();
    
    if (today) {
      const day = today.hijriDay;
      const month = today.hijriMonth;
      const year = today.hijriYear;
      
      if (type === 'display') {
        document.getElementById('editDisplayDay').value = day;
        document.getElementById('editDisplayMonth').value = month;
        document.getElementById('editDisplayYear').value = year;
      } else if (type === 'last') {
        document.getElementById('editLastDay').value = day;
        document.getElementById('editLastMonth').value = month;
        document.getElementById('editLastYear').value = year;
      }
    }
  } catch (error) {
    console.error('Error setting today date:', error);
    alert('خطأ في تعيين تاريخ اليوم');
  }
};

/**
 * Set today's Hijri date for Edit Hizb modal
 */
window.setTodayForEditHizb = async function(type) {
  try {
    const { getTodayAccurateHijri } = await import('./accurate-hijri-dates.js');
    const today = getTodayAccurateHijri();
    
    if (today) {
      const day = today.hijriDay;
      const month = today.hijriMonth;
      const year = today.hijriYear;
      
      if (type === 'display') {
        document.getElementById('editDisplayDayHizb').value = day;
        document.getElementById('editDisplayMonthHizb').value = month;
        document.getElementById('editDisplayYearHizb').value = year;
      } else if (type === 'last') {
        document.getElementById('editLastDayHizb').value = day;
        document.getElementById('editLastMonthHizb').value = month;
        document.getElementById('editLastYearHizb').value = year;
      }
    }
  } catch (error) {
    console.error('Error setting today date:', error);
    alert('خطأ في تعيين تاريخ اليوم');
  }
};

/**
 * Show Success Toast
 */
window.showSuccessToast = function(message) {
  // Remove existing toast if any
  const existingToast = document.querySelector('.success-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'success-toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
};

/**
 * Export Juz student report
 */
window.exportJuzStudentReport = async function() {
  try {
    const teacherSelect = document.getElementById('juzStudModalTeacher');
    const studentSelect = document.getElementById('juzStudModalStudent');
    
    if (!teacherSelect || !studentSelect) {
      alert('⚠️ حدث خطأ في تحميل النموذج');
      return;
    }
    
    const teacher = teacherSelect.value;
    const student = studentSelect.value;
    
    if (!teacher || !student) {
      alert('⚠️ الرجاء اختيار المعلم والطالب');
      return;
    }
    
    const periodLabel = 'السجل الكامل';
    
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
      z-index: 10002;
      text-align: center;
    `;
    loadingMsg.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
      <div style="font-size: 18px; color: #28a745; font-weight: bold;">جاري إنشاء تقرير الطالب...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">يرجى الانتظار</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Fetch all juzDisplays for this student and teacher
    const q = query(
      collection(db, 'juzDisplays'),
      where('teacherName', '==', teacher),
      where('studentName', '==', student)
    );
    const snapshot = await getDocs(q);
    
    // Build a map: juzNumber -> record data
    const juzRecordsMap = new Map();
    
    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const juzNumber = data.juzNumber;
      
      if (!juzNumber) return;
      
      // Store record if not exists or replace with completed status
      const existing = juzRecordsMap.get(juzNumber);
      if (!existing || (data.status === 'completed' && existing.status === 'incomplete')) {
        juzRecordsMap.set(juzNumber, {
          juzNumber: juzNumber,
          status: data.status || 'incomplete',
          displayDate: data.displayDate || '',
          lastLessonDate: data.lastLessonDate || '',
          firstLessonDate: data.firstLessonDate || data.lastLessonDate || '',
          viewerName: data.viewerName || '-',
          duration: ''
        });
      }
    });
    
    // Calculate duration for completed records
    juzRecordsMap.forEach((record, juzNum) => {
      if (record.status === 'completed' && record.firstLessonDate && record.displayDate) {
        const firstEntry = accurateHijriDates.find(e => e.hijri === record.firstLessonDate);
        let displayDateNormalized = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            displayDateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        const lastEntry = accurateHijriDates.find(e => e.hijri === displayDateNormalized);
        
        if (firstEntry && lastEntry) {
          const firstDate = new Date(firstEntry.gregorian);
          const lastDate = new Date(lastEntry.gregorian);
          // ✅ حساب أيام الدراسة فقط (بدون الجمعة والسبت)
          const diffDays = calculateBusinessDays(firstDate, lastDate);
          record.duration = `${diffDays} يوم`;
        }
      }
    });
    
    // Build table rows for ALL 30 ajzaa
    let tableRowsHTML = '';
    for (let juzNum = 1; juzNum <= 30; juzNum++) {
      const record = juzRecordsMap.get(juzNum);
      
      const bgColor = juzNum % 2 === 0 ? '#f8f9fa' : 'white';
      const statusText = record && record.status === 'completed' ? '✅' : '⏳';
      const statusColor = record && record.status === 'completed' ? '#28a745' : '#999';
      
      let displayDateText = '-';
      if (record && record.status === 'completed' && record.displayDate) {
        let normalizedDate = record.displayDate;
        if (record.displayDate.includes('/')) {
          const parts = record.displayDate.split('/');
          if (parts.length === 3) {
            normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
        displayDateText = formatDateForDisplay(normalizedDate);
      }
      
      const durationText = record && record.duration ? record.duration : '-';
      const listenerText = record && record.viewerName ? record.viewerName : '-';
      
      tableRowsHTML += `
        <tr style="background: ${bgColor};">
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px; font-weight: 600;">جزء ${juzNum}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px; color: ${statusColor}; font-weight: 600;">${statusText}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #495057;">${displayDateText}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 14px; color: #495057;">${durationText}</td>
          <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right; font-size: 14px; color: #495057;">${listenerText}</td>
        </tr>
      `;
    }
    
    // Calculate statistics
    const completedCount = Array.from(juzRecordsMap.values()).filter(r => r.status === 'completed').length;
    const totalCount = 30;
    const pendingCount = totalCount - completedCount;
    const progressPercent = Math.round((completedCount / totalCount) * 100);
    
    const today = getTodayForStorage();
    
    // Create HTML content for PDF
    const container = document.createElement('div');
    container.style.cssText = `
      direction: rtl;
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
      padding: 40px;
      width: 210mm;
      min-height: 297mm;
      box-sizing: border-box;
    `;
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #28a745; margin: 0 0 10px 0; font-size: 32px;">📚 التقرير الشامل لسجل الأجزاء</h1>
        <h2 style="color: #2d3748; margin: 0 0 5px 0; font-size: 24px;">الطالب: ${student}</h2>
        <h3 style="color: #495057; margin: 0 0 5px 0; font-size: 20px;">المعلم: ${teacher}</h3>
        <p style="color: #666; font-size: 16px; margin: 8px 0 0 0; font-weight: bold;">${periodLabel}</p>
        <p style="color: #999; font-size: 14px; margin: 5px 0 0 0;">تاريخ التقرير: ${formatDateForDisplay(today)}</p>
      </div>
      
      <div style="margin-bottom: 25px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 20px; border-radius: 12px; color: white;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px;">
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">مجموع الأجزاء</div>
            <div style="font-size: 24px; font-weight: bold;">${totalCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">مجتاز</div>
            <div style="font-size: 24px; font-weight: bold; color: #90ee90;">${completedCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">متبقي</div>
            <div style="font-size: 24px; font-weight: bold; color: #ffb6c1;">${pendingCount}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 13px; opacity: 0.9; margin-bottom: 5px;">نسبة الإنجاز</div>
            <div style="font-size: 24px; font-weight: bold;">${progressPercent}%</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 20px; border-bottom: 3px solid #28a745; padding-bottom: 10px;">
          📊 سجل الأجزاء
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; border-radius: 8px 0 0 0; width: 15%;">رقم الجزء</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; width: 15%;">الحالة</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; width: 20%;">تاريخ الاجتياز</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 15px; width: 15%;">المدة المستغرقة</th>
              <th style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px; text-align: right; border: none; font-size: 15px; border-radius: 0 8px 0 0; width: 35%;">اسم المستمع</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #28a745;">
        <p style="margin: 5px 0; color: #28a745; font-size: 14px; font-style: italic;">📚 نظام إدارة عرض الأجزاء القرآنية</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${formatDateForDisplay(today)}</p>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Generate PDF using html2canvas and jsPDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Save PDF
    const fileName = `تقرير_طالب_أجزاء_${student}_${periodLabel.replace(/\s/g, '_')}.pdf`;
    pdf.save(fileName);
    
    // Remove loading and overlay
    loadingMsg.remove();
    document.getElementById('juzStudentModal')?.remove();
    
    alert('✅ تم تصدير تقرير الطالب بنجاح!');
    
  } catch (error) {
    console.error('Error generating Juz student report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

// Make updateDaysForDatePicker available globally
window.updateDaysForDatePicker = updateDaysForDatePicker;



// ==========================================
// JUZ REPORTS - Original Functions
// ==========================================


// ==========================================
// DAILY PASSAGE REPORT MODAL (الاجتياز اليومي)
// ==========================================

/**
 * Show Daily Passage Report Modal with date range selection
 * Uses accurate Hijri calendar system from accurate-hijri-dates.js
 */
window.showDailyPassageReport = function() {
  console.log('📅 Opening Daily Passage Report Modal...');
  
  // Get available Hijri dates from accurate calendar
  const availableDates = accurateHijriDates.map(d => ({
    hijri: d.hijri,
    hijriDay: d.hijriDay,
    hijriMonth: d.hijriMonth,
    hijriYear: d.hijriYear,
    gregorian: d.gregorian,
    dayName: d.dayName
  }));
  
  // Get unique years and months
  const years = [...new Set(availableDates.map(d => d.hijriYear))].sort((a, b) => a - b);
  const months = [
    { value: 1, name: 'المحرم' },
    { value: 2, name: 'صفر' },
    { value: 3, name: 'ربيع الأول' },
    { value: 4, name: 'ربيع الآخر' },
    { value: 5, name: 'جمادى الأولى' },
    { value: 6, name: 'جمادى الآخرة' },
    { value: 7, name: 'رجب' },
    { value: 8, name: 'شعبان' },
    { value: 9, name: 'رمضان' },
    { value: 10, name: 'شوال' },
    { value: 11, name: 'ذو القعدة' },
    { value: 12, name: 'ذو الحجة' }
  ];
  
  // Get today's Hijri date
  const todayHijri = gregorianToAccurateHijri(new Date());
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'dailyPassageReportOverlay';
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
    backdrop-filter: blur(5px);
    animation: fadeIn 0.3s ease;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  overlay.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { 
          transform: translateY(30px); 
          opacity: 0; 
        }
        to { 
          transform: translateY(0); 
          opacity: 1; 
        }
      }
      
      .daily-passage-modal {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border-radius: 20px;
        padding: 30px;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        direction: rtl;
        position: relative;
      }
      
      .modal-header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 3px solid #667eea;
      }
      
      .modal-title {
        font-size: 28px;
        font-weight: bold;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0 0 8px 0;
      }
      
      .modal-subtitle {
        color: #6c757d;
        font-size: 14px;
        margin: 0;
      }
      
      .date-range-section {
        margin-bottom: 25px;
      }
      
      .section-label {
        display: flex;
        align-items: center;
        font-size: 16px;
        font-weight: bold;
        color: #2d3748;
        margin-bottom: 15px;
        padding: 10px 15px;
        background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
        border-radius: 10px;
        border-right: 4px solid #667eea;
      }
      
      .date-inputs-container {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .date-input-group {
        position: relative;
      }
      
      .date-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #495057;
        margin-bottom: 6px;
        text-align: center;
      }
      
      .date-select {
        width: 100%;
        padding: 12px 10px;
        border: 2px solid #dee2e6;
        border-radius: 10px;
        font-size: 15px;
        font-weight: bold;
        text-align: center;
        background: white;
        color: #2d3748;
        cursor: pointer;
        transition: all 0.3s ease;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23667eea' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: left 10px center;
        padding-left: 30px;
      }
      
      .date-select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        transform: translateY(-2px);
      }
      
      .date-select:hover {
        border-color: #667eea;
      }
      
      .action-buttons {
        display: flex;
        gap: 12px;
        margin-top: 30px;
      }
      
      .btn {
        flex: 1;
        padding: 14px 20px;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      
      .btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
      }
      
      .btn:active {
        transform: translateY(-1px);
      }
      
      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .btn-secondary {
        background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
        color: white;
      }
      
      .divider {
        text-align: center;
        margin: 20px 0;
        position: relative;
      }
      
      .divider::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #dee2e6, transparent);
      }
      
      .divider-text {
        background: white;
        padding: 0 15px;
        position: relative;
        color: #6c757d;
        font-size: 14px;
        font-weight: 600;
      }
      
      @media (max-width: 768px) {
        .daily-passage-modal {
          padding: 20px;
          max-width: 100%;
          border-radius: 15px;
        }
        
        .modal-title {
          font-size: 22px;
        }
        
        .date-inputs-container {
          gap: 8px;
        }
        
        .date-select {
          padding: 10px 8px;
          font-size: 14px;
          padding-left: 25px;
        }
        
        .action-buttons {
          flex-direction: column;
        }
        
        .btn {
          width: 100%;
        }
      }
    </style>
    
    <div class="daily-passage-modal">
      <div class="modal-header">
        <h2 class="modal-title">📅 الاجتياز اليومي</h2>
        <p class="modal-subtitle">اختر الفترة الزمنية بالتاريخ الهجري الدقيق</p>
      </div>
      
      <!-- From Date -->
      <div class="date-range-section">
        <div class="section-label">
          📍 من تاريخ
        </div>
        <div class="date-inputs-container">
          <div class="date-input-group">
            <label class="date-label">اليوم</label>
            <select id="dailyPassageFromDay" class="date-select">
              ${generateDayOptions(1)}
            </select>
          </div>
          <div class="date-input-group">
            <label class="date-label">الشهر</label>
            <select id="dailyPassageFromMonth" class="date-select" onchange="window.updateDaysForDailyPassage('From')">
              ${months.map(m => `<option value="${String(m.value).padStart(2, '0')}" ${m.value === todayHijri.hijriMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
          </div>
          <div class="date-input-group">
            <label class="date-label">السنة</label>
            <select id="dailyPassageFromYear" class="date-select" onchange="window.updateDaysForDailyPassage('From')">
              ${years.map(y => `<option value="${y}" ${y === todayHijri.hijriYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      
      <div class="divider">
        <span class="divider-text">إلى</span>
      </div>
      
      <!-- To Date -->
      <div class="date-range-section">
        <div class="section-label">
          🏁 إلى تاريخ
        </div>
        <div class="date-inputs-container">
          <div class="date-input-group">
            <label class="date-label">اليوم</label>
            <select id="dailyPassageToDay" class="date-select">
              ${generateDayOptions(todayHijri.hijriDay)}
            </select>
          </div>
          <div class="date-input-group">
            <label class="date-label">الشهر</label>
            <select id="dailyPassageToMonth" class="date-select" onchange="window.updateDaysForDailyPassage('To')">
              ${months.map(m => `<option value="${String(m.value).padStart(2, '0')}" ${m.value === todayHijri.hijriMonth ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
          </div>
          <div class="date-input-group">
            <label class="date-label">السنة</label>
            <select id="dailyPassageToYear" class="date-select" onchange="window.updateDaysForDailyPassage('To')">
              ${years.map(y => `<option value="${y}" ${y === todayHijri.hijriYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn btn-primary" onclick="window.generateDailyPassageReport()">
          <span>📊</span>
          <span>عرض التقرير PDF</span>
        </button>
        <button class="btn btn-secondary" onclick="window.closeDailyPassageModal()">
          <span>❌</span>
          <span>إلغاء</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      window.closeDailyPassageModal();
    }
  });
  
  // Helper function to generate day options
  function generateDayOptions(selectedDay) {
    let options = '';
    for (let i = 1; i <= 30; i++) {
      options += `<option value="${String(i).padStart(2, '0')}" ${i === selectedDay ? 'selected' : ''}>${i}</option>`;
    }
    return options;
  }
  
  console.log('✅ Daily Passage Report Modal opened with accurate Hijri dates');
};

/**
 * Update days dropdown based on selected month/year
 * Uses accurate Hijri calendar to get actual days in month
 */
window.updateDaysForDailyPassage = function(prefix) {
  const monthSelect = document.getElementById(`dailyPassage${prefix}Month`);
  const yearSelect = document.getElementById(`dailyPassage${prefix}Year`);
  const daySelect = document.getElementById(`dailyPassage${prefix}Day`);
  
  if (!monthSelect || !yearSelect || !daySelect) return;
  
  const selectedMonth = parseInt(monthSelect.value);
  const selectedYear = parseInt(yearSelect.value);
  const currentDay = parseInt(daySelect.value);
  
  // Get days in this month from accurate calendar
  const daysInMonth = accurateHijriDates.filter(d => 
    d.hijriMonth === selectedMonth && d.hijriYear === selectedYear
  );
  
  const maxDay = daysInMonth.length > 0 ? Math.max(...daysInMonth.map(d => d.hijriDay)) : 30;
  
  // Rebuild day options
  let options = '';
  for (let i = 1; i <= maxDay; i++) {
    const selected = i === (currentDay <= maxDay ? currentDay : maxDay) ? 'selected' : '';
    options += `<option value="${String(i).padStart(2, '0')}" ${selected}>${i}</option>`;
  }
  
  daySelect.innerHTML = options;
  
  console.log(`✅ Updated days for ${prefix}: Month ${selectedMonth}, Year ${selectedYear}, Max days: ${maxDay}`);
};

/**
 * Close Daily Passage Report Modal
 */
window.closeDailyPassageModal = function() {
  const overlay = document.getElementById('dailyPassageReportOverlay');
  if (overlay) {
    overlay.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  }
};

/**
 * Generate Daily Passage Report with PDF export
 */
window.generateDailyPassageReport = async function() {
  try {
    const fromDay = document.getElementById('dailyPassageFromDay').value;
    const fromMonth = document.getElementById('dailyPassageFromMonth').value;
    const fromYear = document.getElementById('dailyPassageFromYear').value;
    const toDay = document.getElementById('dailyPassageToDay').value;
    const toMonth = document.getElementById('dailyPassageToMonth').value;
    const toYear = document.getElementById('dailyPassageToYear').value;
    
    // Add padding to month values to ensure proper date comparison
    const fromDate = `${fromYear}-${String(fromMonth).padStart(2, '0')}-${fromDay}`;
    const toDate = `${toYear}-${String(toMonth).padStart(2, '0')}-${toDay}`;
    
    console.log('📊 Generating Daily Passage Report:', { from: fromDate, to: toDate });
    
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
      <div style="font-size: 18px; color: #667eea; font-weight: bold;">جاري إنشاء تقرير الاجتياز اليومي...</div>
      <div style="font-size: 14px; color: #666; margin-top: 8px;">يرجى الانتظار</div>
    `;
    document.body.appendChild(loadingMsg);
    
    // Get teacher names from classes collection
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const teacherNamesMap = {};
    classesSnapshot.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classData.classId || classDoc.id;
      teacherNamesMap[classId] = classData.teacherName || classData.className || classId;
    });
    
    // Fetch juz reports
    const juzSnapshot = await getDocs(collection(db, 'juzDisplays'));
    const hizbSnapshot = await getDocs(collection(db, 'hizbDisplays'));
    
    const passageRecords = [];
    
    console.log('🔍 Date range for filtering:', { fromDate, toDate });
    console.log(`📚 Processing ${juzSnapshot.size} Juz reports and ${hizbSnapshot.size} Hizb reports...`);
    
    // Process Juz reports
    juzSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Only include completed reports with displayDate
      if (data.status === 'completed' && data.displayDate) {
        let normalizedDisplayDate = data.displayDate;
        
        // Normalize date format (handle DD-MM-YYYY or YYYY-MM-DD)
        if (data.displayDate.includes('-')) {
          const parts = data.displayDate.split('-');
          if (parts[0].length === 2) {
            // DD-MM-YYYY format
            normalizedDisplayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            // Already YYYY-MM-DD - ensure padding
            normalizedDisplayDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
        
        // Debug log for each report
        const isInRange = normalizedDisplayDate >= fromDate && normalizedDisplayDate <= toDate;
        console.log(`${isInRange ? '✅' : '❌'} Juz Report - ${data.studentName}: displayDate=${data.displayDate} → normalized=${normalizedDisplayDate}, inRange=${isInRange}`);
        
        // Filter by date range
        if (isInRange) {
          const teacherName = teacherNamesMap[data.teacherId] || data.teacherName || 'غير محدد';
          
          // Calculate duration
          let duration = '-';
          if (data.lastLessonDate && data.displayDate) {
            const durationDays = calculateHijriDaysDifference(data.lastLessonDate, normalizedDisplayDate);
            duration = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
          }
          
          passageRecords.push({
            studentName: data.studentName || 'غير محدد',
            teacherName: teacherName,
            type: 'جزء',
            number: data.juzNumber || '-',
            amount: 'كامل',
            displayDate: formatDateForDisplay(normalizedDisplayDate),
            duration: duration,
            attemptsCount: data.attemptsCount || 1,
            viewerName: data.viewerName ? `أ/ ${data.viewerName}` : 'غير محدد'
          });
        }
      }
    });
    
    // Process Hizb reports
    hizbSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Only include completed reports with displayDate
      if (data.status === 'completed' && data.displayDate) {
        let normalizedDisplayDate = data.displayDate;
        
        // Normalize date format
        if (data.displayDate.includes('-')) {
          const parts = data.displayDate.split('-');
          if (parts[0].length === 2) {
            normalizedDisplayDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            normalizedDisplayDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
        
        // Debug log for each report
        const isInRange = normalizedDisplayDate >= fromDate && normalizedDisplayDate <= toDate;
        console.log(`${isInRange ? '✅' : '❌'} Hizb Report - ${data.studentName}: displayDate=${data.displayDate} → normalized=${normalizedDisplayDate}, inRange=${isInRange}`);
        
        // Filter by date range
        if (isInRange) {
          const teacherName = teacherNamesMap[data.teacherId] || data.teacherName || 'غير محدد';
          
          // Calculate duration
          let duration = '-';
          if (data.lastLessonDate && data.displayDate) {
            const durationDays = calculateHijriDaysDifference(data.lastLessonDate, normalizedDisplayDate);
            duration = `${durationDays} ${durationDays === 1 ? 'يوم' : durationDays === 2 ? 'يومان' : 'أيام'}`;
          }
          
          // Get actual hizb amount from quranHizbData
          let hizbAmount = 'كامل';
          if (data.hizbNumber) {
            const hizbInfo = quranHizbData.find(h => h.number === data.hizbNumber);
            if (hizbInfo) {
              hizbAmount = hizbInfo.name || hizbInfo.description || 'كامل';
            }
          }
          
          passageRecords.push({
            studentName: data.studentName || 'غير محدد',
            teacherName: teacherName,
            type: 'حزب',
            number: data.hizbNumber || '-',
            amount: hizbAmount,
            displayDate: formatDateForDisplay(normalizedDisplayDate),
            duration: duration,
            attemptsCount: data.attemptsCount || 1,
            viewerName: data.viewerName ? `أ/ ${data.viewerName}` : 'غير محدد'
          });
        }
      }
    });
    
    console.log(`📊 Found ${passageRecords.length} records in date range ${fromDate} to ${toDate}`);
    
    // Sort by display date (most recent first)
    passageRecords.sort((a, b) => {
      const dateA = a.displayDate.split('-').reverse().join('-');
      const dateB = b.displayDate.split('-').reverse().join('-');
      return dateB.localeCompare(dateA);
    });
    
    console.log(`✅ Found ${passageRecords.length} passage records in date range`);
    
    if (passageRecords.length === 0) {
      console.warn('⚠️ No records found! Check if:');
      console.warn('  1. displayDate format matches YYYY-MM-DD');
      console.warn('  2. Selected date range contains actual records');
      console.warn('  3. Records have status="completed"');
      loadingMsg.remove();
      alert('⚠️ لا توجد سجلات اجتياز في الفترة المحددة');
      return;
    }
    
    // Build table rows
    let tableRowsHTML = '';
    passageRecords.forEach((record, index) => {
      const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      const typeColor = record.type === 'جزء' ? '#28a745' : '#667eea';
      
      tableRowsHTML += `
        <tr style="background: ${bgColor}; page-break-inside: avoid;">
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 13px;">${record.studentName}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 13px;">${record.teacherName}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">
            <span style="background: ${typeColor}; color: white; padding: 4px 8px; border-radius: 5px; font-weight: bold;">
              ${record.type} ${record.number}
            </span>
          </td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${record.amount}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px; direction: ltr;">${record.displayDate}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px;">${record.duration}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center; font-size: 13px; font-weight: bold;">${record.attemptsCount}</td>
          <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 13px;">${record.viewerName}</td>
        </tr>
      `;
    });
    
    // Format date range for title
    const fromDateFormatted = formatDateForDisplay(fromDate);
    const toDateFormatted = formatDateForDisplay(toDate);
    
    // Create HTML container for PDF
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1200px;
      background: white;
      padding: 30px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      text-align: right;
    `;
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 25px; page-break-inside: avoid;">
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 28px;">📅 تقرير الاجتياز اليومي للأحزاب والأجزاء</h1>
        <p style="color: #666; font-size: 16px; margin: 5px 0; font-weight: bold;">
          الفترة من ${fromDateFormatted} إلى ${toDateFormatted}
        </p>
        <p style="color: #999; font-size: 14px; margin: 5px 0;">
          تاريخ التقرير: ${formatDateForDisplay(getTodayForStorage())}
        </p>
      </div>
      
      <div style="margin-bottom: 20px; page-break-inside: avoid;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">اسم الطالب</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">اسم المعلم</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">رقم الجزء/الحزب</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">المقدار</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">تاريخ العرض</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">المدة المستغرقة</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">عدد مرات التسميع</th>
              <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; border: none; font-size: 14px; white-space: nowrap;">اسم المستمع</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
          </tbody>
        </table>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; text-align: center; page-break-inside: avoid;">
        <h3 style="margin: 0 0 10px 0; font-size: 20px;">📊 الإحصائيات</h3>
        <div style="font-size: 24px; font-weight: bold;">
          إجمالي الاجتيازات: ${passageRecords.length}
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Generate PDF using html2canvas and jsPDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200
    });
    
    document.body.removeChild(container);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;
    
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    const fileName = `تقرير_الاجتياز_اليومي_${fromDateFormatted.replace(/\//g, '-')}_الى_${toDateFormatted.replace(/\//g, '-')}.pdf`;
    pdf.save(fileName);
    
    console.log('🎉 Daily Passage Report PDF saved:', fileName);
    
    // Remove loading and close modal
    loadingMsg.remove();
    window.closeDailyPassageModal();
    
    alert('✅ تم تصدير تقرير الاجتياز اليومي بنجاح!');
    
  } catch (error) {
    console.error('Error generating daily passage report:', error);
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    if (loadingMsg) loadingMsg.remove();
    alert('❌ حدث خطأ في إنشاء التقرير');
  }
};

// Add fadeOut animation to styles
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;
document.head.appendChild(style);



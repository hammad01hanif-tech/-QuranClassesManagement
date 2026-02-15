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

import { getTodayForStorage, getCurrentHijriDate, formatHijriDate } from './hijri-date.js';
import { accurateHijriDates, gregorianToAccurateHijri } from './accurate-hijri-dates.js';

let viewerNotificationsListener = null;

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
      viewerName: 'مازن البلوشي',
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

// Set today's Hijri date in DD-MM-YYYY format
window.setTodayHijriDate = function(reportId) {
  const today = new Date();
  const hijriParts = today.toLocaleDateString('en-SA-u-ca-islamic', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/');
  
  // Convert from MM/DD/YYYY to DD-MM-YYYY
  const hijriDate = `${hijriParts[1]}-${hijriParts[0]}-${hijriParts[2]}`;
  
  document.getElementById(`displayDate_${reportId}`).value = hijriDate;
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
    await updateDoc(doc(db, 'juzDisplays', reportId), {
      displayDate: normalizedDate, // Store in YYYY-MM-DD format
      status: 'completed',
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
    
    // Create notification message
    const notificationMessage = `🎉 رسالة اجتياز\n\n✅ الطالب: ${data.studentName}\n👨‍🏫 المعلم: ${data.teacherName || 'غير محدد'}\n📖 الجزء: ${data.juzNumber}\n📅 تاريخ العرض: ${data.displayDate}\n⏱️ المدة المستغرقة: ${durationText}\n👤 العارض: ${data.viewerName}`;
    
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

━━━━━━━━━━━━━━━━━━━━
📱 مركز متون لتحفيظ القرآن
━━━━━━━━━━━━━━━━━━━━`;
    
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
        // Calculate days since last lesson using accurate Hijri calendar
        const daysSince = calculateHijriDaysDifference(data.lastLessonDate, todayHijri);
        
        queue.push({
          reportId: reportId,
          studentId: data.studentId,
          studentName: data.studentName,
          teacherId: data.teacherId,
          teacherName: data.teacherName || 'غير محدد',
          juzNumber: data.juzNumber,
          lastLessonDate: data.lastLessonDate,
          daysSince: daysSince
        });
      }
    });
    
    // Sort by daysSince (descending - oldest first = highest priority)
    queue.sort((a, b) => b.daysSince - a.daysSince);
    
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
      const priorityColor = student.daysSince >= 7 ? '#dc3545' : student.daysSince >= 5 ? '#ffc107' : '#28a745';
      const daysText = student.daysSince === 1 ? 'يوم واحد' : student.daysSince === 2 ? 'يومان' : `${student.daysSince} أيام`;
      
      tableHTML += `
        <tr onclick="window.openQueueReport('${student.reportId}')" style="background: ${rowColor}; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#e3f2fd'" onmouseout="this.style.background='${rowColor}'">
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

// Student Page Functions
import { db, collection, getDocs, doc, getDoc, query, where, orderBy, onSnapshot, updateDoc } from '../firebase-config.js';
import { getCurrentHijriDate, formatHijriDate } from './hijri-date.js';
import { getAccurateStudyDaysCurrentMonth, getAccurateStudyDaysForMonth, accurateHijriDates } from './accurate-hijri-dates.js';

let studentNotificationsListener = null;

// Initialize student dashboard
export async function initStudent() {
  const studentId = sessionStorage.getItem('loggedInStudent');
  const studentName = sessionStorage.getItem('loggedInStudentName');
  
  if (!studentId) {
    console.error('No student logged in');
    return;
  }
  
  // Display student name
  document.getElementById('studentNameDisplay').textContent = studentName || studentId;
  
  // Load student assessments with default current month
  await loadStudentAssessments(studentId, 'current-month');
}

// Load student assessments with month filter
window.loadStudentAssessments = async function(studentId, selectedMonthFilter = 'current-month') {
  const container = document.getElementById('studentAssessmentsList');
  container.innerHTML = '<p style="text-align: center; padding: 40px;">⏳ جاري تحميل التقييمات...</p>';
  
  try {
    // Get actual reports from database
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    const actualReports = new Map();
    reportsSnap.forEach(d => {
      actualReports.set(d.id, d.data());
    });
    
    // Get study days based on selected month
    let allStudyDays = [];
    
    if (selectedMonthFilter === 'current-month') {
      // Get current month study days (Sun-Thu only, excludes Fri-Sat)
      allStudyDays = getAccurateStudyDaysCurrentMonth();
    } else {
      // Get study days for selected month (Sun-Thu only, excludes Fri-Sat)
      allStudyDays = getAccurateStudyDaysForMonth(selectedMonthFilter);
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
    
    // Get current Hijri year for month filter
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
    
    // Create month filter dropdown
    let filterHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
        <label style="color: white; font-weight: bold; margin-left: 10px; font-size: 16px;">📅 اختر الشهر:</label>
        <select id="studentMonthFilter" onchange="loadStudentAssessments('${studentId}', this.value)" style="padding: 8px 15px; border-radius: 6px; border: 2px solid white; font-size: 14px; font-weight: bold; cursor: pointer; min-width: 200px;">
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
    
    if (completeReports.length === 0) {
      container.innerHTML = filterHTML + `
        <div style="text-align: center; padding: 60px; color: #999; background: white; border-radius: 12px;">
          <div style="font-size: 60px; margin-bottom: 15px;">📝</div>
          <p style="font-size: 18px;">لا توجد أيام دراسية في هذا الشهر</p>
        </div>
      `;
      return;
    }
    
    // Create table (compact version with expandable details)
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
    
    completeReports.forEach((report, index) => {
      // Format Hijri date
      const [year, month, day] = report.dateId.split('-');
      const monthName = hijriMonths[parseInt(month) - 1];
      const fullHijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
      
      // Get accurate day name from accurate calendar
      let dayName = 'غير محدد';
      let dayOfWeek = -1;
      
      // Find this date in accurate calendar
      const accurateEntry = accurateHijriDates.find(entry => entry.hijri === report.dateId);
      
      if (accurateEntry) {
        // Use accurate Gregorian date from calendar
        const gregorianDate = new Date(accurateEntry.gregorian + 'T12:00:00');
        dayOfWeek = gregorianDate.getDay();
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
        
        // Warn if weekend day appears in reports (shouldn't happen after filtering)
        if (dayOfWeek === 5 || dayOfWeek === 6) {
          console.warn(`⚠️ تحذير: يوم عطلة في التقارير! ${fullHijriDate} (${dayName}) - Day ${dayOfWeek}`);
        }
      } else {
        // Fallback: Use stored Gregorian date if available
        if (report.gregorianDate) {
          const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
          dayOfWeek = gregorianDate.getDay();
          dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
        } else {
          // Last resort: approximate calculation (may be inaccurate)
          const [y, m, d] = report.dateId.split('-');
          const approxDate = new Date(parseInt(y) - 579, parseInt(m) - 1, parseInt(d), 12, 0, 0);
          dayOfWeek = approxDate.getDay();
          dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(approxDate);
        }
      }
      
      const uniqueId = `student-report-${report.dateId}-${index}`;
      
      // Check if student is struggling (any score < 5)
      const isStruggling = report.hasReport && 
        (report.lessonScore < 5 || report.lessonSideScore < 5 || report.revisionScore < 5);
      
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
        // Absent - Simplified card without details button
        const excuseText = report.excuseType === 'withExcuse' ? 'بعذر' : 'بدون عذر';
        tableHTML += `
          <tr class="report-row clickable-row" onclick="toggleReportDetails('${uniqueId}')" style="background: #ffe5e5; cursor: pointer;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: #dc3545; font-weight: bold;">❌ غائب (${excuseText})</td>
          </tr>
          <tr id="${uniqueId}" class="report-details" style="display: none;">
            <td colspan="3" style="background: #fff5f5; padding: 12px;">
              <div style="background: white; padding: 12px; border-radius: 8px; border: 2px solid #dc3545;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div style="font-size: 12px;">
                    <strong>التاريخ:</strong> ${fullHijriDate}
                  </div>
                  <div style="font-size: 12px;">
                    <strong>اليوم:</strong> ${dayName}
                  </div>
                  <div style="font-size: 12px;">
                    <strong>الحالة:</strong> <span style="color: #dc3545;">❌ غائب</span>
                  </div>
                  <div style="font-size: 12px;">
                    <strong>نوع الغياب:</strong> ${excuseText}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      } else {
        // Has assessment with scores - Lightweight card with recitation details
        const statusColor = isStruggling ? '#dc3545' : (report.totalScore >= 25 ? '#28a745' : '#ffc107');
        const statusIcon = isStruggling ? '⚠️' : (report.totalScore >= 25 ? '✅' : '⏳');
        const statusText = isStruggling ? 'تعثر' : `${report.totalScore}/30`;
        const rowStyle = isStruggling ? 'background: #ffebee; border-right: 4px solid #dc3545;' : '';
        
        // Format lesson and revision details
        const lessonDetails = report.lessonSurahFrom && report.lessonVerseFrom 
          ? `من ${report.lessonSurahFrom}:${report.lessonVerseFrom} إلى ${report.lessonSurahTo}:${report.lessonVerseTo}`
          : 'غير محدد';
        const revisionDetails = report.revisionSurahFrom && report.revisionVerseFrom 
          ? `من ${report.revisionSurahFrom}:${report.revisionVerseFrom} إلى ${report.revisionSurahTo}:${report.revisionVerseTo}`
          : 'غير محدد';
        
        tableHTML += `
          <tr class="report-row clickable-row" onclick="toggleReportDetails('${uniqueId}')" style="${rowStyle} cursor: pointer;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: ${statusColor}; font-weight: bold;">${statusIcon} ${statusText}</td>
          </tr>
          <tr id="${uniqueId}" class="report-details" style="display: none;">
            <td colspan="3" style="background: #f8f9fa; padding: 12px;">
              <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <!-- Compact header -->
                <div style="text-align: center; padding: 8px; background: ${isStruggling ? '#ffebee' : '#f0f4ff'}; border-radius: 6px; margin-bottom: 10px;">
                  <div style="font-size: 16px; font-weight: bold; color: ${isStruggling ? '#dc3545' : '#667eea'};">${report.totalScore || 0}/30</div>
                  <div style="font-size: 10px; color: #666;">${fullHijriDate}</div>
                  ${isStruggling ? '<div style="margin-top: 5px; font-size: 11px; color: #dc3545;">⚠️ تعثر في بعض البنود</div>' : ''}
                </div>
                
                <!-- Compact Scores Grid (3x2) -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px;">
                  <div style="background: #e8f5e9; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #28a745;">${report.asrPrayerScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">صلاة العصر</div>
                  </div>
                  <div style="background: ${report.lessonScore < 5 ? '#ffebee' : '#e3f2fd'}; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: ${report.lessonScore < 5 ? '#dc3545' : '#2196f3'};">${report.lessonScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">الدرس ${report.lessonScore < 5 ? '⚠️' : ''}</div>
                  </div>
                  <div style="background: ${report.lessonSideScore < 5 ? '#ffebee' : '#f3e5f5'}; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: ${report.lessonSideScore < 5 ? '#dc3545' : '#9c27b0'};">${report.lessonSideScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">جنب الدرس ${report.lessonSideScore < 5 ? '⚠️' : ''}</div>
                  </div>
                  <div style="background: ${report.revisionScore < 5 ? '#ffebee' : '#fff3e0'}; padding: 8px; border-radius: 6px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: ${report.revisionScore < 5 ? '#dc3545' : '#ff9800'};">${report.revisionScore || 0}</div>
                    <div style="font-size: 10px; color: #666;">المراجعة ${report.revisionScore < 5 ? '⚠️' : ''}</div>
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
                
                <!-- Recitation Details Section -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px; font-size: 12px;">
                  <div style="margin-bottom: 8px;">
                    <strong style="color: #667eea;">📖 الدرس:</strong>
                    <div style="color: #666; margin-top: 3px;">${lessonDetails}</div>
                  </div>
                  <div>
                    <strong style="color: #667eea;">🔄 المراجعة:</strong>
                    <div style="color: #666; margin-top: 3px;">${revisionDetails}</div>
                  </div>
                </div>
                
                <!-- Notes Section -->
                ${report.details ? `
                  <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; font-size: 12px;">
                    <strong style="color: #667eea;">📝 ملاحظات المعلم:</strong>
                    <p style="margin: 5px 0 0 0; color: #666; white-space: pre-wrap;">${report.details}</p>
                  </div>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }
    });
    
    tableHTML += '</tbody></table>';
    
    container.innerHTML = filterHTML + `<h4 style="margin: 20px 0;">تقارير الشهر: ${completeReports.length} يوم دراسي</h4>` + tableHTML;
    
    // Start notifications listener after loading
    startStudentNotificationsListener(studentId);
    
  } catch (error) {
    console.error('Error loading assessments:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 60px; color: #dc3545; background: white; border-radius: 12px;">
        <div style="font-size: 60px; margin-bottom: 15px;">❌</div>
        <p style="font-size: 18px;">حدث خطأ في تحميل التقييمات</p>
      </div>
    `;
  }
};

// Show student attendance
window.showStudentAttendance = async function() {
  const studentId = sessionStorage.getItem('loggedInStudent');
  
  if (!studentId) return;
  
  const panel = document.getElementById('studentAttendancePanel');
  panel.style.display = 'block';
  
  try {
    // Get current Hijri month using accurate calendar
    const currentHijri = getCurrentHijriDate();
    const currentMonth = formatHijriDate(new Date());
    document.getElementById('studentAttendanceMonth').textContent = currentMonth;
    
    // Get all study days in current Hijri month (Sun-Thu only, excludes Fri-Sat)
    const studyDays = getAccurateStudyDaysCurrentMonth();
    const totalStudyDays = studyDays.length;
    
    // Get student reports
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    // Count present days
    let presentCount = 0;
    studyDays.forEach(studyDay => {
      const hasReport = reportsSnap.docs.some(doc => doc.id === studyDay);
      if (hasReport) {
        presentCount++;
      }
    });
    
    const absentCount = totalStudyDays - presentCount;
    
    document.getElementById('studentPresentCount').textContent = presentCount;
    document.getElementById('studentAbsentCount').textContent = absentCount;
    
  } catch (error) {
    console.error('Error loading attendance:', error);
  }
};

window.hideStudentAttendance = function() {
  document.getElementById('studentAttendancePanel').style.display = 'none';
};

// Toggle inbox
window.toggleStudentInbox = function() {
  const panel = document.getElementById('studentInboxPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

// Start notifications listener
function startStudentNotificationsListener(studentId) {
  if (studentNotificationsListener) {
    studentNotificationsListener();
  }
  
  try {
    const q = query(
      collection(db, 'studentNotifications'),
      where('studentId', '==', studentId),
      where('read', '==', false)
    );
    
    studentNotificationsListener = onSnapshot(q, (snapshot) => {
      const unreadCount = snapshot.size;
      const badge = document.getElementById('studentInboxBadge');
      
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
      
      // Load messages
      loadStudentNotifications(studentId);
    });
    
  } catch (error) {
    console.error('Error starting notifications listener:', error);
  }
}

// Load student notifications
async function loadStudentNotifications(studentId) {
  const container = document.getElementById('studentInboxMessages');
  
  try {
    const q = query(
      collection(db, 'studentNotifications'),
      where('studentId', '==', studentId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا توجد إشعارات</p>';
      return;
    }
    
    let html = '';
    snapshot.forEach(doc => {
      const notification = doc.data();
      const isRead = notification.read;
      
      html += `
        <div style="background: ${isRead ? '#f8f9fa' : '#fff3cd'}; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 2px solid ${isRead ? '#e9ecef' : '#ffc107'};">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px; color: #333;">${notification.title || 'إشعار'}</div>
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">${notification.message || ''}</div>
          <div style="font-size: 12px; color: #999;">${new Date(notification.timestamp?.toDate()).toLocaleString('ar-SA')}</div>
          ${!isRead ? `<button onclick="window.markStudentNotificationRead('${doc.id}')" style="margin-top: 10px; padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">تم القراءة</button>` : ''}
        </div>
      `;
    });
    
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading notifications:', error);
    container.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">حدث خطأ في تحميل الإشعارات</p>';
  }
}

// Mark notification as read
window.markStudentNotificationRead = async function(notificationId) {
  try {
    await updateDoc(doc(db, 'studentNotifications', notificationId), {
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

// Stop notifications listener
export function stopStudentNotificationsListener() {
  if (studentNotificationsListener) {
    studentNotificationsListener();
    studentNotificationsListener = null;
  }
}

// Show report details modal
window.viewStudentReportDetails = function(report) {
  // Format Hijri date
  const [year, month, day] = report.dateId.split('-');
  const hijriMonths = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  const monthName = hijriMonths[parseInt(month) - 1];
  const fullHijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
  
  let detailsHTML = `
    <div style="background: #fff; padding: 20px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
      <h3 style="text-align: center; margin-bottom: 20px; color: #2c3e50;">📋 تفاصيل التقرير</h3>
      <p style="text-align: center; font-size: 18px; color: #555; margin-bottom: 20px;">
        <strong>${fullHijriDate}</strong>
      </p>
  `;
  
  if (report.status === 'absent') {
    // Show absence details
    const excuseText = report.excuseType === 'withExcuse' ? 'بعذر' : 'بدون عذر';
    detailsHTML += `
      <div style="background: #ffe5e5; padding: 15px; border-radius: 8px; text-align: center;">
        <p style="font-size: 18px; color: #dc3545; font-weight: bold;">❌ غائب (${excuseText})</p>
      </div>
    `;
  } else {
    // Show assessment details
    detailsHTML += `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">المجموع الكلي:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left; font-size: 18px; font-weight: bold; color: ${report.totalScore >= 25 ? '#28a745' : '#dc3545'};">${report.totalScore || 0} / 35</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">صلاة العصر:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${report.asrPrayerScore || 0} / 5</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">الدرس:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${report.lessonScore || 0} / 10</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">جنب الدرس:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${report.lessonSideScore || 0} / 5</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">المراجعة:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${report.revisionScore || 0} / 10</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">القراءة:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${report.readingScore || 0} / 3</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">السلوك:</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">${report.behaviorScore || 0} / 2</td>
        </tr>
      </table>
      
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <h4 style="margin-bottom: 10px; color: #2c3e50;">📖 تفاصيل التسميع:</h4>
        <div style="margin-bottom: 10px;">
          <strong>الدرس:</strong><br>
          <span style="color: #555;">من: ${report.lessonFrom || 'غير محدد'} - إلى: ${report.lessonTo || 'غير محدد'}</span>
        </div>
        <div>
          <strong>المراجعة:</strong><br>
          <span style="color: #555;">من: ${report.revisionFrom || 'غير محدد'} - إلى: ${report.revisionTo || 'غير محدد'}</span>
        </div>
      </div>
    `;
  }
  
  detailsHTML += `
      <button onclick="document.querySelector('.modal-overlay').remove()" style="width: 100%; margin-top: 20px; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">إغلاق</button>
    </div>
  `;
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';
  modalOverlay.innerHTML = detailsHTML;
  
  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  });
  
  document.body.appendChild(modalOverlay);
};

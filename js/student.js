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
    
    // Calculate statistics for current month reports
    let completeLessonsCount = 0;
    let firstLesson = null;
    let lastLesson = null;
    
    completeReports.forEach(report => {
      if (report.hasReport && report.status === 'present') {
        // Count complete lessons (score >= 5 for all three parts)
        if (report.lessonScore >= 5 && report.lessonSideScore >= 5 && report.revisionScore >= 5) {
          completeLessonsCount++;
        }
        
        // Track first lesson
        if (!firstLesson && report.lessonSurahFromName && report.lessonVerseFrom) {
          firstLesson = {
            from: `${report.lessonSurahFromName}:${report.lessonVerseFrom}`,
            to: `${report.lessonSurahToName}:${report.lessonVerseTo}`,
            date: report.dateId
          };
        }
        
        // Always update last lesson (since reports are sorted by date)
        if (report.lessonSurahFromName && report.lessonVerseFrom) {
          lastLesson = {
            from: `${report.lessonSurahFromName}:${report.lessonVerseFrom}`,
            to: `${report.lessonSurahToName}:${report.lessonVerseTo}`,
            date: report.dateId
          };
        }
      }
    });
    
    // Create statistics summary table
    let statsHTML = `
      <div style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h4 style="margin: 0 0 15px 0; color: #667eea; font-size: 16px; text-align: center;">📊 إحصائيات الشهر</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 2px solid #f0f0f0;">
            <td style="padding: 12px; font-weight: bold; color: #555; width: 40%;">عدد الدروس المكتملة:</td>
            <td style="padding: 12px; color: #28a745; font-weight: bold; font-size: 18px;">${completeLessonsCount} ${completeLessonsCount === 1 ? 'درس' : 'دروس'}</td>
          </tr>
          <tr style="border-bottom: 2px solid #f0f0f0;">
            <td style="padding: 12px; font-weight: bold; color: #555;">أول درس في الشهر:</td>
            <td style="padding: 12px; color: #667eea; font-size: 13px;">
              ${firstLesson ? `من ${firstLesson.from} إلى ${firstLesson.to}` : 'لا يوجد'}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; font-weight: bold; color: #555;">آخر درس حتى الآن:</td>
            <td style="padding: 12px; color: #764ba2; font-size: 13px;">
              ${lastLesson ? `من ${lastLesson.from} إلى ${lastLesson.to}` : 'لا يوجد'}
            </td>
          </tr>
        </table>
      </div>
    `;
    
    if (completeReports.length === 0) {
      container.innerHTML = filterHTML + statsHTML + `
        <div style="text-align: center; padding: 60px; color: #999; background: white; border-radius: 12px;">
          <div style="font-size: 60px; margin-bottom: 15px;">📝</div>
          <p style="font-size: 18px;">لا توجد أيام دراسية في هذا الشهر</p>
        </div>
      `;
      return;
    }
    
    // Create table (compact version with expandable details)
    let tableHTML = `
      <table class="reports-table compact-reports-table keep-table">
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
        const lessonDetails = report.lessonSurahFromName && report.lessonVerseFrom 
          ? `من ${report.lessonSurahFromName}:${report.lessonVerseFrom} إلى ${report.lessonSurahToName}:${report.lessonVerseTo}`
          : 'غير محدد';
        const revisionDetails = report.revisionSurahFromName && report.revisionVerseFrom 
          ? `من ${report.revisionSurahFromName}:${report.revisionVerseFrom} إلى ${report.revisionSurahToName}:${report.revisionVerseTo}`
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
                  <div style="margin-bottom: 8px;">
                    <strong style="color: #667eea;">🔄 المراجعة:</strong>
                    <div style="color: #666; margin-top: 3px;">${revisionDetails}</div>
                  </div>
                  ${report.additionalLessonSurahFromName && report.additionalLessonVerseFrom ? `
                  <div>
                    <strong style="color: #28a745;">➕ الدرس الإضافي:</strong>
                    <div style="color: #666; margin-top: 3px;">من ${report.additionalLessonSurahFromName}:${report.additionalLessonVerseFrom} إلى ${report.additionalLessonSurahToName}:${report.additionalLessonVerseTo}</div>
                  </div>
                  ` : ''}
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
    
    container.innerHTML = filterHTML + statsHTML + `<h4 style="margin: 20px 0;">تقارير الشهر: ${completeReports.length} يوم دراسي</h4>` + tableHTML;
    
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
  
  // Close navbar if open
  const navbar = document.getElementById('studentSidebarNavbar');
  if (navbar && navbar.style.display !== 'none') {
    window.toggleStudentNavbar();
  }
  
  const modal = document.getElementById('studentAttendancePanel');
  modal.style.display = 'block';
  
  // Populate month filter with months from Rajab to Dhul Hijjah
  populateStudentAttendanceMonthFilter();
  
  // Load attendance for current month by default
  await loadStudentAttendanceByMonth();
};

// Populate month filter dropdown
function populateStudentAttendanceMonthFilter() {
  const filterSelect = document.getElementById('studentAttendanceMonthFilter');
  
  // Get current Hijri year
  const today = new Date();
  const hijriFormatter = new Intl.DateTimeFormat('en-SA-u-ca-islamic', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Riyadh'
  });
  const parts = hijriFormatter.formatToParts(today);
  const currentHijriYear = parts.find(p => p.type === 'year').value;
  
  // Hijri months from Rajab (7) to Dhul Hijjah (12)
  const hijriMonths = [
    { number: 7, name: 'رجب' },
    { number: 8, name: 'شعبان' },
    { number: 9, name: 'رمضان' },
    { number: 10, name: 'شوال' },
    { number: 11, name: 'ذو القعدة' },
    { number: 12, name: 'ذو الحجة' }
  ];
  
  // Clear and rebuild options
  filterSelect.innerHTML = '<option value="current-month">الشهر الحالي</option>';
  
  hijriMonths.forEach(month => {
    const monthKey = `${currentHijriYear}-${String(month.number).padStart(2, '0')}`;
    const option = document.createElement('option');
    option.value = monthKey;
    option.textContent = `${month.name} ${currentHijriYear}هـ`;
    filterSelect.appendChild(option);
  });
}

// Load student attendance by selected month
window.loadStudentAttendanceByMonth = async function() {
  const studentId = sessionStorage.getItem('loggedInStudent');
  if (!studentId) return;
  
  const selectedMonth = document.getElementById('studentAttendanceMonthFilter').value;
  
  try {
    // Get study days for selected month
    let studyDays = [];
    if (selectedMonth === 'current-month') {
      studyDays = getAccurateStudyDaysCurrentMonth();
    } else {
      studyDays = getAccurateStudyDaysForMonth(selectedMonth);
    }
    
    // Get student reports for this month
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    // Count absent days
    let absentWithExcuse = 0;
    let absentWithoutExcuse = 0;
    
    studyDays.forEach(dateId => {
      const reportDoc = reportsSnap.docs.find(doc => doc.id === dateId);
      
      if (reportDoc) {
        const data = reportDoc.data();
        
        // Check if student was absent
        if (data.status === 'absent') {
          // Check excuse type: 'withExcuse' or 'withoutExcuse'
          if (data.excuseType === 'withExcuse') {
            absentWithExcuse++;
          } else {
            absentWithoutExcuse++;
          }
        }
      }
    });
    
    const totalAbsent = absentWithExcuse + absentWithoutExcuse;
    
    // Update UI
    document.getElementById('studentTotalAbsentCount').textContent = totalAbsent;
    document.getElementById('studentAbsentWithExcuseCount').textContent = absentWithExcuse;
    document.getElementById('studentAbsentWithoutExcuseCount').textContent = absentWithoutExcuse;
    
  } catch (error) {
    console.error('Error loading attendance:', error);
  }
};

window.hideStudentAttendance = function() {
  document.getElementById('studentAttendancePanel').style.display = 'none';
};

// Toggle inbox
window.toggleStudentInbox = function() {
  const modal = document.getElementById('studentInboxPanel');
  modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
};

// Start notifications listener
function startStudentNotificationsListener(studentId) {
  if (studentNotificationsListener) {
    studentNotificationsListener();
  }
  
  console.log('🔔 Starting notifications listener for student:', studentId);
  
  try {
    const q = query(
      collection(db, 'studentNotifications'),
      where('studentId', '==', studentId),
      where('read', '==', false)
    );
    
    studentNotificationsListener = onSnapshot(q, (snapshot) => {
      const unreadCount = snapshot.size;
      console.log('📬 Unread notifications count:', unreadCount);
      
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
  
  console.log('📥 Loading notifications for student:', studentId);
  
  try {
    const q = query(
      collection(db, 'studentNotifications'),
      where('studentId', '==', studentId)
    );
    
    const snapshot = await getDocs(q);
    
    console.log('📊 Total notifications found:', snapshot.size);
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا توجد إشعارات</p>';
      return;
    }
    
    // Convert to array and sort manually by createdAt
    const notifications = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('📬 Notification:', {
        id: doc.id,
        type: data.type,
        teacherName: data.teacherName,
        message: data.message?.substring(0, 50) + '...'
      });
      
      notifications.push({
        id: doc.id,
        ...data
      });
    });
    
    // Sort by createdAt descending (newest first)
    notifications.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
    
    let html = '';
    notifications.forEach(notification => {
      const isRead = notification.read;
      const timestamp = notification.createdAt?.toDate ? notification.createdAt.toDate() : new Date();
      
      html += `
        <div style="background: ${isRead ? '#f8f9fa' : '#fff3cd'}; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 2px solid ${isRead ? '#e9ecef' : '#ffc107'};">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px; color: #333;">${notification.type === 'juz_passed' ? '🎉 رسالة اجتياز' : notification.type === 'juz_shared' ? '📝 تقرير مشارك' : 'إشعار'}</div>
          <div style="font-size: 13px; color: #666; margin-bottom: 8px; white-space: pre-line;">${notification.message || ''}</div>
          <div style="font-size: 12px; color: #999;">${timestamp.toLocaleString('ar-SA')}</div>
          ${!isRead ? `<button onclick="window.markStudentNotificationRead('${notification.id}')" style="margin-top: 10px; padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;">تم القراءة</button>` : ''}
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

// Toggle Student Navbar (Sidebar)
window.toggleStudentNavbar = function() {
  const navbar = document.getElementById('studentSidebarNavbar');
  const overlay = document.getElementById('studentNavbarOverlay');
  
  if (navbar.style.display === 'none' || navbar.style.display === '') {
    // Open navbar
    navbar.style.display = 'block';
    overlay.style.display = 'block';
    
    // Set student name in navbar
    const studentName = sessionStorage.getItem('loggedInStudentName');
    document.getElementById('navbarStudentName').textContent = studentName || 'الطالب';
    
    // Animate slide in
    setTimeout(() => {
      navbar.style.transform = 'translateX(0)';
    }, 10);
  } else {
    // Close navbar
    navbar.style.transform = 'translateX(100%)';
    setTimeout(() => {
      navbar.style.display = 'none';
      overlay.style.display = 'none';
    }, 300);
  }
};

// Open Personal Data Modal from Navbar
window.openPersonalDataModal = async function() {
  // Close navbar first
  window.toggleStudentNavbar();
  
  // Wait a bit for navbar to close
  setTimeout(async () => {
    const panel = document.getElementById('studentPersonalDataPanel');
    panel.style.display = 'flex';
    await loadStudentPersonalData();
  }, 300);
};

// Close Personal Data Modal
window.closePersonalDataModal = function() {
  document.getElementById('studentPersonalDataPanel').style.display = 'none';
};

// Open Passed Juz Modal from Navbar
window.openPassedJuzModal = async function() {
  // Close navbar first
  window.toggleStudentNavbar();
  
  // Wait a bit for navbar to close
  setTimeout(async () => {
    const panel = document.getElementById('studentPassedJuzPanel');
    panel.style.display = 'flex';
    await loadPassedJuzData();
  }, 300);
};

// Close Passed Juz Modal
window.closePassedJuzModal = function() {
  document.getElementById('studentPassedJuzPanel').style.display = 'none';
};

// Toggle Personal Data Modal (deprecated - kept for compatibility)
window.toggleStudentPersonalData = async function() {
  await openPersonalDataModal();
};

// Load student personal data
async function loadStudentPersonalData() {
  const studentId = sessionStorage.getItem('loggedInStudent');
  
  if (!studentId) {
    console.error('No student logged in');
    return;
  }
  
  try {
    // Get student data from Firebase
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!studentDoc.exists()) {
      console.error('Student not found');
      return;
    }
    
    const studentData = studentDoc.data();
    
    // Populate read-only fields
    document.getElementById('studentPersonalName').textContent = studentData.name || '-';
    document.getElementById('studentPersonalId').textContent = studentId || '-';
    document.getElementById('studentPersonalClass').textContent = studentData.classId || '-';
    
    // Map level to Arabic
    const levelMap = {
      'hifz': 'حفظ',
      'dabt': 'ضبط',
      'noorani': 'نوراني'
    };
    document.getElementById('studentPersonalLevel').textContent = levelMap[studentData.level] || studentData.level || '-';
    document.getElementById('studentPersonalAge').textContent = studentData.age ? `${studentData.age} سنة` : '-';
    
    // Populate editable fields
    document.getElementById('studentEditBirthDate').value = studentData.birthDate || '';
    document.getElementById('studentEditGuardianPhone').value = studentData.guardianPhone || '';
    
  } catch (error) {
    console.error('Error loading personal data:', error);
  }
}

// Load passed Juz data
async function loadPassedJuzData() {
  const studentId = sessionStorage.getItem('loggedInStudent');
  const gridContainer = document.getElementById('studentPassedJuzGrid');
  const countDisplay = document.getElementById('studentPassedJuzCount');
  
  if (!studentId) {
    console.error('No student logged in');
    return;
  }
  
  try {
    // Get all passed Juz for this student
    const juzQuery = query(
      collection(db, 'juzDisplays'),
      where('studentId', '==', studentId),
      where('status', '==', 'completed')
    );
    
    const juzSnap = await getDocs(juzQuery);
    
    // Create a map of passed Juz numbers
    const passedJuzMap = new Map();
    juzSnap.forEach(docSnap => {
      const data = docSnap.data();
      passedJuzMap.set(data.juzNumber, {
        id: docSnap.id,
        ...data
      });
    });
    
    // Update count display
    if (countDisplay) {
      countDisplay.textContent = `${passedJuzMap.size} / 30`;
    }
    
    // Generate grid for all 30 Juz
    let html = '';
    for (let i = 1; i <= 30; i++) {
      const isPassed = passedJuzMap.has(i);
      const juzData = passedJuzMap.get(i);
      
      html += `
        <div 
          ${isPassed ? `onclick="window.showJuzDetails(${i})"` : ''}
          style="
            padding: 12px 8px;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            cursor: ${isPassed ? 'pointer' : 'default'};
            background: ${isPassed ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : '#f0f0f0'};
            color: ${isPassed ? 'white' : '#999'};
            border: 2px solid ${isPassed ? '#28a745' : '#ddd'};
            transition: all 0.3s;
            ${isPassed ? 'box-shadow: 0 2px 8px rgba(40,167,69,0.3);' : ''}
          "
          ${isPassed ? `onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"` : ''}
        >
          ${i}
          ${isPassed ? '<div style="font-size: 16px; margin-top: 2px;">✓</div>' : ''}
        </div>
      `;
    }
    
    gridContainer.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading passed Juz:', error);
    gridContainer.innerHTML = '<p style="text-align: center; color: #dc3545; grid-column: 1 / -1;">حدث خطأ في تحميل البيانات</p>';
  }
}

// Toggle Personal Data Modal (Old function - removed load logic)
// Now renamed functions handle the modal operations

// Load student personal data (renamed from previous)
// Already defined above

// Load passed Juz data (renamed from previous)  
// Already defined above

// Show Juz details modal
window.showJuzDetails = async function(juzNumber) {
  const studentId = sessionStorage.getItem('loggedInStudent');
  
  if (!studentId) return;
  
  // Close passed juz modal if open
  const passedJuzPanel = document.getElementById('studentPassedJuzPanel');
  if (passedJuzPanel.style.display === 'flex') {
    passedJuzPanel.style.display = 'none';
  }
  
  const modal = document.getElementById('studentJuzDetailsModal');
  const content = document.getElementById('studentJuzDetailsContent');
  
  modal.style.display = 'flex';
  content.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ جاري التحميل...</p>';
  
  try {
    // Get Juz data
    const juzQuery = query(
      collection(db, 'juzDisplays'),
      where('studentId', '==', studentId),
      where('juzNumber', '==', juzNumber),
      where('status', '==', 'completed')
    );
    
    const juzSnap = await getDocs(juzQuery);
    
    if (juzSnap.empty) {
      content.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">لم يتم العثور على بيانات الجزء</p>';
      return;
    }
    
    const juzData = juzSnap.docs[0].data();
    
    // Format dates
    const displayDate = juzData.displayDate ? formatDateForDisplay(juzData.displayDate) : '-';
    const lastLessonDate = juzData.lastLessonDate ? formatDateForDisplay(juzData.lastLessonDate) : '-';
    
    // Calculate duration
    let duration = '-';
    let daysCount = 0;
    if (juzData.lastLessonDate && juzData.displayDate) {
      const lastLesson = new Date(juzData.lastLessonDate);
      const display = new Date(juzData.displayDate);
      daysCount = Math.ceil((display - lastLesson) / (1000 * 60 * 60 * 24));
      duration = `${daysCount} يوم`;
    }
    
    // Get attempt count from daily reports (count all reports with this juzNumber in revision)
    let attemptCount = '-';
    try {
      const reportsQuery = query(
        collection(db, 'studentProgress', studentId, 'dailyReports'),
        where('status', '==', 'present')
      );
      const reportsSnap = await getDocs(reportsQuery);
      
      let count = 0;
      reportsSnap.forEach(reportDoc => {
        const reportData = reportDoc.data();
        // Check if this report includes revision of this Juz
        // This is a simplified count - you might want to make it more accurate
        if (reportData.revisionFrom || reportData.revisionTo) {
          count++;
        }
      });
      
      attemptCount = count > 0 ? `${count} مرة` : 'غير محدد';
    } catch (err) {
      console.error('Error counting attempts:', err);
    }
    
    content.innerHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 10px;">📖</div>
        <div style="font-size: 24px; font-weight: bold; color: #28a745;">الجزء ${juzNumber}</div>
      </div>
      
      <div style="background: white; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
        <div style="padding: 12px 15px; background: #f8f9fa; border-bottom: 2px solid #e9ecef;">
          <div style="font-size: 13px; color: #666; margin-bottom: 3px;">📅 تاريخ العرض</div>
          <div style="font-size: 16px; font-weight: bold; color: #333;">${displayDate}</div>
        </div>
        
        <div style="padding: 12px 15px; border-bottom: 2px solid #e9ecef;">
          <div style="font-size: 13px; color: #666; margin-bottom: 3px;">👤 اسم العارض</div>
          <div style="font-size: 16px; font-weight: bold; color: #333;">${juzData.viewerName || juzData.studentName || '-'}</div>
        </div>
        
        <div style="padding: 12px 15px; border-bottom: 2px solid #e9ecef;">
          <div style="font-size: 13px; color: #666; margin-bottom: 3px;">⏱️ عدد الأيام المستغرقة</div>
          <div style="font-size: 16px; font-weight: bold; color: #333;">${duration}</div>
        </div>
        
        <div style="padding: 12px 15px;">
          <div style="font-size: 13px; color: #666; margin-bottom: 3px;">🔄 عدد مرات التسميع</div>
          <div style="font-size: 16px; font-weight: bold; color: #333;">${attemptCount}</div>
        </div>
      </div>
      
      <button onclick="window.closeJuzDetailsModal()" style="width: 100%; padding: 12px; background: #f5f5f5; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; font-size: 14px;">
        إغلاق
      </button>
    `;
    
  } catch (error) {
    console.error('Error loading Juz details:', error);
    content.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">حدث خطأ في تحميل التفاصيل</p>';
  }
};

// Close Juz details modal
window.closeJuzDetailsModal = function() {
  document.getElementById('studentJuzDetailsModal').style.display = 'none';
};

// Format date for display
function formatDateForDisplay(dateString) {
  if (!dateString) return '-';
  
  try {
    const [year, month, day] = dateString.split('-');
    const hijriMonths = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة',
      'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    const monthName = hijriMonths[parseInt(month) - 1];
    return `${parseInt(day)} ${monthName} ${year} هـ`;
  } catch (err) {
    return dateString;
  }
}

// Save student personal data
window.saveStudentPersonalData = async function() {
  const studentId = sessionStorage.getItem('loggedInStudent');
  
  if (!studentId) {
    console.error('No student logged in');
    return;
  }
  
  const birthDate = document.getElementById('studentEditBirthDate').value;
  const guardianPhone = document.getElementById('studentEditGuardianPhone').value.trim();
  const statusDiv = document.getElementById('studentPersonalDataSaveStatus');
  
  // Validation
  if (!birthDate) {
    statusDiv.style.color = '#dc3545';
    statusDiv.textContent = '❌ الرجاء إدخال تاريخ الميلاد';
    return;
  }
  
  if (!guardianPhone) {
    statusDiv.style.color = '#dc3545';
    statusDiv.textContent = '❌ الرجاء إدخال رقم جوال ولي الأمر';
    return;
  }
  
  // Validate phone format (10 digits)
  if (!/^[0-9]{10}$/.test(guardianPhone)) {
    statusDiv.style.color = '#dc3545';
    statusDiv.textContent = '❌ رقم الجوال يجب أن يكون 10 أرقام';
    return;
  }
  
  try {
    statusDiv.style.color = '#667eea';
    statusDiv.textContent = '⏳ جاري الحفظ...';
    
    // Calculate age from birth date
    const birthDateObj = new Date(birthDate);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = todayDate.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDateObj.getDate())) {
      age--;
    }
    
    // Update Firebase
    await updateDoc(doc(db, 'users', studentId), {
      birthDate: birthDate,
      guardianPhone: guardianPhone,
      age: age
    });
    
    statusDiv.style.color = '#28a745';
    statusDiv.textContent = '✅ تم الحفظ بنجاح!';
    
    // Update age display
    document.getElementById('studentPersonalAge').textContent = `${age} سنة`;
    
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
    
  } catch (error) {
    console.error('Error saving data:', error);
    statusDiv.style.color = '#dc3545';
    statusDiv.textContent = '❌ حدث خطأ أثناء الحفظ';
  }
};


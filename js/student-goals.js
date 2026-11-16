// Student Goals System - نظام أهداف الطلاب الشهرية
// قسم ضمن صفحة العارض > المزيد: تحديد أهداف شهرية للطلاب، متابعة تحقيقها،
// التخطيط للأشهر القادمة، وقياس نسبة الإنجاز (صفحات أو نسبة يدوية).
// البيانات في مجموعة studentGoals بمعرف {studentId}_{السنة}-{الشهر} لمنع التكرار.

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
  serverTimestamp
} from '../firebase-config.js';

import { getCurrentHijriDate } from './hijri-date.js';

// ============ State ============
let goalsClasses = [];        // [{classId, teacherName, className}]
let goalsStudents = [];       // [{id, name, classId}]
let goalsCache = [];          // goals of currently selected month
let goalsBaseLoaded = false;
let goalsCurrentMonthKey = ''; // "YYYY-MM" currently selected in dashboard

const HIJRI_MONTH_NAMES = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

// ============ Hijri month utilities ============

/** Current Hijri month as {year, month} */
function getCurrentHijriMonth() {
  const today = getCurrentHijriDate(); // {hijriDay, hijriMonth, hijriYear}
  return { year: today.hijriYear, month: today.hijriMonth };
}

/** "1447-6" style key (no zero padding, consistent with parseInt round-trips) */
function monthKey(year, month) {
  return `${year}-${month}`;
}

function parseMonthKey(key) {
  const [y, m] = String(key).split('-').map(Number);
  return { year: y, month: m };
}

/** Add n months to {year, month} (handles year overflow) */
function addHijriMonths({ year, month }, n) {
  let total = year * 12 + (month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** Arabic label e.g. "جمادى الآخرة 1447" */
function monthLabel(year, month) {
  return `${HIJRI_MONTH_NAMES[month - 1]} ${year}`;
}

/** Compare month keys: -1 past, 0 current, +1 future (relative to today) */
function compareToCurrentMonth(year, month) {
  const cur = getCurrentHijriMonth();
  const a = year * 12 + month;
  const b = cur.year * 12 + cur.month;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Build month options: 6 months back → 8 months forward */
function buildMonthOptions() {
  const cur = getCurrentHijriMonth();
  const options = [];
  for (let i = -6; i <= 8; i++) {
    const m = addHijriMonths(cur, i);
    options.push({ key: monthKey(m.year, m.month), label: monthLabel(m.year, m.month), offset: i });
  }
  return options;
}

// ============ Goal status logic ============

/**
 * Determine goal status.
 * planned: future month | in_progress: current month, not evaluated
 * pending_followup: past month, not evaluated (stays until supervisor evaluates)
 * achieved: 100% | partial: 50-99% | not_achieved: <50%
 */
function getGoalStatus(goal) {
  if (goal.evaluated) {
    const p = goal.percentage || 0;
    if (p >= 100) return 'achieved';
    if (p >= 50) return 'partial';
    return 'not_achieved';
  }
  const rel = compareToCurrentMonth(goal.hijriYear, goal.hijriMonth);
  if (rel > 0) return 'planned';
  if (rel === 0) return 'in_progress';
  return 'pending_followup';
}

const GOAL_STATUS_META = {
  planned:          { label: 'مخطط',             color: '#6c757d', bg: '#f1f3f5' },
  in_progress:      { label: 'قيد التقدم',       color: '#1976D2', bg: '#e3f2fd' },
  pending_followup: { label: 'لم تُسجل متابعة',  color: '#b26a00', bg: '#fff3e0' },
  achieved:         { label: 'تحقق',             color: '#1b7a3d', bg: '#e8f5e9' },
  partial:          { label: 'تحقق جزئياً',      color: '#8a6d00', bg: '#fffde7' },
  not_achieved:     { label: 'لم يتحقق',         color: '#c62828', bg: '#fdecea' },
  no_goal:          { label: 'بدون هدف',         color: '#868e96', bg: '#f8f9fa' }
};

/**
 * Format start lesson for display.
 * Auto-derived (chained from previous month's goal) values are marked "متوقع".
 */
function formatStartLesson(goal) {
  if (!goal.startLesson) return '—';
  return goal.startLessonAuto ? `متوقع: ${goal.startLesson}` : goal.startLesson;
}

// ============ Data loading ============

/** Load classes + students once (cached) */
async function loadGoalsBaseData(forceReload = false) {
  if (goalsBaseLoaded && !forceReload) return;

  // Classes (حلقات) with teacher names
  const classesSnapshot = await getDocs(collection(db, 'classes'));
  goalsClasses = [];
  classesSnapshot.forEach(classDoc => {
    const data = classDoc.data();
    const classId = data.classId || classDoc.id;
    goalsClasses.push({
      classId,
      teacherName: data.teacherName || data.className || classId,
      className: data.className || classId
    });
  });
  goalsClasses.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ar'));

  // Students
  const studentsSnapshot = await getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'student')
  ));
  goalsStudents = [];
  studentsSnapshot.forEach(sDoc => {
    const s = sDoc.data();
    goalsStudents.push({ id: sDoc.id, name: s.name || sDoc.id, classId: s.classId || '' });
  });
  goalsStudents.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  goalsBaseLoaded = true;
  console.log(`✅ Goals base data: ${goalsClasses.length} classes, ${goalsStudents.length} students`);
}

/** Load all goals for a given month key into goalsCache */
async function loadGoalsForMonth(key) {
  const { year, month } = parseMonthKey(key);
  const snapshot = await getDocs(query(
    collection(db, 'studentGoals'),
    where('hijriYear', '==', year),
    where('hijriMonth', '==', month)
  ));
  goalsCache = [];
  snapshot.forEach(gDoc => goalsCache.push({ id: gDoc.id, ...gDoc.data() }));
  goalsCurrentMonthKey = key;
  console.log(`✅ Loaded ${goalsCache.length} goals for ${key}`);
}

function teacherNameForClass(classId) {
  return goalsClasses.find(c => c.classId === classId)?.teacherName || classId || 'غير محدد';
}

// ============ Entry point ============

window.initStudentGoals = async function() {
  console.log('🎯 Initializing Student Goals section...');
  const listContainer = document.getElementById('goalsStudentsList');

  try {
    showGoalsDashboardView();

    if (listContainer) {
      listContainer.innerHTML = '<div class="content-card"><p style="text-align: center; color: #999; padding: 30px;">جاري تحميل بيانات الأهداف...</p></div>';
    }

    await loadGoalsBaseData();

    const cur = getCurrentHijriMonth();
    const key = goalsCurrentMonthKey || monthKey(cur.year, cur.month);
    await loadGoalsForMonth(key);

    renderGoalsFilters();
    renderGoalsDashboard();

  } catch (error) {
    console.error('Error initializing student goals:', error);
    if (listContainer) {
      listContainer.innerHTML = '<div class="content-card"><p style="text-align: center; color: #dc3545; padding: 30px;">حدث خطأ في تحميل قسم الأهداف</p></div>';
    }
  }
};

/** Switch to dashboard view (hide profile view) */
function showGoalsDashboardView() {
  const dash = document.getElementById('goalsDashboardView');
  const profile = document.getElementById('goalsProfileView');
  if (dash) dash.style.display = 'block';
  if (profile) profile.style.display = 'none';
}

// ============ Rendering (dashboard shell - Phase 2 fills stats/list) ============

function renderGoalsFilters() {
  const panel = document.getElementById('goalsFiltersPanel');
  if (!panel) return;

  const monthOptions = buildMonthOptions();
  const selStyle = 'width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; background: white; box-sizing: border-box;';

  let classOpts = '<option value="">كل الحلقات</option>';
  goalsClasses.forEach(c => {
    classOpts += `<option value="${c.classId}">${c.teacherName}</option>`;
  });

  let monthOpts = '';
  monthOptions.forEach(m => {
    const selected = m.key === goalsCurrentMonthKey ? 'selected' : '';
    const marker = m.offset === 0 ? ' (الشهر الحالي)' : '';
    monthOpts += `<option value="${m.key}" ${selected}>${m.label}${marker}</option>`;
  });

  panel.innerHTML = `
    <div class="content-card" style="padding: 15px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div>
          <label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">الشهر الهجري</label>
          <select id="goalsMonthFilter" style="${selStyle}" onchange="window.onGoalsMonthChange()">${monthOpts}</select>
        </div>
        <div>
          <label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">الحلقة</label>
          <select id="goalsClassFilter" style="${selStyle}" onchange="window.onGoalsFilterChange()">${classOpts}</select>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div>
          <label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">حالة الهدف</label>
          <select id="goalsStatusFilter" style="${selStyle}" onchange="window.onGoalsFilterChange()">
            <option value="">كل الحالات</option>
            <option value="planned">مخطط</option>
            <option value="in_progress">قيد التقدم</option>
            <option value="pending_followup">لم تُسجل متابعة</option>
            <option value="achieved">تحقق</option>
            <option value="partial">تحقق جزئياً</option>
            <option value="not_achieved">لم يتحقق</option>
            <option value="no_goal">بدون هدف</option>
          </select>
        </div>
        <div>
          <label style="font-size: 12px; color: #666; display: block; margin-bottom: 4px;">بحث باسم الطالب</label>
          <input id="goalsSearchInput" type="text" placeholder="اكتب اسم الطالب..." style="${selStyle}" oninput="window.onGoalsFilterChange()">
        </div>
      </div>
    </div>
  `;
}

window.onGoalsMonthChange = async function() {
  const key = document.getElementById('goalsMonthFilter')?.value;
  if (!key) return;
  const listContainer = document.getElementById('goalsStudentsList');
  if (listContainer) {
    listContainer.innerHTML = '<div class="content-card"><p style="text-align: center; color: #999; padding: 30px;">جاري التحميل...</p></div>';
  }
  await loadGoalsForMonth(key);
  renderGoalsDashboard();
};

window.onGoalsFilterChange = function() {
  renderGoalsDashboard();
};

/** Sort mode for the students list */
let goalsSortMode = 'percent_desc';

window.setGoalsSort = function(mode) {
  goalsSortMode = mode;
  renderGoalsDashboard();
};

/**
 * Build dashboard rows: one row per student (goal attached if exists for the month).
 * Class filter applies to both stats and list; status/search filters apply to list only.
 */
function buildGoalRows() {
  const classFilter = document.getElementById('goalsClassFilter')?.value || '';
  
  const goalByStudent = new Map();
  goalsCache.forEach(g => goalByStudent.set(g.studentId, g));
  
  let rows = goalsStudents.map(s => {
    const goal = goalByStudent.get(s.id) || null;
    return { student: s, goal, status: goal ? getGoalStatus(goal) : 'no_goal' };
  });
  
  if (classFilter) rows = rows.filter(r => r.student.classId === classFilter);
  return rows;
}

/** Compute month statistics from class-filtered rows */
function computeGoalStats(rows) {
  const withGoals = rows.filter(r => r.goal);
  const evaluated = withGoals.filter(r => r.goal.evaluated);
  
  const count = (status) => withGoals.filter(r => r.status === status).length;
  
  const avgPercentage = evaluated.length > 0
    ? Math.round(evaluated.reduce((sum, r) => sum + (r.goal.percentage || 0), 0) / evaluated.length)
    : null;
  
  const sortedByPct = [...evaluated].sort((a, b) => (b.goal.percentage || 0) - (a.goal.percentage || 0));
  
  return {
    totalStudents: rows.length,
    totalGoals: withGoals.length,
    achieved: count('achieved'),
    partial: count('partial'),
    notAchieved: count('not_achieved'),
    pendingFollowup: count('pending_followup'),
    inProgress: count('in_progress'),
    planned: count('planned'),
    noGoal: rows.length - withGoals.length,
    avgPercentage,
    topStudents: sortedByPct.slice(0, 3),
    bottomStudents: sortedByPct.length > 3 ? sortedByPct.slice(-3).reverse() : []
  };
}

/** Render the stats panel */
function renderGoalsStatsPanel(stats, isFutureMonth) {
  const panel = document.getElementById('goalsStatsPanel');
  if (!panel) return;
  
  const card = (label, value, color) => `
    <div style="background: white; border-radius: 10px; padding: 12px 8px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.08); border-top: 3px solid ${color};">
      <div style="font-size: 20px; font-weight: bold; color: ${color};">${value}</div>
      <div style="font-size: 11px; color: #777; margin-top: 2px;">${label}</div>
    </div>
  `;
  
  let cardsHTML;
  if (isFutureMonth) {
    // Future month: only planning-related stats
    cardsHTML = `
      ${card('أهداف مخططة', stats.totalGoals, '#6c757d')}
      ${card('بدون هدف', stats.noGoal, '#adb5bd')}
      ${card('إجمالي الطلاب', stats.totalStudents, '#1976D2')}
    `;
  } else {
    cardsHTML = `
      ${card('لديهم أهداف', stats.totalGoals, '#1976D2')}
      ${card('تحقق', stats.achieved, '#1b7a3d')}
      ${card('جزئي', stats.partial, '#8a6d00')}
      ${card('لم يتحقق', stats.notAchieved, '#c62828')}
      ${card('بدون متابعة', stats.pendingFollowup + stats.inProgress, '#b26a00')}
      ${card('متوسط الإنجاز', stats.avgPercentage !== null ? stats.avgPercentage + '%' : '—', '#764ba2')}
    `;
  }
  
  // Top/bottom achievers (evaluated goals only)
  let achieversHTML = '';
  if (!isFutureMonth && stats.topStudents.length > 0) {
    const nameOf = (r) => extractGoalArabicName(r.student.name);
    const topList = stats.topStudents.map(r => `${nameOf(r)} (${r.goal.percentage || 0}%)`).join('، ');
    const bottomList = stats.bottomStudents.map(r => `${nameOf(r)} (${r.goal.percentage || 0}%)`).join('، ');
    
    achieversHTML = `
      <div style="display: grid; grid-template-columns: ${stats.bottomStudents.length > 0 ? '1fr 1fr' : '1fr'}; gap: 8px; margin-top: 8px;">
        <div style="background: #e8f5e9; border-radius: 8px; padding: 8px 10px; font-size: 11px; color: #1b5e20;">
          <strong>الأعلى تحقيقاً:</strong> ${topList}
        </div>
        ${stats.bottomStudents.length > 0 ? `
        <div style="background: #fdecea; border-radius: 8px; padding: 8px 10px; font-size: 11px; color: #7f1d1d;">
          <strong>الأقل تحقيقاً:</strong> ${bottomList}
        </div>` : ''}
      </div>
    `;
  }
  
  panel.innerHTML = `
    <div style="margin-bottom: 12px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        ${cardsHTML}
      </div>
      ${achieversHTML}
    </div>
  `;
}

/** Extract short Arabic name (first two parts) */
function extractGoalArabicName(fullName) {
  if (!fullName) return '';
  const arabicOnly = fullName.replace(/[a-zA-Z0-9ـ_\-|]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = arabicOnly.split(' ').filter(Boolean);
  return parts.slice(0, 2).join(' ') || fullName;
}

/** Render the full dashboard: stats + students list */
function renderGoalsDashboard() {
  const list = document.getElementById('goalsStudentsList');
  if (!list) return;
  
  const { year, month } = parseMonthKey(goalsCurrentMonthKey);
  const isFutureMonth = compareToCurrentMonth(year, month) > 0;
  
  const rows = buildGoalRows();
  const stats = computeGoalStats(rows);
  renderGoalsStatsPanel(stats, isFutureMonth);
  
  // Apply status + search filters to list
  const statusFilter = document.getElementById('goalsStatusFilter')?.value || '';
  const search = (document.getElementById('goalsSearchInput')?.value || '').trim();
  
  let listRows = rows;
  if (statusFilter) listRows = listRows.filter(r => r.status === statusFilter);
  if (search) listRows = listRows.filter(r => r.student.name.includes(search));
  
  // Sort
  const pct = (r) => r.goal && r.goal.evaluated ? (r.goal.percentage || 0) : -1;
  if (goalsSortMode === 'percent_desc') {
    listRows.sort((a, b) => {
      if (!!b.goal !== !!a.goal) return b.goal ? 1 : -1; // students with goals first
      return pct(b) - pct(a);
    });
  } else if (goalsSortMode === 'percent_asc') {
    listRows.sort((a, b) => {
      if (!!b.goal !== !!a.goal) return b.goal ? 1 : -1;
      return pct(a) - pct(b);
    });
  } else {
    listRows.sort((a, b) => a.student.name.localeCompare(b.student.name, 'ar'));
  }
  
  // Build list HTML
  const monthTitle = monthLabel(year, month);
  
  let itemsHTML = '';
  if (listRows.length === 0) {
    itemsHTML = '<p style="text-align: center; color: #999; padding: 30px;">لا توجد نتائج مطابقة للتصفية</p>';
  } else {
    listRows.forEach(r => {
      const meta = GOAL_STATUS_META[r.status];
      const name = extractGoalArabicName(r.student.name);
      const teacher = teacherNameForClass(r.student.classId);
      
      // Goal summary line
      let goalLine = '';
      let progressHTML = '';
      
      if (r.goal) {
        goalLine = `<div style="font-size: 12px; color: #555; margin-top: 3px;">الهدف: ${r.goal.goalText || '—'}</div>`;
        
        if (r.goal.evaluated) {
          const p = Math.min(r.goal.percentage || 0, 100);
          const barColor = p >= 100 ? '#1b7a3d' : p >= 50 ? '#f0a500' : '#c62828';
          const pagesInfo = (r.goal.requiredPages > 0)
            ? `<span style="font-size: 11px; color: #777;">${r.goal.completedPages || 0}/${r.goal.requiredPages} صفحة${r.goal.extraPages > 0 ? ` (+${r.goal.extraPages})` : ''}</span>`
            : '';
          progressHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
              <div style="flex: 1; height: 8px; background: #eee; border-radius: 4px; overflow: hidden;">
                <div style="width: ${p}%; height: 100%; background: ${barColor}; border-radius: 4px; transition: width 0.3s;"></div>
              </div>
              <span style="font-size: 12px; font-weight: bold; color: ${barColor}; min-width: 38px; text-align: left;">${r.goal.percentage || 0}%</span>
              ${pagesInfo}
            </div>
          `;
        } else if (r.goal.requiredPages > 0) {
          goalLine += `<div style="font-size: 11px; color: #999;">المطلوب: ${r.goal.requiredPages} صفحة</div>`;
        }
      } else {
        goalLine = '<div style="font-size: 12px; color: #bbb; margin-top: 3px;">لم يُسجل هدف لهذا الشهر</div>';
      }
      
      itemsHTML += `
        <div onclick="window.openGoalStudentProfile('${r.student.id}')" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#f8f9ff'" onmouseout="this.style.background='white'">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: bold; font-size: 14px; color: #333;">${name}</div>
              <div style="font-size: 11px; color: #999;">${teacher}</div>
              ${goalLine}
              ${progressHTML}
            </div>
            <span style="padding: 4px 10px; background: ${meta.bg}; color: ${meta.color}; border-radius: 12px; font-size: 11px; font-weight: bold; white-space: nowrap; flex-shrink: 0;">${meta.label}</span>
          </div>
        </div>
      `;
    });
  }
  
  list.innerHTML = `
    <div class="content-card" style="padding: 0; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 2px solid #f0f0f0; flex-wrap: wrap; gap: 8px;">
        <div style="font-weight: bold; font-size: 14px; color: #333;">طلاب شهر ${monthTitle} <span style="color: #999; font-weight: normal; font-size: 12px;">(${listRows.length})</span></div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button id="goalsExportBtn" onclick="window.exportGoalsReport()" style="padding: 6px 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; font-family: inherit;">تقرير الشهر</button>
          <select onchange="window.setGoalsSort(this.value)" style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; font-family: inherit; background: white;">
            <option value="percent_desc" ${goalsSortMode === 'percent_desc' ? 'selected' : ''}>النسبة: الأعلى أولاً</option>
            <option value="percent_asc" ${goalsSortMode === 'percent_asc' ? 'selected' : ''}>النسبة: الأدنى أولاً</option>
            <option value="name" ${goalsSortMode === 'name' ? 'selected' : ''}>الاسم أبجدياً</option>
          </select>
        </div>
      </div>
      <div style="max-height: 60vh; overflow-y: auto; background: white;">
        ${itemsHTML}
      </div>
    </div>
  `;
}

// ============ Student Goal Profile (Phase 3) ============

let currentProfileStudentId = null;
let currentProfileGoals = [];

/** Load all goals of one student, sorted chronologically */
async function loadStudentGoals(studentId) {
  const snapshot = await getDocs(query(
    collection(db, 'studentGoals'),
    where('studentId', '==', studentId)
  ));
  const goals = [];
  snapshot.forEach(gDoc => goals.push({ id: gDoc.id, ...gDoc.data() }));
  goals.sort((a, b) => (a.hijriYear * 12 + a.hijriMonth) - (b.hijriYear * 12 + b.hijriMonth));
  return goals;
}

/** Who is performing the action (for createdBy/updatedBy) */
function goalsActorId() {
  return sessionStorage.getItem('loggedInViewer') || 'viewer';
}

/** Deviation from plan: sum(required) - sum(completed) across evaluated page-based goals */
function computeGoalDeviation(goals) {
  const evaluated = goals.filter(g => g.evaluated && (g.requiredPages || 0) > 0);
  if (evaluated.length === 0) return null;
  const required = evaluated.reduce((s, g) => s + (g.requiredPages || 0), 0);
  const completed = evaluated.reduce((s, g) => s + (g.completedPages || 0), 0);
  return { required, completed, diff: required - completed, monthsCount: evaluated.length };
}

/** Open full student goal profile */
window.openGoalStudentProfile = async function(studentId) {
  const dash = document.getElementById('goalsDashboardView');
  const profile = document.getElementById('goalsProfileView');
  if (!profile) return;
  
  if (dash) dash.style.display = 'none';
  profile.style.display = 'block';
  profile.innerHTML = '<div class="content-card"><p style="text-align: center; color: #999; padding: 30px;">جاري تحميل ملف الطالب...</p></div>';
  
  try {
    const student = goalsStudents.find(s => s.id === studentId);
    if (!student) {
      profile.innerHTML = '<div class="content-card"><p style="text-align: center; color: #dc3545; padding: 30px;">الطالب غير موجود</p></div>';
      return;
    }
    
    currentProfileStudentId = studentId;
    currentProfileGoals = await loadStudentGoals(studentId);
    
    renderGoalProfile(student, currentProfileGoals);
    
  } catch (error) {
    console.error('Error opening student goal profile:', error);
    profile.innerHTML = '<div class="content-card"><p style="text-align: center; color: #dc3545; padding: 30px;">حدث خطأ في تحميل ملف الطالب</p></div>';
  }
};

/** Render the profile view */
function renderGoalProfile(student, goals) {
  const profile = document.getElementById('goalsProfileView');
  if (!profile) return;
  
  const name = extractGoalArabicName(student.name);
  const teacher = teacherNameForClass(student.classId);
  
  // Deviation indicator
  const dev = computeGoalDeviation(goals);
  let deviationHTML = '';
  if (dev) {
    let devText, devColor, devBg;
    if (dev.diff > 0) {
      devText = `متأخر عن الخطة بـ ${dev.diff} صفحة`;
      devColor = '#c62828'; devBg = '#fdecea';
    } else if (dev.diff < 0) {
      devText = `متقدم على الخطة بـ ${Math.abs(dev.diff)} صفحة`;
      devColor = '#1b7a3d'; devBg = '#e8f5e9';
    } else {
      devText = 'يسير وفق الخطة تماماً';
      devColor = '#1b7a3d'; devBg = '#e8f5e9';
    }
    deviationHTML = `
      <div style="background: ${devBg}; border-radius: 10px; padding: 12px 15px; margin-bottom: 12px; border-right: 4px solid ${devColor};">
        <div style="font-weight: bold; font-size: 14px; color: ${devColor};">${devText}</div>
        <div style="font-size: 11px; color: #777; margin-top: 3px;">
          إجمالي المطلوب في الأشهر المقيّمة (${dev.monthsCount}): ${dev.required} صفحة — المنجز: ${dev.completed} صفحة
        </div>
      </div>
    `;
  }
  
  // History table rows
  let rowsHTML = '';
  if (goals.length === 0) {
    rowsHTML = '<tr><td colspan="7" style="text-align: center; color: #999; padding: 25px;">لا توجد أهداف مسجلة لهذا الطالب</td></tr>';
  } else {
    goals.forEach((g, idx) => {
      const status = getGoalStatus(g);
      const meta = GOAL_STATUS_META[status];
      const isCurrent = compareToCurrentMonth(g.hijriYear, g.hijriMonth) === 0;
      const rowBg = isCurrent ? '#f0f4ff' : (idx % 2 === 0 ? '#fafafa' : 'white');
      const pctText = g.evaluated ? `${g.percentage || 0}%` : '—';
      const completedText = g.evaluated
        ? `${g.completedPages || 0}${g.extraPages > 0 ? ` (+${g.extraPages})` : ''}`
        : '—';
      
      rowsHTML += `
        <tr onclick="window.showGoalActions('${g.id}')" style="background: ${rowBg}; cursor: pointer;" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='${rowBg}'">
          <td style="padding: 9px 6px; font-weight: bold; white-space: nowrap;">${monthLabel(g.hijriYear, g.hijriMonth)}${isCurrent ? ' •' : ''}</td>
          <td style="padding: 9px 6px; color: ${g.startLessonAuto ? '#999' : '#555'}; ${g.startLessonAuto ? 'font-style: italic;' : ''}">${formatStartLesson(g)}</td>
          <td style="padding: 9px 6px; color: #333;">${g.goalText || '—'}</td>
          <td style="padding: 9px 6px; text-align: center;">${g.requiredPages || '—'}</td>
          <td style="padding: 9px 6px; text-align: center;">${completedText}</td>
          <td style="padding: 9px 6px; text-align: center; font-weight: bold;">${pctText}</td>
          <td style="padding: 9px 6px; text-align: center;">
            <span style="padding: 3px 8px; background: ${meta.bg}; color: ${meta.color}; border-radius: 10px; font-size: 10px; font-weight: bold; white-space: nowrap;">${meta.label}</span>
          </td>
        </tr>
      `;
    });
  }
  
  profile.innerHTML = `
    <div class="content-card" style="padding: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3 style="margin: 0; font-size: 17px; color: #333;">${name}</h3>
          <div style="font-size: 12px; color: #999;">${teacher}</div>
        </div>
        <button onclick="window.backToGoalsDashboard()" style="padding: 8px 16px; background: #f0f0f0; color: #555; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer;">العودة للوحة</button>
      </div>
      
      ${deviationHTML}
      
      <div style="display: flex; gap: 8px; margin-bottom: 15px;">
        <button onclick="window.showGoalForm('${student.id}')" style="flex: 1; padding: 11px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer;">هدف جديد</button>
        <button onclick="window.showGoalPlanningForm('${student.id}')" style="flex: 1; padding: 11px; background: white; color: #667eea; border: 2px solid #667eea; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer;">تخطيط عدة أشهر</button>
      </div>
      
      <div style="font-weight: bold; font-size: 13px; color: #333; margin-bottom: 6px;">سجل الأهداف الشهرية</div>
      <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table style="width: 100%; min-width: 620px; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f5f6fa; color: #555;">
              <th style="padding: 8px 6px; text-align: right;">الشهر</th>
              <th style="padding: 8px 6px; text-align: right;">الدرس عند البداية</th>
              <th style="padding: 8px 6px; text-align: right;">الهدف</th>
              <th style="padding: 8px 6px; text-align: center;">المطلوب</th>
              <th style="padding: 8px 6px; text-align: center;">المنجز</th>
              <th style="padding: 8px 6px; text-align: center;">النسبة</th>
              <th style="padding: 8px 6px; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <div style="font-size: 11px; color: #bbb; margin-top: 6px;">اضغط على أي شهر لتعديل الهدف أو تسجيل المتابعة</div>
    </div>
  `;
}

// ============ Goal form (new / edit) ============

/** Generic modal helper */
function openGoalsModal(id, innerHTML, maxWidth = 440) {
  document.getElementById(id)?.remove();
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center;
    align-items: center; z-index: 10000; backdrop-filter: blur(3px);
  `;
  const popup = document.createElement('div');
  popup.style.cssText = `
    background: white; border-radius: 12px; padding: 20px;
    width: 92%; max-width: ${maxWidth}px; max-height: 85vh; overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25); direction: rtl;
  `;
  popup.innerHTML = innerHTML;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

const GOAL_INPUT_STYLE = 'width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; box-sizing: border-box; background: white;';
const GOAL_LABEL_STYLE = 'font-size: 12px; color: #666; display: block; margin: 10px 0 4px 0;';

/**
 * Show goal form. If goalId provided → edit mode (month locked).
 */
window.showGoalForm = function(studentId, goalId = null) {
  const student = goalsStudents.find(s => s.id === studentId);
  if (!student) return;
  
  const existing = goalId ? currentProfileGoals.find(g => g.id === goalId) : null;
  const isEdit = !!existing;
  
  // Month options: current + 8 future (edit: locked to its month)
  let monthOpts = '';
  if (isEdit) {
    monthOpts = `<option value="${monthKey(existing.hijriYear, existing.hijriMonth)}" selected>${monthLabel(existing.hijriYear, existing.hijriMonth)}</option>`;
  } else {
    const cur = getCurrentHijriMonth();
    for (let i = 0; i <= 8; i++) {
      const m = addHijriMonths(cur, i);
      const key = monthKey(m.year, m.month);
      const taken = currentProfileGoals.some(g => monthKey(g.hijriYear, g.hijriMonth) === key);
      monthOpts += `<option value="${key}" ${taken ? 'disabled' : ''}>${monthLabel(m.year, m.month)}${i === 0 ? ' (الحالي)' : ''}${taken ? ' — مسجل مسبقاً' : ''}</option>`;
    }
  }
  
  openGoalsModal('goalFormModal', `
    <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #333;">${isEdit ? 'تعديل الهدف' : 'هدف جديد'}</h3>
    <div style="font-size: 12px; color: #999; margin-bottom: 8px;">${extractGoalArabicName(student.name)} — ${teacherNameForClass(student.classId)}</div>
    
    <label style="${GOAL_LABEL_STYLE}">الشهر المستهدف</label>
    <select id="goalFormMonth" style="${GOAL_INPUT_STYLE}" ${isEdit ? 'disabled' : ''} onchange="window.suggestGoalStartLesson()">${monthOpts}</select>
    
    <label style="${GOAL_LABEL_STYLE}">الدرس الحالي عند تسجيل الهدف</label>
    <input id="goalFormStartLesson" type="text" placeholder="مثال: نهاية الجزء الرابع / درس 20 نوراني" style="${GOAL_INPUT_STYLE}" value="${existing?.startLesson || ''}" oninput="this.dataset.userEdited='1'">
    
    <label style="${GOAL_LABEL_STYLE}">الهدف المطلوب بنهاية الشهر <span style="color: #c62828;">*</span></label>
    <input id="goalFormText" type="text" placeholder="مثال: إتمام الجزء الخامس" style="${GOAL_INPUT_STYLE}" value="${existing?.goalText || ''}">
    
    <label style="${GOAL_LABEL_STYLE}">عدد الصفحات الجديدة المطلوبة (اختياري — لحساب النسبة تلقائياً)</label>
    <input id="goalFormPages" type="number" min="1" placeholder="مثال: 15" style="${GOAL_INPUT_STYLE}" value="${existing?.requiredPages || ''}">
    
    <label style="${GOAL_LABEL_STYLE}">ملاحظات (اختياري)</label>
    <input id="goalFormNotes" type="text" placeholder="ملاحظات للمعلم..." style="${GOAL_INPUT_STYLE}" value="${existing?.notes || ''}">
    
    <div id="goalFormMsg" style="display: none; margin-top: 10px; padding: 8px 12px; border-radius: 8px; font-size: 12px;"></div>
    
    <div style="display: flex; gap: 8px; margin-top: 15px;">
      <button onclick="window.saveGoalForm('${studentId}', ${isEdit ? `'${existing.id}'` : 'null'})" style="flex: 2; padding: 11px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;">${isEdit ? 'حفظ التعديلات' : 'حفظ الهدف'}</button>
      <button onclick="document.getElementById('goalFormModal').remove()" style="flex: 1; padding: 11px; background: #f0f0f0; color: #555; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">إلغاء</button>
    </div>
  `);
  
  // Auto-suggest start lesson from the previous month's chain (new goals only)
  if (!isEdit) window.suggestGoalStartLesson();
};

/**
 * Suggest start lesson from previous month's goal:
 * actual lesson if evaluated, otherwise the planned goal text.
 * Never overwrites what the supervisor typed manually.
 */
window.suggestGoalStartLesson = function() {
  const input = document.getElementById('goalFormStartLesson');
  const mKey = document.getElementById('goalFormMonth')?.value;
  if (!input || !mKey || input.dataset.userEdited === '1') return;
  
  const { year, month } = parseMonthKey(mKey);
  const prev = addHijriMonths({ year, month }, -1);
  const prevGoal = currentProfileGoals.find(g => g.hijriYear === prev.year && g.hijriMonth === prev.month);
  if (!prevGoal) return;
  
  const suggestion = (prevGoal.evaluated && prevGoal.actualLesson) ? prevGoal.actualLesson : (prevGoal.goalText || '');
  if (suggestion) input.value = suggestion;
};

function showGoalFormMsg(elId, text, isError) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = isError ? '#fdecea' : '#e8f5e9';
  el.style.color = isError ? '#c62828' : '#1b7a3d';
}

/** Save goal (create or edit) */
window.saveGoalForm = async function(studentId, existingDocId = null) {
  try {
    const mKey = document.getElementById('goalFormMonth')?.value;
    const startLesson = document.getElementById('goalFormStartLesson')?.value.trim() || '';
    const goalText = document.getElementById('goalFormText')?.value.trim() || '';
    const pagesRaw = document.getElementById('goalFormPages')?.value;
    const notes = document.getElementById('goalFormNotes')?.value.trim() || '';
    
    if (!mKey) { showGoalFormMsg('goalFormMsg', 'يرجى اختيار الشهر المستهدف', true); return; }
    if (!goalText) { showGoalFormMsg('goalFormMsg', 'يرجى كتابة الهدف المطلوب', true); return; }
    
    const requiredPages = pagesRaw ? parseInt(pagesRaw) : 0;
    if (pagesRaw && (isNaN(requiredPages) || requiredPages < 1)) {
      showGoalFormMsg('goalFormMsg', 'عدد الصفحات غير صحيح', true); return;
    }
    
    const student = goalsStudents.find(s => s.id === studentId);
    const { year, month } = parseMonthKey(mKey);
    const docId = existingDocId || `${studentId}_${year}-${month}`;
    
    if (!existingDocId) {
      // Prevent duplicates
      const existingDoc = await getDoc(doc(db, 'studentGoals', docId));
      if (existingDoc.exists()) {
        showGoalFormMsg('goalFormMsg', 'يوجد هدف مسجل لهذا الطالب في هذا الشهر — يمكنك تعديله من السجل', true);
        return;
      }
    }
    
    const actor = goalsActorId();
    
    // Preserve the "expected" marker only if an auto-derived value was left untouched
    const editedGoal = existingDocId ? currentProfileGoals.find(g => g.id === existingDocId) : null;
    const startLessonAuto = !!(editedGoal?.startLessonAuto && startLesson === (editedGoal.startLesson || ''));
    
    const base = {
      studentId,
      studentName: student?.name || studentId,
      classId: student?.classId || '',
      teacherId: student?.classId || '',
      teacherName: teacherNameForClass(student?.classId),
      hijriYear: year,
      hijriMonth: month,
      startLesson,
      startLessonAuto,
      goalText,
      requiredPages,
      notes,
      updatedAt: serverTimestamp(),
      updatedBy: actor
    };
    
    if (existingDocId) {
      await updateDoc(doc(db, 'studentGoals', docId), base);
    } else {
      await setDoc(doc(db, 'studentGoals', docId), {
        ...base,
        evaluated: false,
        completedPages: 0,
        extraPages: 0,
        percentage: 0,
        manualPercentage: false,
        actualLesson: '',
        followUpNotes: '',
        evaluatedAt: null,
        evaluatedBy: '',
        createdAt: serverTimestamp(),
        createdBy: actor
      });
    }
    
    console.log(`✅ Goal ${existingDocId ? 'updated' : 'created'}: ${docId}`);
    document.getElementById('goalFormModal')?.remove();
    
    // Refresh profile + month cache if affected
    if (mKey === goalsCurrentMonthKey) await loadGoalsForMonth(goalsCurrentMonthKey);
    await window.openGoalStudentProfile(studentId);
    
  } catch (error) {
    console.error('Error saving goal:', error);
    showGoalFormMsg('goalFormMsg', 'خطأ في الحفظ: ' + error.message, true);
  }
};

// ============ Multi-month planning ============

/** Show bulk future planning form (3/5/6 months ahead) */
window.showGoalPlanningForm = function(studentId) {
  const student = goalsStudents.find(s => s.id === studentId);
  if (!student) return;
  
  openGoalsModal('goalPlanningModal', `
    <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #333;">تخطيط أهداف عدة أشهر</h3>
    <div style="font-size: 12px; color: #999; margin-bottom: 8px;">${extractGoalArabicName(student.name)} — تخطيط مسار الطالب للأشهر القادمة</div>
    
    <label style="${GOAL_LABEL_STYLE}">عدد الأشهر (بدءاً من الشهر الحالي)</label>
    <select id="goalPlanMonthsCount" style="${GOAL_INPUT_STYLE}" onchange="window.renderGoalPlanRows('${studentId}')">
      <option value="3">3 أشهر</option>
      <option value="5">5 أشهر</option>
      <option value="6">6 أشهر</option>
    </select>
    
    <div id="goalPlanRows" style="margin-top: 10px;"></div>
    
    <div id="goalPlanMsg" style="display: none; margin-top: 10px; padding: 8px 12px; border-radius: 8px; font-size: 12px;"></div>
    
    <div style="display: flex; gap: 8px; margin-top: 15px;">
      <button onclick="window.saveGoalPlanning('${studentId}')" style="flex: 2; padding: 11px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;">حفظ الخطة</button>
      <button onclick="document.getElementById('goalPlanningModal').remove()" style="flex: 1; padding: 11px; background: #f0f0f0; color: #555; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">إلغاء</button>
    </div>
  `, 500);
  
  window.renderGoalPlanRows(studentId);
};

/** Render planning rows based on selected months count */
window.renderGoalPlanRows = function(studentId) {
  const container = document.getElementById('goalPlanRows');
  if (!container) return;
  
  const count = parseInt(document.getElementById('goalPlanMonthsCount')?.value || '3');
  const cur = getCurrentHijriMonth();
  
  let rowsHTML = '';
  for (let i = 0; i < count; i++) {
    const m = addHijriMonths(cur, i);
    const key = monthKey(m.year, m.month);
    const taken = currentProfileGoals.some(g => monthKey(g.hijriYear, g.hijriMonth) === key);
    
    if (taken) {
      rowsHTML += `
        <div style="background: #f8f9fa; border-radius: 8px; padding: 10px; margin-bottom: 8px; opacity: 0.65;">
          <div style="font-weight: bold; font-size: 13px; color: #999;">${monthLabel(m.year, m.month)}${i === 0 ? ' (الحالي)' : ''} — مسجل مسبقاً</div>
        </div>
      `;
    } else {
      rowsHTML += `
        <div style="background: #f8f9ff; border-radius: 8px; padding: 10px; margin-bottom: 8px; border-right: 3px solid #667eea;" data-plan-month="${key}">
          <div style="font-weight: bold; font-size: 13px; color: #333; margin-bottom: 6px;">${monthLabel(m.year, m.month)}${i === 0 ? ' (الحالي)' : ''}</div>
          ${i === 0
            ? `<input type="text" class="goal-plan-start" placeholder="الدرس الحالي للطالب الآن (مثال: نهاية الجزء الرابع)" style="${GOAL_INPUT_STYLE} margin-bottom: 6px;">`
            : `<div style="font-size: 11px; color: #8a93a8; margin-bottom: 6px;">البداية المتوقعة: تُشتق تلقائياً من هدف الشهر السابق</div>`}
          <input type="text" class="goal-plan-text" placeholder="الهدف (مثال: إتمام الجزء السادس)" style="${GOAL_INPUT_STYLE} margin-bottom: 6px;">
          <input type="number" class="goal-plan-pages" min="1" placeholder="عدد الصفحات المطلوبة (اختياري)" style="${GOAL_INPUT_STYLE}">
        </div>
      `;
    }
  }
  
  container.innerHTML = rowsHTML;
};

/** Save planning: creates a goal doc per filled month */
window.saveGoalPlanning = async function(studentId) {
  try {
    const rows = document.querySelectorAll('#goalPlanRows [data-plan-month]');
    const student = goalsStudents.find(s => s.id === studentId);
    const actor = goalsActorId();
    
    // Chain source: month key → lesson text (existing goals: actual if evaluated, else goal text)
    const chainTextByKey = new Map();
    currentProfileGoals.forEach(g => {
      chainTextByKey.set(
        monthKey(g.hijriYear, g.hijriMonth),
        (g.evaluated && g.actualLesson) ? g.actualLesson : (g.goalText || '')
      );
    });
    
    const toSave = [];
    rows.forEach(row => {
      const key = row.getAttribute('data-plan-month');
      const goalText = row.querySelector('.goal-plan-text')?.value.trim() || '';
      const pagesRaw = row.querySelector('.goal-plan-pages')?.value;
      const manualStart = row.querySelector('.goal-plan-start')?.value.trim() || '';
      if (goalText) {
        chainTextByKey.set(key, goalText);
        toSave.push({ key, goalText, requiredPages: pagesRaw ? parseInt(pagesRaw) || 0 : 0, manualStart });
      }
    });
    
    if (toSave.length === 0) {
      showGoalFormMsg('goalPlanMsg', 'اكتب هدفاً واحداً على الأقل في أحد الأشهر', true);
      return;
    }
    
    for (const item of toSave) {
      const { year, month } = parseMonthKey(item.key);
      const docId = `${studentId}_${year}-${month}`;
      
      // Start lesson: manual for first month, otherwise chained from previous month's goal
      let startLesson = item.manualStart || '';
      let startLessonAuto = false;
      if (!startLesson) {
        const prev = addHijriMonths({ year, month }, -1);
        const derived = chainTextByKey.get(monthKey(prev.year, prev.month)) || '';
        if (derived) {
          startLesson = derived;
          startLessonAuto = true;
        }
      }
      
      await setDoc(doc(db, 'studentGoals', docId), {
        studentId,
        studentName: student?.name || studentId,
        classId: student?.classId || '',
        teacherId: student?.classId || '',
        teacherName: teacherNameForClass(student?.classId),
        hijriYear: year,
        hijriMonth: month,
        startLesson,
        startLessonAuto,
        goalText: item.goalText,
        requiredPages: item.requiredPages,
        notes: '',
        evaluated: false,
        completedPages: 0,
        extraPages: 0,
        percentage: 0,
        manualPercentage: false,
        actualLesson: '',
        followUpNotes: '',
        evaluatedAt: null,
        evaluatedBy: '',
        createdAt: serverTimestamp(),
        createdBy: actor,
        updatedAt: serverTimestamp(),
        updatedBy: actor
      });
    }
    
    console.log(`✅ Planning saved: ${toSave.length} goals for ${studentId}`);
    document.getElementById('goalPlanningModal')?.remove();
    
    await loadGoalsForMonth(goalsCurrentMonthKey);
    await window.openGoalStudentProfile(studentId);
    
  } catch (error) {
    console.error('Error saving planning:', error);
    showGoalFormMsg('goalPlanMsg', 'خطأ في الحفظ: ' + error.message, true);
  }
};

// ============ Goal actions (edit / follow-up / delete) ============

/** Show actions for a goal row */
window.showGoalActions = function(goalDocId) {
  const goal = currentProfileGoals.find(g => g.id === goalDocId);
  if (!goal) return;
  
  const status = getGoalStatus(goal);
  const meta = GOAL_STATUS_META[status];
  const canFollowUp = compareToCurrentMonth(goal.hijriYear, goal.hijriMonth) <= 0;
  
  const btnStyle = 'width: 100%; padding: 11px; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; margin-bottom: 8px;';
  
  openGoalsModal('goalActionsModal', `
    <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #333;">${monthLabel(goal.hijriYear, goal.hijriMonth)}</h3>
    <div style="font-size: 12px; color: #999; margin-bottom: 4px;">${extractGoalArabicName(goal.studentName)}</div>
    <div style="margin-bottom: 12px;">
      <span style="padding: 3px 10px; background: ${meta.bg}; color: ${meta.color}; border-radius: 10px; font-size: 11px; font-weight: bold;">${meta.label}</span>
    </div>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 12px; color: #555;">
      <div><strong>الهدف:</strong> ${goal.goalText || '—'}</div>
      <div style="margin-top: 3px;"><strong>الدرس عند البداية:</strong> ${formatStartLesson(goal)}</div>
      ${goal.requiredPages ? `<div style="margin-top: 3px;"><strong>الصفحات المطلوبة:</strong> ${goal.requiredPages}</div>` : ''}
      ${goal.evaluated ? `<div style="margin-top: 3px;"><strong>المنجز:</strong> ${goal.completedPages || 0} صفحة — <strong>النسبة:</strong> ${goal.percentage || 0}%</div>` : ''}
      ${goal.evaluated && goal.actualLesson ? `<div style="margin-top: 3px;"><strong>الدرس الفعلي:</strong> ${goal.actualLesson}</div>` : ''}
      ${goal.notes ? `<div style="margin-top: 3px;"><strong>ملاحظات:</strong> ${goal.notes}</div>` : ''}
      ${goal.followUpNotes ? `<div style="margin-top: 3px;"><strong>ملاحظات المتابعة:</strong> ${goal.followUpNotes}</div>` : ''}
    </div>
    
    ${canFollowUp ? `<button onclick="document.getElementById('goalActionsModal').remove(); window.showGoalFollowUpForm('${goalDocId}')" style="${btnStyle} background: linear-gradient(135deg, #1b7a3d 0%, #28a745 100%); color: white;">${goal.evaluated ? 'تعديل المتابعة' : 'تسجيل المتابعة'}</button>` : ''}
    <button onclick="document.getElementById('goalActionsModal').remove(); window.showGoalForm('${goal.studentId}', '${goalDocId}')" style="${btnStyle} background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">تعديل الهدف</button>
    <button onclick="window.deleteStudentGoal('${goalDocId}')" style="${btnStyle} background: #fdecea; color: #c62828; border: 2px solid #c62828;">حذف الهدف</button>
    <button onclick="document.getElementById('goalActionsModal').remove()" style="${btnStyle} background: #f0f0f0; color: #555; margin-bottom: 0;">إغلاق</button>
  `);
};

/** Delete a goal (with confirmation) */
window.deleteStudentGoal = async function(goalDocId) {
  const goal = currentProfileGoals.find(g => g.id === goalDocId);
  if (!goal) return;
  
  if (!confirm(`هل أنت متأكد من حذف هدف شهر ${monthLabel(goal.hijriYear, goal.hijriMonth)}؟`)) return;
  
  try {
    await deleteDoc(doc(db, 'studentGoals', goalDocId));
    console.log(`🗑️ Goal deleted: ${goalDocId}`);
    document.getElementById('goalActionsModal')?.remove();
    
    await loadGoalsForMonth(goalsCurrentMonthKey);
    await window.openGoalStudentProfile(goal.studentId);
    
  } catch (error) {
    console.error('Error deleting goal:', error);
    alert('خطأ في حذف الهدف: ' + error.message);
  }
};

// ============ Monthly follow-up (Phase 4) ============

/**
 * Show the follow-up (evaluation) form for a goal.
 * Auto percentage from pages when requiredPages > 0, with optional manual override.
 * Goals without pages use manual percentage only.
 */
window.showGoalFollowUpForm = function(goalDocId) {
  const goal = currentProfileGoals.find(g => g.id === goalDocId);
  if (!goal) return;
  
  const hasPages = (goal.requiredPages || 0) > 0;
  const isReEval = !!goal.evaluated;
  
  // Pre-fill values when editing an existing evaluation
  const prevCompleted = isReEval ? (goal.completedPages || 0) : '';
  const prevPercentage = isReEval ? (goal.percentage || 0) : '';
  const prevManual = isReEval ? !!goal.manualPercentage : !hasPages;
  
  const pagesSection = hasPages ? `
    <label style="${GOAL_LABEL_STYLE}">عدد الصفحات المنجزة (المطلوب: ${goal.requiredPages} صفحة)</label>
    <input id="goalFuPages" type="number" min="0" placeholder="مثال: 12" value="${prevCompleted}"
      style="${GOAL_INPUT_STYLE}" oninput="window.updateGoalFuPreview(${goal.requiredPages})">
    
    <div style="display: flex; align-items: center; gap: 8px; margin-top: 10px;">
      <input id="goalFuManualToggle" type="checkbox" ${prevManual ? 'checked' : ''} onchange="window.toggleGoalFuManual(${goal.requiredPages})" style="width: 16px; height: 16px;">
      <label for="goalFuManualToggle" style="font-size: 12px; color: #666; cursor: pointer;">إدخال نسبة التحقيق يدوياً (تجاوز الحساب التلقائي)</label>
    </div>
  ` : `
    <div style="background: #fff8e1; border-radius: 8px; padding: 8px 12px; margin-top: 10px; font-size: 11px; color: #8a6d00;">
      هذا الهدف غير مرتبط بعدد صفحات — أدخل نسبة التحقيق يدوياً
    </div>
  `;
  
  const manualDisplay = (!hasPages || prevManual) ? 'block' : 'none';
  
  openGoalsModal('goalFollowUpModal', `
    <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #333;">${isReEval ? 'تعديل المتابعة' : 'تسجيل المتابعة'} — ${monthLabel(goal.hijriYear, goal.hijriMonth)}</h3>
    <div style="font-size: 12px; color: #999; margin-bottom: 8px;">${extractGoalArabicName(goal.studentName)} — ${goal.teacherName || ''}</div>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 10px; margin-bottom: 4px; font-size: 12px; color: #555;">
      <div><strong>الهدف:</strong> ${goal.goalText || '—'}</div>
      <div style="margin-top: 3px;"><strong>الدرس عند البداية:</strong> ${formatStartLesson(goal)}</div>
    </div>
    
    <label style="${GOAL_LABEL_STYLE}">الدرس الفعلي الذي وصل إليه الطالب</label>
    <input id="goalFuActualLesson" type="text" placeholder="مثال: منتصف الجزء الخامس" style="${GOAL_INPUT_STYLE}" value="${goal.actualLesson || ''}">
    
    ${pagesSection}
    
    <div id="goalFuManualSection" style="display: ${manualDisplay};">
      <label style="${GOAL_LABEL_STYLE}">نسبة تحقيق الهدف يدوياً (0 - 100)</label>
      <input id="goalFuManualPct" type="number" min="0" max="100" placeholder="مثال: 80" value="${prevManual ? prevPercentage : ''}"
        style="${GOAL_INPUT_STYLE}" oninput="window.updateGoalFuPreview(${goal.requiredPages || 0})">
    </div>
    
    <!-- Live percentage preview -->
    <div style="margin-top: 14px; background: #f8f9ff; border-radius: 10px; padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 12px; color: #666;">نسبة تحقيق الهدف</span>
        <span id="goalFuPctText" style="font-size: 18px; font-weight: bold; color: #667eea;">—</span>
      </div>
      <div style="height: 10px; background: #e9ecef; border-radius: 5px; overflow: hidden;">
        <div id="goalFuPctBar" style="width: 0%; height: 100%; background: #667eea; border-radius: 5px; transition: width 0.3s, background 0.3s;"></div>
      </div>
      <div id="goalFuExtraText" style="font-size: 11px; color: #1b7a3d; margin-top: 5px; display: none;"></div>
    </div>
    
    <label style="${GOAL_LABEL_STYLE}">ملاحظات المتابعة (اختياري)</label>
    <input id="goalFuNotes" type="text" placeholder="ملاحظات المعلم أو المشرف..." style="${GOAL_INPUT_STYLE}" value="${goal.followUpNotes || ''}">
    
    <div id="goalFuMsg" style="display: none; margin-top: 10px; padding: 8px 12px; border-radius: 8px; font-size: 12px;"></div>
    
    <div style="display: flex; gap: 8px; margin-top: 15px;">
      <button onclick="window.saveGoalFollowUp('${goalDocId}')" style="flex: 2; padding: 11px; background: linear-gradient(135deg, #1b7a3d 0%, #28a745 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;">حفظ المتابعة</button>
      <button onclick="document.getElementById('goalFollowUpModal').remove()" style="flex: 1; padding: 11px; background: #f0f0f0; color: #555; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">إلغاء</button>
    </div>
  `, 460);
  
  // Initial preview render
  window.updateGoalFuPreview(goal.requiredPages || 0);
};

/** Toggle manual percentage section */
window.toggleGoalFuManual = function(requiredPages) {
  const manual = document.getElementById('goalFuManualToggle')?.checked;
  const section = document.getElementById('goalFuManualSection');
  if (section) section.style.display = manual ? 'block' : 'none';
  window.updateGoalFuPreview(requiredPages);
};

/** Compute current percentage from form state: {percentage, completedPages, extraPages, manual} */
function readGoalFuState(requiredPages) {
  const hasPages = requiredPages > 0;
  const manualToggle = document.getElementById('goalFuManualToggle');
  const manual = hasPages ? !!manualToggle?.checked : true;
  
  const completedRaw = document.getElementById('goalFuPages')?.value;
  const completedPages = hasPages && completedRaw !== '' && completedRaw !== undefined ? parseInt(completedRaw) : null;
  
  let percentage = null;
  let extraPages = 0;
  
  if (manual) {
    const pctRaw = document.getElementById('goalFuManualPct')?.value;
    if (pctRaw !== '' && pctRaw !== undefined) percentage = parseInt(pctRaw);
    if (hasPages && completedPages !== null && completedPages > requiredPages) {
      extraPages = completedPages - requiredPages;
    }
  } else if (completedPages !== null && !isNaN(completedPages)) {
    percentage = Math.min(100, Math.round((completedPages / requiredPages) * 100));
    extraPages = Math.max(0, completedPages - requiredPages);
  }
  
  return { percentage, completedPages, extraPages, manual, hasPages };
}

/** Update live percentage preview */
window.updateGoalFuPreview = function(requiredPages) {
  const state = readGoalFuState(requiredPages);
  const pctText = document.getElementById('goalFuPctText');
  const pctBar = document.getElementById('goalFuPctBar');
  const extraText = document.getElementById('goalFuExtraText');
  
  if (!pctText || !pctBar) return;
  
  if (state.percentage === null || isNaN(state.percentage)) {
    pctText.textContent = '—';
    pctText.style.color = '#999';
    pctBar.style.width = '0%';
    if (extraText) extraText.style.display = 'none';
    return;
  }
  
  const p = Math.max(0, Math.min(100, state.percentage));
  const color = p >= 100 ? '#1b7a3d' : p >= 50 ? '#f0a500' : '#c62828';
  
  pctText.textContent = p + '%';
  pctText.style.color = color;
  pctBar.style.width = p + '%';
  pctBar.style.background = color;
  
  if (extraText) {
    if (state.extraPages > 0) {
      extraText.textContent = `أنجز ${state.extraPages} صفحة إضافية فوق المطلوب`;
      extraText.style.display = 'block';
    } else {
      extraText.style.display = 'none';
    }
  }
};

/** Save follow-up evaluation */
window.saveGoalFollowUp = async function(goalDocId) {
  try {
    const goal = currentProfileGoals.find(g => g.id === goalDocId);
    if (!goal) return;
    
    const requiredPages = goal.requiredPages || 0;
    const state = readGoalFuState(requiredPages);
    const actualLesson = document.getElementById('goalFuActualLesson')?.value.trim() || '';
    const followUpNotes = document.getElementById('goalFuNotes')?.value.trim() || '';
    
    // Validation
    if (state.manual) {
      if (state.percentage === null || isNaN(state.percentage) || state.percentage < 0 || state.percentage > 100) {
        showGoalFormMsg('goalFuMsg', 'يرجى إدخال نسبة صحيحة من 0 إلى 100', true);
        return;
      }
    } else {
      if (state.completedPages === null || isNaN(state.completedPages) || state.completedPages < 0) {
        showGoalFormMsg('goalFuMsg', 'يرجى إدخال عدد الصفحات المنجزة', true);
        return;
      }
    }
    
    const actor = goalsActorId();
    
    await updateDoc(doc(db, 'studentGoals', goalDocId), {
      evaluated: true,
      actualLesson,
      completedPages: state.hasPages ? (state.completedPages ?? 0) : 0,
      extraPages: state.extraPages,
      percentage: Math.max(0, Math.min(100, state.percentage)),
      manualPercentage: state.manual,
      followUpNotes,
      evaluatedAt: serverTimestamp(),
      evaluatedBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor
    });
    
    console.log(`✅ Follow-up saved for ${goalDocId}: ${state.percentage}%`);
    document.getElementById('goalFollowUpModal')?.remove();
    
    // Auto-chain: propagate the actual lesson to next month's start lesson
    // (only if next month's start is empty or still an auto-derived expectation)
    let chainMsg = '';
    if (actualLesson) {
      const next = addHijriMonths({ year: goal.hijriYear, month: goal.hijriMonth }, 1);
      const nextDocId = `${goal.studentId}_${next.year}-${next.month}`;
      try {
        const nextSnap = await getDoc(doc(db, 'studentGoals', nextDocId));
        if (nextSnap.exists()) {
          const nextData = nextSnap.data();
          if (!nextData.startLesson || nextData.startLessonAuto) {
            await updateDoc(doc(db, 'studentGoals', nextDocId), {
              startLesson: actualLesson,
              startLessonAuto: false,
              updatedAt: serverTimestamp(),
              updatedBy: actor
            });
            chainMsg = `تم تحديث بداية شهر ${monthLabel(next.year, next.month)} تلقائياً إلى: ${actualLesson}`;
            console.log('🔗 ' + chainMsg);
          }
        }
      } catch (chainError) {
        console.warn('Chain update to next month failed:', chainError);
      }
    }
    
    // Refresh caches + views
    if (monthKey(goal.hijriYear, goal.hijriMonth) === goalsCurrentMonthKey) {
      await loadGoalsForMonth(goalsCurrentMonthKey);
    }
    await window.openGoalStudentProfile(goal.studentId);
    
    // Advisory: goal not fully achieved + future goals exist → suggest reviewing the plan
    const finalPct = Math.max(0, Math.min(100, state.percentage));
    const hasFutureGoals = currentProfileGoals.some(g => compareToCurrentMonth(g.hijriYear, g.hijriMonth) > 0);
    
    let notice = '';
    if (chainMsg) notice += chainMsg;
    if (finalPct < 100 && hasFutureGoals) {
      notice += (notice ? '\n\n' : '') + 'الطالب لم يحقق الهدف كاملاً — راجع أهداف الأشهر القادمة وعدّلها حسب مستواه الفعلي';
    }
    if (notice) alert(notice);
    
  } catch (error) {
    console.error('Error saving follow-up:', error);
    showGoalFormMsg('goalFuMsg', 'خطأ في الحفظ: ' + error.message, true);
  }
};

/** Back to dashboard from profile view */
window.backToGoalsDashboard = function() {
  showGoalsDashboardView();
  renderGoalsDashboard();
};

// ============ Monthly report: PDF export + modern sharing (Phase 5) ============

let goalsReportState = null; // { pdfBlob, fileName }

/** Export the current month goals report as an Arabic PDF, then open the share sheet */
window.exportGoalsReport = async function() {
  const btn = document.getElementById('goalsExportBtn');
  
  try {
    const { year, month } = parseMonthKey(goalsCurrentMonthKey);
    const monthTitle = monthLabel(year, month);
    const classFilter = document.getElementById('goalsClassFilter')?.value || '';
    const className = classFilter ? teacherNameForClass(classFilter) : 'جميع الحلقات';
    
    // Rows: students with goals for the month (respecting class filter), sorted by percentage desc
    const rows = buildGoalRows().filter(r => r.goal);
    
    if (rows.length === 0) {
      alert('لا توجد أهداف مسجلة لهذا الشهر لإنشاء التقرير');
      return;
    }
    
    rows.sort((a, b) => {
      const pa = a.goal.evaluated ? (a.goal.percentage || 0) : -1;
      const pb = b.goal.evaluated ? (b.goal.percentage || 0) : -1;
      return pb - pa;
    });
    
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الإنشاء...'; }
    
    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      throw new Error('مكتبات إنشاء PDF غير متاحة — يرجى إعادة تحميل الصفحة');
    }
    
    const stats = computeGoalStats(buildGoalRows());
    
    // Build table rows
    let tableRows = '';
    rows.forEach((r, idx) => {
      const g = r.goal;
      const meta = GOAL_STATUS_META[r.status];
      const pct = g.evaluated ? `${g.percentage || 0}%` : '—';
      const completed = g.evaluated ? `${g.completedPages || 0}${g.extraPages > 0 ? ` (+${g.extraPages})` : ''}` : '—';
      
      tableRows += `
        <tr style="background: ${idx % 2 === 0 ? '#fafbff' : 'white'};">
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; font-weight: bold;">${extractGoalArabicName(r.student.name)}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0;">${teacherNameForClass(r.student.classId)}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; ${g.startLessonAuto ? 'color: #888; font-style: italic;' : ''}">${formatStartLesson(g)}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0;">${g.goalText || '—'}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; text-align: center;">${g.requiredPages || '—'}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; text-align: center;">${completed}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0;">${g.evaluated ? (g.actualLesson || '—') : '—'}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; text-align: center; font-weight: bold;">${pct}</td>
          <td style="padding: 8px 6px; border: 1px solid #e0e0e0; text-align: center;">
            <span style="color: ${meta.color}; font-weight: bold;">${meta.label}</span>
          </td>
        </tr>
      `;
    });
    
    // Hidden A4 container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; top: -10000px; right: 0; width: 1100px;
      background: white; padding: 30px; direction: rtl;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    `;
    
    container.innerHTML = `
      <div style="text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 15px; margin-bottom: 15px;">
        <h1 style="margin: 0 0 6px 0; font-size: 24px; color: #333;">تقرير أهداف الطلاب الشهرية</h1>
        <div style="font-size: 16px; color: #667eea; font-weight: bold;">شهر ${monthTitle} هـ — ${className}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 15px;">
        <div style="flex: 1; background: #f0f4ff; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #1976D2;">${stats.totalGoals}</div>
          <div style="font-size: 11px; color: #666;">لديهم أهداف</div>
        </div>
        <div style="flex: 1; background: #e8f5e9; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #1b7a3d;">${stats.achieved}</div>
          <div style="font-size: 11px; color: #666;">تحقق</div>
        </div>
        <div style="flex: 1; background: #fffde7; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #8a6d00;">${stats.partial}</div>
          <div style="font-size: 11px; color: #666;">تحقق جزئياً</div>
        </div>
        <div style="flex: 1; background: #fdecea; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #c62828;">${stats.notAchieved}</div>
          <div style="font-size: 11px; color: #666;">لم يتحقق</div>
        </div>
        <div style="flex: 1; background: #fff3e0; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #b26a00;">${stats.pendingFollowup + stats.inProgress}</div>
          <div style="font-size: 11px; color: #666;">بدون متابعة</div>
        </div>
        <div style="flex: 1; background: #f3e5f5; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #764ba2;">${stats.avgPercentage !== null ? stats.avgPercentage + '%' : '—'}</div>
          <div style="font-size: 11px; color: #666;">متوسط الإنجاز</div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6; width: 34px;">#</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6;">اسم الطالب</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6;">الحلقة / المعلم</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6;">الدرس عند البداية</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6;">الهدف المطلوب</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6; width: 58px;">المطلوب</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6; width: 58px;">المنجز</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6;">الدرس الفعلي</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6; width: 52px;">النسبة</th>
            <th style="padding: 9px 6px; border: 1px solid #5a6fd6; width: 86px;">الحالة</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      
      <div style="margin-top: 18px; padding-top: 10px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; font-size: 11px; color: #999;">
        <span>نظام إدارة حلقات القرآن — قسم أهداف الطلاب</span>
        <span>تاريخ الإصدار: ${monthTitle} هـ</span>
      </div>
    `;
    
    document.body.appendChild(container);
    await new Promise(resolve => setTimeout(resolve, 250));
    
    const canvas = await window.html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    document.body.removeChild(container);
    
    // Build multi-page A4 landscape PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    const pageWidth = 297;
    const pageHeight = 210;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');
    
    let heightLeft = imgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    const safeClass = className.replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `أهداف_الطلاب_${monthTitle.replace(/\s+/g, '_')}_${safeClass}.pdf`;
    
    goalsReportState = { pdfBlob: pdf.output('blob'), fileName };
    
    console.log('✅ Goals report PDF generated:', fileName);
    showGoalsShareSheet(monthTitle, className, rows.length);
    
  } catch (error) {
    console.error('Error exporting goals report:', error);
    alert('حدث خطأ في إنشاء التقرير: ' + error.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'تقرير الشهر'; }
  }
};

/** Modern bottom-sheet style share dialog */
function showGoalsShareSheet(monthTitle, className, studentsCount) {
  document.getElementById('goalsShareSheet')?.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'goalsShareSheet';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; justify-content: center;
    align-items: flex-end; z-index: 10000; backdrop-filter: blur(3px);
  `;
  
  const canNativeShare = typeof navigator.share === 'function' && typeof File !== 'undefined';
  
  const sheet = document.createElement('div');
  sheet.style.cssText = `
    background: white; border-radius: 18px 18px 0 0; padding: 20px;
    width: 100%; max-width: 480px; direction: rtl;
    box-shadow: 0 -8px 30px rgba(0,0,0,0.2);
    animation: goalsSheetUp 0.28s ease;
  `;
  
  sheet.innerHTML = `
    <style>
      @keyframes goalsSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    </style>
    <div style="width: 40px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto 15px auto;"></div>
    
    <div style="text-align: center; margin-bottom: 15px;">
      <div style="width: 54px; height: 54px; background: #e8f5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1b7a3d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <div style="font-weight: bold; font-size: 16px; color: #333;">التقرير جاهز</div>
      <div style="font-size: 12px; color: #999; margin-top: 3px;">أهداف ${studentsCount} طالب — ${monthTitle} هـ — ${className}</div>
    </div>
    
    ${canNativeShare ? `
    <button onclick="window.shareGoalsReport()" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: bold; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
      مشاركة التقرير
    </button>` : ''}
    
    <button onclick="window.downloadGoalsReport()" style="width: 100%; padding: 14px; background: ${canNativeShare ? 'white' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; color: ${canNativeShare ? '#667eea' : 'white'}; border: ${canNativeShare ? '2px solid #667eea' : 'none'}; border-radius: 12px; font-size: 15px; font-weight: bold; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${canNativeShare ? '#667eea' : 'white'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      تحميل PDF
    </button>
    
    <button onclick="document.getElementById('goalsShareSheet').remove()" style="width: 100%; padding: 12px; background: #f0f0f0; color: #555; border: none; border-radius: 12px; font-size: 14px; cursor: pointer; font-family: inherit;">إغلاق</button>
  `;
  
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/** Share via native share sheet (WhatsApp, Telegram, email... like modern apps) */
window.shareGoalsReport = async function() {
  const { pdfBlob, fileName } = goalsReportState || {};
  if (!pdfBlob) return;
  
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
  
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      document.getElementById('goalsShareSheet')?.remove();
      return;
    } catch (error) {
      if (error.name === 'AbortError') return; // user cancelled the share sheet
      console.warn('Native share failed, falling back to download:', error);
    }
  }
  
  // Fallback: download
  window.downloadGoalsReport();
};

/** Download the generated PDF */
window.downloadGoalsReport = function() {
  const { pdfBlob, fileName } = goalsReportState || {};
  if (!pdfBlob) return;
  
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  
  document.getElementById('goalsShareSheet')?.remove();
};

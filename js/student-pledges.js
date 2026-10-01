import {
  db,
  collection,
  doc,
  deleteDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  startAfter
} from '../firebase-config.js';
import { getTodayAccurateHijri, formatAccurateHijriDate } from './accurate-hijri-dates.js';

const PLEDGE_COLLECTION = 'studentPledges';
const WARNING_COLLECTION = 'verbalWarnings';
const TEACHER_ALERT_COLLECTION = 'teacherAlerts';
const TEACHER_ALERT_TYPES = {
  official_uniform: {
    label: 'الزي الرسمي',
    note: 'الالتزام بالزي الرسمي المعتمد.'
  },
  unauthorized_leave: {
    label: 'الخروج من الحلقة من غير إذن الإدارة',
    note: 'عدم مغادرة الحلقة أو مقر العمل دون إذن الإدارة.'
  },
  late_excuse_notice: {
    label: 'عدم إرسال اعتذار الغياب/التأخير قبل بداية الدوام',
    note: 'إرسال اعتذار الغياب أو التأخير قبل بداية الدوام.'
  },
  prayer_supervision: {
    label: 'عدم الإشراف في أوقات الصلوات',
    note: 'القيام بمهام الإشراف المكلف بها في أوقات الصلوات.'
  },
  unauthorized_activity: {
    label: 'إقامة أنشطة خارجية من غير إذن الإدارة',
    note: 'الحصول على إذن الإدارة قبل إقامة أي نشاط خارجي.'
  },
  unauthorized_plan_change: {
    label: 'تغيير برنامج/خطة الطالب التعليمية من غير الرجوع للإدارة',
    note: 'الرجوع إلى الإدارة قبل تعديل البرنامج أو الخطة التعليمية للطالب.'
  },
  missing_daily_reports: {
    label: 'عدم الالتزام بإرسال التقارير اليومية/التسجيل في الكشوفات والتطبيق',
    note: 'الالتزام بإرسال التقارير اليومية وتسجيل البيانات في الكشوفات والتطبيق.'
  }
};
const PLEDGE_TYPES = {
  absences: {
    label: 'الغيابات',
    title: 'إقرار وتعهد بانتظام طالب في الحلقات',
    notice: 'تكرار غياب ابنه دون عذر مقبول خلال الفترة الماضية',
    impact: 'مما يؤدي إلى ضعف الاستفادة من الحلقات وتأثر مستواه التحصيلي والسلوكي وانتظامه في الحلقة.',
    points: [
      'متابعة انتظام الطالب في الحضور اليومي.',
      'عدم الغياب إلا بسبب مقبول وتقديم العذر الرسمي في حينه.',
      'التعاون مع إدارة الحلقات لما فيه مصلحة الطالب.',
      'العلم بأن تكرار الغياب دون عذر قد يؤدي إلى اتخاذ الإجراءات التربوية والنظامية المتبعة.'
    ]
  },
  lateness: {
    label: 'التأخيرات',
    title: 'إقرار وتعهد بالالتزام بمواعيد الحضور',
    notice: 'تكرار تأخر ابنه عن بداية الحلقة',
    impact: 'مما يؤدي إلى فقدان جزء من وقت الحلقة وضعف الاستفادة من الدرس وتأثر انتظامه.',
    points: ['الالتزام بالحضور في الوقت المحدد.', 'الحرص على عدم تكرار التأخير.', 'التعاون مع إدارة الحلقات.', 'العلم بالإجراءات المتبعة عند تكرار التأخير.']
  },
  phone: {
    label: 'اصطحاب الجوال للحلقات',
    title: 'إقرار وتعهد بعدم اصطحاب الجوال إلى الحلقات',
    notice: 'اصطحاب ابنه للجوال إلى الحلقة، بالمخالفة للتعليمات المعتمدة داخل الحلقات',
    impact: 'مما قد يؤدي إلى انشغاله عن التلاوة والتسميع، وضعف تركيزه، وتأثر مستواه التعليمي وانتظامه في الحلقة.',
    points: ['عدم إحضار الجوال إلى الحلقة.', 'الالتزام بتعليمات إدارة الحلقات.', 'التعاون مع الإدارة والمعلمين.', 'العلم بالإجراءات المتبعة عند تكرار المخالفة.']
  },
  behavior: {
    label: 'الأخلاقيات والسلوكيات',
    title: 'إقرار وتعهد بالالتزام بالآداب والسلوكيات',
    notice: 'وجود ملاحظة تتعلق بسلوك ابنه أو التزامه بالآداب العامة داخل الحلقات',
    impact: 'مما قد يؤثر في بيئة الحلقة وعلاقته بالمعلم والزملاء، ويحد من استفادته التعليمية والتربوية.',
    points: ['الالتزام بالأخلاق والآداب الإسلامية.', 'احترام المعلمين والزملاء.', 'الالتزام بتعليمات الحلقة.', 'الحرص على تحسين السلوك وعدم تكرار الملاحظة.']
  },
  leaving: {
    label: 'الخروج من الحلقة من غير إذن المعلم',
    title: 'إقرار وتعهد بالالتزام بأنظمة الحلقة',
    notice: 'خروج ابنه من الحلقة دون الحصول على إذن المعلم',
    impact: 'مما يخل بانضباط الحلقة، ويعرض الطالب لفقدان المتابعة، ويؤثر في انتظامه واستفادته التعليمية.',
    points: ['عدم مغادرة الحلقة أثناء وقت الدوام إلا بإذن المعلم وفق التعليمات.', 'الالتزام بتوجيهات المعلم وإدارة الحلقات.', 'المحافظة على الانضباط أثناء وقت الحلقة.', 'العلم بالإجراءات المتبعة عند تكرار المخالفة.']
  },
  disruption: {
    label: 'المشاغبة داخل الحلقة',
    title: 'إقرار وتعهد بالانضباط داخل الحلقة',
    notice: 'وجود ملاحظة تتعلق بالمشاغبة أو التشويش داخل الحلقة',
    impact: 'مما يشتت الطالب وزملاءه، ويعطل سير الحلقة، ويؤثر في التحصيل والسلوك والاستفادة من وقت التعليم.',
    points: ['الالتزام بالهدوء والانضباط.', 'عدم التشويش على المعلم أو الطلاب.', 'احترام وقت الحلقة.', 'الحرص على تحسين السلوك وعدم تكرار المشاغبة.']
  },
  cheating: {
    label: 'الغش أثناء التسميع',
    title: 'إقرار وتعهد بالصدق والأمانة في التسميع',
    notice: 'وجود ملاحظة تتعلق بالغش أثناء التسميع',
    impact: 'مما يمنع معرفة مستوى الحفظ الحقيقي، ويضعف استفادته من التوجيه والمراجعة، ويتعارض مع الصدق والأمانة في تعلم كتاب الله.',
    points: ['الالتزام بالصدق والأمانة أثناء التسميع.', 'الاعتماد على الحفظ الفعلي للطالب.', 'عدم استخدام أي وسيلة تساعد على الغش أثناء التسميع.', 'الحرص على تحسين مستوى الطالب والالتزام بتوجيهات المعلم.']
  },
  educational: {
    label: 'ضعف المستوى التعليمي',
    title: 'إقرار وتعهد بالاهتمام بالمستوى التعليمي للطالب',
    notice: 'وجود ضعف في مستوى ابنه التعليمي أو في تقدمه في الحفظ والمراجعة',
    impact: 'مما قد يؤدي إلى تأخره عن الخطة التعليمية وتراكم جوانب الضعف ما لم تتم المتابعة والتعاون مع المعلم.',
    points: ['متابعة الطالب ومراجعته بشكل مستمر.', 'التعاون مع المعلم وإدارة الحلقات.', 'الحرص على الالتزام بالخطة التعليمية المطلوبة.', 'متابعة تحسن مستوى الطالب وعدم إهمال جوانب الضعف.']
  },
  uniform: {
    label: 'الزي الرسمي',
    title: 'إقرار وتعهد بالالتزام بالزي الرسمي للحلقات',
    notice: 'عدم التزام ابنه بالزي الرسمي المعتمد للحلقات، والمتمثل في ارتداء الكوفية أو الطاقية والشماغ',
    impact: 'مما يخالف التعليمات التنظيمية المعتمدة ويسهم في عدم الالتزام بالمظهر الموحد لطلاب الحلقات.',
    points: [
      'الحرص على حضور الطالب مرتديًا الزي الرسمي المعتمد.',
      'التأكد من ارتداء الكوفية أو الطاقية والشماغ قبل الحضور.',
      'التعاون مع إدارة الحلقات والالتزام بتعليماتها المتعلقة بالزي.',
      'الحرص على عدم تكرار الملاحظة مستقبلًا.'
    ]
  }
};

const WARNING_TYPES = Object.fromEntries(Object.entries(PLEDGE_TYPES).map(([key, template]) => [key, {
  label: template.label,
  notice: {
    absences: 'تكرار الغياب وعدم الانتظام في الحضور',
    lateness: 'تكرار التأخر عن بداية الحلقة',
    phone: 'اصطحاب الجوال إلى الحلقة بالمخالفة للتعليمات',
    behavior: 'ملاحظة تتعلق بالأخلاقيات والسلوكيات داخل الحلقة',
    leaving: 'الخروج من الحلقة من غير إذن المعلم',
    disruption: 'المشاغبة أو التشويش داخل الحلقة',
    cheating: 'ملاحظة تتعلق بالغش أثناء التسميع',
    educational: 'ضعف المستوى التعليمي أو التأخر في الحفظ والمراجعة',
    uniform: 'عدم ارتداء الطالب الزي الرسمي المعتمد للحلقات، وهو الكوفية أو الطاقية والشماغ'
  }[key]
}]));

let teacherRecords = [];
let teacherAlertHistoryRecords = [];
let teacherAlertHistoryCursor = null;
let teacherAlertHistoryHasMore = false;
let teacherAlertHistoryTeacherId = '';
let teacherAlertHistoryTotalCount = 0;
let teacherAlertHistoryRequestId = 0;
let selectedTeacherAlertRecord = null;
let currentStudents = [];
let historyRecords = [];
let eventsBound = false;
let historyCursor = null;
let historyHasMore = false;
let historyTeacherId = '';
let historyClassId = '';
let historyStudentId = '';
let selectedPledgeRecord = null;
let warningHistoryRecords = [];
let warningHistoryCursor = null;
let warningHistoryHasMore = false;
let warningTeacherId = '';
let warningClassId = '';
let warningStudentId = '';
let selectedWarningRecord = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function getAdminName() {
  return sessionStorage.getItem('loggedInAdminName') || sessionStorage.getItem('adminName') || 'إدارة النظام';
}

function getHijriDate() {
  return formatAccurateHijriDate(getTodayAccurateHijri()).replace(' هـ', ' هـ');
}

function buildWarningMessage(studentName, warningType, hijriDate) {
  const template = WARNING_TYPES[warningType];
  return `السلام عليكم ورحمة الله وبركاته،\n\nنحيطكم علمًا بأنه تم تسجيل إنذار شفهي للطالب:\n${studentName}\n\nوذلك بسبب:\n${template.notice}\n\nنأمل منكم متابعة الطالب والتعاون مع إدارة الحلقات لتجنب تكرار الملاحظة، لما لذلك من أثر على مستوى الطالب وانتظامه وسلوكه.\n\nوفي حال تكرار الملاحظة قد يتم اتخاذ الإجراء التالي وفق النظام المتبع.\n\nشاكرين لكم تعاونكم.\n\nإدارة حلقات جامع حمدة آل ثاني\n\nالتاريخ الهجري: ${hijriDate}`;
}

function openWarningWhatsApp(record) {
  const phone = String(record.guardianPhone || '').replace(/\D/g, '').replace(/^0/, '966');
  if (!phone) {
    setStatus('لا يوجد رقم ولي أمر مسجل لهذا الطالب.', 'error');
    return;
  }
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(record.messageContent)}`, '_blank');
}

function buildTeacherAlertMessage(teacherName, type, hijriDate) {
  const note = TEACHER_ALERT_TYPES[type]?.note;
  return `أستاذنا الفاضل ${teacherName}\n\nتحية طيبة ملؤها التقدير لجهودكم وعطائكم المستمر.\n\nمن باب الحرص المتبادل على سير العمل بأفضل صورة، نود لفت انتباهكم الكريم إلى تسجيل ملاحظة بسيطة بخصوص: ${note}\n\nكلي ثقة بحرصكم الدائم وتفهمكم.\n\nشاكرين لكم سعة صدركم وتقبلكم، ودمتم بعطاء.\n\nإدارة حلقات جامع حمدة آل ثاني\nالتاريخ الهجري: ${hijriDate}`;
}

function normalizeSaudiPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits ? `966${digits}` : '';
}

async function openTeacherAlertWhatsApp(record, popupWindow = null, statusTarget = setTeacherAlertStatus) {
  let teacherPhone = typeof window.getTeacherPhone === 'function'
    ? await window.getTeacherPhone(record.teacherId)
    : null;
  if (!teacherPhone && typeof window.getTeacherPhone === 'function') {
    teacherPhone = await window.getTeacherPhone(record.teacherName);
  }
  const normalizedPhone = normalizeSaudiPhone(teacherPhone);
  if (!normalizedPhone) {
    popupWindow?.close();
    statusTarget('لا يوجد رقم جوال مسجل لهذا المعلم.', 'error');
    return false;
  }

  const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(record.messageContent)}`;
  const opened = popupWindow
    ? (popupWindow.location.href = whatsappUrl, true)
    : Boolean(window.open(whatsappUrl, '_blank'));
  statusTarget(
    opened ? 'تم فتح واتساب برسالة التنبيه.' : 'تعذر فتح واتساب. تحقق من سماح المتصفح بالنوافذ المنبثقة.',
    opened ? 'success' : 'error'
  );
  return opened;
}

function setTeacherAlertStatus(message = '', type = '') {
  const status = document.getElementById('teacherAlertStatusMessage');
  if (!status) return;
  status.textContent = message;
  status.className = `pledge-status-message${type ? ` ${type}` : ''}`;
}

function setTeacherAlertHistoryStatus(message = '', type = '') {
  const status = document.getElementById('teacherAlertHistoryStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `pledge-status-message${type ? ` ${type}` : ''}`;
}

function updateTeacherAlertButton() {
  const button = document.getElementById('createTeacherAlertButton');
  const hasSelection = document.getElementById('teacherAlertTeacherSelect')?.value && document.getElementById('teacherAlertTypeSelect')?.value;
  if (button) button.disabled = !hasSelection || button.dataset.loading === 'true';
}

function renderTeacherAlertHistory() {
  const list = document.getElementById('teacherAlertHistoryList');
  const countSummary = document.getElementById('teacherAlertCountSummary');
  if (countSummary) {
    countSummary.hidden = !teacherAlertHistoryTeacherId;
    countSummary.textContent = teacherAlertHistoryTeacherId ? `إجمالي التنبيهات: ${teacherAlertHistoryTotalCount}` : '';
  }
  if (!list) return;
  if (!teacherAlertHistoryTeacherId) {
    list.innerHTML = '<div class="pledge-empty-state">اختر المعلم لعرض سجل تنبيهاته.</div>';
    return;
  }
  if (!teacherAlertHistoryRecords.length) {
    list.innerHTML = '<div class="pledge-empty-state">لا توجد تنبيهات مسجلة لهذا المعلم.</div>';
    return;
  }

  list.innerHTML = `<div class="pledge-history-table-wrap"><table class="pledge-history-table"><thead><tr><th>المعلم</th><th>نوع الملاحظة</th><th>التاريخ الهجري</th><th>الإجراء</th></tr></thead><tbody>${teacherAlertHistoryRecords.map(record => `<tr data-teacher-alert-row="${escapeHtml(record.id)}"><td>${escapeHtml(record.teacherName)}</td><td>${escapeHtml(record.violationLabel || TEACHER_ALERT_TYPES[record.violationType]?.label || record.violationType)}</td><td>${escapeHtml(record.hijriDate)}</td><td class="pledge-row-actions"><button class="pledge-table-button" type="button" data-teacher-alert-details="${escapeHtml(record.id)}">عرض</button><button class="pledge-table-button" type="button" data-teacher-alert-whatsapp="${escapeHtml(record.id)}">واتساب</button><button class="pledge-table-button pledge-table-danger" type="button" data-teacher-alert-delete="${escapeHtml(record.id)}">حذف</button></td></tr>`).join('')}</tbody></table></div>`;
  list.querySelectorAll('[data-teacher-alert-details]').forEach(button => button.addEventListener('click', () => showTeacherAlertDetails(teacherAlertHistoryRecords.find(record => record.id === button.dataset.teacherAlertDetails))));
  list.querySelectorAll('[data-teacher-alert-whatsapp]').forEach(button => button.addEventListener('click', () => openTeacherAlertWhatsApp(teacherAlertHistoryRecords.find(record => record.id === button.dataset.teacherAlertWhatsapp), null, setTeacherAlertHistoryStatus)));
  list.querySelectorAll('[data-teacher-alert-delete]').forEach(button => button.addEventListener('click', () => openTeacherAlertDeleteConfirmation(teacherAlertHistoryRecords.find(record => record.id === button.dataset.teacherAlertDelete))));
  list.querySelectorAll('[data-teacher-alert-row]').forEach(row => row.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    showTeacherAlertDetails(teacherAlertHistoryRecords.find(record => record.id === row.dataset.teacherAlertRow));
  }));

  const loadMoreButton = document.createElement('button');
  loadMoreButton.type = 'button';
  loadMoreButton.className = 'pledge-secondary-button pledge-load-more';
  loadMoreButton.textContent = teacherAlertHistoryHasMore ? 'تحميل المزيد' : '';
  loadMoreButton.hidden = !teacherAlertHistoryHasMore;
  loadMoreButton.addEventListener('click', () => loadTeacherAlertHistory(false));
  list.appendChild(loadMoreButton);
}

async function loadTeacherAlertHistory(reset = true) {
  const requestId = ++teacherAlertHistoryRequestId;
  const requestedTeacherId = teacherAlertHistoryTeacherId;
  if (!teacherAlertHistoryTeacherId) {
    teacherAlertHistoryRecords = [];
    teacherAlertHistoryTotalCount = 0;
    renderTeacherAlertHistory();
    return;
  }
  if (reset) {
    teacherAlertHistoryRecords = [];
    teacherAlertHistoryCursor = null;
    teacherAlertHistoryHasMore = false;
    teacherAlertHistoryTotalCount = 0;
    renderTeacherAlertHistory();
  }
  setTeacherAlertHistoryStatus('جاري تحميل سجل التنبيهات...', 'loading');
  const collectionRef = collection(db, TEACHER_ALERT_COLLECTION);
  const countQuery = query(collectionRef, where('teacherId', '==', teacherAlertHistoryTeacherId));
  const filters = [where('teacherId', '==', teacherAlertHistoryTeacherId), orderBy('createdAt', 'desc'), limit(25)];
  if (teacherAlertHistoryCursor) filters.push(startAfter(teacherAlertHistoryCursor));

  let snapshot;
  let usedFallback = false;
  try {
    [snapshot, teacherAlertHistoryTotalCount] = await Promise.all([
      getDocs(query(collectionRef, ...filters)),
      getCountFromServer(countQuery).then(result => result.data().count)
    ]);
  } catch (error) {
    if (requestId !== teacherAlertHistoryRequestId) return;
    if (error.code !== 'failed-precondition') {
      setTeacherAlertHistoryStatus('تعذر تحميل سجل التنبيهات لهذا المعلم.', 'error');
      console.error('Error loading teacher alert history:', error);
      return;
    }
    try {
      const [fallbackSnapshot, totalCount] = await Promise.all([
        getDocs(query(collectionRef, where('teacherId', '==', teacherAlertHistoryTeacherId), limit(100))),
        getCountFromServer(countQuery).then(result => result.data().count)
      ]);
      snapshot = fallbackSnapshot;
      teacherAlertHistoryTotalCount = totalCount;
      usedFallback = true;
    } catch (fallbackError) {
      if (requestId !== teacherAlertHistoryRequestId) return;
      setTeacherAlertHistoryStatus('تعذر تحميل سجل التنبيهات لهذا المعلم.', 'error');
      console.error('Error loading teacher alert history fallback:', fallbackError);
      return;
    }
  }

  if (requestId !== teacherAlertHistoryRequestId || requestedTeacherId !== teacherAlertHistoryTeacherId) return;

  const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  records.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  teacherAlertHistoryRecords = [...teacherAlertHistoryRecords, ...records];
  teacherAlertHistoryCursor = snapshot.docs.at(-1) || null;
  teacherAlertHistoryHasMore = !usedFallback && snapshot.docs.length === 25;
  setTeacherAlertHistoryStatus('');
  renderTeacherAlertHistory();
}

function showTeacherAlertDetails(record) {
  if (!record) return;
  selectedTeacherAlertRecord = record;
  const details = document.getElementById('teacherAlertDetailsContent');
  if (details) {
    details.innerHTML = `<div class="pledge-details-grid"><div class="pledge-detail-cell"><span>المعلم</span><strong>${escapeHtml(record.teacherName)}</strong></div><div class="pledge-detail-cell"><span>نوع الملاحظة</span><strong>${escapeHtml(record.violationLabel || TEACHER_ALERT_TYPES[record.violationType]?.label || record.violationType)}</strong></div><div class="pledge-detail-cell"><span>التاريخ الهجري</span><strong>${escapeHtml(record.hijriDate)}</strong></div><div class="pledge-detail-cell"><span>الحلقات</span><strong>${escapeHtml((record.classIds || (record.classId ? [record.classId] : [])).join('، ') || 'غير محددة')}</strong></div></div><div class="pledge-detail-body">${escapeHtml(record.messageContent || '')}</div>`;
  }
  document.getElementById('teacherAlertDetailsModal')?.removeAttribute('hidden');
}

function openTeacherAlertDeleteConfirmation(record) {
  if (!record) return;
  selectedTeacherAlertRecord = record;
  document.getElementById('teacherAlertDetailsModal')?.setAttribute('hidden', '');
  document.getElementById('teacherAlertDeleteModal')?.removeAttribute('hidden');
}

async function deleteSelectedTeacherAlert() {
  if (!selectedTeacherAlertRecord) return;
  const button = document.getElementById('confirmTeacherAlertDeleteButton');
  button.disabled = true;
  try {
    await deleteDoc(doc(db, TEACHER_ALERT_COLLECTION, selectedTeacherAlertRecord.id));
    teacherAlertHistoryRecords = teacherAlertHistoryRecords.filter(record => record.id !== selectedTeacherAlertRecord.id);
    teacherAlertHistoryTotalCount = Math.max(0, teacherAlertHistoryTotalCount - 1);
    closePledgeModals();
    selectedTeacherAlertRecord = null;
    renderTeacherAlertHistory();
    setTeacherAlertHistoryStatus('تم حذف التنبيه.', 'success');
  } catch (error) {
    console.error('Error deleting teacher alert:', error);
    setTeacherAlertHistoryStatus('تعذر حذف التنبيه. حاول مرة أخرى.', 'error');
  } finally {
    button.disabled = false;
  }
}

function setStatus(message = '', type = '') {
  const status = document.getElementById('pledgeStatusMessage');
  if (!status) return;
  status.textContent = message;
  status.className = `pledge-status-message${type ? ` ${type}` : ''}`;
}

function updateCreateButton() {
  const button = document.getElementById('createPledgeButton');
  const type = document.getElementById('pledgeTypeSelect')?.value;
  const student = document.getElementById('pledgeStudentSelect')?.value;
  if (button) button.disabled = !(type && student) || button.dataset.loading === 'true';
}

function renderTeacherOptions() {
  [
    document.getElementById('pledgeTeacherSelect'),
    document.getElementById('teacherAlertTeacherSelect'),
    document.getElementById('teacherAlertHistoryTeacherSelect')
  ].forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">اختر المعلم</option>';
    teacherRecords.forEach(teacher => {
      const option = document.createElement('option');
      option.value = teacher.teacherId;
      option.textContent = teacher.teacherName;
      select.appendChild(option);
    });
  });
}

function renderStudentOptions(teacherId) {
  const select = document.getElementById('pledgeStudentSelect');
  if (!select) return;
  currentStudents = teacherRecords.filter(item => item.teacherId === teacherId).flatMap(item => item.students);
  currentStudents.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  select.innerHTML = '<option value="">اختر الطالب</option>';
  currentStudents.forEach(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.name;
    select.appendChild(option);
  });
  select.disabled = !currentStudents.length;
  document.getElementById('pledgeStudentField')?.classList.toggle('is-visible', true);
  document.getElementById('pledgeTypeField')?.classList.remove('is-visible');
  document.getElementById('pledgeTypeSelect').value = '';
  updateCreateButton();
}

function setWarningStatus(message = '', type = '') {
  const status = document.getElementById('warningStatusMessage');
  if (!status) return;
  status.textContent = message;
  status.className = `pledge-status-message${type ? ` ${type}` : ''}`;
}

function updateWarningCreateButton() {
  const button = document.getElementById('createWarningButton');
  const hasSelection = document.getElementById('warningStudentSelect')?.value && document.getElementById('warningTypeSelect')?.value;
  if (button) button.disabled = !hasSelection || button.dataset.loading === 'true';
}

function renderWarningTeacherOptions() {
  const selects = [document.getElementById('warningTeacherSelect'), document.getElementById('warningHistoryTeacherSelect')];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">اختر المعلم</option>';
    teacherRecords.forEach(teacher => {
      const option = document.createElement('option');
      option.value = teacher.teacherId;
      option.textContent = teacher.teacherName;
      select.appendChild(option);
    });
  });
}

function renderWarningStudents(teacherId) {
  const select = document.getElementById('warningStudentSelect');
  const teacher = teacherRecords.find(item => item.teacherId === teacherId);
  if (!select) return;
  select.innerHTML = '<option value="">اختر الطالب</option>';
  (teacher?.students || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.name;
    select.appendChild(option);
  });
  select.disabled = !(teacher?.students?.length);
  document.getElementById('warningStudentField')?.classList.toggle('is-visible', Boolean(teacherId));
  document.getElementById('warningTypeField')?.classList.remove('is-visible');
  document.getElementById('warningPreviousNotice')?.setAttribute('hidden', '');
  updateWarningCreateButton();
}

function renderWarningHistoryLinkedOptions() {
  const teacher = teacherRecords.find(item => item.teacherId === warningTeacherId);
  const classSelect = document.getElementById('warningHistoryClassSelect');
  const studentSelect = document.getElementById('warningHistoryStudentSelect');
  if (!teacher || !classSelect || !studentSelect) return;
  classSelect.disabled = false;
  classSelect.innerHTML = '<option value="">جميع الحلقات</option>';
  teacher.classes.forEach(classRecord => {
    const option = document.createElement('option');
    option.value = classRecord.classId;
    option.textContent = classRecord.className;
    classSelect.appendChild(option);
  });
  studentSelect.disabled = false;
  studentSelect.innerHTML = '<option value="">جميع الطلاب</option>';
  const students = warningClassId ? teacher.classes.find(item => item.classId === warningClassId)?.students || [] : teacher.students;
  students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.name;
    studentSelect.appendChild(option);
  });
}

function renderWarningHistory() {
  const list = document.getElementById('warningHistoryList');
  if (!list) return;
  if (!warningHistoryRecords.length) {
    list.innerHTML = warningTeacherId ? '<div class="pledge-empty-state">لا توجد إنذارات لهذا الاختيار.</div>' : '<div class="pledge-empty-state">اختر المعلم لعرض سجل الإنذارات.</div>';
    return;
  }
  list.innerHTML = `<div class="pledge-history-table-wrap"><table class="pledge-history-table"><thead><tr><th>الطالب</th><th>المعلم</th><th>نوع الإنذار</th><th>التاريخ الهجري</th><th>الإجراء</th></tr></thead><tbody>${warningHistoryRecords.map(record => `<tr data-warning-row="${escapeHtml(record.id)}"><td>${escapeHtml(record.studentName)}</td><td>${escapeHtml(record.teacherName)}</td><td>${escapeHtml(WARNING_TYPES[record.violationType]?.label || record.violationType)}</td><td>${escapeHtml(record.hijriDate)}</td><td class="pledge-row-actions"><button class="pledge-table-button" type="button" data-warning-details="${escapeHtml(record.id)}">عرض</button><button class="pledge-table-button" type="button" data-warning-whatsapp="${escapeHtml(record.id)}">واتساب</button><button class="pledge-table-button pledge-table-danger" type="button" data-warning-delete="${escapeHtml(record.id)}">حذف</button></td></tr>`).join('')}</tbody></table></div>`;
  list.querySelectorAll('[data-warning-details]').forEach(button => button.addEventListener('click', () => showWarningDetails(warningHistoryRecords.find(record => record.id === button.dataset.warningDetails))));
  list.querySelectorAll('[data-warning-whatsapp]').forEach(button => button.addEventListener('click', () => openWarningWhatsApp(warningHistoryRecords.find(record => record.id === button.dataset.warningWhatsapp))));
  list.querySelectorAll('[data-warning-delete]').forEach(button => button.addEventListener('click', () => openWarningDeleteConfirmation(warningHistoryRecords.find(record => record.id === button.dataset.warningDelete))));
  const loadMoreButton = document.createElement('button');
  loadMoreButton.type = 'button';
  loadMoreButton.className = 'pledge-secondary-button pledge-load-more';
  loadMoreButton.textContent = warningHistoryHasMore ? 'تحميل المزيد' : '';
  loadMoreButton.hidden = !warningHistoryHasMore;
  loadMoreButton.addEventListener('click', () => loadWarningHistory(false));
  list.appendChild(loadMoreButton);
}

async function loadWarningHistory(reset = true) {
  if (!warningTeacherId) {
    warningHistoryRecords = [];
    renderWarningHistory();
    return;
  }
  if (reset) {
    warningHistoryRecords = [];
    warningHistoryCursor = null;
    warningHistoryHasMore = false;
  }
  const filters = [where('teacherId', '==', warningTeacherId)];
  if (warningClassId) filters.push(where('classId', '==', warningClassId));
  if (warningStudentId) filters.push(where('studentId', '==', warningStudentId));
  filters.push(orderBy('createdAt', 'desc'), limit(25));
  if (warningHistoryCursor) filters.push(startAfter(warningHistoryCursor));
  let snapshot;
  let fallback = false;
  try {
    snapshot = await getDocs(query(collection(db, WARNING_COLLECTION), ...filters));
  } catch (error) {
    if (error.code !== 'failed-precondition') throw error;
    const fallbackFilters = [where('teacherId', '==', warningTeacherId)];
    if (warningClassId) fallbackFilters.push(where('classId', '==', warningClassId));
    if (warningStudentId) fallbackFilters.push(where('studentId', '==', warningStudentId));
    fallbackFilters.push(limit(100));
    snapshot = await getDocs(query(collection(db, WARNING_COLLECTION), ...fallbackFilters));
    fallback = true;
  }
  const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  records.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  warningHistoryRecords = [...warningHistoryRecords, ...records];
  warningHistoryCursor = snapshot.docs.at(-1) || null;
  warningHistoryHasMore = !fallback && snapshot.docs.length === 25;
  renderWarningHistory();
}

function showWarningDetails(record) {
  if (!record) return;
  selectedWarningRecord = record;
  const details = document.getElementById('warningDetailsContent');
  if (details) details.innerHTML = `<div class="pledge-details-grid"><div class="pledge-detail-cell"><span>الطالب</span><strong>${escapeHtml(record.studentName)}</strong></div><div class="pledge-detail-cell"><span>المعلم</span><strong>${escapeHtml(record.teacherName)}</strong></div><div class="pledge-detail-cell"><span>نوع الإنذار</span><strong>${escapeHtml(WARNING_TYPES[record.violationType]?.label || record.violationType)}</strong></div><div class="pledge-detail-cell"><span>التاريخ الهجري</span><strong>${escapeHtml(record.hijriDate)}</strong></div></div><div class="pledge-detail-body">${escapeHtml(record.messageContent)}</div>`;
  document.getElementById('warningDetailsModal')?.removeAttribute('hidden');
}

function openWarningDeleteConfirmation(record) {
  if (!record) return;
  selectedWarningRecord = record;
  document.getElementById('warningDetailsModal')?.setAttribute('hidden', '');
  document.getElementById('warningDeleteModal')?.removeAttribute('hidden');
}

async function showPreviousWarningNotice(studentId, violationType) {
  const notice = document.getElementById('warningPreviousNotice');
  if (!notice || !studentId || !violationType) return;
  try {
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, WARNING_COLLECTION), where('studentId', '==', studentId), where('violationType', '==', violationType), limit(20)));
    } catch (error) {
      snapshot = await getDocs(query(collection(db, WARNING_COLLECTION), where('studentId', '==', studentId), limit(50)));
    }
    const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(record => record.violationType === violationType).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!records.length) {
      notice.hidden = true;
      return;
    }
    notice.textContent = `يوجد إنذار شفهي سابق لهذا الطالب بنفس الملاحظة بتاريخ ${records[0].hijriDate}.`;
    notice.hidden = false;
  } catch (error) {
    console.warn('Unable to check previous warning:', error);
    notice.hidden = true;
  }
}

async function deleteSelectedWarning() {
  if (!selectedWarningRecord) return;
  const button = document.getElementById('confirmWarningDeleteButton');
  button.disabled = true;
  try {
    await deleteDoc(doc(db, WARNING_COLLECTION, selectedWarningRecord.id));
    warningHistoryRecords = warningHistoryRecords.filter(record => record.id !== selectedWarningRecord.id);
    closePledgeModals();
    selectedWarningRecord = null;
    renderWarningHistory();
    setWarningStatus('تم حذف الإنذار بنجاح.', 'success');
  } catch (error) {
    console.error('Error deleting warning:', error);
    setWarningStatus('تعذر حذف الإنذار. حاول مرة أخرى.', 'error');
  } finally {
    button.disabled = false;
  }
}

async function createWarning() {
  const teacherId = document.getElementById('warningTeacherSelect')?.value;
  const studentId = document.getElementById('warningStudentSelect')?.value;
  const violationType = document.getElementById('warningTypeSelect')?.value;
  const teacher = teacherRecords.find(item => item.teacherId === teacherId);
  const student = teacher?.students.find(item => item.id === studentId);
  if (!teacher || !student || !WARNING_TYPES[violationType]) {
    setWarningStatus('أكمل اختيار المعلم والطالب ونوع الملاحظة أولًا.', 'error');
    return;
  }
  const button = document.getElementById('createWarningButton');
  button.dataset.loading = 'true';
  button.disabled = true;
  const hijriDate = getHijriDate();
  const record = { studentId, studentName: student.name, teacherId, teacherName: teacher.teacherName, classId: student.classId, actionType: 'verbal_warning', violationType, hijriDate, messageContent: buildWarningMessage(student.name, violationType, hijriDate), guardianPhone: student.guardianPhone || '', createdAt: serverTimestamp(), createdBy: getAdminName() };
  try {
    await addDoc(collection(db, WARNING_COLLECTION), record);
    setWarningStatus('تم تسجيل الإنذار وتجهيز الرسالة.', 'success');
    openWarningWhatsApp(record);
    await loadWarningHistory(true);
  } catch (error) {
    console.error('Error creating warning:', error);
    setWarningStatus('تعذر حفظ الإنذار. حاول مرة أخرى.', 'error');
  } finally {
    button.dataset.loading = 'false';
    updateWarningCreateButton();
  }
}

async function createTeacherAlert() {
  const teacherId = document.getElementById('teacherAlertTeacherSelect')?.value;
  const type = document.getElementById('teacherAlertTypeSelect')?.value;
  const teacher = teacherRecords.find(item => item.teacherId === teacherId);
  if (!teacher || !TEACHER_ALERT_TYPES[type]) {
    setTeacherAlertStatus('اختر المعلم ونوع الملاحظة أولًا.', 'error');
    return;
  }

  const button = document.getElementById('createTeacherAlertButton');
  button.dataset.loading = 'true';
  updateTeacherAlertButton();
  setTeacherAlertStatus('جاري تسجيل التنبيه...', 'loading');
  const whatsappWindow = window.open('about:blank', '_blank');
  const hijriDate = getHijriDate();
  const messageContent = buildTeacherAlertMessage(teacher.teacherName, type, hijriDate);
  const classIds = teacher.classes.map(classRecord => classRecord.classId);
  const record = {
    actionType: 'teacher_alert',
    teacherId,
    teacherName: teacher.teacherName,
    classId: classIds.length === 1 ? classIds[0] : null,
    classIds,
    violationType: type,
    violationLabel: TEACHER_ALERT_TYPES[type].label,
    hijriDate,
    messageContent,
    createdAt: serverTimestamp(),
    createdBy: getAdminName()
  };

  try {
    await addDoc(collection(db, TEACHER_ALERT_COLLECTION), record);
    if (teacherAlertHistoryTeacherId === teacherId) {
      await loadTeacherAlertHistory(true);
    }
    let teacherPhone = typeof window.getTeacherPhone === 'function'
      ? await window.getTeacherPhone(teacherId)
      : null;
    if (!teacherPhone && typeof window.getTeacherPhone === 'function') {
      teacherPhone = await window.getTeacherPhone(teacher.teacherName);
    }
    const normalizedPhone = normalizeSaudiPhone(teacherPhone);

    if (!normalizedPhone) {
      whatsappWindow?.close();
      setTeacherAlertStatus('تم حفظ التنبيه، لكن لا يوجد رقم جوال مسجل لهذا المعلم.', 'error');
      return;
    }

    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(messageContent)}`;
    const whatsappOpened = whatsappWindow
      ? (whatsappWindow.location.href = whatsappUrl, true)
      : Boolean(window.open(whatsappUrl, '_blank'));
    setTeacherAlertStatus(
      whatsappOpened ? 'تم تسجيل التنبيه وفتح واتساب للمعلم.' : 'تم حفظ التنبيه، لكن المتصفح منع فتح واتساب. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.',
      whatsappOpened ? 'success' : 'error'
    );
  } catch (error) {
    console.error('Error creating teacher alert:', error);
    whatsappWindow?.close();
    setTeacherAlertStatus('تعذر تسجيل التنبيه. لم يتم فتح واتساب، حاول مرة أخرى.', 'error');
  } finally {
    button.dataset.loading = 'false';
    updateTeacherAlertButton();
  }
}

function renderHistory() {
  const list = document.getElementById('pledgeHistoryList');
  if (!list) return;
  if (!historyRecords.length) {
    list.innerHTML = historyTeacherId
      ? '<div class="pledge-empty-state">لا توجد تعهدات لهذا الاختيار.</div>'
      : '<div class="pledge-empty-state">اختر المعلم لعرض سجل التعهدات.</div>';
    return;
  }
  list.innerHTML = `
    <div class="pledge-history-table-wrap">
      <table class="pledge-history-table">
        <thead><tr><th>الطالب</th><th>المعلم</th><th>نوع التعهد</th><th>التاريخ الهجري</th><th>الإجراء</th></tr></thead>
        <tbody>${historyRecords.map(record => `
          <tr data-pledge-row="${escapeHtml(record.id)}">
            <td>${escapeHtml(record.studentName)}</td>
            <td>${escapeHtml(record.teacherName)}</td>
            <td>${escapeHtml(PLEDGE_TYPES[record.type]?.label || record.type)}</td>
            <td>${escapeHtml(record.hijriDate)}</td>
            <td class="pledge-row-actions">
              <button class="pledge-table-button" type="button" data-pledge-details="${escapeHtml(record.id)}">عرض</button>
              <button class="pledge-table-button pledge-table-danger" type="button" data-pledge-delete="${escapeHtml(record.id)}">حذف</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `;
  const loadMoreButton = document.createElement('button');
  loadMoreButton.type = 'button';
  loadMoreButton.className = 'pledge-secondary-button pledge-load-more';
  loadMoreButton.textContent = historyHasMore ? 'تحميل المزيد' : '';
  loadMoreButton.hidden = !historyHasMore;
  loadMoreButton.addEventListener('click', () => loadPledgeHistory(false));
  list.appendChild(loadMoreButton);
  list.querySelectorAll('[data-pledge-details]').forEach(button => {
    button.addEventListener('click', () => showPledgeDetails(historyRecords.find(item => item.id === button.dataset.pledgeDetails)));
  });
  list.querySelectorAll('[data-pledge-delete]').forEach(button => {
    button.addEventListener('click', () => openDeletePledgeConfirmation(historyRecords.find(item => item.id === button.dataset.pledgeDelete)));
  });
  list.querySelectorAll('[data-pledge-row]').forEach(row => {
    row.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      showPledgeDetails(historyRecords.find(item => item.id === row.dataset.pledgeRow));
    });
  });
}

async function loadPledgeData() {
  const loading = document.getElementById('pledgeLoadingState');
  if (loading) loading.hidden = false;
  try {
    const classesSnapshot = await getDocs(collection(db, 'classes'));
    const grouped = new Map();
    classesSnapshot.forEach(classDoc => {
      const data = classDoc.data();
      const classId = data.classId || classDoc.id;
      const teacherId = data.teacherId || classId;
      const teacherName = data.teacherName || data.name || teacherId;
      if (!grouped.has(teacherId)) grouped.set(teacherId, { teacherId, teacherName, classes: [] });
      grouped.get(teacherId).classes.push({ classId, className: data.className || data.name || `حلقة ${classId}` });
    });

    teacherRecords = await Promise.all([...grouped.values()].map(async teacher => {
      const studentsById = new Map();
      const classes = [];
      for (const classRecord of teacher.classes) {
        const classId = classRecord.classId;
        const studentsSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', classId)));
        const classStudents = [];
        studentsSnapshot.forEach(studentDoc => {
          const data = studentDoc.data();
          const student = { id: studentDoc.id, name: data.name || 'طالب بدون اسم', guardianPhone: data.guardianPhone || '', classId, fullData: data };
          studentsById.set(studentDoc.id, student);
          classStudents.push(student);
        });
        classes.push({ ...classRecord, students: classStudents });
      }
      return { ...teacher, classes, students: [...studentsById.values()] };
    }));
    teacherRecords = teacherRecords.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ar'));
    renderTeacherOptions();
    renderHistoryTeacherOptions();
    renderWarningTeacherOptions();
    renderHistory();
    renderWarningHistory();
  } catch (error) {
    console.error('Error loading pledge data:', error);
    setStatus('تعذر تحميل المعلمين والطلاب. تحقق من الاتصال والصلاحيات.', 'error');
  } finally {
    if (loading) loading.hidden = true;
  }
}

function renderHistoryTeacherOptions() {
  const select = document.getElementById('pledgeHistoryTeacherSelect');
  if (!select) return;
  select.innerHTML = '<option value="">اختر المعلم لعرض سجل التعهدات</option>';
  teacherRecords.forEach(teacher => {
    const option = document.createElement('option');
    option.value = teacher.teacherId;
    option.textContent = teacher.teacherName;
    select.appendChild(option);
  });
}

function renderHistoryLinkedOptions() {
  const teacher = teacherRecords.find(item => item.teacherId === historyTeacherId);
  const classSelect = document.getElementById('pledgeHistoryClassSelect');
  const studentSelect = document.getElementById('pledgeHistoryStudentSelect');
  if (!teacher || !classSelect || !studentSelect) return;
  classSelect.disabled = false;
  classSelect.innerHTML = '<option value="">جميع الحلقات</option>';
  teacher.classes.forEach(classRecord => {
    const option = document.createElement('option');
    option.value = classRecord.classId;
    option.textContent = classRecord.className;
    classSelect.appendChild(option);
  });
  studentSelect.disabled = false;
  studentSelect.innerHTML = '<option value="">جميع الطلاب</option>';
  const students = historyClassId ? teacher.classes.find(item => item.classId === historyClassId)?.students || [] : teacher.students;
  students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).forEach(student => {
    const option = document.createElement('option');
    option.value = student.id;
    option.textContent = student.name;
    studentSelect.appendChild(option);
  });
}

async function loadPledgeHistory(reset = true) {
  if (!historyTeacherId) {
    historyRecords = [];
    renderHistory();
    return;
  }
  if (reset) {
    historyRecords = [];
    historyCursor = null;
    historyHasMore = false;
  }
  const filters = [where('teacherId', '==', historyTeacherId)];
  if (historyClassId) filters.push(where('classId', '==', historyClassId));
  if (historyStudentId) filters.push(where('studentId', '==', historyStudentId));
  filters.push(orderBy('createdAt', 'desc'), limit(25));
  if (historyCursor) filters.push(startAfter(historyCursor));
  let snapshot;
  let usedIndexFallback = false;
  try {
    snapshot = await getDocs(query(collection(db, PLEDGE_COLLECTION), ...filters));
  } catch (error) {
    if (error.code !== 'failed-precondition') throw error;
    // The composite index may be defined locally but not deployed yet.
    const fallbackFilters = [where('teacherId', '==', historyTeacherId)];
    if (historyClassId) fallbackFilters.push(where('classId', '==', historyClassId));
    if (historyStudentId) fallbackFilters.push(where('studentId', '==', historyStudentId));
    fallbackFilters.push(limit(100));
    snapshot = await getDocs(query(collection(db, PLEDGE_COLLECTION), ...fallbackFilters));
    usedIndexFallback = true;
  }
  const pageRecords = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  if (usedIndexFallback) {
    pageRecords.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    historyHasMore = false;
  }
  historyRecords = [...historyRecords, ...pageRecords];
  historyCursor = snapshot.docs.at(-1) || null;
  if (!usedIndexFallback) historyHasMore = snapshot.docs.length === 25;
  renderHistory();
}

async function refreshFilteredHistory() {
  try {
    await loadPledgeHistory(true);
  } catch (error) {
    console.error('Error loading filtered pledge history:', error);
    setStatus('تعذر تحميل سجل التعهدات لهذا الاختيار.', 'error');
  }
}

function showPledgeDetails(record) {
  if (!record) return;
  selectedPledgeRecord = record;
  const content = record.generatedContent || {};
  const details = document.getElementById('pledgeDetailsContent');
  if (details) {
    details.innerHTML = `
      <div class="pledge-details-grid">
        <div class="pledge-detail-cell"><span>الطالب</span><strong>${escapeHtml(record.studentName)}</strong></div>
        <div class="pledge-detail-cell"><span>المعلم</span><strong>${escapeHtml(record.teacherName)}</strong></div>
        <div class="pledge-detail-cell"><span>نوع التعهد</span><strong>${escapeHtml(PLEDGE_TYPES[record.type]?.label || record.type)}</strong></div>
        <div class="pledge-detail-cell"><span>التاريخ الهجري</span><strong>${escapeHtml(record.hijriDate)}</strong></div>
      </div>
      <div class="pledge-detail-body"><strong>${escapeHtml(record.title || content.title || '')}</strong><p>${escapeHtml(content.notice || '')}</p><strong>الالتزام بالآتي:</strong><ol>${(content.points || []).map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ol><p>${escapeHtml(content.closing || '')}</p></div>
    `;
  }
  document.getElementById('pledgeDetailsModal')?.removeAttribute('hidden');
}

function closePledgeModals() {
  document.querySelectorAll('.pledge-modal').forEach(modal => modal.setAttribute('hidden', ''));
}

function openDeletePledgeConfirmation(record) {
  if (!record) return;
  selectedPledgeRecord = record;
  document.getElementById('pledgeDetailsModal')?.setAttribute('hidden', '');
  document.getElementById('pledgeDeleteModal')?.removeAttribute('hidden');
}

async function deleteSelectedPledge() {
  if (!selectedPledgeRecord) return;
  const deleteButton = document.getElementById('confirmPledgeDeleteButton');
  deleteButton.disabled = true;
  try {
    await deleteDoc(doc(db, PLEDGE_COLLECTION, selectedPledgeRecord.id));
    historyRecords = historyRecords.filter(record => record.id !== selectedPledgeRecord.id);
    closePledgeModals();
    selectedPledgeRecord = null;
    renderHistory();
    setStatus('تم حذف التعهد بنجاح.', 'success');
  } catch (error) {
    console.error('Error deleting pledge:', error);
    setStatus('تعذر حذف التعهد. حاول مرة أخرى.', 'error');
  } finally {
    deleteButton.disabled = false;
  }
}

function buildPledgeContent(studentName, pledgeType, hijriDate) {
  const template = PLEDGE_TYPES[pledgeType];
  return {
    title: template.title,
    notice: `أتعهد أنا ولي أمر الطالب (${studentName}) بأن إدارة حلقات جامع حمدة آل ثاني قد أشعرتني بأن ${template.notice}، ${template.impact}`,
    points: template.points,
    closing: 'وهذا إقرار مني بالالتزام بما ورد أعلاه، وتعهد بعدم تكرار ذلك مستقبلًا.',
    hijriDate
  };
}

function createPdfElement(record) {
  const content = record.generatedContent;
  const element = document.createElement('div');
  element.className = 'pledge-pdf-document';
  element.dir = 'rtl';
  element.innerHTML = `
    <div class="pledge-pdf-topline">إدارة حلقات جامع حمدة آل ثاني</div>
    <div class="pledge-pdf-brand">تعهد طالب</div>
    <h1>${escapeHtml(content.title)}</h1>
    <div class="pledge-pdf-rule"></div>
    <p class="pledge-pdf-greeting">السلام عليكم ورحمة الله وبركاته،</p>
    <p>${escapeHtml(content.notice)}</p>
    <p class="pledge-pdf-intro">وبناءً عليه، أتعهد بالالتزام بالآتي:</p>
    <ol>${content.points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ol>
    <p class="pledge-pdf-closing">${escapeHtml(content.closing)}</p>
    <div class="pledge-pdf-footer">
      <div><span>الطالب</span><strong>${escapeHtml(record.studentName)}</strong></div>
      <div><span>التاريخ الهجري</span><strong>${escapeHtml(record.hijriDate)}</strong></div>
    </div>
    <div class="pledge-pdf-signature">إدارة حلقات جامع حمدة آل ثاني</div>
  `;
  return element;
}

async function openPledgePdf(record) {
  if (!record || !window.html2canvas || !window.jspdf?.jsPDF) {
    setStatus('تعذر فتح ملف PDF. تأكد من تحميل مكتبات PDF ثم أعد المحاولة.', 'error');
    return;
  }
  const popup = window.open('', '_blank');
  const element = createPdfElement(record);
  element.style.position = 'fixed';
  element.style.left = '-10000px';
  element.style.top = '0';
  document.body.appendChild(element);
  try {
    setStatus('جاري تجهيز ملف PDF...', 'loading');
    const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const image = canvas.toDataURL('image/png');
    const pageWidth = 210;
    const pageHeight = 297;
    const imageHeight = canvas.height * pageWidth / canvas.width;
    pdf.addImage(image, 'PNG', 0, 0, pageWidth, Math.min(imageHeight, pageHeight));
    const blobUrl = pdf.output('bloburl');
    if (popup) popup.location.href = blobUrl;
    else window.open(blobUrl, '_blank');
    setStatus('تم إنشاء التعهد وفتح ملف PDF.', 'success');
  } catch (error) {
    console.error('Error generating pledge PDF:', error);
    if (popup) popup.close();
    setStatus('تم حفظ التعهد، لكن تعذر إنشاء ملف PDF. يمكنك إعادة المحاولة من السجل.', 'error');
  } finally {
    element.remove();
  }
}

async function createPledge() {
  const teacherId = document.getElementById('pledgeTeacherSelect')?.value;
  const studentId = document.getElementById('pledgeStudentSelect')?.value;
  const type = document.getElementById('pledgeTypeSelect')?.value;
  if (!teacherId || !studentId || !type) {
    setStatus('أكمل اختيار المعلم والطالب ونوع التعهد أولًا.', 'error');
    return;
  }
  const teacher = teacherRecords.find(item => item.teacherId === teacherId);
  const student = currentStudents.find(item => item.id === studentId);
  const template = PLEDGE_TYPES[type];
  if (!teacher || !student || !template) {
    setStatus('تعذر العثور على بيانات الاختيارات الحالية.', 'error');
    return;
  }
  const button = document.getElementById('createPledgeButton');
  button.dataset.loading = 'true';
  button.disabled = true;
  setStatus('جاري حفظ التعهد وإنشاء الملف...', 'loading');
  const hijriDate = getHijriDate();
  const generatedContent = buildPledgeContent(student.name, type, hijriDate);
  try {
    const record = {
      studentId,
      studentName: student.name,
      teacherId,
      teacherName: teacher.teacherName,
      classId: student.classId,
      actionType: 'pledge',
      type,
      title: template.title,
      generatedContent,
      hijriDate,
      createdAt: serverTimestamp(),
      createdBy: getAdminName()
    };
    const saved = await addDoc(collection(db, PLEDGE_COLLECTION), record);
    const savedRecord = { ...record, id: saved.id, createdAt: { toMillis: () => Date.now() } };
    if (historyTeacherId) {
      await refreshFilteredHistory();
    } else {
      renderHistory();
    }
    await openPledgePdf(savedRecord);
  } catch (error) {
    console.error('Error creating student pledge:', error);
    setStatus('تعذر حفظ التعهد. لم يتم عرض نجاح، وما زالت اختياراتك محفوظة للمحاولة مرة أخرى.', 'error');
  } finally {
    button.dataset.loading = 'false';
    updateCreateButton();
  }
}

function resetPledgeForm() {
  document.getElementById('pledgeTeacherSelect').value = '';
  document.getElementById('pledgeStudentSelect').innerHTML = '<option value="">اختر الطالب</option>';
  document.getElementById('pledgeStudentSelect').disabled = true;
  document.getElementById('pledgeTypeSelect').value = '';
  document.getElementById('pledgeStudentField')?.classList.remove('is-visible');
  document.getElementById('pledgeTypeField')?.classList.remove('is-visible');
  updateCreateButton();
  setStatus('');
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;
  document.getElementById('pledgeTeacherSelect')?.addEventListener('change', event => renderStudentOptions(event.target.value));
  document.getElementById('pledgeStudentSelect')?.addEventListener('change', event => {
    document.getElementById('pledgeTypeField')?.classList.toggle('is-visible', Boolean(event.target.value));
    updateCreateButton();
  });
  document.getElementById('pledgeTypeSelect')?.addEventListener('change', async event => {
    updateCreateButton();
    await showPreviousWarningNotice(document.getElementById('pledgeStudentSelect')?.value, event.target.value);
  });
  document.getElementById('warningTeacherSelect')?.addEventListener('change', event => renderWarningStudents(event.target.value));
  document.getElementById('warningStudentSelect')?.addEventListener('change', event => {
    document.getElementById('warningTypeField')?.classList.toggle('is-visible', Boolean(event.target.value));
    updateWarningCreateButton();
  });
  document.getElementById('warningTypeSelect')?.addEventListener('change', updateWarningCreateButton);
  document.getElementById('createWarningButton')?.addEventListener('click', createWarning);
  document.getElementById('resetWarningButton')?.addEventListener('click', () => {
    document.getElementById('warningTeacherSelect').value = '';
    document.getElementById('warningStudentSelect').innerHTML = '<option value="">اختر الطالب</option>';
    document.getElementById('warningStudentSelect').disabled = true;
    document.getElementById('warningStudentField')?.classList.remove('is-visible');
    document.getElementById('warningTypeField')?.classList.remove('is-visible');
    document.getElementById('warningPreviousNotice')?.setAttribute('hidden', '');
    document.getElementById('warningTypeSelect').value = '';
    updateWarningCreateButton();
    setWarningStatus('');
  });
  document.getElementById('warningHistoryTeacherSelect')?.addEventListener('change', async event => {
    warningTeacherId = event.target.value;
    warningClassId = '';
    warningStudentId = '';
    renderWarningHistoryLinkedOptions();
    await loadWarningHistory(true);
  });
  document.getElementById('warningHistoryClassSelect')?.addEventListener('change', async event => {
    warningClassId = event.target.value;
    warningStudentId = '';
    renderWarningHistoryLinkedOptions();
    await loadWarningHistory(true);
  });
  document.getElementById('warningHistoryStudentSelect')?.addEventListener('change', async event => {
    warningStudentId = event.target.value;
    await loadWarningHistory(true);
  });
  document.getElementById('warningDetailsWhatsappButton')?.addEventListener('click', () => openWarningWhatsApp(selectedWarningRecord));
  document.getElementById('warningDetailsDeleteButton')?.addEventListener('click', () => openWarningDeleteConfirmation(selectedWarningRecord));
  document.getElementById('confirmWarningDeleteButton')?.addEventListener('click', deleteSelectedWarning);
  document.getElementById('teacherAlertTeacherSelect')?.addEventListener('change', event => {
    const hasTeacher = Boolean(event.target.value);
    const typeSelect = document.getElementById('teacherAlertTypeSelect');
    if (typeSelect && !hasTeacher) typeSelect.value = '';
    if (typeSelect) typeSelect.disabled = !hasTeacher;
    document.getElementById('teacherAlertTypeField')?.classList.toggle('is-visible', hasTeacher);
    updateTeacherAlertButton();
  });
  document.getElementById('teacherAlertTypeSelect')?.addEventListener('change', updateTeacherAlertButton);
  document.getElementById('createTeacherAlertButton')?.addEventListener('click', createTeacherAlert);
  document.getElementById('teacherAlertHistoryTeacherSelect')?.addEventListener('change', async event => {
    teacherAlertHistoryTeacherId = event.target.value;
    teacherAlertHistoryRecords = [];
    teacherAlertHistoryCursor = null;
    teacherAlertHistoryHasMore = false;
    teacherAlertHistoryTotalCount = 0;
    await loadTeacherAlertHistory(true);
  });
  document.querySelectorAll('[data-teacher-alert-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-teacher-alert-tab]').forEach(item => item.classList.remove('is-active'));
    document.querySelectorAll('.teacher-alert-panel').forEach(panel => panel.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.getElementById(tab.dataset.teacherAlertTab)?.classList.add('is-active');
    if (tab.dataset.teacherAlertTab === 'teacherAlertHistoryPanel' && teacherAlertHistoryTeacherId) {
      loadTeacherAlertHistory(true);
    }
  }));
  document.getElementById('teacherAlertDetailsWhatsappButton')?.addEventListener('click', () => openTeacherAlertWhatsApp(selectedTeacherAlertRecord, null, setTeacherAlertHistoryStatus));
  document.getElementById('teacherAlertDetailsDeleteButton')?.addEventListener('click', () => openTeacherAlertDeleteConfirmation(selectedTeacherAlertRecord));
  document.getElementById('confirmTeacherAlertDeleteButton')?.addEventListener('click', deleteSelectedTeacherAlert);
  document.querySelectorAll('[data-pledge-audience-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-pledge-audience-tab]').forEach(item => {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.pledge-audience-view').forEach(panel => panel.classList.remove('is-active'));
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.pledgeAudienceTab)?.classList.add('is-active');
  }));
  document.querySelectorAll('[data-pledge-student-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-pledge-student-tab]').forEach(item => {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.pledge-student-view').forEach(panel => panel.classList.remove('is-active'));
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.pledgeStudentTab)?.classList.add('is-active');
  }));
  document.getElementById('createPledgeButton')?.addEventListener('click', createPledge);
  document.getElementById('resetPledgeButton')?.addEventListener('click', resetPledgeForm);
  document.getElementById('pledgeHistoryTeacherSelect')?.addEventListener('change', async event => {
    historyTeacherId = event.target.value;
    historyClassId = '';
    historyStudentId = '';
    renderHistoryLinkedOptions();
    await refreshFilteredHistory();
  });
  document.getElementById('pledgeHistoryClassSelect')?.addEventListener('change', async event => {
    historyClassId = event.target.value;
    historyStudentId = '';
    renderHistoryLinkedOptions();
    await refreshFilteredHistory();
  });
  document.getElementById('pledgeHistoryStudentSelect')?.addEventListener('change', async event => {
    historyStudentId = event.target.value;
    await refreshFilteredHistory();
  });
  document.getElementById('pledgeDetailsPdfButton')?.addEventListener('click', () => openPledgePdf(selectedPledgeRecord));
  document.getElementById('pledgeDetailsDeleteButton')?.addEventListener('click', () => openDeletePledgeConfirmation(selectedPledgeRecord));
  document.getElementById('confirmPledgeDeleteButton')?.addEventListener('click', deleteSelectedPledge);
  document.querySelectorAll('[data-close-pledge-modal]').forEach(element => element.addEventListener('click', closePledgeModals));
  document.querySelectorAll('[data-pledge-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-pledge-tab]').forEach(item => item.classList.remove('is-active'));
    document.querySelectorAll('.pledge-tab-panel').forEach(panel => panel.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.getElementById(tab.dataset.pledgeTab)?.classList.add('is-active');
    if (tab.dataset.pledgeTab === 'pledgeHistoryPanel') loadPledgeHistory(true).catch(error => setStatus('تعذر تحديث سجل التعهدات.', 'error'));
    if (tab.dataset.pledgeTab === 'warningHistoryPanel') loadWarningHistory(true).catch(error => setWarningStatus('تعذر تحديث سجل الإنذارات.', 'error'));
  }));
}

window.openStudentPledgesSection = async function() {
  const section = document.getElementById('studentPledgesSection');
  if (!section) return;
  document.querySelectorAll('.admin-main-section, .admin-full-page-section').forEach(item => item.classList.remove('active-section'));
  section.style.display = 'block';
  section.classList.add('active-section');
  bindEvents();
  if (!teacherRecords.length) await loadPledgeData();
};

window.closeStudentPledgesSection = function() {
  const section = document.getElementById('studentPledgesSection');
  if (section) section.style.display = 'none';
  window.switchAdminSection?.('more');
};

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
});

const existingAdminSectionSwitch = window.switchAdminSection;
if (typeof existingAdminSectionSwitch === 'function') {
  window.switchAdminSection = function(sectionName) {
    const section = document.getElementById('studentPledgesSection');
    if (section) section.style.display = 'none';
    existingAdminSectionSwitch(sectionName);
  };
}

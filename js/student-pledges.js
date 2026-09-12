import {
  db,
  collection,
  doc,
  getDocs,
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
  }
};

let teacherRecords = [];
let currentStudents = [];
let historyRecords = [];
let eventsBound = false;
let historyCursor = null;
let historyHasMore = false;
let historyTeacherId = '';
let historyClassId = '';
let historyStudentId = '';
let selectedPledgeRecord = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function getAdminName() {
  return sessionStorage.getItem('loggedInAdminName') || sessionStorage.getItem('adminName') || 'إدارة النظام';
}

function getHijriDate() {
  return formatAccurateHijriDate(getTodayAccurateHijri()).replace(' هـ', ' هـ');
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
  const select = document.getElementById('pledgeTeacherSelect');
  if (!select) return;
  select.innerHTML = '<option value="">اختر المعلم</option>';
  teacherRecords.forEach(teacher => {
    const option = document.createElement('option');
    option.value = teacher.teacherId;
    option.textContent = teacher.teacherName;
    select.appendChild(option);
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
          const student = { id: studentDoc.id, name: data.name || 'طالب بدون اسم', classId, fullData: data };
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
    renderHistory();
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
  document.getElementById('pledgeTypeSelect')?.addEventListener('change', updateCreateButton);
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

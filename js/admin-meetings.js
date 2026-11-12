import {
  addMeetingItemNote,
  createMeeting,
  createMeetingItem,
  deleteMeeting,
  deleteMeetingItem,
  getCurrentGregorianMonthKey,
  getMeeting,
  listMeetingFollowUpItems,
  listMeetingItemNotes,
  listMeetingItems,
  listMeetings,
  MEETING_ITEM_STATUSES,
  MEETING_ITEM_TYPES,
  MEETING_STATUSES,
  searchMeetings,
  updateMeeting,
  updateMeetingItem
} from './meetings-data.js';
import { exportMeetingPdf, shareMeetingText } from './meeting-sharing.js';

const meetingStatusLabels = { draft: 'مسودة', approved: 'معتمد', completed: 'مكتمل' };
const itemStatusLabels = {
  'not-started': 'لم يبدأ',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتمل',
  deferred: 'مؤجل',
  cancelled: 'ملغى'
};
const itemTypeLabels = {
  reminder: 'تذكير',
  discussion: 'مناقشة',
  suggestion: 'اقتراح',
  announcement: 'تعميم',
  decision: 'قرار',
  assignment: 'تكليف',
  'follow-up': 'متابعة',
  other: 'أخرى'
};

let activeMonthKey = getCurrentGregorianMonthKey();
let currentMeetingId = null;

function escapeMeetingHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function formatMeetingDate(value, options = { year: 'numeric', month: 'long', day: 'numeric' }) {
  if (!value) return 'غير محدد';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar-SA-u-ca-gregory', options).format(date);
}

function setMeetingsStatus(message = '', isError = false) {
  const status = document.getElementById('meetingsPageStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
  status.classList.toggle('is-visible', Boolean(message));
}

async function handleMeetingShare(button, meeting, items) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'جار تجهيز المشاركة...';
  setMeetingsStatus();
  try {
    const result = await shareMeetingText(meeting, items);
    if (result === 'shared') setMeetingsStatus('تم فتح خيارات المشاركة.');
    if (result === 'copied') setMeetingsStatus('تم نسخ النص، ويمكنك لصقه في التطبيق المطلوب.');
  } catch (error) {
    console.error('Unable to share meeting text:', error);
    setMeetingsStatus('تعذرت المشاركة أو نسخ النص. حاول مرة أخرى.', true);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

async function handleMeetingPdfExport(button, meeting, items) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'جار تجهيز PDF...';
  setMeetingsStatus();
  try {
    await exportMeetingPdf(meeting, items);
    setMeetingsStatus('تم تجهيز محضر الاجتماع للتنزيل.');
  } catch (error) {
    console.error('Unable to export meeting PDF:', error);
    setMeetingsStatus(error.message || 'تعذر تصدير محضر الاجتماع. حاول مرة أخرى.', true);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

function getMeetingsContent() {
  return document.getElementById('meetingsPageContent');
}

function getActorName() {
  return sessionStorage.getItem('loggedInAdminName') || 'الإدارة';
}

window.openAdminMeetings = async function() {
  const section = document.getElementById('meetingsSection');
  const moreSection = document.getElementById('moreSection');
  if (!section) return;
  if (moreSection) moreSection.style.display = 'none';
  section.style.display = 'block';
  await renderMeetingsHome();
};

window.closeAdminMeetings = function() {
  const section = document.getElementById('meetingsSection');
  if (section) section.style.display = 'none';
  const moreSection = document.getElementById('moreSection');
  if (moreSection) moreSection.style.display = '';
  currentMeetingId = null;
};

async function renderMeetingsHome() {
  currentMeetingId = null;
  const content = getMeetingsContent();
  if (!content) return;
  setMeetingsStatus();
  content.innerHTML = `
    <section class="meetings-home" dir="rtl">
      <header class="meetings-page-heading">
        <div><h2>الاجتماعات</h2><p>محاضر الاجتماعات ونقاط التنفيذ</p></div>
        <div class="meetings-heading-actions"><button class="meetings-secondary-button" type="button" data-action="follow-up">متابعة التنفيذ</button><button class="meetings-primary-button" type="button" data-action="create-meeting">إنشاء اجتماع جديد</button></div>
      </header>
      <div class="meetings-filter-row">
        <label for="meetingsMonthFilter">الشهر</label>
        <input id="meetingsMonthFilter" type="month" value="${escapeMeetingHtml(activeMonthKey)}">
      </div>
      <div class="meetings-search-row"><label for="meetingsSearchInput">بحث في الاجتماعات</label><input id="meetingsSearchInput" type="search" maxlength="100" placeholder="عنوان اجتماع، نقطة، أو ملاحظة"><span>اكتب كلمتين على الأقل</span></div>
      <div id="meetingsSearchResults" class="meetings-search-results" hidden></div>
      <div id="meetingsSummary" class="meetings-summary-grid" aria-live="polite"></div>
      <div class="meetings-list-heading"><h3>سجل الاجتماعات</h3><span id="meetingsListCount"></span></div>
      <div id="meetingsList" class="meetings-list" aria-live="polite"><p class="meetings-empty-state">جار تحميل الاجتماعات...</p></div>
    </section>
  `;

  content.querySelector('[data-action="create-meeting"]').addEventListener('click', () => renderMeetingForm());
  content.querySelector('[data-action="follow-up"]').addEventListener('click', renderMeetingFollowUp);
  content.querySelector('#meetingsMonthFilter').addEventListener('change', event => {
    if (!event.target.value) return;
    activeMonthKey = event.target.value;
    renderMeetingsHome();
  });
  attachMeetingSearch(content);

  try {
    const meetings = await listMeetings({ monthKey: activeMonthKey });
    if (!content.isConnected || !content.querySelector('#meetingsList')) return;

    const itemCount = meetings.reduce((total, meeting) => total + Number(meeting.itemCount || 0), 0);
    const completedCount = meetings.reduce((total, meeting) => total + Number(meeting.completedItemCount || 0), 0);
    const inProgressCount = meetings.reduce((total, meeting) => total + Number(meeting.inProgressItemCount || 0), 0);
    const today = getCurrentGregorianMonthKey(new Date()) + `-${String(new Date().getDate()).padStart(2, '0')}`;
    const nextDueDate = meetings.map(meeting => meeting.nextDueDate).filter(date => date && date >= today).sort()[0];
    const summary = content.querySelector('#meetingsSummary');
    summary.innerHTML = [
      ['عدد الاجتماعات', meetings.length],
      ['نقاط الاجتماع', itemCount],
      ['النقاط المكتملة', completedCount],
      ['قيد التنفيذ', inProgressCount],
      ['أقرب موعد قادم', nextDueDate ? formatMeetingDate(nextDueDate, { month: 'short', day: 'numeric' }) : 'لا يوجد']
    ].map(([label, value]) => `<div class="meeting-summary-item"><span>${escapeMeetingHtml(label)}</span><strong>${escapeMeetingHtml(value)}</strong></div>`).join('');

    content.querySelector('#meetingsListCount').textContent = `${meetings.length} اجتماع`;
    const list = content.querySelector('#meetingsList');
    if (!meetings.length) {
      list.innerHTML = '<div class="meetings-empty-state"><strong>لا توجد اجتماعات لهذا الشهر</strong><span>ابدأ بإنشاء محضر الاجتماع الأول.</span></div>';
      return;
    }

    list.innerHTML = meetings.map(meeting => `
      <button class="meeting-list-card" type="button" data-meeting-id="${escapeMeetingHtml(meeting.id)}">
        <span class="meeting-list-main">
          <strong>${escapeMeetingHtml(meeting.title)}</strong>
          <span>${escapeMeetingHtml(formatMeetingDate(meeting.meetingDate))}${meeting.meetingTime ? ` · ${escapeMeetingHtml(meeting.meetingTime)}` : ''}</span>
        </span>
        <span class="meeting-list-meta">
          <span>${Number(meeting.itemCount || 0)} نقطة</span>
          <span>${Number(meeting.completedItemCount || 0)} مكتملة</span>
          <span class="meeting-status-badge meeting-status-${escapeMeetingHtml(meeting.status)}">${escapeMeetingHtml(meetingStatusLabels[meeting.status] || meetingStatusLabels.draft)}</span>
        </span>
      </button>
    `).join('');
    list.querySelectorAll('[data-meeting-id]').forEach(button => {
      button.addEventListener('click', () => renderMeetingDetails(button.dataset.meetingId));
    });
  } catch (error) {
    console.error('Unable to load meetings:', error);
    const list = content.querySelector('#meetingsList');
    if (list) list.innerHTML = '<p class="meetings-empty-state is-error">تعذر تحميل الاجتماعات. حاول مرة أخرى.</p>';
  }
}

function attachMeetingSearch(content) {
  const input = content.querySelector('#meetingsSearchInput');
  const resultsPanel = content.querySelector('#meetingsSearchResults');
  const listHeading = content.querySelector('.meetings-list-heading');
  const list = content.querySelector('#meetingsList');
  const hint = input.parentElement.querySelector('span');
  let searchTimer;
  let latestSearchId = 0;

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const searchText = input.value.trim();
    const searchId = ++latestSearchId;
    const hasEnoughText = searchText.length >= 2;
    resultsPanel.hidden = !hasEnoughText;
    listHeading.hidden = hasEnoughText;
    list.hidden = hasEnoughText;
    hint.hidden = hasEnoughText;
    if (!hasEnoughText) {
      resultsPanel.replaceChildren();
      return;
    }
    resultsPanel.innerHTML = '<p class="meetings-search-state">جار البحث...</p>';
    searchTimer = setTimeout(async () => {
      try {
        const results = await searchMeetings(searchText);
        if (searchId !== latestSearchId || !resultsPanel.isConnected) return;
        renderMeetingSearchResults(resultsPanel, results);
      } catch (error) {
        console.error('Unable to search meetings:', error);
        if (searchId === latestSearchId) resultsPanel.innerHTML = '<p class="meetings-search-state is-error">تعذر إكمال البحث. حاول مرة أخرى.</p>';
      }
    }, 350);
  });
}

function renderMeetingSearchResults(container, results) {
  if (!results.length) {
    container.innerHTML = '<p class="meetings-search-state">لا توجد نتائج مطابقة.</p>';
    return;
  }
  const sourceLabels = { meeting: 'اجتماع', item: 'نقطة اجتماع', note: 'ملاحظة' };
  container.replaceChildren();
  results.forEach(result => {
    const card = document.createElement('article');
    card.className = 'meeting-search-result';
    const text = document.createElement('div');
    text.className = 'meeting-search-result-copy';
    const source = document.createElement('span');
    source.className = 'meeting-search-source';
    source.textContent = sourceLabels[result.kind] || 'نتيجة';
    const title = document.createElement('strong');
    title.textContent = result.matchTitle || result.meeting.title;
    const context = document.createElement('span');
    context.textContent = `${result.meeting.title} · ${formatMeetingDate(result.meeting.meetingDate)}`;
    text.append(source, title, context);
    const openButton = document.createElement('button');
    openButton.className = 'meetings-secondary-button';
    openButton.type = 'button';
    openButton.textContent = 'فتح';
    openButton.addEventListener('click', async () => {
      await renderMeetingDetails(result.meetingId);
      if (!result.itemId) return;
      const target = [...(getMeetingsContent()?.querySelectorAll('.meeting-item-card') || [])]
        .find(item => item.dataset.itemId === result.itemId);
      if (target) {
        target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    card.append(text, openButton);
    container.appendChild(card);
  });
}

async function renderMeetingFollowUp() {
  currentMeetingId = null;
  const content = getMeetingsContent();
  if (!content) return;
  content.innerHTML = `
    <section class="meeting-follow-up-page" dir="rtl">
      <header class="meetings-page-heading">
        <div><h2>متابعة التنفيذ</h2><p>نقاط الاجتماعات ومواعيد تنفيذها</p></div>
        <button class="meetings-secondary-button" type="button" data-action="back">العودة إلى الاجتماعات</button>
      </header>
      <div class="meetings-filter-row"><label for="meetingFollowUpFilter">الحالة</label><select id="meetingFollowUpFilter"><option value="active">غير المكتمل</option><option value="overdue">متأخر</option><option value="not-started">لم يبدأ</option><option value="in-progress">قيد التنفيذ</option><option value="completed">مكتمل</option><option value="all">الكل</option></select></div>
      <div id="meetingFollowUpList" class="meeting-follow-up-list" aria-live="polite"><p class="meetings-empty-state">جار تحميل نقاط التنفيذ...</p></div>
    </section>
  `;
  content.querySelector('[data-action="back"]').addEventListener('click', renderMeetingsHome);
  const filter = content.querySelector('#meetingFollowUpFilter');
  const list = content.querySelector('#meetingFollowUpList');
  let followUpItems = [];
  filter.addEventListener('change', () => renderMeetingFollowUpItems(list, followUpItems, filter.value));

  try {
    followUpItems = await listMeetingFollowUpItems();
    if (getMeetingsContent() !== content) return;
    renderMeetingFollowUpItems(list, followUpItems, filter.value);
  } catch (error) {
    console.error('Unable to load meeting follow-up:', error);
    list.innerHTML = '<p class="meetings-empty-state is-error">تعذر تحميل نقاط التنفيذ. حاول مرة أخرى.</p>';
  }
}

function renderMeetingFollowUpItems(container, items, filter) {
  const visibleItems = items.filter(item => {
    if (filter === 'active') return item.status !== 'completed' && item.status !== 'cancelled';
    if (filter === 'overdue') return item.isOverdue;
    if (filter === 'all') return true;
    return item.status === filter;
  });
  if (!visibleItems.length) {
    container.innerHTML = '<p class="meetings-empty-state">لا توجد نقاط ضمن هذا الفلتر.</p>';
    return;
  }
  container.replaceChildren();
  visibleItems.forEach(item => {
    const card = document.createElement('article');
    card.className = `meeting-follow-up-card${item.isOverdue ? ' is-overdue' : ''}`;
    const copy = document.createElement('div');
    copy.className = 'meeting-follow-up-copy';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const detail = document.createElement('span');
    const dueDate = item.deadlineDate || item.plannedDate;
    detail.textContent = `${item.assignedTo ? `المسؤول: ${item.assignedTo} · ` : ''}${dueDate ? `الموعد: ${formatMeetingDate(dueDate)}` : 'لا يوجد موعد محدد'}`;
    copy.append(title, detail);
    const status = document.createElement('span');
    status.className = `meeting-item-status meeting-item-status-${item.isOverdue ? 'deferred' : item.status}`;
    status.textContent = item.isOverdue ? 'متأخر' : itemStatusLabels[item.status] || itemStatusLabels['not-started'];
    const openButton = document.createElement('button');
    openButton.className = 'meetings-secondary-button';
    openButton.type = 'button';
    openButton.textContent = 'فتح الاجتماع';
    openButton.addEventListener('click', async () => {
      await renderMeetingDetails(item.meetingId);
      const target = [...(getMeetingsContent()?.querySelectorAll('.meeting-item-card') || [])]
        .find(element => element.dataset.itemId === item.id);
      if (target) {
        target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    card.append(copy, status, openButton);
    container.appendChild(card);
  });
}

function renderMeetingForm(meeting = null) {
  const content = getMeetingsContent();
  if (!content) return;
  const isEditing = Boolean(meeting);
  const today = new Date();
  const localToday = `${getCurrentGregorianMonthKey(today)}-${String(today.getDate()).padStart(2, '0')}`;
  content.innerHTML = `
    <section class="meeting-form-page" dir="rtl">
      <header class="meetings-page-heading">
        <div><h2>${isEditing ? 'تعديل الاجتماع' : 'إنشاء اجتماع جديد'}</h2><p>الحقول ذات النجمة مطلوبة</p></div>
        <button class="meetings-secondary-button" type="button" data-action="cancel">إلغاء</button>
      </header>
      <form id="meetingForm" class="meeting-form">
        <div class="meeting-form-grid">
          <label class="meeting-field meeting-field-wide">عنوان الاجتماع <span>*</span><input name="title" type="text" maxlength="160" required value="${escapeMeetingHtml(meeting?.title || '')}" placeholder="مثال: اجتماع المعلمين الشهري"></label>
          <label class="meeting-field">تاريخ الاجتماع <span>*</span><input name="meetingDate" type="date" required value="${escapeMeetingHtml(meeting?.meetingDate || localToday)}"></label>
          <label class="meeting-field">وقت الاجتماع<input name="meetingTime" type="time" value="${escapeMeetingHtml(meeting?.meetingTime || '')}"></label>
          <label class="meeting-field">المكان<input name="location" type="text" maxlength="120" value="${escapeMeetingHtml(meeting?.location || '')}" placeholder="اختياري"></label>
          <label class="meeting-field">الحالة<select name="status">${MEETING_STATUSES.map(status => `<option value="${status}" ${meeting?.status === status ? 'selected' : ''}>${meetingStatusLabels[status]}</option>`).join('')}</select></label>
          <label class="meeting-field meeting-field-wide">وصف مختصر<textarea name="description" rows="3" maxlength="800" placeholder="اختياري">${escapeMeetingHtml(meeting?.description || '')}</textarea></label>
        </div>
        <div class="meeting-form-footer"><p class="meeting-form-error" role="alert"></p><button class="meetings-primary-button" type="submit">${isEditing ? 'حفظ التعديلات' : 'إنشاء الاجتماع'}</button></div>
      </form>
    </section>
  `;
  content.querySelector('[data-action="cancel"]').addEventListener('click', () => meeting ? renderMeetingDetails(meeting.id) : renderMeetingsHome());
  content.querySelector('#meetingForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    const error = form.querySelector('.meeting-form-error');
    submitButton.disabled = true;
    submitButton.textContent = 'جار الحفظ...';
    error.textContent = '';
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    try {
      if (meeting) {
        await updateMeeting(meeting.id, values, getActorName());
        await renderMeetingDetails(meeting.id);
      } else {
        const created = await createMeeting(values, getActorName());
        activeMonthKey = created.monthKey;
        await renderMeetingDetails(created.id);
      }
    } catch (saveError) {
      console.error('Unable to save meeting:', saveError);
      error.textContent = saveError.message || 'تعذر حفظ الاجتماع. حاول مرة أخرى.';
      submitButton.disabled = false;
      submitButton.textContent = meeting ? 'حفظ التعديلات' : 'إنشاء الاجتماع';
    }
  });
}

async function renderMeetingDetails(meetingId) {
  currentMeetingId = meetingId;
  const content = getMeetingsContent();
  if (!content) return;
  content.innerHTML = '<p class="meetings-empty-state">جار تحميل المحضر...</p>';

  try {
    const [meeting, items] = await Promise.all([getMeeting(meetingId), listMeetingItems(meetingId)]);
    if (!meeting) {
      await renderMeetingsHome();
      setMeetingsStatus('لم يعد هذا الاجتماع متاحًا.', true);
      return;
    }
    if (currentMeetingId !== meetingId) return;

    content.innerHTML = `
      <section class="meeting-detail-page" dir="rtl">
        <header class="meetings-page-heading meeting-detail-heading">
          <div><span class="meeting-status-badge meeting-status-${escapeMeetingHtml(meeting.status)}">${escapeMeetingHtml(meetingStatusLabels[meeting.status] || meetingStatusLabels.draft)}</span><h2>${escapeMeetingHtml(meeting.title)}</h2><p>${escapeMeetingHtml(formatMeetingDate(meeting.meetingDate))}${meeting.meetingTime ? ` · ${escapeMeetingHtml(meeting.meetingTime)}` : ''}${meeting.location ? ` · ${escapeMeetingHtml(meeting.location)}` : ''}</p></div>
          <div class="meeting-detail-actions"><button class="meetings-secondary-button" type="button" data-action="back">الاجتماعات</button><button class="meetings-secondary-button" type="button" data-action="share-meeting">مشاركة النص</button><button class="meetings-secondary-button" type="button" data-action="export-pdf">تصدير PDF</button><button class="meetings-secondary-button" type="button" data-action="edit">تعديل</button><button class="meetings-danger-button" type="button" data-action="delete-meeting">حذف الاجتماع</button></div>
        </header>
        ${meeting.description ? `<p class="meeting-description">${escapeMeetingHtml(meeting.description)}</p>` : ''}
        <div class="meeting-items-heading"><div><h3>نقاط الاجتماع</h3><span>${items.length} نقطة</span></div><button class="meetings-primary-button" type="button" data-action="add-item">إضافة نقطة</button></div>
        <div class="meeting-items-list" id="meetingItemsList"></div>
      </section>
    `;
    content.querySelector('[data-action="back"]').addEventListener('click', renderMeetingsHome);
    content.querySelector('[data-action="edit"]').addEventListener('click', () => renderMeetingForm(meeting));
    content.querySelector('[data-action="share-meeting"]').addEventListener('click', event => handleMeetingShare(event.currentTarget, meeting, items));
    content.querySelector('[data-action="export-pdf"]').addEventListener('click', event => handleMeetingPdfExport(event.currentTarget, meeting, items));
    content.querySelector('[data-action="delete-meeting"]').addEventListener('click', async () => {
      if (!window.confirm(`سيتم حذف الاجتماع وجميع نقاطه وملاحظاته. هل تريد المتابعة؟`)) return;
      try {
        await deleteMeeting(meetingId);
        currentMeetingId = null;
        await renderMeetingsHome();
      } catch (error) {
        console.error('Unable to delete meeting:', error);
        setMeetingsStatus('تعذر حذف الاجتماع. حاول مرة أخرى.', true);
      }
    });
    content.querySelector('[data-action="add-item"]').addEventListener('click', () => openMeetingItemForm(meetingId));
    renderMeetingItems(items, meetingId);
  } catch (error) {
    console.error('Unable to load meeting details:', error);
    content.innerHTML = '<p class="meetings-empty-state is-error">تعذر تحميل المحضر. حاول مرة أخرى.</p>';
  }
}

function renderMeetingItems(items, meetingId) {
  const list = getMeetingsContent()?.querySelector('#meetingItemsList');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="meetings-empty-state"><strong>لا توجد نقاط لهذا الاجتماع</strong><span>أضف أول نقطة لمتابعة ما تم الاتفاق عليه.</span></div>';
    return;
  }

  list.innerHTML = items.map(item => `
    <details class="meeting-item-card" data-item-id="${escapeMeetingHtml(item.id)}">
      <summary class="meeting-item-summary">
        <span class="meeting-item-title-group"><strong>${escapeMeetingHtml(item.title)}</strong><span class="meeting-item-type meeting-type-${escapeMeetingHtml(item.type)}">${escapeMeetingHtml(itemTypeLabels[item.type] || itemTypeLabels.other)}</span></span>
        <span class="meeting-item-summary-end"><span class="meeting-item-status meeting-item-status-${escapeMeetingHtml(item.status)}">${escapeMeetingHtml(itemStatusLabels[item.status] || itemStatusLabels['not-started'])}</span><span class="meeting-item-chevron" aria-hidden="true"></span></span>
      </summary>
      <div class="meeting-item-details">
        ${item.details ? `<p class="meeting-item-description">${escapeMeetingHtml(item.details)}</p>` : ''}
        <dl class="meeting-item-meta">
          ${item.assignedTo ? `<div><dt>المسؤول</dt><dd>${escapeMeetingHtml(item.assignedTo)}</dd></div>` : ''}
          ${item.plannedDate ? `<div><dt>موعد التنفيذ</dt><dd>${escapeMeetingHtml(formatMeetingDate(item.plannedDate))}</dd></div>` : ''}
          ${item.deadlineDate ? `<div><dt>آخر موعد</dt><dd>${escapeMeetingHtml(formatMeetingDate(item.deadlineDate))}</dd></div>` : ''}
          ${item.extraNotes ? `<div class="meeting-item-meta-wide"><dt>ملاحظات إضافية</dt><dd>${escapeMeetingHtml(item.extraNotes)}</dd></div>` : ''}
        </dl>
        <div class="meeting-item-controls">
          <label>الحالة<select class="meeting-item-status-select" data-item-id="${escapeMeetingHtml(item.id)}">${MEETING_ITEM_STATUSES.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${itemStatusLabels[status]}</option>`).join('')}</select></label>
          <div><button class="meeting-inline-action" type="button" data-action="edit-item" data-item-id="${escapeMeetingHtml(item.id)}">تعديل</button><button class="meeting-inline-action" type="button" data-action="add-note" data-item-id="${escapeMeetingHtml(item.id)}">الملاحظات</button><button class="meeting-inline-action" type="button" data-action="share-item" data-item-id="${escapeMeetingHtml(item.id)}">مشاركة النقطة</button><button class="meeting-inline-action meeting-inline-danger" type="button" data-action="delete-item" data-item-id="${escapeMeetingHtml(item.id)}">حذف</button></div>
        </div>
      </div>
    </details>
  `).join('');

  list.querySelectorAll('.meeting-item-status-select').forEach(select => {
    select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        await updateMeetingItem(select.dataset.itemId, { status: select.value }, getActorName());
        await renderMeetingDetails(meetingId);
      } catch (error) {
        console.error('Unable to update agenda status:', error);
        setMeetingsStatus('تعذر تحديث حالة النقطة.', true);
        select.disabled = false;
      }
    });
  });

  list.querySelectorAll('[data-action="edit-item"]').forEach(button => {
    button.addEventListener('click', () => openMeetingItemForm(meetingId, items.find(item => item.id === button.dataset.itemId)));
  });
  list.querySelectorAll('[data-action="add-note"]').forEach(button => {
    button.addEventListener('click', () => openMeetingNoteForm(meetingId, items.find(item => item.id === button.dataset.itemId)));
  });
  list.querySelectorAll('[data-action="share-item"]').forEach(button => {
    button.addEventListener('click', () => handleMeetingShare(button, meeting, [items.find(item => item.id === button.dataset.itemId)].filter(Boolean)));
  });
  list.querySelectorAll('[data-action="delete-item"]').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('هل تريد حذف هذه النقطة وجميع ملاحظاتها؟')) return;
      try {
        await deleteMeetingItem(button.dataset.itemId);
        await renderMeetingDetails(meetingId);
      } catch (error) {
        console.error('Unable to delete agenda item:', error);
        setMeetingsStatus('تعذر حذف النقطة.', true);
      }
    });
  });
}

function openMeetingItemForm(meetingId, item = null) {
  const modal = createMeetingModal(item ? 'تعديل نقطة الاجتماع' : 'إضافة نقطة اجتماع', `
    <form class="meeting-modal-form" id="meetingItemForm">
      <label class="meeting-field">عنوان النقطة <span>*</span><input name="title" maxlength="180" required value="${escapeMeetingHtml(item?.title || '')}"></label>
      <label class="meeting-field">التفاصيل<textarea name="details" rows="3" maxlength="2000">${escapeMeetingHtml(item?.details || '')}</textarea></label>
      <div class="meeting-form-grid">
        <label class="meeting-field">النوع<select name="type">${MEETING_ITEM_TYPES.map(type => `<option value="${type}" ${item?.type === type ? 'selected' : ''}>${itemTypeLabels[type]}</option>`).join('')}</select></label>
        <label class="meeting-field">الحالة<select name="status">${MEETING_ITEM_STATUSES.map(status => `<option value="${status}" ${item?.status === status ? 'selected' : ''}>${itemStatusLabels[status]}</option>`).join('')}</select></label>
        <label class="meeting-field">المسؤول<input name="assignedTo" maxlength="120" value="${escapeMeetingHtml(item?.assignedTo || '')}"></label>
        <label class="meeting-field">موعد التنفيذ<input name="plannedDate" type="date" value="${escapeMeetingHtml(item?.plannedDate || '')}"></label>
        <label class="meeting-field">آخر موعد للتنفيذ<input name="deadlineDate" type="date" value="${escapeMeetingHtml(item?.deadlineDate || '')}"></label>
      </div>
      <label class="meeting-field">ملاحظات إضافية<textarea name="extraNotes" rows="2" maxlength="1200">${escapeMeetingHtml(item?.extraNotes || '')}</textarea></label>
      <p class="meeting-form-error" role="alert"></p>
      <div class="meeting-modal-actions"><button class="meetings-secondary-button" type="button" data-action="cancel">إلغاء</button><button class="meetings-primary-button" type="submit">${item ? 'حفظ التعديلات' : 'إضافة النقطة'}</button></div>
    </form>
  `);
  const form = modal.querySelector('#meetingItemForm');
  form.querySelector('[data-action="cancel"]').addEventListener('click', closeMeetingModal);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const error = form.querySelector('.meeting-form-error');
    button.disabled = true;
    button.textContent = 'جار الحفظ...';
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      if (item) await updateMeetingItem(item.id, values, getActorName());
      else await createMeetingItem(meetingId, values, getActorName());
      closeMeetingModal();
      await renderMeetingDetails(meetingId);
    } catch (saveError) {
      console.error('Unable to save agenda item:', saveError);
      error.textContent = saveError.message || 'تعذر حفظ النقطة.';
      button.disabled = false;
      button.textContent = item ? 'حفظ التعديلات' : 'إضافة النقطة';
    }
  });
}

async function openMeetingNoteForm(meetingId, item) {
  if (!item) return;
  const today = new Date();
  const localToday = `${getCurrentGregorianMonthKey(today)}-${String(today.getDate()).padStart(2, '0')}`;
  let notes = [];
  try {
    notes = await listMeetingItemNotes(item.id);
  } catch (error) {
    console.error('Unable to load meeting notes:', error);
  }
  const historyMarkup = notes.length
    ? notes.map(note => `<article class="meeting-note-entry"><p>${escapeMeetingHtml(note.text)}</p><div><span>${escapeMeetingHtml(note.createdBy || 'الإدارة')}</span><span>${escapeMeetingHtml(formatMeetingDate(note.noteDate, { year: 'numeric', month: 'short', day: 'numeric' }))}</span></div></article>`).join('')
    : '<p class="meeting-note-empty">لا توجد ملاحظات سابقة لهذه النقطة.</p>';
  const modal = createMeetingModal(`ملاحظات: ${item.title}`, `
    <div class="meeting-note-history">${historyMarkup}</div>
    <form class="meeting-modal-form" id="meetingNoteForm">
      <label class="meeting-field">ملاحظة جديدة <span>*</span><textarea name="text" rows="3" maxlength="1500" required placeholder="اكتب متابعة أو تحديثًا للنقطة"></textarea></label>
      <label class="meeting-field">تاريخ الملاحظة<input name="noteDate" type="date" value="${localToday}"></label>
      <p class="meeting-form-error" role="alert"></p>
      <div class="meeting-modal-actions"><button class="meetings-secondary-button" type="button" data-action="cancel">إغلاق</button><button class="meetings-primary-button" type="submit">إضافة الملاحظة</button></div>
    </form>
  `);
  const form = modal.querySelector('#meetingNoteForm');
  form.querySelector('[data-action="cancel"]').addEventListener('click', closeMeetingModal);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const error = form.querySelector('.meeting-form-error');
    button.disabled = true;
    button.textContent = 'جار الحفظ...';
    try {
      await addMeetingItemNote(item.id, Object.fromEntries(new FormData(form).entries()), getActorName());
      closeMeetingModal();
      setMeetingsStatus('تمت إضافة الملاحظة.');
      await renderMeetingDetails(meetingId);
    } catch (saveError) {
      console.error('Unable to save meeting note:', saveError);
      error.textContent = saveError.message || 'تعذر حفظ الملاحظة.';
      button.disabled = false;
      button.textContent = 'إضافة الملاحظة';
    }
  });
}

function createMeetingModal(title, content) {
  closeMeetingModal();
  const overlay = document.createElement('div');
  overlay.id = 'meetingModalOverlay';
  overlay.className = 'meeting-modal-overlay';
  overlay.innerHTML = `
    <section class="meeting-modal" role="dialog" aria-modal="true" aria-label="${escapeMeetingHtml(title)}" dir="rtl">
      <header class="meeting-modal-header"><h2>${escapeMeetingHtml(title)}</h2><button class="meeting-modal-close" type="button" aria-label="إغلاق">إغلاق</button></header>
      <div class="meeting-modal-content">${content}</div>
    </section>
  `;
  overlay.querySelector('.meeting-modal-close').addEventListener('click', closeMeetingModal);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeMeetingModal();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeMeetingModal() {
  document.getElementById('meetingModalOverlay')?.remove();
}
import { listMeetingItemNotes } from './meetings-data.js';

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

function escapeMeetingPdfHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function formatMeetingDate(value) {
  if (!value) return 'غير محدد';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

async function loadNotesByItem(items) {
  const notes = await Promise.all(items.map(async item => {
    try {
      return [item.id, await listMeetingItemNotes(item.id)];
    } catch (error) {
      console.error('Unable to load notes for meeting export:', error);
      return [item.id, []];
    }
  }));
  return new Map(notes);
}

export function buildMeetingShareText(meeting, items) {
  const lines = [
    'محضر اجتماع — حلقات جامع حمدة آل ثاني',
    meeting.title,
    `التاريخ: ${formatMeetingDate(meeting.meetingDate)}`,
    meeting.meetingTime ? `الوقت: ${meeting.meetingTime}` : '',
    meeting.location ? `المكان: ${meeting.location}` : '',
    meeting.description ? `الوصف: ${meeting.description}` : '',
    `الحالة: ${meetingStatusLabels[meeting.status] || meetingStatusLabels.draft}`,
    '',
    'نقاط الاجتماع'
  ].filter(line => line !== undefined);

  if (!items.length) lines.push('لا توجد نقاط مسجلة.');
  items.forEach((item, index) => {
    lines.push('', `${index + 1}. ${item.title}`);
    lines.push(`النوع: ${itemTypeLabels[item.type] || itemTypeLabels.other}`);
    if (item.details) lines.push(`التفاصيل: ${item.details}`);
    if (item.assignedTo) lines.push(`المسؤول: ${item.assignedTo}`);
    if (item.plannedDate) lines.push(`موعد التنفيذ: ${formatMeetingDate(item.plannedDate)}`);
    if (item.deadlineDate) lines.push(`آخر موعد: ${formatMeetingDate(item.deadlineDate)}`);
    lines.push(`الحالة: ${itemStatusLabels[item.status] || itemStatusLabels['not-started']}`);
    if (item.extraNotes) lines.push(`ملاحظات: ${item.extraNotes}`);
  });
  return lines.join('\n');
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-10000px';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  textArea.remove();
  if (!copied) throw new Error('تعذر نسخ نص الاجتماع');
  return true;
}

export async function shareMeetingText(meeting, items) {
  const text = buildMeetingShareText(meeting, items);
  if (navigator.share) {
    try {
      await navigator.share({ title: meeting.title, text });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
      console.warn('Native sharing is unavailable; copying meeting text instead:', error);
    }
  }
  await copyTextToClipboard(text);
  return 'copied';
}

function buildPdfItemMarkup(item, notes) {
  return `
    <article class="meeting-pdf-item">
      <header><strong>${escapeMeetingPdfHtml(item.title)}</strong><span>${escapeMeetingPdfHtml(itemTypeLabels[item.type] || itemTypeLabels.other)} · ${escapeMeetingPdfHtml(itemStatusLabels[item.status] || itemStatusLabels['not-started'])}</span></header>
      ${item.details ? `<p>${escapeMeetingPdfHtml(item.details)}</p>` : ''}
      <div class="meeting-pdf-item-meta">
        ${item.assignedTo ? `<span><b>المسؤول:</b> ${escapeMeetingPdfHtml(item.assignedTo)}</span>` : ''}
        ${item.plannedDate ? `<span><b>موعد التنفيذ:</b> ${escapeMeetingPdfHtml(formatMeetingDate(item.plannedDate))}</span>` : ''}
        ${item.deadlineDate ? `<span><b>آخر موعد:</b> ${escapeMeetingPdfHtml(formatMeetingDate(item.deadlineDate))}</span>` : ''}
      </div>
      ${item.extraNotes ? `<p class="meeting-pdf-extra"><b>ملاحظات إضافية:</b> ${escapeMeetingPdfHtml(item.extraNotes)}</p>` : ''}
      ${notes.length ? `<div class="meeting-pdf-notes"><b>سجل المتابعة</b>${notes.map(note => `<p>${escapeMeetingPdfHtml(note.text)} <span>${escapeMeetingPdfHtml(formatMeetingDate(note.noteDate))} · ${escapeMeetingPdfHtml(note.createdBy || 'الإدارة')}</span></p>`).join('')}</div>` : ''}
    </article>
  `;
}

function createPdfPage(root, meeting, isFirstPage, itemCount) {
  const page = document.createElement('section');
  page.className = 'meeting-pdf-page';
  page.dir = 'rtl';
  page.innerHTML = `
    <header class="meeting-pdf-header">
      <span>حلقات جامع حمدة آل ثاني</span>
      <h1>محضر اجتماع</h1>
      <h2>${escapeMeetingPdfHtml(meeting.title)}</h2>
      <div>${escapeMeetingPdfHtml(formatMeetingDate(meeting.meetingDate))}${meeting.meetingTime ? ` · ${escapeMeetingPdfHtml(meeting.meetingTime)}` : ''}${meeting.location ? ` · ${escapeMeetingPdfHtml(meeting.location)}` : ''}</div>
      ${isFirstPage && meeting.description ? `<p>${escapeMeetingPdfHtml(meeting.description)}</p>` : ''}
      ${isFirstPage ? `<small>الحالة: ${escapeMeetingPdfHtml(meetingStatusLabels[meeting.status] || meetingStatusLabels.draft)}</small>` : '<small>استكمال محضر الاجتماع</small>'}
    </header>
    <div class="meeting-pdf-content"></div>
    <footer class="meeting-pdf-footer">${itemCount} نقطة · ${escapeMeetingPdfHtml(formatMeetingDate(meeting.meetingDate))}</footer>
  `;
  root.appendChild(page);
  return page.querySelector('.meeting-pdf-content');
}

export async function createMeetingPdfBlob(meeting, items) {
  if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('مكتبات إنشاء PDF غير متاحة');
  const notesByItem = await loadNotesByItem(items);
  const root = document.createElement('div');
  root.className = 'meeting-pdf-renderer';
  root.dir = 'rtl';
  root.style.position = 'fixed';
  root.style.left = '-10000px';
  root.style.top = '0';
  document.body.appendChild(root);

  try {
    let pageContent = createPdfPage(root, meeting, true, items.length);
    if (!items.length) pageContent.innerHTML = '<p class="meeting-pdf-empty">لا توجد نقاط مسجلة لهذا الاجتماع.</p>';
    items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.innerHTML = buildPdfItemMarkup(item, notesByItem.get(item.id) || []);
      const block = itemElement.firstElementChild;
      pageContent.appendChild(block);
      if (pageContent.scrollHeight > pageContent.clientHeight + 1 && pageContent.childElementCount > 1) {
        pageContent.removeChild(block);
        pageContent = createPdfPage(root, meeting, false, items.length);
        pageContent.appendChild(block);
      }
    });

    await document.fonts?.ready;
    const pages = [...root.querySelectorAll('.meeting-pdf-page')];
    const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      if (pageIndex > 0) pdf.addPage();
      const canvas = await window.html2canvas(pages[pageIndex], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
    return pdf.output('blob');
  } finally {
    root.remove();
  }
}

export async function exportMeetingPdf(meeting, items) {
  const blob = await createMeetingPdfBlob(meeting, items);
  const fileName = `محضر_اجتماع_${String(meeting.title || 'اجتماع').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
}
import { formatHijriDate } from './hijri-date.js';

function escapeEnrollmentHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function formatEnrollmentDate(value) {
  if (!value) return 'غير مسجل';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function buildEnrollmentPdfElement(student, classData) {
  const levelNames = { hifz: 'حفظ', dabt: 'ضبط', noorani: 'القاعدة النورانية' };
  const className = classData.className || classData.name || student.className || student.classId || 'غير محددة';
  const teacherName = String(classData.teacherName || classData.teacher || student.teacherName || student.teacher || 'غير محدد');
  const teacherLabel = teacherName.startsWith('أ/') || teacherName.startsWith('أ.') ? teacherName : `أ/${teacherName}`;
  const registrationDateGregorian = student.registrationDateGregorian || student.addedDate || new Date();
  const personalRows = [
    ['اسم الطالب', student.name],
    ['العمر', student.age ? `${student.age} سنة` : 'غير مسجل'],
    ['الحلقة / المعلم', `${className} - ${teacherLabel}`],
    ['رقم الهوية', student.nationalId || 'غير مسجل'],
    ['المستوى', levelNames[student.level] || student.level || 'غير محدد'],
    ['رقم جوال الطالب', student.studentPhone || 'غير مسجل'],
    ['رقم جوال ولي الأمر', student.guardianPhone || 'غير مسجل'],
    ['تاريخ التسجيل الميلادي', formatEnrollmentDate(registrationDateGregorian)],
    ['تاريخ التسجيل الهجري', student.registrationDateHijri || formatHijriDate(new Date())]
  ];
  const declarationPoints = [
    'الالتزام بوقت الحلقة من العصر إلى ما بعد العشاء، وصلاة العصر مع الجماعة الأولى، وعدم الانصراف قبل العشاء.',
    'عدم التأخر أكثر من 45 دقيقة بعد أذان العصر، وتُطبق لائحة التأخير.',
    'الالتزام بالزي: ثوب نظيف وطاقية.',
    'إحضار المصحف يوميًا.',
    'عدم إحضار الجوال، وتسليمه للإدارة عند إحضاره حتى الانصراف.',
    'عند الغياب أو التأخر بعذر، يتواصل ولي الأمر مع المعلم قبل أذان العصر في اليوم نفسه، ولا يُقبل الاعتذار عبر واتساب.',
    'احترام المعلم وتقديره.',
    'الالتزام بحسن السلوك والانضباط داخل الحلقة.'
  ];
  const element = document.createElement('div');
  element.className = 'student-enrollment-pdf';
  element.dir = 'rtl';
  element.innerHTML = `
    <section class="student-enrollment-page">
      <header class="enrollment-pdf-header">
        <div class="enrollment-pdf-kicker">جامع حمدة آل ثاني</div>
        <h1>استمارة تسجيل طالب بالحلقات</h1>
      </header>
      <section class="enrollment-pdf-section enrollment-pdf-personal">
        <h2>البيانات الشخصية</h2>
        <div class="enrollment-pdf-data">${personalRows.map(([label, value]) => `<div class="enrollment-pdf-data-item"><strong>${escapeEnrollmentHtml(label)}</strong><span>${escapeEnrollmentHtml(value)}</span></div>`).join('')}</div>
      </section>
      <section class="enrollment-pdf-section enrollment-pdf-declaration">
        <h2>إقرار وتعهد بالأنظمة</h2>
        <p class="enrollment-pdf-intro">أقر أنا الطالب وولي أمري بالاطلاع على الأنظمة التالية والالتزام بها:</p>
        <ul class="enrollment-pdf-rules">${declarationPoints.map(point => `<li>${escapeEnrollmentHtml(point)}</li>`).join('')}</ul>
      </section>
      <section class="enrollment-pdf-acknowledgements">
        <div class="enrollment-pdf-acknowledgement">
          <strong>إقرار الطالب</strong>
          <p>أتعهد أنا الطالب ${escapeEnrollmentHtml(student.name)} بالالتزام بالأنظمة أعلاه.</p>
          <div><span>التوقيع</span><i></i></div>
        </div>
        <div class="enrollment-pdf-acknowledgement">
          <strong>موافقة ولي الأمر</strong>
          <p>أوافق على التزام ابني بالأنظمة أعلاه.</p>
          <div><span>${escapeEnrollmentHtml(student.guardianName || '')}</span><i></i></div>
        </div>
      </section>
      <footer class="enrollment-pdf-manager-signature"><span>توقيع مدير الحلقات</span><strong>أ/عبدالمجيد هوساوي</strong><i></i></footer>
    </section>
  `;
  return element;
}

export async function createEnrollmentPdfBlob(student, classData = {}) {
  if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('مكتبات إنشاء PDF غير متاحة');

  const pdfElement = buildEnrollmentPdfElement(student, classData);
  pdfElement.style.position = 'fixed';
  pdfElement.style.left = '-10000px';
  pdfElement.style.top = '0';
  document.body.appendChild(pdfElement);

  try {
    const pages = [...pdfElement.querySelectorAll('.student-enrollment-page')];
    const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      if (pageIndex > 0) pdf.addPage();
      const canvas = await window.html2canvas(pages[pageIndex], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
    return pdf.output('blob');
  } finally {
    pdfElement.remove();
  }
}

export async function openEnrollmentPdf(student, classData = {}) {
  const pdfWindow = window.open('about:blank', '_blank');
  if (!pdfWindow) return false;

  try {
    const pdfBlob = await createEnrollmentPdfBlob(student, classData);
    const pdfUrl = URL.createObjectURL(pdfBlob);
    pdfWindow.location.href = pdfUrl;
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    return true;
  } catch (error) {
    pdfWindow.close();
    throw error;
  }
}
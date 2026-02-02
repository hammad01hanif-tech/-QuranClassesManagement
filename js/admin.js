// Admin Section JavaScript
import { 
  db, 
  collection, 
  collectionGroup,
  getDocs,
  getDoc,
  doc as firestoreDoc, 
  query, 
  where, 
  setDoc, 
  serverTimestamp,
  updateDoc,
  arrayUnion,
  deleteDoc,
  arrayRemove
} from '../firebase-config.js';

import { calculateRevisionPages } from './quran-juz-data.js';
import { formatHijriDate, gregorianToHijriDisplay, getHijriWeekAgo, getHijriMonthAgo, getStudyDaysInCurrentHijriMonth, getStudyDaysForHijriMonth, getTodayForStorage, getCurrentHijriDate, gregorianToHijri, hijriToGregorian as convertHijriToGregorian } from './hijri-date.js';
import { accurateHijriDates } from './accurate-hijri-dates.js';

// DOM Elements - will be initialized in initAdmin()
let classSelectAdd;
let classSelectView;
let classSelectReports;
let classSelectStruggling;
let studentSelectReports;
let studentsDiv;
let reportsContainer;
let strugglingReportsContainer;

let selectedClassId = null;
let listenersInitialized = false;

// Global variable to store current student ID for date range filter
window.currentAdminReportStudentId = null;

// Initialize admin section
export function initAdmin() {
  // Initialize DOM elements
  classSelectAdd = document.getElementById('classSelectAdd');
  classSelectView = document.getElementById('classSelectView');
  classSelectReports = document.getElementById('classSelectReports');
  classSelectStruggling = document.getElementById('classSelectStruggling');
  studentSelectReports = document.getElementById('studentSelectReports');
  studentsDiv = document.getElementById('students');
  reportsContainer = document.getElementById('reportsContainer');
  strugglingReportsContainer = document.getElementById('strugglingReportsContainer');
  
  loadClasses();
  loadAdminNotifications(); // Load notifications on init
  loadClassesManagement(); // Load classes management section
  if (!listenersInitialized) {
    setupEventListeners();
    listenersInitialized = true;
  }
}

// Load classes from Firebase
async function loadClasses() {
  classSelectAdd.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  classSelectView.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  classSelectReports.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  classSelectStruggling.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  
  const classSelectAttendance = document.getElementById('classSelectAttendance');
  if (classSelectAttendance) {
    classSelectAttendance.innerHTML = '<option value="">-- اختر الحلقة --</option>';
  }
  
  const snap = await getDocs(collection(db, 'classes'));
  snap.forEach(d => {
    const data = d.data();
    const cid = data.classId || d.id;
    const label = data.className || cid;
    
    // Add to all dropdowns
    const selects = [classSelectAdd, classSelectView, classSelectReports, classSelectStruggling];
    if (classSelectAttendance) selects.push(classSelectAttendance);
    
    selects.forEach(select => {
      const opt = document.createElement('option');
      opt.value = cid;
      opt.textContent = label;
      select.appendChild(opt);
    });
  });
}

// Add student function
window.addStudent = async function() {
  const name = document.getElementById("studentName").value.trim();
  const birthDate = document.getElementById("studentBirthDate").value;
  const nationalId = document.getElementById("studentNationalId").value.trim();
  const studentPhone = document.getElementById("studentPhone").value.trim();
  const guardianPhone = document.getElementById("guardianPhone").value.trim();
  const level = document.getElementById("studentLevel").value;
  const classId = document.getElementById("classSelectAdd").value;
  const result = document.getElementById("result");

  // Validation
  if (!name) {
    result.innerText = "❌ الرجاء إدخال اسم الطالب";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!birthDate) {
    result.innerText = "❌ الرجاء اختيار تاريخ الميلاد";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!guardianPhone) {
    result.innerText = "❌ الرجاء إدخال رقم جوال ولي الأمر";
    result.style.color = '#ff6b6b';
    return;
  }

  // Validate guardian phone format (10 digits)
  if (guardianPhone && !/^[0-9]{10}$/.test(guardianPhone)) {
    result.innerText = "❌ رقم جوال ولي الأمر يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }

  // Validate student phone format if provided (10 digits)
  if (studentPhone && !/^[0-9]{10}$/.test(studentPhone)) {
    result.innerText = "❌ رقم جوال الطالب يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!level) {
    result.innerText = "❌ الرجاء اختيار المستوى";
    result.style.color = '#ff6b6b';
    return;
  }

  if (!classId) {
    result.innerText = "❌ الرجاء اختيار الحلقة";
    result.style.color = '#ff6b6b';
    return;
  }

  try {
    result.innerText = "⏳ جاري إضافة الطالب...";
    result.style.color = '#667eea';

    // Generate unique student ID
    const randomNumber = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const userId = `${classId}_${randomNumber}`;

    // Calculate age from birth date
    const birthDateObj = new Date(birthDate);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = todayDate.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDateObj.getDate())) {
      age--;
    }

    // Get current Hijri date for registration date
    const registrationDateHijri = formatHijriDate(todayDate);

    // Prepare student data
    const studentData = {
      userId: userId,
      name: name,
      role: "student",
      classId: classId,
      birthDate: birthDate,
      age: age,
      guardianPhone: guardianPhone,
      level: level,
      createdAt: serverTimestamp(),
      registrationDateHijri: registrationDateHijri,
      monthlyScore: 0,
      rank: 0
    };

    // Add optional fields if provided
    if (nationalId) {
      studentData.nationalId = nationalId;
    }
    if (studentPhone) {
      studentData.studentPhone = studentPhone;
    }

    // Save to Firestore
    await setDoc(firestoreDoc(db, "users", userId), studentData);

    // Update class document with new student
    const classDocRef = firestoreDoc(db, "classes", classId);
    await updateDoc(classDocRef, {
      studentIds: arrayUnion(userId)
    });

    result.innerText = `✅ تم إضافة الطالب بنجاح: ${name} (${userId})`;
    result.style.color = '#51cf66';
    
    // Clear form
    document.getElementById("studentName").value = "";
    document.getElementById("studentBirthDate").value = "";
    document.getElementById("studentNationalId").value = "";
    document.getElementById("studentPhone").value = "";
    document.getElementById("guardianPhone").value = "";
    document.getElementById("studentLevel").value = "";
    document.getElementById("classSelectAdd").value = "";
    
    // Reload student list if viewing same class
    if (selectedClassId === classId) {
      loadStudentsForClass(classId);
    }
  } catch (error) {
    console.error("Error adding student:", error);
    result.innerText = "❌ خطأ في إضافة الطالب: " + error.message;
    result.style.color = '#ff6b6b';
  }
};

// Load students for a class
async function loadStudentsForClass(classId) {
  studentsDiv.innerHTML = 'جارٍ التحميل...';
  selectedClassId = classId;
  
  try {
    let q = query(collection(db, 'users'), where('classId', '==', classId));
    let snap = await getDocs(q);
    
    if (snap.empty) {
      studentsDiv.innerHTML = 'لا يوجد طلاب مُسجلين لهذه الحلقة.';
      return;
    }
    
    studentsDiv.innerHTML = '';
    const students = [];
    snap.forEach(d => {
      const dt = d.data();
      const id = d.id;
      const name = dt.name || '(بدون اسم)';
      const role = dt.role || '';
      const level = dt.level || 'غير محدد';
      const age = dt.age || '-';
      const guardianPhone = dt.guardianPhone || '-';
      if (role === 'student') {
        students.push({ 
          id, 
          name, 
          level, 
          age, 
          guardianPhone,
          fullData: dt 
        });
      }
    });
    
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    students.forEach(student => {
      const div = document.createElement('div');
      div.className = 'student-card-item';
      
      // Level badge with icon
      let levelBadge = '';
      let levelColor = '';
      if (student.level === 'hifz') {
        levelBadge = '📚 حفظ';
        levelColor = '#667eea';
      } else if (student.level === 'dabt') {
        levelBadge = '✨ ضبط';
        levelColor = '#f5576c';
      } else if (student.level === 'noorani') {
        levelBadge = '🌟 النورانية';
        levelColor = '#feca57';
      } else {
        levelBadge = student.level;
        levelColor = '#999';
      }
      
      div.innerHTML = `
        <div class="student-card-header">
          <div class="student-card-info">
            <div class="student-card-name">
              <strong style="font-size: 16px; color: #333;">${student.name}</strong>
              <span class="student-card-id" style="background: #f0f0f0; padding: 3px 10px; border-radius: 12px; font-size: 13px; color: #666;">${student.id}</span>
            </div>
            <div class="student-card-details" style="display: flex; gap: 15px; margin-top: 8px; flex-wrap: wrap;">
              <span style="background: ${levelColor}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">${levelBadge}</span>
              <span style="color: #666; font-size: 13px;">👤 العمر: ${student.age}</span>
              <span style="color: #666; font-size: 13px;">📱 ولي الأمر: ${student.guardianPhone}</span>
            </div>
          </div>
        </div>
        <div class="student-card-actions">
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn edit-btn" title="تعديل بيانات الطالب">
            ✏️
          </button>
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn transfer-btn" title="نقل لحلقة أخرى">
            🔄
          </button>
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn delete-btn" title="حذف الطالب">
            🗑️
          </button>
        </div>
      `;
      studentsDiv.appendChild(div);
      
      // Edit button event
      div.querySelector('.edit-btn').addEventListener('click', async (e) => {
        const studentId = e.target.dataset.id;
        await showEditStudentDialog(studentId, student.fullData);
      });
      
      // Transfer button event
      div.querySelector('.transfer-btn').addEventListener('click', async (e) => {
        const studentId = e.target.dataset.id;
        const studentName = e.target.dataset.name;
        await showTransferDialog(studentId, studentName);
      });
      
      // Delete button event
      div.querySelector('.delete-btn').addEventListener('click', async (e) => {
        const studentId = e.target.dataset.id;
        const studentName = e.target.dataset.name;
        if (confirm(`هل أنت متأكد من حذف الطالب "${studentName}" (${studentId})؟\nسيتم حذف جميع بياناته نهائياً.`)) {
          await deleteStudent(studentId, studentName);
        }
      });
    });
  } catch (error) {
    console.error('Error loading students:', error);
    studentsDiv.innerHTML = 'خطأ في تحميل الطلاب: ' + error.message;
  }
}

// Delete student
async function deleteStudent(studentId, studentName) {
  try {
    await deleteDoc(firestoreDoc(db, 'users', studentId));
    
    if (selectedClassId) {
      const classDocRef = firestoreDoc(db, 'classes', selectedClassId);
      await updateDoc(classDocRef, {
        studentIds: arrayRemove(studentId)
      });
    }
    
    alert(`تم حذف الطالب "${studentName}" (${studentId}) بنجاح`);
    
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    }
  } catch (error) {
    console.error('خطأ في حذف الطالب:', error);
    alert('حدث خطأ أثناء حذف الطالب: ' + error.message);
  }
}

// Show edit student dialog
async function showEditStudentDialog(studentId, studentData) {
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'editStudentModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; overflow-y: auto;';
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 20px 20px 0 0; position: sticky; top: 0; z-index: 1;">
        <h3 style="margin: 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
          ✏️ تعديل بيانات الطالب
        </h3>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${studentData.name} (${studentId})</p>
      </div>
      
      <div style="padding: 30px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> اسم الطالب
            </label>
            <input type="text" id="editStudentName" value="${studentData.name || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> تاريخ الميلاد
            </label>
            <input type="date" id="editBirthDate" value="${studentData.birthDate || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              رقم الهوية
            </label>
            <input type="text" id="editNationalId" value="${studentData.nationalId || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              رقم جوال الطالب
            </label>
            <input type="tel" id="editStudentPhone" value="${studentData.studentPhone || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> رقم جوال ولي الأمر
            </label>
            <input type="tel" id="editGuardianPhone" value="${studentData.guardianPhone || ''}" 
              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit;">
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 8px; color: #555; font-weight: bold; font-size: 14px;">
              <span style="color: #ff6b6b;">*</span> المستوى
            </label>
            <select id="editLevel" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit; background: white;">
              <option value="hifz" ${studentData.level === 'hifz' ? 'selected' : ''}>📚 حفظ</option>
              <option value="dabt" ${studentData.level === 'dabt' ? 'selected' : ''}>✨ ضبط</option>
              <option value="noorani" ${studentData.level === 'noorani' ? 'selected' : ''}>🌟 القاعدة النورانية</option>
            </select>
          </div>
        </div>
        
        <div id="editStudentResult" style="margin-top: 20px; text-align: center; font-weight: bold; font-size: 15px;"></div>
        
        <div style="display: flex; gap: 15px; margin-top: 30px; justify-content: center; flex-wrap: wrap;">
          <button onclick="saveStudentEdit('${studentId}')" 
            style="background: linear-gradient(135deg, #51cf66 0%, #2d7a44 100%); color: white; padding: 12px 40px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(45,122,68,0.3);">
            ✅ حفظ التعديلات
          </button>
          <button onclick="closeEditStudentModal()" 
            style="background: #6c757d; color: white; padding: 12px 40px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer;">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Save student edit
window.saveStudentEdit = async function(studentId) {
  const name = document.getElementById('editStudentName').value.trim();
  const birthDate = document.getElementById('editBirthDate').value;
  const nationalId = document.getElementById('editNationalId').value.trim();
  const studentPhone = document.getElementById('editStudentPhone').value.trim();
  const guardianPhone = document.getElementById('editGuardianPhone').value.trim();
  const level = document.getElementById('editLevel').value;
  const result = document.getElementById('editStudentResult');
  
  // Validation
  if (!name || !birthDate || !guardianPhone || !level) {
    result.innerText = "❌ الرجاء ملء جميع الحقول المطلوبة";
    result.style.color = '#ff6b6b';
    return;
  }
  
  if (guardianPhone && !/^[0-9]{10}$/.test(guardianPhone)) {
    result.innerText = "❌ رقم جوال ولي الأمر يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }
  
  if (studentPhone && !/^[0-9]{10}$/.test(studentPhone)) {
    result.innerText = "❌ رقم جوال الطالب يجب أن يكون 10 أرقام";
    result.style.color = '#ff6b6b';
    return;
  }
  
  try {
    result.innerText = "⏳ جاري حفظ التعديلات...";
    result.style.color = '#667eea';
    
    // Calculate age
    const birthDateObj = new Date(birthDate);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = todayDate.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && todayDate.getDate() < birthDateObj.getDate())) {
      age--;
    }
    
    // Update data
    const updateData = {
      name: name,
      birthDate: birthDate,
      age: age,
      guardianPhone: guardianPhone,
      level: level,
      lastModified: serverTimestamp()
    };
    
    if (nationalId) {
      updateData.nationalId = nationalId;
    } else {
      updateData.nationalId = deleteField();
    }
    
    if (studentPhone) {
      updateData.studentPhone = studentPhone;
    } else {
      updateData.studentPhone = deleteField();
    }
    
    await updateDoc(firestoreDoc(db, 'users', studentId), updateData);
    
    result.innerText = "✅ تم حفظ التعديلات بنجاح!";
    result.style.color = '#51cf66';
    
    setTimeout(() => {
      closeEditStudentModal();
      if (selectedClassId) {
        loadStudentsForClass(selectedClassId);
      }
    }, 1500);
    
  } catch (error) {
    console.error('Error updating student:', error);
    result.innerText = "❌ خطأ في حفظ التعديلات: " + error.message;
    result.style.color = '#ff6b6b';
  }
};

// Close edit modal
window.closeEditStudentModal = function() {
  const modal = document.getElementById('editStudentModal');
  if (modal) {
    modal.remove();
  }
};

// Show transfer dialog
async function showTransferDialog(studentId, studentName) {
  try {
    // Get all classes
    const classesSnap = await getDocs(collection(db, 'classes'));
    
    if (classesSnap.empty) {
      alert('لا توجد حلقات متاحة للنقل');
      return;
    }
    
    // Get student's current class
    const studentDoc = await getDoc(firestoreDoc(db, 'users', studentId));
    const currentClassId = studentDoc.data().classId;
    
    // Build classes list (exclude current class)
    let classesHTML = '<option value="">-- اختر الحلقة الجديدة --</option>';
    classesSnap.forEach(classDoc => {
      const classData = classDoc.data();
      const classId = classDoc.id;
      if (classId !== currentClassId) {
        classesHTML += `<option value="${classId}">${classData.name || classId}</option>`;
      }
    });
    
    // Create modal dialog
    const modalHTML = `
      <div id="transferModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; justify-content: center; align-items: center;">
        <div style="background: white; border-radius: 15px; padding: 30px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #17a2b8; padding-bottom: 15px;">
            <h3 style="margin: 0; color: #17a2b8;">🔄 نقل طالب</h3>
            <button onclick="document.getElementById('transferModal').remove()" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 35px; height: 35px; font-size: 20px; cursor: pointer;">×</button>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #666;"><strong>الطالب:</strong> ${studentName}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>الرقم:</strong> ${studentId}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-weight: bold; margin-bottom: 10px; color: #333;">اختر الحلقة الجديدة:</label>
            <select id="targetClassSelect" style="width: 100%; padding: 12px; border: 2px solid #17a2b8; border-radius: 8px; font-size: 16px;">
              ${classesHTML}
            </select>
          </div>
          
          <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              ⚠️ <strong>ملاحظة مهمة:</strong><br>
              • سيتم نقل الطالب للحلقة الجديدة<br>
              • <strong>جميع التقييمات والحضور السابق سيبقى محفوظاً</strong><br>
              • التقارير ستعرض فقط التقييمات من تاريخ النقل<br>
              • يمكن تتبع تاريخ النقل من سجل الطالب
            </p>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button onclick="executeTransfer('${studentId}', '${studentName}')" style="flex: 1; padding: 12px; background: #17a2b8; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
              ✅ تأكيد النقل
            </button>
            <button onclick="document.getElementById('transferModal').remove()" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px;">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
  } catch (error) {
    console.error('Error showing transfer dialog:', error);
    alert('حدث خطأ: ' + error.message);
  }
}

// Execute student transfer
window.executeTransfer = async function(studentId, studentName) {
  const targetClassSelect = document.getElementById('targetClassSelect');
  const targetClassId = targetClassSelect.value;
  
  if (!targetClassId) {
    alert('الرجاء اختيار الحلقة الجديدة');
    return;
  }
  
  try {
    // Get current date in Hijri format
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    // Get accurate Hijri date
    const currentHijri = getCurrentHijriDate();
    const hijriDate = currentHijri?.hijri || getTodayForStorage(); // YYYY-MM-DD
    const gregorianDate = today.toISOString().split('T')[0];
    
    // Get student data
    const studentRef = firestoreDoc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    
    if (!studentSnap.exists()) {
      alert('الطالب غير موجود');
      return;
    }
    
    const studentData = studentSnap.data();
    const oldClassId = studentData.classId;
    
    if (!oldClassId) {
      alert('الطالب غير مسجل في أي حلقة');
      return;
    }
    
    // Get class names for history
    const oldClassSnap = await getDoc(firestoreDoc(db, 'classes', oldClassId));
    const newClassSnap = await getDoc(firestoreDoc(db, 'classes', targetClassId));
    const oldClassName = oldClassSnap.exists() ? (oldClassSnap.data().name || oldClassId) : oldClassId;
    const newClassName = newClassSnap.exists() ? (newClassSnap.data().name || targetClassId) : targetClassId;
    
    // Prepare transfer history entry (ensure all values are defined)
    const transferEntry = {
      fromClassId: String(oldClassId),
      fromClassName: String(oldClassName),
      toClassId: String(targetClassId),
      toClassName: String(newClassName),
      transferDate: String(hijriDate),
      transferDateGregorian: String(gregorianDate),
      timestampMs: Date.now()
    };
    
    console.log('Transfer entry:', transferEntry); // Debug log
    
    // Update student document
    const updateData = {
      classId: targetClassId,
      lastTransferDate: hijriDate,
      lastTransferTimestamp: serverTimestamp(),
      transferHistory: arrayUnion(transferEntry)
    };
    
    // If no classHistory exists, initialize it
    if (!studentData.classHistory) {
      updateData.classHistory = [
        {
          classId: oldClassId,
          className: oldClassName,
          startDate: null, // Unknown start date for existing students
          endDate: hijriDate
        },
        {
          classId: targetClassId,
          className: newClassName,
          startDate: hijriDate,
          endDate: null // Current class
        }
      ];
    } else {
      // Update the end date of current class and add new class
      const classHistory = [...studentData.classHistory];
      const currentClassIndex = classHistory.findIndex(h => h.classId === oldClassId && !h.endDate);
      if (currentClassIndex !== -1) {
        classHistory[currentClassIndex].endDate = hijriDate;
      }
      classHistory.push({
        classId: targetClassId,
        className: newClassName,
        startDate: hijriDate,
        endDate: null
      });
      updateData.classHistory = classHistory;
    }
    
    await updateDoc(studentRef, updateData);
    
    // Update old class (remove student)
    const oldClassRef = firestoreDoc(db, 'classes', oldClassId);
    await updateDoc(oldClassRef, {
      studentIds: arrayRemove(studentId)
    });
    
    // Update new class (add student)
    const newClassRef = firestoreDoc(db, 'classes', targetClassId);
    await updateDoc(newClassRef, {
      studentIds: arrayUnion(studentId)
    });
    
    // Close modal
    document.getElementById('transferModal').remove();
    
    // Show success message
    alert(`✅ تم نقل الطالب "${studentName}" بنجاح\n\nمن: ${oldClassName}\nإلى: ${newClassName}\n\nالتاريخ: ${hijriDate}`);
    
    // Reload students list
    if (selectedClassId) {
      loadStudentsForClass(selectedClassId);
    }
    
  } catch (error) {
    console.error('Error transferring student:', error);
    alert('حدث خطأ أثناء نقل الطالب: ' + error.message);
  }
};

// Load students for reports tab
async function loadStudentsForReports(classId) {
  studentSelectReports.innerHTML = '<option value="">-- اختر طالب --</option>';
  reportsContainer.innerHTML = '<p class="small">اختر طالب لعرض تقاريره</p>';
  
  try {
    let q = query(collection(db, 'users'), where('classId', '==', classId), where('role', '==', 'student'));
    let snap = await getDocs(q);
    
    if (snap.empty) {
      studentSelectReports.innerHTML = '<option value="">لا يوجد طلاب</option>';
      return;
    }
    
    const students = [];
    snap.forEach(d => {
      const dt = d.data();
      students.push({ id: d.id, name: dt.name || '(بدون اسم)' });
    });
    
    students.sort((a, b) => a.id.localeCompare(b.id));
    
    students.forEach(student => {
      const opt = document.createElement('option');
      opt.value = student.id;
      opt.textContent = `${student.id} — ${student.name}`;
      studentSelectReports.appendChild(opt);
    });
  } catch (error) {
    console.error('Error loading students:', error);
    studentSelectReports.innerHTML = '<option value="">خطأ في التحميل</option>';
  }
}

// Load reports for selected student with month filter
window.loadReportsForStudent = async function(studentId, selectedMonthFilter = 'current-month', selectedDayFilter = 'all-days') {
  reportsContainer.innerHTML = '<p>جاري تحميل التقارير...</p>';
  
  // Store current studentId for filter callbacks
  window.currentAdminReportStudentId = studentId;
  
  try {
    // Get student data to check for transfer history
    const studentDoc = await getDoc(firestoreDoc(db, 'users', studentId));
    const studentData = studentDoc.data();
    
    // Load daily reports from database
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    // Load exam reports
    const examReportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'examReports'));
    
    // Build transfer history display
    let transferHistoryHTML = '';
    if (studentData.transferHistory && studentData.transferHistory.length > 0) {
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      
      transferHistoryHTML = `
        <div style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
          <h4 style="margin: 0 0 15px 0;">🔄 تاريخ النقل بين الحلقات</h4>
          <div style="display: grid; gap: 10px;">
      `;
      
      studentData.transferHistory.forEach((transfer, index) => {
        const [year, month, day] = transfer.transferDate.split('-');
        const monthName = hijriMonths[parseInt(month) - 1];
        const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
        
        transferHistoryHTML += `
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; border-right: 4px solid white;">
            <div style="font-size: 14px; opacity: 0.9;">النقل ${index + 1}</div>
            <div style="font-weight: bold; margin: 5px 0;">من: ${transfer.fromClassName} → إلى: ${transfer.toClassName}</div>
            <div style="font-size: 13px; opacity: 0.9;">📅 ${hijriDate}</div>
          </div>
        `;
      });
      
      transferHistoryHTML += `
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 13px;">
            ℹ️ التقارير أدناه تشمل جميع الفترات (قبل وبعد النقل)
          </div>
        </div>
      `;
    }
    
    // Get actual reports from database
    const actualReports = new Map();
    reportsSnap.forEach(d => {
      actualReports.set(d.id, d.data());
    });
    
    // Get study days based on selected month
    let allStudyDays = [];
    
    if (selectedMonthFilter === 'current-month') {
      // Get current month study days
      allStudyDays = getStudyDaysInCurrentHijriMonth();
    } else {
      // Get study days for selected month
      allStudyDays = getStudyDaysForHijriMonth(selectedMonthFilter);
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
    
    // Get current Hijri year
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
    
    // Populate month and day filters in the filter section
    const monthSelect = document.getElementById('adminReportsMonthFilter');
    monthSelect.innerHTML = '<option value="current-month">الشهر الحالي</option>';
    allMonths.forEach(month => {
      const displayText = `${month.name} ${month.year} هـ`;
      const option = document.createElement('option');
      option.value = month.key;
      option.textContent = displayText;
      if (selectedMonthFilter === month.key) {
        option.selected = true;
      }
      monthSelect.appendChild(option);
    });
    
    // Populate days filter
    const daySelect = document.getElementById('adminReportsDateFilter');
    daySelect.innerHTML = '<option value="all-days">جميع أيام الشهر</option>';
    allStudyDays.forEach(dateId => {
      const [y, m, d] = dateId.split('-').map(Number);
      const gregorianDate = convertHijriToGregorian(y, m, d);
      const dayOfWeek = gregorianDate.getDay();
      const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const dayName = dayNames[dayOfWeek];
      const monthName = hijriMonths[m - 1];
      const option = document.createElement('option');
      option.value = dateId;
      option.textContent = `${dayName} - ${d} ${monthName} ${y} هـ`;
      if (selectedDayFilter === dateId) {
        option.selected = true;
      }
      daySelect.appendChild(option);
    });
    
    // Show filters
    document.getElementById('adminReportsFilters').style.display = 'block';
    
    // Populate Hijri date range selects
    await populateHijriDateRangeFilters();
    
    // Set default date range (from start of current month to today)
    await setDefaultDateRange();
    
    // Hide harvest card and reports initially - show only after applying filter
    document.getElementById('studentStatsSummary').style.display = 'none';
    reportsContainer.innerHTML = '<div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 12px; margin-top: 20px;"><p style="font-size: 16px; color: #6c757d; margin: 0;">⚡ اختر فترة زمنية واضغط "🔍 تطبيق الفلتر" لعرض التقارير</p></div>';
    
    // Don't calculate statistics on initial load
    // const reportsForStats = completeReports.filter(r => r.hasReport);
    // calculateStudentStatistics(reportsForStats);
    
    // Don't show any reports or exams on initial load - user must apply filter first
    
  } catch (error) {
    console.error('Error loading reports for student:', error);
    reportsContainer.innerHTML = '<p style="color: #dc3545;">❌ حدث خطأ في تحميل البيانات</p>';
  }
};

// Calculate student statistics (weekly from Sunday-Thursday, monthly) based on Hijri calendar
function calculateStudentStatistics(reports) {
  const today = new Date();
  
  // Get current Hijri date using accurate calendar
  const currentHijri = gregorianToHijri(today);
  const currentHijriDate = currentHijri.formatted; // YYYY-MM-DD
  
  // Find the start of current study week (last Sunday)
  const currentDayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const daysToLastSunday = currentDayOfWeek; // If today is Sunday (0), daysToLastSunday = 0
  
  const weekStartDate = new Date(today);
  weekStartDate.setDate(weekStartDate.getDate() - daysToLastSunday);
  weekStartDate.setHours(0, 0, 0, 0); // Start of Sunday
  
  const weekStartHijri = gregorianToHijri(weekStartDate);
  const weekStartHijriDate = weekStartHijri.formatted; // YYYY-MM-DD
  
  // Calculate 30 days ago (approximate Hijri month) using Gregorian then convert to Hijri
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoHijri = gregorianToHijri(monthAgo);
  const monthAgoHijriDate = monthAgoHijri.formatted; // YYYY-MM-DD
  
  console.log('📅 Date ranges for statistics:');
  console.log('Current Hijri:', currentHijriDate);
  console.log('Week start (Sunday) Hijri:', weekStartHijriDate);
  console.log('Month ago Hijri:', monthAgoHijriDate);
  console.log('Current day of week:', currentDayOfWeek, '(0=Sun, 1=Mon, ..., 6=Sat)');
  
  let weeklyLessons = 0;
  let weeklyRevisionPages = 0;
  let monthlyLessons = 0;
  let monthlyRevisionPages = 0;
  
  reports.forEach(report => {
    const reportDateId = report.dateId; // This is in Hijri format: YYYY-MM-DD
    
    // Get the Gregorian date of the report to check day of week
    const [hijriYear, hijriMonth, hijriDay] = reportDateId.split('-').map(Number);
    const reportGregorian = convertHijriToGregorian(hijriYear, hijriMonth, hijriDay);
    const reportDayOfWeek = reportGregorian.getDay(); // 0=Sunday, 6=Saturday
    
    // Only count if it's a study day (Sunday=0 to Thursday=4)
    const isStudyDay = reportDayOfWeek >= 0 && reportDayOfWeek <= 4;
    
    // Count lessons based on score (every 5 points = 1 lesson)
    const lessonsFromScore = Math.floor((report.lessonScore || 0) / 5);
    
    // Also add extraLessonCount if it exists (for backward compatibility)
    const extraLessons = report.extraLessonCount || 0;
    const totalLessonsForDay = lessonsFromScore + extraLessons;
    
    // Log extra lesson details if available
    if (report.hasExtraLesson && extraLessons > 0) {
      console.log(`  ⭐ Extra Lesson: ${report.extraLessonFrom || ''} → ${report.extraLessonTo || ''}, Score: ${report.extraLessonScore || 0}, Count: ${extraLessons}`);
    }
    
    // Calculate revision pages
    let revisionPages = 0;
    if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    }
    
    // Weekly stats: from current week's Sunday to today, only study days (Sun-Thu)
    if (isStudyDay && reportDateId >= weekStartHijriDate && reportDateId <= currentHijriDate) {
      weeklyLessons += totalLessonsForDay;
      weeklyRevisionPages += revisionPages;
      console.log('📊 Weekly report:', reportDateId, '(Day:', reportDayOfWeek + ')', 'Lessons:', totalLessonsForDay, `(${lessonsFromScore}+${extraLessons})`, 'Pages:', revisionPages);
    }
    
    // Monthly stats (last 30 days, only study days)
    if (isStudyDay && reportDateId >= monthAgoHijriDate && reportDateId <= currentHijriDate) {
      monthlyLessons += totalLessonsForDay;
      monthlyRevisionPages += revisionPages;
      console.log('📈 Monthly report:', reportDateId, '(Day:', reportDayOfWeek + ')', 'Lessons:', totalLessonsForDay, `(${lessonsFromScore}+${extraLessons})`, 'Pages:', revisionPages);
    }
  });
  
  console.log('✅ Final statistics:');
  console.log('Weekly (Sun-Thu this week) - Lessons:', weeklyLessons, 'Pages:', weeklyRevisionPages);
  console.log('Monthly (last 30 days, Sun-Thu only) - Lessons:', monthlyLessons, 'Pages:', monthlyRevisionPages);
  
  // Update UI
  document.getElementById('studentStatsSummary').style.display = 'block';
  document.getElementById('harvestPeriodTitle').textContent = '📊 الحصاد الأسبوعي';
  document.getElementById('harvestPeriodSubtitle').textContent = 'من الأحد إلى الخميس';
  document.getElementById('periodLessonsCount').textContent = weeklyLessons;
  document.getElementById('periodRevisionPages').textContent = weeklyRevisionPages;
}

// Apply date range filter
window.applyAdminDateRangeFilter = async function() {
  const startDateSelect = document.getElementById('adminReportsStartDateHijri');
  const endDateSelect = document.getElementById('adminReportsEndDateHijri');
  const displayDiv = document.getElementById('dateRangeDisplay');
  
  const startDateHijri = startDateSelect.value; // Format: "1447-06-02"
  const endDateHijri = endDateSelect.value;
  
  if (!startDateHijri || !endDateHijri) {
    alert('⚠️ يرجى اختيار تاريخ البداية والنهاية');
    return;
  }
  
  if (startDateHijri > endDateHijri) {
    alert('⚠️ تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
    return;
  }
  
  const studentId = window.currentAdminReportStudentId;
  if (!studentId) {
    alert('⚠️ لم يتم اختيار طالب');
    return;
  }
  
  // Get display text from selected options
  const startDisplayText = startDateSelect.options[startDateSelect.selectedIndex].text;
  const endDisplayText = endDateSelect.options[endDateSelect.selectedIndex].text;
  
  displayDiv.innerHTML = `📅 الفترة: من ${startDisplayText} إلى ${endDisplayText}`;
  
  // Load reports with custom date range (using Hijri dates)
  await loadReportsForStudentCustomRange(studentId, startDateHijri, endDateHijri);
};

// Populate Hijri date range filters from accurate calendar
async function populateHijriDateRangeFilters() {
  try {
    // Import accurate Hijri dates
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    
    const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    const startDateSelect = document.getElementById('adminReportsStartDateHijri');
    const endDateSelect = document.getElementById('adminReportsEndDateHijri');
    
    // Clear existing options
    startDateSelect.innerHTML = '<option value="">-- اختر التاريخ --</option>';
    endDateSelect.innerHTML = '<option value="">-- اختر التاريخ --</option>';
    
    // Add all available dates from accurate calendar
    accurateHijriDates.forEach(dateEntry => {
      const [year, month, day] = dateEntry.hijri.split('-').map(Number);
      const monthName = hijriMonths[month - 1];
      
      // Get day of week
      const gregorianDate = new Date(dateEntry.gregorian + 'T12:00:00');
      const dayOfWeek = gregorianDate.getDay();
      const dayName = dayNames[dayOfWeek];
      
      const displayText = `${dayName} ${day} ${monthName} ${year} هـ`;
      
      // Create option for start date
      const startOption = document.createElement('option');
      startOption.value = dateEntry.hijri;
      startOption.textContent = displayText;
      startDateSelect.appendChild(startOption);
      
      // Create option for end date
      const endOption = document.createElement('option');
      endOption.value = dateEntry.hijri;
      endOption.textContent = displayText;
      endDateSelect.appendChild(endOption);
    });
    
  } catch (error) {
    console.error('Error populating Hijri date filters:', error);
  }
}

// Set default date range (from start of current month to today)
async function setDefaultDateRange() {
  try {
    const { accurateHijriDates, getTodayAccurateHijri } = await import('./accurate-hijri-dates.js');
    
    const today = getTodayAccurateHijri();
    const currentHijri = today.hijri; // Format: "1447-06-13"
    
    // Get current month start
    const [currentYear, currentMonth] = currentHijri.split('-');
    const monthStart = `${currentYear}-${currentMonth}-01`;
    
    // Find the first available date in current month
    let firstDateInMonth = null;
    for (const dateEntry of accurateHijriDates) {
      if (dateEntry.hijri.startsWith(`${currentYear}-${currentMonth}`)) {
        firstDateInMonth = dateEntry.hijri;
        break;
      }
    }
    
    // Set default values
    const startDateSelect = document.getElementById('adminReportsStartDateHijri');
    const endDateSelect = document.getElementById('adminReportsEndDateHijri');
    
    if (firstDateInMonth && startDateSelect && endDateSelect) {
      // Set start date to beginning of month
      startDateSelect.value = firstDateInMonth;
      
      // Set end date to today (or closest available date)
      let closestToToday = firstDateInMonth;
      for (const dateEntry of accurateHijriDates) {
        if (dateEntry.hijri <= currentHijri) {
          closestToToday = dateEntry.hijri;
        } else {
          break;
        }
      }
      endDateSelect.value = closestToToday;
      
      // Update display
      const startOption = startDateSelect.options[startDateSelect.selectedIndex];
      const endOption = endDateSelect.options[endDateSelect.selectedIndex];
      if (startOption && endOption) {
        const displayDiv = document.getElementById('dateRangeDisplay');
        displayDiv.innerHTML = `📅 الفترة الافتراضية: من ${startOption.text} إلى ${endOption.text}`;
      }
    }
    
  } catch (error) {
    console.error('Error setting default date range:', error);
  }
}

// Load reports for custom date range
async function loadReportsForStudentCustomRange(studentId, startDateHijri, endDateHijri) {
  const reportsContainer = document.getElementById('reportsContainer');
  reportsContainer.innerHTML = '<p>جاري تحميل التقارير...</p>';
  
  try {
    // Import accurate Hijri dates
    const { accurateHijriDates } = await import('./accurate-hijri-dates.js');
    
    // Get all reports from database
    const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
    
    const actualReports = new Map();
    reportsSnap.forEach(d => {
      actualReports.set(d.id, d.data());
    });
    
    // Get all study days in the date range using accurate dates
    const allStudyDaysSet = new Set(); // Use Set to prevent duplicates
    
    console.log('📅 Loading reports from', startDateHijri, 'to', endDateHijri);
    
    for (const dateEntry of accurateHijriDates) {
      // Check if date is within range
      if (dateEntry.hijri >= startDateHijri && dateEntry.hijri <= endDateHijri) {
        // Check if it's a study day (Sunday to Thursday)
        const gregorianDate = new Date(dateEntry.gregorian + 'T12:00:00');
        const dayOfWeek = gregorianDate.getDay();
        
        // Only include Sunday-Thursday (0,1,2,3,4)
        if (dayOfWeek >= 0 && dayOfWeek <= 4) {
          allStudyDaysSet.add(dateEntry.hijri);
          console.log('  ✅ Study day:', dateEntry.hijri, '(Day:', dayOfWeek + ')');
        } else {
          console.log('  ❌ Weekend:', dateEntry.hijri, '(Day:', dayOfWeek + ')');
        }
      }
    }
    
    // Convert Set to Array and sort
    const allStudyDays = Array.from(allStudyDaysSet).sort();
    console.log('✅ Total unique study days:', allStudyDays.length);
    
    // Create complete list of reports
    const completeReports = [];
    const seenDates = new Set(); // Track seen dates to prevent duplicates
    
    allStudyDays.forEach(dateId => {
      if (seenDates.has(dateId)) {
        console.warn('⚠️ Duplicate date detected:', dateId);
        return; // Skip duplicates
      }
      seenDates.add(dateId);
      
      // Find gregorianDate from accurate calendar
      const dateEntry = accurateHijriDates.find(d => d.hijri === dateId);
      const gregorianDate = dateEntry ? dateEntry.gregorian : null;
      
      if (actualReports.has(dateId)) {
        const reportData = actualReports.get(dateId);
        completeReports.push({ 
          dateId: dateId, 
          hasReport: true,
          gregorianDate: reportData.gregorianDate || gregorianDate, // Use from report or accurate calendar
          ...reportData 
        });
        console.log('📊 Report found for:', dateId);
      } else {
        completeReports.push({ 
          dateId: dateId, 
          hasReport: false,
          status: 'not-assessed',
          gregorianDate: gregorianDate // Add gregorian date for accurate day name
        });
        console.log('⏳ No report for:', dateId);
      }
    });
    
    // Sort by date
    completeReports.sort((a, b) => a.dateId.localeCompare(b.dateId));
    
    console.log('✅ Complete reports generated:', completeReports.length);
    
    // Store filtered reports globally for PDF export
    window.currentFilteredReports = completeReports;
    
    // Calculate statistics for this period
    const reportsForStats = completeReports.filter(r => r.hasReport);
    calculateCustomPeriodStatistics(reportsForStats, allStudyDays.length);
    
    // Generate reports table (without exam reports)
    const tableHTML = generateReportsTable(completeReports, allStudyDays.length);
    
    reportsContainer.innerHTML = tableHTML;
    
  } catch (error) {
    console.error('Error loading custom range reports:', error);
    reportsContainer.innerHTML = '<p style="color: #dc3545;">❌ حدث خطأ في تحميل التقارير</p>';
  }
}

// Calculate statistics for custom period
function calculateCustomPeriodStatistics(reports, totalDays) {
  let totalLessons = 0;
  let totalRevisionPages = 0;
  
  console.log('🔍 Calculating custom period statistics for', reports.length, 'reports');
  
  reports.forEach(report => {
    // Count lessons based on score (every 5 points = 1 lesson) - SAME as calculateHarvestStatistics
    const lessonScore = report.lessonScore || 0;
    const lessonsFromScore = Math.floor(lessonScore / 5);
    
    // Also add extraLessonCount if it exists (for backward compatibility)
    const extraLessons = report.extraLessonCount || 0;
    const totalLessonsForDay = lessonsFromScore + extraLessons;
    
    // Log details for debugging
    if (extraLessons > 0) {
      console.log(`  ⭐ ${report.dateId}: Extra Lesson Score=${report.extraLessonScore || 0}, Count=${extraLessons}, Range: ${report.extraLessonFrom || ''} → ${report.extraLessonTo || ''}`);
    }
    
    // Count revision pages - calculate from revisionFrom and revisionTo
    let revisionPages = 0;
    if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    }
    
    console.log(`  📊 ${report.dateId}: Lessons=${totalLessonsForDay} (score=${lessonScore}/5=${lessonsFromScore}, extra=${extraLessons}), Pages=${revisionPages}`);
    
    totalLessons += totalLessonsForDay;
    totalRevisionPages += revisionPages;
  });
  
  console.log('✅ Total: Lessons=' + totalLessons + ', Pages=' + totalRevisionPages);
  
  // Update UI with custom period stats and show harvest card
  document.getElementById('studentStatsSummary').style.display = 'block';
  
  // Get selected date range text from filter display
  const dateRangeDisplay = document.getElementById('dateRangeDisplay');
  const dateRangeText = dateRangeDisplay ? dateRangeDisplay.textContent.replace('📅 الفترة: ', '').replace('📅 الفترة الافتراضية: ', '') : '';
  
  // Update card title and subtitle
  document.getElementById('harvestPeriodTitle').textContent = '📊 حصاد الفترة المختارة';
  document.getElementById('harvestPeriodSubtitle').textContent = dateRangeText || `${totalDays} يوم دراسي`;
  
  // Update stats
  document.getElementById('periodLessonsCount').textContent = totalLessons;
  document.getElementById('periodRevisionPages').textContent = totalRevisionPages;
}

// Generate exam reports HTML
function generateExamReportsHTML(examReports) {
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  let html = `
    <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
      <h4 style="margin: 0 0 15px 0;">📝 درجات الاختبارات الشهرية</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
  `;
  
  examReports.forEach(exam => {
    const [year, month, day] = exam.dateId.split('-');
    const monthName = hijriMonths[parseInt(month) - 1];
    const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
    const passIcon = exam.isPassed ? '✅' : '❌';
    const passText = exam.isPassed ? 'ناجح' : 'راسب';
    const passColor = exam.isPassed ? '#4caf50' : '#f44336';
    
    html += `
      <div style="background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; color: #333;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: bold; color: #667eea;">📅 ${hijriDate}</span>
          <span style="background: ${passColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">${passIcon} ${passText}</span>
        </div>
        <div style="font-size: 28px; font-weight: bold; color: #764ba2; text-align: center; margin: 10px 0;">
          ${exam.finalScore.toFixed(1)} / ${exam.maxScore}
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; margin-top: 10px;">
          <div>تنبيه: <strong>${exam.errorCounts?.tanbih || 0}</strong></div>
          <div>خطأ: <strong>${exam.errorCounts?.khata || 0}</strong></div>
          <div>تجويد: <strong>${exam.errorCounts?.tajweed || 0}</strong></div>
          <div>لحن: <strong>${exam.errorCounts?.lahn || 0}</strong></div>
        </div>
      </div>
    `;
  });
  
  html += '</div></div>';
  return html;
}

// Generate reports table HTML
function generateReportsTable(completeReports, totalDays) {
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  let tableHTML = `
    <h4 style="margin: 20px 0 15px 0;">تقارير المتابعة (${totalDays} يوم دراسي)</h4>
    <table class="compact-reports-table keep-table" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
          <th style="padding: 12px; text-align: right; border-radius: 8px 0 0 0;">التاريخ</th>
          <th style="padding: 12px; text-align: center;">اليوم</th>
          <th style="padding: 12px; text-align: center; border-radius: 0 8px 0 0;">الحالة</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  completeReports.forEach((report, index) => {
    const [year, month, day] = report.dateId.split('-');
    const monthName = hijriMonths[parseInt(month) - 1];
    const fullHijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
    
    // Get day name - ALWAYS use accurate calendar first
    let dayName = 'غير محدد';
    
    // PRIORITY 1: Look up in accurate-hijri-dates.js (most accurate)
    const dateEntry = accurateHijriDates.find(d => d.hijri === report.dateId);
    let correctGregorianDate = dateEntry ? dateEntry.gregorian : report.gregorianDate;
    
    if (correctGregorianDate) {
      // Parse gregorianDate correctly (format: "YYYY-MM-DD")
      const [gYear, gMonth, gDay] = correctGregorianDate.split('-').map(Number);
      // Month is 0-indexed in JavaScript Date
      const gregorianDate = new Date(gYear, gMonth - 1, gDay, 12, 0, 0);
      dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      
      // Debug log - show if database was wrong
      if (dateEntry && report.gregorianDate !== dateEntry.gregorian) {
        console.log(`🔧 Fixed date: ${report.dateId} → DB:${report.gregorianDate} → Correct:${correctGregorianDate} → ${dayName}`);
      } else {
        console.log(`📅 ${report.dateId} → ${correctGregorianDate} → ${dayName} (Day: ${gregorianDate.getDay()})`);
      }
    } else {
      // Fallback: convert from Hijri
      const [y, m, d] = report.dateId.split('-').map(Number);
      const gregorianDate = convertHijriToGregorian(y, m, d);
      dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      console.log(`⚠️ No date found for ${report.dateId}, using conversion`);
    }
    
    const uniqueId = `admin-report-${report.dateId}-${index}`;
    const rowColor = index % 2 === 0 ? '#f8f9fa' : 'white';
    
    let statusHTML = '';
    let clickHandler = '';
    
    if (!report.hasReport) {
      statusHTML = '<span style="color: #856404; font-weight: bold;">⏳ لم يُقيّم</span>';
    } else if (report.status === 'absent') {
      statusHTML = '<span style="color: #dc3545; font-weight: bold;">❌ غائب</span>';
      clickHandler = `onclick="viewReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})"`;
    } else {
      const totalScore = report.totalScore || 0;
      // Calculate max score dynamically
      const lessonScore = report.lessonScore || 0;
      const mainLessonBonus = lessonScore > 5 ? lessonScore - 5 : 0;
      const extraLessonScore = report.extraLessonScore || 0;
      const maxScore = 30 + mainLessonBonus + extraLessonScore;
      const scorePercentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      const statusColor = scorePercentage >= 80 ? '#28a745' : (scorePercentage >= 50 ? '#ffc107' : '#dc3545');
      statusHTML = `<span style="color: ${statusColor}; font-weight: bold;">✅ ${totalScore}/${maxScore}</span>`;
      clickHandler = `onclick="viewReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})"`;
    }
    
    tableHTML += `
      <tr style="background: ${rowColor}; ${report.hasReport ? 'cursor: pointer;' : ''}" ${clickHandler}>
        <td style="padding: 12px;">${fullHijriDate}</td>
        <td style="padding: 12px; text-align: center;">${dayName}</td>
        <td style="padding: 12px; text-align: center;">${statusHTML}</td>
      </tr>
    `;
  });
  
  tableHTML += '</tbody></table>';
  return tableHTML;
}

// View report details
window.viewReportDetails = function(dateId, report) {
  // Format Hijri date properly
  const [year, month, day] = dateId.split('-');
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  const monthName = hijriMonths[parseInt(month) - 1];
  const hijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
  
  // Get day name
  let dayName = 'غير محدد';
  if (report.gregorianDate) {
    const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
    dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
  }
  
  // Check if student was absent
  if (report.status === 'absent') {
    const details = `
التاريخ الهجري: ${hijriDate}
اليوم: ${dayName}
اسم الطالب: ${report.studentName || 'غير محدد'}
رقم الطالب: ${report.studentId || 'غير محدد'}

❌ الطالب كان غائباً في هذا اليوم
    `;
    alert(details);
    return;
  }
  
  // Show normal assessment details
  const lessonScore = report.lessonScore || 0;
  const lessonsFromScore = Math.floor(lessonScore / 5);
  const extraLessons = report.extraLessonCount || 0;
  const totalLessonsForDay = lessonsFromScore + extraLessons;
  
  // Get extra lesson details
  const hasExtraLesson = report.hasExtraLesson || false;
  const extraLessonScore = report.extraLessonScore || 0;
  const extraLessonFrom = report.extraLessonFrom || '';
  const extraLessonTo = report.extraLessonTo || '';
  
  // Calculate revision pages
  let revisionPages = 0;
  if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
    try {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    } catch (e) {
      console.error('Error calculating revision pages:', e);
    }
  }
  
  // Calculate max score (base 30 + main lesson bonus + extra lesson)
  const mainLessonBonus = lessonScore > 5 ? lessonScore - 5 : 0;
  const maxScore = 30 + mainLessonBonus + extraLessonScore;
  
  // Build extra lesson section
  let extraLessonSection = '';
  if (hasExtraLesson && extraLessonScore > 0) {
    extraLessonSection = `
الدرس الإضافي: ${extraLessonScore}/20 (من ${extraLessonFrom || '-'} إلى ${extraLessonTo || '-'})
  └─ عدد الدروس الإضافية: ${extraLessons}`;
  }
  
  const details = `
التاريخ الهجري: ${hijriDate}
اليوم: ${dayName}
اسم الطالب: ${report.studentName || 'غير محدد'}
رقم الطالب: ${report.studentId || 'غير محدد'}

=== الدرجات ===
صلاة العصر: ${report.asrPrayerScore || 0}/5
الدرس: ${lessonScore}/25 (من ${report.lessonFrom || '-'} إلى ${report.lessonTo || '-'})
  └─ عدد الدروس من التقييم: ${lessonsFromScore}${extraLessonSection}
جنب الدرس: ${report.lessonSideScore || 0}/5 (${report.lessonSideText || '-'})
المراجعة: ${report.revisionScore || 0}/5 (من ${report.revisionFrom || '-'} إلى ${report.revisionTo || '-'})
  └─ عدد صفحات المراجعة: ${revisionPages}
القراءة بالنظر: ${report.readingScore || 0}/5
السلوك: ${report.behaviorScore || 0}/10

════════════════════
إجمالي عدد الدروس المنجزة: ${totalLessonsForDay} (${lessonsFromScore} أساسي + ${extraLessons} إضافي)
المجموع الكلي: ${report.totalScore || 0}/${maxScore}
  `;
  alert(details);
};

// Setup event listeners
function setupEventListeners() {
  classSelectView.addEventListener('change', (e) => {
    const cid = e.target.value;
    if (!cid) { 
      studentsDiv.innerHTML = 'اختر حلقة.'; 
      return; 
    }
    loadStudentsForClass(cid);
  });

  classSelectReports.addEventListener('change', (e) => {
    const cid = e.target.value;
    if (!cid) {
      studentSelectReports.innerHTML = '<option value="">-- اختر طالب --</option>';
      reportsContainer.innerHTML = '<p class="small">اختر حلقة أولاً</p>';
      return;
    }
    loadStudentsForReports(cid);
  });

  studentSelectReports.addEventListener('change', (e) => {
    const sid = e.target.value;
    if (!sid) {
      reportsContainer.innerHTML = '<p class="small">اختر طالب لعرض تقاريره</p>';
      return;
    }
    loadReportsForStudent(sid);
  });
}

// Load struggling students reports
window.loadStrugglingReports = async function() {
  const classId = classSelectStruggling.value;
  
  if (!classId) {
    strugglingReportsContainer.innerHTML = '<p class="small">اختر حلقة لعرض تقارير الطلاب المتعثرين</p>';
    return;
  }
  
  try {
    // Get all struggling reports for this class
    const q = query(
      collection(db, 'strugglingReports'),
      where('classId', '==', classId)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
      strugglingReportsContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; background: #f0f8ff; border-radius: 10px; margin-top: 20px;">
          <p style="font-size: 18px; color: #51cf66;">✅ لا توجد تقارير تعثر لهذه الحلقة</p>
        </div>
      `;
      return;
    }
    
    // Group reports by date
    const reportsByDate = {};
    snap.forEach(doc => {
      const data = doc.data();
      const dateKey = data.dateId || data.date; // Use dateId (Hijri format)
      if (!reportsByDate[dateKey]) {
        reportsByDate[dateKey] = [];
      }
      reportsByDate[dateKey].push(data);
    });
    
    // Sort dates descending (newest first)
    const sortedDates = Object.keys(reportsByDate).sort().reverse();
    
    let html = '';
    sortedDates.forEach(dateKey => {
      const reports = reportsByDate[dateKey];
      const firstReport = reports[0];
      
      // Use the pre-formatted hijriDate and dayName from the report
      const hijriDate = firstReport.date || 'تاريخ غير محدد';
      const dayName = firstReport.dayName || '';
      const fullHijriDisplay = dayName ? `${dayName} ${hijriDate}` : hijriDate;
      
      reports.forEach(report => {
        const reportId = `${report.classId}_${report.dateId || dateKey}`;
        
        html += `
          <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffe6e6 100%); border: 2px solid #ff6b6b; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 3px 10px rgba(255,107,107,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0; color: #d32f2f;">⚠️ تقرير التعثرات</h3>
              <div style="display: flex; gap: 10px; align-items: center;">
                <span style="background: white; padding: 8px 15px; border-radius: 8px; font-weight: bold; color: #666;">📅 ${fullHijriDisplay}</span>
                <button onclick="window.deleteStrugglingReport('${reportId}')" style="background: #dc3545; color: white; padding: 8px 15px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
                  🗑️ حذف التقرير
                </button>
              </div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
              <p style="margin: 5px 0; font-size: 16px;"><strong>👨‍🏫 المعلم:</strong> ${report.teacherName || report.teacherId}</p>
              <p style="margin: 5px 0; font-size: 16px;"><strong>📚 الحلقة:</strong> ${report.classId}</p>
              <p style="margin: 5px 0; font-size: 16px;"><strong>📊 عدد الطلاب المتعثرين:</strong> ${report.students?.length || report.totalCount || 1}</p>
            </div>
            <div style="background: white; padding: 15px; border-radius: 10px;">
              <h4 style="margin-top: 0; color: #d32f2f;">قائمة الطلاب المتعثرين:</h4>
              ${(report.students || [{ name: report.studentName, issues: report.issues, scores: report.scores, totalScore: report.totalScore }]).map(student => `
                <div style="background: #fff; border: 2px solid #ffcccb; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                  <h4 style="margin: 0 0 10px 0; color: #d32f2f; font-size: 18px;">👤 ${student.name || 'غير محدد'}</h4>
                  <div style="margin-top: 10px;">
                    <strong style="color: #555;">التعثرات:</strong><br>
                    ${(student.issues || []).map(issue => `
                      <span style="background: #ffe6e6; padding: 6px 12px; border-radius: 6px; display: inline-block; margin: 5px; font-size: 14px; color: #d32f2f;">
                        ${issue}
                      </span>
                    `).join('')}
                  </div>
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ffcccb;">
                    <p style="margin: 3px 0; font-size: 14px; color: #666;">
                      <strong>الدرس:</strong> ${student.scores?.lesson || 0}/5 | 
                      <strong>جنب الدرس:</strong> ${student.scores?.lessonSide || 0}/5 | 
                      <strong>المراجعة:</strong> ${student.scores?.revision || 0}/5
                    </p>
                    <p style="margin: 3px 0; font-size: 14px; color: #666;">
                      <strong>المجموع:</strong> ${student.totalScore || 0}
                    </p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    });
    
    strugglingReportsContainer.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading struggling reports:', error);
    strugglingReportsContainer.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #ffe6e6; border-radius: 10px; margin-top: 20px;">
        <p style="color: #d32f2f;">❌ حدث خطأ في تحميل التقارير</p>
      </div>
    `;
  }
  
  // Load absent students reports (only if container exists)
  const absentContainer = document.getElementById('absentStudentsReportsContainer');
  if (absentContainer) {
    loadAbsentStudentsReports();
  }
};

// Load absent students reports
async function loadAbsentStudentsReports() {
  const container = document.getElementById('absentStudentsReportsContainer');
  
  if (!container) {
    console.log('absentStudentsReportsContainer not found in page');
    return;
  }
  
  try {
    container.innerHTML = '<p class="small">جاري تحميل تقارير الغياب...</p>';
    
    const snap = await getDocs(collection(db, 'absentStudentsReports'));
    
    if (snap.empty) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; background: #f0f8ff; border-radius: 10px;">
          <p style="font-size: 18px; color: #51cf66;">✅ لا توجد تقارير غياب</p>
        </div>
      `;
      return;
    }
    
    const reports = [];
    snap.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by reportDate (Hijri format) descending
    reports.sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">';
    
    reports.forEach(report => {
      // Use pre-formatted date from report or format gregorianDate
      let displayDate = 'تاريخ غير محدد';
      if (report.reportDate) {
        displayDate = report.reportDate; // Already in Hijri format
      } else if (report.gregorianDate) {
        try {
          displayDate = gregorianToHijriDisplay(report.gregorianDate);
        } catch (e) {
          console.error('Error converting date:', e);
        }
      }
      
      html += `
        <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border: 2px solid #ff9800; border-radius: 12px; padding: 20px; box-shadow: 0 3px 10px rgba(255,152,0,0.2);">
          <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
            <h4 style="margin: 0; color: #e65100;">📅 تقرير غياب</h4>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <p style="margin: 5px 0; font-size: 15px;"><strong>👤 الطالب:</strong> ${report.studentName}</p>
            <p style="margin: 5px 0; font-size: 15px;"><strong>📚 الحلقة:</strong> ${report.classId}</p>
            <p style="margin: 5px 0; font-size: 15px;"><strong>👨‍🏫 المعلم:</strong> ${report.teacherName}</p>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px;">
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>📆 الشهر:</strong> ${report.month || 'غير محدد'}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #666;"><strong>📅 تاريخ التقرير:</strong> ${displayDate}</p>
            <div style="margin-top: 10px; padding: 10px; background: #ffebee; border-radius: 6px; text-align: center;">
              <span style="font-size: 24px; font-weight: bold; color: #d32f2f;">${report.absentCount || 0}</span>
              <span style="font-size: 14px; color: #666; display: block; margin-top: 5px;">أيام غياب</span>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading absent reports:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #ffe6e6; border-radius: 10px;">
        <p style="color: #d32f2f;">❌ حدث خطأ في تحميل تقارير الغياب</p>
      </div>
    `;
  }
}

// Load admin attendance report
window.loadAdminAttendanceReport = async function() {
  console.log('🔵 loadAdminAttendanceReport: Start');
  const classId = document.getElementById('classSelectAttendance').value;
  console.log('🔵 classId:', classId);
  const reportSection = document.getElementById('adminAttendanceReportSection');
  console.log('🔵 reportSection:', reportSection);
  
  if (!classId) {
    console.log('⚠️ No classId, hiding report section');
    reportSection.style.display = 'none';
    return;
  }
  
  console.log('✅ Showing report section');
  reportSection.style.display = 'block';
  
  // Get teacher name
  try {
    const classDoc = await getDocs(query(collection(db, 'classes'), where('classId', '==', classId)));
    let teacherName = 'غير محدد';
    
    if (!classDoc.empty) {
      const classData = classDoc.docs[0].data();
      const teacherId = classData.teacherId;
      
      if (teacherId) {
        const teacherDoc = await getDocs(query(collection(db, 'users'), where('teacherId', '==', teacherId)));
        if (!teacherDoc.empty) {
          teacherName = teacherDoc.docs[0].data().name || teacherId;
        }
      }
    }
    
    document.getElementById('adminAttendanceTeacherName').textContent = teacherName;
    console.log('✅ Teacher name set:', teacherName);
    
    // Populate month filter
    console.log('🔵 Calling populateAdminMonthFilter...');
    await populateAdminMonthFilter();
    console.log('✅ loadAdminAttendanceReport: Complete');
    
  } catch (error) {
    console.error('❌ Error loading attendance report:', error);
    alert('حدث خطأ في تحميل التقرير');
  }
};

// Populate admin month filter
async function populateAdminMonthFilter() {
  console.log('🔵 populateAdminMonthFilter: Start');
  const select = document.getElementById('adminAbsenceMonthFilter');
  console.log('🔵 Month select element:', select);
  const today = new Date();
  
  // Get current Hijri date
  const currentHijriDate = gregorianToHijri(today);
  console.log('🔵 Current Hijri Date:', currentHijriDate);
  
  // Create list of last 6 months including current month
  const months = [];
  for (let i = 0; i < 6; i++) {
    const monthDate = new Date(today);
    monthDate.setMonth(today.getMonth() - i);
    const hijriDate = gregorianToHijri(monthDate);
    
    const hijriMonthNames = [
      'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
      'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
    ];
    
    const monthName = hijriMonthNames[hijriDate.month - 1];
    const monthValue = `${hijriDate.year}-${String(hijriDate.month).padStart(2, '0')}`;
    
    months.push({
      value: monthValue,
      text: `${monthName} ${hijriDate.year} هـ`
    });
  }
  
  select.innerHTML = months.map((month, index) => 
    `<option value="${month.value}" ${index === 0 ? 'selected' : ''}>${month.text}</option>`
  ).join('');
  console.log('✅ Month options populated:', months.length, 'months');
  
  // Load days for current month
  console.log('🔵 Calling populateAdminDaysFilter...');
  await populateAdminDaysFilter();
  console.log('✅ populateAdminMonthFilter: Complete');
}

// Populate admin days filter based on selected month
window.populateAdminDaysFilter = async function() {
  console.log('🔵 populateAdminDaysFilter: Start');
  const monthValue = document.getElementById('adminAbsenceMonthFilter').value;
  console.log('🔵 Month value:', monthValue);
  const select = document.getElementById('adminAbsenceDateFilter');
  console.log('🔵 Day select element:', select);
  
  if (!monthValue) {
    console.log('⚠️ No month value, returning');
    return;
  }
  
  const [year, month] = monthValue.split('-').map(Number);
  
  // Get all study days in the selected month
  const studyDays = getStudyDaysInHijriMonth(year, month);
  
  // Build options
  let options = '<option value="all-days">جميع أيام الشهر</option>';
  
  const hijriMonthNames = [
    'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  for (const dateId of studyDays) {
    const [y, m, d] = dateId.split('-').map(Number);
    const gregorianDate = convertHijriToGregorian(y, m, d);
    const dayOfWeek = gregorianDate.getDay();
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = dayNames[dayOfWeek];
    const monthName = hijriMonthNames[m - 1];
    
    options += `<option value="${dateId}">${dayName} - ${d} ${monthName} ${y} هـ</option>`;
  }
  
  select.innerHTML = options;
  console.log('✅ Day options populated');
  
  // Load report for selected month
  console.log('🔵 Calling filterAdminAbsenceReport...');
  await filterAdminAbsenceReport();
  console.log('✅ populateAdminDaysFilter: Complete');
};

// Get study days in a specific Hijri month
function getStudyDaysInHijriMonth(year, month) {
  console.log('🔵 getStudyDaysInHijriMonth:', year, month);
  
  // Use accurate Hijri calendar from hijri-date.js
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const studyDays = getStudyDaysForHijriMonth(monthKey);
  
  console.log('✅ Study days found from accurate calendar:', studyDays.length);
  return studyDays;
}

// Filter admin absence report
window.filterAdminAbsenceReport = async function() {
  console.log('🔵 filterAdminAbsenceReport: Start');
  const classId = document.getElementById('classSelectAttendance').value;
  console.log('🔵 classId:', classId);
  const filterValue = document.getElementById('adminAbsenceDateFilter').value;
  console.log('🔵 filterValue:', filterValue);
  const tbody = document.getElementById('adminAttendanceTableBody');
  console.log('🔵 tbody element:', tbody);
  const statsContainer = document.getElementById('absenceStatsContainer');
  console.log('🔵 statsContainer:', statsContainer);
  
  if (!classId) {
    console.log('⚠️ No classId, returning');
    return;
  }
  
  tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #999;">جاري تحميل البيانات...</td></tr>';
  if (statsContainer) statsContainer.style.display = 'none';
  
  try {
    // Get all students in the class with their guardian phone
    console.log('🔵 Fetching students for class:', classId);
    const studentsSnap = await getDocs(query(collection(db, 'users'), where('classId', '==', classId), where('role', '==', 'student')));
    console.log('🔵 Students found:', studentsSnap.size);
    
    if (studentsSnap.empty) {
      console.log('⚠️ No students found');
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #999;">لا يوجد طلاب في هذه الحلقة</td></tr>';
      return;
    }
    
    // Get date range based on filter
    let dateIds = [];
    
    if (filterValue === 'all-days') {
      // All study days in selected month
      const monthValue = document.getElementById('adminAbsenceMonthFilter').value;
      console.log('🔵 Getting all days for month:', monthValue);
      const [year, month] = monthValue.split('-').map(Number);
      dateIds = getStudyDaysInHijriMonth(year, month);
    } else {
      // Specific date selected
      console.log('🔵 Using specific date:', filterValue);
      dateIds = [filterValue];
    }
    console.log('🔵 Date IDs to check:', dateIds);
    
    // Collect absence data
    const absenceData = new Map(); // studentId -> {name, guardianPhone, withExcuse, withoutExcuse}
    let totalPresent = 0;
    let totalWithExcuse = 0;
    let totalWithoutExcuse = 0;
    
    // Create student map for quick lookup
    const studentMap = new Map();
    studentsSnap.docs.forEach(doc => {
      const data = doc.data();
      studentMap.set(doc.id, {
        name: data.name || 'غير محدد',
        guardianPhone: data.guardianPhone || ''
      });
    });
    
    console.log('🔵 Student map created:', studentMap.size, 'students');
    
    // Get ALL daily reports using collectionGroup (more efficient)
    console.log('🔵 Fetching all daily reports...');
    const allReportsSnap = await getDocs(collectionGroup(db, 'dailyReports'));
    console.log('🔵 Total reports fetched:', allReportsSnap.size);
    
    // Filter reports by class students and date range
    allReportsSnap.forEach(doc => {
      const reportData = doc.data();
      const dateId = doc.id;
      
      // Check if this report is in our date range
      if (!dateIds.includes(dateId)) {
        return;
      }
      
      // Extract student ID from path: studentProgress/{studentId}/dailyReports/{dateId}
      const pathParts = doc.ref.path.split('/');
      if (pathParts.length >= 4 && pathParts[0] === 'studentProgress') {
        const studentId = pathParts[1];
        
        // Check if student belongs to this class
        if (!studentMap.has(studentId)) {
          return;
        }
        
        // Initialize student in absenceData if not exists
        if (!absenceData.has(studentId)) {
          absenceData.set(studentId, {
            name: studentMap.get(studentId).name,
            guardianPhone: studentMap.get(studentId).guardianPhone,
            withExcuse: 0,
            withoutExcuse: 0
          });
        }
        
        // Count by status
        if (reportData.status === 'absent') {
          if (reportData.excuseType === 'withExcuse') {
            absenceData.get(studentId).withExcuse++;
            totalWithExcuse++;
          } else {
            absenceData.get(studentId).withoutExcuse++;
            totalWithoutExcuse++;
          }
        } else if (reportData.status === 'present') {
          totalPresent++;
        }
      }
    });
    
    console.log('🔵 Absence data processed:', absenceData.size, 'students with absences');
    console.log('🔵 Total stats - Present:', totalPresent, 'WithExcuse:', totalWithExcuse, 'WithoutExcuse:', totalWithoutExcuse);
    
    // Show statistics
    if (statsContainer) {
      statsContainer.style.display = 'block';
      document.getElementById('totalPresentCount').textContent = totalPresent;
      document.getElementById('totalWithExcuseCount').textContent = totalWithExcuse;
      document.getElementById('totalWithoutExcuseCount').textContent = totalWithoutExcuse;
      console.log('✅ Statistics displayed');
    }
    
    // Display list
    if (absenceData.size === 0) {
      console.log('ℹ️ No absences found');
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #51cf66; font-weight: bold;">✅ لا يوجد طلاب غائبين في هذه الفترة</td></tr>';
      return;
    }
    
    console.log('🔵 Building table for', absenceData.size, 'absent students...');
    
    // Convert to array and filter students with actual absences, then sort by total absences
    const absenceArray = Array.from(absenceData.entries())
      .map(([id, data]) => ({
        id,
        ...data,
        totalAbsence: data.withExcuse + data.withoutExcuse
      }))
      .filter(student => student.totalAbsence > 0) // Only students with absences
      .sort((a, b) => b.totalAbsence - a.totalAbsence);
    
    console.log('🔵 Students with absences after filter:', absenceArray.length);
    
    // Check again after filter
    if (absenceArray.length === 0) {
      console.log('ℹ️ No students with absences after filter');
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #51cf66; font-weight: bold;">✅ لا يوجد طلاب غائبين في هذه الفترة</td></tr>';
      return;
    }
    
    // Build 3-column table with expandable details
    const tableHTML = absenceArray.map((student, index) => {
      const uniqueId = `admin-absence-${student.id}`;
      const rowColor = index % 2 === 0 ? '#f8f9fa' : 'white';
      
      return `
        <tr class="clickable-row" onclick="toggleAdminAbsenceDetails('${uniqueId}')" style="background: ${rowColor}; cursor: pointer; transition: all 0.2s;">
          <td style="padding: 10px; text-align: right; border: 1px solid #ddd; font-weight: bold;">${student.name}</td>
          <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
            <span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 15px; font-weight: bold;">${student.withExcuse}</span>
          </td>
          <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
            <span style="background: #ff6b6b; color: white; padding: 5px 12px; border-radius: 15px; font-weight: bold;">${student.withoutExcuse}</span>
          </td>
        </tr>
        <tr id="${uniqueId}" class="details-row" style="display: none;">
          <td colspan="3" style="padding: 15px; background: #f8f9fa; border: 1px solid #ddd;">
            <div style="background: white; padding: 15px; border-radius: 8px;">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 12px;">
                <div style="background: #e8f5e9; padding: 12px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 11px; color: #666; margin-bottom: 4px;">📄 بعذر</div>
                  <div style="font-size: 24px; font-weight: bold; color: #667eea;">${student.withExcuse}</div>
                </div>
                <div style="background: #ffebee; padding: 12px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 11px; color: #666; margin-bottom: 4px;">⚠️ بدون عذر</div>
                  <div style="font-size: 24px; font-weight: bold; color: #ff6b6b;">${student.withoutExcuse}</div>
                </div>
                <div style="background: #fff3e0; padding: 12px; border-radius: 6px; text-align: center;">
                  <div style="font-size: 11px; color: #666; margin-bottom: 4px;">🔢 الإجمالي</div>
                  <div style="font-size: 24px; font-weight: bold; color: #ffa726;">${student.totalAbsence}</div>
                </div>
              </div>
              ${student.guardianPhone ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
                  <a href="tel:${student.guardianPhone}" style="background: #007bff; color: white; padding: 10px; border-radius: 8px; text-decoration: none; text-align: center; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    📞 ${student.guardianPhone}
                  </a>
                  <a href="https://wa.me/966${student.guardianPhone.replace(/^0/, '')}" target="_blank" style="background: #25D366; color: white; padding: 10px; border-radius: 8px; text-decoration: none; text-align: center; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    💬 واتساب
                  </a>
                </div>
              ` : '<div style="text-align: center; color: #999; margin-top: 10px; font-size: 13px;">لا يوجد رقم جوال لولي الأمر</div>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    console.log('🔵 Table HTML length:', tableHTML.length, 'characters');
    console.log('🔵 First 200 chars:', tableHTML.substring(0, 200));
    tbody.innerHTML = tableHTML;
    
    console.log('✅ Table generated for', absenceArray.length, 'students');
    console.log('✅ filterAdminAbsenceReport: Complete');
    
  } catch (error) {
    console.error('❌ Error filtering absence report:', error);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ff6b6b;">حدث خطأ في تحميل البيانات</td></tr>';
  }
};

// Toggle admin absence details
window.toggleAdminAbsenceDetails = function(uniqueId) {
  const detailsRow = document.getElementById(uniqueId);
  if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
    detailsRow.style.display = 'table-row';
  } else {
    detailsRow.style.display = 'none';
  }
};

// Toggle admin notifications panel
window.toggleAdminNotifications = function() {
  const modal = document.getElementById('adminNotificationsModal');
  if (modal.style.display === 'none' || modal.style.display === '') {
    modal.style.display = 'block';
    loadAdminNotifications();
  } else {
    modal.style.display = 'none';
  }
};

// Load admin notifications
async function loadAdminNotifications() {
  const notificationsList = document.getElementById('adminNotificationsList');
  const badge = document.getElementById('adminNotificationBadge');
  
  try {
    const notificationsSnap = await getDocs(query(collection(db, 'adminNotifications'), where('read', '==', false)));
    
    if (notificationsSnap.empty) {
      notificationsList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">لا توجد إشعارات</p>';
      badge.style.display = 'none';
      return;
    }
    
    const notifications = [];
    notificationsSnap.forEach(doc => {
      notifications.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort by timestamp descending
    notifications.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toDate() - a.timestamp.toDate();
      }
      return 0;
    });
    
    // Update badge
    badge.textContent = notifications.length;
    badge.style.display = 'flex';
    
    // Display notifications
    let html = '';
    notifications.forEach(notification => {
      const bgColor = notification.type === 'not-assessed' ? '#fff3cd' : '#f8d7da';
      const borderColor = notification.type === 'not-assessed' ? '#ffc107' : '#dc3545';
      const icon = notification.type === 'not-assessed' ? '⚠️' : '❌';
      
      html += `
        <div style="background: ${bgColor}; border-right: 4px solid ${borderColor}; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <strong style="font-size: 14px;">${icon} ${notification.title}</strong>
            <button onclick="window.deleteAdminNotification('${notification.id}')" style="background: transparent; border: none; color: #999; cursor: pointer; font-size: 18px;">×</button>
          </div>
          <p style="margin: 5px 0; font-size: 13px; color: #333;">${notification.message}</p>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">📅 ${notification.date || ''} - ${notification.dayName || ''}</p>
        </div>
      `;
    });
    
    notificationsList.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading admin notifications:', error);
    notificationsList.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">حدث خطأ في تحميل الإشعارات</p>';
  }
}

// Mark all admin notifications as read
window.markAllAdminNotificationsAsRead = async function() {
  try {
    const notificationsSnap = await getDocs(query(collection(db, 'adminNotifications'), where('read', '==', false)));
    
    const updates = [];
    notificationsSnap.forEach(doc => {
      updates.push(updateDoc(doc.ref, { read: true }));
    });
    
    await Promise.all(updates);
    
    loadAdminNotifications();
    
  } catch (error) {
    console.error('Error marking notifications as read:', error);
  }
};

// Delete admin notification
window.deleteAdminNotification = async function(notificationId) {
  try {
    await deleteDoc(firestoreDoc(db, 'adminNotifications', notificationId));
    loadAdminNotifications();
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

// Delete struggling report
window.deleteStrugglingReport = async function(reportId) {
  if (!confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
    return;
  }
  
  try {
    await deleteDoc(firestoreDoc(db, 'strugglingReports', reportId));
    alert('✅ تم حذف التقرير بنجاح');
    
    // Reload reports
    const classFilter = document.getElementById('strugglingClassFilter');
    if (classFilter && classFilter.value) {
      window.loadStrugglingReports(classFilter.value);
    }
  } catch (error) {
    console.error('Error deleting struggling report:', error);
    alert('❌ حدث خطأ في حذف التقرير');
  }
};

// Update notification badge periodically
setInterval(() => {
  updateAdminNotificationBadge();
}, 30000); // Check every 30 seconds

async function updateAdminNotificationBadge() {
  try {
    const notificationsSnap = await getDocs(query(collection(db, 'adminNotifications'), where('read', '==', false)));
    const badge = document.getElementById('adminNotificationBadge');
    
    if (notificationsSnap.empty) {
      badge.style.display = 'none';
    } else {
      badge.textContent = notificationsSnap.size;
      badge.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error updating notification badge:', error);
  }
}

// Toggle admin report details
window.toggleAdminReportDetails = function(uniqueId) {
  const detailsRow = document.getElementById(uniqueId);
  if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
    detailsRow.style.display = 'table-row';
  } else {
    detailsRow.style.display = 'none';
  }
};

// Populate admin reports days filter  
window.populateAdminReportsDaysFilter = async function() {
  const monthValue = document.getElementById('adminReportsMonthFilter').value;
  const select = document.getElementById('adminReportsDateFilter');
  
  if (!monthValue) {
    select.innerHTML = '<option value="all-days">جميع أيام الشهر</option>';
    return;
  }
  
  // Get study days based on selected month
  let studyDays = [];
  if (monthValue === 'current-month') {
    studyDays = getStudyDaysInCurrentHijriMonth();
  } else {
    studyDays = getStudyDaysForHijriMonth(monthValue);
  }
  
  // Build options
  let options = '<option value="all-days">جميع أيام الشهر</option>';
  const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  
  for (const dateId of studyDays) {
    const [y, m, d] = dateId.split('-').map(Number);
    const gregorianDate = convertHijriToGregorian(y, m, d);
    const dayOfWeek = gregorianDate.getDay();
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayName = dayNames[dayOfWeek];
    const monthName = hijriMonths[m - 1];
    
    options += `<option value="${dateId}">${dayName} - ${d} ${monthName} ${y} هـ</option>`;
  }
  
  select.innerHTML = options;
  
  // Reload reports with new filter
  await window.filterAdminReportsByDate();
};

// Filter admin reports by date
window.filterAdminReportsByDate = async function() {
  const monthValue = document.getElementById('adminReportsMonthFilter').value;
  const dayValue = document.getElementById('adminReportsDateFilter').value;
  const studentId = window.currentAdminReportStudentId;
  
  if (studentId) {
    await window.loadReportsForStudent(studentId, monthValue, dayValue);
  }
};

// Export comprehensive report as PDF
window.exportComprehensiveReportPDF = async function() {
  try {
    const studentId = window.currentAdminReportStudentId;
    if (!studentId) {
      alert('⚠️ لم يتم اختيار طالب');
      return;
    }
    
    // Get stored report data from last filter
    if (!window.currentFilteredReports || window.currentFilteredReports.length === 0) {
      alert('⚠️ لا توجد بيانات للتصدير. يرجى تطبيق الفلتر أولاً');
      return;
    }
    
    // Get student data
    const studentDocRef = firestoreDoc(db, 'users', studentId);
    const studentDocSnap = await getDoc(studentDocRef);
    const studentData = studentDocSnap.data();
    
    console.log('📋 Student data:', studentData);
    
    // Find teacher automatically - PRIORITY ORDER
    let teacherName = 'غير محدد';
    let teacherId = null;
    
    // Method 1 (HIGHEST PRIORITY): Get from class.teacherName
    if (studentData.classId) {
      console.log('🔍 Method 1 (Priority): Finding teacher from class:', studentData.classId);
      try {
        const classDocRef = firestoreDoc(db, 'classes', studentData.classId);
        const classDocSnap = await getDoc(classDocRef);
        if (classDocSnap.exists()) {
          const classData = classDocSnap.data();
          console.log('  📚 Class data:', classData);
          
          if (classData.teacherName) {
            teacherName = `الأستاذ ${classData.teacherName}`;
            console.log('  ✅ Found teacherName in class:', teacherName);
          } else if (classData.teacherId) {
            teacherId = classData.teacherId;
            console.log('  ✅ Found teacherId in class:', teacherId);
          }
        } else {
          console.log('  ⚠️ Class document not found');
        }
      } catch (error) {
        console.error('  ❌ Error finding teacher from class:', error);
      }
    }
    
    // Method 2: Get from student's teacherId
    if (teacherName === 'غير محدد' && studentData.teacherId) {
      teacherId = studentData.teacherId;
      console.log('🔍 Method 2: Using student.teacherId:', teacherId);
    }
    
    // Method 3: Get from filtered reports
    if (teacherName === 'غير محدد' && !teacherId) {
      console.log('🔍 Method 3: Finding teacher from reports...');
      const reportsWithTeacher = window.currentFilteredReports.filter(r => r.teacherId || r.teacherName);
      if (reportsWithTeacher.length > 0) {
        if (reportsWithTeacher[0].teacherName) {
          teacherName = `الأستاذ ${reportsWithTeacher[0].teacherName}`;
          console.log('  ✅ Found teacher name in report:', teacherName);
        } else if (reportsWithTeacher[0].teacherId) {
          teacherId = reportsWithTeacher[0].teacherId;
          console.log('  ✅ Found teacherId in report:', teacherId);
        }
      }
    }
    
    // If we have teacherId, fetch teacher name
    if (teacherName === 'غير محدد' && teacherId) {
      console.log('🔍 Fetching teacher name from teacherId:', teacherId);
      try {
        const teacherDocRef = firestoreDoc(db, 'users', teacherId);
        const teacherDocSnap = await getDoc(teacherDocRef);
        if (teacherDocSnap.exists()) {
          const rawName = teacherDocSnap.data().name;
          if (rawName) {
            teacherName = `الأستاذ ${rawName}`;
            console.log('✅ Teacher name fetched:', teacherName);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error fetching teacher:', error);
      }
    }
    
    console.log('👨‍🏫 Final teacher name:', teacherName);
    
    // Get period from display
    const periodText = document.getElementById('harvestPeriodSubtitle').textContent;
    
    // Calculate statistics
    const reports = window.currentFilteredReports.filter(r => r.hasReport);
    let totalLessons = 0;
    let totalRevisionPages = 0;
    let firstLesson = null;
    let lastLesson = null;
    let firstRevision = null;
    let lastRevision = null;
    let absenceWithExcuse = 0;
    let absenceWithoutExcuse = 0;
    
    reports.forEach(report => {
      if (report.status === 'absent') {
        if (report.excuseType === 'withExcuse') {
          absenceWithExcuse++;
        } else {
          absenceWithoutExcuse++;
        }
      } else {
        // Count lessons - SAME method as calculateCustomPeriodStatistics
        const lessonScore = report.lessonScore || 0;
        const lessonsFromScore = Math.floor(lessonScore / 5);
        const extraLessons = report.extraLessonCount || 0;
        totalLessons += lessonsFromScore + extraLessons;
        
        console.log(`📊 PDF: ${report.dateId} - Lessons: ${lessonsFromScore + extraLessons} (main=${lessonsFromScore}, extra=${extraLessons}, score=${lessonScore})`);
        
        // Log extra lesson details if available
        if (report.hasExtraLesson && extraLessons > 0) {
          console.log(`  ⭐ Extra Lesson Details: ${report.extraLessonFrom || ''} → ${report.extraLessonTo || ''}, Score: ${report.extraLessonScore || 0}`);
        }
        
        // Track first and last lesson
        if (lessonScore >= 5 && report.lessonFrom && report.lessonTo) {
          const lessonInfo = {
            from: report.lessonFrom,
            to: report.lessonTo,
            date: report.dateId
          };
          if (!firstLesson) firstLesson = lessonInfo;
          lastLesson = lessonInfo;
        }
        
        // Count revision pages
        if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
          const pages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
          totalRevisionPages += pages;
          
          console.log(`📖 PDF: ${report.dateId} - Revision pages: ${pages} (${report.revisionFrom}-${report.revisionTo})`);
          
          const revisionInfo = {
            from: report.revisionFrom,
            to: report.revisionTo,
            date: report.dateId
          };
          if (!firstRevision) firstRevision = revisionInfo;
          lastRevision = revisionInfo;
        }
      }
    });
    
    console.log('✅ PDF Statistics calculated:');
    console.log('  Total Lessons:', totalLessons);
    console.log('  Total Revision Pages:', totalRevisionPages);
    console.log('  Absences (with excuse):', absenceWithExcuse);
    console.log('  Absences (without excuse):', absenceWithoutExcuse);
    
    // 🚀 INNOVATIVE SOLUTION: Create HTML content and convert to PDF using html2canvas
    console.log('🎨 Creating HTML content for PDF...');
    
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
    
    const levelMap = {
      'memorization': 'حفظ',
      'consolidation': 'ضبط',
      'noorani': 'القاعدة النورانية'
    };
    const levelText = levelMap[studentData.level] || studentData.level || 'غير محدد';
    
    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #667eea; margin: 0 0 10px 0; font-size: 28px;">تقرير شامل - حلقات حمدة آل ثاني</h1>
        <p style="color: #666; font-size: 16px; margin: 0;">الفترة: ${periodText}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 30px;">
        <h3 style="color: #667eea; margin: 0 0 15px 0; font-size: 20px;">معلومات الطالب</h3>
        <p style="margin: 5px 0; font-size: 16px;"><strong>الاسم:</strong> ${studentData.name || 'غير محدد'}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>المعلم:</strong> ${teacherName}</p>
        <p style="margin: 5px 0; font-size: 16px;"><strong>المستوى:</strong> ${levelText}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <thead>
          <tr>
            <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; text-align: right; border: none; font-size: 16px;">البيان</th>
            <th style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; text-align: center; border: none; font-size: 16px;">التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد الدروس المنجزة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${totalLessons}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">أول درس</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${firstLesson ? `${firstLesson.from} - ${firstLesson.to}` : 'لا يوجد'}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">آخر درس</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${lastLesson ? `${lastLesson.from} - ${lastLesson.to}` : 'لا يوجد'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد صفحات المراجعة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${totalRevisionPages}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">أول مراجعة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${firstRevision ? `من ${firstRevision.from} إلى ${firstRevision.to}` : 'لا يوجد'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">آخر مراجعة</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${lastRevision ? `من ${lastRevision.from} إلى ${lastRevision.to}` : 'لا يوجد'}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد أيام الغياب (بعذر)</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${absenceWithExcuse}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; font-size: 15px;">عدد أيام الغياب (بدون عذر)</td>
            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center; font-size: 15px;">${absenceWithoutExcuse}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea;">
        <p style="margin: 5px 0; color: #667eea; font-size: 14px; font-style: italic;">إدارة حلقات حمدة آل ثاني</p>
        <p style="margin: 5px 0; color: #999; font-size: 12px;">تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</p>
      </div>
    `;
    
    document.body.appendChild(container);
    console.log('📸 Converting HTML to canvas...');
    
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: true,
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
    const fileName = `تقرير_${studentData.name || 'طالب'}_${Date.now()}.pdf`;
    doc.save(fileName);
    
    console.log('🎉 PDF saved successfully:', fileName);
    alert('✅ تم تصدير التقرير بنجاح!');
    
  } catch (error) {
    console.error('❌ Error exporting PDF:', error);
    console.error('Error stack:', error.stack);
    alert('❌ حدث خطأ في تصدير التقرير: ' + error.message);
  }
};

// ============================================
// Classes Management - Teacher Names
// ============================================

// Load classes management section
async function loadClassesManagement() {
  const container = document.getElementById('classesManagementContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<p>جاري تحميل الحلقات...</p>';
    
    const classesSnap = await getDocs(collection(db, 'classes'));
    
    if (classesSnap.empty) {
      container.innerHTML = '<p style="color: #999;">لا توجد حلقات مسجلة</p>';
      return;
    }
    
    let html = '<div style="display: grid; gap: 15px;">';
    
    classesSnap.forEach(doc => {
      const classData = doc.data();
      const classId = classData.classId || doc.id;
      const className = classData.className || classId;
      const teacherName = classData.teacherName || '';
      
      html += `
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 15px; align-items: center;">
            <div>
              <label style="display: block; font-weight: bold; color: #667eea; margin-bottom: 5px;">اسم الحلقة:</label>
              <div style="color: #333; font-size: 16px;">${className}</div>
            </div>
            
            <div>
              <label style="display: block; font-weight: bold; color: #555; margin-bottom: 5px;">اسم المعلم:</label>
              <input 
                type="text" 
                id="teacher-${classId}" 
                value="${teacherName}"
                placeholder="مثال: أنس أو عامر"
                style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 15px;"
              />
            </div>
            
            <button 
              onclick="window.updateClassTeacherName('${classId}')"
              style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 12px 25px; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; white-space: nowrap;">
              💾 حفظ
            </button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading classes management:', error);
    container.innerHTML = '<p style="color: #dc3545;">❌ حدث خطأ في تحميل الحلقات</p>';
  }
}

// Update class teacher name
window.updateClassTeacherName = async function(classId) {
  const input = document.getElementById(`teacher-${classId}`);
  const teacherName = input.value.trim();
  
  if (!teacherName) {
    alert('⚠️ يرجى إدخال اسم المعلم');
    return;
  }
  
  try {
    console.log(`💾 Updating teacher name for class ${classId}:`, teacherName);
    
    const classDocRef = firestoreDoc(db, 'classes', classId);
    await updateDoc(classDocRef, {
      teacherName: teacherName,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Teacher name updated successfully');
    alert(`✅ تم حفظ اسم المعلم: ${teacherName}`);
    
    // Reload classes to refresh dropdowns
    await loadClasses();
    
  } catch (error) {
    console.error('❌ Error updating teacher name:', error);
    alert('❌ حدث خطأ في حفظ اسم المعلم: ' + error.message);
  }
};


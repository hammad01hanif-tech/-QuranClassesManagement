// Admin Section JavaScript
import { 
  db, 
  collection, 
  getDocs,
  getDoc,
  doc, 
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
import { formatHijriDate, gregorianToHijriDisplay, getHijriWeekAgo, getHijriMonthAgo, getStudyDaysInCurrentHijriMonth, getStudyDaysForHijriMonth, getTodayForStorage, getCurrentHijriDate, hijriToGregorian as convertHijriToGregorian } from './hijri-date.js';

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
    await setDoc(doc(db, "users", userId), studentData);

    // Update class document with new student
    const classDocRef = doc(db, "classes", classId);
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
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn edit-btn">
            ✏️ تعديل
          </button>
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn transfer-btn">
            🔄 نقل
          </button>
          <button data-id="${student.id}" data-name="${student.name}" class="action-btn delete-btn">
            🗑️ حذف
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
    await deleteDoc(doc(db, 'users', studentId));
    
    if (selectedClassId) {
      const classDocRef = doc(db, 'classes', selectedClassId);
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
    
    await updateDoc(doc(db, 'users', studentId), updateData);
    
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
    const studentDoc = await getDoc(doc(db, 'users', studentId));
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
    const studentRef = doc(db, 'users', studentId);
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
    const oldClassSnap = await getDoc(doc(db, 'classes', oldClassId));
    const newClassSnap = await getDoc(doc(db, 'classes', targetClassId));
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
    const oldClassRef = doc(db, 'classes', oldClassId);
    await updateDoc(oldClassRef, {
      studentIds: arrayRemove(studentId)
    });
    
    // Update new class (add student)
    const newClassRef = doc(db, 'classes', targetClassId);
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
window.loadReportsForStudent = async function(studentId, selectedMonthFilter = 'current-month') {
  reportsContainer.innerHTML = '<p>جاري تحميل التقارير...</p>';
  
  try {
    // Get student data to check for transfer history
    const studentDoc = await getDoc(doc(db, 'users', studentId));
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
    
    // Create month filter dropdown
    let filterHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
        <label style="color: white; font-weight: bold; margin-left: 10px; font-size: 16px;">📅 فلترة حسب الشهر:</label>
        <select id="adminMonthFilter" onchange="window.loadReportsForStudent('${studentId}', this.value)" style="padding: 8px 15px; border-radius: 6px; border: 2px solid white; font-size: 14px; font-weight: bold; cursor: pointer; min-width: 200px;">
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
    
    // Calculate statistics only for reports with actual data (not "not-assessed")
    const reportsForStats = completeReports.filter(r => r.hasReport);
    calculateStudentStatistics(reportsForStats);
    
    // Process exam reports
    const examReports = [];
    examReportsSnap.forEach(d => {
      const data = d.data();
      examReports.push({ dateId: d.id, ...data });
    });
    examReports.sort((a, b) => b.dateId.localeCompare(a.dateId));
    
    // Display exam reports if available
    let examHTML = '';
    if (examReports.length > 0) {
      examHTML = `
        <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
          <h4 style="margin: 0 0 15px 0;">📝 درجات الاختبارات الشهرية</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
      `;
      
      examReports.forEach(exam => {
        const hijriDate = gregorianToHijriDisplay(exam.dateId);
        const passIcon = exam.isPassed ? '✅' : '❌';
        const passText = exam.isPassed ? 'ناجح' : 'راسب';
        const passColor = exam.isPassed ? '#4caf50' : '#f44336';
        
        examHTML += `
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
            <div style="text-align: center; margin-top: 10px; font-size: 11px; color: #666;">
              عدد الأسئلة: ${exam.questionsCount} | نسبة النجاح: ${exam.passPercent}%
            </div>
          </div>
        `;
      });
      
      examHTML += `
          </div>
        </div>
      `;
    }
    
    // Check if we have any reports for the selected month
    if (completeReports.length === 0) {
      reportsContainer.innerHTML = filterHTML + '<p class="small">لا توجد أيام دراسية في هذا الشهر</p>';
      document.getElementById('studentStatsSummary').style.display = 'none';
      return;
    }
    
    let tableHTML = `
      <table class="reports-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>اليوم</th>
            <th>الحالة</th>
            <th>المجموع</th>
            <th>صلاة العصر</th>
            <th>الدرس</th>
            <th>جنب الدرس</th>
            <th>المراجعة</th>
            <th>القراءة</th>
            <th>السلوك</th>
            <th>التفاصيل</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    completeReports.forEach(report => {
      // dateId is already in Hijri format YYYY-MM-DD
      const [year, month, day] = report.dateId.split('-');
      const hijriMonths = ['المحرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
      const monthName = hijriMonths[parseInt(month) - 1];
      const fullHijriDate = `${parseInt(day)} ${monthName} ${year} هـ`;
      
      // Get accurate day name from stored Gregorian date or convert
      let dayName = 'غير محدد';
      if (report.gregorianDate) {
        const gregorianDate = new Date(report.gregorianDate + 'T12:00:00');
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      } else {
        // Convert Hijri date to get day name
        const gregorianDate = hijriDateToGregorian(report.dateId);
        dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(gregorianDate);
      }
      
      // Check report status
      if (!report.hasReport) {
        // Not assessed yet
        tableHTML += `
          <tr style="background: #fff3cd;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td colspan="8" style="text-align: center; color: #856404; font-weight: bold; font-size: 16px;">⏳ لم يُقيّم بعد</td>
            <td>-</td>
          </tr>
        `;
      } else if (report.status === 'absent') {
        // Absent
        const excuseText = report.excuseType === 'withExcuse' ? 'بعذر' : 'بدون عذر';
        tableHTML += `
          <tr style="background: #ffe5e5;">
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: #dc3545; font-weight: bold;">❌ غائب (${excuseText})</td>
            <td colspan="7" style="text-align: center; color: #999;">-</td>
            <td><button class="view-report-btn" onclick="viewReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})">عرض</button></td>
          </tr>
        `;
      } else {
        // Normal assessment with scores
        tableHTML += `
          <tr>
            <td>${fullHijriDate}</td>
            <td>${dayName}</td>
            <td style="text-align: center; color: #28a745; font-weight: bold;">✅ حاضر</td>
            <td><strong>${report.totalScore || 0}</strong></td>
            <td>${report.asrPrayerScore || 0}</td>
            <td>${report.lessonScore || 0}</td>
            <td>${report.lessonSideScore || 0}</td>
            <td>${report.revisionScore || 0}</td>
            <td>${report.readingScore || 0}</td>
            <td>${report.behaviorScore || 0}</td>
            <td><button class="view-report-btn" onclick="viewReportDetails('${report.dateId}', ${JSON.stringify(report).replace(/"/g, '&quot;')})">عرض</button></td>
          </tr>
        `;
      }
    });
    
    tableHTML += '</tbody></table>';
    reportsContainer.innerHTML = transferHistoryHTML + filterHTML + `<h4>تقارير المتابعة (${completeReports.length} يوم دراسي)</h4>` + tableHTML + examHTML;
  } catch (error) {
    console.error('Error loading reports:', error);
    reportsContainer.innerHTML = '<p style="color:red;">خطأ في تحميل التقارير: ' + error.message + '</p>';
    document.getElementById('studentStatsSummary').style.display = 'none';
  }
}

// Calculate student statistics (weekly, monthly, total) based on Hijri calendar
function calculateStudentStatistics(reports) {
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Noon for accurate conversion
  
  // Get Hijri dates for week and month ago using accurate calendar
  const currentHijri = getCurrentHijriDate();
  const currentHijriDate = currentHijri?.hijri || getTodayForStorage(); // YYYY-MM-DD
  
  // Calculate 7 days ago in Hijri
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekHijri = getCurrentHijriDate.call({ toString: () => weekAgo.toISOString() });
  const weekHijriDate = weekHijri?.hijri || currentHijriDate;
  
  // Calculate 30 days ago in Hijri (approximate month)
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthHijri = getCurrentHijriDate.call({ toString: () => monthAgo.toISOString() });
  const monthHijriDate = monthHijri?.hijri || currentHijriDate;
  
  let weeklyLessons = 0;
  let weeklyRevisionPages = 0;
  let monthlyLessons = 0;
  let monthlyRevisionPages = 0;
  let totalLessons = 0;
  let totalRevisionPages = 0;
  
  reports.forEach(report => {
    const reportDateId = report.dateId; // This is in Hijri format: YYYY-MM-DD
    
    // Debug: Log to verify dates are in Hijri format
    if (reports.indexOf(report) === 0) {
      console.log('Sample report dateId:', reportDateId);
      console.log('Current Hijri date:', currentHijriDate);
      console.log('Week ago Hijri:', weekHijriDate);
      console.log('Month ago Hijri:', monthHijriDate);
    }
    
    // Count lessons based on score (every 5 points = 1 lesson)
    // e.g., 5 points = 1 lesson, 10 points = 2 lessons, 15 points = 3 lessons, etc.
    const lessonsFromScore = Math.floor((report.lessonScore || 0) / 5);
    
    // Also add extraLessonCount if it exists (for backward compatibility)
    const extraLessons = report.extraLessonCount || 0;
    const totalLessonsForDay = lessonsFromScore + extraLessons;
    
    // Calculate revision pages
    // Count pages if revision was attempted (revisionScore > 0) and has valid from/to
    let revisionPages = 0;
    if (report.revisionScore > 0 && report.revisionFrom && report.revisionTo) {
      revisionPages = calculateRevisionPages(report.revisionFrom, report.revisionTo);
    }
    
    // Total stats
    totalLessons += totalLessonsForDay;
    totalRevisionPages += revisionPages;
    
    // Weekly stats (compare Hijri dates as strings)
    if (reportDateId >= weekHijriDate && reportDateId <= currentHijriDate) {
      weeklyLessons += totalLessonsForDay;
      weeklyRevisionPages += revisionPages;
    }
    
    // Monthly stats (compare Hijri dates as strings)
    if (reportDateId >= monthHijriDate && reportDateId <= currentHijriDate) {
      monthlyLessons += totalLessonsForDay;
      monthlyRevisionPages += revisionPages;
    }
  });
  
  // Update UI
  document.getElementById('studentStatsSummary').style.display = 'block';
  document.getElementById('weeklyLessonsCount').textContent = weeklyLessons;
  document.getElementById('weeklyRevisionPages').textContent = weeklyRevisionPages;
  document.getElementById('monthlyLessonsCount').textContent = monthlyLessons;
  document.getElementById('monthlyRevisionPages').textContent = monthlyRevisionPages;
  document.getElementById('totalLessonsCount').textContent = totalLessons;
  document.getElementById('totalRevisionPages').textContent = totalRevisionPages;
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
  const details = `
التاريخ الهجري: ${hijriDate}
اليوم: ${dayName}
اسم الطالب: ${report.studentName || 'غير محدد'}
رقم الطالب: ${report.studentId || 'غير محدد'}

=== الدرجات ===
صلاة العصر: ${report.asrPrayerScore || 0}/5
الدرس: ${report.lessonScore || 0}/25 (من ${report.lessonFrom || '-'} إلى ${report.lessonTo || '-'})
جنب الدرس: ${report.lessonSideScore || 0}/5 (${report.lessonSideText || '-'})
المراجعة: ${report.revisionScore || 0}/5 (من ${report.revisionFrom || '-'} إلى ${report.revisionTo || '-'})
القراءة بالنظر: ${report.readingScore || 0}/5
السلوك: ${report.behaviorScore || 0}/10
${report.extraLessonCount ? `
دروس إضافية: ${report.extraLessonCount}` : ''}

المجموع الكلي: ${report.totalScore || 0}
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
  const classId = document.getElementById('classSelectAttendance').value;
  const reportSection = document.getElementById('adminAttendanceReportSection');
  
  if (!classId) {
    reportSection.style.display = 'none';
    return;
  }
  
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
    
    // Populate month filter
    await populateAdminMonthFilter();
    
  } catch (error) {
    console.error('Error loading attendance report:', error);
    alert('حدث خطأ في تحميل التقرير');
  }
};

// Populate admin month filter
async function populateAdminMonthFilter() {
  const select = document.getElementById('adminAbsenceMonthFilter');
  const today = new Date();
  
  // Get current Hijri date
  const currentHijriDate = getHijriDate(today);
  
  // Create list of last 6 months including current month
  const months = [];
  for (let i = 0; i < 6; i++) {
    const monthDate = new Date(today);
    monthDate.setMonth(today.getMonth() - i);
    const hijriDate = getHijriDate(monthDate);
    
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
  
  // Load days for current month
  await populateAdminDaysFilter();
}

// Populate admin days filter based on selected month
window.populateAdminDaysFilter = async function() {
  const monthValue = document.getElementById('adminAbsenceMonthFilter').value;
  const select = document.getElementById('adminAbsenceDateFilter');
  
  if (!monthValue) return;
  
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
  
  // Load report for selected month
  await filterAdminAbsenceReport();
};

// Get study days in a specific Hijri month
function getStudyDaysInHijriMonth(year, month) {
  const studyDays = [];
  
  // Iterate through all days in the month (max 30 days)
  for (let day = 1; day <= 30; day++) {
    try {
      const gregorianDate = convertHijriToGregorian(year, month, day);
      const dayOfWeek = gregorianDate.getDay();
      
      // Check if it's a study day (not Friday or Saturday)
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        const dateId = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        studyDays.push(dateId);
      }
    } catch (e) {
      // Invalid date (e.g., day 30 in a 29-day month)
      break;
    }
  }
  
  return studyDays;
}

// Filter admin absence report
window.filterAdminAbsenceReport = async function() {
  const classId = document.getElementById('classSelectAttendance').value;
  const filterValue = document.getElementById('adminAbsenceDateFilter').value;
  const tbody = document.getElementById('adminAttendanceTableBody');
  const statsContainer = document.getElementById('absenceStatsContainer');
  
  if (!classId) return;
  
  tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">جاري تحميل البيانات...</div>';
  if (statsContainer) statsContainer.style.display = 'none';
  
  try {
    // Get all students in the class with their guardian phone
    const studentsSnap = await getDocs(query(collection(db, 'users'), where('classId', '==', classId), where('role', '==', 'student')));
    
    if (studentsSnap.empty) {
      tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">لا يوجد طلاب في هذه الحلقة</div>';
      return;
    }
    
    // Get date range based on filter
    let dateIds = [];
    
    if (filterValue === 'all-days') {
      // All study days in selected month
      const monthValue = document.getElementById('adminAbsenceMonthFilter').value;
      const [year, month] = monthValue.split('-').map(Number);
      dateIds = getStudyDaysInHijriMonth(year, month);
    } else {
      // Specific date selected
      dateIds = [filterValue];
    }
    
    // Collect absence data
    const absenceData = new Map(); // studentId -> {name, guardianPhone, withExcuse, withoutExcuse}
    let totalPresent = 0;
    let totalWithExcuse = 0;
    let totalWithoutExcuse = 0;
    
    for (const studentDoc of studentsSnap.docs) {
      const studentId = studentDoc.id;
      const studentData = studentDoc.data();
      const studentName = studentData.name || 'غير محدد';
      const guardianPhone = studentData.guardianPhone || '';
      
      let withExcuseCount = 0;
      let withoutExcuseCount = 0;
      let presentCount = 0;
      
      // Get daily reports for the date range
      const reportsSnap = await getDocs(collection(db, 'studentProgress', studentId, 'dailyReports'));
      
      dateIds.forEach(dateId => {
        const reportDoc = reportsSnap.docs.find(doc => doc.id === dateId);
        
        if (reportDoc) {
          const reportData = reportDoc.data();
          
          if (reportData.status === 'absent') {
            if (reportData.excuseType === 'withExcuse') {
              withExcuseCount++;
              totalWithExcuse++;
            } else {
              withoutExcuseCount++;
              totalWithoutExcuse++;
            }
          } else {
            presentCount++;
            totalPresent++;
          }
        }
      });
      
      // Only add students who have absence records
      if (withExcuseCount > 0 || withoutExcuseCount > 0) {
        absenceData.set(studentId, {
          name: studentName,
          guardianPhone: guardianPhone,
          withExcuse: withExcuseCount,
          withoutExcuse: withoutExcuseCount
        });
      }
    }
    
    // Show statistics
    if (statsContainer) {
      statsContainer.style.display = 'block';
      document.getElementById('totalPresentCount').textContent = totalPresent;
      document.getElementById('totalWithExcuseCount').textContent = totalWithExcuse;
      document.getElementById('totalWithoutExcuseCount').textContent = totalWithoutExcuse;
    }
    
    // Update student count
    document.getElementById('adminAttendanceStudentCount').textContent = absenceData.size;
    
    // Display list
    if (absenceData.size === 0) {
      tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #51cf66; font-weight: bold;">✅ لا يوجد طلاب غائبين في هذه الفترة</div>';
      return;
    }
    
    // Convert to array and sort by total absences
    const absenceArray = Array.from(absenceData.entries()).map(([id, data]) => ({
      id,
      ...data,
      totalAbsence: data.withExcuse + data.withoutExcuse
    })).sort((a, b) => b.totalAbsence - a.totalAbsence);
    
    // Build mobile-friendly list
    tbody.innerHTML = absenceArray.map((student, index) => {
      const totalAbsence = student.withExcuse + student.withoutExcuse;
      const uniqueId = `absence-details-${student.id}`;
      
      return `
        <!-- Student Row -->
        <div onclick="toggleAbsenceDetails('${uniqueId}')" style="background: white; padding: 12px 15px; border-radius: 8px; border: 2px solid #e0e0e0; cursor: pointer; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #333; font-size: 15px; margin-bottom: 4px;">
                ${index + 1}. ${student.name}
              </div>
              <div style="font-size: 12px; color: #666;">
                <span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; margin-left: 5px;">📄 ${student.withExcuse}</span>
                <span style="background: #ff6b6b; color: white; padding: 2px 8px; border-radius: 10px;">⚠️ ${student.withoutExcuse}</span>
              </div>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #ffc107; min-width: 40px; text-align: center;">
              ${totalAbsence}
            </div>
          </div>
        </div>
        
        <!-- Expanded Details -->
        <div id="${uniqueId}" style="display: none; background: #f8f9fa; padding: 12px 15px; border-radius: 8px; margin-top: -6px; border: 2px solid #e0e0e0; border-top: none; animation: slideDown 0.3s ease;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">📄 غياب بعذر</div>
              <div style="font-size: 20px; font-weight: bold; color: #667eea;">${student.withExcuse}</div>
            </div>
            <div style="background: #ffebee; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 12px; color: #666; margin-bottom: 4px;">⚠️ غياب بدون عذر</div>
              <div style="font-size: 20px; font-weight: bold; color: #ff6b6b;">${student.withoutExcuse}</div>
            </div>
          </div>
          
          ${student.guardianPhone ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <a href="tel:${student.guardianPhone}" style="background: #007bff; color: white; padding: 10px; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                📞 اتصال
              </a>
              <a href="https://wa.me/966${student.guardianPhone.replace(/^0/, '')}" target="_blank" style="background: #25D366; color: white; padding: 10px; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px;">
                💬 واتساب
              </a>
            </div>
          ` : '<div style="text-align: center; color: #999; font-size: 13px;">لا يوجد رقم جوال</div>'}
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error filtering absence report:', error);
    tbody.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">حدث خطأ في تحميل البيانات</div>';
  }
};

// Toggle absence details
window.toggleAbsenceDetails = function(uniqueId) {
  const detailsDiv = document.getElementById(uniqueId);
  if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
    detailsDiv.style.display = 'block';
  } else {
    detailsDiv.style.display = 'none';
  }
};

// Toggle admin notifications panel
window.toggleAdminNotifications = function() {
  const panel = document.getElementById('adminNotificationsPanel');
  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block';
    loadAdminNotifications();
  } else {
    panel.style.display = 'none';
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
    await deleteDoc(doc(db, 'adminNotifications', notificationId));
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
    await deleteDoc(doc(db, 'strugglingReports', reportId));
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

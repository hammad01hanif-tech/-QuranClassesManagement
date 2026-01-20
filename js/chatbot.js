// Intelligent Chatbot for Quran Classes Management
import { db, collection, getDocs, query, where, orderBy, limit } from '../firebase-config.js';
import { getCurrentHijriDate } from './hijri-date.js';

// ============================================
// CHATBOT CONFIGURATION
// ============================================

const CHATBOT_CONFIG = {
  apiProvider: 'openai', // 'openai', 'gemini', or 'claude'
  apiKey: 'YOUR_API_KEY_HERE', // يجب وضعه في environment variable
  model: 'gpt-4', // or 'gemini-pro', 'claude-3-opus'
  temperature: 0.7,
  maxTokens: 1000
};

// ============================================
// USER CONTEXT - معلومات المستخدم الحالي
// ============================================

let currentUserContext = {
  userId: null,
  userName: null,
  role: null, // 'admin', 'teacher', 'student', 'viewer'
  classId: null,
  studentIds: [], // للمعلم أو ولي الأمر
  accessibleData: {} // البيانات التي يمكن للمستخدم الوصول إليها
};

// ============================================
// INITIALIZE CHATBOT
// ============================================

export function initChatbot(userId, role, additionalContext = {}) {
  currentUserContext = {
    userId,
    userName: additionalContext.userName || 'مستخدم',
    role,
    classId: additionalContext.classId || null,
    studentIds: additionalContext.studentIds || [],
    accessibleData: {}
  };
  
  console.log('🤖 Chatbot initialized for:', currentUserContext);
  
  // تحميل البيانات المناسبة حسب الدور
  loadContextualData();
}

// ============================================
// LOAD CONTEXTUAL DATA - تحميل بيانات السياق
// ============================================

async function loadContextualData() {
  try {
    const data = {};
    
    // بيانات مشتركة للجميع
    data.currentDate = getCurrentHijriDate();
    data.systemInfo = {
      totalUsers: await getUsersCount(),
      totalClasses: await getClassesCount()
    };
    
    // بيانات خاصة حسب الدور
    switch(currentUserContext.role) {
      case 'admin':
        data.allStudents = await getAllStudents();
        data.allTeachers = await getAllTeachers();
        data.systemStats = await getSystemStatistics();
        break;
        
      case 'teacher':
        data.myStudents = await getStudentsByClass(currentUserContext.classId);
        data.todayAssessments = await getTodayAssessments(currentUserContext.classId);
        data.strugglingStudents = await getStrugglingStudents(currentUserContext.classId);
        break;
        
      case 'student':
        data.myProgress = await getStudentProgress(currentUserContext.userId);
        data.myRank = await getStudentRank(currentUserContext.userId);
        data.myStats = await getStudentStatistics(currentUserContext.userId);
        break;
        
      case 'viewer':
        data.childrenProgress = await getChildrenProgress(currentUserContext.studentIds);
        break;
    }
    
    currentUserContext.accessibleData = data;
    console.log('✅ Contextual data loaded:', data);
    
  } catch (error) {
    console.error('❌ Error loading contextual data:', error);
  }
}

// ============================================
// DATA FETCHING FUNCTIONS - دوال جلب البيانات
// ============================================

async function getUsersCount() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.size;
}

async function getClassesCount() {
  const snapshot = await getDocs(collection(db, 'classes'));
  return snapshot.size;
}

async function getAllStudents() {
  const q = query(collection(db, 'users'), where('role', '==', 'student'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getAllTeachers() {
  const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getStudentsByClass(classId) {
  const q = query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', classId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getTodayAssessments(classId) {
  const today = getCurrentHijriDate()?.hijri;
  if (!today) return [];
  
  const students = await getStudentsByClass(classId);
  const assessments = [];
  
  for (const student of students) {
    try {
      const reportRef = collection(db, 'studentProgress', student.id, 'dailyReports');
      const q = query(reportRef, where('dateId', '==', today), limit(1));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        assessments.push({
          studentId: student.id,
          studentName: student.name,
          ...snapshot.docs[0].data()
        });
      }
    } catch (error) {
      console.error('Error fetching assessment for', student.id, error);
    }
  }
  
  return assessments;
}

async function getStrugglingStudents(classId) {
  // يمكن تحسينها بناءً على معايير محددة
  const students = await getStudentsByClass(classId);
  const struggling = [];
  
  for (const student of students) {
    const stats = await getStudentStatistics(student.id);
    if (stats.averageScore < 20 || stats.strugglingDays > 3) {
      struggling.push({
        ...student,
        stats
      });
    }
  }
  
  return struggling;
}

async function getStudentProgress(studentId) {
  const reportsRef = collection(db, 'studentProgress', studentId, 'dailyReports');
  const q = query(reportsRef, orderBy('dateId', 'desc'), limit(30));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getStudentRank(studentId) {
  // حساب الترتيب بين الطلاب
  // يمكن تحسينها
  return { rank: 5, totalStudents: 20 };
}

async function getStudentStatistics(studentId) {
  const reports = await getStudentProgress(studentId);
  
  let totalScore = 0;
  let totalLessons = 0;
  let strugglingDays = 0;
  let presentDays = 0;
  
  reports.forEach(report => {
    if (report.status === 'present') {
      presentDays++;
      totalScore += report.totalScore || 0;
      totalLessons += Math.floor((report.lessonScore || 0) / 5) + (report.extraLessonCount || 0);
      if (report.totalScore < 20) strugglingDays++;
    }
  });
  
  return {
    averageScore: presentDays > 0 ? (totalScore / presentDays).toFixed(1) : 0,
    totalLessons,
    strugglingDays,
    attendanceRate: ((presentDays / reports.length) * 100).toFixed(0)
  };
}

async function getChildrenProgress(studentIds) {
  const progress = [];
  for (const studentId of studentIds) {
    const stats = await getStudentStatistics(studentId);
    const recentReports = await getStudentProgress(studentId);
    progress.push({
      studentId,
      stats,
      recentReports: recentReports.slice(0, 7) // آخر أسبوع
    });
  }
  return progress;
}

async function getSystemStatistics() {
  const allStudents = await getAllStudents();
  let totalLessons = 0;
  let totalScore = 0;
  let count = 0;
  
  for (const student of allStudents) {
    const stats = await getStudentStatistics(student.id);
    totalLessons += stats.totalLessons;
    totalScore += parseFloat(stats.averageScore);
    count++;
  }
  
  return {
    totalStudents: allStudents.length,
    totalLessons,
    averageSystemScore: count > 0 ? (totalScore / count).toFixed(1) : 0
  };
}

// ============================================
// PROCESS USER QUERY - معالجة سؤال المستخدم
// ============================================

export async function processChatbotQuery(userQuery) {
  console.log('💬 User query:', userQuery);
  
  // تحضير السياق للـ AI
  const context = prepareContextForAI();
  
  // بناء الـ prompt
  const prompt = buildPrompt(userQuery, context);
  
  // إرسال للـ AI API
  const response = await sendToAI(prompt);
  
  return response;
}

// ============================================
// PREPARE CONTEXT - تحضير السياق للـ AI
// ============================================

function prepareContextForAI() {
  const { role, userName, accessibleData } = currentUserContext;
  
  let contextText = `
أنت مساعد ذكي في نظام إدارة الحلقات القرآنية.

معلومات المستخدم الحالي:
- الاسم: ${userName}
- الدور: ${getRoleNameInArabic(role)}
- التاريخ الهجري الحالي: ${accessibleData.currentDate?.formatted || 'غير متوفر'}

`;

  // إضافة بيانات حسب الدور
  if (role === 'admin') {
    contextText += `
البيانات المتاحة:
- عدد الطلاب: ${accessibleData.allStudents?.length || 0}
- عدد المعلمين: ${accessibleData.allTeachers?.length || 0}
- إحصائيات النظام: ${JSON.stringify(accessibleData.systemStats, null, 2)}
`;
  } else if (role === 'teacher') {
    contextText += `
البيانات المتاحة:
- عدد طلابي: ${accessibleData.myStudents?.length || 0}
- التقييمات اليوم: ${accessibleData.todayAssessments?.length || 0}
- الطلاب المتعثرون: ${accessibleData.strugglingStudents?.length || 0}

قائمة طلابي:
${accessibleData.myStudents?.map(s => `- ${s.name} (ID: ${s.id})`).join('\n') || 'لا يوجد'}
`;
  } else if (role === 'student') {
    contextText += `
بياناتي:
- إحصائياتي: ${JSON.stringify(accessibleData.myStats, null, 2)}
- ترتيبي: ${accessibleData.myRank?.rank || 'غير متوفر'} من ${accessibleData.myRank?.totalStudents || 0}
`;
  }
  
  return contextText;
}

// ============================================
// BUILD PROMPT - بناء الـ prompt للـ AI
// ============================================

function buildPrompt(userQuery, context) {
  return `
${context}

تعليمات:
1. أجب على السؤال بدقة باستخدام البيانات المتوفرة فقط
2. إذا لم تكن البيانات متوفرة، اذكر ذلك بوضوح
3. استخدم اللغة العربية الفصحى البسيطة
4. كن مختصراً ومفيداً
5. استخدم الأيقونات المناسبة (📊 📈 ✅ ❌ ⭐)

سؤال المستخدم: ${userQuery}

الإجابة:
`;
}

// ============================================
// SEND TO AI API - إرسال للذكاء الاصطناعي
// ============================================

async function sendToAI(prompt) {
  try {
    // هنا يتم الاتصال بـ API الذكاء الاصطناعي
    // مثال: OpenAI, Gemini, Claude
    
    if (CHATBOT_CONFIG.apiProvider === 'openai') {
      return await sendToOpenAI(prompt);
    } else if (CHATBOT_CONFIG.apiProvider === 'gemini') {
      return await sendToGemini(prompt);
    } else {
      return 'عذراً، لم يتم تكوين API الذكاء الاصطناعي بعد.';
    }
    
  } catch (error) {
    console.error('❌ Error sending to AI:', error);
    return 'عذراً، حدث خطأ في معالجة السؤال.';
  }
}

// OpenAI API
async function sendToOpenAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHATBOT_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: CHATBOT_CONFIG.model,
      messages: [
        { role: 'system', content: 'أنت مساعد ذكي في نظام إدارة الحلقات القرآنية' },
        { role: 'user', content: prompt }
      ],
      temperature: CHATBOT_CONFIG.temperature,
      max_tokens: CHATBOT_CONFIG.maxTokens
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// Google Gemini API
async function sendToGemini(prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${CHATBOT_CONFIG.apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRoleNameInArabic(role) {
  const roles = {
    'admin': 'إدارة',
    'teacher': 'معلم',
    'student': 'طالب',
    'viewer': 'ولي أمر'
  };
  return roles[role] || 'مستخدم';
}

// ============================================
// SMART SUGGESTIONS - اقتراحات ذكية
// ============================================

export function getSmartSuggestions() {
  const { role } = currentUserContext;
  
  const suggestions = {
    admin: [
      "كم عدد الطلاب المتعثرين هذا الشهر؟",
      "من أفضل 5 طلاب في الأداء؟",
      "أعطني تقرير شامل عن جميع الصفوف",
      "ما هو متوسط الدرجات في النظام؟"
    ],
    teacher: [
      "هل قيّمت جميع الطلاب اليوم؟",
      "من الطلاب المتعثرون في صفي؟",
      "أعطني ملخص أداء أحمد هذا الشهر",
      "كم طالب غاب هذا الأسبوع؟"
    ],
    student: [
      "كم درجتي اليوم؟",
      "ما هو ترتيبي في الصف؟",
      "كم درس أكملت هذا الشهر؟",
      "أين أنا في حفظ الجزء الحالي؟"
    ],
    viewer: [
      "كيف أداء ابني هذا الشهر؟",
      "هل حضر الحلقة اليوم؟",
      "ما هي نقاط القوة عند ابني؟",
      "قارن أداء ابني بالشهر الماضي"
    ]
  };
  
  return suggestions[role] || [];
}

export { currentUserContext };

/**
 * ================================================
 * بيانات وإعدادات المعلمين - نظام الحضور
 * ================================================
 * 
 * هذا الملف يحتوي على جميع بيانات المعلمين وإعداداتهم الخاصة
 * المتعلقة بنظام الحضور والانصراف
 * 
 * كل معلم له إعدادات خاصة:
 * - الدقائق المسموحة بعد العصر
 * - الدقائق المسموحة بعد العشاء
 * - الراتب الشهري
 * - نظام الخصميات الخاص به
 * 
 * يتم جلب هذه البيانات من Firebase في الإنتاج
 * هذا الملف للتطوير والاختبار والبيانات الافتراضية
 */

import { ATTENDANCE_SYSTEM_CONFIG, ABSENCE_CALCULATION_METHODS } from '../config/attendance-settings.js';

// ============================================
// هيكل بيانات المعلم الأساسي
// ============================================

/**
 * @typedef {Object} TeacherAttendanceConfig
 * @property {string} id - معرف المعلم الفريد
 * @property {string} name - اسم المعلم الكامل
 * @property {string} shortName - الاسم المختصر
 * @property {boolean} active - هل الحساب نشط
 * 
 * @property {Object} workSchedule - جدول العمل
 * @property {number} workSchedule.minutesAfterAsr - دقائق السماح بعد العصر
 * @property {number} workSchedule.minutesAfterIsha - دقائق الإضافة بعد العشاء
 * @property {number[]} workSchedule.workDays - أيام العمل (0=أحد، 1=إثنين، ...)
 * @property {boolean} workSchedule.followsPrayerTimes - هل يتبع أوقات الصلاة
 * @property {string|null} workSchedule.fixedStartTime - وقت ثابت للبداية (إذا لم يتبع الصلاة)
 * @property {string|null} workSchedule.fixedEndTime - وقت ثابت للنهاية
 * 
 * @property {Object} salary - بيانات الراتب
 * @property {number} salary.monthlySalary - الراتب الشهري الأساسي
 * @property {string} salary.currency - العملة
 * @property {number} salary.overtimeRate - معدل الساعات الإضافية (ريال/ساعة)
 * @property {Object} salary.bonuses - المكافآت
 * 
 * @property {Object} penalties - إعدادات الخصميات الخاصة
 * @property {Object} penalties.latePenalty - خصمية التأخير
 * @property {Object} penalties.absencePenalty - خصمية الغياب
 * @property {Object} penalties.earlyLeavePenalty - خصمية الخروج المبكر
 * 
 * @property {Object} permissions - الصلاحيات
 * @property {boolean} permissions.canCheckInManually - يمكنه التسجيل اليدوي
 * @property {boolean} permissions.canRequestExcuse - يمكنه طلب عذر
 * @property {boolean} permissions.requiresApproval - يتطلب موافقة إدارية
 * 
 * @property {Object} notifications - إعدادات الإشعارات
 * @property {boolean} notifications.enabled - تفعيل الإشعارات
 * @property {string} notifications.email - البريد الإلكتروني
 * @property {string} notifications.phone - رقم الهاتف
 * 
 * @property {Object} metadata - بيانات إضافية
 * @property {Date} metadata.joinDate - تاريخ الانضمام
 * @property {string} metadata.contractType - نوع العقد
 * @property {string} metadata.notes - ملاحظات إدارية
 */

// ============================================
// قاعدة بيانات المعلمين
// ============================================

export const TEACHERS_ATTENDANCE_CONFIG = [
  {
    // المعلم الأول - عبدالله
    id: 'ABD01',
    name: 'عبدالله بن محمد',
    shortName: 'عبدالله',
    active: true,
    
    workSchedule: {
      minutesAfterAsr: 35, // بداية دوامه بعد العصر بـ 35 دقيقة
      minutesAfterIsha: 30, // ينتهي دوامه بعد العشاء بـ 30 دقيقة
      workDays: [0, 1, 2, 3, 4], // الأحد - الخميس
      followsPrayerTimes: true, // يتبع أوقات الصلاة
      fixedStartTime: null,
      fixedEndTime: null,
    },
    
    salary: {
      monthlySalary: 3000, // 3000 ريال شهرياً
      currency: 'SAR',
      overtimeRate: 50, // 50 ريال للساعة الإضافية
      bonuses: {
        attendanceBonus: 200, // مكافأة حضور (إذا لم يتأخر)
        performanceBonus: 0,
      },
    },
    
    penalties: {
      latePenalty: {
        enabled: true,
        amount: 5, // 5 ريال
        intervalMinutes: 30, // كل نصف ساعة
        graceMinutes: 0, // لا يوجد سماح إضافي
        roundingMethod: 'ceil',
        maxDailyPenalty: 20, // الحد الأقصى 20 ريال/يوم
      },
      
      absencePenalty: {
        enabled: true,
        calculationMethod: ABSENCE_CALCULATION_METHODS.SALARY_DIVIDED_BY_30,
        customAmount: null, // null = استخدم الراتب ÷ 30
        allowExcusedAbsence: true,
        excusedAbsenceDeduction: 0,
        maxMonthlyAbsences: 3,
      },
      
      earlyLeavePenalty: {
        enabled: true,
        amount: 5,
        intervalMinutes: 30,
        graceMinutes: 5, // 5 دقائق سماح
        roundingMethod: 'ceil',
        maxDailyPenalty: 15,
      },
    },
    
    permissions: {
      canCheckInManually: true,
      canRequestExcuse: true,
      requiresApproval: false,
    },
    
    notifications: {
      enabled: true,
      email: 'teacher1@example.com',
      phone: '+966501234567',
    },
    
    metadata: {
      joinDate: new Date('2024-01-01'),
      contractType: 'full_time', // دوام كامل
      department: 'القرآن الكريم',
      notes: 'معلم متميز، حاصل على إجازة في القراءات',
    },
  },
  
  {
    // المعلم الثاني - خالد (لديه استثناءات)
    id: 'KHL01',
    name: 'خالد بن أحمد',
    shortName: 'خالد',
    active: true,
    
    workSchedule: {
      minutesAfterAsr: 45, // لديه 45 دقيقة سماح (أكثر من العادي)
      minutesAfterIsha: 15, // يخرج بعد 15 دقيقة فقط من العشاء
      workDays: [0, 1, 2, 3, 4],
      followsPrayerTimes: true,
      fixedStartTime: null,
      fixedEndTime: null,
    },
    
    salary: {
      monthlySalary: 3500,
      currency: 'SAR',
      overtimeRate: 60,
      bonuses: {
        attendanceBonus: 250,
        performanceBonus: 100,
      },
    },
    
    penalties: {
      latePenalty: {
        enabled: true,
        amount: 5,
        intervalMinutes: 30,
        graceMinutes: 10, // لديه 10 دقائق سماح إضافية
        roundingMethod: 'ceil',
        maxDailyPenalty: null, // لا حد أقصى
      },
      
      absencePenalty: {
        enabled: true,
        calculationMethod: ABSENCE_CALCULATION_METHODS.SALARY_DIVIDED_BY_30,
        customAmount: null,
        allowExcusedAbsence: true,
        excusedAbsenceDeduction: 50, // يخصم 50 ريال حتى مع العذر
        maxMonthlyAbsences: 2, // مسموح له غياباً أقل
      },
      
      earlyLeavePenalty: {
        enabled: false, // لا يتم خصمه على الخروج المبكر
        amount: 0,
        intervalMinutes: 30,
        graceMinutes: 0,
        roundingMethod: 'ceil',
        maxDailyPenalty: 0,
      },
    },
    
    permissions: {
      canCheckInManually: true,
      canRequestExcuse: true,
      requiresApproval: true, // يتطلب موافقة الإدارة
    },
    
    notifications: {
      enabled: true,
      email: 'teacher2@example.com',
      phone: '+966502345678',
    },
    
    metadata: {
      joinDate: new Date('2023-09-01'),
      contractType: 'full_time',
      department: 'القرآن الكريم',
      notes: 'لديه ظروف عائلية خاصة، مسموح له بالخروج مبكراً',
    },
  },
  
  {
    // المعلم الثالث - محمد (دوام جزئي)
    id: 'MHD01',
    name: 'محمد بن سعيد',
    shortName: 'محمد',
    active: true,
    
    workSchedule: {
      minutesAfterAsr: 60, // يبدأ متأخراً - بعد ساعة من العصر
      minutesAfterIsha: 0, // ينتهي مع أذان العشاء مباشرة
      workDays: [0, 2, 4], // الأحد - الثلاثاء - الخميس فقط
      followsPrayerTimes: true,
      fixedStartTime: null,
      fixedEndTime: null,
    },
    
    salary: {
      monthlySalary: 2000, // راتب أقل (دوام جزئي)
      currency: 'SAR',
      overtimeRate: 40,
      bonuses: {
        attendanceBonus: 100,
        performanceBonus: 0,
      },
    },
    
    penalties: {
      latePenalty: {
        enabled: true,
        amount: 5,
        intervalMinutes: 30,
        graceMinutes: 0,
        roundingMethod: 'ceil',
        maxDailyPenalty: 15,
      },
      
      absencePenalty: {
        enabled: true,
        calculationMethod: ABSENCE_CALCULATION_METHODS.SALARY_DIVIDED_BY_STUDY_DAYS,
        customAmount: null,
        allowExcusedAbsence: true,
        excusedAbsenceDeduction: 0,
        maxMonthlyAbsences: 1,
      },
      
      earlyLeavePenalty: {
        enabled: true,
        amount: 3, // خصم أقل
        intervalMinutes: 30,
        graceMinutes: 10,
        roundingMethod: 'round', // تقريب عادي
        maxDailyPenalty: 10,
      },
    },
    
    permissions: {
      canCheckInManually: false, // لا يمكنه التسجيل اليدوي
      canRequestExcuse: true,
      requiresApproval: false,
    },
    
    notifications: {
      enabled: false, // لا يريد إشعارات
      email: null,
      phone: null,
    },
    
    metadata: {
      joinDate: new Date('2025-01-15'),
      contractType: 'part_time', // دوام جزئي
      department: 'القرآن الكريم',
      notes: 'معلم دوام جزئي، طالب جامعي',
    },
  },
  
  {
    // المعلم الرابع - أحمد (نظام مخصص)
    id: 'AHM01',
    name: 'أحمد بن علي',
    shortName: 'أحمد',
    active: true,
    
    workSchedule: {
      minutesAfterAsr: 0, // لا يتبع أوقات الصلاة
      minutesAfterIsha: 0,
      workDays: [0, 1, 2, 3, 4],
      followsPrayerTimes: false, // لديه أوقات ثابتة
      fixedStartTime: '16:00', // 4:00 مساءً ثابت
      fixedEndTime: '20:30', // 8:30 مساءً ثابت
    },
    
    salary: {
      monthlySalary: 4000, // راتب أعلى
      currency: 'SAR',
      overtimeRate: 70,
      bonuses: {
        attendanceBonus: 300,
        performanceBonus: 200,
      },
    },
    
    penalties: {
      latePenalty: {
        enabled: true,
        amount: 10, // خصم أكبر (ضعف العادي)
        intervalMinutes: 15, // كل ربع ساعة (أكثر صرامة)
        graceMinutes: 0,
        roundingMethod: 'ceil',
        maxDailyPenalty: 50,
      },
      
      absencePenalty: {
        enabled: true,
        calculationMethod: ABSENCE_CALCULATION_METHODS.FIXED_AMOUNT,
        customAmount: 150, // مبلغ ثابت 150 ريال
        allowExcusedAbsence: true,
        excusedAbsenceDeduction: 75, // نصف المبلغ مع العذر
        maxMonthlyAbsences: 2,
      },
      
      earlyLeavePenalty: {
        enabled: true,
        amount: 8,
        intervalMinutes: 15,
        graceMinutes: 0,
        roundingMethod: 'ceil',
        maxDailyPenalty: 40,
      },
    },
    
    permissions: {
      canCheckInManually: false,
      canRequestExcuse: true,
      requiresApproval: true,
    },
    
    notifications: {
      enabled: true,
      email: 'teacher4@example.com',
      phone: '+966504567890',
    },
    
    metadata: {
      joinDate: new Date('2022-03-01'),
      contractType: 'senior_teacher', // معلم أول
      department: 'القرآن الكريم',
      notes: 'معلم أول - منسق القسم',
    },
  },
  
  {
    // المعلم الخامس - يوسف (معلم احتياطي)
    id: 'YSF01',
    name: 'يوسف بن إبراهيم',
    shortName: 'يوسف',
    active: false, // غير نشط حالياً
    
    workSchedule: {
      minutesAfterAsr: 35,
      minutesAfterIsha: 30,
      workDays: [], // لا يوجد أيام محددة
      followsPrayerTimes: true,
      fixedStartTime: null,
      fixedEndTime: null,
    },
    
    salary: {
      monthlySalary: 0, // يتم الدفع باليوم
      currency: 'SAR',
      overtimeRate: 0,
      bonuses: {
        attendanceBonus: 0,
        performanceBonus: 0,
      },
    },
    
    penalties: {
      latePenalty: {
        enabled: false,
        amount: 0,
        intervalMinutes: 0,
        graceMinutes: 0,
        roundingMethod: 'ceil',
        maxDailyPenalty: 0,
      },
      
      absencePenalty: {
        enabled: false,
        calculationMethod: ABSENCE_CALCULATION_METHODS.FIXED_AMOUNT,
        customAmount: 0,
        allowExcusedAbsence: true,
        excusedAbsenceDeduction: 0,
        maxMonthlyAbsences: null,
      },
      
      earlyLeavePenalty: {
        enabled: false,
        amount: 0,
        intervalMinutes: 0,
        graceMinutes: 0,
        roundingMethod: 'ceil',
        maxDailyPenalty: 0,
      },
    },
    
    permissions: {
      canCheckInManually: true,
      canRequestExcuse: true,
      requiresApproval: true,
    },
    
    notifications: {
      enabled: false,
      email: null,
      phone: null,
    },
    
    metadata: {
      joinDate: new Date('2025-06-01'),
      contractType: 'substitute', // معلم احتياطي
      department: 'القرآن الكريم',
      notes: 'معلم احتياطي - يتم استدعاؤه عند الحاجة',
    },
  },
];

// ============================================
// دوال مساعدة للوصول للبيانات
// ============================================

/**
 * الحصول على إعدادات معلم معين
 * @param {string} teacherId - معرف المعلم
 * @returns {TeacherAttendanceConfig|null}
 */
export function getTeacherConfig(teacherId) {
  return TEACHERS_ATTENDANCE_CONFIG.find(t => t.id === teacherId) || null;
}

/**
 * الحصول على جميع المعلمين النشطين
 * @returns {TeacherAttendanceConfig[]}
 */
export function getActiveTeachers() {
  return TEACHERS_ATTENDANCE_CONFIG.filter(t => t.active);
}

/**
 * الحصول على المعلمين حسب نوع العقد
 * @param {string} contractType
 * @returns {TeacherAttendanceConfig[]}
 */
export function getTeachersByContractType(contractType) {
  return TEACHERS_ATTENDANCE_CONFIG.filter(
    t => t.metadata.contractType === contractType && t.active
  );
}

/**
 * الحصول على راتب معلم
 * @param {string} teacherId
 * @returns {number}
 */
export function getTeacherSalary(teacherId) {
  const teacher = getTeacherConfig(teacherId);
  return teacher ? teacher.salary.monthlySalary : 0;
}

/**
 * التحقق من تفعيل خصمية معينة لمعلم
 * @param {string} teacherId
 * @param {string} penaltyType - 'latePenalty' أو 'absencePenalty' أو 'earlyLeavePenalty'
 * @returns {boolean}
 */
export function isPenaltyEnabled(teacherId, penaltyType) {
  const teacher = getTeacherConfig(teacherId);
  return teacher && teacher.penalties[penaltyType]?.enabled === true;
}

/**
 * الحصول على أيام عمل معلم
 * @param {string} teacherId
 * @returns {number[]}
 */
export function getTeacherWorkDays(teacherId) {
  const teacher = getTeacherConfig(teacherId);
  return teacher ? teacher.workSchedule.workDays : [];
}

/**
 * التحقق من أن اليوم هو يوم عمل للمعلم
 * @param {string} teacherId
 * @param {Date} date
 * @returns {boolean}
 */
export function isWorkDay(teacherId, date) {
  const workDays = getTeacherWorkDays(teacherId);
  const dayOfWeek = date.getDay();
  return workDays.includes(dayOfWeek);
}

/**
 * الحصول على قائمة بجميع معرفات المعلمين النشطين
 * @returns {string[]}
 */
export function getActiveTeacherIds() {
  return getActiveTeachers().map(t => t.id);
}

/**
 * البحث عن معلم بالاسم
 * @param {string} name
 * @returns {TeacherAttendanceConfig[]}
 */
export function searchTeachersByName(name) {
  const searchTerm = name.toLowerCase();
  return TEACHERS_ATTENDANCE_CONFIG.filter(t => 
    t.name.toLowerCase().includes(searchTerm) ||
    t.shortName.toLowerCase().includes(searchTerm)
  );
}

// تصدير كل شيء
export default {
  TEACHERS_ATTENDANCE_CONFIG,
  getTeacherConfig,
  getActiveTeachers,
  getTeachersByContractType,
  getTeacherSalary,
  isPenaltyEnabled,
  getTeacherWorkDays,
  isWorkDay,
  getActiveTeacherIds,
  searchTeachersByName,
};

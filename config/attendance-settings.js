/**
 * ================================================
 * إعدادات نظام حضور المعلمين - الإعدادات العامة
 * ================================================
 * 
 * هذا الملف يحتوي على جميع الإعدادات العامة والقواعد الافتراضية
 * لنظام حضور وانصراف المعلمين في مركز التحفيظ
 * 
 * يتم استخدامه في:
 * - صفحة تسجيل حضور المعلم
 * - صفحة الإدارة (إدارة الحضور)
 * - صفحة التقارير
 * - حساب الرواتب والخصميات
 */

// ============================================
// الإعدادات العامة للدوام
// ============================================

export const ATTENDANCE_SYSTEM_CONFIG = {
  // اسم النظام والإصدار
  systemName: 'نظام حضور المعلمين',
  version: '1.0.0',
  
  // الإعدادات الزمنية العامة
  timeSettings: {
    // الدقائق الافتراضية بعد العصر لبداية الدوام
    defaultMinutesAfterAsr: 35,
    
    // الدقائق الافتراضية بعد العشاء لنهاية الدوام
    defaultMinutesAfterIsha: 30,
    
    // هل يتم احتساب ثواني أم دقائق فقط
    considerSeconds: false,
    
    // الحد الأدنى لفترة العمل (بالدقائق)
    minimumWorkDuration: 120, // ساعتان
    
    // الموعد النهائي لتسجيل الحضور (الساعة)
    latestCheckInTime: '21:00', // 9:00 مساءً
  },
  
  // إعدادات الخصميات
  penaltySettings: {
    // نظام خصمية التأخير
    latePenalty: {
      enabled: true,
      amount: 5, // ريال
      intervalMinutes: 30, // كل نصف ساعة
      graceMinutes: 0, // دقائق السماح (0 = لا سماح)
      roundingMethod: 'ceil', // طريقة التقريب: 'ceil', 'floor', 'round'
      maxDailyPenalty: null, // الحد الأقصى للخصم اليومي (null = لا حد)
    },
    
    // نظام خصمية الغياب
    absencePenalty: {
      enabled: true,
      calculationMethod: 'salary_divided_by_30', // 'salary_divided_by_30', 'fixed_amount', 'custom'
      fixedAmount: 100, // في حالة fixed_amount
      allowExcusedAbsence: true, // السماح بالغياب بعذر
      excusedAbsenceDeduction: 0, // خصم الغياب بعذر (0 = لا خصم)
      maxMonthlyAbsences: 3, // الحد الأقصى للغياب الشهري
    },
    
    // نظام خصمية الخروج المبكر
    earlyLeavePenalty: {
      enabled: true,
      amount: 5, // ريال
      intervalMinutes: 30, // كل نصف ساعة
      graceMinutes: 5, // 5 دقائق سماح
      roundingMethod: 'ceil',
      maxDailyPenalty: null,
    },
    
    // خصمية الخروج المؤقت (أثناء الدوام)
    temporaryLeavePenalty: {
      enabled: false,
      amount: 10, // ريال
      intervalMinutes: 15, // كل ربع ساعة
      requiresApproval: true, // يتطلب موافقة الإدارة
    },
  },
  
  // إعدادات الحضور
  attendanceSettings: {
    // السماح بتسجيل الحضور اليدوي (بوقت مختلف)
    allowManualCheckIn: true,
    
    // السماح بتسجيل الانصراف اليدوي
    allowManualCheckOut: true,
    
    // السماح بتسجيل الغياب بعذر
    allowExcusedAbsence: true,
    
    // السماح بتعديل الحضور من قبل الإدارة
    allowAdminEdit: true,
    
    // هل يتطلب تسجيل الحضور الموقع الجغرافي
    requireLocation: false,
    
    // هل يتطلب تسجيل الحضور صورة شخصية
    requirePhoto: false,
    
    // الحد الأقصى لطول الملاحظة
    maxNoteLength: 200,
  },
  
  // إعدادات الإشعارات
  notificationSettings: {
    // إشعار بقرب نهاية الدوام
    endOfShiftReminder: {
      enabled: true,
      minutesBefore: 15, // قبل 15 دقيقة من نهاية الدوام
    },
    
    // إشعار للمتأخرين
    lateCheckInNotification: {
      enabled: true,
      minutesAfterStart: 10, // بعد 10 دقائق من بداية الدوام
    },
    
    // إشعار للإدارة بالغيابات
    absenceNotification: {
      enabled: true,
      sendToAdmin: true,
    },
  },
  
  // إعدادات العطل والإجازات
  holidaySettings: {
    // استثناء أيام الجمعة والسبت
    excludeWeekends: true,
    weekendDays: [5, 6], // 5=الجمعة, 6=السبت
    
    // استثناء الإجازات الرسمية
    excludeOfficialHolidays: true,
    
    // استثناء أيام الدراسة (من study-days-calendar.js)
    respectStudyDaysCalendar: true,
  },
};

// ============================================
// أنواع حالات الحضور
// ============================================

export const ATTENDANCE_STATUS = {
  PRESENT: 'present', // حاضر
  ABSENT: 'absent', // غائب
  LATE: 'late', // متأخر
  EXCUSED: 'excused', // غائب بعذر
  ON_LEAVE: 'on_leave', // في إجازة
  SICK_LEAVE: 'sick_leave', // إجازة مرضية
  EARLY_LEAVE: 'early_leave', // خروج مبكر
  HOLIDAY: 'holiday', // عطلة رسمية
};

// ============================================
// أنواع الخصميات
// ============================================

export const PENALTY_TYPES = {
  LATE_ARRIVAL: 'late_arrival', // التأخير
  ABSENCE: 'absence', // الغياب
  EARLY_LEAVE: 'early_leave', // الخروج المبكر
  TEMPORARY_LEAVE: 'temporary_leave', // الخروج المؤقت
  NO_CHECK_IN: 'no_check_in', // عدم تسجيل الحضور
  NO_CHECK_OUT: 'no_check_out', // عدم تسجيل الانصراف
};

// ============================================
// طرق حساب خصمية الغياب
// ============================================

export const ABSENCE_CALCULATION_METHODS = {
  SALARY_DIVIDED_BY_30: 'salary_divided_by_30', // الراتب ÷ 30
  SALARY_DIVIDED_BY_STUDY_DAYS: 'salary_divided_by_study_days', // الراتب ÷ أيام الدراسة
  FIXED_AMOUNT: 'fixed_amount', // مبلغ ثابت
  CUSTOM: 'custom', // حسب إعدادات المعلم
};

// ============================================
// طرق التقريب
// ============================================

export const ROUNDING_METHODS = {
  CEIL: 'ceil', // تقريب لأعلى (دائماً)
  FLOOR: 'floor', // تقريب لأسفل (دائماً)
  ROUND: 'round', // تقريب عادي (أقرب عدد صحيح)
};

// ============================================
// صلاحيات التعديل
// ============================================

export const EDIT_PERMISSIONS = {
  TEACHER: {
    canEditOwnAttendance: false, // لا يمكن للمعلم تعديل حضوره
    canViewOwnHistory: true, // يمكن عرض سجله الخاص
    canAddNotes: true, // يمكن إضافة ملاحظات
  },
  
  ADMIN: {
    canEditAnyAttendance: true, // يمكن للإدارة تعديل أي حضور
    canDeleteAttendance: true, // يمكن الحذف
    canApproveExcuses: true, // يمكن الموافقة على الأعذار
    canAdjustPenalties: true, // يمكن تعديل الخصميات
    canViewAllReports: true, // يمكن عرض كل التقارير
  },
};

// ============================================
// فترات التقارير
// ============================================

export const REPORT_PERIODS = {
  DAILY: 'daily', // يومي
  WEEKLY: 'weekly', // أسبوعي
  MONTHLY: 'monthly', // شهري
  CUSTOM: 'custom', // فترة مخصصة
};

// ============================================
// رسائل النظام
// ============================================

export const SYSTEM_MESSAGES = {
  // رسائل النجاح
  success: {
    checkInSuccess: '✅ تم تسجيل الحضور بنجاح',
    checkOutSuccess: '✅ تم تسجيل الانصراف بنجاح',
    absenceRegistered: 'تم تسجيل الغياب',
    excuseApproved: 'تم الموافقة على العذر',
  },
  
  // رسائل التحذير
  warning: {
    lateArrival: '⚠️ أنت متأخر، سيتم احتساب خصمية التأخير',
    nearDeadline: '⚠️ اقترب الموعد النهائي لتسجيل الحضور',
    earlyLeave: '⚠️ أنت تخرج مبكراً، سيتم احتساب خصمية',
    autoAbsence: '⚠️ سيتم تسجيلك غائباً تلقائياً إذا لم تسجل حضورك',
  },
  
  // رسائل الأخطاء
  error: {
    alreadyCheckedIn: '❌ لقد سجلت حضورك مسبقاً اليوم',
    alreadyCheckedOut: '❌ لقد سجلت انصرافك مسبقاً',
    notCheckedIn: '❌ يجب تسجيل الحضور أولاً',
    invalidTime: '❌ الوقت المدخل غير صحيح',
    systemError: '❌ حدث خطأ في النظام',
  },
};

// ============================================
// دالة للحصول على الإعدادات الافتراضية
// ============================================

/**
 * الحصول على الإعدادات الافتراضية للنظام
 * @returns {Object} كائن الإعدادات الكامل
 */
export function getDefaultSettings() {
  return { ...ATTENDANCE_SYSTEM_CONFIG };
}

/**
 * الحصول على إعداد معين
 * @param {string} path - المسار للإعداد مثل 'penaltySettings.latePenalty.amount'
 * @returns {any} قيمة الإعداد
 */
export function getSetting(path) {
  const keys = path.split('.');
  let value = ATTENDANCE_SYSTEM_CONFIG;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return null;
    }
  }
  
  return value;
}

/**
 * التحقق من تفعيل ميزة معينة
 * @param {string} featurePath - مسار الميزة
 * @returns {boolean}
 */
export function isFeatureEnabled(featurePath) {
  const enabledPath = `${featurePath}.enabled`;
  return getSetting(enabledPath) === true;
}

// تصدير كل شيء كـ default أيضاً
export default {
  ATTENDANCE_SYSTEM_CONFIG,
  ATTENDANCE_STATUS,
  PENALTY_TYPES,
  ABSENCE_CALCULATION_METHODS,
  ROUNDING_METHODS,
  EDIT_PERMISSIONS,
  REPORT_PERIODS,
  SYSTEM_MESSAGES,
  getDefaultSettings,
  getSetting,
  isFeatureEnabled,
};

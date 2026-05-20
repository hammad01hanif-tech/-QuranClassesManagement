/**
 * ================================================
 * وحدة حسابات نظام الحضور - Attendance Calculator
 * ================================================
 * 
 * هذا الملف يحتوي على جميع الدوال الحسابية المتعلقة بنظام
 * حضور المعلمين، بما في ذلك:
 * 
 * - حساب أوقات بداية ونهاية الدوام
 * - حساب خصميات التأخير
 * - حساب خصميات الغياب
 * - حساب خصميات الخروج المبكر
 * - حساب مدة العمل
 * - التحقق من حالة الحضور
 * 
 * يتم استيراد هذه الدوال في:
 * - صفحة تسجيل حضور المعلم (teacher.js)
 * - صفحة الإدارة (admin.js)
 * - صفحة التقارير
 * - حساب الرواتب
 */

import { ATTENDANCE_SYSTEM_CONFIG, ROUNDING_METHODS, ABSENCE_CALCULATION_METHODS } from '../config/attendance-settings.js';
import { getTeacherConfig, getTeacherSalary } from '../data/teachers-attendance-config.js';

// ============================================
// دوال حساب أوقات الدوام
// ============================================

/**
 * حساب وقت بداية الدوام بناءً على أذان العصر
 * @param {string} asrTime - وقت أذان العصر بصيغة "HH:MM"
 * @param {string} teacherId - معرف المعلم
 * @returns {Date} وقت بداية الدوام
 */
export function calculateWorkStartTime(asrTime, teacherId) {
  const teacher = getTeacherConfig(teacherId);
  
  // إذا كان للمعلم وقت ثابت
  if (teacher && !teacher.workSchedule.followsPrayerTimes && teacher.workSchedule.fixedStartTime) {
    return parseTimeString(teacher.workSchedule.fixedStartTime);
  }
  
  // الحصول على الدقائق المضافة
  const minutesToAdd = teacher 
    ? teacher.workSchedule.minutesAfterAsr 
    : ATTENDANCE_SYSTEM_CONFIG.timeSettings.defaultMinutesAfterAsr;
  
  // تحويل وقت العصر وإضافة الدقائق
  const startTime = parseTimeString(asrTime);
  startTime.setMinutes(startTime.getMinutes() + minutesToAdd);
  
  return startTime;
}

/**
 * حساب وقت نهاية الدوام بناءً على أذان العشاء
 * @param {string} ishaTime - وقت أذان العشاء بصيغة "HH:MM"
 * @param {string} teacherId - معرف المعلم
 * @returns {Date} وقت نهاية الدوام
 */
export function calculateWorkEndTime(ishaTime, teacherId) {
  const teacher = getTeacherConfig(teacherId);
  
  // إذا كان للمعلم وقت ثابت
  if (teacher && !teacher.workSchedule.followsPrayerTimes && teacher.workSchedule.fixedEndTime) {
    return parseTimeString(teacher.workSchedule.fixedEndTime);
  }
  
  // الحصول على الدقائق المضافة
  const minutesToAdd = teacher 
    ? teacher.workSchedule.minutesAfterIsha 
    : ATTENDANCE_SYSTEM_CONFIG.timeSettings.defaultMinutesAfterIsha;
  
  // تحويل وقت العشاء وإضافة الدقائق
  const endTime = parseTimeString(ishaTime);
  endTime.setMinutes(endTime.getMinutes() + minutesToAdd);
  
  return endTime;
}

/**
 * حساب مدة الدوام الفعلية
 * @param {Date} checkInTime - وقت الحضور
 * @param {Date} checkOutTime - وقت الانصراف
 * @returns {number} المدة بالدقائق
 */
export function calculateWorkDuration(checkInTime, checkOutTime) {
  const diffMs = checkOutTime - checkInTime;
  return Math.floor(diffMs / (1000 * 60)); // تحويل من ميلي ثانية إلى دقائق
}

/**
 * حساب مدة التأخير
 * @param {Date} checkInTime - وقت الحضور الفعلي
 * @param {Date} workStartTime - وقت بداية الدوام المقرر
 * @returns {number} مدة التأخير بالدقائق (0 إذا لم يتأخر)
 */
export function calculateLateMinutes(checkInTime, workStartTime) {
  if (checkInTime <= workStartTime) {
    return 0; // لم يتأخر
  }
  
  const diffMs = checkInTime - workStartTime;
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * حساب مدة الخروج المبكر
 * @param {Date} checkOutTime - وقت الانصراف الفعلي
 * @param {Date} workEndTime - وقت نهاية الدوام المقرر
 * @returns {number} مدة الخروج المبكر بالدقائق (0 إذا لم يخرج مبكراً)
 */
export function calculateEarlyLeaveMinutes(checkOutTime, workEndTime) {
  if (checkOutTime >= workEndTime) {
    return 0; // لم يخرج مبكراً
  }
  
  const diffMs = workEndTime - checkOutTime;
  return Math.floor(diffMs / (1000 * 60));
}

// ============================================
// دوال حساب الخصميات
// ============================================

/**
 * حساب خصمية التأخير
 * @param {Date} checkInTime - وقت الحضور الفعلي
 * @param {Date} workStartTime - وقت بداية الدوام المقرر
 * @param {string} teacherId - معرف المعلم
 * @returns {Object} { penalty: number, lateMinutes: number, intervals: number }
 */
export function calculateLatePenalty(checkInTime, workStartTime, teacherId) {
  const teacher = getTeacherConfig(teacherId);
  
  // إعدادات الخصمية
  const penaltyConfig = teacher && teacher.penalties.latePenalty.enabled
    ? teacher.penalties.latePenalty
    : ATTENDANCE_SYSTEM_CONFIG.penaltySettings.latePenalty;
  
  // إذا كانت الخصمية معطلة
  if (!penaltyConfig.enabled) {
    return { penalty: 0, lateMinutes: 0, intervals: 0 };
  }
  
  // حساب الدقائق المتأخرة
  let lateMinutes = calculateLateMinutes(checkInTime, workStartTime);
  
  // طرح دقائق السماح
  lateMinutes = Math.max(0, lateMinutes - penaltyConfig.graceMinutes);
  
  // إذا لم يتأخر بعد احتساب السماح
  if (lateMinutes <= 0) {
    return { penalty: 0, lateMinutes: 0, intervals: 0 };
  }
  
  // حساب عدد الفترات الزمنية
  const intervals = roundByMethod(
    lateMinutes / penaltyConfig.intervalMinutes,
    penaltyConfig.roundingMethod
  );
  
  // حساب الخصمية
  let penalty = intervals * penaltyConfig.amount;
  
  // تطبيق الحد الأقصى إن وجد
  if (penaltyConfig.maxDailyPenalty !== null) {
    penalty = Math.min(penalty, penaltyConfig.maxDailyPenalty);
  }
  
  return {
    penalty,
    lateMinutes,
    intervals,
  };
}

/**
 * حساب خصمية الغياب
 * @param {string} teacherId - معرف المعلم
 * @param {boolean} isExcused - هل الغياب بعذر
 * @param {number|null} studyDaysInMonth - عدد أيام الدراسة في الشهر (لطريقة الحساب الثانية)
 * @returns {number} قيمة الخصمية
 */
export function calculateAbsencePenalty(teacherId, isExcused = false, studyDaysInMonth = null) {
  const teacher = getTeacherConfig(teacherId);
  
  // إعدادات الخصمية
  const penaltyConfig = teacher && teacher.penalties.absencePenalty.enabled
    ? teacher.penalties.absencePenalty
    : ATTENDANCE_SYSTEM_CONFIG.penaltySettings.absencePenalty;
  
  // إذا كانت الخصمية معطلة
  if (!penaltyConfig.enabled) {
    return 0;
  }
  
  // إذا كان الغياب بعذر ومسموح
  if (isExcused && penaltyConfig.allowExcusedAbsence) {
    return penaltyConfig.excusedAbsenceDeduction || 0;
  }
  
  // طريقة الحساب
  const method = penaltyConfig.calculationMethod;
  const salary = getTeacherSalary(teacherId);
  
  switch (method) {
    case ABSENCE_CALCULATION_METHODS.SALARY_DIVIDED_BY_30:
      return Math.round(salary / 30);
    
    case ABSENCE_CALCULATION_METHODS.SALARY_DIVIDED_BY_STUDY_DAYS:
      if (studyDaysInMonth && studyDaysInMonth > 0) {
        return Math.round(salary / studyDaysInMonth);
      }
      // إذا لم يتم تمرير عدد الأيام، استخدم 30
      return Math.round(salary / 30);
    
    case ABSENCE_CALCULATION_METHODS.FIXED_AMOUNT:
      return penaltyConfig.fixedAmount || 0;
    
    case ABSENCE_CALCULATION_METHODS.CUSTOM:
      return penaltyConfig.customAmount || 0;
    
    default:
      return Math.round(salary / 30);
  }
}

/**
 * حساب خصمية الخروج المبكر
 * @param {Date} checkOutTime - وقت الانصراف الفعلي
 * @param {Date} workEndTime - وقت نهاية الدوام المقرر
 * @param {string} teacherId - معرف المعلم
 * @returns {Object} { penalty: number, earlyMinutes: number, intervals: number }
 */
export function calculateEarlyLeavePenalty(checkOutTime, workEndTime, teacherId) {
  const teacher = getTeacherConfig(teacherId);
  
  // إعدادات الخصمية
  const penaltyConfig = teacher && teacher.penalties.earlyLeavePenalty.enabled
    ? teacher.penalties.earlyLeavePenalty
    : ATTENDANCE_SYSTEM_CONFIG.penaltySettings.earlyLeavePenalty;
  
  // إذا كانت الخصمية معطلة
  if (!penaltyConfig.enabled) {
    return { penalty: 0, earlyMinutes: 0, intervals: 0 };
  }
  
  // حساب الدقائق المبكرة
  let earlyMinutes = calculateEarlyLeaveMinutes(checkOutTime, workEndTime);
  
  // طرح دقائق السماح
  earlyMinutes = Math.max(0, earlyMinutes - penaltyConfig.graceMinutes);
  
  // إذا لم يخرج مبكراً بعد احتساب السماح
  if (earlyMinutes <= 0) {
    return { penalty: 0, earlyMinutes: 0, intervals: 0 };
  }
  
  // حساب عدد الفترات الزمنية
  const intervals = roundByMethod(
    earlyMinutes / penaltyConfig.intervalMinutes,
    penaltyConfig.roundingMethod
  );
  
  // حساب الخصمية
  let penalty = intervals * penaltyConfig.amount;
  
  // تطبيق الحد الأقصى إن وجد
  if (penaltyConfig.maxDailyPenalty !== null) {
    penalty = Math.min(penalty, penaltyConfig.maxDailyPenalty);
  }
  
  return {
    penalty,
    earlyMinutes,
    intervals,
  };
}

/**
 * حساب إجمالي الخصميات اليومية
 * @param {Object} attendanceData - بيانات الحضور
 * @param {string} teacherId - معرف المعلم
 * @returns {Object} { total: number, breakdown: Object }
 */
export function calculateTotalDailyPenalties(attendanceData, teacherId) {
  const breakdown = {
    late: 0,
    earlyLeave: 0,
    absence: 0,
  };
  
  // إذا كان غائباً
  if (attendanceData.status === 'absent') {
    breakdown.absence = calculateAbsencePenalty(
      teacherId,
      attendanceData.isExcused,
      attendanceData.studyDaysInMonth
    );
  } else {
    // حساب خصمية التأخير
    if (attendanceData.checkInTime && attendanceData.workStartTime) {
      const latePenaltyData = calculateLatePenalty(
        attendanceData.checkInTime,
        attendanceData.workStartTime,
        teacherId
      );
      breakdown.late = latePenaltyData.penalty;
    }
    
    // حساب خصمية الخروج المبكر
    if (attendanceData.checkOutTime && attendanceData.workEndTime) {
      const earlyLeavePenaltyData = calculateEarlyLeavePenalty(
        attendanceData.checkOutTime,
        attendanceData.workEndTime,
        teacherId
      );
      breakdown.earlyLeave = earlyLeavePenaltyData.penalty;
    }
  }
  
  const total = breakdown.late + breakdown.earlyLeave + breakdown.absence;
  
  return {
    total,
    breakdown,
  };
}

// ============================================
// دوال التحقق من حالة الحضور
// ============================================

/**
 * التحقق من أن المعلم متأخر
 * @param {Date} checkInTime - وقت الحضور
 * @param {Date} workStartTime - وقت بداية الدوام
 * @param {string} teacherId - معرف المعلم
 * @returns {boolean}
 */
export function isLate(checkInTime, workStartTime, teacherId) {
  const teacher = getTeacherConfig(teacherId);
  const graceMinutes = teacher?.penalties?.latePenalty?.graceMinutes || 0;
  
  const lateMinutes = calculateLateMinutes(checkInTime, workStartTime);
  return lateMinutes > graceMinutes;
}

/**
 * التحقق من أن المعلم خرج مبكراً
 * @param {Date} checkOutTime - وقت الانصراف
 * @param {Date} workEndTime - وقت نهاية الدوام
 * @param {string} teacherId - معرف المعلم
 * @returns {boolean}
 */
export function isEarlyLeave(checkOutTime, workEndTime, teacherId) {
  const teacher = getTeacherConfig(teacherId);
  const graceMinutes = teacher?.penalties?.earlyLeavePenalty?.graceMinutes || 0;
  
  const earlyMinutes = calculateEarlyLeaveMinutes(checkOutTime, workEndTime);
  return earlyMinutes > graceMinutes;
}

/**
 * التحقق من أن مدة العمل كافية
 * @param {Date} checkInTime - وقت الحضور
 * @param {Date} checkOutTime - وقت الانصراف
 * @returns {boolean}
 */
export function hasMinimumWorkDuration(checkInTime, checkOutTime) {
  const duration = calculateWorkDuration(checkInTime, checkOutTime);
  const minimum = ATTENDANCE_SYSTEM_CONFIG.timeSettings.minimumWorkDuration;
  return duration >= minimum;
}

// ============================================
// دوال مساعدة
// ============================================

/**
 * تحويل نص الوقت إلى كائن Date
 * @param {string} timeStr - الوقت بصيغة "HH:MM" أو "HH:MM AM/PM"
 * @returns {Date}
 */
export function parseTimeString(timeStr) {
  const today = new Date();
  
  // معالجة الصيغة العربية (ص/م)
  timeStr = timeStr.replace(/\s*ص\s*$/, ' AM').replace(/\s*م\s*$/, ' PM');
  
  // معالجة AM/PM
  const isPM = /PM/i.test(timeStr);
  const isAM = /AM/i.test(timeStr);
  
  // استخراج الساعات والدقائق
  const cleanTime = timeStr.replace(/\s*(AM|PM)\s*/gi, '').trim();
  const [hoursStr, minutesStr] = cleanTime.split(':');
  
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr || '0', 10);
  
  // تحويل من 12 ساعة إلى 24 ساعة
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }
  
  today.setHours(hours, minutes, 0, 0);
  return today;
}

/**
 * تنسيق كائن Date إلى نص وقت
 * @param {Date} date - الوقت
 * @param {boolean} use24Hour - استخدام نظام 24 ساعة
 * @returns {string}
 */
export function formatTime(date, use24Hour = false) {
  if (!date) return '--:--';
  
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour,
  };
  
  return date.toLocaleTimeString('ar-SA', options);
}

/**
 * التقريب حسب الطريقة المحددة
 * @param {number} value - القيمة
 * @param {string} method - طريقة التقريب
 * @returns {number}
 */
export function roundByMethod(value, method) {
  switch (method) {
    case ROUNDING_METHODS.CEIL:
      return Math.ceil(value);
    case ROUNDING_METHODS.FLOOR:
      return Math.floor(value);
    case ROUNDING_METHODS.ROUND:
      return Math.round(value);
    default:
      return Math.ceil(value); // افتراضي: تقريب لأعلى
  }
}

/**
 * تحويل الدقائق إلى نص وصفي (ساعات ودقائق)
 * @param {number} minutes - عدد الدقائق
 * @returns {string}
 */
export function minutesToReadable(minutes) {
  if (minutes === 0) return 'لا يوجد';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} دقيقة`;
  } else if (mins === 0) {
    return `${hours} ساعة`;
  } else {
    return `${hours} ساعة و ${mins} دقيقة`;
  }
}

/**
 * حساب النسبة المئوية للحضور
 * @param {number} attendedDays - أيام الحضور
 * @param {number} totalDays - إجمالي الأيام
 * @returns {number}
 */
export function calculateAttendancePercentage(attendedDays, totalDays) {
  if (totalDays === 0) return 0;
  return Math.round((attendedDays / totalDays) * 100);
}

// ============================================
// تصدير جميع الدوال
// ============================================

export default {
  // دوال حساب الأوقات
  calculateWorkStartTime,
  calculateWorkEndTime,
  calculateWorkDuration,
  calculateLateMinutes,
  calculateEarlyLeaveMinutes,
  
  // دوال حساب الخصميات
  calculateLatePenalty,
  calculateAbsencePenalty,
  calculateEarlyLeavePenalty,
  calculateTotalDailyPenalties,
  
  // دوال التحقق
  isLate,
  isEarlyLeave,
  hasMinimumWorkDuration,
  
  // دوال مساعدة
  parseTimeString,
  formatTime,
  roundByMethod,
  minutesToReadable,
  calculateAttendancePercentage,
};

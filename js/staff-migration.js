// Migration Script: نقل إعدادات المعلمين إلى Firestore
import { db, collection, doc, setDoc, serverTimestamp } from '../firebase-config.js';
import { TEACHERS_ATTENDANCE_CONFIG } from '../data/teachers-attendance-config.js';

/**
 * دالة Migration: تنقل إعدادات المعلمين من الملف إلى Firestore
 */
export async function migrateStaffSettingsToFirestore() {
  console.log('🚀 بدء عملية Migration...');
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  try {
    // المرور على جميع المعلمين في الملف
    for (const teacher of TEACHERS_ATTENDANCE_CONFIG) {
      try {
        console.log(`📝 معالجة: ${teacher.name} (${teacher.id})`);
        
        // تحضير بيانات المستند
        const staffSettings = {
          // المعرف
          staffId: teacher.id,
          
          // جدول العمل
          workSchedule: {
            minutesAfterAsr: teacher.workSchedule.minutesAfterAsr,
            minutesAfterIsha: teacher.workSchedule.minutesAfterIsha,
            workDays: teacher.workSchedule.workDays,
            followsPrayerTimes: teacher.workSchedule.followsPrayerTimes,
            fixedStartTime: teacher.workSchedule.fixedStartTime || null,
            fixedEndTime: teacher.workSchedule.fixedEndTime || null,
            gracePeriod: teacher.workSchedule.gracePeriod || 5
          },
          
          // إعدادات الخصميات
          penalties: {
            // خصمية التأخير
            latePenalty: {
              enabled: teacher.penalties.latePenalty.enabled,
              amount: teacher.penalties.latePenalty.amount,
              intervalMinutes: teacher.penalties.latePenalty.intervalMinutes,
              roundingMethod: teacher.penalties.latePenalty.roundingMethod,
              maxDailyDeduction: teacher.penalties.latePenalty.maxDailyDeduction
            },
            
            // خصمية الغياب
            absencePenalty: {
              enabled: teacher.penalties.absencePenalty.enabled,
              calculationMethod: teacher.penalties.absencePenalty.calculationMethod,
              fixedAmount: teacher.penalties.absencePenalty.fixedAmount || null,
              allowExcusedAbsence: teacher.penalties.absencePenalty.allowExcusedAbsence,
              excusedAbsenceDeduction: teacher.penalties.absencePenalty.excusedAbsenceDeduction
            },
            
            // خصمية الخروج المبكر
            earlyLeavePenalty: {
              enabled: teacher.penalties.earlyLeavePenalty.enabled,
              amount: teacher.penalties.earlyLeavePenalty.amount,
              intervalMinutes: teacher.penalties.earlyLeavePenalty.intervalMinutes,
              graceMinutes: teacher.penalties.earlyLeavePenalty.graceMinutes,
              maxDailyDeduction: teacher.penalties.earlyLeavePenalty.maxDailyDeduction
            }
          },
          
          // الراتب
          salary: {
            monthlySalary: teacher.salary.monthlySalary,
            currency: teacher.salary.currency || 'SAR'
          },
          
          // الحالة
          active: teacher.active,
          
          // التواريخ
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          
          // ملاحظات
          notes: `تم النقل من teachers-attendance-config.js`,
          migratedAt: new Date().toISOString()
        };
        
        // إنشاء المستند في Firestore
        const docRef = doc(db, 'staffSettings', teacher.id);
        await setDoc(docRef, staffSettings);
        
        successCount++;
        results.push({
          id: teacher.id,
          name: teacher.name,
          status: 'success',
          message: '✅ تم النقل بنجاح'
        });
        
        console.log(`✅ تم نقل: ${teacher.name}`);
        
      } catch (error) {
        errorCount++;
        results.push({
          id: teacher.id,
          name: teacher.name,
          status: 'error',
          message: `❌ خطأ: ${error.message}`
        });
        
        console.error(`❌ خطأ في نقل ${teacher.name}:`, error);
      }
    }
    
    // ملخص العملية
    console.log('\n📊 ملخص عملية Migration:');
    console.log(`✅ نجح: ${successCount}`);
    console.log(`❌ فشل: ${errorCount}`);
    console.log(`📝 الإجمالي: ${TEACHERS_ATTENDANCE_CONFIG.length}`);
    
    return {
      success: errorCount === 0,
      successCount,
      errorCount,
      total: TEACHERS_ATTENDANCE_CONFIG.length,
      results
    };
    
  } catch (error) {
    console.error('❌ خطأ عام في Migration:', error);
    throw error;
  }
}

/**
 * دالة للتحقق من وجود staffSettings في Firestore
 */
export async function checkStaffSettingsExist() {
  try {
    const { getDocs, query, collection, limit } = await import('../firebase-config.js');
    const q = query(collection(db, 'staffSettings'), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('خطأ في التحقق:', error);
    return false;
  }
}

/**
 * دالة لعرض معاينة البيانات قبل النقل
 */
export function previewMigration() {
  console.log('👀 معاينة البيانات التي سيتم نقلها:\n');
  
  TEACHERS_ATTENDANCE_CONFIG.forEach((teacher, index) => {
    console.log(`${index + 1}. ${teacher.name} (${teacher.id})`);
    console.log(`   - الراتب: ${teacher.salary.monthlySalary} ريال`);
    console.log(`   - بداية الدوام: العصر + ${teacher.workSchedule.minutesAfterAsr} دقيقة`);
    console.log(`   - خصمية التأخير: ${teacher.penalties.latePenalty.amount} ريال/${teacher.penalties.latePenalty.intervalMinutes} دقيقة`);
    console.log('');
  });
  
  console.log(`\n📊 إجمالي المعلمين: ${TEACHERS_ATTENDANCE_CONFIG.length}`);
}

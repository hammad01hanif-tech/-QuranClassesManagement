// Verify Hijri to Gregorian mapping
const testDates = [
  {hijri: '1447-06-01', gregorian: '2025-11-22', dayName: 'السبت'},
  {hijri: '1447-06-02', gregorian: '2025-11-23', dayName: 'الأحد'},
  {hijri: '1447-06-03', gregorian: '2025-11-24', dayName: 'الإثنين'},
  {hijri: '1447-06-04', gregorian: '2025-11-25', dayName: 'الثلاثاء'},
  {hijri: '1447-06-05', gregorian: '2025-11-26', dayName: 'الأربعاء'},
  {hijri: '1447-06-06', gregorian: '2025-11-27', dayName: 'الخميس'},
  {hijri: '1447-06-07', gregorian: '2025-11-28', dayName: 'الجمعة'},
  {hijri: '1447-06-08', gregorian: '2025-11-29', dayName: 'السبت'},
  {hijri: '1447-06-09', gregorian: '2025-11-30', dayName: 'الأحد'}
];

console.log('\n=== Verifying Date Accuracy ===\n');

testDates.forEach(entry => {
  const d = new Date(entry.gregorian + 'T12:00:00');
  const actualDayOfWeek = d.getDay();
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const actualDayName = dayNames[actualDayOfWeek];
  
  const match = actualDayName === entry.dayName ? '✅' : '❌';
  console.log(`${entry.hijri} → ${entry.gregorian}`);
  console.log(`  Expected: ${entry.dayName} | Actual: ${actualDayName} [Day ${actualDayOfWeek}] ${match}\n`);
});

// Now check what December 6, 2025 actually is
console.log('\n=== Current Date Check ===');
const today = new Date('2025-12-06T12:00:00');
const todayDayOfWeek = today.getDay();
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
console.log(`December 6, 2025 is: ${dayNames[todayDayOfWeek]} (${arabicDayNames[todayDayOfWeek]}) - Day ${todayDayOfWeek}`);

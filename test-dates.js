// Test weekend filtering
const testDates = [
  {gregorian: '2025-11-22', hijri: '1447-06-01', dayName: 'السبت'},
  {gregorian: '2025-11-23', hijri: '1447-06-02', dayName: 'الأحد'},
  {gregorian: '2025-11-24', hijri: '1447-06-03', dayName: 'الإثنين'},
  {gregorian: '2025-11-25', hijri: '1447-06-04', dayName: 'الثلاثاء'},
  {gregorian: '2025-11-26', hijri: '1447-06-05', dayName: 'الأربعاء'},
  {gregorian: '2025-11-27', hijri: '1447-06-06', dayName: 'الخميس'},
  {gregorian: '2025-11-28', hijri: '1447-06-07', dayName: 'الجمعة'},
  {gregorian: '2025-11-29', hijri: '1447-06-08', dayName: 'السبت'},
  {gregorian: '2025-11-30', hijri: '1447-06-09', dayName: 'الأحد'}
];

console.log('\n=== Testing Weekend Filter ===\n');
console.log('Filter condition: dayOfWeek >= 0 && dayOfWeek <= 4');
console.log('Expected: Include Sun(0) to Thu(4), Exclude Fri(5) and Sat(6)\n');

const filtered = testDates.filter(entry => {
  const d = new Date(entry.gregorian + 'T12:00:00');
  const dayOfWeek = d.getDay();
  const include = dayOfWeek >= 0 && dayOfWeek <= 4;
  
  const status = include ? '✅ INCLUDE' : '❌ EXCLUDE';
  console.log(`${entry.hijri} (${entry.gregorian}) - ${entry.dayName} [Day ${dayOfWeek}] - ${status}`);
  
  return include;
});

console.log(`\n=== Results ===`);
console.log(`Total dates tested: ${testDates.length}`);
console.log(`Study days (included): ${filtered.length}`);
console.log(`Weekend days (excluded): ${testDates.length - filtered.length}`);

console.log('\n=== Final List (Study Days Only) ===');
filtered.forEach(entry => {
  console.log(`- ${entry.hijri} (${entry.dayName})`);
});

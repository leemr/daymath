/**
 * Run from repo root:
 *   node examples/basic.mjs
 */
import {
  day,
  addDays,
  addMonths,
  differenceInDays,
  isSameDay,
  isValid,
  startOfMonth,
  eachDayOfInterval,
} from '../index.js'

// day() is the way in. Both defaults are stated: now, and UTC.
console.log('day()', day())
console.log('day(zone)', day('Asia/Tokyo'))
console.log('addDays(day(), 2)', addDays(day(), 2))

// A Date only enters here, and only with a zone you name or the stated default.
const instant = new Date('2026-08-07T02:30:00Z') // 22:30 the day before in New York
console.log('day(Date)', day(instant))
console.log('day(Date, zone)', day(instant, 'America/New_York'))
console.log('day(epoch ms)', day(1761616161771))

console.log('addDays', addDays('2026-08-06', 1))
console.log('addMonths (constrain)', addMonths('2026-01-31', 1))
console.log('differenceInDays', differenceInDays('2026-08-06', '2026-08-01'))
console.log('isSameDay', isSameDay('2026-08-06', '2026-08-06'))
console.log('startOfMonth', startOfMonth('2026-08-06'))
console.log(
  'eachDayOfInterval',
  eachDayOfInterval({ start: '2026-08-05', end: '2026-08-07' }),
)
console.log('isValid string', isValid('2026-08-06'))
console.log('expanded year', addDays('9999-12-31', 1))

try {
  isValid(new Date())
} catch (err) {
  console.log('isValid(Date) throws:', err.message)
}

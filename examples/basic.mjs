/**
 * Run from repo root:
 *   node examples/basic.mjs
 */
import {
  addDays,
  addMonths,
  differenceInDays,
  isSameDay,
  isValid,
  startOfMonth,
  eachDayOfInterval,
} from '../index.js'

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

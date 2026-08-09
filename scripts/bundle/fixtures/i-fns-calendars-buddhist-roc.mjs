// Shape I — shape D with a resolver that admits exactly ISO, buddhist and roc: the calendars PR
// as it is written in FUTURE.md. I minus D prices that PR; H minus I is what refusing the other
// thirteen calendars saves.
import {
  addDays,
  diffDays,
  fromString,
  toString,
  withDayOfMonth,
  daysInMonth,
} from 'temporal-polyfill/fns/PlainDate'
import { getISO, getBuddhist, getROC } from 'temporal-polyfill/fns/Calendar'

const resolve = (id) =>
  id === 'buddhist' ? getBuddhist() : id === 'roc' ? getROC() : getISO()

// Both sides must name the SAME calendar. Temporal throws `Mismatched calendars` on a diff
// between an annotated day and a plain one, so daymath cannot accept a mixed pair.
const start = fromString('2026-01-31[u-ca=buddhist]', resolve)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01[u-ca=buddhist]', resolve)),
  toString(withDayOfMonth(start, daysInMonth(start))),
)

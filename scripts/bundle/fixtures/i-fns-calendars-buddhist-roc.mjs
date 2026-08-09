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

// Both sides name the same calendar because TEMPORAL requires it: its `diff` throws
// `Mismatched calendars` across two calendars. daymath itself accepts a mixed pair — it normalises
// both operands for measurement — so this constraint is the fns layer's, not daymath's.
const start = fromString('2026-01-31[u-ca=buddhist]', resolve)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01[u-ca=buddhist]', resolve)),
  toString(withDayOfMonth(start, daysInMonth(start))),
)

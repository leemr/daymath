// Shape H — shape D with `getAny`, the resolver that admits every calendar. H minus D is the
// price of the calendars question, paid in bytes by every caller.
import {
  addDays,
  diffDays,
  fromString,
  toString,
  withDayOfMonth,
  daysInMonth,
} from 'temporal-polyfill/fns/PlainDate'
import { getAny } from 'temporal-polyfill/fns/Calendar'

const start = fromString('2026-01-31', getAny)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01', getAny)),
  toString(withDayOfMonth(start, daysInMonth(start))),
)

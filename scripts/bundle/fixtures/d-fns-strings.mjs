// Shape D — the port we are costing. Same three calls, fns tree, strings in and strings out.
//
// `fromString` REQUIRES a calendar resolver as its second argument. That argument is the
// build-time choice of which calendars ship. `getISO` is the smallest one.
import {
  addDays,
  diffDays,
  fromString,
  toString,
  withDayOfMonth,
  daysInMonth,
} from 'temporal-polyfill/fns/PlainDate'
import { getISO } from 'temporal-polyfill/fns/Calendar'

const start = fromString('2026-01-31', getISO)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01', getISO)),
  toString(withDayOfMonth(start, daysInMonth(start))),
)

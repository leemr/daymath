// Shape L — shape K, but fns/ZonedDateTime is kept for the one branch Intl cannot serve:
// wall time plus a named zone, `'2026-08-08T12:00[America/New_York]'`. L minus K is the price of
// keeping that documented input shape without owning a DST-ambiguity policy.
import {
  addDays,
  diffDays,
  fromString,
  toString,
  withDayOfMonth,
  daysInMonth,
} from 'temporal-polyfill/fns/PlainDate'
import { getISO } from 'temporal-polyfill/fns/Calendar'
import {
  fromString as zonedFromString,
  toPlainDate,
} from 'temporal-polyfill/fns/ZonedDateTime'
import { dayFromEpoch, dayFromInstantString, dayNow } from './lib/intl-day.mjs'

const dayFromWallTime = (s) => toString(toPlainDate(zonedFromString(s, getISO)))

const start = fromString(dayFromEpoch(0, 'utc'), getISO)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01', getISO)),
  toString(withDayOfMonth(start, daysInMonth(start))),
  dayFromInstantString('2026-08-09T12:00:00Z', 'utc'),
  dayNow('utc'),
  dayFromWallTime('2026-08-08T12:00[America/New_York]'),
)

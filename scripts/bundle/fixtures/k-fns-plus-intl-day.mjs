// Shape K — shape D plus a day() built on Intl. K minus G is what dropping Instant,
// ZonedDateTime and Now saves. K minus D is what the clock door then costs.
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
  dayFromEpoch,
  dayFromInstantString,
  dayFromWallTime,
  dayNow,
} from './lib/intl-day.mjs'

const start = fromString(dayFromEpoch(0, 'utc'), getISO)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01', getISO)),
  toString(withDayOfMonth(start, daysInMonth(start))),
  dayFromInstantString('2026-08-09T12:00:00Z', 'utc'),
  dayNow('utc'),
  dayFromWallTime('2026-08-08T12:00[America/New_York]'),
)

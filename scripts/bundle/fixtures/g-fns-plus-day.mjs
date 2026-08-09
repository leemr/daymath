// Shape G — shape D plus a hand-built `day()`. G minus D is what the clock door costs in a fns
// port: `Instant`, `ZonedDateTime` and `Now` are three more subpaths, not three more functions.
import {
  addDays,
  diffDays,
  fromString,
  toString,
  withDayOfMonth,
  daysInMonth,
} from 'temporal-polyfill/fns/PlainDate'
import { getISO } from 'temporal-polyfill/fns/Calendar'
import { fromEpochMilliseconds, toZonedDateTimeISO } from 'temporal-polyfill/fns/Instant'
import {
  fromString as zonedFromString,
  toPlainDate,
} from 'temporal-polyfill/fns/ZonedDateTime'
import { plainDateISO } from 'temporal-polyfill/fns/Now'

// The three doors day() opens: an epoch number, a zoned string, and the clock.
const fromEpoch = (ms, tz) =>
  toString(toPlainDate(toZonedDateTimeISO(fromEpochMilliseconds(ms), tz)))
const fromZoned = (s) => toString(toPlainDate(zonedFromString(s, getISO)))
const now = (tz) => toString(plainDateISO(tz))

const start = fromString(fromEpoch(0, 'utc'), getISO)
console.log(
  toString(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01', getISO)),
  toString(withDayOfMonth(start, daysInMonth(start))),
  fromZoned('2026-08-09T12:00:00Z[UTC]'),
  now('utc'),
)

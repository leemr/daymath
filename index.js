/** daymath — calendar date math (ISO 8601 day). date-fns-shaped. No Date / time zones. */
import { Temporal as TemporalPolyfill } from 'temporal-polyfill'

const Temporal = globalThis.Temporal ?? TemporalPolyfill

/**
 * ISO 8601 calendar day string:
 * - `YYYY-MM-DD` (years 0000–9999)
 * - expanded `±YYYYYY-MM-DD` (Temporal form, e.g. `+010000-01-01`)
 *
 * The shape passes this regex; the value must also fall inside the Temporal
 * `PlainDate` range `-271821-04-19` … `+275760-09-13` (roughly ±10^8 days from
 * the epoch). Outside it, Temporal throws and we re-throw with the `daymath:`
 * prefix.
 */
const ISO_DAY =
  /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}$/

/** @typedef {string | Temporal.PlainDate} DayInput */
/**
 * @typedef {object} Interval
 * @property {DayInput} start
 * @property {DayInput} end
 */
/**
 * @typedef {object} WeekOptions
 * @property {0|1|2|3|4|5|6|7} [weekStartsOn] ISO 1=Mon … 7=Sun (default 7).
 * `0` is also accepted for Sunday, because 0 ≡ 7 (mod 7) and the week-offset
 * arithmetic cannot tell them apart. Pre-0.3.0 callers keep working unchanged.
 */

// ─── core conversion ───────────────────────────────────────────────

/**
 * Reject Date and non-calendar values. Accept ISO day string or PlainDate.
 * @param {unknown} value
 * @param {string} label
 * @returns {Temporal.PlainDate}
 */
function toPlainDate(value, label = 'date') {
  if (value instanceof Date) {
    throw new TypeError(
      `daymath: Date is not allowed for ${label} (pass ISO 8601 day string)`,
    )
  }
  if (typeof value === 'string') {
    if (!ISO_DAY.test(value)) {
      throw new RangeError(
        `daymath: ${label} must be ISO 8601 day YYYY-MM-DD or ±YYYYYY-MM-DD (got ${JSON.stringify(value)})`,
      )
    }
    try {
      return Temporal.PlainDate.from(value)
    } catch (err) {
      throw new RangeError(`daymath: invalid ${label} ${JSON.stringify(value)}`, {
        cause: err,
      })
    }
  }
  if (value instanceof Temporal.PlainDate) {
    return value
  }
  throw new TypeError(
    `daymath: ${label} must be ISO 8601 day string or Temporal.PlainDate`,
  )
}

/** @param {Temporal.PlainDate} plain @returns {string} */
function toDayString(plain) {
  return plain.toString()
}

/** @param {unknown} n @param {string} label */
function assertFiniteNumber(n, label) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new TypeError(`daymath: ${label} must be a finite number`)
  }
  if (!Number.isInteger(n)) {
    throw new RangeError(`daymath: ${label} must be an integer`)
  }
}

/**
 * Run a Temporal op and keep the `daymath:` message contract when it fails.
 * Temporal throws bare `Out-of-bounds date` / `Non-positive day`; we prefix and
 * keep the original text plus `cause`. Covers both a result past the range and
 * an argument Temporal refuses outright, hence the neutral wording.
 * @template T
 * @param {string} label
 * @param {() => T} op
 * @returns {T}
 */
function guardRange(label, op) {
  try {
    return op()
  } catch (err) {
    throw new RangeError(
      `daymath: ${label} could not produce a valid date (${/** @type {Error} */ (err).message})`,
      { cause: err },
    )
  }
}

/**
 * Shared body for every add/sub function. Each caller passes its own name, so
 * the message never reports a function the caller did not call.
 * @param {DayInput} date
 * @param {{ days?: number, months?: number, years?: number }} delta
 * @param {string} label
 * @returns {string}
 */
function addDuration(date, delta, label) {
  const d = toPlainDate(date)
  return guardRange(label, () => toDayString(d.add(delta)))
}

/** @param {unknown} dates */
function assertNonEmptyDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new RangeError('daymath: expected a non-empty array of dates')
  }
}

/**
 * @param {WeekOptions} [options]
 * @returns {0|1|2|3|4|5|6}
 */
function weekStartsOnFrom(options) {
  const w = options?.weekStartsOn ?? 7
  if (!Number.isInteger(w) || w < 0 || w > 7) {
    throw new RangeError('daymath: weekStartsOn must be an integer 0…7 (7 or 0 = Sunday)')
  }
  return /** @type {0|1|2|3|4|5|6|7} */ (w)
}

/**
 * @param {unknown} interval
 * @returns {{ start: Temporal.PlainDate, end: Temporal.PlainDate }}
 */
function toInterval(interval) {
  if (interval == null || typeof interval !== 'object') {
    throw new TypeError('daymath: interval must be { start, end }')
  }
  const start = toPlainDate(/** @type {Interval} */ (interval).start, 'start')
  const end = toPlainDate(/** @type {Interval} */ (interval).end, 'end')
  return { start, end }
}

// ─── parse / format / valid ────────────────────────────────────────

/**
 * True if value is a valid daymath day (ISO day string or PlainDate).
 * Invalid strings → false. `Date` → throws (not a quiet false — swap trap).
 * @param {unknown} value
 * @returns {boolean}
 * @throws {TypeError} If `value` is a `Date`
 */
export function isValid(value) {
  if (value instanceof Date) {
    throw new TypeError(
      'daymath: Date is not allowed for isValid (pass ISO 8601 day string)',
    )
  }
  try {
    toPlainDate(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validate / normalize an ISO 8601 calendar day string.
 * @param {DayInput} date
 * @returns {string}
 */
export function parse(date) {
  return toDayString(toPlainDate(date))
}

/**
 * Format as YYYY-MM-DD (only supported pattern).
 * @param {DayInput} date
 * @param {string} [pattern='yyyy-MM-dd']
 * @returns {string}
 */
export function format(date, pattern = 'yyyy-MM-dd') {
  if (pattern !== 'yyyy-MM-dd' && pattern !== 'YYYY-MM-DD') {
    throw new RangeError(
      `daymath: only "yyyy-MM-dd" format is supported (got ${JSON.stringify(pattern)})`,
    )
  }
  return toDayString(toPlainDate(date))
}

// ─── add / sub ─────────────────────────────────────────────────────

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addDays(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, { days: amount }, 'addDays')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subDays(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, { days: -amount }, 'subDays')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addWeeks(date, amount) {
  assertFiniteNumber(amount, 'amount')
  const days = amount * 7 // re-check: 7x a finite amount can still reach Infinity
  assertFiniteNumber(days, 'amount')
  return addDuration(date, { days }, 'addWeeks')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subWeeks(date, amount) {
  assertFiniteNumber(amount, 'amount')
  const days = -amount * 7
  assertFiniteNumber(days, 'amount')
  return addDuration(date, { days }, 'subWeeks')
}

/**
 * Calendar months (overflow constrain — Jan 31 + 1 month → Feb 28/29).
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addMonths(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, { months: amount }, 'addMonths')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subMonths(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, { months: -amount }, 'subMonths')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addYears(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, { years: amount }, 'addYears')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subYears(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, { years: -amount }, 'subYears')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addQuarters(date, amount) {
  assertFiniteNumber(amount, 'amount')
  const months = amount * 3
  assertFiniteNumber(months, 'amount')
  return addDuration(date, { months }, 'addQuarters')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subQuarters(date, amount) {
  assertFiniteNumber(amount, 'amount')
  const months = -amount * 3
  assertFiniteNumber(months, 'amount')
  return addDuration(date, { months }, 'subQuarters')
}

// ─── getters / setters (date-fns / Date month & weekday indexing) ─

/** @param {DayInput} date @returns {number} */
export function getYear(date) {
  return toPlainDate(date).year
}

/**
 * Month number, ISO 8601: 1 = January … 12 = December. Matches the `MM` field
 * of the input string, and Temporal. **Not** date-fns, which is 0-based.
 * @param {DayInput} date
 * @returns {number}
 */
export function getMonth(date) {
  return toPlainDate(date).month
}

/** Day of month 1…31. @param {DayInput} date @returns {number} */
export function getDate(date) {
  return toPlainDate(date).day
}

/**
 * Weekday, ISO 8601: 1 = Monday … 7 = Sunday. Matches Temporal and
 * `Intl.Locale#weekInfo.firstDay`. **Not** date-fns, where Sunday is 0.
 * Only Sunday differs; Monday–Saturday are 1–6 in both.
 * @param {DayInput} date
 * @returns {number}
 */
export function getDay(date) {
  return toPlainDate(date).dayOfWeek
}

/** @param {DayInput} date @returns {number} */
export function getDayOfYear(date) {
  return toPlainDate(date).dayOfYear
}

/** @param {DayInput} date @returns {number} */
export function getDaysInMonth(date) {
  return toPlainDate(date).daysInMonth
}

/** Quarter 1…4. @param {DayInput} date @returns {number} */
export function getQuarter(date) {
  return Math.ceil(toPlainDate(date).month / 3)
}

/** @param {DayInput} date @returns {boolean} */
export function isLeapYear(date) {
  return toPlainDate(date).inLeapYear
}

/**
 * @param {DayInput} date
 * @param {number} year
 * @returns {string}
 */
export function setYear(date, year) {
  assertFiniteNumber(year, 'year')
  const d = toPlainDate(date)
  return guardRange('setYear', () => toDayString(d.with({ year })))
}

/**
 * @param {DayInput} date
 * @param {number} month 1 = January … 12 = December (ISO 8601)
 * @returns {string}
 */
export function setMonth(date, month) {
  assertFiniteNumber(month, 'month')
  if (month < 1 || month > 12) {
    throw new RangeError('daymath: month must be 1…12 (1=January)')
  }
  const d = toPlainDate(date)
  return guardRange('setMonth', () => toDayString(d.with({ month })))
}

/**
 * @param {DayInput} date
 * @param {number} dayOfMonth 1…31; a day past the month end constrains to the
 * last day of that month (no roll-over into the next month, unlike date-fns)
 * @returns {string}
 */
export function setDate(date, dayOfMonth) {
  assertFiniteNumber(dayOfMonth, 'day')
  const d = toPlainDate(date)
  return guardRange('setDate', () => toDayString(d.with({ day: dayOfMonth })))
}

// ─── start / end of unit ───────────────────────────────────────────

// The first/last day of a unit can fall outside the PlainDate range even when
// the input is inside it — startOfMonth('-271821-04-19') wants April 1st, which
// is below the minimum. Throwing is right; guardRange keeps the message ours.

/** @param {DayInput} date @returns {string} */
export function startOfMonth(date) {
  const d = toPlainDate(date)
  return guardRange('startOfMonth', () => toDayString(d.with({ day: 1 })))
}

/** @param {DayInput} date @returns {string} */
export function endOfMonth(date) {
  const d = toPlainDate(date)
  return guardRange('endOfMonth', () => toDayString(d.with({ day: d.daysInMonth })))
}

/** @param {DayInput} date @returns {string} */
export function startOfYear(date) {
  const d = toPlainDate(date)
  return guardRange('startOfYear', () => toDayString(d.with({ month: 1, day: 1 })))
}

/** @param {DayInput} date @returns {string} */
export function endOfYear(date) {
  const d = toPlainDate(date)
  return guardRange('endOfYear', () => toDayString(d.with({ month: 12, day: 31 })))
}

/** @param {DayInput} date @returns {string} */
export function startOfQuarter(date) {
  const d = toPlainDate(date)
  const month = (getQuarter(d) - 1) * 3 + 1
  return guardRange('startOfQuarter', () => toDayString(d.with({ month, day: 1 })))
}

/** @param {DayInput} date @returns {string} */
export function endOfQuarter(date) {
  const d = toPlainDate(date)
  const month = getQuarter(d) * 3
  return guardRange('endOfQuarter', () => {
    const mid = d.with({ month, day: 1 })
    return toDayString(mid.with({ day: mid.daysInMonth }))
  })
}

/**
 * @param {DayInput} date
 * @param {WeekOptions} [options]
 * @returns {string}
 */
export function startOfWeek(date, options) {
  const d = toPlainDate(date)
  const diff = daysIntoWeek(d, options)
  return guardRange('startOfWeek', () => toDayString(d.subtract({ days: diff })))
}

/**
 * How far the day sits past the start of its week.
 * @param {Temporal.PlainDate} d
 * @param {WeekOptions} [options]
 * @returns {number}
 */
function daysIntoWeek(d, options) {
  const weekStartsOn = weekStartsOnFrom(options)
  // mod 7 makes weekStartsOn 0 and 7 identical, so both spellings of Sunday work
  return (d.dayOfWeek - weekStartsOn + 7) % 7
}

/**
 * @param {DayInput} date
 * @param {WeekOptions} [options]
 * @returns {string}
 */
export function endOfWeek(date, options) {
  const d = toPlainDate(date)
  const diff = daysIntoWeek(d, options)
  // one guard for the whole walk, so a failure at either end says endOfWeek
  return guardRange('endOfWeek', () =>
    toDayString(d.subtract({ days: diff }).add({ days: 6 })),
  )
}

// ─── differences ───────────────────────────────────────────────────

/**
 * Full calendar days: dateLeft − dateRight (date-fns order).
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInDays(dateLeft, dateRight) {
  const left = toPlainDate(dateLeft, 'dateLeft')
  const right = toPlainDate(dateRight, 'dateRight')
  return left.since(right, { largestUnit: 'day' }).days
}

/**
 * Full weeks (trunc toward 0), like date-fns.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInWeeks(dateLeft, dateRight) {
  return Math.trunc(differenceInDays(dateLeft, dateRight) / 7)
}

/**
 * Full months (signed). A month counts as full when `addMonths` would carry the
 * earlier date to the later one, so the end of a short month counts: 31 January
 * to 28 February is one month, because `addMonths` clamps 31 February to the
 * 28th. That keeps `differenceInMonths(addMonths(d, n), d) === n`.
 *
 * Temporal's `since` is not used here. It has no overflow option, so it counts
 * 28 days rather than one month for that pair, and the round trip breaks in
 * 21,934 of 1,761,936 cases. `add` clamps, so the measurement has to match.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInMonths(dateLeft, dateRight) {
  const left = toPlainDate(dateLeft, 'dateLeft')
  const right = toPlainDate(dateRight, 'dateRight')
  const sign = Temporal.PlainDate.compare(left, right)
  if (sign === 0) return 0
  const diff = Math.abs(differenceInCalendarMonths(left, right))
  if (diff < 1) return 0
  const [earlier, later] = sign > 0 ? [right, left] : [left, right]
  // Where `earlier` lands after `diff` months: same year-month as `later` by
  // construction, on `earlier`'s day clamped to that month's length. Compared
  // as day numbers rather than built as a date, because the landing can sit
  // past the maximum PlainDate even when both operands are inside the range.
  const landingDay = Math.min(earlier.day, later.daysInMonth)
  const isLastMonthNotFull = landingDay > later.day
  return sign * (diff - +isLastMonthNotFull) || 0
}

/**
 * Calendar month index diff: (yL−yR)*12 + (mL−mR). Ignores day-of-month.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInCalendarMonths(dateLeft, dateRight) {
  const left = toPlainDate(dateLeft, 'dateLeft')
  const right = toPlainDate(dateRight, 'dateRight')
  return (left.year - right.year) * 12 + (left.month - right.month)
}

/**
 * Full years (signed).
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInYears(dateLeft, dateRight) {
  const left = toPlainDate(dateLeft, 'dateLeft')
  const right = toPlainDate(dateRight, 'dateRight')
  return left.since(right, { largestUnit: 'year' }).years
}

/**
 * Calendar year number diff. Ignores month/day.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInCalendarYears(dateLeft, dateRight) {
  return getYear(dateLeft) - getYear(dateRight)
}

/**
 * Full quarters (trunc toward 0 of calendar-month/3 style via months).
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInQuarters(dateLeft, dateRight) {
  return Math.trunc(differenceInMonths(dateLeft, dateRight) / 3)
}

/**
 * Calendar quarter index diff.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInCalendarQuarters(dateLeft, dateRight) {
  const left = toPlainDate(dateLeft, 'dateLeft')
  const right = toPlainDate(dateRight, 'dateRight')
  return (
    (left.year - right.year) * 4 + (getQuarter(left) - getQuarter(right))
  )
}

// ─── compare / equal ───────────────────────────────────────────────

/**
 * @param {DayInput} date
 * @param {DayInput} dateToCompare
 * @returns {boolean}
 */
export function isBefore(date, dateToCompare) {
  return (
    Temporal.PlainDate.compare(
      toPlainDate(date),
      toPlainDate(dateToCompare, 'dateToCompare'),
    ) < 0
  )
}

/**
 * @param {DayInput} date
 * @param {DayInput} dateToCompare
 * @returns {boolean}
 */
export function isAfter(date, dateToCompare) {
  return (
    Temporal.PlainDate.compare(
      toPlainDate(date),
      toPlainDate(dateToCompare, 'dateToCompare'),
    ) > 0
  )
}

/**
 * Same calendar day.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isEqual(dateLeft, dateRight) {
  return (
    Temporal.PlainDate.compare(
      toPlainDate(dateLeft, 'dateLeft'),
      toPlainDate(dateRight, 'dateRight'),
    ) === 0
  )
}

/** Alias of `isEqual` (date-fns name for same calendar day). */
export const isSameDay = isEqual

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @param {WeekOptions} [options]
 * @returns {boolean}
 */
export function isSameWeek(dateLeft, dateRight, options) {
  const left = toPlainDate(dateLeft, 'dateLeft')
  const right = toPlainDate(dateRight, 'dateRight')
  // own guard, so a week start below the minimum does not say startOfWeek
  return guardRange('isSameWeek', () =>
    left.subtract({ days: daysIntoWeek(left, options) }).equals(
      right.subtract({ days: daysIntoWeek(right, options) }),
    ),
  )
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isSameMonth(dateLeft, dateRight) {
  const a = toPlainDate(dateLeft, 'dateLeft')
  const b = toPlainDate(dateRight, 'dateRight')
  return a.year === b.year && a.month === b.month
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isSameYear(dateLeft, dateRight) {
  return getYear(dateLeft) === getYear(dateRight)
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isSameQuarter(dateLeft, dateRight) {
  const a = toPlainDate(dateLeft, 'dateLeft')
  const b = toPlainDate(dateRight, 'dateRight')
  return a.year === b.year && getQuarter(a) === getQuarter(b)
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {-1 | 0 | 1}
 */
export function compareAsc(dateLeft, dateRight) {
  return /** @type {-1 | 0 | 1} */ (
    Temporal.PlainDate.compare(
      toPlainDate(dateLeft, 'dateLeft'),
      toPlainDate(dateRight, 'dateRight'),
    )
  )
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {-1 | 0 | 1}
 */
export function compareDesc(dateLeft, dateRight) {
  // `|| 0` normalises -0 for equal days
  return /** @type {-1 | 0 | 1} */ (-compareAsc(dateLeft, dateRight) || 0)
}

/**
 * @param {DayInput[]} dates
 * @returns {string}
 */
export function min(dates) {
  assertNonEmptyDates(dates)
  return toDayString(
    dates
      .map((d) => toPlainDate(d))
      .reduce((a, b) => (Temporal.PlainDate.compare(a, b) <= 0 ? a : b)),
  )
}

/**
 * @param {DayInput[]} dates
 * @returns {string}
 */
export function max(dates) {
  assertNonEmptyDates(dates)
  return toDayString(
    dates
      .map((d) => toPlainDate(d))
      .reduce((a, b) => (Temporal.PlainDate.compare(a, b) >= 0 ? a : b)),
  )
}

// ─── weekday predicates ────────────────────────────────────────────

/** @param {DayInput} date @returns {boolean} */
export function isSunday(date) {
  return getDay(date) === 7
}
/** @param {DayInput} date @returns {boolean} */
export function isMonday(date) {
  return getDay(date) === 1
}
/** @param {DayInput} date @returns {boolean} */
export function isTuesday(date) {
  return getDay(date) === 2
}
/** @param {DayInput} date @returns {boolean} */
export function isWednesday(date) {
  return getDay(date) === 3
}
/** @param {DayInput} date @returns {boolean} */
export function isThursday(date) {
  return getDay(date) === 4
}
/** @param {DayInput} date @returns {boolean} */
export function isFriday(date) {
  return getDay(date) === 5
}
/** @param {DayInput} date @returns {boolean} */
export function isSaturday(date) {
  return getDay(date) === 6
}
/** @param {DayInput} date @returns {boolean} */
export function isWeekend(date) {
  const d = getDay(date)
  return d === 6 || d === 7
}

/** @param {DayInput} date @returns {boolean} */
export function isFirstDayOfMonth(date) {
  return getDate(date) === 1
}

/** @param {DayInput} date @returns {boolean} */
export function isLastDayOfMonth(date) {
  const d = toPlainDate(date)
  return d.day === d.daysInMonth
}

// ─── intervals ─────────────────────────────────────────────────────

/**
 * Inclusive day range. Throws if start > end.
 * @param {Interval} interval
 * @returns {string[]}
 */
export function eachDayOfInterval(interval) {
  const { start, end } = toInterval(interval)
  if (Temporal.PlainDate.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  /** @type {string[]} */
  const out = []
  let cur = start
  // break on the last day, never step past it — an add beyond the max
  // PlainDate (+275760-09-13) throws
  for (;;) {
    out.push(toDayString(cur))
    if (Temporal.PlainDate.compare(cur, end) >= 0) break
    cur = cur.add({ days: 1 })
  }
  return out
}

/**
 * First day of each month from start’s month through end’s month (date-fns shape).
 * @param {Interval} interval
 * @returns {string[]}
 */
export function eachMonthOfInterval(interval) {
  const { start, end } = toInterval(interval)
  if (Temporal.PlainDate.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  /** @type {string[]} */
  const out = []
  // the 1st of start's month can sit below the minimum PlainDate
  const [cur0, last] = guardRange('eachMonthOfInterval', () => [
    start.with({ day: 1 }),
    end.with({ day: 1 }),
  ])
  let cur = cur0
  // same boundary rule as eachDayOfInterval
  for (;;) {
    out.push(toDayString(cur))
    if (Temporal.PlainDate.compare(cur, last) >= 0) break
    cur = cur.add({ months: 1 })
  }
  return out
}

/**
 * Jan 1 of each year from start’s year through end’s year.
 * @param {Interval} interval
 * @returns {string[]}
 */
export function eachYearOfInterval(interval) {
  const { start, end } = toInterval(interval)
  if (Temporal.PlainDate.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  /** @type {string[]} */
  const out = []
  let y = start.year
  // Jan 1 of start's year can sit below the minimum PlainDate
  guardRange('eachYearOfInterval', () => {
    while (y <= end.year) {
      out.push(toDayString(Temporal.PlainDate.from({ year: y, month: 1, day: 1 })))
      y += 1
    }
  })
  return out
}

/**
 * Inclusive: start ≤ date ≤ end.
 * @param {DayInput} date
 * @param {Interval} interval
 * @returns {boolean}
 */
export function isWithinInterval(date, interval) {
  const d = toPlainDate(date)
  const { start, end } = toInterval(interval)
  if (Temporal.PlainDate.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  return (
    Temporal.PlainDate.compare(d, start) >= 0 &&
    Temporal.PlainDate.compare(d, end) <= 0
  )
}

/**
 * Clamp date into [start, end].
 * @param {DayInput} date
 * @param {Interval} interval
 * @returns {string}
 */
export function clamp(date, interval) {
  const d = toPlainDate(date)
  const { start, end } = toInterval(interval)
  if (Temporal.PlainDate.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  if (Temporal.PlainDate.compare(d, start) < 0) return toDayString(start)
  if (Temporal.PlainDate.compare(d, end) > 0) return toDayString(end)
  return toDayString(d)
}

/**
 * Whether two inclusive intervals overlap.
 * @param {Interval} intervalLeft
 * @param {Interval} intervalRight
 * @param {{ inclusive?: boolean }} [options] `inclusive` defaults to false, like date-fns: intervals that only touch at an endpoint do not overlap
 * @returns {boolean}
 */
export function areIntervalsOverlapping(intervalLeft, intervalRight, options) {
  const a = toInterval(intervalLeft)
  const b = toInterval(intervalRight)
  if (Temporal.PlainDate.compare(a.start, a.end) > 0) {
    throw new RangeError('daymath: intervalLeft start must not be after end')
  }
  if (Temporal.PlainDate.compare(b.start, b.end) > 0) {
    throw new RangeError('daymath: intervalRight start must not be after end')
  }
  const inclusive = options?.inclusive ?? false
  if (inclusive) {
    return (
      Temporal.PlainDate.compare(a.start, b.end) <= 0 &&
      Temporal.PlainDate.compare(b.start, a.end) <= 0
    )
  }
  // date-fns default: touch-at-endpoint is NOT overlap
  return (
    Temporal.PlainDate.compare(a.start, b.end) < 0 &&
    Temporal.PlainDate.compare(b.start, a.end) < 0
  )
}

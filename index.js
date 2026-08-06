/** daymath — calendar date math (YYYY-MM-DD). date-fns-shaped. No Date / time zones. */
import { Temporal as TemporalPolyfill } from 'temporal-polyfill'

const Temporal = globalThis.Temporal ?? TemporalPolyfill

/** @typedef {string | Temporal.PlainDate} DayInput */

/**
 * Reject Date and non-calendar values. Accept YYYY-MM-DD string or PlainDate.
 * @param {unknown} value
 * @param {string} label
 * @returns {Temporal.PlainDate}
 */
function toPlainDate(value, label = 'date') {
  if (value instanceof Date) {
    throw new TypeError(
      `daymath: Date is not allowed for ${label} (pass YYYY-MM-DD string)`,
    )
  }
  if (typeof value === 'string') {
    // Strict calendar day: no time, no offset, no week dates.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new RangeError(
        `daymath: ${label} must be YYYY-MM-DD (got ${JSON.stringify(value)})`,
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
    `daymath: ${label} must be YYYY-MM-DD string or Temporal.PlainDate`,
  )
}

/** @param {Temporal.PlainDate} plain @returns {string} */
function toDayString(plain) {
  return plain.toString()
}

/** @param {unknown} value */
export function isValid(value) {
  try {
    toPlainDate(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validate / normalize a calendar day string.
 * @param {DayInput} date
 * @returns {string}
 */
export function parse(date) {
  return toDayString(toPlainDate(date))
}

/**
 * Format as YYYY-MM-DD (only supported pattern for now).
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

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addDays(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return toDayString(toPlainDate(date).add({ days: amount }))
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subDays(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDays(date, -amount)
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addWeeks(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDays(date, amount * 7)
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subWeeks(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addWeeks(date, -amount)
}

/**
 * Calendar months (Temporal overflow: constrain — e.g. Jan 31 + 1 month → Feb 28/29).
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addMonths(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return toDayString(toPlainDate(date).add({ months: amount }))
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subMonths(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addMonths(date, -amount)
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addYears(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return toDayString(toPlainDate(date).add({ years: amount }))
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subYears(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addYears(date, -amount)
}

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
  return /** @type {-1 | 0 | 1} */ (-compareAsc(dateLeft, dateRight))
}

/**
 * @param {DayInput[]} dates
 * @returns {string}
 */
export function min(dates) {
  assertNonEmptyDates(dates)
  return toDayString(
    dates.map((d) => toPlainDate(d)).reduce((a, b) => (Temporal.PlainDate.compare(a, b) <= 0 ? a : b)),
  )
}

/**
 * @param {DayInput[]} dates
 * @returns {string}
 */
export function max(dates) {
  assertNonEmptyDates(dates)
  return toDayString(
    dates.map((d) => toPlainDate(d)).reduce((a, b) => (Temporal.PlainDate.compare(a, b) >= 0 ? a : b)),
  )
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

/** @param {unknown} dates */
function assertNonEmptyDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new RangeError('daymath: expected a non-empty array of dates')
  }
}

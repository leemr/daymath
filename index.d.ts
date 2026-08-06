import type { Temporal } from 'temporal-polyfill'

/**
 * Calendar day input: ISO 8601 `YYYY-MM-DD` string, or a Temporal.PlainDate.
 * `Date` is rejected at runtime.
 */
export type DayInput = string | Temporal.PlainDate

/** Inclusive calendar-day interval (date-fns shape). */
export type Interval = {
  start: DayInput
  end: DayInput
}

/**
 * Week options. `weekStartsOn`: 0 = Sunday … 6 = Saturday (date-fns default 0).
 */
export type WeekOptions = {
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export function isValid(value: unknown): boolean

/** Validate / normalize to ISO 8601 `YYYY-MM-DD`. */
export function parse(date: DayInput): string

/** Format as `YYYY-MM-DD` (only pattern supported). */
export function format(date: DayInput, pattern?: 'yyyy-MM-dd' | 'YYYY-MM-DD'): string

export function addDays(date: DayInput, amount: number): string
export function subDays(date: DayInput, amount: number): string
export function addWeeks(date: DayInput, amount: number): string
export function subWeeks(date: DayInput, amount: number): string
export function addMonths(date: DayInput, amount: number): string
export function subMonths(date: DayInput, amount: number): string
export function addYears(date: DayInput, amount: number): string
export function subYears(date: DayInput, amount: number): string
export function addQuarters(date: DayInput, amount: number): string
export function subQuarters(date: DayInput, amount: number): string

/** Full year number. */
export function getYear(date: DayInput): number
/** Month index like Date/date-fns: 0 = January … 11 = December. */
export function getMonth(date: DayInput): number
/** Day of month 1…31. */
export function getDate(date: DayInput): number
/** Weekday like Date/date-fns: 0 = Sunday … 6 = Saturday. */
export function getDay(date: DayInput): number
export function getDayOfYear(date: DayInput): number
export function getDaysInMonth(date: DayInput): number
/** Quarter 1…4. */
export function getQuarter(date: DayInput): number
export function isLeapYear(date: DayInput): boolean

export function setYear(date: DayInput, year: number): string
/** `month`: 0 = January … 11 = December (date-fns). */
export function setMonth(date: DayInput, month: number): string
export function setDate(date: DayInput, dayOfMonth: number): string

export function startOfMonth(date: DayInput): string
export function endOfMonth(date: DayInput): string
export function startOfYear(date: DayInput): string
export function endOfYear(date: DayInput): string
export function startOfQuarter(date: DayInput): string
export function endOfQuarter(date: DayInput): string
export function startOfWeek(date: DayInput, options?: WeekOptions): string
export function endOfWeek(date: DayInput, options?: WeekOptions): string

/** Full days: `dateLeft − dateRight` (date-fns argument order). */
export function differenceInDays(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInWeeks(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInMonths(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInCalendarMonths(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInYears(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInCalendarYears(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInQuarters(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInCalendarQuarters(dateLeft: DayInput, dateRight: DayInput): number

export function isBefore(date: DayInput, dateToCompare: DayInput): boolean
export function isAfter(date: DayInput, dateToCompare: DayInput): boolean
/** Same calendar day. */
export function isEqual(dateLeft: DayInput, dateRight: DayInput): boolean
/** Alias of `isEqual` (date-fns name). */
export const isSameDay: typeof isEqual

export function isSameWeek(
  dateLeft: DayInput,
  dateRight: DayInput,
  options?: WeekOptions,
): boolean
export function isSameMonth(dateLeft: DayInput, dateRight: DayInput): boolean
export function isSameYear(dateLeft: DayInput, dateRight: DayInput): boolean
export function isSameQuarter(dateLeft: DayInput, dateRight: DayInput): boolean

export function compareAsc(dateLeft: DayInput, dateRight: DayInput): -1 | 0 | 1
export function compareDesc(dateLeft: DayInput, dateRight: DayInput): -1 | 0 | 1

export function min(dates: DayInput[]): string
export function max(dates: DayInput[]): string

export function isSunday(date: DayInput): boolean
export function isMonday(date: DayInput): boolean
export function isTuesday(date: DayInput): boolean
export function isWednesday(date: DayInput): boolean
export function isThursday(date: DayInput): boolean
export function isFriday(date: DayInput): boolean
export function isSaturday(date: DayInput): boolean
export function isWeekend(date: DayInput): boolean
export function isFirstDayOfMonth(date: DayInput): boolean
export function isLastDayOfMonth(date: DayInput): boolean

export function eachDayOfInterval(interval: Interval): string[]
export function eachMonthOfInterval(interval: Interval): string[]
export function eachYearOfInterval(interval: Interval): string[]
export function isWithinInterval(date: DayInput, interval: Interval): boolean
export function clamp(date: DayInput, interval: Interval): string
/**
 * date-fns default: `inclusive: false` (touching endpoints only is not overlap).
 * Pass `{ inclusive: true }` for closed intervals.
 */
export function areIntervalsOverlapping(
  intervalLeft: Interval,
  intervalRight: Interval,
  options?: { inclusive?: boolean },
): boolean

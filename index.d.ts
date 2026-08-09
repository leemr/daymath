import type { Temporal } from 'temporal-polyfill'

/**
 * Calendar day input: ISO 8601 day string, or a Temporal.PlainDate.
 * - `YYYY-MM-DD` (years 0000–9999)
 * - expanded `±YYYYYY-MM-DD` (e.g. `+010000-01-01`)
 *
 * Usable range is the Temporal `PlainDate` range `-271821-04-19` …
 * `+275760-09-13`; a day outside it throws a `RangeError`.
 * `Date` is rejected at runtime (TypeError).
 *
 * A `[u-ca=…]` calendar annotation is accepted when the calendar only relabels
 * the year, and it rides along into the result:
 * `getYear('2026-01-31[u-ca=buddhist]')` is `2569` and `addDays` of it is
 * `'2026-02-01[u-ca=buddhist]'`. Today that admits `buddhist`, `roc`,
 * `japanese` and `gregory`. A calendar that renumbers months or days, such as
 * `hebrew` or `chinese`, throws a `RangeError`. The line is measured at runtime
 * rather than held as a list, so no code names a calendar.
 *
 * Measurement ignores the label, because a day is the same day whatever its
 * year is called: `differenceInDays` and `isEqual` normalise both operands, so a
 * mixed pair answers instead of throwing `Mismatched calendars`.
 */
export type DayInput = string | Temporal.PlainDate

/** Inclusive calendar-day interval (date-fns shape). */
export type Interval = {
  start: DayInput
  end: DayInput
}

/**
 * Week options. `weekStartsOn`: ISO 1 = Monday … 7 = Sunday (default 7).
 * `0` is also accepted for Sunday — 0 ≡ 7 (mod 7), so pre-0.3.0 callers keep
 * working with no change in behaviour.
 */
export type WeekOptions = {
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
}

/**
 * The calendar day of a moment, in a zone. The way in.
 *
 * Both defaults are stated: the moment is now, the zone is UTC. A number is
 * read as epoch **milliseconds**, exactly as `new Date(n)` reads it. An ISO day
 * string is already a day, so a zone does not apply to it. An ISO timestamp
 * carrying `Z` or an offset names an exact instant, so it is read as a moment.
 *
 * A string carrying a `[Zone]` annotation names its own zone, so it answers its
 * own civil day and the UTC default never applies. Passing `tz` as well throws.
 *
 * `'11/12/2026'` is refused, because nobody can tell November from December in
 * it. `'2026-08-08T12:00'` is refused too: no offset and no zone, so daymath
 * would have to pick one. Name the zone and it is accepted.
 *
 * A lone string takes one of four roles, in this order: a day, a zoned time, an
 * instant, then a zone. The zone test is by shape — an IANA name, which carries
 * no `:`, or a bare offset — so a timestamp can never be read as a zone.
 *
 * A calendar is judged only where it is applied, which means with a `[Zone]`
 * bracket. An accepted calendar rides along, so
 * `day('2026-08-08T12:00[America/New_York][u-ca=buddhist]')` answers
 * `'2026-08-08[u-ca=buddhist]'` and the result is not always bare `YYYY-MM-DD`.
 * Without a zone bracket the string names an `Instant`, which has no fields for
 * a calendar to renumber, so the annotation is inert and is dropped.
 */
export function day(tz?: string): string
export function day(
  moment: Date | number | DayInput | null | undefined,
  tz?: string,
): string

/**
 * True for a valid daymath day string / PlainDate.
 * Invalid strings → false. `Date` → throws TypeError (not a quiet false).
 */
export function isValid(value: unknown): boolean

/** Validate / normalize to ISO 8601 day string (Temporal `toString` form). */
export function parse(date: DayInput): string

/** Format as ISO day (only `yyyy-MM-dd` / `YYYY-MM-DD` patterns supported). */
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
/** Month number, ISO 8601: 1 = January … 12 = December. Not date-fns's 0-based index. */
export function getMonth(date: DayInput): number
/** Day of month 1…31. */
export function getDate(date: DayInput): number
/** Weekday, ISO 8601: 1 = Monday … 7 = Sunday. Only Sunday differs from date-fns. */
export function getDay(date: DayInput): number
export function getDayOfYear(date: DayInput): number
export function getDaysInMonth(date: DayInput): number
/** Quarter 1…4. */
export function getQuarter(date: DayInput): number
export function isLeapYear(date: DayInput): boolean

export function setYear(date: DayInput, year: number): string
/** `month`: 1 = January … 12 = December (ISO 8601). */
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
export function differenceInCalendarMonths(
  dateLeft: DayInput,
  dateRight: DayInput,
): number
export function differenceInYears(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInCalendarYears(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInQuarters(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInCalendarQuarters(
  dateLeft: DayInput,
  dateRight: DayInput,
): number

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

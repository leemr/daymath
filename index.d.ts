import type { Temporal } from 'temporal-polyfill'

/**
 * Calendar day input: ISO 8601 day string, or a Temporal.PlainDate.
 * - `YYYY-MM-DD` (years 0000–9999)
 * - expanded `±YYYYYY-MM-DD` (e.g. `+010000-01-01`)
 * - either of those with a zoneless wall clock on it, `YYYY-MM-DD HH:MM[:SS[.fff]]`,
 *   with `T`, `t` or a space between them. The clock is dropped and never read, so
 *   `getYear('2026-08-08 12:00:00')` is `2026`. This is the shape SQLite stores:
 *   `datetime()`, `CURRENT_TIMESTAMP` and `strftime('%Y-%m-%d %H:%M:%f')` all emit
 *   it, so a column value needs no reshaping. The **hour is the only bound**,
 *   because the hour is the only field that can change the date: `24:00` is refused
 *   because ISO `24:00` starts the next day, while a leap second `23:59:60` and a
 *   fraction of any length stay inside their own day and are accepted.
 *
 * A clock naming a zone — `Z`, an offset, or `[Zone]` — is NOT day input. It names
 * an instant, and `day()` is the only door an instant enters by.
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
 * it.
 *
 * A zoneless wall clock is a day, so `'2026-08-08 12:00:00'` — a SQLite
 * `DATETIME` — answers `'2026-08-08'` and the clock is dropped. Pass `tz` with
 * one and it throws: naming a zone means convert, and a clock with no zone gives
 * nothing to convert from. Put the zone in the string and it converts.
 *
 * A lone string takes one of four roles, in this order: a day, a zoned time, an
 * instant, then a zone. The zone test is by shape — an IANA name, which carries
 * no `:`, or a bare offset — so a timestamp can never be read as a zone.
 *
 * **day() is the normaliser, and that is the whole rule: a moment converts to a
 * plain ISO day, and so does a day.** A `[u-ca=…]` annotation is accepted
 * wherever the other exports accept it, and then dropped from the result, so
 * `day` never returns `[u-ca=…]`. Every other export carries it. `parse`
 * validates and preserves; `day` normalises.
 *
 * A calendar that renumbers months or days is still refused where it is
 * applied, which means with a `[Zone]` bracket and on a day string.
 * @example day()                          // today, UTC
 * @example day('Asia/Tokyo')              // today in Tokyo
 * @example day(row.createdAt)             // a Date, read in UTC
 * @example day(row.createdAt, 'Asia/Tokyo') // the same instant, Tokyo's day
 * @example day('1999-01-01T00:00:00Z')    // '1999-01-01'
 * @example day('2026-08-08 12:00:00')     // '2026-08-08'  a SQLite DATETIME
 */
export function day(tz?: string): string
export function day(
  moment: Date | number | DayInput | null | undefined,
  tz?: string,
): string

/**
 * True for a valid daymath day string / PlainDate.
 * Invalid strings → false. `Date` → throws TypeError (not a quiet false).
 * @example isValid('2026-08-08')       // true
 * @example isValid('2026-02-30')       // false
 * @example isValid('2026-08-08 12:00:00') // true   clock dropped
 * @example isValid(new Date())         // throws TypeError, not false
 */
export function isValid(value: unknown): boolean

/**
 * Validate / normalize to ISO 8601 day string (Temporal `toString` form).
 *
 * `parse` preserves what it is given; `day()` normalizes. So a calendar
 * annotation survives here and is dropped by `day()`.
 * @example parse('2026-08-08')                // '2026-08-08'
 * @example parse('2026-08-08 12:00:00')       // '2026-08-08'  clock dropped
 * @example parse('2026-01-31[u-ca=buddhist]') // '2026-01-31[u-ca=buddhist]'
 * @example parse('2026-02-30')                // throws RangeError
 */
export function parse(date: DayInput): string

/**
 * Format as ISO day (only `yyyy-MM-dd` / `YYYY-MM-DD` patterns supported).
 *
 * Not locale display. For that, use `Intl` or a date-fns formatter.
 * @example format('2026-08-08')               // '2026-08-08'
 * @example format('2026-08-08', 'dd/MM/yyyy') // throws RangeError
 */
export function format(date: DayInput, pattern?: 'yyyy-MM-dd' | 'YYYY-MM-DD'): string

/**
 * @example addDays('2026-08-08', 30) // '2026-09-07'
 * @example addDays('2026-08-08', -1) // '2026-08-07'
 */
export function addDays(date: DayInput, amount: number): string
export function subDays(date: DayInput, amount: number): string
export function addWeeks(date: DayInput, amount: number): string
export function subWeeks(date: DayInput, amount: number): string
/**
 * Overflow **clamps** to the last day of the target month; it never rolls into
 * the next one. Same rule in both directions, and the same rule `setMonth`,
 * `setDate` and `setYear` use.
 * @example addMonths('2026-01-31', 1)  // '2026-02-28'  clamped, not '2026-03-03'
 * @example addMonths('2026-03-31', -1) // '2026-02-28'
 * @example addMonths('2024-01-31', 1)  // '2024-02-29'  leap year
 */
export function addMonths(date: DayInput, amount: number): string
export function subMonths(date: DayInput, amount: number): string
export function addYears(date: DayInput, amount: number): string
export function subYears(date: DayInput, amount: number): string
export function addQuarters(date: DayInput, amount: number): string
export function subQuarters(date: DayInput, amount: number): string

/** Full year number. */
export function getYear(date: DayInput): number
/**
 * Month number, ISO 8601: 1 = January … 12 = December. Not date-fns's 0-based index.
 * @example getMonth('2026-08-08') // 8   — date-fns would answer 7
 * @example getMonth('2026-01-15') // 1
 */
export function getMonth(date: DayInput): number
/** Day of month 1…31. */
export function getDate(date: DayInput): number
/**
 * Weekday, ISO 8601: 1 = Monday … 7 = Sunday. Only Sunday differs from date-fns.
 * @example getDay('2026-08-10') // 1   a Monday
 * @example getDay('2026-08-09') // 7   a Sunday — date-fns would answer 0
 */
export function getDay(date: DayInput): number
export function getDayOfYear(date: DayInput): number
export function getDaysInMonth(date: DayInput): number
/** Quarter 1…4. */
export function getQuarter(date: DayInput): number
export function isLeapYear(date: DayInput): boolean

/**
 * Overflow clamps, so 29 February survives a move to a common year. **date-fns rolls here
 * instead**, so this is the second deliberate disagreement after `setDate` — and the one a caller
 * reaches by accident, through a stored 29 February.
 * @example setYear('2024-02-29', 2026) // '2026-02-28'  clamped; date-fns gives '2026-03-01'
 */
export function setYear(date: DayInput, year: number): string
/**
 * `month`: 1 = January … 12 = December (ISO 8601). Overflow clamps.
 * @example setMonth('2026-01-31', 2) // '2026-02-28'  clamped
 */
export function setMonth(date: DayInput, month: number): string
/**
 * Overflow clamps to the end of the month. **date-fns rolls here instead**, so
 * this is one of the few places the two answer differently on purpose.
 * @example setDate('2026-02-01', 31) // '2026-02-28'  daymath clamps
 */
export function setDate(date: DayInput, dayOfMonth: number): string

export function startOfMonth(date: DayInput): string
/**
 * @example endOfMonth('2024-02-01') // '2024-02-29'
 */
export function endOfMonth(date: DayInput): string
export function startOfYear(date: DayInput): string
export function endOfYear(date: DayInput): string
export function startOfQuarter(date: DayInput): string
export function endOfQuarter(date: DayInput): string
/**
 * `weekStartsOn` defaults to **7 (Sunday)**, and `0` is accepted for Sunday too.
 * @example startOfWeek('2026-08-12')                     // '2026-08-09'  Sunday
 * @example startOfWeek('2026-08-12', { weekStartsOn: 1 }) // '2026-08-10'  Monday
 */
export function startOfWeek(date: DayInput, options?: WeekOptions): string
export function endOfWeek(date: DayInput, options?: WeekOptions): string

/**
 * Full days: `dateLeft − dateRight` (date-fns argument order).
 * @example differenceInDays('2026-08-08', '2026-08-01') //  7
 * @example differenceInDays('2026-08-01', '2026-08-08') // -7  order matters
 */
export function differenceInDays(dateLeft: DayInput, dateRight: DayInput): number
export function differenceInWeeks(dateLeft: DayInput, dateRight: DayInput): number
/**
 * A month counts as full when `addMonths` would carry the earlier date to the
 * later one, so `differenceInMonths(addMonths(d, n), d) === n` always holds. Use
 * `differenceInCalendarMonths` to count boundaries crossed instead.
 * @example differenceInMonths('2026-02-28', '2026-01-31')         // 1  addMonths clamps to here
 * @example differenceInCalendarMonths('2026-02-01', '2026-01-31') // 1  one boundary, one day apart
 */
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
/**
 * Same calendar day, and the calendar label is ignored. Temporal's own `equals`
 * compares the calendar too, so it answers `false` for one day written two ways;
 * daymath compares the day alone and answers `true`.
 * @example isEqual('2026-01-31[u-ca=buddhist]', '2026-01-31') // true  same day
 */
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

/**
 * Takes an **array**, not a rest argument.
 * @example min(['2026-08-08', '2026-01-01']) // '2026-01-01'
 */
export function min(dates: DayInput[]): string
export function max(dates: DayInput[]): string

export function isSunday(date: DayInput): boolean
export function isMonday(date: DayInput): boolean
export function isTuesday(date: DayInput): boolean
export function isWednesday(date: DayInput): boolean
export function isThursday(date: DayInput): boolean
export function isFriday(date: DayInput): boolean
export function isSaturday(date: DayInput): boolean
/**
 * ISO Saturday and Sunday (6 and 7). Not configurable, and no holiday calendar.
 * @example isWeekend('2026-08-08') // true   a Saturday
 * @example isWeekend('2026-08-10') // false  a Monday
 */
export function isWeekend(date: DayInput): boolean
export function isFirstDayOfMonth(date: DayInput): boolean
export function isLastDayOfMonth(date: DayInput): boolean

/**
 * Both ends **inclusive**, so a one-day interval returns one day.
 * @example eachDayOfInterval({ start: '2026-08-08', end: '2026-08-10' })
 * // ['2026-08-08', '2026-08-09', '2026-08-10']
 */
export function eachDayOfInterval(interval: Interval): string[]
export function eachMonthOfInterval(interval: Interval): string[]
export function eachYearOfInterval(interval: Interval): string[]
/**
 * Both ends **inclusive**, so a date equal to an endpoint is within.
 * @example isWithinInterval('2026-08-10', { start: '2026-08-08', end: '2026-08-10' }) // true
 */
export function isWithinInterval(date: DayInput, interval: Interval): boolean
/**
 * Pull a day inside the interval, or return it unchanged if it is already inside.
 * @example clamp('2026-12-25', { start: '2026-08-08', end: '2026-08-10' }) // '2026-08-10'
 */
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

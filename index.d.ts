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
/** @example subDays('2026-08-08', 1) // '2026-08-07' */
export function subDays(date: DayInput, amount: number): string
/** @example addWeeks('2026-08-08', 2) // '2026-08-22' */
export function addWeeks(date: DayInput, amount: number): string
/** Whole weeks. @example subWeeks('2026-08-22', 2) // '2026-08-08' */
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
/**
 * Clamps, exactly as `addMonths` does.
 * @example subMonths('2026-03-31', 1) // '2026-02-28'  clamped
 */
export function subMonths(date: DayInput, amount: number): string
/**
 * Clamps, so 29 February lands on the 28th of a common year.
 * @example addYears('2024-02-29', 1) // '2025-02-28'  clamped
 */
export function addYears(date: DayInput, amount: number): string
/**
 * Clamps, exactly as `addYears` does.
 * @example subYears('2024-02-29', 1) // '2023-02-28'  clamped
 */
export function subYears(date: DayInput, amount: number): string
/**
 * Three months at a time, and it clamps.
 * @example addQuarters('2026-01-31', 1) // '2026-04-30'  clamped
 */
export function addQuarters(date: DayInput, amount: number): string
/** Three months back, and it clamps. @example subQuarters('2026-04-30', 1) // '2026-01-30' */
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
/** 1 on 1 January. @example getDayOfYear('2026-03-01') // 60 */
export function getDayOfYear(date: DayInput): number
/** @example getDaysInMonth('2024-02-10') // 29 */
export function getDaysInMonth(date: DayInput): number
/** Quarter 1…4. */
export function getQuarter(date: DayInput): number
/**
 * Leap year of the day's own ISO year.
 *
 * **This is the one way to get a wrong answer with no error**, and it is worth reading before
 * you pass a non-ISO calendar's year. A `[u-ca=…]` day is judged on its ISO year, which is the
 * date part — so a Buddhist year written as a bare ISO year is a different year. Buddhist 2567
 * is ISO 2024 and IS a leap year, but 2567 read as ISO is not, because 543 mod 4 is 3. The two
 * rules disagree in 49 of the 101 Buddhist years from 2500 to 2600, and nothing throws.
 * @example isLeapYear('2024-01-01') // true
 * @example isLeapYear('2567-01-01') // false  ISO 2567, NOT Buddhist 2567 (which is ISO 2024)
 */
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

/** @example startOfMonth('2026-08-08') // '2026-08-01' */
export function startOfMonth(date: DayInput): string
/**
 * @example endOfMonth('2024-02-01') // '2024-02-29'
 */
export function endOfMonth(date: DayInput): string
/** @example startOfYear('2026-08-08') // '2026-01-01' */
export function startOfYear(date: DayInput): string
/** @example endOfYear('2026-08-08') // '2026-12-31' */
export function endOfYear(date: DayInput): string
/** @example startOfQuarter('2026-08-08') // '2026-07-01' */
export function startOfQuarter(date: DayInput): string
/** @example endOfQuarter('2026-08-08') // '2026-09-30' */
export function endOfQuarter(date: DayInput): string
/**
 * `weekStartsOn` defaults to **7 (Sunday)**, and `0` is accepted for Sunday too.
 * @example startOfWeek('2026-08-12')                     // '2026-08-09'  Sunday
 * @example startOfWeek('2026-08-12', { weekStartsOn: 1 }) // '2026-08-10'  Monday
 */
export function startOfWeek(date: DayInput, options?: WeekOptions): string
/**
 * `weekStartsOn` defaults to 7 (Sunday), so the week ends on Saturday.
 * @example endOfWeek('2026-08-12')                     // '2026-08-15'  Saturday
 * @example endOfWeek('2026-08-12', { weekStartsOn: 1 }) // '2026-08-16'  Sunday
 */
export function endOfWeek(date: DayInput, options?: WeekOptions): string

/**
 * Full days: `dateLeft − dateRight` (date-fns argument order).
 * @example differenceInDays('2026-08-08', '2026-08-01') //  7
 * @example differenceInDays('2026-08-01', '2026-08-08') // -7  order matters
 */
export function differenceInDays(dateLeft: DayInput, dateRight: DayInput): number
/** Whole weeks. @example differenceInWeeks('2026-08-15', '2026-08-08') // 1 */
export function differenceInWeeks(dateLeft: DayInput, dateRight: DayInput): number
/**
 * A month counts as full when `addMonths` would carry the earlier date to the
 * later one, so `differenceInMonths(addMonths(d, n), d) === n` always holds. Use
 * `differenceInCalendarMonths` to count boundaries crossed instead.
 * @example differenceInMonths('2026-02-28', '2026-01-31')         // 1  addMonths clamps to here
 * @example differenceInCalendarMonths('2026-02-01', '2026-01-31') // 1  one boundary, one day apart
 */
export function differenceInMonths(dateLeft: DayInput, dateRight: DayInput): number
/**
 * Month boundaries crossed, not whole months. `differenceInMonths` is the other question.
 * @example differenceInCalendarMonths('2026-02-01', '2026-01-31') // 1  one day apart
 */
export function differenceInCalendarMonths(
  dateLeft: DayInput,
  dateRight: DayInput,
): number
/**
 * Counts by `addYears`, the same rule `differenceInMonths` uses, so the round-trip law holds.
 * @example differenceInYears('2026-02-28', '2024-02-29') // 2  addYears clamps to here
 */
export function differenceInYears(dateLeft: DayInput, dateRight: DayInput): number
/**
 * Boundaries crossed, not whole years.
 * @example differenceInCalendarYears('2026-01-01', '2025-12-31') // 1  one day apart
 */
export function differenceInCalendarYears(dateLeft: DayInput, dateRight: DayInput): number
/** Counts by `addQuarters`. @example differenceInQuarters('2026-07-01', '2026-01-01') // 2 */
export function differenceInQuarters(dateLeft: DayInput, dateRight: DayInput): number
/**
 * Quarter boundaries crossed, not whole quarters.
 * @example differenceInCalendarQuarters('2026-07-01', '2026-06-30') // 1  one day apart
 */
export function differenceInCalendarQuarters(
  dateLeft: DayInput,
  dateRight: DayInput,
): number

/**
 * Strictly before; an equal pair is `false`.
 * @example isBefore('2026-08-01', '2026-08-08') // true
 * @example isBefore('2026-08-08', '2026-08-08') // false  not strictly before
 */
export function isBefore(date: DayInput, dateToCompare: DayInput): boolean
/** Strictly after. @example isAfter('2026-08-01', '2026-08-08') // false */
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

/**
 * `weekStartsOn` defaults to 7 (Sunday), so a Saturday and the Sunday after it are DIFFERENT weeks.
 * @example isSameWeek('2026-08-08', '2026-08-09')                     // false  Sat then Sun
 * @example isSameWeek('2026-08-08', '2026-08-09', { weekStartsOn: 1 }) // true   Monday weeks
 */
export function isSameWeek(
  dateLeft: DayInput,
  dateRight: DayInput,
  options?: WeekOptions,
): boolean
/** Same month AND year. @example isSameMonth('2026-08-01', '2026-08-31') // true */
export function isSameMonth(dateLeft: DayInput, dateRight: DayInput): boolean
/** @example isSameYear('2026-01-01', '2026-12-31') // true */
export function isSameYear(dateLeft: DayInput, dateRight: DayInput): boolean
/** @example isSameQuarter('2026-07-01', '2026-09-30') // true */
export function isSameQuarter(dateLeft: DayInput, dateRight: DayInput): boolean

/**
 * Comparator for `Array.prototype.sort`, oldest first.
 * @example compareAsc('2026-01-01', '2026-08-08') // -1
 */
export function compareAsc(dateLeft: DayInput, dateRight: DayInput): -1 | 0 | 1
/** Newest first. @example compareDesc('2026-01-01', '2026-08-08') // 1 */
export function compareDesc(dateLeft: DayInput, dateRight: DayInput): -1 | 0 | 1

/**
 * Takes an **array**, not a rest argument.
 * @example min(['2026-08-08', '2026-01-01']) // '2026-01-01'
 */
export function min(dates: DayInput[]): string
/**
 * Takes an **array**, not a rest argument, exactly as `min` does.
 * @example max(['2026-01-01', '2026-08-08']) // '2026-08-08'
 */
export function max(dates: DayInput[]): string

/** ISO weekday 7. @example isSunday('2026-08-09') // true */
export function isSunday(date: DayInput): boolean
/** ISO weekday 1. @example isMonday('2026-08-10') // true */
export function isMonday(date: DayInput): boolean
/** ISO weekday 2. @example isTuesday('2026-08-11') // true */
export function isTuesday(date: DayInput): boolean
/** ISO weekday 3. @example isWednesday('2026-08-12') // true */
export function isWednesday(date: DayInput): boolean
/** ISO weekday 4. @example isThursday('2026-08-13') // true */
export function isThursday(date: DayInput): boolean
/** ISO weekday 5. @example isFriday('2026-08-14') // true */
export function isFriday(date: DayInput): boolean
/** ISO weekday 6. @example isSaturday('2026-08-08') // true */
export function isSaturday(date: DayInput): boolean
/**
 * ISO Saturday and Sunday (6 and 7). Not configurable, and no holiday calendar.
 * @example isWeekend('2026-08-08') // true   a Saturday
 * @example isWeekend('2026-08-10') // false  a Monday
 */
export function isWeekend(date: DayInput): boolean
/** @example isFirstDayOfMonth('2026-08-01') // true */
export function isFirstDayOfMonth(date: DayInput): boolean
/** @example isLastDayOfMonth('2024-02-29') // true  leap year */
export function isLastDayOfMonth(date: DayInput): boolean

/**
 * Both ends **inclusive**, so a one-day interval returns one day.
 * @example eachDayOfInterval({ start: '2026-08-08', end: '2026-08-10' })
 * // ['2026-08-08', '2026-08-09', '2026-08-10']
 */
export function eachDayOfInterval(interval: Interval): string[]
/**
 * The FIRST of each month touched, both ends inclusive.
 * @example eachMonthOfInterval({ start: '2026-01-15', end: '2026-03-02' })
 * // ['2026-01-01', '2026-02-01', '2026-03-01']
 */
export function eachMonthOfInterval(interval: Interval): string[]
/**
 * The FIRST of January of each year touched, both ends inclusive.
 * @example eachYearOfInterval({ start: '2025-06-01', end: '2026-02-01' })
 * // ['2025-01-01', '2026-01-01']
 */
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

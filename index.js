/** daymath — calendar date math (ISO 8601 day). date-fns-shaped. No Date. No time zones. */
// daymath reaches Temporal through `temporal-polyfill/fns`, the tree-shakable functional API, not
// through the `Temporal` class. A class is one unit to a bundler, because it cannot prove a method
// unreachable, so the class API shipped the whole polyfill for the ~20 operations used here.
// Measured on a three-call program by `npm run size`, shape A: 24,735 B gzip to 16,295 B, −34%.
// Nothing a caller can observe changes.
//
// **`getAny` is required, and `getISO` would be a defect.** `fromString` takes the calendar
// resolver as a REQUIRED second argument, and it is the set of calendars the bundle admits. With
// `getISO` the same program answers two ways: the native funcApi keeps `[u-ca=buddhist]` and reads
// 2569, the shim funcApi drops the annotation and reads 2026. Node 20 and bun are the shim lanes in
// CI. `getAny` carries the calendar data itself and answers identically on every path, measured
// with no global, with a BASE polyfill global, with a FULL one, and on native. That costs 4.2 kB
// and it is what keeps the calendar rule below a MEASUREMENT rather than a build-time list.
//
// It also retires the selection block this file used to carry. daymath no longer reads
// `globalThis.Temporal` at all, so the 0.5.0 defect class — a base polyfill global silently costing
// three of four calendars, decided by import order — cannot recur here. `fns` picks its own funcApi
// and `getAny` makes that choice unobservable.
//
// `Duration` is deliberately not imported. `add(record, durationRecord)` needs one, but every
// daymath call moves a single unit, so `addDays` / `addMonths` / `addYears` serve instead and that
// whole subpath stays out of the bundle.
import * as PlainDateFns from 'temporal-polyfill/fns/PlainDate'
import { getAny } from 'temporal-polyfill/fns/Calendar'
import * as InstantFns from 'temporal-polyfill/fns/Instant'
import * as ZonedFns from 'temporal-polyfill/fns/ZonedDateTime'
import * as NowFns from 'temporal-polyfill/fns/Now'

/** The ISO calendar record, resolved once. `isoOf` runs on every two-date export. */
const ISO_CALENDAR = getAny('iso8601')

/**
 * Every calendar this runtime names. Read once, lowercased, because BCP-47 keys are
 * case-insensitive while a `Map` key is not.
 *
 * This set is also what bounds the verdict cache below. It is closed and small — 18 ids on Node 26
 * — so an id the runtime does not name is refused without ever being stored.
 *
 * `Intl.supportedValuesOf` is ES2022 and present on every runtime in `engines`.
 */
const RUNTIME_CALENDARS = new Set(
  Intl.supportedValuesOf('calendar').map((id) => id.toLowerCase()),
)

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
const ISO_DAY = /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}$/u

/**
 * Temporal's calendar annotation, `[u-ca=…]` or the critical `[!u-ca=…]`.
 * Returns what it is attached to, and the calendar it names, or `null`.
 *
 * String operations, not a regex, and the reason is measured. The annotation can
 * sit behind another one — `'…[America/New_York][u-ca=buddhist]'` — so the head
 * may itself contain `[`. A pattern that allows that needs `^(.*)\[…\]$`, whose
 * `.*` backtracks: `'[u-ca='.repeat(64000)` cost 9.0 s, growing with the square
 * of the input. `lastIndexOf` answers the same question in one pass. CodeQL
 * `js/polynomial-redos` caught the regex form; timing it confirmed the report.
 * @param {string} text
 * @returns {{ head: string, calendar: string } | null}
 */
function calendarAnnotation(text) {
  if (!text.endsWith(']')) return null
  const open = text.lastIndexOf('[')
  if (open === -1) return null
  const inner = text.slice(open + 1, -1)
  const body = inner.startsWith('!') ? inner.slice(1) : inner
  if (!body.startsWith('u-ca=')) return null
  const calendar = body.slice(5)
  // A `]` inside means the brackets do not nest as they appear, so this is not
  // an annotation. `'[u-ca=[u-ca=[u-ca=x]]]'` reads as the calendar `x]]` here
  // and as a malformed day everywhere else, which is what it is.
  if (calendar === '' || calendar.includes(']')) return null
  return { head: text.slice(0, open), calendar }
}

/**
 * True when the string carries a time-zone annotation, `[Zone]` or `[!Zone]`.
 * It is the one annotation with no `=`, which separates it from `[u-ca=…]`, and
 * Temporal writes it first, so only the leading bracket can be one.
 *
 * Asking "does the string name a zone?" is a different question from "does it
 * resolve?". A string can name one and still fail: an offset that disagrees with
 * the zone, or a misspelled name. Both must be errors, never a silent fallback
 * to the UTC default.
 *
 * String operations again. An unanchored `/\[!?[^\]=]+\]/` restarts at every
 * position: `'[!'.repeat(64000)` cost 6.8 s, and it is the same defect an
 * earlier commit removed from the calendar pattern.
 * @param {string} text
 */
function hasZoneAnnotation(text) {
  const open = text.indexOf('[')
  if (open === -1) return false
  const close = text.indexOf(']', open)
  if (close === -1) return false
  return !text.slice(open + 1, close).includes('=')
}

/**
 * A time zone, by shape: an IANA name, or a bare offset.
 *
 * A name is letter-led, slash-separated segments of letters, digits, `_`, `+`,
 * `-` and `.`. It carries no `:`, which is what keeps an ISO time out. The
 * `(?![Tt]\d)` guard rejects the compact spelling `T120000Z`, which has no `:`
 * to catch it. Both matter: `T12:00:00Z` is a zone to native Temporal and not
 * to temporal-polyfill, so letting either through splits the answer by runtime.
 *
 * Verified against every zone this runtime knows: 0 of 418 rejected, plus the
 * aliases `UTC`, `GMT`, `US/Eastern`, `Asia/Calcutta` and `Etc/GMT+5`.
 */
const ZONE_LIKE =
  /^(?:(?![Tt]\d)[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)*|[+-]\d{2}(?::?\d{2})?)$/u

// Two different things wear the name PlainDate here, and keeping them apart is the whole type
// story of this file. `PlainDateRecord` is daymath's INTERNAL value, and the name is the polyfill's
// own for it. `PlainDate` is the public INPUT type, a real `Temporal.PlainDate` object from any
// implementation, which callers still pass and `isPlainDate` still recognises by brand. daymath
// never returns one.
/** @typedef {import('temporal-polyfill/fns/PlainDate').Record} PlainDateRecord */
/** @typedef {import('temporal-polyfill').Temporal.PlainDate} PlainDate */
/** @typedef {string | PlainDate} DayInput */
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
 * The bare ISO day inside a string, or `null` if there is not one.
 *
 * An annotation is dropped here, never judged. `supportedCalendar` owns that rule, and the two do
 * not run in a fixed order: `toPlainDate` judges first, and `day()` calls this first. That is safe
 * precisely because this function strips the annotation without reading it.
 *
 * One predicate, because `toPlainDate` and `day()` both ask this question. They
 * asked it separately once, and day() alone then refused a string that every
 * other export accepted.
 * @param {string} text
 * @returns {string | null}
 */
function bareDay(text) {
  const annotated = calendarAnnotation(text)
  const bare = annotated ? annotated.head : text
  return ISO_DAY.test(bare) ? bare : null
}

/**
 * Nine probe dates for the calendar rule below.
 *
 * They span 1900 to 2100, they sit in different months, and two pairs straddle a Japanese era
 * boundary: 1989-01-07/08 is Showa 64 into Heisei 1, and 2019-04-30/05-01 is Heisei 31 into
 * Reiwa 1. An era change *inside* one ISO year is the case a single probe cannot see, and it is
 * exactly what separates a year label from a year renumbering.
 */
const CALENDAR_PROBES = [
  '1900-01-01',
  '1900-07-01',
  '1989-01-07',
  '1989-01-08',
  '2019-04-30',
  '2019-05-01',
  '2026-01-31',
  '2026-12-31',
  '2100-06-15',
]

/** @type {Map<string, {offset: number} | {reason: 'unknown' | 'renumbers'}>} */
const calendarRuleCache = new Map()

/**
 * Is this a calendar the runtime actually names?
 *
 * **This is what bounds `calendarRuleCache`, and it is a memory-exhaustion fix.** The cache keys on
 * whatever sits between `[u-ca=` and `]`, which is caller input.
 *
 * A shape guard was tried first and was only half a fix. It bounded the key LENGTH and not the
 * entry COUNT, so any BCP-47-shaped string still bought a permanent entry: 800,000 distinct
 * guard-passing ids retained 76.8 MB, growing linearly and never released. Case made it worse,
 * because the shape test ignored case while the `Map` key did not, so one name had 256 keys.
 *
 * A closed set fixes both at once. `RUNTIME_CALENDARS` holds 18 ids on Node 26, so entries can
 * never exceed what the runtime has, and a lowercased key collapses the case variants. It also
 * needs no length cap and no pattern, which removes the last quadratic-regex risk from this file.
 *
 * The quiet path was `isValid`, which swallows the `RangeError`, so a loop raised nothing and
 * logged nothing.
 * @param {string} lowerId
 */
function runtimeKnowsCalendar(lowerId) {
  return RUNTIME_CALENDARS.has(lowerId)
}

/**
 * Measure whether a calendar only relabels the year.
 *
 * **This is a method, not a list.** Nothing here names a calendar, so a calendar CLDR adds later
 * is admitted or refused by the same measurement, with no code change. Today it admits
 * `buddhist` (+543), `roc` (−1911), `japanese` (0) and `gregory` (0), and refuses the other
 * eleven the runtime knows.
 *
 * Two conditions, both required on every probe:
 *
 * 1. **Month and day equal the ISO fields.** A month-count test would be wrong: `hebrew` is
 *    lunisolar, so `monthsInYear` is 13 in 2024, 12 in 2025 and 13 in 2027. Comparing the fields
 *    is correct in every year.
 * 2. **The year offset is constant.** `japanese` and `roc` pass condition 1, and Temporal reports
 *    a continuous year for both, so both are pure labels — `roc` 1900 is −11, not "12 before".
 *    Reading the year from `Intl` instead would fail here, because `Intl` reports the *era* year:
 *    Reiwa 8 and B.R.O.C. 12. Temporal is the reference, so Temporal is what this asks.
 *
 * The verdict is cached per calendar. It cannot change while the process runs.
 * @param {string} calendar
 */
function calendarRule(calendar) {
  const cached = calendarRuleCache.get(calendar)
  if (cached !== undefined) return cached
  /** @type {{offset: number} | {reason: 'unknown' | 'renumbers'}} */
  let verdict = { reason: 'renumbers' }
  try {
    const offsets = new Set()
    // `getAny(calendar)` throws for an id the polyfill cannot build, which is the `unknown` case
    // below. It is resolved once rather than per probe.
    const calendarRecord = getAny(calendar)
    for (const probe of CALENDAR_PROBES) {
      const iso = PlainDateFns.fromString(probe, getAny)
      const dated = PlainDateFns.withCalendar(iso, calendarRecord)
      if (dated.month !== iso.month || dated.day !== iso.day) {
        offsets.clear()
        break
      }
      offsets.add(dated.year - iso.year)
    }
    // The offset is the discriminant — `'offset' in verdict` is what accepts — and the number
    // itself is kept unread on purpose, so a debugger shows WHY a calendar passed.
    if (offsets.size === 1) verdict = { offset: [...offsets][0] }
  } catch {
    // The runtime cannot build this calendar at all, which is a different message for the caller.
    verdict = { reason: 'unknown' }
  }
  calendarRuleCache.set(calendar, verdict)
  return verdict
}

/**
 * Accept a calendar that only relabels the year, and refuse one that renumbers.
 *
 * Checked on the *string*, before any parse, so the outcome cannot depend on where the annotation
 * sits. Returns the calendar for `toPlainDate` to carry, or `undefined` for plain ISO.
 *
 * `[u-ca=iso8601]` returns `undefined` rather than carrying: Temporal writes it itself for
 * `toString({ calendarName: 'always' })`, and daymath already answers in it, so there is nothing
 * to relabel.
 * @param {string} text
 * @param {string} label
 * @returns {string | undefined}
 */
function supportedCalendar(text, label) {
  const annotated = calendarAnnotation(text)
  // A bare `return` rather than `return undefined`: oxlint's no-useless-undefined forbids the
  // explicit spelling, and "nothing to carry" is what both of these mean.
  if (annotated === null) return
  const { calendar } = annotated
  // Lowercased once. BCP-47 keys are case-insensitive, and this is also the cache key, so the case
  // variants of one name must collapse to one entry rather than 256.
  const lowerId = calendar.toLowerCase()
  if (lowerId === 'iso8601') return
  // Membership FIRST, so an id the runtime does not name is never stored. See runtimeKnowsCalendar.
  // One throw, not two: an unknown id and a renumbering one differ only in the reason.
  const verdict = runtimeKnowsCalendar(lowerId)
    ? calendarRule(lowerId)
    : /** @type {const} */ ({ reason: 'unknown' })
  if ('offset' in verdict) return calendar
  const why =
    verdict.reason === 'unknown'
      ? 'is not a calendar this runtime knows'
      : 'renumbers months or days, so daymath cannot answer a day in it'
  // The id is sliced because it is caller input, so a megabyte in cannot become a megabyte of error.
  throw new RangeError(
    `daymath: ${label} calendar ${JSON.stringify(calendar.slice(0, 40))} ${why} (convert with withCalendar('iso8601'))`,
  )
}

/**
 * True for a `Temporal.PlainDate` from *any* implementation: native, the
 * bundled polyfill, or a second copy of it in the same dependency tree.
 * `instanceof` recognises only one of those. Every Temporal puts this tag on
 * `PlainDate.prototype` as a non-writable property, so it is the portable brand.
 * @param {unknown} value
 * @returns {value is PlainDate} a predicate, so callers narrow
 */
function isPlainDate(value) {
  return Object.prototype.toString.call(value) === '[object Temporal.PlainDate]'
}

/**
 * Reject Date and non-calendar values. Accept ISO day string or PlainDate.
 *
 * A PlainDate becomes its ISO day string first, so every input reaches one
 * validation path and daymath owns the resulting instance.
 *
 * A calendar annotation is judged by `supportedCalendar` and then CARRIED, so `getYear` answers
 * the caller's own number: `2026-01-31[u-ca=buddhist]` reads 2569, not 2026. The rule and the
 * reasons live on `supportedCalendar`; this function only applies the verdict.
 * @param {unknown} value
 * @param {string} label
 * @returns {PlainDateRecord}
 */
function toPlainDate(value, label = 'date') {
  if (value instanceof Date) {
    throw new TypeError(
      `daymath: Date is not allowed for ${label} (pass ISO 8601 day string)`,
    )
  }
  // Named `text`, not `day`: a local `day` would shadow the exported day().
  const text = isPlainDate(value) ? value.toString() : value
  if (typeof text !== 'string') {
    throw new TypeError(
      `daymath: ${label} must be ISO 8601 day string or Temporal.PlainDate`,
    )
  }
  // Before the shape check: an annotated day is well formed, not malformed.
  const calendar = supportedCalendar(text, label)
  const bare = bareDay(text)
  if (bare === null) {
    throw new RangeError(
      `daymath: ${label} must be ISO 8601 day YYYY-MM-DD or ±YYYYYY-MM-DD (got ${JSON.stringify(text)})`,
    )
  }
  try {
    // The bare day is parsed with the ISO resolver's own entry point. `getAny` is passed as the
    // resolver rather than called, because `fromString` calls it with whatever the string names,
    // and a bare day names nothing.
    const plain = PlainDateFns.fromString(bare, getAny)
    // The annotation rides along, so getYear answers 2569 for a Buddhist day and every
    // returned string keeps the calendar the caller named.
    return calendar === undefined
      ? plain
      : PlainDateFns.withCalendar(plain, getAny(calendar))
  } catch (err) {
    throw new RangeError(`daymath: invalid ${label} ${JSON.stringify(text)}`, {
      cause: err,
    })
  }
}

/**
 * The same day in ISO, for measurement only.
 *
 * Temporal refuses `since` and `until` across two calendars with `Mismatched calendars`, and its
 * `equals` compares the calendar as well as the day. Neither matters to a day count: a day is the
 * same day whatever the year is labelled, so daymath normalises and answers. Only the exports that
 * *read* or *write* a field honour the label.
 * @param {PlainDateRecord} plain
 * @returns {PlainDateRecord}
 */
function isoOf(plain) {
  return plain.calendarId === 'iso8601'
    ? plain
    : PlainDateFns.withCalendar(plain, ISO_CALENDAR)
}

/** @param {PlainDateRecord} plain @returns {string} */
function toDayString(plain) {
  return PlainDateFns.toString(plain)
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
 * Covers both a result past the range and an argument Temporal refuses
 * outright, hence the neutral wording.
 *
 * The message carries no Temporal text. Implementations word the same failure
 * differently — the polyfill says `Out-of-bounds date` where native V8 says
 * `Temporal error: epoch days exceed maximum range.` — so quoting it made
 * daymath's own message vary by runtime. `cause` still holds the original
 * error, which is where the detail belongs.
 * @template T
 * @param {string} label
 * @param {() => T} op
 * @returns {T}
 */
function guardRange(label, op) {
  try {
    return op()
  } catch (err) {
    throw new RangeError(`daymath: ${label} could not produce a valid date`, {
      cause: err,
    })
  }
}

/**
 * Shared body for every add/sub function. Each caller passes its own name, so
 * the message never reports a function the caller did not call.
 *
 * The unit is a parameter rather than a duration object on purpose. `PlainDateFns.add` would need a
 * `DurationRecord`, which means importing `fns/Duration`, and every daymath caller moves exactly
 * one unit. `addDays` / `addMonths` / `addYears` take a plain number and keep that subpath out of
 * the bundle. Subtraction is a negative amount, exactly as it was when this passed `-amount`.
 *
 * `addMonths` and `addYears` clamp by default, which is daymath's one overflow rule and the same
 * behaviour the class API gave: 31 January plus one month is 28 February.
 * @param {DayInput} date
 * @param {'days'|'months'|'years'} unit
 * @param {number} amount
 * @param {string} label
 * @returns {string}
 */
function addDuration(date, unit, amount, label) {
  const d = toPlainDate(date)
  const move =
    unit === 'days'
      ? PlainDateFns.addDays
      : unit === 'months'
        ? PlainDateFns.addMonths
        : PlainDateFns.addYears
  return guardRange(label, () => toDayString(move(d, amount)))
}

/** @param {unknown} dates */
function assertNonEmptyDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new RangeError('daymath: expected a non-empty array of dates')
  }
}

/**
 * @param {WeekOptions} [options]
 * @returns {0|1|2|3|4|5|6|7} 7 is the default, so 0-6 was never the real range
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
 * @returns {{ start: PlainDateRecord, end: PlainDateRecord }}
 */
function toInterval(interval) {
  // `typeof x === 'object'` alone let a Date, an array or a PlainDate through,
  // and the failure then surfaced as "start must be ISO 8601 day string" —
  // naming a property the caller never meant to pass.
  if (
    interval === null || // typeof null is 'object', so it needs its own test
    typeof interval !== 'object' || // and this already catches undefined
    !('start' in interval) ||
    !('end' in interval)
  ) {
    throw new TypeError('daymath: interval must be { start, end }')
  }
  const start = toPlainDate(/** @type {Interval} */ (interval).start, 'start')
  const end = toPlainDate(/** @type {Interval} */ (interval).end, 'end')
  return { start, end }
}

// ─── the clock ─────────────────────────────────────────────────────

/**
 * The calendar day of a moment, in a zone. The way in.
 *
 * Both arguments have a **stated** default: the moment is now, and the zone is
 * UTC. A default that is written down is not a guess; a default that is assumed
 * is. UTC is still not your day for part of every day — it runs ahead of
 * America/New_York for 16.7% of the day, and behind Asia/Tokyo for 37.5% — so
 * name your zone when that matters.
 *
 * `moment` accepts what the world actually hands you:
 * - a `Date`, the only carrier of an instant JavaScript has
 * - a number, read as **epoch milliseconds**, exactly as `new Date(n)` reads it,
 *   truncated the same way, so a fractional value is not an error
 * - an ISO 8601 day string, or a `Temporal.PlainDate` from any implementation,
 *   both of which are already a day
 * - an ISO 8601 timestamp carrying `Z` or an offset, which names an exact
 *   instant, so there is nothing left to guess
 * - a string carrying a `[Zone]` annotation, which names its own zone, so it
 *   answers its own civil day and the `tz` default never applies
 *
 * **day() is the normaliser, and that is the one rule to hold: a moment
 * converts to a plain ISO day, and so does a day.** A `[u-ca=…]` annotation is
 * accepted wherever the other 68 exports accept it, and then dropped from the
 * result. Those exports carry it, because the caller asked for that numbering;
 * day() exists to hand back the canonical form. It cannot do both, because an
 * `Instant` has no fields for a calendar to renumber, so an annotation on
 * `'…T20:00:00Z[u-ca=buddhist]'` is inert and that path has nothing to carry.
 * Carrying only on the `[Zone]` path would make the same annotation behave two
 * ways in one function.
 *
 * `'11/12/2026'` is refused. Nobody can tell November from December in it.
 * `'2026-08-08T12:00'` is refused too: no offset and no zone, so daymath would
 * have to pick one, and it will not pick on the caller's behalf. Name the zone
 * — `'2026-08-08T12:00[America/New_York]'` — and it is accepted.
 *
 * A lone string takes one of four roles, decided in this order: a day, then a
 * zoned time, then an instant, then a zone. The zone test is by **shape**, and
 * the shape is on `ZONE_LIKE`. Temporal's own zone grammar cannot decide the role, because it
 * accepts a whole timestamp and reads the zone out of it, so
 * `day('1999-01-01T00:00:00Z')` would answer today. The grammar also differs
 * between implementations: `'2026-08-08T25:00:00Z'` and `'T12:00:00Z'` are both
 * zones to native Temporal and neither is one to `temporal-polyfill`. Shape
 * settles the role and the runtime split together.
 *
 * With `day()` this is the only export that reads a clock, so the only one
 * whose answer depends on when you call it. Give it a moment and it becomes a
 * pure function, which is how the cross-runtime battery covers it.
 *
 * @param {Date | number | DayInput | null} [moment] instant, epoch ms, day, or a zone
 * @param {string} [tz] IANA time zone id, e.g. `'utc'`, `'Asia/Tokyo'`
 * @returns {string} a plain ISO day. `YYYY-MM-DD`, or expanded `±YYYYYY-MM-DD` outside years
 *   0000-9999 — the annotation said `YYYY-MM-DD` alone, which was already wrong for
 *   `day('+010000-01-01')`. **Never carries `[u-ca=…]`.** day() is the normaliser, so a calendar
 *   annotation is accepted on input and dropped from the result. Every other export carries it.
 * @throws {TypeError} If `moment` is not one of the accepted shapes
 * @throws {RangeError} On an Invalid Date, a non-finite number, or an unknown zone
 * @example day()                              // '2026-08-08'  now, UTC
 * @example day('Asia/Tokyo')                  // '2026-08-09'  today in Tokyo
 * @example day(row.createdAt)                 // '2026-08-07'  a Date, UTC
 * @example day(row.createdAt, 'America/New_York') // '2026-08-06'
 * @example day(1761616161771)                 // '2025-10-28'  epoch ms
 * @example day('1999-01-01T00:00:00Z')        // '1999-01-01'  an ISO timestamp
 * @example day(zdt.toString())                // the zone in the string wins
 * @example addDays(day(), 2)                  // '2026-08-10'
 */
export function day(moment, tz) {
  // Already a day, in every accepted spelling. `bareDay` is the same predicate
  // toPlainDate uses, so day() cannot drift from the other 68 exports.
  const isDay =
    isPlainDate(moment) || (typeof moment === 'string' && bareDay(moment) !== null)
  const isMoment = isDay || moment instanceof Date || typeof moment === 'number'

  let zone = tz
  /** @type {import('temporal-polyfill/fns/Instant').Record | undefined} */
  let instant
  /** @type {import('temporal-polyfill/fns/ZonedDateTime').Record | undefined} */
  let zoned
  if (!isMoment && moment !== undefined && moment !== null) {
    if (typeof moment !== 'string') {
      throw new TypeError(
        'daymath: day() takes a Date, epoch milliseconds, or an ISO 8601 day',
      )
    }
    // A `[Zone]` annotation makes the string a ZonedDateTime, and Temporal will
    // not build one without it: a bare offset is refused. So the bracket is the
    // caller naming a zone, and the string carries its own civil day. Reading
    // the instant instead and applying UTC would move a browser's date by one.
    //
    // Naming a zone and resolving as one are different questions, so the
    // annotation is detected first. A string can name a zone and still fail:
    // `'…-05:00[America/New_York]'` has an offset the zone contradicts, and
    // `'…[Asia/Tokoy]'` is a typo. Falling back to the instant would answer a
    // UTC day for both, silently, which is the defect this branch exists to fix.
    if (hasZoneAnnotation(moment)) {
      // A calendar is judged only where it is applied. With a zone bracket it is: the fields get
      // renumbered, and `toPlainDate()` carries the annotation into daymath's own output. Judged
      // on the string, before the parse, so the message cannot depend on the runtime. A calendar
      // that only relabels the year passes here, exactly as it does through toPlainDate.
      supportedCalendar(moment, 'date')
      if (tz !== undefined && tz !== null) {
        throw new TypeError(
          `daymath: day() got two time zones, ${JSON.stringify(moment)} and ${JSON.stringify(tz)}`,
        )
      }
      try {
        // `getAny` again, for the same reason it is used everywhere else: a zoned string can carry
        // a calendar annotation, and the shim funcApi would drop it under `getISO`.
        zoned = ZonedFns.fromString(moment, getAny)
      } catch (err) {
        throw new RangeError(
          `daymath: day() could not read ${JSON.stringify(moment)} in the time zone it names`,
          { cause: err },
        )
      }
    } else {
      try {
        // A timestamp carrying `Z` or an offset names an exact instant, so it
        // reads as a moment. Temporal's own grammar is the definition of that.
        //
        // A calendar annotation here is inert and is ignored. An Instant has no
        // year, month or day for a calendar to renumber, and without a zone
        // bracket Temporal will not build anything that does. Refusing it would
        // reject a right answer for a reason that cannot apply.
        instant = InstantFns.fromString(moment)
      } catch {
        // Not a moment, so the string must be a zone — decided by shape, before
        // Temporal sees it. Temporal's zone grammar also accepts a whole
        // timestamp and pulls the zone out of it, so letting it decide the role
        // would read a date as a zone and silently answer today.
        if (!ZONE_LIKE.test(moment)) {
          throw new RangeError(
            `daymath: day() got ${JSON.stringify(moment)}, which is neither a moment nor a time zone`,
          )
        }
        if (tz !== undefined && tz !== null) {
          throw new TypeError(
            `daymath: day() got two time zones, ${JSON.stringify(moment)} and ${JSON.stringify(tz)}`,
          )
        }
        zone = moment
      }
    }
  }
  zone ??= 'utc'

  if (moment instanceof Date && Number.isNaN(moment.getTime())) {
    throw new RangeError('daymath: day() got an Invalid Date')
  }
  if (typeof moment === 'number' && !Number.isFinite(moment)) {
    throw new RangeError(`daymath: day() got a non-finite time value ${moment}`)
  }

  // Shape first, because implementations disagree past this point. The reasons
  // are on ZONE_LIKE. The typeof test comes first because `.test()` coerces,
  // and a caller-supplied toString could throw an error that is not ours.
  if (typeof zone !== 'string' || !ZONE_LIKE.test(zone)) {
    throw new RangeError(
      `daymath: day() got an unknown time zone ${JSON.stringify(zone)}`,
    )
  }

  // Checked before anything returns, so a mistyped zone fails the same way
  // whatever the moment is. A caller mapping rows that are sometimes a Date and
  // sometimes a day string would otherwise see the typo only on some rows.
  //
  // `ZonedDateTime.fromFields` accepts exactly the zone ids `Now` accepts and reads
  // no clock, so a day input stays a pure function.
  try {
    ZonedFns.fromFields({ timeZone: zone, year: 1970, month: 1, day: 1 })
  } catch (err) {
    throw new RangeError(
      `daymath: day() got an unknown time zone ${JSON.stringify(zone)}`,
      { cause: err },
    )
  }

  // A day carries no time, so a zone has nothing to shift. Applying one would
  // invent a moment the caller never gave.
  //
  // `isoOf` is what makes day() the normaliser. Every other export carries a
  // `[u-ca=…]` annotation through, because the caller asked for that numbering.
  // day() is the door: something that is not a plain ISO day goes in, and a
  // plain ISO day comes out. Carrying it here also could not be made
  // consistent, because an `Instant` has no fields for a calendar to renumber,
  // so that path has nothing to carry and would answer bare ISO regardless.
  if (isDay) return toDayString(isoOf(toPlainDate(moment)))

  // The string named its own zone, so that zone decides the day, not the
  // default. This is the one path where `zone` is deliberately not consulted.
  //
  // The result still goes through `toPlainDate`, so the calendar is adjudicated
  // in one place, and then through `isoOf` for the reason above.
  if (zoned !== undefined) {
    // `toPlainDate` is re-entered with the STRING, not the record, because daymath's own funnel
    // takes a day string or a `Temporal.PlainDate`, and an fns record is neither. `PlainDateFns.toString`
    // writes the same day the class API's `toPlainDate()` produced, annotation and all.
    const plain = guardRange('day', () =>
      PlainDateFns.toString(ZonedFns.toPlainDate(zoned)),
    )
    return toDayString(isoOf(toPlainDate(plain)))
  }

  if (instant !== undefined) {
    return guardRange('day', () =>
      PlainDateFns.toString(
        ZonedFns.toPlainDate(InstantFns.toZonedDateTimeISO(instant, zone)),
      ),
    )
  }

  if (!isMoment) return PlainDateFns.toString(NowFns.plainDateISO(zone))

  // Truncate, because `new Date(n)` truncates, and the contract here is that a
  // number reads exactly as it does. Verified equal on positive and negative
  // fractions. Sub-millisecond precision cannot change a calendar day anyway.
  // Every other shape returned above, so only a number or a Date reaches here.
  // The cast says what the control flow already guarantees but tsc cannot see.
  const epochMs =
    typeof moment === 'number'
      ? Math.trunc(moment)
      : /** @type {Date} */ (moment).getTime()
  return guardRange('day', () =>
    PlainDateFns.toString(
      ZonedFns.toPlainDate(
        InstantFns.toZonedDateTimeISO(InstantFns.fromEpochMilliseconds(epochMs), zone),
      ),
    ),
  )
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
  return addDuration(date, 'days', amount, 'addDays')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subDays(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, 'days', -amount, 'subDays')
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
  return addDuration(date, 'days', days, 'addWeeks')
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
  return addDuration(date, 'days', days, 'subWeeks')
}

/**
 * Calendar months (overflow constrain — Jan 31 + 1 month → Feb 28/29).
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addMonths(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, 'months', amount, 'addMonths')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subMonths(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, 'months', -amount, 'subMonths')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function addYears(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, 'years', amount, 'addYears')
}

/**
 * @param {DayInput} date
 * @param {number} amount
 * @returns {string}
 */
export function subYears(date, amount) {
  assertFiniteNumber(amount, 'amount')
  return addDuration(date, 'years', -amount, 'subYears')
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
  return addDuration(date, 'months', months, 'addQuarters')
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
  return addDuration(date, 'months', months, 'subQuarters')
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
  return PlainDateFns.dayOfWeek(toPlainDate(date))
}

/** @param {DayInput} date @returns {number} */
export function getDayOfYear(date) {
  return PlainDateFns.dayOfYear(toPlainDate(date))
}

/** @param {DayInput} date @returns {number} */
export function getDaysInMonth(date) {
  return PlainDateFns.daysInMonth(toPlainDate(date))
}

/**
 * Quarter of a record daymath already owns.
 *
 * The class API needed no such helper, because a `Temporal.PlainDate` passed back into
 * `toPlainDate` was recognised by `isPlainDate` and survived the round trip. An fns record is not
 * a `Temporal.PlainDate` and is correctly refused, so every internal caller now works on the
 * record. That was always the honest shape: re-validating a value daymath just built is waste.
 * @param {PlainDateRecord} plain
 * @returns {number}
 */
function quarterOf(plain) {
  return Math.ceil(plain.month / 3)
}

/**
 * Calendar month index between two records already normalised to ISO.
 * @param {PlainDateRecord} left
 * @param {PlainDateRecord} right
 * @returns {number}
 */
function calendarMonthsBetween(left, right) {
  return (left.year - right.year) * 12 + (left.month - right.month)
}

/** Quarter 1…4. @param {DayInput} date @returns {number} */
export function getQuarter(date) {
  return quarterOf(toPlainDate(date))
}

/** @param {DayInput} date @returns {boolean} */
export function isLeapYear(date) {
  return PlainDateFns.inLeapYear(toPlainDate(date))
}

/**
 * @param {DayInput} date
 * @param {number} year
 * @returns {string}
 */
export function setYear(date, year) {
  assertFiniteNumber(year, 'year')
  const d = toPlainDate(date)
  return guardRange('setYear', () => toDayString(PlainDateFns.withFields(d, { year })))
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
  return guardRange('setMonth', () => toDayString(PlainDateFns.withFields(d, { month })))
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
  return guardRange('setDate', () =>
    toDayString(PlainDateFns.withFields(d, { day: dayOfMonth })),
  )
}

// ─── start / end of unit ───────────────────────────────────────────

// The first/last day of a unit can fall outside the PlainDate range even when
// the input is inside it — startOfMonth('-271821-04-19') wants April 1st, which
// is below the minimum. Throwing is right; guardRange keeps the message ours.

/** @param {DayInput} date @returns {string} */
export function startOfMonth(date) {
  const d = toPlainDate(date)
  return guardRange('startOfMonth', () =>
    toDayString(PlainDateFns.withFields(d, { day: 1 })),
  )
}

/** @param {DayInput} date @returns {string} */
export function endOfMonth(date) {
  const d = toPlainDate(date)
  return guardRange('endOfMonth', () =>
    toDayString(PlainDateFns.withFields(d, { day: PlainDateFns.daysInMonth(d) })),
  )
}

/** @param {DayInput} date @returns {string} */
export function startOfYear(date) {
  const d = toPlainDate(date)
  return guardRange('startOfYear', () =>
    toDayString(PlainDateFns.withFields(d, { month: 1, day: 1 })),
  )
}

/** @param {DayInput} date @returns {string} */
export function endOfYear(date) {
  const d = toPlainDate(date)
  return guardRange('endOfYear', () =>
    toDayString(PlainDateFns.withFields(d, { month: 12, day: 31 })),
  )
}

/** @param {DayInput} date @returns {string} */
export function startOfQuarter(date) {
  const d = toPlainDate(date)
  const month = (quarterOf(d) - 1) * 3 + 1
  return guardRange('startOfQuarter', () =>
    toDayString(PlainDateFns.withFields(d, { month, day: 1 })),
  )
}

/** @param {DayInput} date @returns {string} */
export function endOfQuarter(date) {
  const d = toPlainDate(date)
  const month = quarterOf(d) * 3
  return guardRange('endOfQuarter', () => {
    const mid = PlainDateFns.withFields(d, { month, day: 1 })
    return toDayString(
      PlainDateFns.withFields(mid, { day: PlainDateFns.daysInMonth(mid) }),
    )
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
  return guardRange('startOfWeek', () => toDayString(PlainDateFns.subtractDays(d, diff)))
}

/**
 * How far the day sits past the start of its week.
 * @param {PlainDateRecord} d
 * @param {WeekOptions} [options]
 * @returns {number}
 */
function daysIntoWeek(d, options) {
  const weekStartsOn = weekStartsOnFrom(options)
  // mod 7 makes weekStartsOn 0 and 7 identical, so both spellings of Sunday work
  return (PlainDateFns.dayOfWeek(d) - weekStartsOn + 7) % 7
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
    toDayString(PlainDateFns.addDays(PlainDateFns.subtractDays(d, diff), 6)),
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
  // `diff` IS Temporal: it is the `fns` spelling of `PlainDate.prototype.until`, which is what
  // `since` was here with the operands the other way round. The choice below is between two
  // Temporal functions, not between Temporal and anything else.
  //
  // `diff`, NOT `diffDays`, and the reason is the one day where the two Temporal ranges disagree.
  //
  // `PlainDate`'s minimum is `-271821-04-19`, one day BELOW `PlainDateTime`'s, because midnight on
  // that day is out of bounds while the same day is reachable in a positive-offset zone. The
  // maximum is not widened, so the asymmetry is real and only the low edge has it. Measured:
  // `PlainDate.from('-271821-04-19').toPlainDateTime()` throws `Out-of-bounds date`, and
  // `-271821-04-20` does not.
  //
  // `diffDays` converts to a `PlainDateTime` and inherits that, so it throws on exactly one
  // operand. `diff` with `largestUnit: 'day'` does not, and answers what the class API's `since`
  // answered. The cross-runtime baseline caught it, because no test in the suite covers a pair
  // that wide; `differenceInDays` and `differenceInWeeks` both went red.
  //
  // The argument order is `(record, other)` for `other − record`, so the operands are swapped to
  // keep daymath's date-fns order of `dateLeft − dateRight`.
  return PlainDateFns.diff(isoOf(right), isoOf(left), { largestUnit: 'day' }).days
}

/**
 * Full weeks (trunc toward 0), like date-fns.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInWeeks(dateLeft, dateRight) {
  // `|| 0` normalises -0: Math.trunc keeps the sign of a negative gap shorter
  // than a week, so a 1..6 day backwards difference returned -0
  return Math.trunc(differenceInDays(dateLeft, dateRight) / 7) || 0
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
  // `isoOf` on both, like differenceInDays. Without it this function read TWO coordinate systems
  // at once: the sign came from `compare`, which ignores the calendar, and the magnitude came from
  // `differenceInCalendarMonths`, which does not. A mixed pair then measured 6,513 months for a
  // 29-day gap, and two days 543 ISO years apart measured 0.
  const left = isoOf(toPlainDate(dateLeft, 'dateLeft'))
  const right = isoOf(toPlainDate(dateRight, 'dateRight'))
  const sign = PlainDateFns.compare(left, right)
  if (sign === 0) return 0
  const diff = Math.abs(calendarMonthsBetween(left, right))
  if (diff < 1) return 0
  const [earlier, later] = sign > 0 ? [right, left] : [left, right]
  // Where `earlier` lands after `diff` months: same year-month as `later` by
  // construction, on `earlier`'s day clamped to that month's length. Compared
  // as day numbers rather than built as a date, because the landing can sit
  // past the maximum PlainDate even when both operands are inside the range.
  const landingDay = Math.min(earlier.day, PlainDateFns.daysInMonth(later))
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
  const left = isoOf(toPlainDate(dateLeft, 'dateLeft'))
  const right = isoOf(toPlainDate(dateRight, 'dateRight'))
  return calendarMonthsBetween(left, right)
}

/**
 * Full years (signed). Same rule as `differenceInMonths`: a year counts as full
 * when `addYears` would carry the earlier date to the later one, so 29 February
 * to 28 February of a common year is one year, because `addYears` clamps.
 * That keeps `differenceInYears(addYears(d, n), d) === n`, and keeps this
 * function agreeing with `trunc(differenceInMonths(a, b) / 12)`.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInYears(dateLeft, dateRight) {
  // `isoOf` on both: a measurement, so it ignores the year LABEL. See differenceInMonths.
  const left = isoOf(toPlainDate(dateLeft, 'dateLeft'))
  const right = isoOf(toPlainDate(dateRight, 'dateRight'))
  const sign = PlainDateFns.compare(left, right)
  if (sign === 0) return 0
  const diff = Math.abs(left.year - right.year)
  if (diff < 1) return 0
  const [earlier, later] = sign > 0 ? [right, left] : [left, right]
  // Where `earlier` lands after `diff` years: same year as `later`, same month,
  // and the same day except that 29 February clamps to the 28th in a common
  // year, which is the only day-of-month that changes length year to year.
  // Compared field by field rather than built as a date, because the landing
  // can sit past the maximum PlainDate even with both operands inside the range.
  const landingDay =
    earlier.month === 2 && earlier.day === 29 && !PlainDateFns.inLeapYear(later)
      ? 28
      : earlier.day
  const isLastYearNotFull =
    earlier.month > later.month ||
    (earlier.month === later.month && landingDay > later.day)
  return sign * (diff - +isLastYearNotFull) || 0
}

/**
 * Calendar year number diff. Ignores month/day.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInCalendarYears(dateLeft, dateRight) {
  // NOT getYear: that is a field read and honours the label, so a mixed pair subtracted two
  // different year spaces and answered 0 for days 543 ISO years apart.
  return (
    isoOf(toPlainDate(dateLeft, 'dateLeft')).year -
    isoOf(toPlainDate(dateRight, 'dateRight')).year
  )
}

/**
 * Full quarters (trunc toward 0 of calendar-month/3 style via months).
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInQuarters(dateLeft, dateRight) {
  // `|| 0` normalises -0, same reason as differenceInWeeks: a backwards gap of
  // one or two months truncates to -0
  return Math.trunc(differenceInMonths(dateLeft, dateRight) / 3) || 0
}

/**
 * Calendar quarter index diff.
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {number}
 */
export function differenceInCalendarQuarters(dateLeft, dateRight) {
  const left = isoOf(toPlainDate(dateLeft, 'dateLeft'))
  const right = isoOf(toPlainDate(dateRight, 'dateRight'))
  return (left.year - right.year) * 4 + (quarterOf(left) - quarterOf(right))
}

// ─── compare / equal ───────────────────────────────────────────────

/**
 * @param {DayInput} date
 * @param {DayInput} dateToCompare
 * @returns {boolean}
 */
export function isBefore(date, dateToCompare) {
  return (
    PlainDateFns.compare(toPlainDate(date), toPlainDate(dateToCompare, 'dateToCompare')) <
    0
  )
}

/**
 * @param {DayInput} date
 * @param {DayInput} dateToCompare
 * @returns {boolean}
 */
export function isAfter(date, dateToCompare) {
  return (
    PlainDateFns.compare(toPlainDate(date), toPlainDate(dateToCompare, 'dateToCompare')) >
    0
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
    PlainDateFns.compare(
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
  // compare, not equals: Temporal's equals compares the calendar as well as the day, so it
  // answers false for the same week in two calendars. compare reads the ISO fields alone.
  return guardRange(
    'isSameWeek',
    () =>
      PlainDateFns.compare(
        PlainDateFns.subtractDays(left, daysIntoWeek(left, options)),
        PlainDateFns.subtractDays(right, daysIntoWeek(right, options)),
      ) === 0,
  )
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isSameMonth(dateLeft, dateRight) {
  const a = isoOf(toPlainDate(dateLeft, 'dateLeft'))
  const b = isoOf(toPlainDate(dateRight, 'dateRight'))
  return a.year === b.year && a.month === b.month
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isSameYear(dateLeft, dateRight) {
  // NOT getYear, for the same reason as differenceInCalendarYears: two days 543 ISO years apart
  // both read year 2569 once one of them carries a Buddhist label, and this answered true.
  return (
    isoOf(toPlainDate(dateLeft, 'dateLeft')).year ===
    isoOf(toPlainDate(dateRight, 'dateRight')).year
  )
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {boolean}
 */
export function isSameQuarter(dateLeft, dateRight) {
  const a = isoOf(toPlainDate(dateLeft, 'dateLeft'))
  const b = isoOf(toPlainDate(dateRight, 'dateRight'))
  return a.year === b.year && quarterOf(a) === quarterOf(b)
}

/**
 * @param {DayInput} dateLeft
 * @param {DayInput} dateRight
 * @returns {-1 | 0 | 1}
 */
export function compareAsc(dateLeft, dateRight) {
  return /** @type {-1 | 0 | 1} */ (
    PlainDateFns.compare(
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
      .reduce((a, b) => (PlainDateFns.compare(a, b) <= 0 ? a : b)),
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
      .reduce((a, b) => (PlainDateFns.compare(a, b) >= 0 ? a : b)),
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
  return d.day === PlainDateFns.daysInMonth(d)
}

// ─── intervals ─────────────────────────────────────────────────────

/**
 * Inclusive day range. Throws if start > end.
 * @param {Interval} interval
 * @returns {string[]}
 */
export function eachDayOfInterval(interval) {
  const { start, end } = toInterval(interval)
  if (PlainDateFns.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  /** @type {string[]} */
  const out = []
  let cur = start
  // break on the last day, never step past it — an add beyond the max
  // PlainDate (+275760-09-13) throws
  for (;;) {
    out.push(toDayString(cur))
    if (PlainDateFns.compare(cur, end) >= 0) break
    cur = PlainDateFns.addDays(cur, 1)
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
  if (PlainDateFns.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  /** @type {string[]} */
  const out = []
  // the 1st of start's month can sit below the minimum PlainDate
  const [cur0, last] = guardRange('eachMonthOfInterval', () => [
    PlainDateFns.withFields(start, { day: 1 }),
    PlainDateFns.withFields(end, { day: 1 }),
  ])
  let cur = cur0
  // same boundary rule as eachDayOfInterval
  for (;;) {
    out.push(toDayString(cur))
    if (PlainDateFns.compare(cur, last) >= 0) break
    cur = PlainDateFns.addMonths(cur, 1)
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
  if (PlainDateFns.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  /** @type {string[]} */
  const out = []
  // `with` then `add`, never `PlainDate.from({year})`: both keep start's calendar, and the object
  // form would read `year` as an ISO year, which is 543 years out for a Buddhist day.
  // Jan 1 of start's year can sit below the minimum PlainDate.
  guardRange('eachYearOfInterval', () => {
    // Compare ISO years, then add. Testing the loop condition AFTER the push is what keeps the
    // top edge working: Jan 1 of +275760 is valid, and adding a year to it is not.
    const lastIsoYear = isoOf(end).year
    let cur = PlainDateFns.withFields(start, { month: 1, day: 1 })
    for (;;) {
      out.push(toDayString(cur))
      if (isoOf(cur).year >= lastIsoYear) break
      cur = PlainDateFns.addYears(cur, 1)
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
  if (PlainDateFns.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  return PlainDateFns.compare(d, start) >= 0 && PlainDateFns.compare(d, end) <= 0
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
  if (PlainDateFns.compare(start, end) > 0) {
    throw new RangeError('daymath: interval start must not be after end')
  }
  if (PlainDateFns.compare(d, start) < 0) return toDayString(start)
  if (PlainDateFns.compare(d, end) > 0) return toDayString(end)
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
  if (PlainDateFns.compare(a.start, a.end) > 0) {
    throw new RangeError('daymath: intervalLeft start must not be after end')
  }
  if (PlainDateFns.compare(b.start, b.end) > 0) {
    throw new RangeError('daymath: intervalRight start must not be after end')
  }
  const inclusive = options?.inclusive ?? false
  if (inclusive) {
    return (
      PlainDateFns.compare(a.start, b.end) <= 0 &&
      PlainDateFns.compare(b.start, a.end) <= 0
    )
  }
  // date-fns default: touch-at-endpoint is NOT overlap
  return (
    PlainDateFns.compare(a.start, b.end) < 0 && PlainDateFns.compare(b.start, a.end) < 0
  )
}

// Cross-implementation battery. No imports, so the identical file runs in Node
// (polyfill) and in a browser (native Temporal). Any difference in the returned
// object is a difference between the two Temporal implementations.
//
// Signatures are never hard-coded: every export is called with every candidate
// argument tuple, and the outcome — value or error — is recorded either way.
// Enumerating the module beats a hand-typed list, which always under-counts.
//
// Intervals are kept SHORT on purpose. An interval spanning the representable
// range makes the walkers allocate ~99 million day strings and the run dies of
// heap exhaustion, which measures the battery, not daymath.

// oxfmt-ignore -- a data table reads better in columns than one per line
const DATES = [
  '2026-01-31',
  '2026-02-28',
  '2024-02-29',
  '2000-02-29',
  '1900-03-01',
  '2026-12-31',
  '2026-01-01',
  '2026-06-15',
  '2026-08-06',
  '2023-02-28',
  '2026-04-30',
  '2026-05-31',
  '2026-11-30',
  '2100-02-28',
  '2400-02-29',
  '0001-01-01',
  '0000-01-01',
  '-000001-12-31',
  '9999-12-31',
  '+010000-01-01',
  '-271821-04-19',
  '+275760-09-13',
  '+275760-09-12',
  '-271821-04-20',
  '1970-01-01',
  '1969-12-31',
  '2026-03-01',
  '2026-09-30',
  '2026-07-04',
  '1582-10-15',
]

// 1e9 is here on purpose. It is the amount that overflows the representable
// range from any of these dates, so it is the only one that exercises the
// range guard. Without it the battery cannot see an implementation that
// silently returns a wrong date instead of throwing.
const AMOUNTS = [0, 1, -1, 7, -7, 28, 31, 400, -400, 1e5, 1e9, -1e9]

// Fixed, short, and independent of DATES, so no probe can span the whole range.
const INTERVALS = [
  { start: '2026-01-01', end: '2026-01-05' }, // forward
  { start: '2026-01-05', end: '2026-01-01' }, // reversed: must throw
  { start: '2026-02-27', end: '2026-03-02' }, // across a month end
  { start: '2024-02-28', end: '2024-03-01' }, // across a leap day
  { start: '+275760-09-11', end: '+275760-09-13' }, // at the upper edge
  { start: '-271821-04-19', end: '-271821-04-21' }, // at the lower edge
]

const MAX = 400 // cap a recorded value; the walkers legitimately return long arrays

function outcome(fn) {
  try {
    const v = fn()
    // Object.is keeps -0 distinguishable from 0, which a plain String() hides.
    if (typeof v === 'number' && Object.is(v, -0)) return '-0'
    const s = JSON.stringify(v) ?? 'undefined'
    return s.length > MAX ? `len:${s.length}:${s.slice(0, MAX)}` : s
  } catch (err) {
    return `E:${err.constructor.name}:${err.message}`
  }
}

/**
 * FNV-1a. Hand-rolled because this file must run unchanged in Node, Deno, Bun
 * and a browser, and none of their hashing APIs are common to all four.
 * @param {string} s
 */
export function hash(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    // charCodeAt, not codePointAt: this loop steps by one, so a code point
    // would consume an astral pair and then read its low surrogate again.
    // oxlint --fix made that swap once; the rule is off for this file.
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Fixed instants. `day` is the only export that converts one, and it is the
// only place Temporal.Instant and ZonedDateTime are used at all, so this is the
// only cross-runtime cover they get.
//
// WARNING: never probe an export with zero arguments here. `day()` reads the
// clock, and a recorded hash of today would turn CI red at the next midnight.
// Every call below passes a fixed moment, so every result is reproducible.
const MOMENTS = [
  new Date(0), // the epoch
  new Date('2026-08-07T02:30:00Z'), // 22:30 the previous day in New York
  new Date('1969-07-20T20:17:00Z'), // before the epoch, so negative ms
  new Date('garbage'), // Invalid Date
  1761616161771, // epoch milliseconds
  1761616161, // the same value as seconds, read as ms on purpose
  -14256000000, // negative milliseconds
  NaN,
  Infinity,
]

// Well-formed timestamps, the input class day() accepts as a moment. Fixed
// instants only, so no clock is read and every result is reproducible.
//
// MOMENTS and JUNK between them cover only Date objects, numbers and strings
// that must be refused. Without this list the accept path has no cross-runtime
// cover at all, which is the same shape of gap that let day() answer today for
// an ISO timestamp.
const INSTANTS = [
  '1999-01-01T00:00:00Z', // the plain spelling
  '1999-01-01T00:00:00.000Z', // with milliseconds
  '19990101T000000Z', // compact
  '2026-08-08T21:00:00+09:00', // an offset, not Z
  '2026-08-08T20:00:00-04:00[America/New_York]', // an offset plus a named zone
  '2026-08-08T20:00:00-04:00[!America/New_York]', // the critical spelling of it
  '2026-08-08T20:00:00Z[u-ca=buddhist]', // a calendar with nothing to renumber
  '1999-06-06[Asia/Tokyo]', // a day plus a zone, no time at all
  '2026-08-08T12:00[America/New_York]', // a time plus a zone, no offset
  '1969-07-20T20:17:00Z', // before the epoch
  '-271821-04-20T00:00:00Z', // the lowest instant inside the day range
  '+275760-09-13T00:00:00Z', // the highest
]

// Strings that must be refused. Every export throws on every entry where it
// actually reads the value — first argument, or inside an interval. In the
// second-argument slot 28 exports ignore the extra argument and answer normally,
// and `isValid` answers `false` by contract. `outcome` records the value or the
// error class and message either way, so any change of outcome moves the hash.
//
// This list exists because MOMENTS held only Date objects and numbers, so no
// probe ever passed a bad *string*. That gap let day() read an ISO timestamp
// as a time zone and answer today, silently, on every runtime.
const JUNK = [
  '', // empty
  '11/12/2026', // November or December, unknowable
  '2026-08-08 12:00:00', // SQL DATETIME: a space, not a T
  '2026-08-08T12:00', // a time, but no offset, so no instant
  '12:30:00', // a time alone
  '2026-08-08T25:00:00Z', // hour 25
  '2026-13-01', // month 13
  '2026-02-30', // a day that does not exist
  '2026-W32-5', // ISO week date, which daymath does not read
  '2026/08/08', // slashes
  '-2026-08-08', // a four-digit year may not carry a sign
  'T12:00:00Z', // an ISO time alone: a zone to native Temporal, not to the polyfill
  'T120000Z', // the compact spelling, which carries no colon to catch it
  '2026-08-08T20:00:00-05:00[America/New_York]', // the offset contradicts the zone
  '2026-08-08T20:00:00Z[Asia/Tokoy]', // a misspelled zone in the bracket
  '2026-08-08T12:00[America/New_York][u-ca=buddhist]', // a zone and a calendar
  '2026-08-08T12:00[UTC][u-ca=gregory]', // gregory leaked on every runtime once
  '2026-01-31[u-ca=buddhist]', // a real calendar annotation, refused
  '2026-01-31[!u-ca=buddhist]', // the critical spelling of it
  '[u-ca=[u-ca=[u-ca=x]]]', // bracket soup: probes the annotation regex alone
]

/**
 * @param dm the daymath module
 * @param PlainDate the runtime's `Temporal.PlainDate` — native where there is
 *   one, the bundled polyfill otherwise. This is the whole point: daymath's
 *   brand check replaced `instanceof`, and without a real PlainDate probe the
 *   cross-runtime lane gives that fix no cover at all. Results stay identical
 *   everywhere, because daymath reduces any PlainDate to the same ISO string.
 */
export function run(dm, PlainDate) {
  if (typeof PlainDate?.from !== 'function') {
    // Loud, because a silently skipped probe would shrink the battery and read
    // as a pass.
    throw new TypeError('battery: run(dm, PlainDate) needs a Temporal.PlainDate')
  }
  const asObjects = ['2026-01-31', '2024-02-29', '+010000-01-01'].map((s) =>
    PlainDate.from(s),
  )
  const names = Object.keys(dm)
    .filter((n) => typeof dm[n] === 'function')
    .toSorted()
  const results = {}
  for (const name of names) {
    const fn = dm[name]
    const rows = []
    for (const d of DATES) {
      rows.push(
        outcome(() => fn(d)),
        outcome(() => fn(d, 'yyyy-MM-dd')),
      )
      rows.push(
        outcome(() => fn([d, '2026-08-06'])),
        outcome(() => fn({ start: d, end: d })),
      ) // single-day interval: safe
      for (const n of AMOUNTS) rows.push(outcome(() => fn(d, n)))
      for (const other of ['2026-08-06', '2024-02-29', d])
        rows.push(outcome(() => fn(d, other)))
      for (const w of [0, 1, 7]) rows.push(outcome(() => fn(d, { weekStartsOn: w })))
    }
    for (const iv of INTERVALS) {
      rows.push(
        outcome(() => fn(iv)),
        outcome(() => fn('2026-01-03', iv)),
      )
      rows.push(
        outcome(() => fn(iv, INTERVALS[0])),
        outcome(() => fn(iv, { weekStartsOn: 1 })),
      )
    }
    for (const m of MOMENTS) {
      rows.push(
        outcome(() => fn(m)),
        outcome(() => fn(m, 'utc')),
      )
      rows.push(
        outcome(() => fn(m, 'Asia/Tokyo')),
        outcome(() => fn(m, 'America/New_York')),
      )
    }
    for (const t of INSTANTS) {
      rows.push(
        outcome(() => fn(t)),
        outcome(() => fn(t, 'utc')),
      )
      rows.push(
        outcome(() => fn(t, 'Asia/Tokyo')),
        outcome(() => fn(t, 'America/New_York')),
      )
    }
    for (const j of JUNK) {
      rows.push(
        outcome(() => fn(j)),
        outcome(() => fn(j, 'utc')),
      )
      rows.push(
        outcome(() => fn('2026-08-06', j)),
        outcome(() => fn({ start: j, end: '2026-08-06' })),
      )
    }
    for (const pd of asObjects) {
      rows.push(
        outcome(() => fn(pd)),
        outcome(() => fn(pd, 1)),
      )
      rows.push(
        outcome(() => fn(pd, 'utc')),
        outcome(() => fn(pd, { weekStartsOn: 1 })),
      )
      rows.push(outcome(() => fn({ start: pd, end: pd })))
    }
    results[name] = rows
  }
  return results
}

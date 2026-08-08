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

const DATES = [
  '2026-01-31', '2026-02-28', '2024-02-29', '2000-02-29', '1900-03-01',
  '2026-12-31', '2026-01-01', '2026-06-15', '2026-08-06', '2023-02-28',
  '2026-04-30', '2026-05-31', '2026-11-30', '2100-02-28', '2400-02-29',
  '0001-01-01', '0000-01-01', '-000001-12-31', '9999-12-31', '+010000-01-01',
  '-271821-04-19', '+275760-09-13', '+275760-09-12', '-271821-04-20',
  '1970-01-01', '1969-12-31', '2026-03-01', '2026-09-30', '2026-07-04',
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
  const asObjects = ['2026-01-31', '2024-02-29', '+010000-01-01'].map((s) => PlainDate.from(s))
  const names = Object.keys(dm).filter((n) => typeof dm[n] === 'function').sort()
  const results = {}
  for (const name of names) {
    const fn = dm[name]
    const rows = []
    for (const d of DATES) {
      rows.push(outcome(() => fn(d)))
      rows.push(outcome(() => fn(d, 'yyyy-MM-dd')))
      rows.push(outcome(() => fn([d, '2026-08-06'])))
      rows.push(outcome(() => fn({ start: d, end: d }))) // single-day interval: safe
      for (const n of AMOUNTS) rows.push(outcome(() => fn(d, n)))
      for (const other of ['2026-08-06', '2024-02-29', d]) rows.push(outcome(() => fn(d, other)))
      for (const w of [0, 1, 7]) rows.push(outcome(() => fn(d, { weekStartsOn: w })))
    }
    for (const iv of INTERVALS) {
      rows.push(outcome(() => fn(iv)))
      rows.push(outcome(() => fn('2026-01-03', iv)))
      rows.push(outcome(() => fn(iv, INTERVALS[0])))
      rows.push(outcome(() => fn(iv, { weekStartsOn: 1 })))
    }
    for (const m of MOMENTS) {
      rows.push(outcome(() => fn(m)))
      rows.push(outcome(() => fn(m, 'utc')))
      rows.push(outcome(() => fn(m, 'Asia/Tokyo')))
      rows.push(outcome(() => fn(m, 'America/New_York')))
    }
    for (const pd of asObjects) {
      rows.push(outcome(() => fn(pd)))
      rows.push(outcome(() => fn(pd, 1)))
      rows.push(outcome(() => fn(pd, 'utc')))
      rows.push(outcome(() => fn(pd, { weekStartsOn: 1 })))
      rows.push(outcome(() => fn({ start: pd, end: pd })))
    }
    results[name] = rows
  }
  return results
}

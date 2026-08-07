/**
 * Exhaustive differential test: daymath vs date-fns, every day in a range.
 *
 * Coverage counts executed lines; this enumerates the input domain instead.
 * date-fns is the oracle for every name daymath borrowed. Divergences are
 * either bugs or deliberate design choices, and the deliberate ones have to be
 * listed in KNOWN below, with a reason. An unlisted divergence fails the run.
 *
 * The run also asserts the COUNT of each known divergence against BASELINES.
 * A green run therefore means "the numbers are what we measured", not merely
 * "no new function name diverged". Three things fail it: an unlisted name, a
 * count that moved, and a KNOWN entry that no longer diverges at all.
 * Counts are range-specific, so they are only checked for a range that has a
 * baseline; any other range prints the numbers and asserts nothing.
 *
 * This is why `date-fns` is pinned to an exact version in package.json. The
 * oracle is a fixture. Upgrading it should be a deliberate commit that
 * re-measures these counts, not something a plain `npm install` can do.
 *
 * Not covered, and deliberately so. Eleven exports are absent from CASES:
 * format, parse, isValid, min, max, clamp, isWithinInterval,
 * areIntervalsOverlapping and the three each*OfInterval walkers. The first six
 * have no date-fns counterpart that takes and returns the same shape; the
 * interval ones need a two-interval driver rather than a two-day one.
 * The default range also sits well inside the PlainDate limits, so nothing here
 * exercises the -271821 / +275760 edges — test.js owns those.
 *
 *   node scripts/differential.mjs                 # 1900-01-01 … 2100-12-31
 *   node scripts/differential.mjs 1600 2400       # wider
 *   node scripts/differential.mjs 2026 2026       # one year, quick
 */
import * as dm from '../index.js'
import * as fns from 'date-fns'

const [, , fromYear = '1900', toYear = '2100'] = process.argv
const FROM = Number(fromYear)
const TO = Number(toYear)

// ─── conversions ───────────────────────────────────────────────────
// date-fns works on Date. Local NOON, never local midnight: a few zones have
// historically skipped midnight on a DST transition, which would shift the day.
// Years 0-99 also can't go through the Date constructor (it maps them to 1900+y),
// so the year always goes in via setFullYear.

/** @param {string} iso @returns {Date} */
function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(2000, 0, 1, 12)
  dt.setFullYear(y, m - 1, d)
  return dt
}

/** @param {Date} dt @returns {string} */
function fromDate(dt) {
  const y = String(dt.getFullYear()).padStart(4, '0')
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Every ISO day in [FROM-01-01, TO-12-31], built without daymath. */
function* days() {
  const end = new Date(2000, 0, 1, 12)
  end.setFullYear(TO, 11, 31)
  const cur = new Date(2000, 0, 1, 12)
  cur.setFullYear(FROM, 0, 1)
  while (cur <= end) {
    yield fromDate(cur)
    cur.setDate(cur.getDate() + 1)
  }
}

// ─── known, deliberate divergences ─────────────────────────────────

// Every entry carries a `refute`: the experiment that would prove it wrong.
// A reason alone only says why we believe it; a refutation says what would
// change our mind, and stays checkable after everyone here has forgotten.
//
// `status` separates the two kinds. SETTLED means the question is answered and
// only a regression should move it. OPEN means daymath has not yet decided, and
// the run prints it as OPEN so it does not scroll past looking like a pass.
// The two setters are still OPEN; the two difference functions were settled in
// 0.3.0 and now diverge only because of a date-fns bug.

const KNOWN = {
  setDate: {
    status: 'OPEN',
    why: 'daymath constrains inside the month (Temporal `with` overflow); date-fns rolls over. date-fns rolls by omission, not by design: setDate is a bare `_date.setDate(n)` pass-through to Date, while its own setMonth clamps with `Math.min(day, daysInMonth)`. Open 0.3.0 decision.',
    refute:
      'Show that date-fns rolls deliberately, or that a caller wants setDate(feb, 31) to mean March 3. Note the cost of switching is one line: roll-over is exactly `d.with({day: 1}).add({days: n - 1})`, measured 0 mismatches in 118,703 comparisons.',
  },
  setYear: {
    status: 'OPEN',
    why: 'Feb 29 into a common year: daymath constrains to Feb 28, date-fns rolls to Mar 1. Same omission as setDate — `date_.setFullYear(year)` with no clamp.',
    refute:
      'Same experiment as setDate. The roll rule here is `d.with({year: y, day: 1}).add({days: d.day - 1})`, measured 0 mismatches in 63,917 comparisons.',
  },
  // Settled in 0.3.0. daymath adopted clamped semantics, so it now agrees with
  // date-fns wherever date-fns agrees with itself. Every divergence left is
  // their argument-order bug, which PR #4283 removes.
  differenceInMonths: {
    status: 'SETTLED',
    why: 'date-fns bug, not a design choice: a February special case fires on the left operand only, so differenceInMonths(a,b) and (b,a) disagree in magnitude. daymath is symmetric. Do not "fix" this to match. Since 0.3.0 daymath counts a month as full when addMonths would carry the earlier date to the later one, which is date-fns\'s own definition, so nothing else is left to disagree about.',
    refute:
      'Run daymath against the patched source and expect exactly 0 — measured, 954,382 pairs, 0 mismatches. If that ever returns a non-zero count, the two libraries have diverged on semantics again and this entry is no longer just their bug. Second check: `differenceInMonths(addMonths(d, n), d) === n` holds in all 1,761,936 cases; if it stops, daymath changed, not them.',
  },
  differenceInQuarters: {
    status: 'SETTLED',
    why: 'Derived from differenceInMonths (trunc /3), so it inherits the date-fns bug above and nothing else.',
    refute:
      'Measured over 1900-2100, not assumed: every quarter divergence also diverges in months, 0 without, and daymath\'s differenceInQuarters === trunc(differenceInMonths / 3) with 0 mismatches. If either check stops holding, this is no longer a derived entry.',
  },
}

// Expected divergence counts per range. Counts are only meaningful for a range
// that has been measured, so an unlisted range asserts nothing and says so.
const BASELINES = {
  '1900-2100': { setDate: 39730, differenceInMonths: 1000, differenceInQuarters: 750, setYear: 196 },
  '2020-2030': { setDate: 2166, differenceInMonths: 57, differenceInQuarters: 43, setYear: 12 },
}

// ─── the comparison table ──────────────────────────────────────────
// kind 'day'    → f(date) returns an ISO day string
// kind 'value'  → f(date) returns a number or boolean
// kind 'amount' → f(date, n) returns an ISO day string
// kind 'pair'   → f(dateLeft, dateRight) returns a number or boolean

const AMOUNTS = [-400, -365, -100, -31, -12, -7, -3, -1, 0, 1, 3, 7, 12, 31, 100, 365, 400]
const OFFSETS = [-400, -365, -90, -31, -7, -1, 0, 1, 7, 31, 90, 365, 400]

// `adapt` maps date-fns's answer into daymath's convention before comparing, and
// `theirArg` maps an argument the other way. They exist only for the three
// functions whose index base deliberately differs, so the harness keeps testing
// behaviour instead of recording a constant offset half a million times.

/** @type {Array<{name: string, kind: string, mine: Function, theirs: Function, args?: number[], adapt?: Function, theirArg?: Function}>} */
const CASES = [
  // day -> day
  ...['startOfMonth', 'endOfMonth', 'startOfYear', 'endOfYear', 'startOfQuarter', 'endOfQuarter', 'startOfWeek', 'endOfWeek'].map(
    (name) => ({ name, kind: 'day', mine: dm[name], theirs: fns[name] }),
  ),
  // day -> value
  ...['getYear', 'getDate', 'getDayOfYear', 'getDaysInMonth', 'getQuarter', 'isLeapYear',
    'isSunday', 'isMonday', 'isTuesday', 'isWednesday', 'isThursday', 'isFriday', 'isSaturday', 'isWeekend',
    'isFirstDayOfMonth', 'isLastDayOfMonth'].map(
    (name) => ({ name, kind: 'value', mine: dm[name], theirs: fns[name] }),
  ),
  // daymath is ISO 1…12, date-fns is 0…11
  { name: 'getMonth', kind: 'value', mine: dm.getMonth, theirs: fns.getMonth, adapt: (m) => m + 1 },
  // daymath is ISO 1=Mon…7=Sun, date-fns is 0=Sun…6=Sat; only Sunday moves
  { name: 'getDay', kind: 'value', mine: dm.getDay, theirs: fns.getDay, adapt: (d) => (d === 0 ? 7 : d) },
  // (day, amount) -> day
  ...['addDays', 'subDays', 'addWeeks', 'subWeeks', 'addMonths', 'subMonths', 'addYears', 'subYears', 'addQuarters', 'subQuarters'].map(
    (name) => ({ name, kind: 'amount', mine: dm[name], theirs: fns[name], args: AMOUNTS }),
  ),
  // setters take a field value, not a delta
  { name: 'setYear', kind: 'amount', mine: dm.setYear, theirs: fns.setYear, args: [1900, 1999, 2000, 2024, 2025, 2100] },
  // daymath takes ISO 1…12; date-fns needs the same month as 0…11
  { name: 'setMonth', kind: 'amount', mine: dm.setMonth, theirs: fns.setMonth, args: [1, 2, 3, 6, 9, 12], theirArg: (m) => m - 1 },
  { name: 'setDate', kind: 'amount', mine: dm.setDate, theirs: fns.setDate, args: [1, 5, 15, 28, 29, 30, 31] },
  // (dayLeft, dayRight) -> value
  ...['differenceInDays', 'differenceInWeeks', 'differenceInMonths', 'differenceInCalendarMonths',
    'differenceInYears', 'differenceInCalendarYears', 'differenceInQuarters', 'differenceInCalendarQuarters',
    'isBefore', 'isAfter', 'isEqual', 'isSameDay', 'isSameWeek', 'isSameMonth', 'isSameYear', 'isSameQuarter',
    'compareAsc', 'compareDesc'].map(
    (name) => ({ name, kind: 'pair', mine: dm[name], theirs: fns[name] }),
  ),
]

// ─── run ───────────────────────────────────────────────────────────

/** @type {Map<string, {count: number, samples: string[]}>} */
const diffs = new Map()

function record(name, detail) {
  let e = diffs.get(name)
  if (!e) diffs.set(name, (e = { count: 0, samples: [] }))
  e.count += 1
  if (e.samples.length < 4) e.samples.push(detail)
}

/** date-fns returns Date for day-producing fns; normalize before comparing. */
function theirDay(result) {
  return result instanceof Date
    ? Number.isNaN(result.getTime())
      ? 'Invalid Date'
      : fromDate(result)
    : String(result)
}

let comparisons = 0
const t0 = process.hrtime.bigint()

for (const iso of days()) {
  const dt = toDate(iso)

  for (const c of CASES) {
    if (c.kind === 'day') {
      const mine = c.mine(iso)
      const theirs = theirDay(c.theirs(dt))
      comparisons += 1
      if (mine !== theirs) record(c.name, `${c.name}('${iso}') mine=${mine} theirs=${theirs}`)
    } else if (c.kind === 'value') {
      const mine = c.mine(iso)
      const raw = c.theirs(dt)
      const theirs = c.adapt ? c.adapt(raw) : raw
      comparisons += 1
      if (mine !== theirs) record(c.name, `${c.name}('${iso}') mine=${mine} theirs=${theirs}`)
    } else if (c.kind === 'amount') {
      for (const n of c.args) {
        const mine = c.mine(iso, n)
        const theirs = theirDay(c.theirs(dt, c.theirArg ? c.theirArg(n) : n))
        comparisons += 1
        if (mine !== theirs) record(c.name, `${c.name}('${iso}', ${n}) mine=${mine} theirs=${theirs}`)
      }
    } else {
      // pair: this day against a fixed set of offsets, not the full cross product
      for (const off of OFFSETS) {
        const other = new Date(dt)
        other.setDate(other.getDate() + off)
        const otherIso = fromDate(other)
        const mine = c.mine(iso, otherIso)
        const theirs = c.theirs(dt, other)
        comparisons += 1
        // `!==`, not Object.is: it treats 0 and -0 as equal. Both libraries
        // return 0 from compareDesc(x, x) today, so nothing is being hidden.
        if (mine !== theirs) {
          record(c.name, `${c.name}('${iso}', '${otherIso}') mine=${mine} theirs=${theirs}`)
        }
      }
    }
  }
}

const ms = Number(process.hrtime.bigint() - t0) / 1e6

// ─── report ────────────────────────────────────────────────────────

console.log(`\ndaymath vs date-fns ${fns.version ?? '4.x'} — ${FROM}-01-01 to ${TO}-12-31`)
console.log(`${comparisons.toLocaleString()} comparisons in ${(ms / 1000).toFixed(1)}s\n`)

const baseline = BASELINES[`${FROM}-${TO}`]
if (!baseline) {
  console.log(`No baseline for ${FROM}-${TO}; counts are reported but NOT asserted.`)
  console.log(`Baselines exist for: ${Object.keys(BASELINES).join(', ')}\n`)
}

/** Wrap prose at 76 columns so a long reason stays readable in a terminal. */
function wrap(text, indent = '         ') {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > 76) {
      lines.push(indent + line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(indent + line)
  return lines.join('\n')
}

const failures = []

for (const [name, { count, samples }] of [...diffs].sort((a, b) => b[1].count - a[1].count)) {
  const known = KNOWN[name]
  const label = known ? known.status.padEnd(8) : 'UNKNOWN '
  console.log(`${label}${name}: ${count.toLocaleString()} divergences`)

  if (!known) {
    failures.push(`${name} diverges and is not in KNOWN`)
  } else {
    console.log(wrap(known.why))
    console.log(wrap(`REFUTE: ${known.refute}`))
    const expected = baseline?.[name]
    if (expected !== undefined && expected !== count) {
      console.log(`         COUNT DRIFT: expected ${expected.toLocaleString()}`)
      failures.push(
        `${name} count moved ${expected.toLocaleString()} → ${count.toLocaleString()}`,
      )
    }
  }
  for (const s of samples) console.log(`         ${s}`)
  console.log()
}

// A KNOWN entry that stopped diverging is as much a signal as a new one: it
// means the oracle changed under us, or daymath did.
for (const name of Object.keys(KNOWN)) {
  if (!diffs.has(name)) {
    console.log(`STALE   ${name}: listed in KNOWN but no longer diverges\n`)
    failures.push(`${name} is in KNOWN but no longer diverges`)
  }
}

const clean = CASES.filter((c) => !diffs.has(c.name)).map((c) => c.name)
console.log(`${clean.length} of ${CASES.length} functions match date-fns exactly:`)
console.log(`  ${clean.join(' ')}\n`)

const open = Object.values(KNOWN).filter((k) => k.status === 'OPEN').length
if (open) {
  console.log(`${open} of ${Object.keys(KNOWN).length} known divergences are OPEN — daymath has not decided these.\n`)
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL — ${f}`)
  console.log('\nFix daymath, or update KNOWN/BASELINES with a fresh measurement.')
  process.exit(1)
}
console.log(
  baseline
    ? 'PASS — every divergence is documented and every count matches its baseline.'
    : 'PASS — every divergence is documented (counts not asserted for this range).',
)

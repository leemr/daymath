// Can `Intl` do day()'s work, so a fns port does not have to import Instant, ZonedDateTime and
// Now? This is the harness that answers it. Temporal is the oracle.
//
//   node scripts/intl-day.mjs           # the battery, plus the orphan-day baseline
//   node scripts/intl-day.mjs --sweep   # re-walk every IANA zone's transitions, 1900-2100
//
// Same contract as scripts/differential.mjs: a known divergence is asserted as a COUNT against a
// baseline, so green means the numbers are what was measured, not merely that nothing crashed.

import { Temporal } from 'temporal-polyfill'
import process from 'node:process'

// ---------------------------------------------------------------------------------------------
// The candidate. No Temporal, no polyfill — every runtime already ships a TZ database for Intl.
// ---------------------------------------------------------------------------------------------

const cache = new Map()

const formatter = (zone) => {
  let f = cache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      era: 'short',
    })
    cache.set(zone, f)
  }
  return f
}

const pad = (n, width) => String(Math.abs(n)).padStart(width, '0')

/** ISO day string, expanded to ±YYYYYY outside 0000-9999, exactly as Temporal prints it. */
const isoDay = (year, month, day) =>
  year >= 0 && year <= 9999
    ? `${pad(year, 4)}-${month}-${day}`
    : `${year < 0 ? '-' : '+'}${pad(year, 6)}-${month}-${day}`

/**
 * `ca-gregory` is deliberate. `ca-iso8601` drops the SIGN on a negative year: it prints
 * `2-12-31` for ISO `-000001-12-31` with no era part and no way to recover it. Gregorian keeps
 * an era, and Gregorian BC year n is ISO year 1 - n.
 */
const dayFromEpoch = (epochMs, zone) => {
  const parts = formatter(zone).formatToParts(new Date(epochMs))
  const get = (type) => parts.find((p) => p.type === type)?.value
  const gregYear = Number(get('year'))
  return isoDay(get('era') === 'BC' ? 1 - gregYear : gregYear, get('month'), get('day'))
}

// ---------------------------------------------------------------------------------------------
// Check 1 — instant + zone -> civil day. This is the direction that matters and it is exact.
// ---------------------------------------------------------------------------------------------

const ZONES = [
  'UTC',
  'America/New_York',
  'America/St_Johns', // -3:30
  'Asia/Kolkata', // +5:30
  'Asia/Kathmandu', // +5:45
  'Pacific/Kiritimati', // +14
  'Pacific/Niue', // -11
  'Australia/Lord_Howe', // +10:30 / +11
  'Europe/Dublin', // negative DST in the database
  'Pacific/Apia', // skipped a whole day in 2011
]

const MOMENTS = [
  0,
  1_770_000_000_000,
  -1,
  -62_167_219_200_000, // 2 BC
  -62_135_596_800_000, // 1 AD
  1_762_074_000_000, // US DST fall back 2025
  1_741_510_800_000, // US DST spring forward 2025
  1_320_620_400_000, // Pacific/Apia's skipped day, Dec 2011
  8_639_977_881_600_000, // near the top of the Date range
  -8_639_977_881_600_000, // near the bottom
  8_640_000_000_000_000, // the exact Date limit
  -8_640_000_000_000_000,
]

/**
 * The Julian-to-Gregorian reform windows, named explicitly.
 *
 * `cal 9 1752` prints 2 then 14, because Unix `cal` models the British calendar, where 3 to 13
 * September 1752 never happened. ISO 8601 has no such hole: it is proleptic Gregorian and extends
 * backwards forever. ECMA-402 requires the `gregory` calendar to be proleptic too, so `Intl`
 * agrees. These moments assert that, because the random spread above cannot find a 20-day window
 * inside a 547,000-year range.
 */
for (const [y, m, d] of [
  [1752, 9, 2], // British reform, the last Julian day
  [1752, 9, 3], // inside the British gap
  [1752, 9, 13], // inside the British gap
  [1752, 9, 14], // British reform, the first Gregorian day
  [1582, 10, 4], // papal reform, the last Julian day
  [1582, 10, 5], // inside the papal gap
  [1582, 10, 14], // inside the papal gap
  [1582, 10, 15], // papal reform, the first Gregorian day
  [1918, 1, 31], // Russian reform
  [1918, 2, 14],
  [1923, 9, 30], // Greek reform, the last of them
]) {
  MOMENTS.push(Date.UTC(y, m - 1, d, 12))
}

// Seeded, so the run repeats. Math.random() would make a failure unreproducible.
let seed = 20_260_809
const nextRandom = () =>
  (seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff) / 0x7fff_ffff
for (let i = 0; i < 4000; i++) MOMENTS.push(Math.trunc((nextRandom() * 2 - 1) * 8.64e15))

const dayViaTemporal = (epochMs, zone) =>
  Temporal.Instant.fromEpochMilliseconds(epochMs)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString()

let checked = 0
let bcEra = 0
let expandedYear = 0
const mismatches = []

for (const zone of ZONES) {
  for (const ms of MOMENTS) {
    const want = dayViaTemporal(ms, zone)
    const got = dayFromEpoch(ms, zone)
    checked++
    // Count the hard branches. A battery that never reaches them proves nothing about them.
    if (want.startsWith('-')) bcEra++
    if (want.startsWith('-') || want.startsWith('+')) expandedYear++
    if (got !== want) mismatches.push({ zone, ms, want, got })
  }
}

// ---------------------------------------------------------------------------------------------
// Check 2 — wall time + named zone -> civil day, answered as the date part of the string.
// Temporal resolves to an instant first, so it moves the day where a zone skipped one.
// ---------------------------------------------------------------------------------------------

/** Measured by `--sweep` over all 418 zones and 41,892 transitions, 1900-2100. */
const ORPHAN_DAYS = [
  { zone: 'Pacific/Apia', day: '2011-12-30', temporal: '2011-12-31' },
  { zone: 'Pacific/Enderbury', day: '1994-12-31', temporal: '1995-01-01' },
  { zone: 'Pacific/Fakaofo', day: '2011-12-30', temporal: '2011-12-31' },
  { zone: 'Pacific/Kiritimati', day: '1994-12-31', temporal: '1995-01-01' },
  { zone: 'Pacific/Kwajalein', day: '1993-08-21', temporal: '1993-08-22' },
]

const orphanFailures = []
for (const { zone, day, temporal } of ORPHAN_DAYS) {
  const got = Temporal.ZonedDateTime.from(`${day}T12:00[${zone}]`)
    .toPlainDate()
    .toString()
  if (got !== temporal) orphanFailures.push({ zone, day, expected: temporal, got })
}

const sweep = () => {
  const zones = Intl.supportedValuesOf('timeZone')
  const end = Temporal.Instant.from('2100-01-01T00:00Z')
  let transitions = 0
  const found = []
  for (const zone of zones) {
    let cursor = new Temporal.ZonedDateTime(
      Temporal.Instant.from('1900-01-01T00:00Z').epochNanoseconds,
      zone,
    )
    for (;;) {
      const next = cursor.getTimeZoneTransition('next')
      if (next === null || Temporal.Instant.compare(next.toInstant(), end) > 0) break
      transitions++
      const before = new Temporal.ZonedDateTime(next.epochNanoseconds - 1n, zone)
      const gapNs = next.offsetNanoseconds - before.offsetNanoseconds
      if (
        gapNs > 0 &&
        before.toPlainDate().toString() !== next.toPlainDate().toString()
      ) {
        const skipped = before.toPlainDate().add({ days: 1 }).toString()
        const resolved = Temporal.ZonedDateTime.from(`${skipped}T12:00[${zone}]`)
          .toPlainDate()
          .toString()
        if (resolved !== skipped) found.push({ zone, day: skipped, temporal: resolved })
      }
      cursor = next
    }
  }
  return { zones: zones.length, transitions, found }
}

// ---------------------------------------------------------------------------------------------

console.log(`instant + zone -> day: ${checked} pairs over ${ZONES.length} zones`)
console.log(`  BC-era answers reached     : ${bcEra}`)
console.log(`  expanded-year answers      : ${expandedYear}`)
console.log(`  mismatches vs Temporal     : ${mismatches.length}`)
for (const m of mismatches.slice(0, 12)) {
  console.log(`    ${m.zone} ${m.ms}  want ${m.want}  got ${m.got}`)
}

console.log(`\nwall time + zone -> day: answered as the date part of the string`)
console.log(
  `  known orphan days          : ${ORPHAN_DAYS.length}, all historical date-line moves`,
)
console.log(`  baseline drift             : ${orphanFailures.length}`)
for (const f of orphanFailures) {
  console.log(
    `    ${f.zone} ${f.day}  baseline says ${f.expected}, Temporal now says ${f.got}`,
  )
}

if (process.argv.includes('--sweep')) {
  const { zones, transitions, found } = sweep()
  console.log(
    `\nsweep: ${zones} zones, ${transitions} transitions walked, ${found.length} orphan days`,
  )
  for (const f of found) console.log(`    ${f.zone.padEnd(26)} ${f.day} -> ${f.temporal}`)
  const drifted =
    found.length !== ORPHAN_DAYS.length ||
    found.some((f, i) => f.zone !== ORPHAN_DAYS[i].zone || f.day !== ORPHAN_DAYS[i].day)
  if (drifted) {
    console.error(
      '\nORPHAN_DAYS no longer matches the tzdata. Update the baseline deliberately.',
    )
    process.exitCode = 1
  }
}

// A battery that never reaches a branch cannot vouch for it, so an empty branch fails the run.
if (bcEra === 0 || expandedYear === 0) {
  console.error(
    '\nThe battery never reached a BC or expanded year. It proves nothing about them.',
  )
  process.exitCode = 1
}
if (mismatches.length > 0 || orphanFailures.length > 0) process.exitCode = 1
if (!process.exitCode) console.log('\nIntl matches Temporal on every checked pair.')

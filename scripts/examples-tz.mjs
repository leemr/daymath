// Run the examples gate under a spread of time zones.
//
// WHY THIS EXISTS. Every `js` fence in the prose files is executed and its stated answer asserted,
// but only ever in one zone — whatever the machine happens to be set to. A claim whose answer moves
// with the zone therefore passes on the author's laptop and fails in CI, or the reverse, and no gate
// in this repo could see it. One shipped in a README draft: `new Date('2026-03-08').getDate()`
// answers 7 behind UTC and 8 at or ahead of it, and it was green on a machine set to New York.
//
// daymath's own answers never depend on the zone — that is most of the point of the package — so a
// difference here is either a defect or a prose claim that should not have been written as a
// literal. Both are worth catching.
//
// THE ZONES ARE CHOSEN, NOT COLLECTED. Each one is fixed all year. A zone that shifts with daylight
// saving would test a different scenario in January than in July, so a defect could hide for six
// months and then fail a run nobody caused. Re-read any candidate before adding it:
//
//   TZ=<zone> node -e "console.log(-new Date('2026-01-15T00:00:00Z').getTimezoneOffset(),
//                                 -new Date('2026-07-15T00:00:00Z').getTimezoneOffset())"
//
// Daylight saving is a second axis and is deliberately NOT covered here. If it is ever wanted, add
// a zone for that reason and say so — `Australia/Lord_Howe` shifts by 30 minutes and
// `Antarctica/Troll` by 120, and both are more interesting than another 60-minute zone.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Fixed offsets, verified 2026-09-12. The first two are the ends of the IANA range, so a claim that
 * holds in both holds in every zone between them. The third is there because the minutes field is
 * not always zero.
 */
const ZONES = [
  ['Etc/GMT+12', 'the furthest zone behind UTC'],
  ['Pacific/Kiritimati', 'the furthest zone ahead of UTC'],
  ['Asia/Kathmandu', 'a quarter-hour offset, so the minutes field is not zero'],
]

// `TZ` is read from the system zoneinfo, which is NOT the table `Intl` uses. ICU still treats the
// pre-2018 spellings as canonical, so `Intl` reports `Asia/Kathmandu` as an alias of
// `Asia/Katmandu`, and `Asia/Kolkata` as an alias of `Asia/Calcutta` — the reverse of current IANA.
// That does not affect this runner, because nothing here goes through `Intl`. Do not "fix" the
// spelling above on the strength of an `Intl.supportedValuesOf('timeZone')` reading.

const gate = fileURLToPath(new URL('./examples.mjs', import.meta.url))

if (process.argv.includes('--write')) {
  console.error(
    'examples-tz: --write belongs to `npm run test:examples:write`, which records the roster in one\n' +
      'zone on purpose. Re-recording it from here would bake whichever zone ran last into the baseline.',
  )
  process.exit(2)
}

let failed = 0

for (const [zone, why] of ZONES) {
  const run = spawnSync(process.execPath, [gate], {
    env: { ...process.env, TZ: zone },
    encoding: 'utf8',
  })

  const output = `${run.stdout}${run.stderr}`.trim()

  if (run.status === 0) {
    console.log(`ok   ${zone} — ${why}`)
  } else {
    failed++
    console.log(`FAIL ${zone} — ${why}`)
    console.log(output.replaceAll(/^/gm, '       '))
  }
}

if (failed) {
  console.log(
    `\nexamples across zones FAIL — ${failed} of ${ZONES.length} zones disagree.\n` +
      'A claim that moves with the zone is not a literal. State it in prose, or assert the part\n' +
      'that does not move.',
  )
  process.exit(1)
}

console.log(
  `\nexamples across zones PASS — every claim answers the same in all ${ZONES.length} zones.`,
)

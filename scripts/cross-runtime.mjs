#!/usr/bin/env node
// Cross-runtime check: does daymath answer identically on every Temporal
// implementation and every JS runtime?
//
// The differential harness compares daymath to date-fns. This compares daymath
// to *itself* somewhere else — Node on the polyfill, Deno, Bun, or a browser on
// native Temporal. Any difference here is an implementation leaking through an
// API whose whole premise is that it does not.
//
// The baseline is a hash per export, not the raw results, so it stays small
// enough to read in a diff. A changed hash names the export; re-run with
// --verbose to see the calls behind it.
//
//   node scripts/cross-runtime.mjs            # check against the baseline
//   node scripts/cross-runtime.mjs --verbose  # show differing calls
//   node scripts/cross-runtime.mjs --write    # re-record the baseline
//
//   deno run -R --node-modules-dir=manual scripts/cross-runtime.mjs
//     =manual reuses the tree npm installed. Plain --node-modules-dir replaces it with symlinks
//     into node_modules/.deno and breaks a local checkout until you re-run `npm ci`.
//   bun scripts/cross-runtime.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Temporal } from 'temporal-polyfill'
import { Temporal as bundledTemporal } from 'temporal-polyfill/full'
import * as dm from '../index.js'
import { hash, run } from './battery.mjs'

const BASELINE = fileURLToPath(new URL('./cross-runtime.baseline.json', import.meta.url))
const write = process.argv.includes('--write')
const verbose = process.argv.includes('--verbose')

// The scripts/** override turns off no-negated-condition. Its autofix inverts
// this into a nested ternary that reads far worse than the flat chain.
const runtime =
  typeof Deno !== 'undefined'
    ? `Deno ${Deno.version.deno}`
    : typeof Bun !== 'undefined'
      ? `Bun ${Bun.version}`
      : `Node ${process.versions.node}`
const temporal = globalThis.Temporal ? 'native Temporal' : 'temporal-polyfill'

// ─── which implementation did daymath SELECT? ───────────────────────
//
// The banner above says what the RUNTIME has. It says nothing about what daymath picked, and that
// gap is exactly how a defect shipped: `index.js` was switched to `temporal-polyfill/full`, whose
// entry does no native selection, so daymath ran the bundled polyfill on Node 26 and Deno while
// this banner still read "native Temporal". Nothing failed. It was found by hand.
//
// So assert the selection, on every lane.
//
// The observable is the message daymath re-throws on `cause`: daymath's own errors carry no Temporal
// text, but the original is kept, and the two implementations word the same failure differently. The
// two expected messages are asked of each implementation at run time rather than hardcoded, so a
// polyfill release that rewords its error cannot make this silently pass.
const OUT_OF_RANGE = '+275761-01-01'

/** @param {{PlainDate: {from(s: string): unknown}}} impl */
function messageFrom(impl) {
  try {
    impl.PlainDate.from(OUT_OF_RANGE)
    return null // it did not throw, so it cannot be used to tell the two apart
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/** What daymath's own error carries from underneath. */
function daymathCause() {
  try {
    dm.parse(OUT_OF_RANGE)
    return null
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined
    return cause instanceof Error ? cause.message : null
  }
}

/** Can this Temporal build a calendar beyond the two every build has? Mirrors index.js. */
function buildsExoticCalendars(candidate) {
  if (candidate?.PlainDate?.from === undefined) return false
  const exotic = Intl.supportedValuesOf('calendar')
    .map((id) => id.toLowerCase())
    .find((id) => id !== 'iso8601' && id !== 'gregory')
  if (exotic === undefined) return true
  try {
    candidate.PlainDate.from('2026-01-31').withCalendar(exotic)
    return true
  } catch {
    return false
  }
}

const globalIsCapable = buildsExoticCalendars(globalThis.Temporal)
const expected = globalIsCapable ? 'native' : 'bundled'
const nativeMessage = globalThis.Temporal ? messageFrom(globalThis.Temporal) : null
const bundledMessage = messageFrom(bundledTemporal)
const causeMessage = daymathCause()

/** What daymath actually picked, or `unknown` when the probe could not tell. */
let selected = 'unknown'

/** @type {string[]} */
const selectionErrors = []
if (causeMessage === null) {
  selectionErrors.push(
    `daymath did not throw on ${OUT_OF_RANGE}, so the selection cannot be read`,
  )
} else if (bundledMessage === null) {
  selectionErrors.push(
    'the bundled polyfill did not throw, so the two cannot be told apart',
  )
} else if (globalIsCapable && nativeMessage === bundledMessage) {
  // Loud rather than green: the probe has gone blind and must be repaired, not trusted.
  selectionErrors.push(
    `native and bundled now word this failure identically (${JSON.stringify(bundledMessage)}), so this check cannot distinguish them any more`,
  )
} else {
  selected = causeMessage === bundledMessage ? 'bundled' : 'native'
  if (selected !== expected) {
    selectionErrors.push(
      `daymath selected the ${selected} implementation where the runtime called for ${expected}` +
        ` (cause ${JSON.stringify(causeMessage)}, bundled says ${JSON.stringify(bundledMessage)})`,
    )
  }
}

// Joined on NUL, which cannot occur in a result. A space could: error
// messages contain spaces, so ["a b","c"] and ["a","b c"] would hash alike.
// Written as an escape and never as a raw byte, or git treats this file as
// binary and stops producing a diff for it.
const SEP = '\u0000'

// `temporal-polyfill` hands back native Temporal where the runtime has it, so
// on Deno these probes carry genuine native PlainDate objects.
const results = run(dm, Temporal.PlainDate)
const names = Object.keys(results)
const hashes = Object.fromEntries(names.map((n) => [n, hash(results[n].join(SEP))]))
const calls = names.length > 0 ? names.length * results[names[0]].length : 0

console.log(`daymath cross-runtime — ${runtime}, ${temporal}`)
console.log(
  `daymath selected the ${selected} implementation, and this runtime calls for ${expected}` +
    (globalIsCapable ? '' : ' (no calendar-capable global Temporal here)'),
)
for (const problem of selectionErrors) console.error(`SELECTION: ${problem}`)
console.log(`${names.length} exports, ${calls} calls\n`)

if (write) {
  writeFileSync(BASELINE, `${JSON.stringify({ calls, hashes }, null, 2)}\n`)
  console.log(`WROTE ${BASELINE}`)
  console.log(
    'Recorded on this runtime. Re-record only when behaviour changes on purpose.',
  )
  process.exit(0)
}

/** @type {{calls: number, hashes: Record<string, string>}} */
let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch {
  console.error('No baseline. Run with --write on Node first.')
  process.exit(1)
}

// A missing or extra export is a failure in its own right: the baseline must
// cover the whole surface, or a silently dropped function would read as a pass.
const missing = Object.keys(baseline.hashes).filter((n) => !(n in hashes))
const extra = names.filter((n) => !(n in baseline.hashes))
const changed = names.filter(
  (n) => n in baseline.hashes && baseline.hashes[n] !== hashes[n],
)

// Names first. `calls` is names.length x rows, so adding or removing an export
// always moves the count too. Reporting the count first would hide *which*
// export appeared or vanished behind a bare arithmetic complaint.
for (const n of missing) console.error(`MISSING export: ${n}`)
for (const n of extra) console.error(`NEW export, not in the baseline: ${n}`)
for (const n of changed) console.error(`DIFFERS: ${n}`)

if (calls !== baseline.calls) {
  console.error(
    `\nFAIL — battery changed: ${baseline.calls} calls recorded, ${calls} now.` +
      (missing.length > 0 || extra.length > 0
        ? ' The export list above explains it.'
        : ' The probe list changed, not the surface.'),
  )
  console.error('Re-record with --write on Node, then re-run every runtime.')
  process.exit(1)
}

if (verbose && changed.length > 0) {
  console.error(
    '\nRe-run --write on a runtime you trust to see the other side; this run shows:',
  )
  for (const n of changed) {
    console.error(`\n${n}:`)
    for (const [i, v] of results[n].entries()) {
      if (i < 6) console.error(`  [${i}] ${v}`)
    }
  }
}

if (missing.length > 0 || extra.length > 0 || changed.length > 0) {
  console.error(
    `\nFAIL — ${changed.length} differ, ${missing.length} missing, ${extra.length} new.`,
  )
  process.exit(1)
}

if (selectionErrors.length > 0) {
  console.error(`\nFAIL — the implementation selection is wrong on ${runtime}.`)
  process.exit(1)
}

console.log(`PASS — all ${names.length} exports match the baseline on ${runtime}.`)

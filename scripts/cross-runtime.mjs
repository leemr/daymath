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
//   deno run -R scripts/cross-runtime.mjs
//   bun scripts/cross-runtime.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Temporal } from 'temporal-polyfill'
import * as dm from '../index.js'
import { hash, run } from './battery.mjs'

const BASELINE = fileURLToPath(new URL('./cross-runtime.baseline.json', import.meta.url))
const write = process.argv.includes('--write')
const verbose = process.argv.includes('--verbose')

const runtime =
  typeof Deno !== 'undefined' ? `Deno ${Deno.version.deno}`
  : typeof Bun !== 'undefined' ? `Bun ${Bun.version}`
  : `Node ${process.versions.node}`
const temporal = globalThis.Temporal ? 'native Temporal' : 'temporal-polyfill'

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
const calls = names.length ? names.length * results[names[0]].length : 0

console.log(`daymath cross-runtime — ${runtime}, ${temporal}`)
console.log(`${names.length} exports, ${calls} calls\n`)

if (write) {
  writeFileSync(BASELINE, `${JSON.stringify({ exports: names.length, calls, hashes }, null, 2)}\n`)
  console.log(`WROTE ${BASELINE}`)
  console.log('Recorded on this runtime. Re-record only when behaviour changes on purpose.')
  process.exit(0)
}

/** @type {{exports: number, calls: number, hashes: Record<string, string>}} */
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
const changed = names.filter((n) => n in baseline.hashes && baseline.hashes[n] !== hashes[n])

// Names first. `calls` is names.length x rows, so adding or removing an export
// always moves the count too. Reporting the count first would hide *which*
// export appeared or vanished behind a bare arithmetic complaint.
for (const n of missing) console.error(`MISSING export: ${n}`)
for (const n of extra) console.error(`NEW export, not in the baseline: ${n}`)
for (const n of changed) console.error(`DIFFERS: ${n}`)

if (calls !== baseline.calls) {
  console.error(
    `\nFAIL — battery changed: ${baseline.calls} calls recorded, ${calls} now.` +
      (missing.length || extra.length
        ? ' The export list above explains it.'
        : ' The probe list changed, not the surface.'),
  )
  console.error('Re-record with --write on Node, then re-run every runtime.')
  process.exit(1)
}

if (verbose && changed.length) {
  console.error('\nRe-run --write on a runtime you trust to see the other side; this run shows:')
  for (const n of changed) {
    console.error(`\n${n}:`)
    for (const [i, v] of results[n].entries()) {
      if (i < 6) console.error(`  [${i}] ${v}`)
    }
  }
}

if (missing.length || extra.length || changed.length) {
  console.error(`\nFAIL — ${changed.length} differ, ${missing.length} missing, ${extra.length} new.`)
  process.exit(1)
}

console.log(`PASS — all ${names.length} exports match the baseline on ${runtime}.`)

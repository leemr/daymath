// Bundle-size A/B for the `fns` port question.
//
// Absolute byte counts do not transfer between experiments — a different import list or a
// different esbuild moves them. Only a comparison made INSIDE one run of this script is
// evidence. So every shape is built here, by one esbuild, in one process.
//
//   node scripts/bundle-size.mjs           # table
//   node scripts/bundle-size.mjs --json    # machine-readable
//   node scripts/bundle-size.mjs --run     # run each fixture first, so a dead program cannot be measured
//   node scripts/bundle-size.mjs --check   # fail if a gated shape grew past the committed baseline
//   node scripts/bundle-size.mjs --write   # rewrite the baseline, deliberately

import { build } from 'esbuild'
import { gzipSync, constants } from 'node:zlib'
import { execFile } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import process from 'node:process'

const execFileAsync = promisify(execFile)
const fixture = (name) =>
  fileURLToPath(new URL(`./bundle/fixtures/${name}`, import.meta.url))

/**
 * Every shape under test. `baseline` names the shape a delta is quoted against.
 *
 * `gate: true` marks the shapes that contain daymath's own code, and only those are enforced.
 * The rest are pure `temporal-polyfill` shapes, so a Dependabot bump would turn them red without
 * anything in this repo having changed. They are still measured and printed.
 */
const SHAPES = [
  { id: 'A', entry: 'a-class-3.mjs', label: 'daymath, 3 calls (today)', gate: true },
  {
    id: 'B',
    entry: 'b-class-all.mjs',
    label: 'daymath, whole surface',
    baseline: 'A',
    gate: true,
  },
  {
    id: 'C',
    entry: 'c-polyfill-only.mjs',
    label: 'temporal-polyfill CLASS build alone, no daymath',
    baseline: 'A',
  },
  {
    id: 'D',
    entry: 'd-fns-strings.mjs',
    label: 'fns/PlainDate, strings out',
    baseline: 'A',
  },
  {
    id: 'E',
    entry: 'e-fns-plaindate.mjs',
    label: 'fns/PlainDate, real PlainDate out',
    baseline: 'D',
  },
  {
    id: 'F',
    entry: 'f-class-3-plus-day.mjs',
    label: 'daymath + day()',
    baseline: 'A',
    gate: true,
  },
  {
    id: 'G',
    entry: 'g-fns-plus-day.mjs',
    label: 'fns + a hand-built day()',
    baseline: 'D',
  },
  {
    id: 'H',
    entry: 'h-fns-calendars-any.mjs',
    label: 'fns, every calendar (getAny)',
    baseline: 'D',
  },
  {
    id: 'I',
    entry: 'i-fns-calendars-buddhist-roc.mjs',
    label: 'fns, ISO + buddhist + roc',
    baseline: 'D',
  },
  { id: 'J', entry: 'j-fns-all.mjs', label: 'fns, whole surface + day()', baseline: 'B' },
  {
    id: 'K',
    entry: 'k-fns-plus-intl-day.mjs',
    label: 'fns + an Intl-only day()',
    baseline: 'G',
  },
  {
    id: 'L',
    entry: 'l-fns-intl-day-plus-zoned.mjs',
    label: 'fns + Intl day(), ZonedDateTime kept for wall time',
    baseline: 'K',
  },
]

/** gzip level 9, stated because the number is meaningless without it. */
const gzipBytes = (text) =>
  gzipSync(text, { level: constants.Z_BEST_COMPRESSION }).byteLength

async function measure(shape) {
  const result = await build({
    entryPoints: [fixture(shape.entry)],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  return { ...shape, min: code.length, gzip: gzipBytes(code) }
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`
const signed = (n) => `${n >= 0 ? '+' : '−'}${kb(Math.abs(n))}`

const pct = (delta, base) => {
  const p = (delta / base) * 100
  return `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(0)}%`
}

const args = new Set(process.argv.slice(2))

if (args.has('--run')) {
  // A shape that throws is not a shape. Prove every fixture works before quoting any size.
  const runs = await Promise.all(
    SHAPES.map((shape) =>
      execFileAsync(process.execPath, [fixture(shape.entry)])
        .then(({ stdout }) => `ran  ${shape.id}  ${stdout.trim().slice(0, 96)}`)
        .catch((error) => {
          process.exitCode = 1
          return `FAIL ${shape.id} ${shape.entry}\n${error.stderr || error.message}`
        }),
    ),
  )
  for (const line of runs) console.log(line)
  if (process.exitCode) process.exit(1)
  console.log('')
}

const rows = await Promise.all(SHAPES.map((shape) => measure(shape)))

const byId = new Map(rows.map((r) => [r.id, r]))

if (args.has('--json')) {
  const out = {
    esbuild: (await import('esbuild')).version,
    node: process.version,
    gzipLevel: 'Z_BEST_COMPRESSION',
    shapes: rows.map(({ id, label, entry, min, gzip, baseline }) => ({
      id,
      label,
      entry,
      min,
      gzip,
      baseline,
    })),
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

console.log(
  `esbuild ${(await import('esbuild')).version} · minified ESM browser · gzip level 9 · node ${process.version}\n`,
)
console.log('| # | shape | min | gzip | vs | Δ gzip |')
console.log('|---|---|---:|---:|---|---:|')
for (const row of rows) {
  const base = row.baseline ? byId.get(row.baseline) : undefined
  const delta = base
    ? `${signed(row.gzip - base.gzip)} (${pct(row.gzip - base.gzip, base.gzip)})`
    : '—'
  console.log(
    `| ${row.id} | ${row.label} | ${kb(row.min)} | **${kb(row.gzip)}** | ${row.baseline ?? '—'} | ${delta} |`,
  )
}

// ---------------------------------------------------------------------------------------------
// The gate. A one-time cut is not a baseline; this is what keeps the bytes where they are.
// ---------------------------------------------------------------------------------------------

const BASELINE_PATH = fileURLToPath(
  new URL('./bundle-size.baseline.json', import.meta.url),
)

// A minifier or gzip patch release moves a few bytes without anyone touching daymath. Enforce a
// band, not an exact number, or every unrelated bump reads as a size regression.
const TOLERANCE_FRACTION = 0.01
const TOLERANCE_FLOOR = 128

if (args.has('--write')) {
  const out = {
    '//': 'Committed size baseline. Regenerate deliberately: npm run size:write',
    esbuild: (await import('esbuild')).version,
    gzipLevel: 'Z_BEST_COMPRESSION',
    gated: Object.fromEntries(rows.filter((r) => r.gate).map((r) => [r.id, r.gzip])),
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(out, null, 2)}\n`)
  console.log(`wrote ${BASELINE_PATH}`)
  for (const [id, gzip] of Object.entries(out.gated))
    console.log(`  ${id} ${gzip} B gzip`)
  process.exit(0)
}

if (args.has('--check')) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const gated = rows.filter((r) => r.gate)
  let failed = 0

  for (const row of gated) {
    const want = baseline.gated[row.id]
    if (want === undefined) {
      console.error(
        `FAIL ${row.id} is gated but absent from the baseline. Run npm run size:write.`,
      )
      failed++
      continue
    }
    const allowed = Math.max(TOLERANCE_FLOOR, Math.round(want * TOLERANCE_FRACTION))
    const delta = row.gzip - want
    const verdict = Math.abs(delta) <= allowed ? 'ok  ' : 'FAIL'
    if (verdict === 'FAIL') failed++
    console.log(
      `${verdict} ${row.id} ${row.label}: ${row.gzip} B gzip, baseline ${want} B, ${signed(delta)} (±${allowed} B allowed)`,
    )
  }

  // A shape that quietly stops being gated is the same hole as a required check that never reports.
  const extra = Object.keys(baseline.gated).filter(
    (id) => !gated.some((r) => r.id === id),
  )
  for (const id of extra) {
    console.error(`FAIL baseline gates ${id}, but no shape claims it any more.`)
    failed++
  }

  if (baseline.esbuild !== (await import('esbuild')).version) {
    console.log(
      `note esbuild is ${(await import('esbuild')).version}, baseline was taken on ${baseline.esbuild}.`,
    )
  }

  if (failed) {
    console.error(
      `\n${failed} gated shape(s) moved. If the change is intended, run npm run size:write and say why in the commit.`,
    )
    process.exit(1)
  }
  console.log(`\n${gated.length} gated shapes are within tolerance.`)
  process.exit(0)
}

const a = byId.get('A')
const d = byId.get('D')
const f = byId.get('F')
const g = byId.get('G')
const k = byId.get('K')
const l = byId.get('L')
console.log('')
// Every line below is computed from THIS run. The class-API number this port replaced was
// 24,735 B, and it is deliberately not quoted here: it came from a different run, and the rule at
// the top of this file is that only a comparison made inside one run is evidence. CHANGELOG.md and
// README.md carry the before-and-after, where a stamped date makes the mixed toolchain visible.
//
// No model of the port lives here, and one must not be added back. Two did, to price the port
// before it was paid, and both under-stated the real bundle, because a fixture reaches less of the
// fns surface than daymath does. Shape A measures the real thing.
//
// D stays a floor nobody can build: it carries no calendars and no clock door.
console.log(
  // `kb`, not `signed`: this is a saving, so a leading + or − in front of the word "save" reads
  // as the opposite of what it is.
  `Rebuilding day() on Intl would save ${kb(l.gzip - k.gzip)} (K against L) and costs the five orphan days.`,
)
console.log(
  `Dropping the calendars and day() would be ${signed(d.gzip - a.gzip)}, but that is shape D and not an offer.`,
)
console.log(
  `day() costs ${signed(f.gzip - a.gzip)} in daymath and ${signed(g.gzip - d.gzip)} in a bare fns program.`,
)

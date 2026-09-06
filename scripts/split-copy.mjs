#!/usr/bin/env node
// Does daymath still tell the truth when Temporal itself is broken?
//
// jsDelivr's `+esm` endpoint builds each subpath of a dependency as its own bundle, with its own
// private copy of that package's internals. daymath's `temporal-polyfill/fns/PlainDate` and
// `temporal-polyfill/fns/Calendar` then come from two copies, the brand check on the calendar
// record fails, and every call throws `TypeError: Invalid calling context`. The page was dead for
// three releases and every gate in this repo stayed green, because the defect is not in this repo.
//
// `scripts/demo-page.mjs` catches that shape, but only over the network, only for the ops the demo
// page offers, and only once a broken build is already published. This gate builds the same shape
// on disk from `node_modules`, so it runs offline, covers any export, and fails BEFORE a release.
//
// The law it checks is one line: **a broken implementation must never make daymath answer wrongly
// or blame the caller.** Each call either agrees with the local source or throws a `TypeError`. A
// `RangeError` is the failure this gate exists to catch, because that is daymath saying the input
// was bad when the input was fine. A wrong answer is worse still, and `isValid` gave one.
//
// Two phases, one law. The first builds the CDN shape. The second raises the same fault from one
// import at a time, because the CDN shape cannot reach every catch: a call taking no calendar
// resolver passes no record between copies, so a split leaves it alone however the bundles fall.
// Modelling the RULE instead of the one CDN reaches all of them, and it keeps reaching a catch
// added later, since the import roster is read out of `index.js` rather than written down here.
//
//   node scripts/split-copy.mjs

import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import process from 'node:process'
import * as local from '../index.js'

const SOURCE = fileURLToPath(new URL('../index.js', import.meta.url))

// Every call the roster makes, named by what it exercises. One per narrowed catch in index.js,
// plus the plain arithmetic a reader would try first.
const CALLS = [
  ['parse', ['2026-01-01']],
  ['parse', ['2026-01-31[u-ca=buddhist]']],
  ['isValid', ['2026-01-01']],
  ['isValid', ['2026-01-31[u-ca=buddhist]']],
  ['addDays', ['2026-01-01', 7]],
  ['addMonths', ['2026-01-31', 1]],
  ['startOfMonth', ['2026-01-15']],
  ['endOfYear', ['2026-01-15']],
  ['startOfWeek', ['2026-08-05']],
  ['isSameWeek', ['2026-08-05', '2026-08-06']],
  ['differenceInDays', ['2026-03-01', '2026-01-01']],
  ['eachMonthOfInterval', [{ start: '2026-01-01', end: '2026-03-01' }]],
  ['day', ['2026-01-01T00:00:00Z']],
  ['day', ['2026-01-01T09:00:00[America/New_York]']],
  ['day', [0, 'America/New_York']],
  ['getDay', ['2026-01-01']],
]

const problems = []
const fail = (msg) => problems.push(msg)

// ─── build the split ────────────────────────────────────────────────────────
// Real copies of the package on disk, not a stand-in object. The fault is a brand check between
// two copies, so the gate builds copies. `fns` and `chunks` are all a subpath reaches, and
// `package.json` is what makes each copy's own bare specifiers resolve.
const root = mkdtempSync(join(tmpdir(), 'daymath-split-'))
const packageRoot = dirname(
  dirname(fileURLToPath(import.meta.resolve('temporal-polyfill/fns/Calendar'))),
)
// Every subpath gets its own copy, not just one, because that is what `+esm` produces: five
// bundles that share nothing. Splitting a single subpath would prove only the first site the call
// reaches, and the roster would then pass over the narrowings behind it.
let copies = 0
const foreign = (name) => {
  const dir = join(root, `copy-${name}`, 'temporal-polyfill')
  for (const part of ['package.json', 'fns', 'chunks']) {
    cpSync(join(packageRoot, part), join(dir, part), { recursive: true })
  }
  copies += 1
  return pathToFileURL(join(dir, 'fns', `${name}.js`)).href
}
// Each copy keeps its own `temporal-polyfill` internals and SHARES everything below them, which is
// the shape that matters: the brand check lives in `chunks`, so duplicating those is what splits
// the record. A link rather than more copies, so the gate stays fast and touches no real tree.
symlinkSync(dirname(packageRoot), join(root, 'node_modules'), 'dir')

// The source is rewritten, never edited. Every bare specifier becomes a file inside its own copy,
// which is why the temp directory needs no package of its own.
const rawSource = readFileSync(SOURCE, 'utf8')
const rewritten = rawSource.replaceAll(/'temporal-polyfill\/fns\/(\w+)'/g, (_, name) =>
  JSON.stringify(foreign(name)),
)
if (copies === 0) {
  fail('the rewrite matched no `temporal-polyfill/fns/*` import in index.js')
}

const splitFile = join(root, 'daymath-split.mjs')
writeFileSync(splitFile, rewritten)

// ─── run the roster ─────────────────────────────────────────────────────────
const attempt = (fn) => {
  try {
    return { answer: JSON.stringify(fn()) }
  } catch (err) {
    return { thrown: err }
  }
}

// One law, both phases. `where` names the broken build, so a failure says which one produced it.
// A module that refuses to LOAD is a legal outcome and reports `loaded: false`: it is loud, nothing
// answers wrongly, and the caller counts it so the run can say how much it really covered.
//
// The findings are RETURNED rather than pushed, because phase two judges its builds in parallel.
// Pushing from inside would order the report by whichever import finished first, and a report that
// reorders itself between runs is a report nobody can diff.
async function judge(where, file) {
  const found = []
  const fail = (msg) => found.push(msg)
  let broken
  try {
    broken = await import(pathToFileURL(file).href)
  } catch {
    return { loaded: false, found }
  }
  for (const [op, args] of CALLS) {
    const shown = `${op}(${args.map((a) => JSON.stringify(a)).join(', ')})`
    const want = attempt(() => local[op](...args))
    const got = attempt(() => broken[op](...args))

    if (want.thrown) {
      fail(`${shown} throws on the local source, so the roster cannot judge ${where}
    source: ${want.thrown.constructor.name}: ${want.thrown.message}`)
      continue
    }
    if (got.answer === want.answer) continue
    if (got.answer !== undefined) {
      fail(`${where}: ${shown} answered, and it disagrees with the source
    source: ${want.answer}
    broken: ${got.answer}`)
      continue
    }
    if (!(got.thrown instanceof TypeError)) {
      fail(`${where}: ${shown} blames the caller for a broken implementation
    source: ${want.answer}
    broken: ${got.thrown.constructor.name}: ${got.thrown.message}`)
    }
  }
  return { loaded: true, found }
}

if (problems.length === 0) {
  const phaseOne = await judge('the split build', splitFile)
  problems.push(...phaseOne.found)
  if (!phaseOne.loaded) {
    fail('the split build threw while loading, so no export was checked')
  }
}

// ─── phase two: raise a TypeError from one import at a time ─────────────────
// The split reaches most of the narrowed catches and it cannot reach them all. The `Instant` parse
// and the `ZonedDateTime` zone probe take no calendar resolver, so no record crosses between copies
// and neither call breaks under a split however the bundles fall. Their narrowing would then be
// code no gate ever runs, which is how a catch-all gets re-introduced by a later edit.
//
// So the second phase stops modelling one CDN and models the rule instead: ANY import can fault,
// and daymath owes the same answer either way. Each named import is replaced in turn by one that
// raises the fault the real split raises. Nothing here is hand-listed — the roster of imports is
// read out of `index.js`, so an import added later joins this phase without an edit.
const NAMESPACES = [
  ...rawSource.matchAll(/import \* as (\w+) from 'temporal-polyfill\/fns\/(\w+)'/g),
].map(([, alias, subpath]) => ({ alias, subpath }))
const NAMED = [
  ...rawSource.matchAll(/import \{ ([\w,\s]+) \} from 'temporal-polyfill\/fns\/(\w+)'/g),
].flatMap(([, names, subpath]) =>
  names.split(',').map((name) => ({ name: name.trim(), subpath })),
)

// A namespace member only counts when `index.js` calls it. A named import always counts: it is
// named because it is used, and `getAny` is passed as a value rather than called here.
const INJECTIONS = [
  ...NAMESPACES.flatMap(({ alias, subpath }) =>
    [
      ...new Set(
        [...rawSource.matchAll(new RegExp(`\\b${alias}\\.(\\w+)\\(`, 'g'))].map(
          ([, name]) => name,
        ),
      ),
    ].map((name) => ({ name, subpath })),
  ),
  ...NAMED,
]
if (INJECTIONS.length === 0) {
  fail('no `temporal-polyfill/fns` import was read out of index.js')
}

// Written first, judged after. Each build is an independent module graph, so they load together.
const VARIANTS = INJECTIONS.map(({ name, subpath }) => {
  // `export *` skips a name the module exports itself, so the override wins and every other export
  // stays real. That keeps the fault to ONE function, which is what makes the failure readable.
  const stub = join(root, `stub-${subpath}-${name}.mjs`)
  writeFileSync(
    stub,
    `export * from ${JSON.stringify(import.meta.resolve(`temporal-polyfill/fns/${subpath}`))}\n` +
      `export function ${name}() { throw new TypeError('Invalid calling context') }\n`,
  )
  const file = join(root, `daymath-${subpath}-${name}.mjs`)
  writeFileSync(
    file,
    rawSource.replaceAll(/'temporal-polyfill\/fns\/(\w+)'/g, (_, other) =>
      JSON.stringify(
        other === subpath
          ? pathToFileURL(stub).href
          : import.meta.resolve(`temporal-polyfill/fns/${other}`),
      ),
    ),
  )
  return { where: `${subpath}.${name} faulting`, file }
})

const verdicts = await Promise.all(VARIANTS.map(({ where, file }) => judge(where, file)))
const reached = verdicts.filter(({ loaded }) => loaded).length
for (const { found } of verdicts) problems.push(...found)

// ─── verdict ────────────────────────────────────────────────────────────────
rmSync(root, { recursive: true, force: true })
if (problems.length > 0) {
  console.error(`\nsplit copy FAIL — ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  A CDN can serve this shape today. Every one of these reaches a reader as a lie.',
  )
  process.exit(1)
}
// The load count is reported because a faulting import can refuse to load, and a run that only
// ever refused to load has checked nothing. `getAny` is one: `index.js` calls it at module scope.
console.log(
  `split copy PASS — ${CALLS.length} calls against the split build and against ${reached} of ${INJECTIONS.length} faulting imports, none answered wrongly and none blamed the caller`,
)

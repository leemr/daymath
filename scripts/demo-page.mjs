#!/usr/bin/env node
// Does the module the GitHub Pages demo actually loads still work?
//
// Every other gate reads this repo's source. This one reads the PUBLISHED package as a CDN
// rebuilds and serves it, which is a different artifact and can fail on its own. It did:
// jsDelivr's `+esm` endpoint builds each subpath of a dependency as a separate bundle with its
// own private copy of that package's internals, so daymath's `temporal-polyfill/fns/PlainDate`
// and `temporal-polyfill/fns/Calendar` came from two copies and every date threw
// `TypeError: Invalid calling context`. Source was green throughout, and the page was dead for
// three releases. Nothing in this repo could see it, because the defect was not in this repo.
//
// The oracle is the local source. A published build that disagrees with `../index.js` on plain
// day arithmetic is broken, not merely older: these calls are the library's oldest settled
// behaviour, and changing one would be a breaking change with its own release. A failure prints
// every URL the graph resolved to, which is what names the build that produced it.
//
// It needs the network, so it is NOT part of `npm test` and not part of `ci`. The `demo-page`
// workflow runs it weekly, on demand, and when the page or this file changes on master. Run it by
// hand after a release. A red run means the live page is broken for everyone.
//
//   node scripts/demo-page.mjs            # check the page's own URL
//   node scripts/demo-page.mjs --url <u>  # check some other build, e.g. a CDN under evaluation

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import process from 'node:process'
import * as local from '../index.js'

const PAGE = fileURLToPath(new URL('../docs/index.html', import.meta.url))
const urlFlag = process.argv.indexOf('--url')

// Which ops take an amount, and which take a second day. The page is the source of truth for WHICH
// ops exist; this only says how to call each one. Both of the page's own rosters are compared to
// this one below, so a page change fails the gate until it is named here.
const CALL = {
  addDays: 'amount',
  subDays: 'amount',
  addWeeks: 'amount',
  addMonths: 'amount',
  addYears: 'amount',
  startOfMonth: 'day',
  endOfMonth: 'day',
  startOfWeek: 'day',
  endOfWeek: 'day',
  isWeekend: 'day',
  getDay: 'day',
  differenceInDays: 'other',
}
const OTHER_DAY = '2026-01-01'
// `-7` is not a mirror of `7`. `addMonths('2026-01-31', -7)` clamps and `+7` does not, on a day
// the page itself ships. `0` is the falsy boundary.
const AMOUNTS = [7, -7, 0]

const html = readFileSync(PAGE, 'utf8')
const problems = []
const fail = (msg) => problems.push(msg)

// ─── read the page, so this gate tracks it instead of a copy of it ──────────
const urlMatch = html.match(/import \* as daymath from '([^']+)'/)
if (!urlMatch) fail('no `import * as daymath from ...` line in docs/index.html')
const url = urlFlag === -1 ? urlMatch?.[1] : process.argv[urlFlag + 1]

// Two rosters, because the page can drift in two independent ways. A `<option>` with no `case`
// renders in the dropdown and answers "Unknown op", and a `case` with no `<option>` is dead code.
const ops = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1])
const cases = [...html.matchAll(/case '([^']+)':/g)].map((m) => m[1])
const presets = [...html.matchAll(/data-preset="([^"]+)"/g)].map((m) => m[1])
const defaultDay = html.match(/id="date" type="text" value="([^"]+)"/)?.[1]

if (ops.length === 0) fail('no <option value> ops found in docs/index.html')
if (presets.length === 0) fail('no data-preset buttons found in docs/index.html')
if (!defaultDay) fail('no default day found on the #date input in docs/index.html')

const known = Object.keys(CALL)
for (const [label, roster] of [
  ['offers', ops],
  ['switches on', cases],
]) {
  for (const op of roster) {
    if (!known.includes(op))
      fail(`the page ${label} \`${op}\` and this gate does not call it`)
  }
  for (const op of known) {
    if (!roster.includes(op))
      fail(`this gate calls \`${op}\` and the page no longer ${label} it`)
  }
}

// ─── load what the page loads ───────────────────────────────────────────────
// Node refuses to `import()` an https URL, so the graph is mirrored to disk first, following
// every specifier the way a browser would. Mirroring rather than concatenating is the point:
// each module stays its own file, so if a CDN hands out two copies of one package, this loads
// two copies too, and the bug reproduces here exactly as it does in the browser.
//
// The cache holds the in-flight PROMISE, not the finished path, so one URL is fetched once even
// when several modules import it at the same moment.
const cache = new Map()
const graph = []
function mirror(href, root) {
  const hit = cache.get(href)
  if (hit) return hit
  const pending = fetchInto(href, root)
  cache.set(href, pending)
  return pending
}
async function fetchInto(href, root) {
  const res = await fetch(href, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${href}`)
  const base = res.url
  graph.push(base)
  let src = await res.text()
  // Named by a hash of the resolved URL, so one URL is one file and two URLs are two files.
  // That identity is the whole mechanism: duplicate copies stay duplicated. The hash carries no
  // path separator, so every mirrored module is a flat sibling inside `root`.
  const self = join(root, createHash('sha256').update(base).digest('hex') + '.mjs')
  // Only what can legally sit between `import`/`export` and its specifier: names, braces, commas,
  // a star, an `as`, and whitespace. A looser gap matches `export function f() { throw Error("x") }`
  // and then tries to fetch "x", which is a false failure this gate reported once already.
  const specs = [
    ...src.matchAll(
      /(?:^|[\s;}])(?:import|export)\s*(?:[\w*{},\s$]*?from\s*)?['"]([^'"]+)['"]/g,
    ),
  ]
  const deps = await Promise.all(
    specs.map(async ([, spec]) => [spec, await mirror(new URL(spec, base).href, root)]),
  )
  for (const [spec, dep] of deps) {
    const rel = relative(dirname(self), dep)
    src = src.split(`"${spec}"`).join(`"./${rel}"`).split(`'${spec}'`).join(`'./${rel}'`)
  }
  writeFileSync(self, src)
  return self
}

// A bare `await import` of a dead URL throws something unhelpful about the module graph, so the
// failure is caught and reported as the network fact it is. It never degrades into a pass.
let remote
let root
if (problems.length === 0) {
  root = mkdtempSync(join(tmpdir(), 'daymath-demo-'))
  try {
    remote = await import(pathToFileURL(await mirror(url, root)).href)
  } catch (err) {
    fail(`could not load ${url}\n    ${err.message}`)
  }
}

// ─── every op the page offers must answer, and answer what the source answers ─
// A throw is compared by CLASS and reported with its message. The class is behaviour and a
// published build changing it is a real difference. The wording is not, and comparing wording
// made two builds that agreed report as broken.
const attempt = (fn) => {
  try {
    const value = fn()
    return { key: JSON.stringify(value), show: JSON.stringify(value) }
  } catch (err) {
    return {
      key: `throws ${err.constructor.name}`,
      show: `throws ${err.constructor.name}: ${err.message}`,
    }
  }
}

if (remote) {
  for (const op of ops) {
    if (typeof remote[op] !== 'function') {
      fail(`\`${op}\` is not a function on ${url}`)
      continue
    }
    for (const day of [defaultDay, ...presets]) {
      const args =
        CALL[op] === 'amount'
          ? AMOUNTS.map((n) => [day, n])
          : CALL[op] === 'other'
            ? [[day, OTHER_DAY]]
            : [[day]]
      for (const call of args) {
        const shown = `${op}(${call.map((a) => JSON.stringify(a)).join(', ')})`
        const want = attempt(() => local[op](...call))
        const got = attempt(() => remote[op](...call))
        if (got.key !== want.key) {
          fail(`${shown}\n    source: ${want.show}\n    ${url}: ${got.show}`)
        }
      }
    }
  }
}

// ─── verdict ────────────────────────────────────────────────────────────────
if (root) rmSync(root, { recursive: true, force: true })
const where = url ?? 'docs/index.html'
if (problems.length > 0) {
  console.error(`\ndemo page FAIL — ${problems.length} problem(s) against ${where}:\n`)
  for (const p of problems) console.error(`  ${p}`)
  if (graph.length > 0) {
    console.error('\n  the graph it loaded, which names the build:')
    for (const g of graph) console.error(`    ${g}`)
  }
  console.error(
    '\n  The page is what a visitor loads, so a red run here means it is broken live.',
  )
  process.exit(1)
}
console.log(
  `demo page PASS — ${ops.length} ops agree with the source, loaded from ${where}`,
)

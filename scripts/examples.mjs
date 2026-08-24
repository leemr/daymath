// Every `@example` in index.d.ts and index.js is EXECUTED and its stated answer asserted.
//
// This exists because a documented example is the one claim no other gate reads. `tsc` type-checks
// the declarations and ignores the comments; the differential harness compares daymath to date-fns
// and never opens a JSDoc block; the cross-runtime battery enumerates exports, not documentation.
// So an example could go stale on any behaviour change and every gate would stay green — and the
// example is the thing a caller copies. `index.d.ts` is also the ONLY file an editor reads for
// documentation, because `package.json` declares one types path, so a wrong line there is the most
// expensive kind of wrong.
//
// The contract is the comment. `@example <expression> // <expected>` asserts that the expression
// evaluates to the literal on the right, or throws the named error class:
//
//   @example getMonth('2026-08-08') // 8
//   @example isValid(new Date())    // throws TypeError, not false
//   @example eachDayOfInterval({ start: 'a', end: 'b' })
//   // ['a', 'b']                                    <-- a continuation line, no @example tag
//
// A line whose comment is prose rather than a literal is SKIPPED and counted, not silently
// dropped: `day()` reads a clock and `day(row.createdAt)` names a variable no probe has, so
// neither can be asserted. Every `@example` therefore lands in exactly one of three buckets —
// asserted, skipped with a printed reason, or unaccounted — and unaccounted is a failure.
//
// `FLOOR` is the last guard, and it is the one that matters most: without it a broken collector
// or a renamed file reports PASS over zero examples and exits 0, which is this gate quietly
// disarming itself. All four behaviours are proved by planting, not assumed.
//
//   node scripts/examples.mjs
import { readFileSync } from 'node:fs'
import * as dm from '../index.js'

const FILES = ['index.d.ts', 'index.js']

/** Everything an example may reference, so the expression can be evaluated as written. */
const scope = { ...dm }

/**
 * Pull `@example` lines out of a source file, joining a bare `// …` continuation onto the
 * expression above it. Returns `{ file, line, expr, expected }`.
 * @param {string} file
 */
function collect(file) {
  const lines = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n')
  /** @type {{file: string, line: number, expr: string, expected: string}[]} */
  const found = []
  for (let i = 0; i < lines.length; i++) {
    const tag = /^\s*\*\s*@example\s+(.*)$/u.exec(lines[i])
    if (tag === null) continue
    let body = tag[1]
    // A continuation is the next comment line with no tag and no code, starting with `//`.
    const next = /^\s*\*\s*(\/\/.*)$/u.exec(lines[i + 1] ?? '')
    if (next !== null && !body.includes('//')) body = `${body} ${next[1]}`
    const cut = body.lastIndexOf('//')
    // An example with no `//` answer is REPORTED, not dropped. Skipping it here would put it in
    // no bucket at all, which is the one outcome this script must never produce.
    found.push({
      file,
      line: i + 1,
      expr: (cut === -1 ? body : body.slice(0, cut)).trim(),
      expected: cut === -1 ? null : body.slice(cut + 2).trim(),
    })
  }
  return found
}

/**
 * Is the stated answer a literal this script can compare against, or prose?
 * Prose is a legitimate answer for `day()`, which reads a clock.
 *
 * Called on the output of `literalOf`, never on the raw comment, so the trailing-prose case is
 * already stripped and the whole string can be matched.
 * @param {string} expected
 */
function assertable(expected) {
  if (/^throws\s+\w*Error/u.test(expected)) return true
  return /^(['[{]|-?\d|true$|false$)/u.test(expected)
}

/**
 * The literal part of the comment, before any trailing prose.
 *
 * Two spaces or an em dash separate a literal from a note. A bare word after ONE space counts too,
 * so `// true same day` still asserts: a boolean or `null` reaches the end of its own literal at
 * the first space, and treating that as prose would silently drop an assertable example.
 * @param {string} expected
 */
function literalOf(expected) {
  const head = expected.split(/\s{2,}|\s+—\s+/u)[0].trim()
  return /^(true|false|null|undefined|NaN)\b/u.exec(head)?.[1] ?? head
}

// A FLOOR, because a gate that can quietly find nothing is not a gate. Rename a file, reflow a
// comment, or break the regex, and without this the run reports PASS over zero examples and exits
// 0. The number only has to move when examples are deliberately added or removed.
const FLOOR = 40

let asserted = 0
const skipped = []
const failures = []
/** `@example` lines seen but placed in no bucket. Must stay zero, or the accounting has a hole. */
let unaccounted = 0

for (const file of FILES) {
  for (const ex of collect(file)) {
    const where = `${ex.file}:${ex.line}`
    if (ex.expected === null) {
      unaccounted++
      failures.push(
        `${where}  ${ex.expr}\n    has no // answer, so nothing can be checked`,
      )
      continue
    }
    // The caller-variable test runs FIRST, so the skip reason names the real cause. Ordered the
    // other way it is unreachable, because every such example happens to carry prose today — and
    // it would then mis-report the day a literal one is written.
    if (/\b(row|zdt)\b/u.test(ex.expr)) {
      skipped.push(`${where}  ${ex.expr}  // ${ex.expected}  [needs a caller variable]`)
      continue
    }
    // literalOf before assertable, so trailing prose after a literal does not hide the literal.
    // Skipping an example that COULD be asserted is the failure mode this script exists to
    // prevent, so the split accepts ONE space before prose as well as two.
    if (!assertable(literalOf(ex.expected))) {
      skipped.push(`${where}  ${ex.expr}  // ${ex.expected}  [prose, not a literal]`)
      continue
    }
    const thrown = /^throws\s+(\w*Error)/u.exec(ex.expected)
    // `new Function` is the point rather than a shortcut: the example has to run EXACTLY as it is
    // written, or the check is of a paraphrase and not of the documentation. The input is this
    // repository's own committed source comments, never caller data, and this script is a dev
    // gate that ships in no tarball — `package.json:files` lists index.js, index.d.ts and README.
    const run = new Function(...Object.keys(scope), `return (${ex.expr})`)
    if (thrown !== null) {
      let raised = null
      try {
        run(...Object.values(scope))
      } catch (err) {
        raised = err
      }
      asserted++
      if (raised === null) {
        failures.push(
          `${where}  ${ex.expr}\n    expected to throw ${thrown[1]}, but it returned`,
        )
      } else if (raised.constructor.name !== thrown[1]) {
        failures.push(
          `${where}  ${ex.expr}\n    expected ${thrown[1]}, threw ${raised.constructor.name}`,
        )
      }
      continue
    }
    const want = literalOf(ex.expected)
    let got
    try {
      got = run(...Object.values(scope))
    } catch (err) {
      asserted++
      failures.push(`${where}  ${ex.expr}\n    expected ${want}, threw ${err.message}`)
      continue
    }
    asserted++
    // Compare through the comment's own spelling: single quotes and spaced arrays are how the
    // examples are written, and JSON is how the value serialises.
    const canon = (s) => s.replaceAll("'", '"').replaceAll(', ', ',').trim()
    if (canon(JSON.stringify(got) ?? 'undefined') !== canon(want)) {
      failures.push(
        `${where}  ${ex.expr}\n    expected ${want}, got ${JSON.stringify(got)}`,
      )
    }
  }
}

console.log(
  `daymath examples — ${asserted} asserted, ${skipped.length} not assertable, ${unaccounted} unaccounted\n`,
)
for (const s of skipped) console.log(`  skip  ${s}`)

if (asserted < FLOOR) {
  failures.push(
    `only ${asserted} examples were asserted, and the floor is ${FLOOR}\n` +
      `    Either examples were removed on purpose — then lower FLOOR in this file — or the\n` +
      `    collector stopped finding them, which is this gate silently disarming itself.`,
  )
}

if (failures.length > 0) {
  console.error(
    `\nFAIL — ${failures.length} example(s) do not match what the code answers:\n`,
  )
  for (const f of failures) console.error(`  ${f}`)
  process.exitCode = 1
} else {
  console.log(`\nPASS — every assertable example answers exactly what it claims.`)
}

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
// Three guards stop the gate disarming itself, and each exists because it DID. The ACCOUNTING
// check fails when a file reads back fewer claims than it has written. `SKIP_CEILING` catches the
// other direction, a checked claim downgraded to prose, which the accounting cannot see because
// the written total does not move. `NO_EXAMPLE_NEEDED` fails a declaration that carries no example
// at all, because the release notes claim there are none. Each is documented where it is enforced.
// Every behaviour here is proved by planting the defect, never assumed.
//
//   node scripts/examples.mjs
import { readFileSync } from 'node:fs'
import * as dm from '../index.js'

const FILES = ['index.d.ts', 'index.js']

// `README.md` is checked too, and it is the file that most needed it: it ships in the tarball, it
// is what a developer reads first, and three of its `day()` lines had silently rotted before this
// script existed. Fixing those three closed the instances; reading the file closes the class.
//
// A claim here is any line inside a ```js fence that carries a `//`. A line without one is a
// statement and not a claim, so it is not counted. Everything WITH one must land in a bucket.
const PROSE_FILES = ['README.md']

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
    // Two shapes, and missing the second one is what the accounting guard below caught. A
    // multi-line block puts the tag behind a leading `*`; a one-line block `/** … @example … */`
    // has no leading `*` at all, and its trailing `*/` has to come off or it lands inside the
    // expected value.
    const tag = /^\s*(?:\*|\/\*\*)?[^@]*@example\s+(.*?)(?:\s*\*\/)?$/u.exec(lines[i])
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
 * Pull `expression // expected` claims out of the ```js fences in a Markdown file.
 *
 * Only fenced `js` is read, so a ```bash block cannot be mistaken for a claim. A line that cannot
 * be evaluated — a declaration, an `import` — is still REPORTED as a skip when it carries an
 * answer, because a claim that lands in no bucket is invisible to every check here.
 * @param {string} file
 */
function collectFenced(file) {
  const lines = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n')
  /** @type {{file: string, line: number, expr: string, expected: string|null}[]} */
  const found = []
  let inJs = false
  for (let i = 0; i < lines.length; i++) {
    const fence = /^```(\w*)\s*$/u.exec(lines[i])
    if (fence !== null) {
      inJs = fence[1] === 'js' ? !inJs : false
      continue
    }
    if (!inJs) continue
    const line = lines[i]
    let body = line
    let cut = line.indexOf('//')
    // A claim may be written across two lines, with the answer on a bare `// …` below the
    // expression. `collect` already joins that shape and this did not, so a two-line README claim
    // landed in NO bucket — not asserted, not skipped, and invisible to the accounting because
    // both of its totals come from this same function. That is the one outcome this gate exists
    // to prevent, so the join is here too.
    if (cut === -1) {
      const next = /^\s*(\/\/.*)$/u.exec(lines[i + 1] ?? '')
      if (next === null || line.trim() === '') continue
      body = `${line} ${next[1]}`
      cut = body.indexOf('//')
    }
    const expr = body.slice(0, cut).trim()
    if (expr === '') continue
    // A declaration or a bare keyword line is setup, not a claim: `new Function('return
    // (const x = …)')` is a syntax error, so it cannot be evaluated. It can still CARRY an answer,
    // and dropping it silently is the same hole as above, so it goes to the skip bucket by reason.
    const setup = /^(import|export|const|let|var|function|return|if|for)\b/u.test(expr)
    found.push({ file, line: i + 1, expr, expected: body.slice(cut + 2).trim(), setup })
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
 * Two spaces or an em dash separate a literal from a note, and that is the ONLY split. A boolean
 * gets one extra step, because `true` and `false` end at their own first space: `// true same day`
 * still asserts, where treating it as prose would silently drop a checkable example. Nothing else
 * is extracted that way — an array literal contains spaces, so cutting at the first one would
 * truncate it. A number or string written with one space before its note therefore fails LOUDLY,
 * which is the safe direction: `assertable` only ever sees the head of the literal.
 * @param {string} expected
 */
function literalOf(expected) {
  const head = expected.split(/\s{2,}|\s+—\s+/u)[0].trim()
  return /^(true|false)\b/u.exec(head)?.[1] ?? head
}

// A CEILING on skips, not a floor on assertions, and the difference is maintenance. A floor fires
// whenever an example is legitimately added or deleted, so it needs a bump for an ordinary edit.
// What it is really there to catch is a DOWNGRADE: a literal quietly becoming prose, which moves a
// tag from asserted to skipped while the written total does not change — so the accounting check
// above cannot see it. A ceiling catches that, and stays correct when examples are added or
// removed. It only moves when a claim genuinely becomes uncheckable, which needs a reason. The
// current skips are three honest classes: a clock-dependent answer that cannot be a literal
// (`day()` and friends), an expression naming a variable the reader has and the probe does not,
// and a README line whose comment is deliberately prose. Raising this without naming a new class
// is how the gate rots.
//
// Raised 25 to 28 when `collectFenced` learned the two-line claim shape and stopped dropping
// declaration lines. Those three README claims were always unchecked; they were invisible before
// and they are printed now. No claim moved from checked to unchecked.
const SKIP_CEILING = 28

let asserted = 0
const skipped = []
const failures = []
/** `@example` lines seen but placed in no bucket. Must stay zero, or the accounting has a hole. */
let unaccounted = 0

// THE ACCOUNTING MUST CLOSE. Every `@example` written in a source file has to end up in exactly
// one bucket, and the only way to know that is to count the raw occurrences and compare. Without
// this the collector can miss a whole SHAPE of comment and still report PASS — which is what
// happened: a one-line `/** … @example … */` block was invisible, so every example inside one went
// unchecked and the run stayed green. A regex fix alone would have closed that instance, not the
// class.
/** @type {Record<string, number>} */
const onDisk = {}
for (const file of FILES) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  onDisk[file] = (text.match(/@example/gu) ?? []).length
}
for (const file of PROSE_FILES) onDisk[file] = collectFenced(file).length

const work = [
  ...FILES.flatMap((f) => collect(f)),
  ...PROSE_FILES.flatMap((f) => collectFenced(f)),
]

for (const ex of work) {
  const where = `${ex.file}:${ex.line}`
  if (ex.expected === null) {
    unaccounted++
    failures.push(`${where}  ${ex.expr}\n    has no // answer, so nothing can be checked`)
    continue
  }
  if (ex.setup === true) {
    skipped.push(`${where}  ${ex.expr}  // ${ex.expected}  [declaration, runs as setup]`)
    continue
  }
  // literalOf before assertable, so trailing prose after a literal does not hide the literal.
  // Skipping an example that COULD be asserted is the failure mode this script exists to
  // prevent. The rules for what counts as the literal are on `literalOf`.
  if (!assertable(literalOf(ex.expected))) {
    skipped.push(`${where}  ${ex.expr}  // ${ex.expected}  [prose, not a literal]`)
    continue
  }
  const thrown = /^throws\s+(\w*Error)/u.exec(ex.expected)
  // `new Function` is the point rather than a shortcut: the example has to run EXACTLY as it is
  // written, or the check is of a paraphrase and not of the documentation. The input is this
  // repository's own committed source comments, never caller data, and this script is a dev
  // gate that ships in no tarball — `package.json:files` lists index.js, index.d.ts and README.
  let run
  try {
    run = new Function(...Object.keys(scope), `return (${ex.expr})`)
  } catch (err) {
    // A gate must never die on one bad input. `new Function` throws while COMPILING, which is
    // outside the evaluation try/catch below, so without this one malformed line takes the
    // whole run down with a stack trace and no report.
    asserted++
    failures.push(`${where}  ${ex.expr}\n    is not a valid expression: ${err.message}`)
    continue
  }
  if (thrown !== null) {
    let raised = null
    try {
      run(...Object.values(scope))
    } catch (err) {
      raised = err
    }
    if (raised instanceof ReferenceError) {
      skipped.push(
        `${where}  ${ex.expr}  // ${ex.expected}  [needs ${raised.message.replace(' is not defined', '')}]`,
      )
      continue
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
    // An example may legitimately name a variable the reader has and the probe does not —
    // `day(row.createdAt)`, or a `const` from an earlier line of the same fenced block. An
    // unbound identifier throws a ReferenceError that names itself, which is a far better test
    // than the list of identifiers this used to carry: that list only knew the names I had
    // happened to write, and README examples introduced three more the day it was extended.
    if (err instanceof ReferenceError) {
      skipped.push(
        `${where}  ${ex.expr}  // ${ex.expected}  [needs ${err.message.replace(' is not defined', '')}]`,
      )
      continue
    }
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

console.log(
  `daymath examples — ${asserted} asserted, ${skipped.length} not assertable, ${unaccounted} unaccounted\n`,
)
for (const s of skipped) console.log(`  skip  ${s}`)

const bucketed = asserted + skipped.length + unaccounted
const written = Object.values(onDisk).reduce((a, b) => a + b, 0)
if (bucketed !== written) {
  failures.push(
    `${written} @example tags are written in the source but only ${bucketed} were read\n` +
      `    ${Object.entries(onDisk)
        .map(([f, n]) => `${f}: ${n}`)
        .join(', ')}\n` +
      `    The collector is missing a comment SHAPE, so those examples are unchecked and this\n` +
      `    run would otherwise be green. Fix collect(), do not lower this check.`,
  )
}

if (skipped.length > SKIP_CEILING) {
  failures.push(
    `${skipped.length} claims are unassertable and the ceiling is ${SKIP_CEILING}\n` +
      `    A claim moved from checked to unchecked. Either a literal became prose — put it back —\n` +
      `    or it genuinely cannot be asserted, and then raise SKIP_CEILING with the reason.`,
  )
}

// EVERY DECLARATION SITE CARRIES AN EXAMPLE, and this is what proves it. The release notes claim
// it in prose, and a prose claim that nothing checks is the exact defect this script exists to
// stop — it was made here twice before this check existed. `index.d.ts` is the only file an editor
// reads for documentation, so a bare declaration is a caller reading a signature and nothing else.
// Exemption is BY NAME, never by pattern: a type alias has no call to show. Adding an export
// without an `@example` fails here, which is the point.
const NO_EXAMPLE_NEEDED = new Set(['DayInput', 'Interval', 'WeekOptions'])
const bare = []
{
  const lines = readFileSync(new URL('../index.d.ts', import.meta.url), 'utf8').split(
    '\n',
  )
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\/\*\*/u.test(lines[i])) continue
    const start = i
    while (i < lines.length && !/\*\//u.test(lines[i])) i++
    if (
      lines
        .slice(start, i + 1)
        .join('\n')
        .includes('@example')
    )
      continue
    const decl = /^export\s+(?:declare\s+)?(?:function|const|type)\s+(\w+)/u.exec(
      lines[i + 1] ?? '',
    )
    if (decl !== null && !NO_EXAMPLE_NEEDED.has(decl[1])) {
      bare.push(`${decl[1]} (index.d.ts:${i + 2})`)
    }
  }
}
if (bare.length > 0) {
  failures.push(
    `${bare.length} declaration site(s) in index.d.ts carry no @example\n` +
      `    ${bare.join(', ')}\n` +
      `    An editor shows a signature and nothing else there. Add a runnable example, or add\n` +
      `    the name to NO_EXAMPLE_NEEDED with the reason it has no call to show.`,
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

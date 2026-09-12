#!/usr/bin/env node
// Is this tree ready to release, and what is the next step?
//
// The release is a seven-step order and the steps are not interchangeable. CONTRIBUTING.md holds the
// same order in prose, with the reasons. This reads the tree and says which step is next.
//
//   node scripts/release-check.mjs
//   node scripts/release-check.mjs --next   # print only the next command

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import process from 'node:process'

const root = dirname(import.meta.dirname)
const read = (name) => readFileSync(join(root, name), 'utf8')

// Every shell-out goes through here, so a missing tool or a network failure becomes a value this
// script can report rather than a stack trace that hides which check was running.
const run = (cmd, args) => {
  try {
    return {
      out: execFileSync(cmd, args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    }
  } catch (err) {
    return { failed: `${err.stderr?.toString().trim() || err.message}`.split('\n')[0] }
  }
}

const version = JSON.parse(read('package.json')).version
const steps = []
const blockers = []
const block = (msg) => blockers.push(msg)

// ─── the tree ───────────────────────────────────────────────────────────────
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out
if (branch !== 'master')
  block(`on branch \`${branch}\`, and a release is cut from \`master\``)

// `todo` and its siblings are deliberately untracked and deliberately not ignored, so they are the
// one thing a dirty tree is allowed to be. Anything else means the release commit is incomplete.
const dirty = (run('git', ['status', '--porcelain']).out || '')
  .split('\n')
  .filter((line) => line && !line.startsWith('?? todo'))
if (dirty.length > 0) block(`uncommitted changes:\n      ${dirty.join('\n      ')}`)

run('git', ['fetch', '--quiet', 'origin', 'master'])
const behind = run('git', ['rev-list', '--count', 'HEAD..origin/master']).out
if (behind !== '0')
  block(`${behind} commit(s) behind origin/master, so pull before releasing`)

// ─── the four files a release commit touches ────────────────────────────────
// Each is checked against the version in `package.json`, which is the one source. Checking them
// against each other would pass a release where all four agree on the WRONG number.
const changelog = read('CHANGELOG.md')
const stamped = new RegExp(
  `^## \\[${version.replaceAll('.', '\\.')}\\] — \\d{4}-\\d{2}-\\d{2}`,
  'm',
).test(changelog)
const unreleased = /^## \[Unreleased\]/m.test(changelog)
const liveNow = new RegExp(`daymath@${version.replaceAll('.', '\\.')}\``).test(
  read('FUTURE.md'),
)

// ─── what already exists elsewhere ──────────────────────────────────────────
const tagged =
  run('git', ['ls-remote', '--tags', 'origin', `refs/tags/v${version}`]).out !== ''
const onNpm = run('npm', ['view', `daymath@${version}`, 'version']).out === version
const whoami = run('npm', ['whoami'])

// A stale token answers `E404 Not Found - PUT` at publish time, which reads like a package problem.
// `npm whoami` is what names it, so it is asked here rather than after a failed publish.
if (whoami.failed)
  block(
    `npm is not authenticated: ${whoami.failed}\n      Fix the token BEFORE step 6. A stale one reports as a 404 on publish, not a 401.`,
  )

// ─── the order, and where this tree sits in it ──────────────────────────────
// Every step is marked done by a DURABLE fact — a commit on the remote, a tag, a published version.
// The working tree is deliberately not one of them. Reading it made this script announce that the
// release commit was still owed the moment any later work was in progress.
const released =
  run('git', [
    'log',
    '--oneline',
    '--fixed-strings',
    `--grep=Release daymath ${version}`,
    'origin/master',
  ]).out !== ''

steps.push([
  `bump to ${version}, stamp CHANGELOG.md, point FUTURE.md at it`,
  stamped && liveNow && !unreleased,
])
steps.push([`commit as \`Release daymath ${version}\` and push master`, released])
steps.push([
  // The title repeats the tag on purpose. Every surface that shows it — the releases page, the
  // sidebar, the Atom feed, watcher mail — already names the repository, so a `daymath ` prefix
  // only repeats a word the reader can see. v0.0.1 through v0.7.1 use this form.
  `gh release create v${version} --title "v${version}" --target $(git rev-parse master)`,
  tagged,
])
steps.push(['cd into this directory, then `npm publish`', onNpm])
// The last step has no durable trace, so it is never marked done. A releaser who ran it knows; a
// releaser who did not gets told to. That is the safer of the two errors.
steps.push(['npm run test:demo', false])

const next = steps.findIndex(([, done]) => !done)

// ─── report ─────────────────────────────────────────────────────────────────
if (process.argv.includes('--next')) {
  console.log(next === -1 ? 'nothing left' : `step ${next + 1}: ${steps[next][0]}`)
  process.exit(0)
}

console.log(`\nrelease check — daymath ${version}\n`)
for (const [index, [what, done]] of steps.entries()) {
  const mark = done ? 'done' : index === next ? 'NEXT' : '    '
  console.log(`  ${mark}  ${index + 1}. ${what}`)
}

// Step 3 is the one that goes wrong, so it says what it does rather than only when to do it.
console.log(`
  Step 3 is what publishes @leemr/daymath. \`publish-github-packages.yml\` fires on
  \`release: published\`. Actions -> publish-github-packages is a FALLBACK for a version whose
  release already went out; using it during a normal release makes step 3 go red.`)

if (blockers.length > 0) {
  console.error(`\nNOT READY — ${blockers.length} blocker(s):\n`)
  for (const b of blockers) console.error(`  - ${b}`)
  console.error('')
  process.exit(1)
}
console.log(`\nready${next === -1 ? '' : `, next is step ${next + 1}`}\n`)

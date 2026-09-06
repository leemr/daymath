# daymath — future work

Checked-in backlog. Session handoff: local `./todo`, which is untracked and NOT gitignored — the
`??` line in `git status` is the point, so a stale handoff stays visible.

**Live now:** `daymath@0.7.3` on npmjs · `@leemr/daymath@0.7.3` on GitHub Packages · https://leemr.github.io/daymath/

---

## Order

This section is the recommended order, not a promise. Everything below it is grouped by subject
instead, so read this first and the sections for detail. A row that names a product call cannot
start until that call is answered.

| # | Name | What it does | Blocked by | Version |
|---|---|---|---|---|
| 1 | **Size badge** | `docs/size.json` and a shields endpoint, so history lives in git | — | rides a release |
| 2 | **ISO week-date** | parse/format `YYYY-Www-D`; ISO week getters and bounds | — | minor |
| 3 | **Business days** | add/sub/diff/is, with a caller-owned closed-day hook | — | minor |
| 4 | **Markdown lint** | `markdownlint-cli2` as a gate, so a prose defect stops being invisible | — | no release |
| 5 | **npm provenance** | publish from Actions with OIDC instead of a laptop token | — | mechanics |
| 6 | **Awesome-list** | submit to an existing awesome list | a stable API | external |
| 7 | **Prose sweep for 1.0** | move supporting narrative out of this file and the source headers into `todo.claude` | — | no release |
| 8 | **Browser bundle** | ship one prebuilt file so no CDN can split `temporal-polyfill` | a shape call | mechanics |

**Row 4 is measured, not a guess.** `markdownlint-cli2` catches the double-blank-line class
(`MD012`) and would have caught one of the two Markdown defects this PR shipped and then fixed. It
does **not** catch the other: a heading placed above the wrong bullets, correctly spaced, is
semantic and no linter reads it. Four rules must be off or the noise buries the signal — `MD013`
(line length, which would mean reflowing prose), `MD024` (this changelog repeats `### Changed` on
purpose), `MD034` (bare URLs are deliberate here) and `MD033`. With those off, all five `.md` files
report zero today.

**Do NOT take the cheap option, and this is the trap.** daymath already depends on a formatter that
handles Markdown: `npx oxfmt -c oxfmt.json --check ./*.md` reports issues in all five files today.
The `format` script excludes `*.md` on purpose. Adding them to that glob costs no new dependency and
would immediately reflow all five — pad every table column and insert blank lines between adjacent
headings. Use a linter, which reports; never a formatter, which rewrites.

**Row 1 is not free of a release, and the old label saying so was wrong.** `README.md` is one of the
five files in the npm tarball, so repointing the badge markup leaves npmjs serving the old badge
until the next publish. The badge itself works on GitHub immediately. Nothing blocks the row; it
just has to ride a release to be fully live.

**Take rows 2 then 3 in one minor.** A release cycle is the expensive part, so they land together.
Week-date has no policy call. Business days needs the closed-day hook decided, and the ISO
Monday-start helpers from row 2 make that suite cheaper to write. Row 3 is not blocked on row 2 in
the DAG sense; the order is speed-to-usable.

**Row 2 bundles two unlike jobs, so cost them apart.** The eight getters and bounds are purely
additive and reverse no documented promise. Accepting `YYYY-Www-D` as INPUT is a different animal:
it lands in `bareDay`, so it widens all 69 exports at once, exactly as SQL DATETIME did. The
additive half is the cheaper, safer start.

**Row 8, noted 2026-09-05.** The page works because a CDN inlines for us, not because daymath ships
something that cannot be split. `README.md` under Requirements holds the mechanism and the measured
CDN table; do not restate them here. The shape call is Lee's and it is not small: daymath is one
source file with no build step today, `files` lists three entries, and a `dist` reverses that. It
needs a new gated row in `scripts/bundle-size.mjs`, whose own header warns that byte counts do not
transfer between experiments. Research it after the demo fix publishes, so the comparison runs
against a live build. The other half is not ours: report the duplicate-copy behaviour to
`temporal-polyfill` and to jsDelivr, because every package importing two `fns` subpaths meets it.

**Row 7, noted 2026-08-09.** This file and several source headers carry the REASONING behind a
decision as well as the decision. The reasoning belongs in the local `todo.claude`, which is the
deep record; this file should carry what remains to do and the one-line cost of each. Do it in one
deliberate pass at 1.0, not opportunistically, or the record gets split with no rule to find it by.

**There is no "extend `test:runtimes` for the calendar split" row, and there must not be one.**
That row was drafted and then measured away. The port is done and it still holds, so the reason is
recorded here rather than re-derived.

The native-vs-shim disagreement inside `temporal-polyfill/fns` is real, and daymath now runs on
that layer. It is closed by the resolver, not by a harness: **`getAny` carries every calendar's
data, so both funcApi paths answer identically.** `getISO` does not — it drops the annotation on
the shim path — and the header of `index.js` records that as the reason the resolver may never be
narrowed.

**The net that would catch a regression already exists.** `scripts/battery.mjs` carries an explicit
`CALENDARS` list — accepted annotations, including the critical `!` spelling and a mixed pair —
plus refused ones in `JUNK`, and CI runs both Temporal paths:

| lane | Temporal |
|---|---|
| Node 20 | `temporal-polyfill` |
| Node 26 | native |
| deno | native |
| bun | `temporal-polyfill` |

Narrowing the resolver would silently drop the annotation on the shim lanes and answer `2026`
where the native lanes answer `2569`. The hash for `getYear` would move, and Node 20 and bun would
go red. Keep this one green and the hazard stays closed.

### Product calls that block a row

| Name | The question | What the answer costs |
|---|---|---|
| **Orphan days** | rebuild `day()` on `Intl`, so 5 historical days read the date part instead of resolving the instant | buys 1.9 kB gzip; changes 0.5.0 behaviour. **Blocks nothing** — the port keeps Temporal in `day()` |
| **setDate rolling** | daymath constrains, date-fns rolls | blocks nothing; see API / product below |
| **Closed days** | list, predicate, or both? default weekend? | blocks row 3. Recommendation: both, default ISO Saturday and Sunday (`[6, 7]`), no holiday calendar in the library |

### Not a pull request

| Name | Kind | Action |
|---|---|---|
| **`size` required check** | repo setting | add `size` to the branch-protection contexts |
| **Trust settings sweep** | repo settings | see Trust / publish below |

---

## Trust / publish (later)

- **npm publish from GitHub Actions + provenance** — `npm publish --provenance` to **registry.npmjs.org** (trusted publisher / OIDC). Laptop token still used for npmjs.
- **`fail_ci_if_error: true`** on Codecov upload step once you’re happy uploads never flake (today: `false`; 100% gate is already c8, not Codecov).
- **`enforce_admins: true`** on branch protection if even owner merges must wait for CI (today: admin can bypass).
- **OpenSSF Scorecard** badge when you want the scoreboard.
- **Rotate Codecov token** if it was ever pasted into chat; keep only as `CODECOV_TOKEN` secret.
- **Dependabot malware alerts** — optional UI toggle; version + security Dependabot already on.

**Done (trust / CI / registries):**

- SECURITY.md, CONTRIBUTING.md, CHANGELOG, GitHub Releases through v0.2.3  
- CI Node 20–26 (18 dropped, end-of-life April 2025); checkout/setup-node v7; c8 100% lines/funcs/branches; Codecov upload + badge (~100% on master)  
- Cross-runtime baseline on **Deno** (native Temporal) and **Bun**: `npm run test:runtimes`  
- Static gates, all on Node 26 only: `lint` (oxlint), `format:check` (oxfmt), `typecheck` (tsc over the JSDoc in `index.js` and over `index.d.ts`)  
- **CodeQL default setup**: configured, weekly, languages actions + javascript + javascript-typescript + typescript. It reports `Analyze (…)` checks, left **not required** — a default-setup run cannot be re-run, so a transient outage would be a permanent red  
- Master protected: strict, no force-push/delete, fork+PR open. Required contexts are **`Node 20` `Node 22` `Node 24` `Node 26` `deno` `bun`**, all pinned to the GitHub Actions app (id 15368). This list lives in the **repository setting**, not in `ci.yml` — dropping a matrix entry without editing it blocks every later PR on a check that can never report  
- Dependabot **version** updates (`.github/dependabot.yml`); **alerts** + **security updates** + **grouped** + private vuln reporting + dependency graph (UI); secret scanning + push protection  
- Automatic dependency submission: **left Disabled** (npm lockfile is enough)  
- GitHub Packages: `scripts/publish-github-packages.mjs` + workflow (on release and workflow_dispatch). Don’t double-fire same version (second publish fails red; ignore).  
- npmjs primary: `daymath`; GH Packages twin: `@leemr/daymath` (scoped, not a name swap of the npm package)

---

## Discoverability (later)

- **Awesome-list PR** (not “awesome-daymath”) when API feels stable.  
- Confirm **repo Social preview** still set to `docs/og.png` if unfurls for github.com/leemr/daymath look wrong.

**Done:** topics, homepage, badges, llms.txt, README, Pages play, `docs/og.png` + og meta.

---

## Bundle size (client)

**The port SHIPPED.** `index.js` is built on `temporal-polyfill/fns`, so shapes A, B and F are fns
shapes now. Measured in one run: **24,735 B gzip to 16,295 B on the three-call program, −34%**;
27,304 to 21,550 at whole surface; 25,269 to 19,349 with `day()`. The baseline was re-recorded
deliberately.

**The rig is checked in: `npm run size`.** Twelve shapes, one esbuild, one process. `--run`
executes every fixture first, so a program that throws can never be quoted as a size.
`npm run size:check` is the CI gate; `npm run size:write` moves the baseline, deliberately. Read
the numbers from the rig, not from here — absolute byte counts do not transfer between
experiments, and only an A/B made inside one run is evidence.

- ~~Dynamic import / optional peer for native Temporal~~ — **measured, dead end.** The polyfill still ships in a lazy chunk, and it forces the whole API async.
- **Never quote a model fixture as a port's cost.** Two were built to predict this port and both
  under-stated the real bundle, because a fixture reaches less of the `fns` surface than daymath
  does. Both were deleted once shape A measured the real thing. The rule is written where it can
  stop a repeat, in `scripts/bundle-size.mjs` above the summary lines.
- **The win needs the caller to tree-shake**, because `fns/PlainDate.js` statically imports both
  `funcApi-native.js` and `funcApi-shim.js` and picks with `NativeTemporal ? … : …`. Nothing shakes
  when a caller reaches everything.
- **Fixture C is not a like-for-like row against A any more.** It imports the BASE polyfill CLASS
  build, so an A−C delta compares two different layers, not daymath's own cost. The honest
  neighbours for A are the `fns` shapes below it.
- **Returning a real `PlainDate` costs the whole saving and more** (+14.5 kB), because
  `fns.toTemporal` needs a free `Temporal` global and throws without one, so the class API comes
  back in. Returning strings is what keeps this option open.
- **`day()` no longer needs Temporal at all.** `Intl` already carries a TZ database in every
  runtime, and it answers the only hard direction: instant + zone → civil day. Verified against
  Temporal over 40,230 zone/moment pairs, **0 mismatches**, including BC eras, expanded years,
  DST gaps and negative DST. `npm run test:intl-day` is that harness.

  | day() built on | gzip in a fns port |
  |---|---|
  | `Instant` + `ZonedDateTime` + `Now` | 9.2 kB |
  | `Intl` only | **7.2 kB** |
  | `Intl`, `ZonedDateTime` kept for wall time | 9.1 kB |

  `ZonedDateTime` is the whole cost. Dropping `Instant` and `Now` while keeping it saves 0.1 kB.

  **The one branch `Intl` cannot serve is the inverse:** wall time plus a named zone,
  `'2026-08-08T12:00[America/New_York]'`. `Intl` cannot be run backwards. But daymath only wants
  the *day*, and the day in that zone is the date part of the string. Swept every IANA zone and
  all 41,892 transitions from 1900 to 2100: that answer differs from Temporal on **exactly 5
  days**, every one a historical date-line move where the day never existed in that zone —
  `Pacific/Apia` and `Pacific/Fakaofo` 2011-12-30, `Pacific/Enderbury` and `Pacific/Kiritimati`
  1994-12-31, `Pacific/Kwajalein` 1993-08-21. Baseline asserted in `scripts/intl-day.mjs`;
  re-walk with `npm run test:intl-day:sweep`.

  **This is a cost of the Intl proposal, not a defect today, and it blocks nothing.** `day()` calls
  Temporal directly — `Temporal.ZonedDateTime.from`, `Temporal.Instant.from`,
  `Temporal.Now.plainDateISO` — so daymath already answers exactly what Temporal answers on all
  five days. Verified 2026-08-09 against `Temporal.ZonedDateTime.from(...).toPlainDate()`, five of
  five agreeing, with an ordinary-zone control passing. **A port keeps that**, because the fns
  layer has `Instant`, `ZonedDateTime` and `Now` subpaths.

  **Open product call, and it is optional:** rebuild `day()` on `Intl` instead. On those five days
  Temporal answers the next day, and the date part answers the day the caller wrote. daymath is a
  day library and never resolves an instant, so the date part is arguably the more honest answer —
  but it is a behaviour change from 0.5.0. Measured price of NOT taking it: **1.9 kB gzip**, shape
  K against shape L in `npm run size`.
- **The calendars cost 4.2 kB gzip and still do**, now as `getAny` rather than
  `temporal-polyfill/full`. It is paid at a different layer, not saved. That is already in the
  16,295 B baseline, so it is not a future cost.
- Measure in a real app (e.g. itrvl) now that the port has landed  

---

## API / product (optional)

- **`setDate` / `setYear` overflow — the last undecided public behaviour.** daymath constrains
  inside the month; date-fns rolls over. `setDate('2026-02-01', 31)` answers `2026-02-28` here and
  `2026-03-03` there. The differential harness asserts the size of the gap as a baseline:
  **39,730** divergences for `setDate` and **196** for `setYear` over 1900-2100.

  It is a product call, not a defect, and daymath's answer is already the more considered one.
  **date-fns does not roll deliberately — it forgot to guard.** `setDate` is a bare
  `_date.setDate(n)` pass-through to `Date`, while date-fns's own `setMonth` clamps with
  `Math.min(day, daysInMonth)`. So "match date-fns" would mean copying an omission, and daymath's
  one overflow rule — clamp everywhere, construction and measurement alike — would gain an
  exception.

  Switching costs one line each, both measured with 0 mismatches against rolled date-fns:
  `setDate` becomes `d.with({day: 1}).add({days: n - 1})` (118,703 comparisons) and `setYear`
  becomes `d.with({year: y, day: 1}).add({days: d.day - 1})` (63,917 comparisons). The full
  argument is in `scripts/differential.mjs` under `setDate` and `setYear`.
- **SQL DATETIME — DONE, awaiting a release stamp.** The rule and the measurements live in
  `CHANGELOG.md`, and they are not restated here: a copy of a settled rule has to be re-edited on
  every change to it, and this one already went stale once inside a single review round.

  **What it settled for the rows below, which is the part this file is for.** A new input spelling in
  `bareDay` widens all 69 exports at once, not just `parse`, because `bareDay` is the funnel they
  share. Cost the next one that way rather than as a `parse` feature.

- **ISO week-date (row 2).** `2026-W32-5` is a day in ISO 8601. `parse` and `day` refuse it today: it
  sits in the `JUNK` list in `scripts/battery.mjs` and in the inline list in the `test.js` case
  "refuses a string that is neither a moment nor a zone" — `test.js` has no constant called `JUNK`.
  Accept the extended form `YYYY-Www-D` and the compact form `YYYYWwwD`. `parse('2026-W32-5')` must
  answer `'2026-08-07'`, measured. Add one format pattern for the same spelling, still not locale
  display. Then the date-fns-named ISO week suite: `getISOWeek`, `getISOWeekYear`, `setISOWeek`,
  `startOfISOWeek`, `endOfISOWeek`, `isSameISOWeek`, `getISOWeeksInYear`,
  `differenceInCalendarISOWeeks`. All eight exist in date-fns 4.4.0, so each one can be added to
  `CASES` in `scripts/differential.mjs` and measured against the oracle. Week 1 is the week that
  contains 4 January. Monday starts the week. That is ISO, not `weekStartsOn: 7`.
- **Business days (row 3, same minor).** date-fns names: `addBusinessDays`, `subBusinessDays`,
  `differenceInBusinessDays`, `isBusinessDay`. `isWeekend` takes one argument today and is hardcoded
  to ISO Saturday and Sunday; it WOULD gain the same options object. Closed days are an argument,
  same shape as `weekStartsOn`:

  ```js
  addBusinessDays('2026-08-07', 3, { holidays: ['2026-08-10'] })
  // '2026-08-13'
  ```

  **That number is measured, and the obvious guess is wrong.** 2026-08-07 is a Friday, and
  date-fns 4.4.0 answers `2026-08-12` for `addBusinessDays(d, 3)` with NO holidays (Mon 10, Tue 11,
  Wed 12). So excluding Monday the 10th must push it to `2026-08-13`. Quote `2026-08-12` here and
  the `holidays` argument looks inert. Run it before writing the test.

  `weekend` defaults to `[6, 7]`. `holidays` is a day list, or a `string => boolean`. Both, because a Gulf clinic, an exchange, and a tour operator each own a different closed set. **Do not bake US federal holidays into the library.** A helper that only skips Saturday and Sunday is a US office library, not a field-universal one.
- Rich display / i18n — **out of scope** (Temporal+Intl or date-fns TZ formatters)
- See the Order section for what each remaining row costs in semver.  

**Done:** 0.2 calendar surface; expanded ISO years; `isValid(Date)` throws; `isSameDay` = `isEqual`;
date-fns index traps (0-based month, Sunday week, etc.); **0.4.0** `day()` and the Node 20.19 floor;
**0.5.0** the four year-relabel calendars, the measured rule, and `temporal-polyfill/full`. The
calendar surface is documented in `README.md`; the measurement is in `CHANGELOG.md` at `[0.5.0]`.

---

## DX (optional)

- Micro-bench only if honest and useful  

**Done:** `examples/basic.mjs`, types, playground, 100% coverage, lint + format + type gates, and
`@example` on every declaration that can carry one, with a gate that enforces and executes them  

---

## Settled (do not re-litigate without new data)

- date-fns-shaped **names**; values are ISO day **strings**, not `Date`  
- `getMonth`/`setMonth` **1–12** (ISO, 1=January); `getDay` **1=Mon…7=Sun** (ISO); `weekStartsOn` default `7`, `0` still accepted for Sunday — changed in 0.3.0, was date-fns 0-based  
- `differenceInMonths` counts a month as full when `addMonths` would carry the earlier date to the later one, so the round-trip law holds — changed in 0.3.0, was Temporal `since`  
- **Exports do not funnel through `day()`.** `day()` is the moment door and the only clock. `parse` validates a day. Routing `addDays` through `day()` would make a missing argument read now, and would spread moment parsing across the whole surface. `Date` and instants enter through `day()` and nowhere else. SQL DATETIME held to this: it is a day spelling, so it extended `bareDay`, the shared funnel, and no export became impure.
- **A zoneless clock plus a zone is the one argument pair `day()` refuses rather than answers.** Settled with SQL DATETIME. Naming a zone means convert, and a clock with no zone gives nothing to convert from. A bare day plus a zone still answers, because nothing is discarded there.
- **Do not widen parse to `'11/12/2026'` or `'2026/08/08'`.** Unknowable or sloppy. Week-date is ISO. Those are not.
- npm badge orange = shields style, not failure  
- Sidebar “Packages” = GitHub Packages only; empty ≠ missing npmjs package  
- GitHub Packages doc = `npm.pkg.github.com` + scoped names; not auto-publish to npmjs  

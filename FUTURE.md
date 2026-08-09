# daymath — future work

Checked-in backlog. Not a promise of order. Session handoff: local `todo.grok` (gitignored).

**Live now:** `daymath@0.3.0` on npmjs · `@leemr/daymath@0.3.0` on GitHub Packages · https://leemr.github.io/daymath/

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

Static `temporal-polyfill` class import still ships polyfill even when native Temporal exists.

**The rig is checked in: `npm run size`.** Twelve shapes, one esbuild, one process. `--run` executes
every fixture first, so a program that throws can never be quoted as a size. `npm run size:check`
is the CI gate; `npm run size:write` moves the baseline, deliberately. Read the numbers from the
rig, not from here — absolute byte counts do not transfer between experiments, and only an A/B
made inside one run is evidence.

- ~~Dynamic import / optional peer for native Temporal~~ — **measured, dead end.** The polyfill still ships in a lazy chunk, and it forces the whole API async.
- **`temporal-polyfill/fns/PlainDate` is the live option, and it is worth −13.1 kB gzip** on a
  three-call program: 20.0 kB → 6.9 kB, a 66% cut. Measured 2026-08-09, esbuild 0.28.1.
- **The win needs the caller to tree-shake.** At whole surface, fns is 0.8 kB *worse*, because
  `fns/PlainDate.js` statically imports both `funcApi-native.js` and `funcApi-shim.js` and picks
  with `NativeTemporal ? … : …`. Nothing shakes when a caller reaches everything.
- **Returning a real `PlainDate` costs the whole saving and more** (+14.5 kB), because
  `fns.toTemporal` needs a free `Temporal` global and throws without one, so the class API comes
  back in. Returning strings is what keeps this option open.
- **`day()` no longer needs Temporal at all.** `Intl` already carries a TZ database in every
  runtime, and it answers the only hard direction: instant + zone → civil day. Verified against
  Temporal over 40,120 zone/moment pairs, **0 mismatches**, including BC eras, expanded years,
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

  **Open product call:** on those five days Temporal answers the next day, and the date part
  answers the day the caller wrote. daymath is a day library and never resolves an instant, so
  the date part is arguably the more honest answer — but it is a behaviour change from 0.4.0.
- The calendars decision has a byte price too. See the `[u-ca=]` item below.
- Measure in a real app (e.g. itrvl) before rewriting  

---

## API / product (optional)

- **Accept `buddhist` and `roc` calendars** — next PR. daymath refuses every non-ISO calendar
  today. That is correct as a default, because normalising to ISO would answer `2026` where the
  caller's own object says `2569`. But the refusal is wider than it needs to be.

  The line is measurable at runtime, not a list to maintain: **accept a calendar when its month
  and day already equal the ISO fields.** Compare `d.month`/`d.day` against
  `d.withCalendar('iso8601')`. Measured on `2026-01-31` with `temporal-polyfill/full`:

  | calendar | year | month | day | ISO month+day match |
  |---|---|---|---|---|
  | `buddhist` | 2569 | 1 | 31 | **yes** (+543) |
  | `roc` | 115 | 1 | 31 | **yes** (−1911) |
  | `japanese` | 2026 | 1 | 31 | **yes**, but era-based |
  | `hebrew` | 5786 | 5 | 13 | no |
  | `chinese` | 2025 | 13 | 13 | no, 13 months |
  | `persian` | 1404 | 11 | 11 | no |
  | `coptic` | 1742 | 5 | 23 | no, 13 months |
  | `ethiopic` | 2018 | 5 | 23 | no, 13 months |
  | `indian` | 1947 | 11 | 11 | no |

  For the matching family only the year label moves, so every export still works honestly.
  daymath returns strings, so the annotation rides along and nothing is lost:

  ```js
  getYear('2026-01-31[u-ca=buddhist]')        // 2569, not 2026
  addDays('2026-01-31[u-ca=buddhist]', 1)     // '2026-02-01[u-ca=buddhist]'
  setYear('2026-01-31[u-ca=buddhist]', 2570)  // '2027-01-31[u-ca=buddhist]'
  ```

  The renumbering family cannot work this way: `addMonths` has no meaning when a year holds 13
  months and month lengths do not line up with ISO.

  **Already true, and useful groundwork.** `day()` refuses a calendar only where it is
  *applied*. `'2026-08-08T20:00:00Z[u-ca=buddhist]'` names an `Instant`, which has no fields
  for a calendar to renumber, so the annotation is inert and the day is answered. The
  refusal lives in one function, `assertIsoCalendar`, called from `toPlainDate` and from the
  zoned path in `day()`. That is the single place this PR would widen.

  **Priced, 2026-08-09.** In a fns port the calendar set is a *build-time* choice:
  `fromString(s, getCalendar)` takes a resolver, and `temporal-polyfill/fns/Calendar` exports
  `getISO`, `getBasic`, `getAny` plus one getter per calendar. ISO + buddhist + roc costs
  **+0.5 kB gzip**; admitting every calendar costs **+4.2 kB**. So the matching-family rule is
  nearly free, and refusing the other thirteen saves 3.7 kB.

  **The resolver is not a gate on the native path.** Same call, `getISO`, the string
  `'2026-01-31[u-ca=buddhist]'`: the shim path (no native `Temporal`, so every browser today)
  answers `'2026-01-31'` and drops the annotation, while the native path (Node 26, Deno) answers
  `'2026-01-31[u-ca=buddhist]'` with `.year` 2569. One program, two answers, decided by the
  runtime. `npm run test:runtimes` is the only gate that can see it, and a fns port therefore
  cannot delete `assertIsoCalendar`.

  Three questions the PR must still answer:

  1. **`japanese` is era-based.** `.year` reads 2026 but `.eraYear` reads 8 for Reiwa 8. A
     year-offset rule does not describe it, so it may need its own decision.
  2. **A mixed pair throws.** `differenceInDays('2026-01-31[u-ca=buddhist]', '2026-03-01')` raises
     Temporal's `Mismatched calendars`. Both sides must name the same calendar, so daymath has to
     decide whether it refuses a mixed pair or normalises one side.
  3. **The object / string asymmetry belongs to Temporal.** A string's date part is always ISO;
     an object's fields are calendar fields, so `from({year: 2026, …, calendar: 'buddhist'})` is
     ISO 1483. Taking annotated strings inherits that rule and stays consistent with Temporal.
     daymath cannot fix it.

- Business days, ISO week suite  
- Rich display / i18n — **out of scope** (Temporal+Intl or date-fns TZ formatters)  
- Next **semver: 0.4.0.** `day()` is new API surface, and the Node floor moved to 20.19  

**Done:** 0.2 calendar surface; expanded ISO years; `isValid(Date)` throws; `isSameDay` = `isEqual`; date-fns index traps (0-based month, Sunday week, etc.)

---

## DX (optional)

- Deeper `@example` JSDoc on hot exports  
- Micro-bench only if honest and useful  

**Done:** `examples/basic.mjs`, types, playground, 100% coverage, lint + format + type gates  

---

## Settled (do not re-litigate without new data)

- date-fns-shaped **names**; values are ISO day **strings**, not `Date`  
- `getMonth`/`setMonth` **1–12** (ISO, 1=January); `getDay` **1=Mon…7=Sun** (ISO); `weekStartsOn` default `7`, `0` still accepted for Sunday — changed in 0.3.0, was date-fns 0-based  
- `differenceInMonths` counts a month as full when `addMonths` would carry the earlier date to the later one, so the round-trip law holds — changed in 0.3.0, was Temporal `since`  
- npm badge orange = shields style, not failure  
- Sidebar “Packages” = GitHub Packages only; empty ≠ missing npmjs package  
- GitHub Packages doc = `npm.pkg.github.com` + scoped names; not auto-publish to npmjs  

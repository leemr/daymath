# daymath — future work

Checked-in backlog. Session handoff: local `todo.grok` (gitignored).

**Live now:** `daymath@0.5.0` on npmjs · `@leemr/daymath@0.5.0` on GitHub Packages · https://leemr.github.io/daymath/

---

## Order

This section is the recommended order, not a promise. Everything below it is grouped by subject
instead, so read this first and the sections for detail. A row that names a product call cannot
start until that call is answered.

| # | Name | What it does | Blocked by | Version |
|---|---|---|---|---|
| 1 | **fns port** | rewrite the internal `Temporal.` call sites onto `fns` | Orphan days | 0.6.0 |
| 2 | **Size badge** | `docs/size.json` and a shields endpoint, so history lives in git | — | no release |
| 3 | **Business days** | business-day helpers and the ISO week suite | — | 0.7.0 |
| 4 | **npm provenance** | publish from Actions with OIDC instead of a laptop token | — | mechanics |
| 5 | **JSDoc examples** | deeper `@example` on the hot exports | — | patch |
| 6 | **Awesome-list** | submit to an existing awesome list | a stable API | external |

**There is no "extend `test:runtimes` for the calendar split" row, and there must not be one.**
That row was drafted and then measured away, so the reason is recorded here rather than repeated.

The native-vs-shim disagreement inside `temporal-polyfill/fns` is real, and daymath does not use
that layer yet. The class API has no such split either, now for a stronger reason than before:
`temporal-polyfill/full` builds every calendar on both paths, and the cross-runtime baseline
passes byte-identically on Node 26, deno (both native Temporal) and bun (the polyfill).

**The net that will catch the port's hazard already exists.** `scripts/battery.mjs` carries an
explicit `CALENDARS` list — accepted annotations, including the critical `!` spelling and a mixed
pair — plus refused ones in `JUNK`, and CI runs both Temporal paths:

| lane | Temporal |
|---|---|
| Node 20 | `temporal-polyfill` |
| Node 26 | native |
| deno | native |
| bun | `temporal-polyfill` |

A port that reached the fns layer with `getISO` would silently drop the annotation on the shim
lanes and answer `2026` where the native lanes answer `2569`. The hash for `getYear` would move,
and Node 20 and bun would go red. So the port needs no new harness — it needs this one to stay
green.

### Product calls that block a row

| Name | The question | What the answer costs |
|---|---|---|
| **Orphan days** | 5 historical days answer differently if `day()` reads the date part of the string | buys 1.9 kB gzip; changes 0.5.0 behaviour |
| **setDate rolling** | daymath constrains, date-fns rolls | blocks nothing; see API / product below |

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

Static `temporal-polyfill` class import still ships polyfill even when native Temporal exists.

**The rig is checked in: `npm run size`.** Twelve shapes, one esbuild, one process. `--run` executes
every fixture first, so a program that throws can never be quoted as a size. `npm run size:check`
is the CI gate; `npm run size:write` moves the baseline, deliberately. Read the numbers from the
rig, not from here — absolute byte counts do not transfer between experiments, and only an A/B
made inside one run is evidence.

- ~~Dynamic import / optional peer for native Temporal~~ — **measured, dead end.** The polyfill still ships in a lazy chunk, and it forces the whole API async.
- **`temporal-polyfill/fns/PlainDate` is the live option.** Run `npm run size` for the number; do
  not quote one from here. The two mechanisms are what is durable, and both still hold.
- **The win needs the caller to tree-shake**, because `fns/PlainDate.js` statically imports both
  `funcApi-native.js` and `funcApi-shim.js` and picks with `NativeTemporal ? … : …`. Nothing shakes
  when a caller reaches everything.
- **Beware comparing a class-API shape against an fns shape now.** Shapes A, B and F reach
  `index.js`, which carries the full polyfill for the calendars; the fns shapes import the `fns`
  tree directly and carry no calendar support. So an A-versus-D delta is not like-for-like. The
  honest post-calendars row is A against **I**, `fns, ISO + buddhist + roc`. Fixture C has the same
  problem: it imports the BASE polyfill, so the printed A−C delta mixes the calendar data into
  daymath's own cost. Measured properly, daymath's own code is about 1.0 kB, not 4.8 kB.
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

  **Open product call:** on those five days Temporal answers the next day, and the date part
  answers the day the caller wrote. daymath is a day library and never resolves an instant, so
  the date part is arguably the more honest answer — but it is a behaviour change from 0.5.0.
- **The calendars already spent 4,227 B gzip, +20.6%**, because `temporal-polyfill/full` replaced
  the base build in 0.5.0. That is in every shape reaching `index.js`, so it is in the baseline
  the rig now compares against, not a future cost.
- Measure in a real app (e.g. itrvl) before rewriting  

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
- Business days, ISO week suite  
- Rich display / i18n — **out of scope** (Temporal+Intl or date-fns TZ formatters)  
- See the Order section for what each remaining row costs in semver.  

**Done:** 0.2 calendar surface; expanded ISO years; `isValid(Date)` throws; `isSameDay` = `isEqual`;
date-fns index traps (0-based month, Sunday week, etc.); **0.4.0** `day()` and the Node 20.19 floor;
**0.5.0** the four year-relabel calendars, the measured rule, and `temporal-polyfill/full`. The
calendar surface is documented in `README.md`; the measurement is in `CHANGELOG.md` at `[0.5.0]`.

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

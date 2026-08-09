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

- ~~Dynamic import / optional peer for native Temporal~~ — **measured, dead end.** The polyfill still ships in a lazy chunk, and it forces the whole API async.
- **`temporal-polyfill/fns/PlainDate`** is the live option. Measured with esbuild 0.28.1, minified, ESM, browser, on a three-call program:

  | shape | min | gzip |
  |---|---|---|
  | class API (today) | 56,448 B | 19,806 B |
  | fns, string out | 16,814 B | **6,423 B** |
  | fns, but returning a real `PlainDate` | 59,994 B | 20,791 B |

  Returning a `PlainDate` costs the whole saving and more, because `fns.toTemporal` builds with a free `Temporal` global and throws without native support, so the class API comes back in. Returning strings is what keeps this option open.
- `day()` now uses `Temporal.Instant` and `ZonedDateTime`. That is free today and will add bytes to a fns port. **Not yet measured.**
- Absolute byte counts do not transfer between experiments; only an A/B inside one does.
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

  Two questions the PR must still answer:

  1. **`japanese` is era-based.** `.year` reads 2026 but `.eraYear` reads 8 for Reiwa 8. A
     year-offset rule does not describe it, so it may need its own decision.
  2. **The object / string asymmetry belongs to Temporal.** A string's date part is always ISO;
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

# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

daymath claims to run everywhere. This makes that testable, and fixes what testing found.

### Fixed

- **A `Temporal.PlainDate` from another implementation is no longer rejected.** `toPlainDate` tested `value instanceof Temporal.PlainDate`, which recognises one class. A date from native Temporal, or from a second copy of `temporal-polyfill` in the same dependency tree, threw `TypeError: date must be ISO 8601 day string or Temporal.PlainDate` — and `isValid` answered `false` for a perfectly valid date. Every input now reduces to its ISO day string first, so daymath owns the instance it works with. The common source of one of these is `Temporal.Now.plainDateISO()`, since daymath has no `today()`.
- **A non-interval argument now names the interval.** `eachDayOfInterval(new Date())`, `…([])` and `…(plainDate)` all reported `start must be ISO 8601 day string`, blaming a property the caller never passed, because the guard was a bare `typeof x === 'object'`. All six interval-reading exports now say `interval must be { start, end }`.

### Changed

- **Error messages no longer quote Temporal's own text.** `daymath: addDays could not produce a valid date (Out-of-bounds date)` becomes `daymath: addDays could not produce a valid date`. Implementations word the same failure differently — native V8 says `Temporal error: epoch days exceed maximum range.` — so the quoted text made daymath's message vary by runtime. The original error is still on `cause`. It was the only remaining difference across implementations, in 612 calls of a 46,512-call sweep at the time. It is now 0.
- **A non-ISO calendar is refused rather than reinterpreted.** `2026-01-31[u-ca=buddhist]` is the same day as `2026-01-31`, but Thai Buddhist years run 543 ahead, so it is year 2569. Accepting it would make `getYear` answer `2026` where the caller's own object says `2569`. Calendars like `hebrew` and `chinese` renumber the month and day as well. Strings carrying an annotation were already refused; objects now match. A caller who means the ISO day can convert deliberately with `withCalendar('iso8601')`.

### Added

- **`day(moment?, tz?)`** — the way in. It answers the calendar day of a moment, in a zone.

  ```js
  day()                                  // '2026-08-08'  now, UTC
  day('Asia/Tokyo')                      // now, named zone
  day(row.createdAt)                     // a Date, UTC
  day(row.createdAt, 'America/New_York') // same instant, the evening before
  day(1761616161771)                     // epoch milliseconds
  day('2026-05-05')                      // already a day
  ```

  Both defaults are stated rather than assumed: the moment is now, the zone is UTC. A number is epoch **milliseconds**, exactly as `new Date(n)` reads it, truncated the same way, so a fractional value is not an error. A day carries no time, so a zone does not apply to one — but the zone is still validated, so a typo fails whatever the moment is. `'11/12/2026'` is refused, because nobody can tell November from December in it. A lone string is a zone unless it has the shape of an ISO day, which is unambiguous — none of the 418 IANA zones this runtime knows even contains a digit.

  This is the only export that reads a clock, and the only door a `Date` may enter by. Nothing carries a zone past it, and nothing returns a `Date`. Give it a moment and it is a pure function, which is how the cross-runtime battery covers it.

  Two things it deliberately does not do. It does not guess whether a number is seconds or milliseconds: 13 digits means milliseconds for 2001–2286 and seconds for the year 275760, and both are inside the supported range, so no digit or magnitude rule can separate them. It does not default the zone to the system zone, because that answer changes by region.

- **`npm run test:runtimes`** — a cross-runtime baseline over every export, hashed per export. The call count lives in `scripts/cross-runtime.baseline.json` rather than in prose, so it cannot go stale. CI runs it on Node 20–26, on **Deno**, which ships native Temporal, and on **Bun**. It is the only check that can see the polyfill and the standard disagree.
- Tests for each fix, including a law that a foreign `PlainDate` must be indistinguishable from its ISO day string across every export, enumerated from the module rather than a hand-written list.
- A bundle-size badge.
- **Lint, format and type gates**, all three run in CI on the primary Node version:
  `npm run lint` (oxlint), `npm run format:check` (oxfmt) and `npm run typecheck` (tsc).
  The configs are `oxlint.jsonc`, `oxfmt.json` and `tsconfig.json` — deliberately not dotfiles.

  The type gate is the one that earned its place immediately. `tsc --checkJs` reads the JSDoc in
  `index.js`, so it covers the implementation and not only the declarations, and it found a
  wrong type on a public option: `weekStartsOnFrom` was annotated `@returns {0|1|2|3|4|5|6}`
  while returning `7`, the default, since 0.3.0 widened the range. Runtime was always correct.
  100% coverage, the differential harness and the cross-runtime baseline all missed it.

### Removed

- **Node 18.** It went end-of-life in April 2025. `engines` is now `>=20.19.0 <21 || >=22.12.0`, which states the real constraint: `require('daymath')` needs Node's `require(esm)`, which landed in 20.19 and 22.12. The range closes the gap at 22.0–22.11 rather than rounding it away. Dropping 18 also allows `Array#toSorted`, which is ES2023.
- `globalThis.Temporal ?? TemporalPolyfill`. `temporal-polyfill` already resolves native itself, so this duplicated the check and hid where it happens.

## [0.3.0] — 2026-08-07

Index bases and the unit counts change, so this release is `0.3.0`. It also carries
the range-error fixes that had been sitting unreleased since `0.2.3`.

### Changed

- **`getMonth` / `setMonth` are ISO 1–12**, where `1` is January, replacing date-fns's 0–11. The number now matches the `MM` field of the day string: `getMonth('2026-01-31')` is `1`, and `setMonth(d, 1)` means January. `setMonth(d, 0)` throws; `setMonth(d, 12)` is December, where it used to throw.
- **`getDay` is ISO 1–7**, `1` Monday through `7` Sunday, replacing date-fns's 0–6. Only Sunday changes number; Monday to Saturday are 1–6 either way. This also matches `Intl.Locale#weekInfo.firstDay`.
- **`differenceInMonths` counts a month as full when `addMonths` would carry the earlier date to the later one.** `differenceInMonths('2026-02-28', '2026-01-31')` is `1`, was `0`. That makes `differenceInMonths(addMonths(d, n), d) === n` hold — 21,934 violations to 0 over 1,761,936 cases. It moves exactly the pairs where `addMonths` had to clamp, and nothing else. `differenceInQuarters` follows, being `trunc(months / 3)`.

  Temporal's `since` is no longer used here. `since` has no overflow option, so it counted 28 days rather than one month for that pair, while `add` clamps. daymath clamps on every operation that builds a date, so the measurement now matches.
- **`differenceInYears` uses the same rule**, so 29 February to 28 February of a common year is one year. `differenceInYears(addYears(d, n), d) === n` now holds — 444 violations to 0 over 880,968 cases — and `differenceInYears === trunc(differenceInMonths / 12)`, which the month change alone had broken in 98 of 954,382 pairs. date-fns has this defect too and has not fixed it, so this is the one place daymath deliberately diverges from both published and patched date-fns.
- **`differenceInWeeks` and `differenceInQuarters` no longer return `-0`.** `Math.trunc` keeps the sign of a negative gap that truncates to zero, so a backwards difference of 1–6 days, or 1–2 months, returned `-0` where every other function returned `0`. `compareDesc` was already fixed for this; these two were missed. A test now sweeps every numeric export, enumerated from the module rather than a hand-written list.
- `weekStartsOn` accepts `1`–`7` and defaults to `7` (Sunday). `0` also means Sunday, since 0 ≡ 7 (mod 7) and the week-offset arithmetic cannot tell them apart. No week start moves and no date changes; only `8` and above now throw.
- `isSunday` / `isWeekend` follow the new weekday numbers. Their results are unchanged.

### Fixed

- `eachDayOfInterval` / `eachMonthOfInterval` no longer throw when the interval ends on the maximum `PlainDate` (`+275760-09-13`); the walkers stop on the last day instead of stepping past it
- Range failures now carry the `daymath:` prefix and the original Temporal error as `cause`, instead of leaking a bare `Out-of-bounds date`. This covers every function that can reach the edge of the `PlainDate` range: the `add*` / `sub*` family, `setYear` / `setMonth` / `setDate`, the eight `startOf*` / `endOf*` functions, `isSameWeek`, and `eachMonthOfInterval` / `eachYearOfInterval`
- The message names the function the caller called. `subDays` used to report `addDays`, `addQuarters` reported `addMonths`, and `isSameWeek` reported `startOfWeek`
- `compareDesc` returns `0` (not `-0`) for equal days

### Changed

- Docs only: corrected the `areIntervalsOverlapping` JSDoc (`inclusive` defaults to **false**, matching the types, the tests and date-fns); documented that `setDate` constrains past the month end; README now states the real CI matrix (Node 18–26)

### Documented

- Supported range `-271821-04-19` … `+275760-09-13` (the `Temporal.PlainDate` limit) in README, `llms.txt`, `index.js` and `index.d.ts`, now covered by a test — the expanded-year form was advertised without a ceiling, so `parse('+999999-01-01')` threw against the docs

## [0.2.3] — 2026-08-06

### Added

- Hard **100%** coverage gate via **c8** (lines / functions / branches); `coverage/lcov.info` for Codecov
- Codecov upload in CI (Node 24) + README badge
- CI matrix **Node 18 / 20 / 22 / 24 / 26**; Actions `checkout` / `setup-node` **v7**
- GitHub Packages: **`@leemr/daymath`** (`scripts/publish-github-packages.mjs`, `publish-github-packages` workflow)
- OSS baseline: `CONTRIBUTING.md`, `SECURITY.md`, `llms.txt`, `examples/basic.mjs`
- Open Graph card `docs/og.png` for Pages unfurls
- Master branch protection (required Node checks; no force-push/delete)

### Changed

- `package.json` `homepage` → Pages; `sideEffects: false`; richer keywords

## [0.2.2] — 2026-08-06

### Added

- 100% line/branch/function coverage on `index.js` (`npm run test:coverage`)
- README badges and shorter front matter
- GitHub Pages playground (`docs/index.html` → https://leemr.github.io/daymath/)

## [0.2.1] — 2026-08-06

### Changed

- `isValid(Date)` **throws** `TypeError` (invalid strings still return `false`)
- Accept expanded ISO 8601 years: `±YYYYYY-MM-DD` (e.g. `+010000-01-01`)

### Added

- `FUTURE.md` backlog

## [0.2.0] — 2026-08-06

### Added

- Bounds: `startOf`/`endOf` Week, Month, Year, Quarter
- Same-unit: `isSameDay` (alias of `isEqual`), Week, Month, Year, Quarter
- Weekday helpers: `isSunday`…`isSaturday`, `isWeekend`, first/last day of month
- Diffs: weeks, months, calendar months, years, calendar years, quarters, calendar quarters
- Getters/setters: year, month (0–11), date, day (0=Sun), dayOfYear, daysInMonth, quarter, leap, set*
- Intervals: `eachDay`/`eachMonth`/`eachYearOfInterval`, `isWithinInterval`, `clamp`, `areIntervalsOverlapping`
- `addQuarters` / `subQuarters`

## [0.1.0] — 2026-08-06

### Added

- Real API: parse/format/isValid, add/sub days/weeks/months/years, differenceInDays, compare helpers
- `temporal-polyfill` dependency; JS + `index.d.ts`
- `node:test` suite

## [0.0.1] — 2026-08-06

### Added

- Package name reserved on npm; stub `addDays` throws “not implemented”

[Unreleased]: https://github.com/leemr/daymath/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/leemr/daymath/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/leemr/daymath/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/leemr/daymath/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/leemr/daymath/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/leemr/daymath/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leemr/daymath/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/leemr/daymath/releases/tag/v0.0.1

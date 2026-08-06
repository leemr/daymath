# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/leemr/daymath/compare/v0.2.3...HEAD
[0.2.3]: https://github.com/leemr/daymath/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/leemr/daymath/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/leemr/daymath/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/leemr/daymath/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leemr/daymath/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/leemr/daymath/releases/tag/v0.0.1

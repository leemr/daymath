# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/leemr/daymath/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/leemr/daymath/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/leemr/daymath/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/leemr/daymath/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leemr/daymath/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/leemr/daymath/releases/tag/v0.0.1

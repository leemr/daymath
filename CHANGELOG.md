# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

daymath claims to run everywhere. This makes that testable, and fixes what testing found.

### Fixed

- **`day()` no longer reads an ISO timestamp string as a time zone and answers today.** `day('1999-01-01T00:00:00Z')` returned the current day, silently, on every runtime. A lone string was treated as a zone unless it had ISO **day** shape, and a timestamp does not — so it went into the zone slot, where Temporal's zone grammar accepted it, because that grammar reads the zone out of a whole timestamp. It is the worst input class to lose: an ISO timestamp string is what `JSON.parse`, a REST response and most SQL drivers hand you, and the README's own `day(row.createdAt)` example hits it whenever the row arrives as a string rather than a `Date`. The answer also changed at every UTC midnight, so a test written one day passed and the same code answered differently the next. A lone string now takes one of three roles in a fixed order — a day, then an instant, then a zone — and the zone test is by **shape**, so a timestamp can never take the zone role.
- **`day()` threw away a zone the string named.** `day('2026-08-08T20:00:00-04:00[America/New_York]')` answered `'2026-08-09'` where the caller's own `ZonedDateTime.toPlainDate()` said `'2026-08-08'`. daymath read the instant, discarded the annotation and applied its UTC default — over a zone the caller had stated. Plain `toString()`, `toJSON()` and `JSON.stringify` all write that spelling, so a browser posting its own timestamp had its date moved by a day. The critical form `[!America/New_York]` was ignored too, which RFC 9557 forbids outright. A bracketed zone is now honoured: the string keeps its own civil day. The bracket is the signal, because Temporal itself refuses to build a `ZonedDateTime` from a bare offset. Passing `tz` as well throws `two time zones`, matching `day('utc', 'Asia/Tokyo')`. Naming a zone and resolving as one are separate questions, so a string that names one and fails — an offset its own zone contradicts, or a misspelled name — is an error rather than a silent fall back to UTC. This also settles a narrower rule: daymath refuses a timestamp only when it would have to *pick* a zone, so `'2026-08-08T12:00'` is still refused and `'2026-08-08T12:00[America/New_York]'` is now accepted.
- **An ISO time-only string still took the zone role.** The first shape test read "a zone starts with a letter", and an ISO time-of-day starts with `T`. So `day('T12:00:00Z')` answered today on native Temporal and threw on `temporal-polyfill` — the same defect, narrowed rather than closed. The shape test is now an IANA name, which carries no `:`, or a bare offset. The compact spelling `'T120000Z'` has no `:` to catch it, so a `(?![Tt]\d)` guard covers that one. Verified against every zone this runtime knows: 0 of 418 rejected, plus the aliases `UTC`, `GMT`, `US/Eastern`, `Asia/Calcutta` and `Etc/GMT+5`.
- **A non-ISO calendar is now refused on the string, before any parse.** `day()` adjudicated the calendar per path, so a `[u-ca=buddhist]` sitting behind a zone bracket missed every check and came back out as `'2026-08-08[u-ca=buddhist]'` — a value `isValid` answers `false` for and every other export throws on. Worse, it split by implementation: native Temporal builds that `ZonedDateTime` and `temporal-polyfill` refuses to, so the CI matrix disagreed with itself. One check now runs on the string first, before any parse, so all three runtimes give the same message. The rule it settles is narrower than "refuse the annotation everywhere": a calendar is refused **where it is applied**. With a zone bracket it is applied, because the fields get renumbered. Without one, `'2026-08-08T20:00:00Z[u-ca=buddhist]'` names an `Instant`, which has no year, month or day for a calendar to renumber — so the annotation is inert and the day is answered.
- **`day()` alone refused `[u-ca=iso8601]`.** The other 68 exports accepted it, so `isValid` called the string a valid day while `day()` called it neither a moment nor a zone. `day()` asked "is this a day?" with its own copy of the test. Both now call one predicate, `bareDay`, which is the only place that question is answered. Calendar names also compare case-insensitively now, as BCP-47 requires, so `[u-ca=ISO8601]` no longer draws an error naming the ISO calendar as the reason to refuse the ISO calendar.
- **A non-string `tz` threw someone else's error.** `day(0, Object.create(null))` reported `Cannot convert object to primitive value`, because the shape test coerces its argument and sits outside the guard. A `typeof` test now runs first, so the message is daymath's own again.
- **`day()` answered differently on different Temporal implementations.** `day('2026-08-06', '2026-08-08T25:00:00Z')` threw on native Temporal and returned `'2026-08-06'` on `temporal-polyfill`: hour 25 is a time zone to one and not to the other. The zone argument is now checked by shape before any implementation sees it, so every runtime gives the same answer. The cross-runtime battery found this on its first run against the new malformed-string probes.
- **A `Temporal.PlainDate` from another implementation is no longer rejected.** `toPlainDate` tested `value instanceof Temporal.PlainDate`, which recognises one class. A date from native Temporal, or from a second copy of `temporal-polyfill` in the same dependency tree, threw `TypeError: date must be ISO 8601 day string or Temporal.PlainDate` — and `isValid` answered `false` for a perfectly valid date. Every input now reduces to its ISO day string first, so daymath owns the instance it works with. The common source of one of these is `Temporal.Now.plainDateISO()`, since daymath has no `today()`.
- **A non-interval argument now names the interval.** `eachDayOfInterval(new Date())`, `…([])` and `…(plainDate)` all reported `start must be ISO 8601 day string`, blaming a property the caller never passed, because the guard was a bare `typeof x === 'object'`. All six interval-reading exports now say `interval must be { start, end }`.

### Changed

- **Error messages no longer quote Temporal's own text.** `daymath: addDays could not produce a valid date (Out-of-bounds date)` becomes `daymath: addDays could not produce a valid date`. Implementations word the same failure differently — native V8 says `Temporal error: epoch days exceed maximum range.` — so the quoted text made daymath's message vary by runtime. The original error is still on `cause`. It was the only remaining difference across implementations, in 612 calls of a 46,512-call sweep at the time. It is now 0.
- **A non-ISO calendar is refused rather than reinterpreted.** `2026-01-31[u-ca=buddhist]` is the same day as `2026-01-31`, but Thai Buddhist years run 543 ahead, so it is year 2569. Accepting it would make `getYear` answer `2026` where the caller's own object says `2569`. Calendars like `hebrew` and `chinese` renumber the month and day as well. Strings carrying an annotation were already refused; objects now match. A caller who means the ISO day can convert deliberately with `withCalendar('iso8601')`.
- **A non-ISO calendar now reports itself, instead of looking malformed.** `2026-01-31[u-ca=buddhist]` failed the ISO day-shape check and answered `date must be ISO 8601 day YYYY-MM-DD or ±YYYYYY-MM-DD`. The string is well formed; it is a different calendar. It now answers `date must use the ISO 8601 calendar, not "buddhist" (convert with withCalendar('iso8601'))`, which names the cause and the way through. The critical form `[!u-ca=…]` is refused the same way.
- **`[u-ca=iso8601]` is now accepted, and dropped.** Temporal writes that annotation itself for `toString({ calendarName: 'always' })` — and `[!u-ca=iso8601]` for `'critical'` — so a caller round-tripping their own `PlainDate` through a string was refused. The annotation names the very calendar daymath reads, so refusing it was arbitrary. Every other calendar is still refused.
- **One tagline ending, on every surface.** The five human-facing taglines all made the same promise in five different spellings — `No time zones.` alone in the npm description, `No Date / time zones.` in the module header, lower-case and comma-separated on the social card. They now end `No Date. No time zones.` The npm description gained `No Date`, which it was the only surface to omit. The claim is about daymath's *values*: none holds a `Date` or a zone. `day()` converts at the boundary and stores neither. `llms.txt` keeps the longer wording, because a model reading it gets no tagline and can use the explanation.

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

  Both defaults are stated rather than assumed: the moment is now, the zone is UTC. A number is epoch **milliseconds**, exactly as `new Date(n)` reads it, truncated the same way, so a fractional value is not an error. A day carries no time, so a zone does not apply to one — but the zone is still validated, so a typo fails whatever the moment is. `'11/12/2026'` is refused, because nobody can tell November from December in it.

  An ISO timestamp carrying `Z` or an offset names an exact instant, so `day()` reads it as a moment: `day('1999-01-01T00:00:00Z')` is `'1999-01-01'`. One carrying neither is refused — `'2026-08-08T12:00'` names no instant, and daymath will not pick a zone on your behalf.

  This is the only export that reads a clock, and the only door a `Date` may enter by. Nothing carries a zone past it, and nothing returns a `Date`. Give it a moment and it is a pure function, which is how the cross-runtime battery covers it.

  Two probe lists now run through the cross-runtime battery. `JUNK` holds **21** strings that must be refused, in three argument slots — first, second, and inside an interval. It carries the SQL spelling `'2026-08-08 12:00:00'`, a bare `'12:30:00'`, the ISO time-only `'T12:00:00Z'` and its compact `'T120000Z'`, hour 25, month 13, an offset that contradicts its own zone, a misspelled zone, and four calendar annotations. `INSTANTS` holds **11** timestamps that must be accepted, each in the first slot against four zones, including both range edges, a bracketed zone and its critical spelling.

  Every export throws on every `JUNK` entry where it reads the value. In the second slot **28** exports ignore the extra argument and answer normally, which the battery records either way, and `isValid` answers `false` by contract.

  The battery previously passed only `Date` objects and numbers, so no probe ever fed a bad *string*, which is how the `day()` defect above survived 100% coverage, three harnesses and three runtimes.

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

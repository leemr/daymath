# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] — 2026-08-09

### Changed

- **daymath is built on `temporal-polyfill/fns` instead of the `Temporal` class, and nothing a caller can observe changes.** A class is one unit to a bundler — it cannot prove a method unreachable — so the class build shipped whole for the twenty-odd operations daymath uses. Free functions drop what is not called. Measured by `npm run size` in one run: the three-call program goes **24,735 B gzip to 16,295 B, −34%**; the whole surface goes 27,304 B to 21,550 B, −21%; the three-call program plus `day()` goes 25,269 B to 19,349 B, −23%. The baseline was re-recorded on purpose.
- **`getAny` is the calendar resolver, and a narrower one would have been a defect.** `fns` takes the resolver as a required argument, and it fixes at build time which calendars the bundle admits. Under `getISO` the same program answers two ways: the native funcApi keeps `[u-ca=buddhist]` and reads 2569, the shim funcApi drops the annotation and reads 2026. Node 20 and Bun are the shim lanes in CI. `getAny` carries the calendar data itself and answers identically with no global, with a base polyfill global, with a full one, and on native — so daymath's calendar rule stays a measurement rather than becoming a build-time list. It is the 4.2 kB the calendars already cost in 0.5.0, now paid at a different layer.
- **daymath no longer reads `globalThis.Temporal` at all.** The selection block 0.5.0 added is deleted, along with the `c8 ignore` regions that covered its unreachable branches. `fns` picks its own funcApi, and `getAny` makes that choice unobservable in every answer, so the defect class 0.5.0 shipped and then fixed — a base polyfill global silently costing three of four calendars, decided by import order — cannot recur here. The child-process test that installs a base global still passes and now proves something stronger.

### Fixed

- **`differenceInDays` uses `fns` `diff`, not `diffDays`, and the reason is the one day where Temporal's two ranges disagree.** `PlainDate`'s minimum is `-271821-04-19`, one day below `PlainDateTime`'s, because midnight on that day is out of bounds while the day itself is reachable in a positive-offset zone. The maximum is not widened, so only the low edge has it. `diffDays` converts to a `PlainDateTime` and inherits the narrower limit, so it throws on exactly that one operand; `diff` with `largestUnit: 'day'` does not, and answers what the class API's `since` answered. Caught by the cross-runtime baseline, which turned `differenceInDays` and `differenceInWeeks` red. No test in the suite covers a pair that wide.

### Verified

- **Every export answers identically, before and after.** The battery was run against both implementations in one process and compared row by row: **69 exports, 62,928 calls, 0 differences.** The cross-runtime baseline is unchanged and passes on Node 26.7.0, Deno 2.9.5 and Bun 1.3.14 — a re-record would have hidden exactly this. The differential harness against date-fns is unchanged and green over 1900-2100, coverage stays 100% on lines, functions and branches, and the 94 tests pass unedited.

## [0.5.0] — 2026-08-09

### Added

- **daymath accepts a calendar annotation that only relabels the year, and the annotation rides along.** `buddhist`, `roc`, `japanese` and `gregory` all pass, so `getYear('2026-01-31[u-ca=buddhist]')` answers `2569`, `addDays` returns `'2026-02-01[u-ca=buddhist]'`, and `setYear(…, 2570)` returns `'2027-01-31[u-ca=buddhist]'`. Before this, every non-ISO calendar was refused outright, which was a wider refusal than the problem needed: normalising to ISO would have answered `2026` where the caller's own object says `2569`, but carrying the calendar answers `2569` and loses nothing.
- **The line is measured at runtime, not held as a list.** Nothing in `calendarRule` names a calendar, so a calendar CLDR adds later is admitted or refused by the same measurement with no code change. Two conditions, both required, on nine probe dates spanning 1900 to 2100: the month and day must equal the ISO fields, and the year offset must be constant. Of the sixteen calendars this runtime can build, five pass — the four above plus `iso8601` — and eleven are refused.
- **A month *count* would have been the wrong test, and `hebrew` proves it.** `monthsInYear` is 13 in 2024, 12 in 2025, 12 in 2026 and 13 in 2027, because `hebrew` is lunisolar. Comparing the month and day fields against `withCalendar('iso8601')` is correct in every year.
- **Two probe pairs straddle a Japanese era boundary**, 1989-01-07/08 and 2019-04-30/05-01. An era change *inside* one ISO year is what separates a year label from a year renumbering, and a single probe cannot see it.
- **The rule reads Temporal, and reading `Intl` instead would have been wrong.** `Intl` reports the *era* year: Reiwa 8 for `japanese` and B.R.O.C. 12 for `roc` in 1900. Temporal reports a continuous year for both, so both are pure labels — Temporal's `roc` year for 1900 is `-11`, not "12 before". Temporal is what daymath answers with, so Temporal is what the rule asks.

### Changed

- **`temporal-polyfill/full` replaces `temporal-polyfill`, at a cost of 4.2 kB gzip.** The base build cannot construct `buddhist`, `roc`, `japanese` or `hebrew` at all where the runtime has no native Temporal: it throws `Unknown calendar buddhist; might need temporal-polyfill/full`. Node 20 and Bun are on that path in CI. Without `full`, the same input would have worked on half the lanes and thrown on the other half, which is the failure mode daymath's cross-runtime harness exists to catch. The 4.2 kB buys identical answers everywhere rather than any new capability. Measured by `npm run size`, which refused to pass until the baseline was re-recorded on purpose: 20,508 B to 24,735 B gzip on a three-call program, +20.6%.
- **A mixed calendar pair now measures instead of throwing.** `differenceInDays('2026-03-01', '2026-01-31[u-ca=buddhist]')` answers `29`. Temporal's own `since` and `until` refuse two calendars with `Mismatched calendars`, and its `equals` compares the calendar as well as the day. Neither matters to a day count, because a day is the same day whatever its year is labelled, so daymath normalises both operands to ISO for measurement.
- **`isSameWeek` used `Temporal`'s `equals` and now uses `compare`.** `equals` compares the calendar too, so it answered `false` for the same week written in two calendars. It was the only export using `equals`; `isEqual` already used `compare` and was never affected. Latent until this release, because every non-ISO calendar was refused before it.
- **`eachYearOfInterval` no longer builds each 1 January with `PlainDate.from({year})`.** The object form reads `year` as an *ISO* year, which is 543 years out for a Buddhist day. It now walks with `with` then `add`, both of which keep the calendar. The loop condition also moved after the push, because 1 January of `+275760` is a valid day and adding a year to it is not.
- **`day()` is the normaliser, and it is the one export that drops the annotation.** It accepts every annotation the other 68 accept, and returns a plain ISO day for all three input shapes — an instant, a zoned string, and a day. So `day('2026-08-08T12:00[America/New_York][u-ca=buddhist]')`, `day('2026-08-08T20:00:00Z[u-ca=buddhist]')` and `day('2026-08-08[u-ca=buddhist]')` all answer `'2026-08-08'`. `parse` validates and preserves; `day` normalises. Carrying it in `day()` was tried first and could not be made consistent: an `Instant` has no fields for a calendar to renumber, so that path has nothing to carry, and the same annotation would have behaved two ways in one function.
- **`day()`'s `@returns` no longer claims `YYYY-MM-DD` alone.** That was already wrong before this release: `day('+010000-01-01')` returns an expanded year. It now states every case it can return.

### Fixed

- **The calendar selection is written out, because `temporal-polyfill/full` never defers to native Temporal.** Only the package's BASE entry resolves `globalThis.Temporal || bundled`; the `/full` entry is a bare re-export, byte-identical to `/full/implementation`, which the polyfill's own README documents as "forced non-native". So switching to `/full` for the calendars silently stopped daymath using native Temporal on every runtime, including Node 26 and Deno. Proof at the right layer: daymath re-throws Temporal's own message on `cause`, and that message read `Out-of-bounds date` (the polyfill) where it now reads `Temporal error: Date is not within ISO date time limits.` (native). daymath now selects `globalThis.Temporal ?? bundled` itself. Measured cost: **17 B gzip**, because the polyfill ships either way — a bundler cannot know at build time whether the runtime has Temporal. Native and the bundled full build agree on every calendar daymath touches: 464 date/calendar pairs over the four accepted calendars from 1900 to 2100, and the eleven refused ones, with zero disagreements.
- **Nine exports measured a mixed calendar pair in two coordinate systems at once, and answered silently wrong numbers.** Only `differenceInDays` normalised. `differenceInMonths` took its *sign* from `Temporal.PlainDate.compare`, which ignores the calendar, and its *magnitude* from `differenceInCalendarMonths`, which does not — so a 29-day gap measured **6,513 months**, and two days 543 ISO years apart measured **0 months and 0 years** with `isSameYear` answering **true**. Now normalised: `differenceInMonths`, `differenceInYears`, `differenceInQuarters`, `differenceInCalendarMonths`, `differenceInCalendarYears`, `differenceInCalendarQuarters`, `isSameMonth`, `isSameYear` and `isSameQuarter`. The rule is now uniform and stateable: **every export that takes two dates measures in one coordinate system; only a single-date field read or write honours the year label.** Normalising never changes an answer when both operands name the same calendar — verified over 125 same-calendar pairs across all five accepted calendars, zero divergences — so it only ever fixes the mixed case. The re-recorded cross-runtime baseline had pinned eight of these wrong answers as expected.
- **The calendar verdict cache grew without bound from caller input and never released.** It keyed on whatever sat between `[u-ca=` and `]`, with no length limit and no cap, and the check ran *before* the day-shape check, so a string that was not a date at all still wrote a permanent entry. Measured: 200,000 distinct rejected ids retained **56.5 MB**, and one 1 MB id retained 1 MB. The quiet path was `isValid`, which swallows the `RangeError`, so a loop raised nothing and logged nothing.

  A BCP-47 **shape** guard was the first attempt and closed only half of it. It bounded the key *length* and not the entry *count*, so any correctly shaped string still bought a permanent entry: 800,000 distinct guard-passing ids retained **76.8 MB**. Case made it worse, because the shape test ignored case while the `Map` key did not, so one calendar name held 256 keys.

  The fix is a **closed set**: an id is probed and cached only when `Intl.supportedValuesOf('calendar')` names it, matched case-insensitively. Entries can therefore never exceed what the runtime has — 18 on Node 26. Re-measured after the change: the same 800,000-id attack retains **0.0 MB**, 900,000 case variants retain 0.0 MB, and the length cap and its pattern are gone, which removes the last quadratic-regex risk from the file.
- **`npm run test:runtimes` now asserts WHICH implementation daymath selected, on every lane.** Its banner had always reported what the *runtime* has, never what daymath picked, and that gap is how the defect above shipped: the banner read "native Temporal" on Node 26 while daymath ran the bundled polyfill, and nothing failed. The observable is the message daymath re-throws on `cause` — daymath's own errors carry no Temporal text, but the original is kept, and the two implementations word an out-of-range date differently. Both expected messages are asked of each implementation at run time rather than hardcoded, so a polyfill release that rewords its error makes the check fail loudly instead of passing blind. The assertion is capability-relative, not a fixed expectation: Node 26 and deno must select native, and Node 20 and bun must select the bundled build. **Proved to block**: planting the original defect exits 1 on Node 26 and still exits 0 on bun, where the bundled build is the correct answer.
- **A global `Temporal` is not necessarily native, and selecting it blindly cost three of the four calendars.** An app doing `import 'temporal-polyfill/global'` installs the polyfill's BASE build, which can construct only `iso8601` and `gregory`. Node 20 and 22 are in `engines` and have no native Temporal, so on them a polyfill global is the only kind there is. daymath then refused `buddhist`, `roc` and `japanese` with an error that blamed the caller's calendar rather than naming the capability loss, and **import order decided it** — loading daymath before the app's shim worked, after it did not. The candidate is now probed rather than trusted: daymath asks the runtime for a calendar beyond the basic two and tries to build it. The probe names no calendar, so the "method, not a list" rule still holds. A child-process test pins the whole scenario.

### Documented

- **Do not pass a non-ISO calendar's own year as a bare ISO year.** This is the one way to get a wrong answer from daymath with no error, and it is now in the README, `llms.txt` and a test. Buddhist 2567 is ISO 2024, a leap year, but 2567 read as an ISO year is not, because the offset is 543 and 543 mod 4 is 3. So `isLeapYear('2567-01-01')` is `false`, February has 28 days, `parse('2567-02-29')` throws, and `addDays('2567-02-28', 1)` answers `'2567-03-01'` — which looks reasonable and is a day early for the rest of that year. **The two rules disagree in 49 of the 101 Buddhist years from 2500 to 2600.** February is the only month affected, because it is the only one whose length varies. The annotated form is correct in every year, which is what the annotation is for.
- **A JS `Date` has no calendar component**, so it cannot carry a Buddhist year. It is one number of milliseconds, and `getUTCFullYear()` is always Gregorian. A Thai user's `Date` already holds 2026; the 2569 exists only at display time, through `Intl` with `u-ca-buddhist`.
- **Temporal's fields form is the correct converter from a calendar's own year number**, and it is the one place the fields/string asymmetry helps: `Temporal.PlainDate.from({year: 2569, month: 8, day: 8, calendar: 'buddhist'})` is `'2026-08-08[u-ca=buddhist]'`.
- **There is no string spelling that puts the calendar's year in the date part.** Temporal has four, and the date part is ISO in all of them. So `'2569-08-08'` is not that day in another notation; it is ISO year 2569, 198,327 days away. `'2569-08-08[u-ca=buddhist]'` is valid and its `getYear` is 3112, because the annotation adds 543 on top of an ISO 2569 date part.
- **A refused calendar and an unknown one now give different messages.** A calendar the runtime cannot build says `is not a calendar this runtime knows`, so a typo such as `[u-ca=buddhst]` is not reported as a renumbering calendar.

## [0.4.0] — 2026-08-08

daymath claims to run everywhere. This makes that testable, and fixes what testing found.

### Fixed

- **`day()` no longer reads an ISO timestamp string as a time zone and answers today.** `day('1999-01-01T00:00:00Z')` returned the current day, silently, on every runtime. A lone string was treated as a zone unless it had ISO **day** shape, and a timestamp does not — so it went into the zone slot, where Temporal's zone grammar accepted it, because that grammar reads the zone out of a whole timestamp. It is the worst input class to lose: an ISO timestamp string is what `JSON.parse`, a REST response and most SQL drivers hand you, and the README's own `day(row.createdAt)` example hits it whenever the row arrives as a string rather than a `Date`. The answer also changed at every UTC midnight, so a test written one day passed and the same code answered differently the next. A lone string now takes one of three roles in a fixed order — a day, then an instant, then a zone — and the zone test is by **shape**, so a timestamp can never take the zone role.
- **`day()` threw away a zone the string named.** `day('2026-08-08T20:00:00-04:00[America/New_York]')` answered `'2026-08-09'` where the caller's own `ZonedDateTime.toPlainDate()` said `'2026-08-08'`. daymath read the instant, discarded the annotation and applied its UTC default — over a zone the caller had stated. Plain `toString()`, `toJSON()` and `JSON.stringify` all write that spelling, so a browser posting its own timestamp had its date moved by a day. The critical form `[!America/New_York]` was ignored too, which RFC 9557 forbids outright. A bracketed zone is now honoured: the string keeps its own civil day. The bracket is the signal, because Temporal itself refuses to build a `ZonedDateTime` from a bare offset. Passing `tz` as well throws `two time zones`, matching `day('utc', 'Asia/Tokyo')`. Naming a zone and resolving as one are separate questions, so a string that names one and fails — an offset its own zone contradicts, or a misspelled name — is an error rather than a silent fall back to UTC. This also settles a narrower rule: daymath refuses a timestamp only when it would have to *pick* a zone, so `'2026-08-08T12:00'` is still refused and `'2026-08-08T12:00[America/New_York]'` is now accepted.
- **Two annotation patterns were quadratic, and CodeQL found them.** `js/polynomial-redos` flagged three sites, and timing confirmed all three: `'[u-ca='.repeat(64000)` cost 9.0 seconds and `'[!'.repeat(64000)` cost 6.8 seconds, each growing with the square of the input. The calendar pattern needed `^(.*)\[…\]$` because an annotation can sit behind another one, and that `.*` backtracks; the zone pattern was unanchored, which is the same defect an earlier commit had removed from the calendar pattern. Both questions are now answered with `indexOf` and `lastIndexOf` in one pass. 256,000 characters now cost 0.91 ms. Worth recording plainly: fifteen review agents had measured the *previous* revision of these patterns and reported them linear, so a static reader of the pattern caught what timing a stale version could not.
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

[Unreleased]: https://github.com/leemr/daymath/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/leemr/daymath/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/leemr/daymath/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/leemr/daymath/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/leemr/daymath/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/leemr/daymath/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/leemr/daymath/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/leemr/daymath/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/leemr/daymath/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leemr/daymath/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/leemr/daymath/releases/tag/v0.0.1

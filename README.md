# daymath

[![npm](https://img.shields.io/npm/v/daymath.svg)](https://www.npmjs.com/package/daymath)
[![ci](https://github.com/leemr/daymath/actions/workflows/ci.yml/badge.svg)](https://github.com/leemr/daymath/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/leemr/daymath/graph/badge.svg)](https://codecov.io/gh/leemr/daymath)
[![license](https://img.shields.io/npm/l/daymath.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/daymath.svg)](https://www.npmjs.com/package/daymath)
[![bundle](https://img.shields.io/bundlejs/size/daymath)](https://bundlejs.com/?q=daymath)

**ISO 8601** calendar day math. **date-fns-shaped** names. **Temporal.PlainDate** under the hood.

No `Date`. No time zones. No silent “local now.” ISO 8601 ❤️

[**Play →**](https://leemr.github.io/daymath/) · [npm](https://www.npmjs.com/package/daymath) · [Changelog](./CHANGELOG.md) · [Contributing](./CONTRIBUTING.md) · [FUTURE](./FUTURE.md)

```bash
npm install daymath
```

Same code also publishes to **GitHub Packages** as `@leemr/daymath` (scoped; see [GitHub npm registry docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)):

```bash
# one-time: map the scope (auth with a PAT that has read:packages, or GITHUB_TOKEN in Actions)
echo '@leemr:registry=https://npm.pkg.github.com' >> .npmrc
npm install @leemr/daymath
```

Most people should keep using **`daymath` on npmjs**.

```js
import { day, addDays, addMonths, differenceInDays, isSameDay } from 'daymath'

addDays('2026-08-06', 1)      // '2026-08-07'
addMonths('2026-01-31', 1)    // '2026-02-28'
differenceInDays('2026-08-06', '2026-08-01') // 5
isSameDay('2026-08-06', '2026-08-06')        // true
```

`day` is the way in. It turns a moment into a day, and it is the only function
that reads a clock.

```js
day()                                 // '2026-08-08'  now, UTC
day('Asia/Tokyo')                     // '2026-08-08'  now, named zone
day(row.createdAt)                    // '2026-08-07'  a Date, UTC
day(row.createdAt, 'America/New_York')// '2026-08-06'  same instant, evening before
day(1761616161771)                    // '2025-10-28'  epoch milliseconds
day('2026-05-05')                     // '2026-05-05'  already a day
addDays(day(), 2)                     // '2026-08-10'
```

Both defaults are **stated**, not assumed: the moment is now, and the zone is UTC.
UTC is still not your day for part of every day — it runs ahead of `America/New_York`
for 16.7% of the day, and behind `Asia/Tokyo` for 37.5% — so name your zone when
that matters.

Three rules worth knowing:

- A **number is epoch milliseconds**, exactly as `new Date(n)` reads it. A seconds
  timestamp read as milliseconds lands in 1970, with no error. daymath states the
  unit rather than sniffing it, because no rule can separate the two: 13 digits
  means milliseconds for 2001–2286 and seconds for the year 275760, and both are
  inside the supported range.
- A **day carries no time**, so a zone does not apply to one.
  `day('2026-05-05', 'Asia/Tokyo')` is `'2026-05-05'`.
- **`'11/12/2026'` is refused.** Nobody can tell November from December in it.

```bash
node examples/basic.mjs   # from a clone
```

## Why

`Date` is a timestamp. Hire dates, passport expiry, trip days are **calendar** values. daymath only does plain days as ISO strings.

| In | Out |
|----|-----|
| `YYYY-MM-DD` or expanded `±YYYYYY-MM-DD` | same forms (Temporal `toString`) |
| or `Temporal.PlainDate`, from any implementation | string |

A `Date` **throws** everywhere except `day()`, including in `isValid`.
`isValid('asdf')` → `false`.

`day()` is the single door a `Date` comes through, and it makes you name the zone
or take the stated UTC default. Nothing carries a zone past that point, and
nothing gives you a `Date` back.

Range: `-271821-04-19` … `+275760-09-13` — the `Temporal.PlainDate` limit, roughly ±10⁸ days from the epoch. A day outside it throws a `RangeError`.

## date-fns parity (names, not `Date`)

| Topic | daymath |
|-------|---------|
| Values | ISO day **strings**, not `Date` |
| `isSameDay` | Alias of `isEqual` |
| `isValid` | Valid daymath day; **`Date` throws** |
| `getMonth` / `setMonth` | **1–12** (1 = January) — ISO, **not** date-fns |
| `getDay` | **1–7** (1 = Monday, 7 = Sunday) — ISO, **not** date-fns |
| `weekStartsOn` | default `7` (Sunday); `0` also accepted |
| Intervals | `{ start, end }` |

## API

**Start here** — `day`  

**Parse** — `parse` · `format` · `isValid`  

**Add/sub** — Days · Weeks · Months · Years · Quarters  

**Get/set** — `getYear` · `getMonth` · `getDate` · `getDay` · `getDayOfYear` · `getDaysInMonth` · `getQuarter` · `isLeapYear` · `setYear` · `setMonth` · `setDate`  

**Bounds** — `startOf`/`endOf` Month · Year · Quarter · Week  

**Diffs** — Days · Weeks · Months · CalendarMonths · Years · CalendarYears · Quarters · CalendarQuarters  

**Compare** — `isBefore` · `isAfter` · `isEqual` · `isSameDay` · `isSameWeek` · Month · Year · Quarter · `compareAsc` · `compareDesc` · `min` · `max`  

**Weekday** — `isSunday`…`isSaturday` · `isWeekend` · first/last day of month  

**Intervals** — `eachDayOfInterval` · `eachMonthOfInterval` · `eachYearOfInterval` · `isWithinInterval` · `clamp` · `areIntervalsOverlapping`

Amounts are finite integers.

## Temporal

Uses global `Temporal` when present; otherwise [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill),
which does that resolution itself — so on a runtime with native Temporal the polyfill steps aside.

A `Temporal.PlainDate` from *any* implementation is accepted — native, the bundled polyfill,
or a second copy of it in the same dependency tree. daymath reads its ISO day and builds its
own instance, so it never depends on `instanceof` agreeing across copies. The common case is
`Temporal.Now.plainDateISO()`: daymath has no `today()` on purpose, so that is where a caller
gets one.

A non-ISO calendar is refused, as an object and as a string alike. Temporal can put one on a
`PlainDate`, and it names the same *day* with different numbers:

| calendar | year | month | day | `toString()` |
|---|---|---|---|---|
| `iso8601` | 2026 | 1 | 31 | `2026-01-31` |
| `buddhist` | **2569** | 1 | 31 | `2026-01-31[u-ca=buddhist]` |
| `hebrew` | 5786 | 5 | 13 | `2026-01-31[u-ca=hebrew]` |
| `chinese` | 2025 | 13 | 13 | `2026-01-31[u-ca=chinese]` |

Thai Buddhist years run 543 ahead, so the same day is 2569. Worse, the same number means two
different days depending on where you write it:

```js
Temporal.PlainDate.from('2026-01-31[u-ca=buddhist]')            // ISO 2026-01-31, .year 2569
Temporal.PlainDate.from({year: 2026, month: 1, day: 31,
                         calendar: 'buddhist'})                  // ISO 1483-01-31, .year 2026
```

543 years apart. The date part of a string is always ISO; the annotation changes how fields are
*read*, never how the string *parses*. daymath could strip the annotation and answer
`2026-01-31`, which is the right day — but `getYear` would then return `2026` where your own
object says `2569`. So it throws, and you convert deliberately:

```js
format(buddhistDate.withCalendar('iso8601'))   // '2026-01-31'
```

Error messages quote no Temporal text, because implementations word the same failure
differently. The original error is on `cause`.

Behaviour is checked against a recorded baseline on Node, Deno (which ships **native**
Temporal) and Bun — every export, `npm run test:runtimes`. The exact call count lives
in `scripts/cross-runtime.baseline.json`, which is the only place it cannot go stale.

## Requirements

ESM only, and it works on Node 18 and up.

`require('daymath')` is different: it needs **Node 20.19+ or 22.12+**, where `require(esm)`
landed. `temporal-polyfill` is also ESM-only, so a CJS build of daymath would not escape this.
Bundlers and browsers are unaffected. A Jest consumer needs a `transformIgnorePatterns` entry,
because Jest does not use Node's resolution.

## Types & tests

Plain JS + `index.d.ts` (no compile step). CI runs on Node 18, 20, 22, 24, and 26; the
coverage gate runs on 26, which is also the version in `.node-version` and the one used
to publish. The matrix still proves the floor.

```bash
npm test
npm run test:coverage   # c8: 100% lines/funcs/branches on index.js + lcov
```

CI uploads coverage to [Codecov](https://codecov.io/gh/leemr/daymath) (see [CONTRIBUTING.md](./CONTRIBUTING.md) for one-time app/token setup).

PRs welcome via fork — see [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: [SECURITY.md](./SECURITY.md).

## License

MIT

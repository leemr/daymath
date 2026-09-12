# daymath

[![npm](https://img.shields.io/npm/v/daymath.svg)](https://www.npmjs.com/package/daymath)
[![ci](https://github.com/leemr/daymath/actions/workflows/ci.yml/badge.svg)](https://github.com/leemr/daymath/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/leemr/daymath/graph/badge.svg)](https://codecov.io/gh/leemr/daymath)
[![license](https://img.shields.io/npm/l/daymath.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/daymath.svg)](https://www.npmjs.com/package/daymath)
[![bundle](https://img.shields.io/bundlejs/size/daymath)](https://bundlejs.com/?q=daymath)

**ISO 8601** calendar day math. **date-fns-shaped** names. **Temporal.PlainDate** under the hood.

No `Date`. No time zones. No silent “local now”. ISO 8601 ❤️

[**Play →**](https://leemr.github.io/daymath/) · [npm](https://www.npmjs.com/package/daymath) · [Changelog](./CHANGELOG.md) · [Contributing](./CONTRIBUTING.md) · [FUTURE](./FUTURE.md)

## A hire date is not a timestamp

Both of these are real, and neither one throws.

```js
new Date(2026, 1, 30).getDate()     // 2  — February 30 quietly becomes March 2
new Date(2026, 0, 31).getMonth()    // 0  — January is month zero
```

daymath refuses the first and answers the second the way you would say it out loud.

```js
isValid('2026-02-30')               // false
getMonth('2026-01-31')              // 1
```

There is a third one that no example can show you, because the answer depends on where you run it.
`new Date('2026-03-08')` parses as midnight **UTC**, so `.getDate()` says 7 in every zone behind
UTC and 8 in every zone at or ahead of it. The same line, two answers, no error.

A hire date, a passport expiry, a trip day are **calendar** values. They have no instant and no
zone. daymath only does plain days, as ISO strings.

| daymath has no | so you cannot |
|---|---|
| `Date` | leak a time zone into a birthday |
| time zones | get a different answer on a different server |
| a silent local now | write a test that fails at midnight |

```bash
npm install daymath
```

```js
import { day, addDays, addMonths, differenceInDays, isSameDay } from 'daymath'

addDays('2026-08-06', 1)      // '2026-08-07'
addMonths('2026-01-31', 1)    // '2026-02-28'
differenceInDays('2026-08-06', '2026-08-01') // 5
isSameDay('2026-08-06', '2026-08-06')        // true
```

## `day` is the way in

It turns a moment into a day, and it is the only function that reads a clock.

Start here. No arguments means today, in UTC.

```js
day()                                  // today, in UTC
addDays(day(), 2)                      // two days from today
```

Then hand it whatever you already have. It converts; it never stores what you gave it.

```js
day(row.createdAt)                     // '2026-08-07'  a Date
day(1761616161771)                     // '2025-10-28'  epoch milliseconds
day('1999-01-01T00:00:00Z')            // '1999-01-01'  an ISO timestamp
day('2026-05-05')                      // '2026-05-05'  already a day
day('2026-08-08 12:00:00')             // '2026-08-08'  a SQLite DATETIME
```

Name a zone when the answer depends on one.

```js
day('Asia/Tokyo')                      // today in Tokyo
day(row.createdAt, 'America/New_York') // '2026-08-06'  the evening before
day('2026-08-08T23:00:00Z', 'Asia/Tokyo') // '2026-08-09'  same instant, next day
day(zdt.toString())                    // the zone in the string wins
```

Both defaults are **stated**, not assumed.
UTC is still not your day for part of every day — it runs ahead of `America/New_York`
for 16.7% of the day, and behind `Asia/Tokyo` for 37.5% — so name your zone when
that matters.

### A SQLite `DATETIME` goes straight in

So does the whole surface. The clock is dropped by the same funnel every export shares, so this is
not a `day()` feature.

```js
addDays(row.created_at, 30)            // '2026-09-07'  from '2026-08-08 12:00:00'
startOfMonth('2026-08-08 01:57:31.913') // '2026-08-01'  strftime('%…%H:%M:%f')
getYear('2026-08-08t12:00')            // 2026          T, t or a space; same rule
```

`datetime()`, `CURRENT_TIMESTAMP` and `strftime('%Y-%m-%d %H:%M:%f')` all emit that
shape, so a column value needs no reshaping first. **Pass a zone with one and it
throws.** Naming a zone means convert, and a clock with no zone gives nothing to
convert from — and `datetime()` defaults to UTC, so a silent answer would hand the
UTC day to the one caller who asked for a local one. Put the zone in the string
(`Z`, an offset, or `[Zone]`) and it converts normally.

<details>
<summary><strong>The six rules behind that</strong> — how <code>day()</code> reads each input shape</summary>

- A **number is epoch milliseconds**, exactly as `new Date(n)` reads it. A seconds
  timestamp read as milliseconds lands in 1970, with no error. daymath states the
  unit rather than sniffing it, because no rule can separate the two: 13 digits
  means milliseconds for 2001–2286 and seconds for the year 275760, and both are
  inside the supported range.
- A **day carries no time**, so a zone does not apply to one.
  `day('2026-05-05', 'Asia/Tokyo')` is `'2026-05-05'`.
- A **timestamp carrying `Z` or an offset** names an exact instant, so it is read
  as a moment.
- A **string carrying a `[Zone]`** names its own zone, so it keeps its own day and
  the UTC default never applies. `day(zdt.toString())` equals `zdt.toPlainDate()`.
  A browser sending `'2026-08-08T20:00:00-04:00[America/New_York]'` gets back the
  8th, which is the date its user saw. Passing `tz` as well throws.
- A **zoneless wall clock is a day.** `'2026-08-08 12:00:00'`, `'2026-08-08T12:00'`
  and the lowercase `t` all answer `'2026-08-08'`; the clock is dropped, never read.
  The **hour is the only bound**, because the hour is the only field that can change
  the date: `24:00` is refused, a leap second and a fraction of any length are not.
  Pass `tz` with one and it **throws**. Name the zone in the string —
  `'2026-08-08T12:00[America/New_York]'` — and it converts.
- **`'11/12/2026'` is refused.** Nobody can tell November from December in it.

A lone string takes one of four roles, decided in this order: a day, a zoned time,
an instant, then a zone. The zone test is by **shape** — an IANA name, which carries no `:`, or
a bare offset such as `+05:30`. Temporal's own zone grammar cannot decide the role:
it accepts a whole timestamp and reads the zone out of it, so
`day('1999-01-01T00:00:00Z')` would answer today. That grammar also differs between
implementations — `'T12:00:00Z'` is a zone to native Temporal and not to the
polyfill — which would make the answer depend on the runtime.

</details>

```bash
node examples/basic.mjs   # from a clone
```

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

### What goes in, what comes out

| In | Out |
|----|-----|
| `YYYY-MM-DD` or expanded `±YYYYYY-MM-DD` | same forms (Temporal `toString`) |
| or `Temporal.PlainDate`, from any implementation | string |

A `Date` **throws** everywhere except `day()`, including in `isValid`.
`isValid('asdf')` → `false`. Nothing carries a zone past `day()`, and nothing gives you a `Date`
back.

Range: `-271821-04-19` … `+275760-09-13` — the `Temporal.PlainDate` limit, roughly ±10⁸ days from the epoch. A day outside it throws a `RangeError`.

### date-fns parity (names, not `Date`)

| Topic | daymath |
|-------|---------|
| Values | ISO day **strings**, not `Date` |
| `isSameDay` | Alias of `isEqual` |
| `isValid` | Valid daymath day; **`Date` throws** |
| `getMonth` / `setMonth` | **1–12** (1 = January) — ISO, **not** date-fns |
| `getDay` | **1–7** (1 = Monday, 7 = Sunday) — ISO, **not** date-fns |
| `weekStartsOn` | default `7` (Sunday); `0` also accepted |
| Intervals | `{ start, end }` |

## Temporal

Built on [`temporal-polyfill/fns`](https://www.npmjs.com/package/temporal-polyfill), the functional
API, rather than the `Temporal` class. A class is one unit to a bundler, so the class build shipped
whole for the twenty-odd operations daymath uses; free functions drop what you do not call. It runs
on native `Temporal` where the runtime has it and on the bundled build elsewhere, and `fns` makes
that choice itself. Measured on a three-call program: **24.7 kB gzip to 16.3 kB, −34%.**

A `Temporal.PlainDate` from *any* implementation is accepted — native, the bundled polyfill,
or a second copy of it in the same dependency tree. daymath reads its ISO day and builds its
own instance, so it never depends on `instanceof` agreeing across copies. The common case is
`Temporal.Now.plainDateISO()`: daymath has no `today()` on purpose, so that is where a caller
gets one.

Error messages quote no Temporal text, because implementations word the same failure
differently. The original error is on `cause`.

Behaviour is checked against a recorded baseline on Node, Deno (which ships **native**
Temporal) and Bun — every export, `npm run test:runtimes`. The exact call count lives
in `scripts/cross-runtime.baseline.json`, which is the only place it cannot go stale.

**Calendars:** daymath accepts a calendar that only relabels the year, such as `buddhist` or `roc`,
and refuses one that renumbers months or days. The rule, the measured line, and the one trap that
answers wrongly with no error are in **[docs/calendars.md](./docs/calendars.md)**.

## Requirements

ESM only. **Node 20.19+, or 22.12+.**

That floor is `require()`, not `import`. Node's `require(esm)` landed in 20.19 and 22.12, so
those are the versions where `require('daymath')` works. `engines` states the range exactly,
including the gap at 22.0–22.11. `temporal-polyfill` is ESM-only too, so a CJS build of daymath
would not escape this. Bundlers and browsers are unaffected. A Jest consumer needs a
`transformIgnorePatterns` entry, because Jest does not use Node's resolution.

Node 18 was supported through 0.3.0 and is dropped here. It went end-of-life in April 2025.

### In a browser, from a CDN

```html
<script type="module">
  import * as daymath from 'https://esm.sh/daymath?bundle'
  console.log(daymath.addDays('2026-08-06', 7))
</script>
```

**The `?bundle` is not optional.** Most CDNs split `temporal-polyfill` into two private copies and
serve a daymath that throws on every date. Which CDNs work, why, and how to re-measure them are in
**[docs/cdn.md](./docs/cdn.md)**. A bundler is unaffected.

## Types & tests

Plain JS + `index.d.ts` (no compile step). CI runs on Node 20, 22, 24, and 26; the
coverage gate runs on 26, which is also the version in `.node-version` and the one used
to publish. The matrix still proves the floor.

```bash
npm test
npm run test:coverage   # c8: 100% lines/funcs/branches on index.js + lcov
```

CI uploads coverage to [Codecov](https://codecov.io/gh/leemr/daymath) (see [CONTRIBUTING.md](./CONTRIBUTING.md) for one-time app/token setup).

PRs welcome via fork — see [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: [SECURITY.md](./SECURITY.md).

## Also on GitHub Packages

The same code publishes as `@leemr/daymath` (scoped; see [GitHub npm registry docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)):

```bash
# one-time: map the scope (auth with a PAT that has read:packages, or GITHUB_TOKEN in Actions)
echo '@leemr:registry=https://npm.pkg.github.com' >> .npmrc
npm install @leemr/daymath
```

Most people should keep using **`daymath` on npmjs**.

## License

MIT

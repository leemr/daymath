# daymath

[![npm](https://img.shields.io/npm/v/daymath.svg)](https://www.npmjs.com/package/daymath)
[![license](https://img.shields.io/npm/l/daymath.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/daymath.svg)](https://www.npmjs.com/package/daymath)

**ISO 8601** calendar day math. **date-fns-shaped** names. **Temporal.PlainDate** under the hood.

No `Date`. No time zones. No silent “local now.”

[**Play in the browser →**](https://leemr.github.io/daymath/) · [npm](https://www.npmjs.com/package/daymath) · [FUTURE.md](./FUTURE.md)

```bash
npm install daymath
```

```js
import { addDays, addMonths, differenceInDays, isSameDay } from 'daymath'

addDays('2026-08-06', 1)      // '2026-08-07'
addMonths('2026-01-31', 1)    // '2026-02-28'
differenceInDays('2026-08-06', '2026-08-01') // 5
isSameDay('2026-08-06', '2026-08-06')        // true
```

## Why

`Date` is a timestamp. Hire dates, passport expiry, trip days are **calendar** values. daymath only does plain days as ISO strings.

| In | Out |
|----|-----|
| `YYYY-MM-DD` or expanded `±YYYYYY-MM-DD` | same forms (Temporal `toString`) |
| or `Temporal.PlainDate` | string |

`Date` **throws** (including `isValid`). `isValid('asdf')` → `false`.

## date-fns parity (names, not `Date`)

| Topic | daymath |
|-------|---------|
| Values | ISO day **strings**, not `Date` |
| `isSameDay` | Alias of `isEqual` |
| `isValid` | Valid daymath day; **`Date` throws** |
| `getMonth` / `setMonth` | **0–11** (0 = January) |
| `getDay` | **0–6** (0 = Sunday) |
| `weekStartsOn` | default `0` (Sunday) |
| Intervals | `{ start, end }` |

## API

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

Uses global `Temporal` when present; otherwise [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill).

## Types & tests

Plain JS + `index.d.ts` (no compile step).

```bash
npm test
npm run test:coverage   # 100% lines on index.js
```

## License

MIT

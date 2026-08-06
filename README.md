# daymath

Calendar date math for **ISO 8601** day strings. **date-fns-shaped** names. **Temporal.PlainDate** under the hood.

No `Date`. No time zones. No silent “local now.”

```bash
npm install daymath
```

## Why

`Date` is a timestamp. Calendar work (“add one month”, “days between hire and start”) is not. This package only does plain calendar days.

## Usage

```js
import {
  addDays,
  addMonths,
  differenceInDays,
  isBefore,
  isSameDay,
  startOfMonth,
  eachDayOfInterval,
} from 'daymath'

addDays('2026-08-06', 1)                    // '2026-08-07'
addMonths('2026-01-31', 1)                  // '2026-02-28' (constrain)
differenceInDays('2026-08-06', '2026-08-01') // 5
isBefore('2026-08-05', '2026-08-06')         // true
isSameDay('2026-08-06', '2026-08-06')        // true (alias of isEqual)
startOfMonth('2026-08-06')                  // '2026-08-01'
addDays('9999-12-31', 1)                    // '+010000-01-01' (expanded year)
eachDayOfInterval({
  start: '2026-08-05',
  end: '2026-08-07',
}) // ['2026-08-05', '2026-08-06', '2026-08-07']
```

**Inputs:** ISO 8601 day string or `Temporal.PlainDate`.  
- `YYYY-MM-DD` (years 0000–9999)  
- expanded `±YYYYYY-MM-DD` (e.g. `+010000-01-01`)  

**Outputs:** Temporal’s ISO day string (same forms).

`Date` throws (including `isValid(date)`). Bad strings: math helpers throw; `isValid('asdf')` → `false`. Time-bearing / sloppy forms throw.

See [FUTURE.md](./FUTURE.md) for backlog (bundle size, business days, …).

## date-fns parity notes

| Topic | daymath |
|-------|---------|
| Value type | ISO day string (not `Date`) |
| `isSameDay` | Alias of `isEqual` (same calendar day) |
| `isValid` | Our predicate: valid day string / PlainDate. `Date` **throws** (not date-fns’s Date check) |
| `getMonth` / `setMonth` | **0–11** like Date/date-fns (0 = January) |
| `getDay` | **0–6** like Date/date-fns (0 = Sunday) |
| `weekStartsOn` | `0` = Sunday … `6` = Saturday (default `0`) |
| Intervals | `{ start, end }` inclusive for `each*` / `isWithin` / `clamp` |
| `areIntervalsOverlapping` | Default `{ inclusive: false }` (date-fns); pass `true` for closed |

## API (0.2)

### Parse / format
`parse` · `format` · `isValid`

### Add / sub
`addDays` / `subDays` · `addWeeks` / `subWeeks` · `addMonths` / `subMonths` · `addYears` / `subYears` · `addQuarters` / `subQuarters`

### Get / set
`getYear` · `getMonth` · `getDate` · `getDay` · `getDayOfYear` · `getDaysInMonth` · `getQuarter` · `isLeapYear`  
`setYear` · `setMonth` · `setDate`

### Start / end
`startOfMonth` / `endOfMonth` · `startOfYear` / `endOfYear` · `startOfQuarter` / `endOfQuarter` · `startOfWeek` / `endOfWeek`

### Differences
`differenceInDays` · `differenceInWeeks` · `differenceInMonths` · `differenceInCalendarMonths` · `differenceInYears` · `differenceInCalendarYears` · `differenceInQuarters` · `differenceInCalendarQuarters`

### Compare
`isBefore` · `isAfter` · `isEqual` · `isSameDay` · `isSameWeek` · `isSameMonth` · `isSameYear` · `isSameQuarter` · `compareAsc` · `compareDesc` · `min` · `max`

### Weekday / month edges
`isSunday`…`isSaturday` · `isWeekend` · `isFirstDayOfMonth` · `isLastDayOfMonth`

### Intervals
`eachDayOfInterval` · `eachMonthOfInterval` · `eachYearOfInterval` · `isWithinInterval` · `clamp` · `areIntervalsOverlapping`

Amounts must be finite integers.

## Temporal

Uses global `Temporal` when present; otherwise [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill).

## Types

Ships `index.d.ts` (no TypeScript compile step). Source is plain JS.

## License

MIT

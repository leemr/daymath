# daymath

Calendar date math for `YYYY-MM-DD` strings. **date-fns-shaped** names. **Temporal.PlainDate** under the hood.

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
  parse,
} from 'daymath'

addDays('2026-08-06', 1)           // '2026-08-07'
addMonths('2026-01-31', 1)         // '2026-02-28' (constrain)
differenceInDays('2026-08-06', '2026-08-01') // 5
isBefore('2026-08-05', '2026-08-06') // true
parse('2026-08-06')                // '2026-08-06'
```

Inputs: `YYYY-MM-DD` string or `Temporal.PlainDate`.  
Outputs: always `YYYY-MM-DD` string (for math helpers).

`Date` throws. Time-bearing ISO strings throw. Sloppy forms like `2026-8-6` throw.

## API

| Function | Notes |
|----------|--------|
| `parse` / `format` / `isValid` | Strict `YYYY-MM-DD` |
| `addDays` / `subDays` | |
| `addWeeks` / `subWeeks` | |
| `addMonths` / `subMonths` | Calendar months; end-of-month constrains |
| `addYears` / `subYears` | Leap day constrains |
| `differenceInDays` | `dateLeft − dateRight` (date-fns order) |
| `isBefore` / `isAfter` / `isEqual` | |
| `compareAsc` / `compareDesc` | For `.sort()` |
| `min` / `max` | Non-empty arrays |

Amounts must be finite integers.

## Temporal

Uses global `Temporal` when present; otherwise [`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill).

## Types

Ships `index.d.ts` (no TypeScript compile step for authors). Source is plain JS.

## License

MIT

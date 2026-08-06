# daymath — future work

Checked-in backlog. Not a promise of order. Session handoff stays in local `todo.grok` (gitignored).

## Bundle size (client)

Today we static-import `temporal-polyfill` class API (`globalThis.Temporal ?? polyfill`). Bundlers still ship the polyfill even when native Temporal exists.

Ideas (measure in a real app bundle before rewriting):

- Prefer native `Temporal` without pulling polyfill when available (dynamic import / optional peer).
- Or map surface onto `temporal-polyfill/fns/PlainDate` (~much smaller) if fidelity holds.
- Keep polyfill as a hard dep for Node until Temporal is unflagged everywhere you care about.

Not urgent until a client (e.g. agent app) imports daymath.

## API / parity (optional later)

- Business days: `addBusinessDays`, `differenceInBusinessDays` (weekends first; holidays = config).
- ISO week suite: `getISOWeek`, `startOfISOWeek`, `getISOWeekYear`, …
- Rich display format / i18n — **out of scope** for this package (use Temporal + `Intl`, or date-fns/`formatInTimeZone` for zoned display). daymath stays calendar math + ISO day strings.
- Scoped twin `@leemr/daymath` (thin re-export) if useful for org naming.

## Done / settled (do not re-litigate without new data)

- date-fns-shaped names; plain-day values are ISO strings, not `Date`.
- `getMonth` / `setMonth` 0–11; `getDay` 0 = Sunday; `weekStartsOn` default 0.
- `isSameDay` alias of `isEqual`.
- `isValid`: our predicate (valid daymath day). Invalid strings → `false`. `Date` → **throw** (loud swap trap).
- Expanded ISO years (`±YYYYYY-MM-DD`) accepted; round-trip via Temporal `toString`.

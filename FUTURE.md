# daymath — future work

Checked-in backlog. Not a promise of order. Session handoff stays in local `todo.grok` (gitignored).

## Trust (later)

- **npm provenance** — publish from GitHub Actions with OIDC (`npm publish --provenance`) so the registry links the tarball to a CI run (not a laptop token).
- **OpenSSF Scorecard** badge once the repo has enough workflow history to score usefully.
- **Branch protection** on `master` (require CI green + PR) — optional; PRs already work without it.

Done already: `SECURITY.md`, Dependabot, CI on Node 18/20/22, `CHANGELOG.md`, GitHub Releases.

## Discoverability (later)

- **Awesome lists** — not `awesome-daymath`. Open a PR to an existing list when the API feels stable, e.g. [awesome-javascript](https://github.com/sorrycc/awesome-javascript) (Date section) or Temporal-related lists. Pitch: “ISO calendar day math, date-fns-shaped names, no Date/TZ.”
- **CDN one-liner** already on the play page; optional README badge for jsDelivr/unpkg hits.
- **Social preview / og:image** — GitHub: repo Settings → General → Social preview (upload PNG ~1280×640). Pages: `<meta property="og:image">` on `docs/index.html`. Free to make (Figma, or any generator); not required for npm.

Done already: topics, homepage URL, badges, `llms.txt`, short README.

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
- Optional `sideEffects: false` already set for bundlers.

## DX (optional later)

- Deeper JSDoc `@example` blocks on hot exports (hover recipes).
- Benchmarks only if numbers stay honest and small.

Done already: `examples/basic.mjs`, types, playground, 100% coverage gate.

## Done / settled (do not re-litigate without new data)

- date-fns-shaped names; plain-day values are ISO strings, not `Date`.
- `getMonth` / `setMonth` 0–11; `getDay` 0 = Sunday; `weekStartsOn` default 0.
- `isSameDay` alias of `isEqual`.
- `isValid`: our predicate (valid daymath day). Invalid strings → `false`. `Date` → **throw** (loud swap trap).
- Expanded ISO years (`±YYYYYY-MM-DD`) accepted; round-trip via Temporal `toString`.
- Public repo: **fork + PR** for external contributions; no drive-by push to `master`.

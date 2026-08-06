# Contributing

PRs welcome. Direct push to `master` is not (fork + PR).

## Rules of the package

1. **Calendar days only** — ISO 8601 day strings (`YYYY-MM-DD` or expanded `±YYYYYY-MM-DD`) or `Temporal.PlainDate`.
2. **No `Date`** — reject with `TypeError`. No time zones. No silent “now.”
3. **date-fns-shaped names** where we claim parity; values are still strings, not `Date`.
4. **JS + `index.d.ts`** — no TypeScript compile step for the library itself.

## Setup

```bash
git clone https://github.com/leemr/daymath.git
cd daymath
npm ci
npm test
npm run test:coverage   # expect 100% on index.js
```

## PR checklist

- [ ] Tests for new/changed behavior (`test.js`, `node:test`)
- [ ] `npm run test:coverage` still 100% on `index.js`
- [ ] JSDoc on new exports (hover help in editors)
- [ ] `CHANGELOG.md` under `[Unreleased]` if user-facing
- [ ] No `Date`, no locale display formatters (use other libs for `MMM d`)

## Scope

See [FUTURE.md](./FUTURE.md) for parked ideas. Display/i18n and zoned “now” stay out of daymath on purpose.

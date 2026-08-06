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

## Codecov (maintainer)

CI uploads `coverage/lcov.info` from the Node 24 job. One-time link:

1. Open https://app.codecov.io → sign in with **GitHub**.
2. Add **leemr/daymath** (install the **Codecov GitHub App** on the repo, or the org).
3. Optional hard auth: Codecov repo → **Settings** → copy upload token → GitHub repo **Settings → Secrets and variables → Actions** → secret name `CODECOV_TOKEN`.
4. Push any commit (or re-run CI). Confirm the “Upload coverage to Codecov” step is happy.
5. Then set `fail_ci_if_error: true` on that step in `.github/workflows/ci.yml` if you want upload failures to fail the build.
6. Badge (already in README once the project exists on Codecov):  
   `https://codecov.io/gh/leemr/daymath`

Local 100% gate does **not** need Codecov — only `npm run test:coverage` (c8).

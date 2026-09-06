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

CI uploads `coverage/lcov.info` from the Node 24 job. **Linked** for this repo (App + optional `CODECOV_TOKEN` secret). Badge: https://codecov.io/gh/leemr/daymath

- Local/CI **100% gate** = **c8** (`npm run test:coverage`), not Codecov.
- Upload step uses `fail_ci_if_error: false` so a flaky upload doesn’t red CI; flip to `true` in `ci.yml` if you want upload failures hard-fail.
- If the token was ever exposed, regenerate on Codecov and update the GitHub secret.

## Release (maintainer)

Run `npm run release:check` first. It reads the tree, the version, the changelog, the registry and
the npm credential, refuses on anything that is not ready, and prints the remaining steps in order.
Everything below is what it checks, written out.

**The order is the procedure. Do not reorder it, and do not substitute a step.**

1. Prepare the release commit. `npm version <patch|minor|major> --no-git-tag-version` — no tag yet,
   step 3 makes it. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [<version>] — <YYYY-MM-DD>`.
   In `FUTURE.md`, point the **Live now** line at the new version.
2. Commit those four files as `Release daymath <version>`, then push `master`.
3. Cut the GitHub Release on that commit, tagged `v<version>`, with the changelog section as the
   notes. **This is what publishes `@leemr/daymath`**: `publish-github-packages.yml` fires on
   `release: published`.
4. `npm publish` from this directory, for unscoped `daymath` on npmjs.com.
5. `npm run test:demo`.

| Registry | Name | Published by |
|----------|------|--------------|
| npmjs.com | `daymath` | step 4, from the laptop (or future GHA provenance — see FUTURE.md) |
| GitHub Packages | `@leemr/daymath` | step 3, by the release trigger |

**Actions → `publish-github-packages` is a fallback, not an alternative.** It exists for a version
whose release already went out, so the release trigger cannot fire again. Reaching for it during a
normal release publishes the package early, and then step 3 tries to publish a version that already
exists and the run goes red. That happened on 0.7.3. Recovering it meant disabling the workflow,
cutting the release, and re-enabling — which works, and is not a thing to plan for.

Read the history before choosing anything else: `gh run list --workflow publish-github-packages.yml`.

Two failures to expect, both of which have already cost a release:

- **`npm publish` needs a real `cd` into this directory.** It reads `package.json` from the process
  directory, and `--prefix` does not change that.
- **A stale npm token reports as `E404 Not Found - PUT`**, which reads like a package problem and is
  not one. Run `npm whoami` first: it names the real fault. The token must be a granular one with
  **Bypass two-factor authentication**, because the account's second factor is a security key, so no
  OTP exists and `--otp` can never succeed.

Step 7 needs the network and a rebuilt CDN. Give it a few minutes before reading a red run as real.
Actions → `demo-page` runs the same check on a schedule.

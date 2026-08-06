# daymath — future work

Checked-in backlog. Not a promise of order. Session handoff: local `todo.grok` (gitignored).

---

## Trust / publish

- **npm publish from GitHub Actions + provenance** — `npm publish --provenance` via OIDC to **registry.npmjs.org**. Needs npm trusted publisher / automation token setup. This is **not** what GitHub Packages “npm registry” docs do by default.
- **GitHub Packages (`npm.pkg.github.com`)** — optional second registry. Does **not** auto-mirror to the public npmjs.com package. Sidebar “No packages published” only means nothing on **GitHub’s** registry. Ignore unless you want `@leemr/daymath` on GH Packages too.
- **OpenSSF Scorecard** badge once workflows are mature.
- **`enforce_admins: true`** on branch protection if you want even owner merges to wait on CI (today: required checks; admin can still bypass).
- **Codecov:** CI upload is wired (`c8` → `lcov` → `codecov-action@v5`). **You** still complete app/token link once (see CONTRIBUTING). Then optionally `fail_ci_if_error: true`.

Done already: SECURITY, Dependabot, CI Node 18–26, 100% c8 gate, CHANGELOG, Releases, master protection (checks + no force-push/delete), Codecov upload step + badge URL.

---

## Discoverability

- **Awesome-list PR** (not “awesome-daymath”) — e.g. awesome-javascript Date section when API feels stable.
- **GitHub repo Social preview** — upload `docs/og.png` in Settings → General (UI only). Pages unfurls already use og meta.

Done already: topics, homepage, badges, `llms.txt`, README, Pages play, `docs/og.png`.

---

## Bundle size (client)

Static `temporal-polyfill` class import still ships polyfill even when native Temporal exists.

- Dynamic import / optional peer for native Temporal.
- Or `temporal-polyfill/fns/PlainDate` if fidelity + size hold.
- Measure in a real app (e.g. itrvl agent) before rewriting.

---

## API / product (optional)

- Business days, ISO week suite.
- Scoped twin `@leemr/daymath`.
- Rich display / i18n — **out of scope** (Temporal+Intl or date-fns TZ formatters).

Done already: 0.2 surface, expanded ISO years, `isValid(Date)` throws, `isSameDay` alias, date-fns index traps.

---

## DX

- Deeper `@example` JSDoc on hot exports.
- Honest micro-bench only if useful.

Done already: `examples/basic.mjs`, types, playground, 100% coverage.

---

## Settled (do not re-litigate without new data)

- date-fns-shaped **names**; values are ISO day **strings**, not `Date`.
- `getMonth`/`setMonth` 0–11; `getDay` 0=Sunday; `weekStartsOn` default 0.
- Public: **fork + PR** welcome; no drive-by push to `master`.
- npm home: https://www.npmjs.com/package/daymath (not GitHub Packages).

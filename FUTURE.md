# daymath — future work

Checked-in backlog. Not a promise of order. Session handoff: local `todo.grok` (gitignored).

**Live now:** `daymath@0.2.3` on npmjs · `@leemr/daymath@0.2.3` on GitHub Packages · https://leemr.github.io/daymath/

---

## Trust / publish (later)

- **npm publish from GitHub Actions + provenance** — `npm publish --provenance` to **registry.npmjs.org** (trusted publisher / OIDC). Laptop token still used for npmjs.
- **`fail_ci_if_error: true`** on Codecov upload step once you’re happy uploads never flake (today: `false`; 100% gate is already c8, not Codecov).
- **`enforce_admins: true`** on branch protection if even owner merges must wait for CI (today: admin can bypass).
- **OpenSSF Scorecard** badge when you want the scoreboard.
- **Rotate Codecov token** if it was ever pasted into chat; keep only as `CODECOV_TOKEN` secret.
- **CodeQL / code scanning** — optional; not set up.
- **Dependabot malware alerts** — optional UI toggle; version + security Dependabot already on.

**Done (trust / CI / registries):**

- SECURITY.md, CONTRIBUTING.md, CHANGELOG, GitHub Releases through v0.2.3  
- CI Node 18–26; checkout/setup-node v7; c8 100% lines/funcs/branches; Codecov upload + badge (~100% on master)  
- Master protected: required Node checks, strict, no force-push/delete; fork+PR open  
- Dependabot **version** updates (`.github/dependabot.yml`); **alerts** + **security updates** + **grouped** + private vuln reporting + dependency graph (UI); secret scanning + push protection  
- Automatic dependency submission: **left Disabled** (npm lockfile is enough)  
- GitHub Packages: `scripts/publish-github-packages.mjs` + workflow (on release and workflow_dispatch). Don’t double-fire same version (second publish fails red; ignore).  
- npmjs primary: `daymath`; GH Packages twin: `@leemr/daymath` (scoped, not a name swap of the npm package)

---

## Discoverability (later)

- **Awesome-list PR** (not “awesome-daymath”) when API feels stable.  
- Confirm **repo Social preview** still set to `docs/og.png` if unfurls for github.com/leemr/daymath look wrong.

**Done:** topics, homepage, badges, llms.txt, README, Pages play, `docs/og.png` + og meta.

---

## Bundle size (client)

Static `temporal-polyfill` class import still ships polyfill even when native Temporal exists.

- Dynamic import / optional peer for native Temporal  
- Or `temporal-polyfill/fns/PlainDate` if fidelity + size hold  
- Measure in a real app (e.g. itrvl) before rewriting  

---

## API / product (optional)

- Business days, ISO week suite  
- Rich display / i18n — **out of scope** (Temporal+Intl or date-fns TZ formatters)  
- Next **semver:** patch for tooling; **0.3.0** only for API surface  

**Done:** 0.2 calendar surface; expanded ISO years; `isValid(Date)` throws; `isSameDay` = `isEqual`; date-fns index traps (0-based month, Sunday week, etc.)

---

## DX (optional)

- Deeper `@example` JSDoc on hot exports  
- Micro-bench only if honest and useful  

**Done:** `examples/basic.mjs`, types, playground, 100% coverage  

---

## Settled (do not re-litigate without new data)

- date-fns-shaped **names**; values are ISO day **strings**, not `Date`  
- `getMonth`/`setMonth` 0–11; `getDay` 0=Sunday; `weekStartsOn` default 0  
- npm badge orange = shields style, not failure  
- Sidebar “Packages” = GitHub Packages only; empty ≠ missing npmjs package  
- GitHub Packages doc = `npm.pkg.github.com` + scoped names; not auto-publish to npmjs  

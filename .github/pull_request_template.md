## What changes

One or two sentences. Say what a caller can now do, or what stopped being wrong.

## How it was measured

Paste the command and its real output, not a description of it. A claim with no command behind it
is the thing this repo has been burned by most.

```
```

## Gates

Every gate here is blind in a different direction, so run them all rather than picking one:

```bash
npm run lint && npm run typecheck && npm run format:check
npm test && npm run test:examples && npm run test:coverage
npm run test:differential:quick && npm run size:check && npm run test:split
```

- [ ] The gates above pass locally.
- [ ] A behaviour change has a test that fails without the change.
- [ ] A new or moved `js` fence is zone-independent, or the claim lives in prose.
- [ ] `CHANGELOG.md` has an `[Unreleased]` entry, if a consumer can see the difference.

## Semver

- [ ] Patch — no consumer can tell, apart from the fix
- [ ] Minor — new surface, nothing existing answers differently
- [ ] Major — an existing call answers differently

If this is a minor or a major, say which call changes and what it answered before.

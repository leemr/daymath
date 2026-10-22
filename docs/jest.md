# daymath under Jest

Jest needs configuration to load daymath. Node, Vitest, Bun and Deno do not. This page holds the
recipe.

Back to the [README](../README.md).

## The failure

A test that imports daymath fails to parse:

```
SyntaxError: Cannot use import statement outside a module
```

Jest 30 reports the same fault as `Must use import to load ES Module`.

Jest 27 reports a second failure after you fix the first:

```
Cannot find module 'temporal-utils/protected' from 'node_modules/temporal-polyfill/chunks/internal.js'
```

The two failures have different causes. On Jest 27, fix both or the suite stays red.

## Cause one: Jest does not use Node's resolution

daymath publishes ESM only. So does every package it depends on. Node loads that fine, because
`require(esm)` landed in 20.19 and 22.12, and `engines` states the supported range.

Jest does not use Node's resolver. It transforms modules itself, and it skips `node_modules` by
default. An untransformed `import` statement then reaches the CommonJS parser and throws. This
holds on Jest 27, 29 and 30.

The fix is to spare the closure from `transformIgnorePatterns`. Name every package, because the
option takes file paths and not a dependency graph:

```js
const ESM_DEPENDENCIES = ['daymath', 'temporal-polyfill', 'temporal-spec', 'temporal-utils']
```

Re-derive that list rather than trusting it. A daymath upgrade can add a package. Run this from the
directory holding the `package.json` that depends on daymath:

```js
// esm-closure.mjs — prints the packages to spare, joined by |
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const seen = new Set(), esm = []
const pkgOf = (name, from) => {
  const req = createRequire(from)
  let entry
  try { entry = req.resolve(name) } catch { return null }
  for (let d = dirname(entry); d !== dirname(d); d = dirname(d)) {
    try {
      const j = JSON.parse(readFileSync(join(d, 'package.json'), 'utf8'))
      if (j.name === name) return { j, dir: d }
    } catch {}
  }
  return null
}

const walk = (name, from) => {
  if (seen.has(name)) return
  seen.add(name)
  const hit = pkgOf(name, from)
  if (!hit) return
  if (hit.j.type === 'module') esm.push(name)
  for (const dep of Object.keys(hit.j.dependencies || {})) walk(dep, join(hit.dir, 'package.json'))
}

walk('daymath', join(process.cwd(), 'package.json'))
console.log(esm.join('|'))
```

It resolves the entry file and then walks up to the owning `package.json`. It does not read
`<name>/package.json` directly, because an exports map may refuse that path.

Spare them in `jest.config.js`:

```js
// jest.config.js
module.exports = {
  transformIgnorePatterns: [
    `[/\\\\]node_modules[/\\\\](?!(${ESM_DEPENDENCIES.join('|')})[/\\\\]).+\\.(js|jsx|mjs|cjs|ts|tsx)$`,
  ],
}
```

Jest 30 has a second route. Its native ESM mode loads daymath with no transform entry. Turn it on
with `NODE_OPTIONS=--experimental-vm-modules`, and read the Jest ESM guide for what else it changes.

## Cause two: Jest 27 ignores the exports map

`temporal-utils` publishes its files under `dist/` and redirects to them in its exports map. Read
the map before you write the mapping, because the paths can change:

```
node -p "JSON.stringify(require('temporal-utils/package.json').exports, null, 1)"
```

Jest 27 does not read that map. It looks for `temporal-utils/protected.js` at the package root,
finds nothing, and reports the module as missing.

On Jest 27 only, spell the redirect out with `moduleNameMapper`:

```js
moduleNameMapper: {
  '^temporal-utils/(.+)$': 'temporal-utils/dist/$1.js',
},
```

**Remove this mapper on Jest 28 and later.** Those versions read the exports map, and the mapper
then breaks the suite with `Could not locate module temporal-utils/protected`. Check your version
before an upgrade:

```
npx jest --version
```

## Other test runners need nothing

| Runner | Configuration |
|---|---|
| Vitest | None |
| `node --test` | None, from `import` or from `require` |
| Bun | None |
| Deno | None |

## A CommonJS build of daymath would not help

That question comes up first, and the answer is no. Both causes sit in Jest, not in the module
format. `temporal-polyfill`, `temporal-spec` and `temporal-utils` stay ESM whatever daymath ships,
so the transform is still needed and the exports map is still ignored.

Outside Jest the question does not arise. `require('daymath')` already works on every Node version
in the `engines` range.

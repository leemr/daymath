/**
 * Publish this package to GitHub Packages as @leemr/daymath.
 * Unscoped `daymath` on registry.npmjs.org is unchanged.
 *
 * Usage (auth already in env/npmrc for npm.pkg.github.com):
 *   node scripts/publish-github-packages.mjs
 *   node scripts/publish-github-packages.mjs --dry-run
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')
const original = readFileSync(pkgPath, 'utf8')
const dry = process.argv.includes('--dry-run')

const pkg = JSON.parse(original)
pkg.name = '@leemr/daymath'
pkg.publishConfig = {
  registry: 'https://npm.pkg.github.com',
  access: 'public',
}

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`Publishing ${pkg.name}@${pkg.version} → npm.pkg.github.com`)

try {
  const args = ['publish', '--access', 'public']
  if (dry) args.push('--dry-run')
  const r = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
} finally {
  writeFileSync(pkgPath, original)
  console.log('Restored package.json name to daymath')
}

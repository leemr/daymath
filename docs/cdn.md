# daymath from a CDN

Use `https://esm.sh/daymath?bundle`. The `?bundle` is not optional, and this page is why.

Back to the [README](../README.md).

## The one that works

```html
<script type="module">
  import * as daymath from 'https://esm.sh/daymath?bundle'
  console.log(daymath.addDays('2026-08-06', 7))
</script>
```

The answer that snippet logs, asserted by `npm run test:examples`, because a claim inside an html
fence is not:

```js
addDays('2026-08-06', 7) // '2026-08-13'
```

## What goes wrong without it

Most CDNs serve a daymath that throws on every date. What it throws is
`TypeError: Invalid calling context`, which names the implementation. daymath will not relabel a
broken Temporal as your bad input, and it will not answer `false` for a day it cannot read.

daymath imports two subpaths of `temporal-polyfill`, `fns/PlainDate` and `fns/Calendar`. A CDN that
rebuilds each subpath into its own bundle gives each one a private copy of the polyfill's internals,
so the calendar built by one copy is unrecognisable to the other and `fromString` throws
`TypeError: Invalid calling context`. No import spelling avoids it: `temporal-polyfill/fns` is in
the export map but its file is empty, so the separate subpaths are the whole `fns` API.

Measured 2026-09-05. `npm run test:demo` re-checks the first row on a schedule; the other four rows
carry no gate, so re-measure them rather than trusting the table:

```
for u in "https://esm.sh/daymath?bundle" "https://unpkg.com/daymath?module" "https://esm.sh/daymath" "https://esm.run/daymath" "https://cdn.jsdelivr.net/npm/daymath/+esm"; do
  node scripts/demo-page.mjs --url "$u" >/dev/null 2>&1 && echo "yes $u" || echo "no  $u"
done
```


| URL | Works |
| --- | --- |
| `https://esm.sh/daymath?bundle` | yes |
| `https://unpkg.com/daymath?module` | yes |
| `https://esm.sh/daymath` | no |
| `https://esm.run/daymath` | no |
| `https://cdn.jsdelivr.net/npm/daymath/+esm` | no |

A bundler is unaffected. It resolves both subpaths through one copy in `node_modules`, which is why
every gate in this repo stayed green while the demo page was dead.

`npm run test:split` closes that hole. It builds the split on disk from `node_modules`, so it needs
no network and no published build, then it checks one law across the API: a broken Temporal must
never make daymath answer wrongly or blame the caller.

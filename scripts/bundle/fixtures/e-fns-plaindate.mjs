// Shape E — the fns tree, but handing back a real PlainDate. `toTemporal` needs a free
// `Temporal` global, so on a runtime without one the class polyfill comes back in. This is the
// measurement that kills "fns port, objects out".
import {
  addDays,
  diffDays,
  fromString,
  toTemporal,
  withDayOfMonth,
  daysInMonth,
} from 'temporal-polyfill/fns/PlainDate'
import { getISO } from 'temporal-polyfill/fns/Calendar'
import 'temporal-polyfill/global'

const start = fromString('2026-01-31', getISO)
console.log(
  toTemporal(addDays(start, 30)),
  diffDays(start, fromString('2026-03-01', getISO)),
  toTemporal(withDayOfMonth(start, daysInMonth(start))),
)

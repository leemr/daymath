// Shape J — the whole fns surface daymath would need, against shape B's whole class surface.
// A and D are what a caller who imports three exports pays. B and J are the ceiling.
import * as PlainDate from 'temporal-polyfill/fns/PlainDate'
import * as Instant from 'temporal-polyfill/fns/Instant'
import * as ZonedDateTime from 'temporal-polyfill/fns/ZonedDateTime'
import * as Now from 'temporal-polyfill/fns/Now'
import { getISO } from 'temporal-polyfill/fns/Calendar'

const start = PlainDate.fromString('2026-01-31', getISO)
console.log(
  Object.keys(PlainDate).length +
    Object.keys(Instant).length +
    Object.keys(ZonedDateTime).length +
    Object.keys(Now).length,
  PlainDate.toString(PlainDate.addDays(start, 30)),
  Now.plainDateISO('utc').toString !== undefined,
)

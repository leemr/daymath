// Shape C — the class polyfill with no daymath at all. This is the floor shape A cannot beat.
import { Temporal } from 'temporal-polyfill'

const start = Temporal.PlainDate.from('2026-01-31')
console.log(
  start.add({ days: 30 }).toString(),
  Temporal.PlainDate.from('2026-03-01').since(start).days,
  start.with({ day: start.daysInMonth }).toString(),
)

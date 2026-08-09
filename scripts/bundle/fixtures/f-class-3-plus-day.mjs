// Shape F — shape A plus `day()`. F minus A is what the clock door costs in the class API.
import { addDays, differenceInDays, endOfMonth, day } from '../../../index.js'

const start = day(0, 'utc')
console.log(
  addDays(start, 30),
  differenceInDays('2026-03-01', start),
  endOfMonth(start),
  day(),
)

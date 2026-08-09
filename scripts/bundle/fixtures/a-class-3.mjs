// Shape A — daymath today, three calls. The reference program every other fixture copies.
import { addDays, differenceInDays, endOfMonth } from '../../../index.js'

const start = '2026-01-31'
console.log(addDays(start, 30), differenceInDays('2026-03-01', start), endOfMonth(start))

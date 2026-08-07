import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Temporal } from 'temporal-polyfill'
// namespace import too, so the -0 sweep enumerates the module instead of a list
import * as dm from './index.js'
import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  areIntervalsOverlapping,
  clamp,
  compareAsc,
  compareDesc,
  differenceInCalendarMonths,
  differenceInCalendarQuarters,
  differenceInCalendarYears,
  differenceInDays,
  differenceInMonths,
  differenceInQuarters,
  differenceInWeeks,
  differenceInYears,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getDate,
  getDay,
  getDayOfYear,
  getDaysInMonth,
  getMonth,
  getQuarter,
  getYear,
  isAfter,
  isBefore,
  isEqual,
  isFirstDayOfMonth,
  isLastDayOfMonth,
  isLeapYear,
  isMonday,
  isSameDay,
  isSameMonth,
  isSameQuarter,
  isSameWeek,
  isSameYear,
  isSaturday,
  isSunday,
  isThursday,
  isTuesday,
  isValid,
  isWednesday,
  isFriday,
  isWeekend,
  isWithinInterval,
  max,
  min,
  parse,
  setDate,
  setMonth,
  setYear,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from './index.js'

const d = '2026-08-06' // Thursday (ISO / JS)

describe('parse / format / isValid', () => {
  it('parses ISO 8601 YYYY-MM-DD', () => {
    assert.equal(parse(d), d)
  })

  it('accepts PlainDate', () => {
    assert.equal(parse(Temporal.PlainDate.from(d)), d)
  })

  it('rejects Date', () => {
    assert.throws(() => parse(new Date(d)), /Date is not allowed/)
  })

  it('rejects time / sloppy strings', () => {
    assert.throws(() => parse('2026-08-06T12:00:00'), /ISO 8601/)
    assert.throws(() => parse('2026-8-6'), /ISO 8601/)
    assert.throws(() => parse('08/06/2026'), /ISO 8601/)
  })

  it('rejects impossible calendar days', () => {
    assert.throws(() => parse('2026-02-30'), /invalid/)
  })

  it('accepts expanded ISO years and round-trips past 9999', () => {
    assert.equal(addDays('9999-12-31', 1), '+010000-01-01')
    assert.equal(parse('+010000-01-01'), '+010000-01-01')
    assert.equal(parse('-000001-01-01'), '-000001-01-01')
    assert.equal(isValid('+010000-01-01'), true)
  })

  it('accepts the documented range and rejects either side of it', () => {
    assert.equal(parse('-271821-04-19'), '-271821-04-19') // min PlainDate
    assert.equal(parse('+275760-09-13'), '+275760-09-13') // max PlainDate
    assert.throws(() => parse('+275760-09-14'), /invalid date/)
    assert.throws(() => parse('-271821-04-18'), /invalid date/)
  })

  it('formats only yyyy-MM-dd pattern name', () => {
    assert.equal(format(d), d)
    assert.equal(format('+010000-01-01'), '+010000-01-01')
    assert.throws(() => format(d, 'MM/dd/yyyy'), /only/)
  })

  it('isValid: strings boolean; Date throws', () => {
    assert.equal(isValid(d), true)
    assert.equal(isValid('asdf'), false)
    assert.equal(isValid('nope'), false)
    assert.equal(isValid(42), false)
    assert.throws(() => isValid(new Date()), /Date is not allowed/)
  })
})

describe('add / sub', () => {
  it('days / weeks', () => {
    assert.equal(addDays(d, 1), '2026-08-07')
    assert.equal(subDays(d, 1), '2026-08-05')
    assert.equal(addWeeks(d, 1), '2026-08-13')
    assert.equal(subWeeks(d, 1), '2026-07-30')
  })

  it('day arithmetic wraps months and years (unlike setDate, which constrains)', () => {
    assert.equal(addDays('2026-08-15', 31), '2026-09-15')
    assert.equal(addDays('2026-08-15', 17), '2026-09-01')
    assert.equal(addDays('2026-12-20', 31), '2027-01-20')
    assert.equal(addDays('2026-02-15', 365), '2027-02-15')
    assert.equal(subDays('2026-01-01', 1), '2025-12-31')
    assert.equal(setDate('2026-08-15', 31), '2026-08-31') // stays in August
  })

  it('months constrain end-of-month', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
    assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
    assert.equal(subMonths('2026-03-31', 1), '2026-02-28')
  })

  it('years / quarters', () => {
    assert.equal(addYears(d, 1), '2027-08-06')
    assert.equal(subYears(d, 1), '2025-08-06')
    assert.equal(addYears('2024-02-29', 1), '2025-02-28')
    assert.equal(addQuarters(d, 1), '2026-11-06')
    assert.equal(subQuarters(d, 1), '2026-05-06')
  })

  it('rejects non-integer amounts', () => {
    assert.throws(() => addDays(d, 1.5), /integer/)
    assert.throws(() => addDays(d, NaN), /finite/)
  })

  it('range overflow keeps the daymath: prefix', () => {
    for (const [fn, name] of [
      [addDays, 'addDays'],
      [addMonths, 'addMonths'],
      [addYears, 'addYears'],
    ]) {
      assert.throws(() => fn(d, 1e9), (err) => {
        assert.ok(err instanceof RangeError)
        assert.match(err.message, new RegExp(`^daymath: ${name} could not produce`)) // err.message has no class prefix

        assert.ok(err.cause instanceof Error) // original Temporal error kept
        return true
      })
    }
  })
})

describe('getters / setters', () => {
  it('getYear / getMonth (1-based ISO) / getDate / getDay (ISO 1=Mon…7=Sun)', () => {
    assert.equal(getYear(d), 2026)
    assert.equal(getMonth(d), 8) // August — matches the "08" in the string
    assert.equal(getDate(d), 6)
    assert.equal(getDay(d), 4) // Thursday — same number as date-fns
    assert.equal(getDay('2026-08-02'), 7) // Sunday — the only day that differs
    assert.equal(getDay('2026-08-03'), 1) // Monday
    assert.equal(getDay('2026-08-01'), 6) // Saturday
  })

  it('getMonth matches the month field of its own input, every month', () => {
    for (let m = 1; m <= 12; m += 1) {
      const iso = `2026-${String(m).padStart(2, '0')}-01`
      assert.equal(getMonth(iso), m, iso)
      assert.equal(setMonth('2026-01-01', m), iso)
    }
  })

  it('getDayOfYear / getDaysInMonth / getQuarter / isLeapYear', () => {
    assert.equal(getDayOfYear('2026-01-01'), 1)
    assert.equal(getDaysInMonth('2026-02-01'), 28)
    assert.equal(getDaysInMonth('2024-02-01'), 29)
    assert.equal(getQuarter(d), 3)
    assert.equal(getQuarter('2026-01-15'), 1)
    assert.equal(isLeapYear('2024-01-01'), true)
    assert.equal(isLeapYear('2026-01-01'), false)
  })

  it('setYear / setMonth / setDate', () => {
    assert.equal(setYear(d, 2030), '2030-08-06')
    assert.equal(setMonth(d, 1), '2026-01-06') // January
    assert.equal(setMonth(d, 12), '2026-12-06') // December — valid now, was a throw
    assert.equal(setDate(d, 1), '2026-08-01')
    assert.equal(setMonth('2026-01-31', 1), '2026-01-31') // January of a January date is a no-op
    assert.equal(setMonth('2026-01-31', 2), '2026-02-28') // constrain
    assert.throws(() => setMonth(d, 0), /1…12/)
    assert.throws(() => setMonth(d, 13), /1…12/)
  })

  it('setYear / setDate out of range throw with the daymath: prefix', () => {
    assert.throws(() => setYear(d, 999999), /daymath: setYear could not produce/)
    assert.throws(() => setDate(d, 0), /daymath: setDate could not produce/)
  })

  it('setDate constrains past the month end (no date-fns roll-over)', () => {
    assert.equal(setDate('2026-02-01', 31), '2026-02-28')
    assert.equal(setDate(d, 99), '2026-08-31')
  })
})

describe('start / end of unit', () => {
  it('month / year / quarter', () => {
    assert.equal(startOfMonth(d), '2026-08-01')
    assert.equal(endOfMonth(d), '2026-08-31')
    assert.equal(startOfYear(d), '2026-01-01')
    assert.equal(endOfYear(d), '2026-12-31')
    assert.equal(startOfQuarter(d), '2026-07-01')
    assert.equal(endOfQuarter(d), '2026-09-30')
    assert.equal(startOfQuarter('2026-01-15'), '2026-01-01')
    assert.equal(endOfQuarter('2026-12-01'), '2026-12-31')
  })

  it('week (default Sun start; Mon via option)', () => {
    // 2026-08-06 is Thursday
    assert.equal(startOfWeek(d), '2026-08-02') // Sunday
    assert.equal(endOfWeek(d), '2026-08-08') // Saturday
    assert.equal(startOfWeek(d, { weekStartsOn: 1 }), '2026-08-03') // Monday
    assert.equal(endOfWeek(d, { weekStartsOn: 1 }), '2026-08-09') // Sunday
  })
})

describe('difference / compare', () => {
  it('differenceInDays / Weeks', () => {
    assert.equal(differenceInDays('2026-08-06', '2026-08-01'), 5)
    assert.equal(differenceInDays('2026-08-01', '2026-08-06'), -5)
    assert.equal(differenceInWeeks('2026-08-15', '2026-08-01'), 2)
    assert.equal(differenceInWeeks('2026-08-14', '2026-08-01'), 1)
  })

  it('differenceInMonths / calendar months', () => {
    assert.equal(differenceInCalendarMonths('2026-08-06', '2026-01-31'), 7)
    // full months: Jan 31 → Aug 6 is not 7 full months from Jan 31
    assert.equal(differenceInMonths('2026-08-31', '2026-01-31'), 7)
    assert.equal(differenceInMonths('2026-08-30', '2026-01-31'), 6)
  })

  it('differenceInMonths counts the end of a short month as arrival', () => {
    // addMonths clamps Feb 31 to Feb 28, so the measurement has to agree
    assert.equal(differenceInMonths('2026-02-28', '2026-01-31'), 1)
    assert.equal(differenceInMonths('2024-02-29', '2024-01-31'), 1)
    assert.equal(differenceInMonths('1900-02-28', '1899-11-30'), 3)
    // the earlier date need not be its month's last day — any 29/30/31 clamps
    assert.equal(differenceInMonths('2026-02-28', '2026-01-30'), 1)
    // a day genuinely short is still not a full month
    assert.equal(differenceInMonths('2026-02-14', '2026-01-15'), 0)
    assert.equal(differenceInCalendarMonths('2026-02-14', '2026-01-15'), 1)
    // same calendar month, different days: no month boundary crossed at all
    assert.equal(differenceInMonths('2026-01-20', '2026-01-15'), 0)
    assert.equal(differenceInMonths('2026-01-15', '2026-01-20'), 0)
    assert.equal(differenceInMonths(d, d), 0)
    // one month short in the negative direction returns 0, not -0
    assert.ok(Object.is(differenceInMonths('2026-01-15', '2026-02-14'), 0))
  })

  it('differenceInMonths is symmetric in magnitude', () => {
    for (const [a, b] of [
      ['2027-02-28', '2026-02-28'],
      ['2026-02-28', '2026-01-31'],
      ['1900-02-28', '1899-11-30'],
    ]) {
      assert.equal(
        Math.abs(differenceInMonths(a, b)),
        Math.abs(differenceInMonths(b, a)),
        `${a} vs ${b}`,
      )
    }
  })

  it('differenceInMonths(addMonths(d, n), d) === n', () => {
    // the law that picked this implementation over Temporal since()
    for (const start of ['2026-01-31', '2026-01-30', '2024-02-29', '2026-03-31', '2026-08-06']) {
      for (let n = -24; n <= 24; n += 1) {
        assert.equal(differenceInMonths(addMonths(start, n), start), n, `${start} + ${n}`)
      }
    }
  })

  it('differenceInYears counts a clamped Feb 29 as arrival', () => {
    // addYears('2024-02-29', 1) is '2025-02-28', so that has to count as a year
    assert.equal(differenceInYears('2025-02-28', '2024-02-29'), 1)
    assert.equal(differenceInYears('2024-02-29', '2025-02-28'), -1)
    assert.equal(differenceInYears('2029-02-28', '2024-02-29'), 5)
    // leap to leap needs no clamp
    assert.equal(differenceInYears('2028-02-29', '2024-02-29'), 4)
    // genuinely a day short is still not a full year
    assert.equal(differenceInYears('2025-02-27', '2024-02-29'), 0)
    assert.equal(differenceInCalendarYears('2025-02-27', '2024-02-29'), 1)
  })

  it('differenceInYears(addYears(d, n), d) === n', () => {
    for (const start of ['2024-02-29', '2026-01-31', '2026-08-06', '2000-02-29', '1900-03-01']) {
      for (let n = -12; n <= 12; n += 1) {
        assert.equal(differenceInYears(addYears(start, n), start), n, `${start} + ${n}`)
      }
    }
  })

  it('differenceInYears agrees with trunc(differenceInMonths / 12)', () => {
    for (const [a, b] of [
      ['2025-02-28', '2024-02-29'],
      ['2029-02-28', '2024-02-29'],
      ['2026-01-15', '2024-11-15'],
      ['2026-01-15', '2024-06-15'],
      ['2024-02-29', '2029-02-28'],
    ]) {
      assert.equal(
        differenceInYears(a, b),
        Math.trunc(differenceInMonths(a, b) / 12),
        `${a} vs ${b}`,
      )
    }
  })

  it('no numeric export returns -0', () => {
    // enumerated from the module, not a hand-written list: hand-picked lists
    // under-count, and this exact bug shipped twice because a five-case probe
    // had no negative sub-week and no negative sub-quarter gap
    const numeric = Object.keys(dm).filter(
      (k) => typeof dm[k] === 'function' && /^(difference|compare)/.test(k),
    )
    assert.ok(numeric.length >= 10, `expected the whole family, got ${numeric.length}`)
    // offsets that truncate toward zero from below: sub-week, sub-quarter, sub-year
    for (const [a, b] of [
      ['2026-01-15', '2026-01-16'],
      ['2026-01-15', '2026-01-21'],
      ['2026-01-01', '2026-02-01'],
      ['2026-01-01', '2026-03-01'],
      ['2026-01-01', '2026-11-01'],
      ['2026-01-15', '2026-01-15'],
    ]) {
      for (const name of numeric) {
        assert.ok(
          !Object.is(dm[name](a, b), -0),
          `${name}('${a}', '${b}') returned -0`,
        )
      }
    }
  })

  it('differenceInQuarters follows differenceInMonths', () => {
    for (const [a, b] of [
      ['2026-02-28', '2026-01-31'],
      ['1900-02-28', '1899-11-30'],
      ['2026-08-06', '2026-02-06'],
      ['2026-01-01', '2027-06-30'],
    ]) {
      assert.equal(differenceInQuarters(a, b), Math.trunc(differenceInMonths(a, b) / 3), `${a} vs ${b}`)
    }
  })

  it('differenceInYears / calendar years / quarters', () => {
    assert.equal(differenceInCalendarYears('2026-01-01', '2024-12-31'), 2)
    assert.equal(differenceInYears('2026-08-06', '2024-08-06'), 2)
    assert.equal(differenceInYears('2026-08-05', '2024-08-06'), 1)
    assert.equal(differenceInQuarters('2026-08-06', '2026-02-06'), 2)
    assert.equal(differenceInCalendarQuarters('2026-08-01', '2026-01-01'), 2)
  })

  it('isBefore / isAfter / isEqual / isSameDay', () => {
    assert.equal(isBefore('2026-08-05', d), true)
    assert.equal(isAfter('2026-08-07', d), true)
    assert.equal(isEqual(d, d), true)
    assert.equal(isSameDay(d, d), true)
    assert.equal(isSameDay, isEqual)
    assert.equal(isEqual(d, '2026-08-05'), false)
  })

  it('isSameWeek / Month / Year / Quarter', () => {
    assert.equal(isSameWeek('2026-08-05', d), true)
    assert.equal(isSameWeek('2026-08-01', d), false) // Sat prev week if Sun start
    assert.equal(isSameWeek('2026-08-05', d, { weekStartsOn: 1 }), true)
    assert.equal(isSameMonth(d, '2026-08-01'), true)
    assert.equal(isSameMonth(d, '2026-07-31'), false)
    assert.equal(isSameYear(d, '2026-01-01'), true)
    assert.equal(isSameQuarter(d, '2026-09-01'), true)
    assert.equal(isSameQuarter(d, '2026-06-30'), false)
  })

  it('compareAsc / compareDesc / min / max', () => {
    assert.equal(compareAsc('2026-08-01', d), -1)
    assert.equal(compareAsc(d, d), 0)
    assert.equal(compareDesc('2026-08-01', d), 1)
    assert.ok(Object.is(compareDesc(d, d), 0)) // 0, not -0
    assert.equal(min(['2026-08-06', '2026-01-01', '2026-12-31']), '2026-01-01')
    assert.equal(max(['2026-08-06', '2026-01-01', '2026-12-31']), '2026-12-31')
    assert.throws(() => min([]), /non-empty/)
    assert.throws(() => min(/** @type {any} */ ('nope')), /non-empty/)
  })

  it('weekStartsOn validation', () => {
    assert.throws(() => startOfWeek(d, { weekStartsOn: /** @type {any} */ (8) }), /weekStartsOn/)
    assert.throws(() => startOfWeek(d, { weekStartsOn: /** @type {any} */ (-1) }), /weekStartsOn/)
    assert.throws(
      () => startOfWeek(d, { weekStartsOn: /** @type {any} */ (1.5) }),
      /weekStartsOn/,
    )
  })

  it('weekStartsOn 0 and 7 both mean Sunday, on every day of the week', () => {
    // 0 ≡ 7 (mod 7), so pre-0.3.0 callers passing 0 are unaffected
    for (let i = 0; i < 7; i += 1) {
      const day = addDays('2026-08-02', i) // Sunday through Saturday
      assert.equal(startOfWeek(day, { weekStartsOn: 0 }), startOfWeek(day, { weekStartsOn: 7 }), day)
      assert.equal(endOfWeek(day, { weekStartsOn: 0 }), endOfWeek(day, { weekStartsOn: 7 }), day)
      assert.equal(startOfWeek(day), startOfWeek(day, { weekStartsOn: 7 }), `${day} default`)
    }
  })
})

describe('weekday predicates', () => {
  it('named days / weekend / month edges', () => {
    assert.equal(isSunday('2026-08-02'), true)
    assert.equal(isMonday('2026-08-03'), true)
    assert.equal(isTuesday('2026-08-04'), true)
    assert.equal(isWednesday('2026-08-05'), true)
    assert.equal(isThursday(d), true)
    assert.equal(isFriday('2026-08-07'), true)
    assert.equal(isSaturday('2026-08-08'), true)
    assert.equal(isWeekend('2026-08-02'), true)
    assert.equal(isWeekend(d), false)
    assert.equal(isFirstDayOfMonth('2026-08-01'), true)
    assert.equal(isLastDayOfMonth('2026-08-31'), true)
    assert.equal(isLastDayOfMonth(d), false)
  })
})

describe('intervals', () => {
  it('eachDayOfInterval', () => {
    assert.deepEqual(
      eachDayOfInterval({ start: '2026-08-05', end: '2026-08-07' }),
      ['2026-08-05', '2026-08-06', '2026-08-07'],
    )
    assert.throws(
      () => eachDayOfInterval({ start: '2026-08-07', end: '2026-08-05' }),
      /start must not be after end/,
    )
    assert.throws(() => eachDayOfInterval(/** @type {any} */ (null)), /interval/)
    assert.throws(() => eachDayOfInterval(/** @type {any} */ ('x')), /interval/)
  })

  it('eachMonthOfInterval / eachYearOfInterval', () => {
    assert.deepEqual(
      eachMonthOfInterval({ start: '2026-01-15', end: '2026-03-20' }),
      ['2026-01-01', '2026-02-01', '2026-03-01'],
    )
    assert.deepEqual(
      eachYearOfInterval({ start: '2024-06-01', end: '2026-02-01' }),
      ['2024-01-01', '2025-01-01', '2026-01-01'],
    )
    assert.throws(
      () => eachMonthOfInterval({ start: '2026-03-01', end: '2026-01-01' }),
      /start must not be after end/,
    )
    assert.throws(
      () => eachYearOfInterval({ start: '2026-01-01', end: '2024-01-01' }),
      /start must not be after end/,
    )
  })

  it('walkers stop at the last max-PlainDate step instead of overflowing', () => {
    assert.deepEqual(
      eachDayOfInterval({ start: '+275760-09-12', end: '+275760-09-13' }),
      ['+275760-09-12', '+275760-09-13'],
    )
    assert.deepEqual(
      eachMonthOfInterval({ start: '+275760-09-01', end: '+275760-09-13' }),
      ['+275760-09-01'],
    )
  })

  it('isWithinInterval / clamp', () => {
    const iv = { start: '2026-08-01', end: '2026-08-10' }
    assert.equal(isWithinInterval('2026-08-05', iv), true)
    assert.equal(isWithinInterval('2026-08-01', iv), true)
    assert.equal(isWithinInterval('2026-07-31', iv), false)
    assert.equal(clamp('2026-07-01', iv), '2026-08-01')
    assert.equal(clamp('2026-08-05', iv), '2026-08-05')
    assert.equal(clamp('2026-09-01', iv), '2026-08-10')
    const bad = { start: '2026-08-10', end: '2026-08-01' }
    assert.throws(() => isWithinInterval(d, bad), /start must not be after end/)
    assert.throws(() => clamp(d, bad), /start must not be after end/)
  })

  it('areIntervalsOverlapping (date-fns default exclusive endpoints)', () => {
    const a = { start: '2026-08-01', end: '2026-08-10' }
    const b = { start: '2026-08-10', end: '2026-08-20' }
    assert.equal(areIntervalsOverlapping(a, b), false)
    assert.equal(areIntervalsOverlapping(a, b, { inclusive: true }), true)
    assert.equal(
      areIntervalsOverlapping(a, { start: '2026-08-05', end: '2026-08-15' }),
      true,
    )
    assert.throws(
      () =>
        areIntervalsOverlapping(
          { start: '2026-08-10', end: '2026-08-01' },
          b,
        ),
      /intervalLeft/,
    )
    assert.throws(
      () =>
        areIntervalsOverlapping(a, {
          start: '2026-08-20',
          end: '2026-08-10',
        }),
      /intervalRight/,
    )
  })
})

describe('range edges', () => {
  const MIN = '-271821-04-19' // first representable PlainDate
  const MAX = '+275760-09-13' // last representable PlainDate

  // Every call below asks for a day that cannot exist. Throwing is correct; the
  // point of the test is that the message stays ours and names the function the
  // caller actually called, never an internal helper it delegated to.
  const cases = [
    ['addDays', () => addDays(MAX, 1)],
    ['subDays', () => subDays(MIN, 1)],
    ['addWeeks', () => addWeeks(MAX, 1)],
    ['subWeeks', () => subWeeks(MIN, 1)],
    ['addMonths', () => addMonths(MAX, 1)],
    ['subMonths', () => subMonths(MIN, 1)],
    ['addQuarters', () => addQuarters(MAX, 1)],
    ['subQuarters', () => subQuarters(MIN, 1)],
    ['addYears', () => addYears(MAX, 1)],
    ['subYears', () => subYears(MIN, 1)],
    ['setYear', () => setYear(MIN, -271822)],
    ['setMonth', () => setMonth(MIN, 1)],
    ['setDate', () => setDate(MIN, 1)],
    ['startOfWeek', () => startOfWeek(MIN)],
    ['endOfWeek', () => endOfWeek(MIN)],
    ['startOfMonth', () => startOfMonth(MIN)],
    ['endOfMonth', () => endOfMonth(MAX)],
    ['startOfQuarter', () => startOfQuarter(MIN)],
    ['endOfQuarter', () => endOfQuarter(MAX)],
    ['startOfYear', () => startOfYear(MIN)],
    ['endOfYear', () => endOfYear(MAX)],
    ['isSameWeek', () => isSameWeek(MIN, MIN)],
    ['eachMonthOfInterval', () => eachMonthOfInterval({ start: MIN, end: '-271821-05-01' })],
    ['eachYearOfInterval', () => eachYearOfInterval({ start: MIN, end: '-271820-01-01' })],
  ]

  for (const [name, call] of cases) {
    it(`${name} throws with its own daymath: label`, () => {
      assert.throws(call, (err) => {
        assert.ok(err instanceof RangeError)
        assert.equal(
          err.message.startsWith(`daymath: ${name} could not produce a valid date`),
          true,
          `${name} reported: ${err.message}`,
        )
        assert.ok(err.cause instanceof Error) // original Temporal error kept
        return true
      })
    })
  }

  it('works right up to the edge it refuses to cross', () => {
    assert.equal(addDays(MAX, 0), MAX)
    assert.equal(subDays(MAX, 1), '+275760-09-12')
    assert.equal(addDays(MIN, 1), '-271821-04-20')
    assert.equal(startOfMonth(MAX), '+275760-09-01')
    assert.equal(endOfMonth(MIN), '-271821-04-30')
    assert.deepEqual(eachYearOfInterval({ start: '+275760-01-01', end: MAX }), [
      '+275760-01-01',
    ])
  })
})

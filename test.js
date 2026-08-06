import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Temporal } from 'temporal-polyfill'
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareAsc,
  compareDesc,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  isEqual,
  isValid,
  max,
  min,
  parse,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from './index.js'

const d = '2026-08-06'

describe('parse / format / isValid', () => {
  it('parses YYYY-MM-DD', () => {
    assert.equal(parse(d), d)
  })

  it('accepts PlainDate', () => {
    assert.equal(parse(Temporal.PlainDate.from(d)), d)
  })

  it('rejects Date', () => {
    assert.throws(() => parse(new Date(d)), /Date is not allowed/)
  })

  it('rejects time / sloppy strings', () => {
    assert.throws(() => parse('2026-08-06T12:00:00'), /YYYY-MM-DD/)
    assert.throws(() => parse('2026-8-6'), /YYYY-MM-DD/)
    assert.throws(() => parse('08/06/2026'), /YYYY-MM-DD/)
  })

  it('rejects impossible calendar days', () => {
    assert.throws(() => parse('2026-02-30'), /invalid/)
  })

  it('formats only yyyy-MM-dd', () => {
    assert.equal(format(d), d)
    assert.equal(format(d, 'yyyy-MM-dd'), d)
    assert.throws(() => format(d, 'MM/dd/yyyy'), /only/)
  })

  it('isValid', () => {
    assert.equal(isValid(d), true)
    assert.equal(isValid('nope'), false)
    assert.equal(isValid(new Date()), false)
  })
})

describe('add / sub', () => {
  it('addDays / subDays', () => {
    assert.equal(addDays(d, 1), '2026-08-07')
    assert.equal(addDays(d, -1), '2026-08-05')
    assert.equal(subDays(d, 1), '2026-08-05')
    assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  })

  it('addWeeks / subWeeks', () => {
    assert.equal(addWeeks(d, 1), '2026-08-13')
    assert.equal(subWeeks(d, 1), '2026-07-30')
  })

  it('addMonths constrains end-of-month', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
    assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
    assert.equal(subMonths('2026-03-31', 1), '2026-02-28')
  })

  it('addYears / subYears', () => {
    assert.equal(addYears(d, 1), '2027-08-06')
    assert.equal(subYears(d, 1), '2025-08-06')
    assert.equal(addYears('2024-02-29', 1), '2025-02-28')
  })

  it('rejects non-integer amounts', () => {
    assert.throws(() => addDays(d, 1.5), /integer/)
    assert.throws(() => addDays(d, NaN), /finite/)
  })
})

describe('difference / compare', () => {
  it('differenceInDays (date-fns order)', () => {
    assert.equal(differenceInDays('2026-08-06', '2026-08-01'), 5)
    assert.equal(differenceInDays('2026-08-01', '2026-08-06'), -5)
    assert.equal(differenceInDays(d, d), 0)
  })

  it('isBefore / isAfter / isEqual', () => {
    assert.equal(isBefore('2026-08-05', d), true)
    assert.equal(isAfter('2026-08-07', d), true)
    assert.equal(isEqual(d, d), true)
    assert.equal(isEqual(d, '2026-08-05'), false)
    assert.equal(isBefore(d, d), false)
  })

  it('compareAsc / compareDesc', () => {
    assert.equal(compareAsc('2026-08-01', d), -1)
    assert.equal(compareAsc(d, d), 0)
    assert.equal(compareAsc(d, '2026-08-01'), 1)
    assert.equal(compareDesc('2026-08-01', d), 1)
  })

  it('min / max', () => {
    assert.equal(min(['2026-08-06', '2026-01-01', '2026-12-31']), '2026-01-01')
    assert.equal(max(['2026-08-06', '2026-01-01', '2026-12-31']), '2026-12-31')
    assert.throws(() => min([]), /non-empty/)
  })
})

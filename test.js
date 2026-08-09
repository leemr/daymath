import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Temporal } from 'temporal-polyfill'
// A second, genuinely distinct Temporal implementation. Used to prove daymath
// accepts a PlainDate it did not build itself.
import { Temporal as Other } from 'temporal-polyfill/full'
// namespace import too, so the -0 sweep enumerates the module instead of a list
import * as dm from './index.js'

/** Outcome of a call, comparable whether it returned or threw. */
function capture(fn) {
  try {
    return { ok: fn() }
  } catch (err) {
    return { threw: err.constructor.name, message: err.message }
  }
}
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

describe('day() — the one export that reads a clock', () => {
  // Independent oracle. toISOString is UTC by definition and does not go
  // through Temporal, so this checks the wiring rather than restating it.
  const utcDayNow = () => new Date().toISOString().slice(0, 10)

  it('returns the UTC day by default', () => {
    // Sample either side of the call, so a midnight rollover cannot flake.
    const before = utcDayNow()
    const got = dm.day()
    const after = utcDayNow()
    assert.ok([before, after].includes(got), `${got} was not ${before} or ${after}`)
  })

  it("defaults to UTC, and 'utc' and 'UTC' mean the same zone", () => {
    const before = utcDayNow()
    const [bare, lower, upper] = [dm.day(), dm.day('utc'), dm.day('UTC')]
    const after = utcDayNow()
    // Equal to each other, unless the day turned over mid-test.
    if (before === after) {
      assert.equal(bare, lower)
      assert.equal(lower, upper)
      assert.equal(bare, before)
    }
  })

  it('returns a real daymath day that the rest of the API accepts', () => {
    const d = dm.day()
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(isValid(d), true)
    assert.equal(parse(d), d)
    assert.equal(addDays(d, 2), addDays(addDays(d, 1), 1))
  })

  it('honours an explicit zone, which can be a different day than UTC', () => {
    const tokyo = dm.day('Asia/Tokyo')
    const honolulu = dm.day('Pacific/Honolulu')
    assert.match(tokyo, /^\d{4}-\d{2}-\d{2}$/)
    // Tokyo is UTC+9 and Honolulu UTC-10, so they are never more than a day
    // apart, and Tokyo is never behind.
    const gap = differenceInDays(tokyo, honolulu)
    assert.ok(gap === 0 || gap === 1, `Tokyo minus Honolulu was ${gap}`)
  })

  it('throws with the daymath contract on an unknown zone', () => {
    // Zone-shaped, so the string takes the zone role and Temporal refuses it.
    for (const bad of ['nope', 'Mars/Olympus', 'Etc/Nowhere']) {
      assert.throws(
        () => dm.day(bad),
        (err) => {
          assert.ok(err instanceof RangeError)
          assert.equal(
            err.message,
            `daymath: day() got an unknown time zone ${JSON.stringify(bad)}`,
          )
          assert.ok(err.cause instanceof Error) // the runtime's own error is kept
          return true
        },
      )
    }
  })

  // Everything below passes a fixed moment, so it is a pure function and the
  // expected values are constants.
  const D = new Date('2026-08-07T02:30:00Z') // 22:30 on the 6th in New York

  it('converts a Date, and the zone decides the day', () => {
    assert.equal(dm.day(D), '2026-08-07') // UTC by default
    assert.equal(dm.day(D, 'utc'), '2026-08-07')
    assert.equal(dm.day(D, 'America/New_York'), '2026-08-06') // still the evening before
    assert.equal(dm.day(D, 'Asia/Tokyo'), '2026-08-07')
    assert.equal(dm.day(new Date(0), 'utc'), '1970-01-01')
    assert.equal(dm.day(new Date('1969-07-20T20:17:00Z'), 'utc'), '1969-07-20') // negative ms
  })

  it('reads a number as epoch milliseconds, exactly as new Date(n) does', () => {
    const n = 1761616161771
    assert.equal(dm.day(n), new Date(n).toISOString().slice(0, 10))
    assert.equal(dm.day(n), '2025-10-28')
    assert.equal(dm.day(0, 'utc'), '1970-01-01')
    assert.equal(dm.day(-14256000000, 'utc'), '1969-07-20')
    // The seconds trap, recorded rather than guarded. The same value meant as
    // seconds is 2025-10-28; read as milliseconds it is 1970-01-21. daymath
    // states the unit instead of sniffing it, so this is the documented answer.
    assert.equal(dm.day(1761616161, 'utc'), '1970-01-21')
  })

  it('truncates a fractional millisecond exactly as new Date(n) does', () => {
    // A float reaches here easily: Python time.time() is float seconds, so
    // `ts * 1000` is a float. new Date(n) truncates, and this promises to match.
    for (const n of [1761616161771.9, -1.5, 1.9, -1761616161771.9, 0.4]) {
      assert.equal(dm.day(n, 'utc'), new Date(n).toISOString().slice(0, 10), `day(${n})`)
    }
  })

  it('checks the zone even when the moment is already a day', () => {
    // Otherwise a caller mapping rows that are sometimes a Date and sometimes a
    // day string sees a mistyped zone fail on only some rows.
    assert.throws(() => dm.day('2026-05-05', 'Mars/Olympus'), /unknown time zone/)
    assert.throws(
      () => dm.day(Temporal.PlainDate.from('2026-05-05'), 'nope'),
      /unknown time zone/,
    )
    assert.throws(() => dm.day(new Date(0), 'Mars/Olympus'), /unknown time zone/)
    // and it still reads no clock for a day input, so the result is pure
    assert.equal(dm.day('2026-05-05', 'Asia/Tokyo'), '2026-05-05')
  })

  it('accepts null in the zone slot as "not given"', () => {
    // day(zone, config.timeZone) with a null config value must not read as two zones.
    assert.equal(dm.day('2026-05-05', null), '2026-05-05')
    assert.equal(dm.day(new Date(0), null), '1970-01-01')
    assert.equal(dm.day('Asia/Tokyo', null), dm.day('Asia/Tokyo'))
  })

  it('treats a day as already a day, so no zone applies', () => {
    assert.equal(dm.day('2026-05-05'), '2026-05-05')
    assert.equal(dm.day('2026-05-05', 'Asia/Tokyo'), '2026-05-05')
    assert.equal(dm.day('2026-05-05', 'Pacific/Honolulu'), '2026-05-05')
    assert.equal(dm.day('+010000-01-01'), '+010000-01-01')
    assert.equal(dm.day('-000001-12-31'), '-000001-12-31')
    // A PlainDate is a day too, including one from another implementation.
    assert.equal(dm.day(Temporal.PlainDate.from('2026-05-05')), '2026-05-05')
    assert.equal(dm.day(Other.PlainDate.from('2026-05-05'), 'Asia/Tokyo'), '2026-05-05')
  })

  it('reads a timestamp that names an exact instant', () => {
    // Z or an offset fixes the instant, so there is nothing left to guess.
    assert.equal(dm.day('1999-01-01T00:00:00Z'), '1999-01-01')
    assert.equal(dm.day('1970-01-01T00:00:00Z'), '1970-01-01')
    assert.equal(dm.day('1999-01-01T00:00:00.000Z'), '1999-01-01')
    assert.equal(dm.day('20260808T120000Z'), '2026-08-08') // the compact spelling
    // 21:00 in Tokyo is 12:00 UTC, so UTC and Tokyo name different days.
    assert.equal(dm.day('2026-08-08T21:00:00+09:00'), '2026-08-08')
    assert.equal(dm.day('2026-08-08T21:00:00+09:00', 'Asia/Tokyo'), '2026-08-08')
    assert.equal(dm.day('2026-08-08T23:00:00Z', 'Asia/Tokyo'), '2026-08-09')
  })

  it('lets a string that names its own zone keep its own day', () => {
    // Temporal will not build a ZonedDateTime from a bare offset, so a bracket
    // is the caller naming a zone. Reading the instant and applying UTC instead
    // moved a browser's date by one, which is the failure daymath exists to stop.
    const zdt = Temporal.ZonedDateTime.from('2026-08-08T20:00:00[America/New_York]')
    assert.equal(zdt.toString(), '2026-08-08T20:00:00-04:00[America/New_York]') // control
    assert.equal(zdt.toPlainDate().toString(), '2026-08-08') // the caller's own day
    assert.equal(dm.day(zdt.toString()), '2026-08-08')
    assert.equal(dm.day(zdt.toString({ timeZoneName: 'critical' })), '2026-08-08')
    // toJSON writes the same spelling, so a JSON round trip lands here.
    assert.equal(dm.day(JSON.parse(JSON.stringify({ t: zdt })).t), '2026-08-08')
    // A day or a time plus a zone is unambiguous too, so both are accepted.
    assert.equal(dm.day('1999-06-06[Asia/Tokyo]'), '1999-06-06')
    assert.equal(dm.day('2026-08-08T12:00[America/New_York]'), '2026-08-08')

    // The same instant without the bracket names no zone, so UTC applies.
    assert.equal(dm.day('2026-08-08T20:00:00-04:00'), '2026-08-09')

    // Two zones at once is a shape mistake, exactly as day('utc','Asia/Tokyo').
    assert.throws(() => dm.day(zdt.toString(), 'Asia/Tokyo'), {
      name: 'TypeError',
      message: `daymath: day() got two time zones, ${JSON.stringify(zdt.toString())} and "Asia/Tokyo"`,
    })

    // Naming a zone and resolving as one are different questions. A string that
    // names one and fails must throw. Falling back to the instant answered a UTC
    // day for all of these, silently, and off by one for the first two.
    for (const bad of [
      '2026-08-08T20:00:00-05:00[America/New_York]', // the offset contradicts the zone
      '2026-08-08T20:00:00+00:00[Asia/Tokyo]',
      '2026-08-08T20:00:00Z[Asia/Tokoy]', // a typo in the zone name
      '2026-08-08T20:00:00-04:00[Foo/Bar]',
    ]) {
      assert.throws(
        () => dm.day(bad),
        (err) => {
          assert.ok(err instanceof RangeError)
          assert.equal(
            err.message,
            `daymath: day() could not read ${JSON.stringify(bad)} in the time zone it names`,
          )
          assert.ok(err.cause instanceof Error) // the runtime's own error is kept
          return true
        },
        `day(${JSON.stringify(bad)}) must not answer a UTC day`,
      )
    }

    // The zoned path adjudicates the calendar like every other path. It returned
    // '2026-08-08[u-ca=buddhist]' once — a value daymath itself refuses.
    // A calendar is refused where it is APPLIED. With a zone bracket the fields
    // get renumbered and toPlainDate() carries the annotation into the output,
    // which returned '2026-08-08[u-ca=buddhist]' once — a value daymath refuses.
    // It is settled on the string, before the parse, because native Temporal
    // builds such a ZonedDateTime and the polyfill refuses to.
    // A calendar that only relabels the year passes, and the annotation rides along, exactly as
    // it does through every other export. One that renumbers is still refused.
    for (const s of [
      '2026-08-08T12:00[America/New_York][u-ca=buddhist]',
      '2026-08-08T12:00[America/New_York][!u-ca=buddhist]',
    ]) {
      assert.equal(dm.day(s), '2026-08-08[u-ca=buddhist]')
    }
    assert.equal(
      dm.day('2026-08-08T12:00[UTC][u-ca=gregory]'),
      '2026-08-08[u-ca=gregory]',
    )
    assert.throws(
      () => dm.day('1999-06-06[Asia/Tokyo][u-ca=hebrew]'),
      /renumbers months or days/,
    )
    // Without a zone bracket the calendar is inert, so it is ignored rather than
    // refused. An Instant has no year, month or day for a calendar to renumber.
    assert.equal(dm.day('2026-08-08T20:00:00Z[u-ca=buddhist]'), '2026-08-08')
    assert.equal(dm.day('2026-08-08T20:00:00-04:00[u-ca=buddhist]'), '2026-08-09')
    // And it accepts the one annotation daymath accepts anywhere else.
    assert.equal(dm.day('2026-08-08T12:00[America/New_York][u-ca=iso8601]'), '2026-08-08')
    // The zone slot is checked by shape too, and for the same reason: hour 25
    // is a time zone to temporal-polyfill and not one to native Temporal, so
    // letting the implementation decide made the answer depend on the runtime.
    for (const bad of [
      '2026-08-08T25:00:00Z',
      '1999-01-01T00:00:00Z',
      '11/12/2026',
      'T12:00:00Z',
      'T120000Z',
      // A non-string coerces inside .test(), so the typeof guard must come
      // first. Each of these threw a foreign error once: "Cannot convert object
      // to primitive value", "boom", "Cannot convert a Symbol value".
      Object.create(null),
      {
        toString: () => {
          throw new Error('boom')
        },
      },
      Symbol('x'),
    ]) {
      assert.throws(() => dm.day('2026-05-05', bad), {
        name: 'RangeError',
        message: `daymath: day() got an unknown time zone ${JSON.stringify(bad)}`,
      })
    }
    // An offset spelling of a zone still works.
    assert.equal(dm.day('+05:30'), dm.day(undefined, '+05:30'))
    assert.equal(dm.day('+0530'), dm.day(undefined, '+0530'))
    assert.equal(dm.day('Etc/GMT+5'), dm.day(undefined, 'Etc/GMT+5'))
  })

  it('refuses a string that is neither a moment nor a zone', () => {
    // Temporal's zone grammar accepts a whole timestamp and pulls the zone out
    // of it. Letting it pick the role read a date as a zone and answered today.
    for (const bad of [
      '11/12/2026', // nobody can tell November from December in this
      '2026-08-08T12:00', // no offset and no zone, so daymath would have to pick
      '2026-W32-5',
      '12:30:00',
      '2026-08-08T25:00:00Z', // hour 25
      // An ISO time-only string starts with T, so a letter-led zone rule let it
      // through. Native Temporal reads a zone out of it and answers today; the
      // polyfill refuses it. Both spellings and both cases must fail here.
      'T12:00:00Z',
      't12:00:00Z',
      'T120000Z', // compact, so no colon to catch it
      'T12:00:00+05:00',
    ]) {
      assert.throws(
        () => dm.day(bad),
        (err) => {
          assert.ok(err instanceof RangeError)
          assert.equal(
            err.message,
            `daymath: day() got ${JSON.stringify(bad)}, which is neither a moment nor a time zone`,
          )
          return true
        },
        `day(${JSON.stringify(bad)}) must not answer`,
      )
    }
  })

  it('refuses an ambiguous or unusable moment', () => {
    assert.throws(
      () => dm.day(new Date('garbage')),
      (err) => {
        assert.ok(err instanceof RangeError)
        assert.equal(err.message, 'daymath: day() got an Invalid Date')
        return true
      },
    )
    for (const bad of [NaN, Infinity, -Infinity]) {
      assert.throws(
        () => dm.day(bad),
        (err) => {
          assert.ok(err instanceof RangeError)
          assert.equal(err.message, `daymath: day() got a non-finite time value ${bad}`)
          return true
        },
      )
    }
    for (const bad of [true, [], {}, Symbol('x')]) {
      assert.throws(
        () => dm.day(bad),
        (err) => {
          assert.ok(err instanceof TypeError)
          assert.equal(
            err.message,
            'daymath: day() takes a Date, epoch milliseconds, or an ISO 8601 day',
          )
          return true
        },
      )
    }
    // A zone in both slots is a shape mistake, not a silent preference.
    assert.throws(
      () => dm.day('utc', 'Asia/Tokyo'),
      (err) => {
        assert.ok(err instanceof TypeError)
        assert.equal(
          err.message,
          'daymath: day() got two time zones, "utc" and "Asia/Tokyo"',
        )
        return true
      },
    )
    // Beyond the representable range, it keeps the daymath: prefix. Asserted on
    // err.message, because a RegExp here would match String(err) and its class.
    assert.throws(
      () => dm.day(8.64e15 + 1, 'utc'),
      (err) => {
        assert.ok(err instanceof RangeError)
        assert.equal(err.message, 'daymath: day could not produce a valid date')
        assert.ok(err.cause instanceof Error)
        return true
      },
    )
  })

  it('null and undefined mean "now", and a zone in slot two still counts', () => {
    const before = utcDayNow()
    const [bare, nul] = [dm.day(), dm.day(null)]
    const after = utcDayNow()
    if (before === after) assert.equal(nul, bare)
    // day(undefined, tz) must honour the zone rather than drop it.
    const tokyo = dm.day(undefined, 'Asia/Tokyo')
    assert.equal(tokyo, dm.day('Asia/Tokyo'))
  })
})

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

describe('a PlainDate from another Temporal implementation', () => {
  // `temporal-polyfill/full` is a genuinely separate class from the base entry,
  // so it stands in for native Temporal or a second copy of the polyfill in one
  // dependency tree. No extra dependency, and no faking globalThis.
  const OTHER = Other.PlainDate
  const iso = '2026-01-31'
  const foreign = OTHER.from(iso)

  it('control: it really is a foreign class that instanceof rejects', () => {
    assert.notEqual(OTHER, Temporal.PlainDate)
    assert.equal(foreign instanceof Temporal.PlainDate, false)
    assert.equal(Object.prototype.toString.call(foreign), '[object Temporal.PlainDate]')
  })

  it('is indistinguishable from its ISO day string, across every export', () => {
    // Enumerate the module. A hand-typed list under-counts the surface.
    const names = Object.keys(dm).filter((n) => typeof dm[n] === 'function')
    assert.ok(names.length > 60, `expected the whole surface, got ${names.length}`)
    for (const name of names) {
      const viaDate = capture(() => dm[name](foreign))
      const viaString = capture(() => dm[name](iso))
      assert.deepEqual(
        viaDate,
        viaString,
        `${name} treats a foreign PlainDate differently`,
      )
    }
  })

  it('accepts a calendar that only relabels the year, and refuses one that renumbers', () => {
    // Two families, and the rule is measured rather than listed. Buddhist keeps month and day
    // and shifts the year by 543, so every export still answers honestly. Hebrew renumbers all
    // three, so a day in it cannot be answered at all.
    const buddhist = OTHER.from('2026-01-31[u-ca=buddhist]')
    assert.equal(buddhist.year, 2569) // control: 2026 + 543
    assert.equal(buddhist.month, 1) // month and day match ISO here
    assert.equal(buddhist.day, 31)

    // The annotation rides along, so the caller's own numbering survives the round trip.
    assert.equal(format(buddhist), '2026-01-31[u-ca=buddhist]')
    assert.equal(dm.getYear(buddhist), 2569) // NOT 2026: the caller's object says 2569
    assert.equal(dm.getMonth(buddhist), 1)
    assert.equal(dm.getDate(buddhist), 31)
    assert.equal(dm.addDays(buddhist, 1), '2026-02-01[u-ca=buddhist]')
    assert.equal(dm.setYear(buddhist, 2570), '2027-01-31[u-ca=buddhist]')
    assert.equal(dm.day(buddhist), '2026-01-31[u-ca=buddhist]')
    assert.equal(parse('2026-01-31[u-ca=buddhist]'), '2026-01-31[u-ca=buddhist]')
    // The critical spelling is accepted too: daymath now understands the annotation, which is
    // exactly what the `!` asks a reader to confirm before proceeding.
    assert.equal(parse('2026-01-31[!u-ca=buddhist]'), '2026-01-31[u-ca=buddhist]')

    // roc and japanese pass the same rule. Temporal reports a continuous year for both, so both
    // are pure labels. Intl would answer the ERA year here, 115 and 8, and disagree with Temporal
    // on japanese; Temporal is the reference, so Temporal is what the rule reads.
    assert.equal(dm.getYear('2026-01-31[u-ca=roc]'), 115) // 2026 − 1911
    assert.equal(dm.getYear('2026-01-31[u-ca=japanese]'), 2026) // offset 0, not Reiwa 8
    assert.equal(dm.getYear('2026-01-31[u-ca=gregory]'), 2026)
    // roc before 1912 is still a pure offset in Temporal terms, so it still works.
    assert.equal(dm.getYear('1900-01-01[u-ca=roc]'), -11)

    // A day is the same day whatever the year is labelled, so a mixed pair measures and compares
    // rather than throwing. Temporal's own `since` refuses this with `Mismatched calendars`.
    assert.equal(dm.differenceInDays('2026-03-01', '2026-01-31[u-ca=buddhist]'), 29)
    assert.equal(dm.isEqual('2026-01-31[u-ca=buddhist]', '2026-01-31'), true)
    assert.equal(dm.isSameWeek('2026-01-31[u-ca=buddhist]', '2026-01-31'), true)

    const hebrew = OTHER.from('2026-01-31[u-ca=hebrew]')
    assert.equal(hebrew.month, 5) // control: Hebrew names this month 5
    assert.throws(() => format(hebrew), /renumbers months or days/)
    assert.throws(() => dm.getMonth(hebrew), /renumbers months or days/) // would have said 1

    // The error names the calendar and the way out, not a malformed string.
    assert.throws(() => dm.getMonth(hebrew), {
      name: 'RangeError',
      message:
        'daymath: date calendar "hebrew" renumbers months or days, so daymath cannot answer a day in it (convert with withCalendar(\'iso8601\'))',
    })
    // A lunisolar calendar cannot be caught by a month COUNT: hebrew has 12 months in 2025 and
    // 2026 and 13 in 2024 and 2027, so only the field comparison is right in every year.
    for (const y of ['2024', '2025', '2026', '2027']) {
      assert.throws(() => dm.getMonth(`${y}-01-31[u-ca=hebrew]`), /renumbers/)
    }
    // A calendar the runtime cannot build at all gets its own message, so a typo is not read as
    // a renumbering calendar.
    assert.throws(() => parse('2026-01-31[u-ca=buddhst]'), {
      name: 'RangeError',
      message:
        'daymath: date calendar "buddhst" is not a calendar this runtime knows (convert with withCalendar(\'iso8601\'))',
    })

    // But `[u-ca=iso8601]` is the caller's own round-trip, so it is accepted
    // and dropped. Temporal writes it for toString({calendarName:'always'}).
    const written = Temporal.PlainDate.from(iso).toString({ calendarName: 'always' })
    assert.equal(written, '2026-01-31[u-ca=iso8601]') // control: Temporal wrote it
    assert.equal(format(written), iso)
    assert.equal(dm.getYear(written), 2026)
    assert.equal(format('2026-01-31[!u-ca=iso8601]'), iso) // the critical spelling
    assert.equal(format('+002026-01-31[u-ca=iso8601]'), iso) // and the expanded year
    // BCP-47 calendar keys are case-insensitive, and Temporal accepts this.
    assert.equal(format('2026-01-31[u-ca=ISO8601]'), iso)
    // An impossible day inside a valid annotation still fails as a day.
    assert.throws(() => parse('2026-02-30[u-ca=iso8601]'), /invalid date/)

    // Bracket shapes that are not annotations, each reading as a malformed day.
    // The annotation is found by lastIndexOf rather than by a pattern, because
    // `^(.*)\[…\]$` backtracks: '[u-ca='.repeat(64000) cost 9.0 seconds, and
    // CodeQL js/polynomial-redos reported it before any timing was taken.
    for (const bad of [
      '2026-01-31]', // a closing bracket with no opening one
      '2026-01-31[u-ca=]', // an empty calendar
      '[u-ca=[u-ca=[u-ca=x]]]', // brackets that do not nest as they appear
    ]) {
      assert.throws(() => parse(bad), /must be ISO 8601 day/)
    }
    // An unclosed bracket names no zone, so day() reads it as neither role.
    assert.throws(
      () => dm.day('2026-08-08T12:00[America'),
      /which is neither a moment nor a time zone/,
    )

    // day() shares one predicate with every other export, so it must agree with
    // them on every annotated spelling. It refused all of these once.
    for (const s of [written, '2026-01-31[!u-ca=iso8601]', '2026-01-31[u-ca=ISO8601]']) {
      assert.equal(dm.day(s), iso, `day(${JSON.stringify(s)}) must match parse`)
    }
    // And on an accepted calendar, where both must carry the annotation through.
    assert.equal(dm.day('2026-01-31[u-ca=buddhist]'), '2026-01-31[u-ca=buddhist]')
    assert.equal(parse('2026-01-31[u-ca=buddhist]'), dm.day('2026-01-31[u-ca=buddhist]'))
    // And on a refused one, with the same wording from both.
    assert.throws(() => dm.day('2026-01-31[u-ca=hebrew]'), /renumbers months or days/)
    assert.throws(() => parse('2026-01-31[u-ca=hebrew]'), /renumbers months or days/)

    // withCalendar is the deliberate way through, and daymath takes the result.
    assert.equal(format(buddhist.withCalendar('iso8601')), iso)
    assert.equal(dm.getYear(buddhist.withCalendar('iso8601')), 2026)
    // An ISO-calendar PlainDate from the same foreign implementation is fine.
    assert.equal(format(OTHER.from('2026-01-31[u-ca=iso8601]')), iso)
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
      assert.throws(
        () => fn(d, 1e9),
        (err) => {
          assert.ok(err instanceof RangeError)
          assert.match(err.message, new RegExp(`^daymath: ${name} could not produce`)) // err.message has no class prefix

          assert.ok(err.cause instanceof Error) // original Temporal error kept
          return true
        },
      )
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
    for (const start of [
      '2026-01-31',
      '2026-01-30',
      '2024-02-29',
      '2026-03-31',
      '2026-08-06',
    ]) {
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
    for (const start of [
      '2024-02-29',
      '2026-01-31',
      '2026-08-06',
      '2000-02-29',
      '1900-03-01',
    ]) {
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

  it('differenceInMonths is the floor of addMonths', () => {
    // The property that defines the function: the largest n where
    // addMonths(earlier, n) <= later. Everything else about the month rule
    // follows from this plus whatever addMonths does, so this is the one to
    // keep if the others are ever cut.
    for (const earlier of [
      '2026-01-31',
      '2026-01-30',
      '2024-02-29',
      '2026-08-06',
      '2025-12-31',
    ]) {
      for (let step = 1; step <= 400; step += 7) {
        const later = addDays(earlier, step)
        const k = differenceInMonths(later, earlier)
        assert.ok(
          compareAsc(addMonths(earlier, k), later) <= 0,
          `addMonths(${earlier}, ${k}) overshoots ${later}`,
        )
        assert.ok(
          compareAsc(addMonths(earlier, k + 1), later) > 0,
          `addMonths(${earlier}, ${k + 1}) failed to overshoot ${later}`,
        )
      }
    }
  })

  it('difference counts never decrease as the later date advances', () => {
    for (const earlier of ['2026-01-31', '2024-02-29', '1900-11-30']) {
      let prevM = null
      let prevY = null
      let later = earlier
      for (let i = 0; i < 800; i += 1) {
        later = addDays(later, 1)
        const m = differenceInMonths(later, earlier)
        const y = differenceInYears(later, earlier)
        if (prevM !== null) assert.ok(m >= prevM, `months dropped at ${later}`)
        if (prevY !== null) assert.ok(y >= prevY, `years dropped at ${later}`)
        prevM = m
        prevY = y
      }
    }
  })

  it('every difference function is antisymmetric', () => {
    const pairs = [
      ['2026-02-28', '2026-01-31'],
      ['2024-02-29', '2025-02-28'],
      ['2026-01-15', '2024-06-15'],
      ['2026-01-15', '2026-01-16'],
      ['1900-11-30', '1901-02-28'],
    ]
    const names = Object.keys(dm).filter(
      (k) => typeof dm[k] === 'function' && k.startsWith('difference'),
    )
    for (const [a, b] of pairs) {
      for (const name of names) {
        // `|| 0` on the expected side only: negating a clean 0 yields -0, and
        // assert.equal uses Object.is, so without it the assertion fails on the
        // sign the functions deliberately do not produce
        assert.equal(dm[name](a, b), -dm[name](b, a) || 0, `${name}('${a}', '${b}')`)
      }
    }
  })

  it('the derived difference functions match their definitions', () => {
    for (const [a, b] of [
      ['2026-02-28', '2026-01-31'],
      ['2026-01-15', '2024-06-15'],
      ['2024-02-29', '2029-02-28'],
      ['2026-01-15', '2026-01-16'],
    ]) {
      // `|| 0` on the expected side: raw Math.trunc still yields -0 for a
      // negative gap that truncates to zero, which is exactly what these
      // functions were changed to stop returning
      assert.equal(
        differenceInWeeks(a, b),
        Math.trunc(differenceInDays(a, b) / 7) || 0,
        `weeks ${a} ${b}`,
      )
      assert.equal(
        differenceInQuarters(a, b),
        Math.trunc(differenceInMonths(a, b) / 3) || 0,
        `quarters ${a} ${b}`,
      )
      assert.equal(
        differenceInYears(a, b),
        Math.trunc(differenceInMonths(a, b) / 12) || 0,
        `years ${a} ${b}`,
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
        assert.ok(!Object.is(dm[name](a, b), -0), `${name}('${a}', '${b}') returned -0`)
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
      assert.equal(
        differenceInQuarters(a, b),
        Math.trunc(differenceInMonths(a, b) / 3),
        `${a} vs ${b}`,
      )
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
    assert.throws(
      () => startOfWeek(d, { weekStartsOn: /** @type {any} */ (8) }),
      /weekStartsOn/,
    )
    assert.throws(
      () => startOfWeek(d, { weekStartsOn: /** @type {any} */ (-1) }),
      /weekStartsOn/,
    )
    assert.throws(
      () => startOfWeek(d, { weekStartsOn: /** @type {any} */ (1.5) }),
      /weekStartsOn/,
    )
  })

  it('weekStartsOn 0 and 7 both mean Sunday, on every day of the week', () => {
    // 0 ≡ 7 (mod 7), so pre-0.3.0 callers passing 0 are unaffected
    for (let i = 0; i < 7; i += 1) {
      const day = addDays('2026-08-02', i) // Sunday through Saturday
      assert.equal(
        startOfWeek(day, { weekStartsOn: 0 }),
        startOfWeek(day, { weekStartsOn: 7 }),
        day,
      )
      assert.equal(
        endOfWeek(day, { weekStartsOn: 0 }),
        endOfWeek(day, { weekStartsOn: 7 }),
        day,
      )
      assert.equal(
        startOfWeek(day),
        startOfWeek(day, { weekStartsOn: 7 }),
        `${day} default`,
      )
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
    assert.deepEqual(eachDayOfInterval({ start: '2026-08-05', end: '2026-08-07' }), [
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
    assert.throws(
      () => eachDayOfInterval({ start: '2026-08-07', end: '2026-08-05' }),
      /start must not be after end/,
    )
    assert.throws(() => eachDayOfInterval(/** @type {any} */ (null)), /interval/)
    assert.throws(() => eachDayOfInterval(/** @type {any} */ ('x')), /interval/)
  })

  it('names the interval, not "start", for every non-interval value', () => {
    // A bare `typeof x === 'object'` guard let a Date, an array and a PlainDate
    // reach toPlainDate, which then blamed a `start` the caller never passed.
    const notIntervals = [
      ['null', null],
      ['string', '2026-01-31'],
      ['number', 7],
      ['Date', new Date()],
      ['array', []],
      ['PlainDate', Temporal.PlainDate.from('2026-01-31')],
      ['{ start } only', { start: '2026-01-01' }],
      ['{ end } only', { end: '2026-01-01' }],
    ]
    // `assert.throws` with a RegExp matches String(err), which carries a
    // "TypeError: " prefix. Assert on err.message so the match is exact.
    const INTERVAL_ERROR = 'daymath: interval must be { start, end }'
    const exactly = (where) => (err) => {
      assert.ok(err instanceof TypeError, where)
      assert.equal(err.message, INTERVAL_ERROR, where)
      return true
    }
    // Interval position differs: first arg for the walkers, second for these two.
    const atArg1 = [
      dm.eachDayOfInterval,
      dm.eachMonthOfInterval,
      dm.eachYearOfInterval,
      dm.areIntervalsOverlapping,
    ]
    const atArg2 = [dm.isWithinInterval, dm.clamp]
    for (const [label, bad] of notIntervals) {
      for (const fn of atArg1) {
        assert.throws(() => fn(bad), exactly(`${fn.name} on ${label}`))
      }
      for (const fn of atArg2) {
        assert.throws(() => fn('2026-01-31', bad), exactly(`${fn.name} on ${label}`))
      }
    }
    // Both lists must stay complete: every export that reads an interval, in
    // either position. Enumerated from the module, never typed by hand.
    const INTERVAL_MSG = INTERVAL_ERROR
    const reachedByArg1 = Object.keys(dm).filter(
      (n) => capture(() => dm[n](null)).message === INTERVAL_MSG,
    )
    assert.deepEqual(reachedByArg1.toSorted(), atArg1.map((f) => f.name).toSorted())
    // Slot 2 cannot be probed the same way, because clamp and isWithinInterval
    // take the *date* first while areIntervalsOverlapping takes an interval. So
    // assert the union instead: every export able to emit this message must be
    // declared in one of the two lists above. No slot attribution needed.
    const good = { start: '2026-01-01', end: '2026-01-05' }
    const emitsIntervalError = Object.keys(dm).filter((n) =>
      [() => dm[n](null), () => dm[n]('2026-01-03', null), () => dm[n](good, null)].some(
        (call) => capture(call).message === INTERVAL_MSG,
      ),
    )
    const declared = [...atArg1, ...atArg2].map((f) => f.name)
    assert.deepEqual(emitsIntervalError.toSorted(), declared.toSorted())
  })

  it('eachMonthOfInterval / eachYearOfInterval', () => {
    assert.deepEqual(eachMonthOfInterval({ start: '2026-01-15', end: '2026-03-20' }), [
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ])
    assert.deepEqual(eachYearOfInterval({ start: '2024-06-01', end: '2026-02-01' }), [
      '2024-01-01',
      '2025-01-01',
      '2026-01-01',
    ])
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
      () => areIntervalsOverlapping({ start: '2026-08-10', end: '2026-08-01' }, b),
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
    [
      'eachMonthOfInterval',
      () => eachMonthOfInterval({ start: MIN, end: '-271821-05-01' }),
    ],
    [
      'eachYearOfInterval',
      () => eachYearOfInterval({ start: MIN, end: '-271820-01-01' }),
    ],
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

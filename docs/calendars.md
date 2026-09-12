# Calendars

daymath answers in ISO 8601 days. Temporal can put a different calendar on a `PlainDate`, and the
same day then carries different numbers. This page is the whole rule, the measured line it draws,
and the one trap that gives a wrong answer with no error.

Back to the [README](../README.md).

## Which calendars daymath accepts

Temporal can put a calendar on a `PlainDate`. The same *day* then carries different numbers:

| calendar | year | month | day | `toString()` | daymath |
|---|---|---|---|---|---|
| `iso8601` | 2026 | 1 | 31 | `2026-01-31` | accepted |
| `buddhist` | **2569** | 1 | 31 | `2026-01-31[u-ca=buddhist]` | **accepted** |
| `roc` | **115** | 1 | 31 | `2026-01-31[u-ca=roc]` | **accepted** |
| `japanese` | 2026 | 1 | 31 | `2026-01-31[u-ca=japanese]` | **accepted** |
| `gregory` | 2026 | 1 | 31 | `2026-01-31[u-ca=gregory]` | **accepted** |
| `hebrew` | 5786 | **5** | **13** | `2026-01-31[u-ca=hebrew]` | refused |
| `chinese` | 2025 | **13** | **13** | `2026-01-31[u-ca=chinese]` | refused |

**daymath accepts a calendar that only relabels the year, and refuses one that renumbers.** The
line is measured at runtime, not held as a list, so a calendar CLDR adds later needs no code
change here. Two conditions, both required, on nine probe dates spanning 1900 to 2100:

1. **Month and day equal the ISO fields.** A month *count* would be wrong: `hebrew` is lunisolar,
   so it has 12 months in 2025 and 13 in 2027.
2. **The year offset is constant.** Two probe pairs straddle a Japanese era boundary, because an
   era change inside one ISO year is what separates a label from a renumbering.

For the accepting family only the year label moves, so every export still answers honestly, and
the annotation rides along:

```js
getYear('2026-01-31[u-ca=buddhist]')        // 2569  not 2026
getMonth('2026-01-31[u-ca=buddhist]')       // 1
addDays('2026-01-31[u-ca=buddhist]', 1)     // '2026-02-01[u-ca=buddhist]'
setYear('2026-01-31[u-ca=buddhist]', 2570)  // '2027-01-31[u-ca=buddhist]'
getYear('2026-01-31[u-ca=roc]')             // 115
getYear('2026-01-31[u-ca=japanese]')        // 2026
```

A renumbering calendar is refused, and the message names the calendar and the way out. A calendar
this runtime cannot build at all gets its own message, so a typo does not read as a renumbering
calendar:

```js
getMonth('2026-01-31[u-ca=hebrew]')
// RangeError: daymath: date calendar "hebrew" renumbers months or days, so daymath
//             cannot answer a day in it (convert with withCalendar('iso8601'))

getYear('2026-01-31[u-ca=buddhst]')
// RangeError: daymath: date calendar "buddhst" is not a calendar this runtime knows
//             (convert with withCalendar('iso8601'))

format(hebrewDate.withCalendar('iso8601'))   // '2026-01-31'
```

**A day is the same day whatever its year is labelled, so a mixed pair measures rather than
throwing.** Temporal's own `since` refuses this with `Mismatched calendars`, and its `equals`
compares the calendar as well as the day. Neither matters to a day count, so daymath normalises
both sides for measurement. Only the exports that read or write a field honour the label:

```js
differenceInDays('2026-03-01', '2026-01-31[u-ca=buddhist]')   // 29
isEqual('2026-01-31[u-ca=buddhist]', '2026-01-31')            // true
```

**The object form is a different day, and that is Temporal's rule, not daymath's.** A string's
date part is always ISO; the annotation changes how fields are *read*, never how the string
*parses*:

```js
Temporal.PlainDate.from('2026-01-31[u-ca=buddhist]')            // ISO 2026-01-31, .year 2569
Temporal.PlainDate.from({year: 2026, month: 1, day: 31,
                         calendar: 'buddhist'})                  // ISO 1483-01-31, .year 2026
```

543 years apart. daymath takes strings and `PlainDate` objects, never the fields form, so it
inherits Temporal's rule and stays consistent with it.

`[u-ca=iso8601]` is accepted and dropped rather than carried. Temporal writes it itself for
`toString({ calendarName: 'always' })`, and daymath already answers in it:

```js
const written = plainDate.toString({ calendarName: 'always' })  // '2026-01-31[u-ca=iso8601]'
getYear(written)                                                // 2026
```

A calendar is judged where it is **applied**. On a day string it is, and with a `[Zone]` bracket
it is. Without a bracket the string names an `Instant`, which has no year, month or day for a
calendar to renumber, so the annotation is inert.

**`day()` accepts every annotation the other exports accept, and drops it from the result.** It is
the normaliser: a moment converts to a plain ISO day, and so does a day. One rule, three input
shapes:

```js
day('2026-08-08T20:00:00Z[u-ca=buddhist]')                  // '2026-08-08'
day('2026-08-08T12:00[America/New_York][u-ca=buddhist]')    // '2026-08-08'
day('2026-08-08[u-ca=buddhist]')                            // '2026-08-08'
day('1999-06-06[Asia/Tokyo][u-ca=hebrew]')                  // throws

parse('2026-08-08[u-ca=buddhist]')     // '2026-08-08[u-ca=buddhist]'  parse keeps it
```

`parse` validates and preserves. `day()` normalises. Every other export carries the annotation,
because the caller asked for that numbering.

## Working in a non-ISO calendar

**Do not pass the calendar's own year as a bare ISO year.** This is the one way to get a wrong
answer with no error, and it is why the annotation is not decoration.

Buddhist 2567 is ISO 2024, which is a leap year. The Buddhist year is ISO + 543, and 543 mod 4 is
3, so the leap years land in different places:

| call | bare `2567` | annotated, the real Buddhist 2567 |
|---|---|---|
| `isLeapYear` | `false` | `true` |
| `getDaysInMonth` for February | `28` | `29` |
| `parse('…-02-29')` | throws `invalid date` | `2024-02-29[u-ca=buddhist]` |
| `addDays(Feb 28, 1)` | `2567-03-01` | `2024-02-29[u-ca=buddhist]` |

**The two disagree in 49 of the 101 Buddhist years from 2500 to 2600.** Nothing throws on the
bare form, and `addDays('2567-02-28', 1)` answering `2567-03-01` looks reasonable, so a date lands
one day early for the rest of that year. Every other month is identical, because February is the
only month whose length varies.

**A `Date` cannot help you here, because a `Date` has no calendar.** It is one number of
milliseconds. `getUTCFullYear()` is always Gregorian, so a Thai user's `Date` already holds `2026`.
The `2569` exists only at display time, when `Intl` formats it:

```js
new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {dateStyle: 'short'}).format(d)   // '8/8/69'
```

So the recipe is:

1. From a `Date` or a timestamp, call `day(…)`. You get a plain ISO day.
2. To work in Buddhist years, annotate that day: `'2026-08-08[u-ca=buddhist]'`. Now `getYear` is
   `2569`, `isLeapYear` is right, and every export carries the annotation through.
3. **From a Buddhist year *number*, use Temporal's fields form.** This is the one place the
   fields/string asymmetry helps rather than traps:

```js
Temporal.PlainDate.from({year: 2569, month: 8, day: 8, calendar: 'buddhist'}).toString()
// '2026-08-08[u-ca=buddhist]'      <- and daymath accepts the object directly too
```

4. For display, use `Intl`. daymath does no localised formatting.

One more trap in the same family: `'2569-08-08[u-ca=buddhist]'` is a valid string, and its
`getYear` is **3112**. The date part is ISO 2569, and the annotation adds 543 on top.

Supporting these calendars costs **4.2 kB gzip**, because daymath resolves them with `getAny`, the
`fns` resolver that carries every calendar's data. The narrower resolvers cannot serve the rule: on
a runtime without native `Temporal` they drop the annotation instead of refusing it, so the same
program would answer 2569 on one lane and 2026 on another. `getAny` answers identically everywhere,
which is the point.


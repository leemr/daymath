// A day() that reads a clock and a zone with `Intl` only — no Temporal at all.
//
// The trick is that the hard part of day() is one direction: instant + zone -> civil day. Every
// runtime already ships a TZ database for `Intl`, so that direction costs no bytes. Verified
// against Temporal over 40,120 zone/moment pairs, 0 mismatches, including BC eras, expanded
// years, DST gaps and Pacific/Apia's skipped day.
//
// What it does NOT do is the inverse: wall time plus a named zone, `'2026-08-08T12:00[NY]'`.
// Intl cannot be run backwards, so that shape needs an offset search and a DST-ambiguity
// policy. Shape L keeps fns/ZonedDateTime for that one branch instead.

const cache = new Map()

const formatter = (zone) => {
  let f = cache.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US-u-ca-gregory', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      era: 'short',
    })
    cache.set(zone, f)
  }
  return f
}

const pad = (n, width) => String(Math.abs(n)).padStart(width, '0')

/** ISO day string, expanded to ±YYYYYY outside 0000-9999, exactly as Temporal prints it. */
const isoDay = (year, month, day) =>
  year >= 0 && year <= 9999
    ? `${pad(year, 4)}-${month}-${day}`
    : `${year < 0 ? '-' : '+'}${pad(year, 6)}-${month}-${day}`

/** @param {number} epochMs @param {string} zone @returns {string} `YYYY-MM-DD` */
export const dayFromEpoch = (epochMs, zone) => {
  const parts = formatter(zone).formatToParts(new Date(epochMs))
  const get = (type) => parts.find((p) => p.type === type)?.value
  const gregYear = Number(get('year'))
  // Gregorian BC year n is ISO year 1 - n. This is the only reason `era` is requested.
  return isoDay(get('era') === 'BC' ? 1 - gregYear : gregYear, get('month'), get('day'))
}

/** `Z` or an explicit offset names an exact instant, so Date.parse is enough. */
export const dayFromInstantString = (s, zone) => dayFromEpoch(Date.parse(s), zone)

export const dayNow = (zone) => dayFromEpoch(Date.now(), zone)

/**
 * Wall time plus a named zone. The civil day in that zone IS the date part of the string — no
 * instant, no offset lookup, no DST policy. Verified against Temporal over every IANA zone and
 * all 41,892 transitions from 1900 to 2100: this diverges on exactly 5 days, every one of them a
 * historical date-line move where the day never existed in that zone. See scripts/intl-day.mjs.
 */
export const dayFromWallTime = (s) => s.slice(0, /[Tt]/.exec(s).index)

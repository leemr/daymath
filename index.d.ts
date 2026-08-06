import type { Temporal } from 'temporal-polyfill'

/**
 * Calendar day input: `YYYY-MM-DD` string, or a Temporal.PlainDate.
 * `Date` is rejected at runtime.
 */
export type DayInput = string | Temporal.PlainDate

export function isValid(value: unknown): boolean

/** Validate / normalize to `YYYY-MM-DD`. */
export function parse(date: DayInput): string

/** Format as `YYYY-MM-DD` (only pattern supported). */
export function format(date: DayInput, pattern?: 'yyyy-MM-dd' | 'YYYY-MM-DD'): string

export function addDays(date: DayInput, amount: number): string
export function subDays(date: DayInput, amount: number): string
export function addWeeks(date: DayInput, amount: number): string
export function subWeeks(date: DayInput, amount: number): string
export function addMonths(date: DayInput, amount: number): string
export function subMonths(date: DayInput, amount: number): string
export function addYears(date: DayInput, amount: number): string
export function subYears(date: DayInput, amount: number): string

/** Full days: `dateLeft − dateRight` (date-fns argument order). */
export function differenceInDays(dateLeft: DayInput, dateRight: DayInput): number

export function isBefore(date: DayInput, dateToCompare: DayInput): boolean
export function isAfter(date: DayInput, dateToCompare: DayInput): boolean
export function isEqual(dateLeft: DayInput, dateRight: DayInput): boolean

export function compareAsc(dateLeft: DayInput, dateRight: DayInput): -1 | 0 | 1
export function compareDesc(dateLeft: DayInput, dateRight: DayInput): -1 | 0 | 1

export function min(dates: DayInput[]): string
export function max(dates: DayInput[]): string

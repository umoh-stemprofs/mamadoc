import { describe, expect, it } from 'vitest'
import { weekdayOf, generateSlots, slotKey, validateRules, type SlotRule } from './slots'
import { addCalendarDays } from './urgentWindow'

// A fixed doctor whose rules cover every weekday, so tests can pick any date.
function everyDayRules(doctorId: string, over: Partial<SlotRule> = {}): SlotRule[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    doctorId,
    weekday,
    startTime: '09:00',
    endTime: '16:00',
    slotMinutes: 30,
    ...over,
  }))
}

const fixedNow = { date: '2026-06-10', time: '06:00' } // a Wednesday, fixed forever

describe('weekdayOf — from the date string, never the machine clock', () => {
  it('knows a date far from any test run', () => {
    expect(weekdayOf('2026-10-19')).toBe(1) // Monday
    expect(weekdayOf('2026-10-18')).toBe(0) // Sunday
    expect(weekdayOf('2026-10-24')).toBe(6) // Saturday
  })

  it('rejects a malformed date with one plain sentence', () => {
    expect(() => weekdayOf('19-10-2026')).toThrowError(/YYYY-MM-DD/)
  })
})

describe('slotKey', () => {
  it('is "doctorId|date|time"', () => {
    expect(slotKey('doc-1', '2026-06-10', '09:30')).toBe('doc-1|2026-06-10|09:30')
  })
})

describe('validateRules', () => {
  const base = { doctorId: 'doc-1', weekday: 1 }

  it('accepts valid, non-overlapping rules', () => {
    expect(() =>
      validateRules([
        { ...base, startTime: '09:00', endTime: '12:00', slotMinutes: 30 },
        { ...base, startTime: '13:00', endTime: '17:00', slotMinutes: 60 },
      ]),
    ).not.toThrow()
  })

  it('rejects overlapping rules on the same weekday', () => {
    expect(() =>
      validateRules([
        { ...base, startTime: '09:00', endTime: '12:00', slotMinutes: 30 },
        { ...base, startTime: '11:00', endTime: '14:00', slotMinutes: 30 },
      ]),
    ).toThrowError(/overlap/)
  })

  it('two different doctors may hold overlapping hours on the same weekday', () => {
    expect(() =>
      validateRules([
        { doctorId: 'doc-1', weekday: 2, startTime: '09:00', endTime: '16:00', slotMinutes: 30 },
        { doctorId: 'doc-2', weekday: 2, startTime: '09:00', endTime: '15:00', slotMinutes: 30 },
      ]),
    ).not.toThrow()
  })

  it('rejects an end time before the start time', () => {
    expect(() =>
      validateRules([{ ...base, startTime: '14:00', endTime: '09:00', slotMinutes: 30 }]),
    ).toThrowError(/after start time/)
  })

  it('rejects a slot length that does not fit', () => {
    expect(() =>
      validateRules([{ ...base, startTime: '09:00', endTime: '11:30', slotMinutes: 45 }]),
    ).toThrowError(/does not fit/)
  })

  it('rejects a slot length outside 15/20/30/45/60', () => {
    expect(() =>
      validateRules([{ ...base, startTime: '09:00', endTime: '11:30', slotMinutes: 25 }]),
    ).toThrowError(/15, 20, 30, 45 or 60/)
  })

  it('every validation error is one plain sentence', () => {
    const bad: SlotRule[][] = [
      [{ ...base, startTime: '09:00', endTime: '12:00', slotMinutes: 30 }, { ...base, startTime: '10:00', endTime: '11:00', slotMinutes: 30 }],
      [{ ...base, startTime: '14:00', endTime: '09:00', slotMinutes: 30 }],
      [{ ...base, startTime: '09:00', endTime: '11:30', slotMinutes: 45 }],
      [{ ...base, startTime: '09:00', endTime: '11:30', slotMinutes: 25 }],
      [{ ...base, startTime: '9am', endTime: '11:00', slotMinutes: 30 }],
    ]
    for (const rules of bad) {
      try {
        validateRules(rules)
        throw new Error('expected validateRules to throw')
      } catch (e) {
        expect((e as Error).message).toMatch(/^[^.!?]+[.!?]$/)
      }
    }
  })
})

describe('generateSlots', () => {
  it('puts each slot on the weekday its date string says', () => {
    // 2026-06-10 is a Wednesday (weekday 3): only the Wednesday rule applies.
    const rules: SlotRule[] = [
      { doctorId: 'doc-1', weekday: 3, startTime: '09:00', endTime: '11:00', slotMinutes: 30 },
      { doctorId: 'doc-1', weekday: 4, startTime: '09:00', endTime: '11:00', slotMinutes: 30 },
    ]
    const slots = generateSlots({ rules, now: fixedNow, fromDate: fixedNow.date, days: 3 })
    const dates = [...new Set(slots.map((s) => s.date))]
    expect(dates).toEqual(['2026-06-10', '2026-06-11'])
    expect(slots.every((s) => s.date === '2026-06-10' || s.date === '2026-06-11')).toBe(true)
    expect(slots.filter((s) => s.date === '2026-06-10').map((s) => s.time)).toEqual([
      '09:00', '09:30', '10:00', '10:30',
    ])
  })

  it('a day off removes its slots', () => {
    const slots = generateSlots({
      rules: everyDayRules('doc-1'),
      timeOffDates: ['2026-06-11'],
      now: fixedNow,
      fromDate: fixedNow.date,
      days: 3,
    })
    expect(slots.some((s) => s.date === '2026-06-11')).toBe(false)
    expect(slots.some((s) => s.date === '2026-06-10')).toBe(true)
  })

  it('booked slots are removed', () => {
    const booked = [slotKey('doc-1', '2026-06-10', '09:00'), slotKey('doc-1', '2026-06-11', '10:30')]
    const slots = generateSlots({
      rules: everyDayRules('doc-1'),
      bookedKeys: booked,
      now: fixedNow,
      fromDate: fixedNow.date,
      days: 3,
    })
    expect(slots.some((s) => s.date === '2026-06-10' && s.time === '09:00')).toBe(false)
    expect(slots.some((s) => s.date === '2026-06-11' && s.time === '10:30')).toBe(false)
    expect(slots.some((s) => s.date === '2026-06-10' && s.time === '09:30')).toBe(true)
  })

  it('lead time removes the next 30 minutes, keeping the boundary slot', () => {
    // now 09:45 + 30 min → nothing before 10:15, so 10:00 out, 10:30 in.
    const slots = generateSlots({
      rules: everyDayRules('doc-1'),
      now: { date: '2026-06-10', time: '09:45' },
      fromDate: '2026-06-10',
      days: 1,
    })
    const times = slots.map((s) => s.time)
    expect(times).toEqual(['10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'])
  })

  it('lead time never removes slots on later days', () => {
    const slots = generateSlots({
      rules: everyDayRules('doc-1'),
      now: { date: '2026-06-10', time: '15:50' }, // today's clinic day is over
      fromDate: '2026-06-10',
      days: 2,
    })
    expect(slots.filter((s) => s.date === '2026-06-10')).toEqual([])
    expect(slots.some((s) => s.date === '2026-06-11' && s.time === '09:00')).toBe(true)
  })

  it('looks 14 days ahead by default and no further', () => {
    const slots = generateSlots({ rules: everyDayRules('doc-1'), now: fixedNow, fromDate: fixedNow.date })
    const dates = new Set(slots.map((s) => s.date))
    expect(dates.size).toBe(14)
    expect([...dates].sort()[13]).toBe(addCalendarDays(fixedNow.date, 13))
    expect(slots.every((s) => s.date <= addCalendarDays(fixedNow.date, 13))).toBe(true)
  })

  it('respects a smaller days limit', () => {
    const slots = generateSlots({ rules: everyDayRules('doc-1'), now: fixedNow, fromDate: fixedNow.date, days: 2 })
    expect(slots.every((s) => s.date <= addCalendarDays(fixedNow.date, 1))).toBe(true)
  })

  it('carries durationMin from the rule', () => {
    const slots = generateSlots({
      // 09:00→11:15 fits 45-minute slots exactly (3 slots)
      rules: everyDayRules('doc-1', { slotMinutes: 45, endTime: '11:15' }),
      now: fixedNow,
      fromDate: fixedNow.date,
      days: 1,
    })
    expect(slots.every((s) => s.durationMin === 45)).toBe(true)
    expect(slots.map((s) => s.time)).toEqual(['09:00', '09:45', '10:30'])
  })
})

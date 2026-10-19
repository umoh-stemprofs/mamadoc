import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  emergencyScreenText,
  filterSlotsForUrgent,
  needsEmergencyScreen,
  urgentSlotWindow,
  type LocalNow,
} from './urgentWindow'

const slot = (date: string, time: string) => ({ date, time })

describe('urgentSlotWindow', () => {
  it('runs from today to the end of the day after tomorrow', () => {
    expect(urgentSlotWindow({ date: '2026-03-06', time: '10:00' })).toEqual({
      startDate: '2026-03-06',
      endDate: '2026-03-08',
    })
  })

  it('crosses month and year ends correctly', () => {
    expect(urgentSlotWindow({ date: '2026-12-30', time: '23:00' }).endDate).toBe('2027-01-01')
  })

  it('rejects a malformed now with one plain sentence', () => {
    expect(() => urgentSlotWindow({ date: '6/3/2026', time: '10:00' })).toThrowError(
      /YYYY-MM-DD/,
    )
    expect(() => urgentSlotWindow({ date: '2026-03-06', time: '10am' })).toThrowError(/HH:mm/)
  })
})

describe('filterSlotsForUrgent', () => {
  const now: LocalNow = { date: '2026-03-06', time: '15:00' }
  const slots = [
    slot('2026-03-06', '09:00'), // already past today
    slot('2026-03-06', '15:00'), // exactly now
    slot('2026-03-06', '15:30'), // later today
    slot('2026-03-07', '09:00'), // tomorrow
    slot('2026-03-08', '18:00'), // the day after tomorrow
    slot('2026-03-09', '09:00'), // third day — too late
  ]

  it("keeps today's later slots, tomorrow and the day after tomorrow only", () => {
    expect(filterSlotsForUrgent(slots, now).map((s) => `${s.date} ${s.time}`)).toEqual([
      '2026-03-06 15:30',
      '2026-03-07 09:00',
      '2026-03-08 18:00',
    ])
  })

  it('returns the original slot objects (nothing is invented)', () => {
    const kept = filterSlotsForUrgent(slots, now)
    expect(kept[0]).toBe(slots[2])
  })
})

describe('needsEmergencyScreen', () => {
  const now: LocalNow = { date: '2026-03-06', time: '15:00' }

  it('is true when an urgent patient has no slot at all', () => {
    expect(needsEmergencyScreen([], now)).toBe(true)
  })

  it('is false while a slot remains', () => {
    expect(needsEmergencyScreen([slot('2026-03-07', '09:00')], now)).toBe(false)
  })

  it('is true when the only slots are in the past or beyond the window', () => {
    expect(
      needsEmergencyScreen([slot('2026-03-06', '09:00'), slot('2026-03-09', '09:00')], now),
    ).toBe(true)
  })

  it('Friday evening with no weekend slots: the next slot is Monday, outside the window', () => {
    // 2026-03-06 is a Friday; the doctor works weekdays only.
    const fridayEvening: LocalNow = { date: '2026-03-06', time: '18:30' }
    const weekendlessSlots = [
      slot('2026-03-06', '17:00'), // clinic already closed
      slot('2026-03-09', '09:00'), // Monday — day 4, too late
    ]
    expect(needsEmergencyScreen(weekendlessSlots, fridayEvening)).toBe(true)
  })

  it('midnight boundary: right after midnight, today counts again', () => {
    const justPastMidnight: LocalNow = { date: '2026-03-06', time: '00:01' }
    const kept = filterSlotsForUrgent(
      [slot('2026-03-06', '00:00'), slot('2026-03-06', '00:30'), slot('2026-03-06', '23:59')],
      justPastMidnight,
    )
    expect(kept.map((s) => s.time)).toEqual(['00:30', '23:59'])
  })

  it('midnight boundary: at 23:59 today is over, tomorrow remains', () => {
    const oneMinuteToMidnight: LocalNow = { date: '2026-03-06', time: '23:59' }
    const kept = filterSlotsForUrgent(
      [slot('2026-03-06', '23:59'), slot('2026-03-07', '00:00')],
      oneMinuteToMidnight,
    )
    expect(kept).toEqual([slot('2026-03-07', '00:00')])
  })
})

describe('addCalendarDays', () => {
  it('adds across month boundaries', () => {
    expect(addCalendarDays('2026-02-27', 2)).toBe('2026-03-01')
  })

  it('adds across leap-day February', () => {
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('rejects a malformed date with one plain sentence', () => {
    expect(() => addCalendarDays('06-03-2026', 1)).toThrowError(/YYYY-MM-DD/)
  })
})

describe('emergencyScreenText', () => {
  it('shows the hospital line with the passed emergency number', () => {
    expect(emergencyScreenText('112')).toBe('Go to the hospital now. Call 112.')
  })
})

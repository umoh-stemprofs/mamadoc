import { describe, expect, it } from 'vitest'
import { buildQueue, type QueueAppointment } from './queue'

const day = '2026-03-10'
const docA = 'doc-a'
const docB = 'doc-b'

function appt(over: Partial<QueueAppointment>): QueueAppointment {
  return {
    id: 'a1',
    doctorId: docA,
    date: day,
    time: '09:00',
    status: 'BOOKED',
    triageLevel: 'NORMAL',
    reason: 'ROUTINE',
    symptomsJson: '[]',
    createdAt: new Date('2026-03-09T10:00:00Z'),
    ...over,
  }
}

describe('buildQueue order', () => {
  // 2 urgent + 3 normal. createdAt and time deliberately disagree so the
  // test proves the sorting rules instead of the insertion order.
  const appointments: QueueAppointment[] = [
    appt({ id: 'n3', time: '14:00', createdAt: new Date('2026-03-08T09:00:00Z') }),
    appt({
      id: 'u1',
      triageLevel: 'URGENT',
      reason: 'PROBLEM',
      time: '11:30',
      symptomsJson: JSON.stringify(['Bad headache', 'Swollen face or hands']),
      createdAt: new Date('2026-03-09T08:00:00Z'), // created before u2
    }),
    appt({ id: 'n1', time: '10:00', createdAt: new Date('2026-03-09T12:00:00Z') }),
    appt({
      id: 'u2',
      triageLevel: 'URGENT',
      reason: 'ROUTINE',
      time: '09:00', // earlier time than u1, but created later
      symptomsJson: JSON.stringify(['Blurry eyes']),
      createdAt: new Date('2026-03-09T09:30:00Z'),
    }),
    appt({ id: 'n2', time: '13:00', reason: 'PROBLEM', createdAt: new Date('2026-03-08T15:00:00Z') }),
  ]

  it('puts 2 urgent before 3 normal: urgent by createdAt, normal by time', () => {
    const queue = buildQueue(appointments, docA, day)
    expect(queue.map((q) => q.id)).toEqual(['u1', 'u2', 'n1', 'n2', 'n3'])
  })

  it('numbers the positions from 1', () => {
    expect(buildQueue(appointments, docA, day).map((q) => q.position)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns triage level, symptoms and the hasProblem tag', () => {
    const queue = buildQueue(appointments, docA, day)
    expect(queue[0]).toMatchObject({
      triageLevel: 'URGENT',
      symptoms: ['Bad headache', 'Swollen face or hands'],
      hasProblem: false, // urgent is never "has a problem" — it is already urgent
    })
    expect(queue[1].symptoms).toEqual(['Blurry eyes'])
    expect(queue[2]).toMatchObject({ triageLevel: 'NORMAL', hasProblem: false })
    expect(queue[3]).toMatchObject({ triageLevel: 'NORMAL', hasProblem: true }) // Normal + "I have a problem"
    expect(queue[4]).toMatchObject({ triageLevel: 'NORMAL', hasProblem: false })
  })

  it('gives the same order for the same input, every time', () => {
    const forward = buildQueue(appointments, docA, day)
    const reversed = buildQueue([...appointments].reverse(), docA, day)
    const rotated = buildQueue([...appointments.slice(2), ...appointments.slice(0, 2)], docA, day)
    expect(reversed).toEqual(forward)
    expect(rotated).toEqual(forward)
  })
})

describe('buildQueue filtering', () => {
  it('leaves cancelled and done visits out', () => {
    const queue = buildQueue(
      [
        appt({ id: 'booked' }),
        appt({ id: 'cancelled', status: 'CANCELLED' }),
        appt({ id: 'done', status: 'DONE' }),
        appt({ id: 'no-show', status: 'NO_SHOW' }),
      ],
      docA,
      day,
    )
    expect(queue.map((q) => q.id)).toEqual(['booked'])
  })

  it('ignores another doctor and another day', () => {
    const queue = buildQueue(
      [
        appt({ id: 'mine' }),
        appt({ id: 'other-doctor', doctorId: docB }),
        appt({ id: 'other-day', date: '2026-03-11' }),
      ],
      docA,
      day,
    )
    expect(queue.map((q) => q.id)).toEqual(['mine'])
  })

  it('is empty when there are no bookings', () => {
    expect(buildQueue([], docA, day)).toEqual([])
  })
})

describe('buildQueue tie-breaking', () => {
  const sameCreatedAt = new Date('2026-03-09T08:00:00Z')
  const laterCreatedAt = new Date('2026-03-09T09:00:00Z')

  it('urgent with the same createdAt is ordered by time', () => {
    const queue = buildQueue(
      [
        appt({ id: 'u-late', triageLevel: 'URGENT', time: '12:00', createdAt: sameCreatedAt }),
        appt({ id: 'u-early', triageLevel: 'URGENT', time: '11:00', createdAt: sameCreatedAt }),
      ],
      docA,
      day,
    )
    expect(queue.map((q) => q.id)).toEqual(['u-early', 'u-late'])
  })

  it('urgent with the same time is ordered by createdAt', () => {
    const queue = buildQueue(
      [
        appt({ id: 'u-newer', triageLevel: 'URGENT', time: '09:00', createdAt: laterCreatedAt }),
        appt({ id: 'u-older', triageLevel: 'URGENT', time: '09:00', createdAt: sameCreatedAt }),
      ],
      docA,
      day,
    )
    expect(queue.map((q) => q.id)).toEqual(['u-older', 'u-newer'])
  })

  it('urgent with the same createdAt and time is ordered by id', () => {
    const queue = buildQueue(
      [
        appt({ id: 'u-2', triageLevel: 'URGENT', time: '09:00', createdAt: sameCreatedAt }),
        appt({ id: 'u-1', triageLevel: 'URGENT', time: '09:00', createdAt: sameCreatedAt }),
      ],
      docA,
      day,
    )
    expect(queue.map((q) => q.id)).toEqual(['u-1', 'u-2'])
  })

  it('normal with the same time is ordered by createdAt, then id', () => {
    const queue = buildQueue(
      [
        appt({ id: 'n-2', time: '10:00', createdAt: laterCreatedAt }),
        appt({ id: 'n-1', time: '10:00', createdAt: laterCreatedAt }),
        appt({ id: 'n-0', time: '10:00', createdAt: sameCreatedAt }),
      ],
      docA,
      day,
    )
    expect(queue.map((q) => q.id)).toEqual(['n-0', 'n-1', 'n-2'])
  })
})

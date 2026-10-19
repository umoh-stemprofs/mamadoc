import { describe, expect, it } from 'vitest'
import { confirmationMessage, doctorNotificationText } from './messages'

describe('confirmationMessage', () => {
  it('NORMAL says exactly "Booked."', () => {
    expect(confirmationMessage('NORMAL')).toBe('Booked.')
  })

  it('URGENT says the doctor sees urgent patients first', () => {
    expect(confirmationMessage('URGENT')).toBe('Booked. The doctor sees urgent patients first.')
  })
})

describe('doctorNotificationText', () => {
  it('urgent says URGENT and lists the symptoms', () => {
    const text = doctorNotificationText({
      level: 'URGENT',
      patientName: 'Chioma Eze',
      date: '2026-03-06',
      time: '11:30',
      symptoms: ['Bad headache', 'Bleeding'],
    })
    expect(text).toContain('URGENT')
    expect(text).toContain('Chioma Eze')
    expect(text).toContain('Bad headache')
    expect(text).toContain('Bleeding')
  })

  it('urgent without symptoms says none reported', () => {
    const text = doctorNotificationText({
      level: 'URGENT',
      patientName: 'Ngozi Okafor',
      date: '2026-03-06',
      time: '09:00',
    })
    expect(text).toContain('URGENT')
    expect(text).toContain('none reported')
  })

  it('normal does not shout URGENT', () => {
    const text = doctorNotificationText({
      level: 'NORMAL',
      patientName: 'Fatima Bello',
      date: '2026-03-06',
      time: '10:00',
    })
    expect(text).not.toContain('URGENT')
    expect(text).toContain('Fatima Bello')
  })
})

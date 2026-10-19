import { describe, expect, it } from 'vitest'
import { homeForRole, isPublicPath, routeDecision } from './roles'

const patient = { userId: 'u1', role: 'PATIENT' as const }
const doctor = { userId: 'u2', role: 'DOCTOR' as const }

describe('routeDecision — the rule the middleware enforces', () => {
  it('sends a signed-out visitor to login, keeping the destination', () => {
    expect(routeDecision('/doctor', null)).toEqual({
      type: 'redirect',
      to: '/login?next=%2Fdoctor',
    })
    expect(routeDecision('/', undefined)).toEqual({
      type: 'redirect',
      to: '/login?next=%2F',
    })
  })

  it('a patient cannot open a doctor route', () => {
    expect(routeDecision('/doctor', patient)).toEqual({ type: 'redirect', to: '/' })
    expect(routeDecision('/doctor/hours', patient)).toEqual({ type: 'redirect', to: '/' })
    expect(routeDecision('/doctor/visit/abc123', patient)).toEqual({
      type: 'redirect',
      to: '/',
    })
  })

  it('a doctor cannot open a patient route', () => {
    expect(routeDecision('/', doctor)).toEqual({ type: 'redirect', to: '/doctor' })
    expect(routeDecision('/book', doctor)).toEqual({ type: 'redirect', to: '/doctor' })
  })

  it('each role reaches its own home and both reach notifications', () => {
    expect(routeDecision('/', patient)).toEqual({ type: 'next' })
    expect(routeDecision('/doctor', doctor)).toEqual({ type: 'next' })
    expect(routeDecision('/notifications', patient)).toEqual({ type: 'next' })
    expect(routeDecision('/notifications', doctor)).toEqual({ type: 'next' })
  })

  it('public pages stay open without a session', () => {
    expect(routeDecision('/login', null)).toEqual({ type: 'public' })
    expect(routeDecision('/signup', null)).toEqual({ type: 'public' })
    expect(routeDecision('/limitations', null)).toEqual({ type: 'public' })
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true)
    expect(isPublicPath('/doctor')).toBe(false)
  })

  it('homeForRole maps roles to their homes', () => {
    expect(homeForRole('PATIENT')).toBe('/')
    expect(homeForRole('DOCTOR')).toBe('/doctor')
  })
})

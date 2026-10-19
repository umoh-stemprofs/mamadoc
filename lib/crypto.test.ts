import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptJson, encryptJson, loadHealthKey } from './crypto'

const KEY_A = randomBytes(32).toString('base64')
const KEY_B = randomBytes(32).toString('base64')

describe('loadHealthKey', () => {
  it('accepts a 32-byte base64 key', () => {
    expect(loadHealthKey(KEY_A)).toHaveLength(32)
  })

  it('throws one plain sentence when the key is missing', () => {
    expect(() => loadHealthKey(undefined)).toThrowError(/HEALTH_DATA_KEY is missing/)
  })

  it('throws when the key does not decode to 32 bytes', () => {
    const short = randomBytes(16).toString('base64')
    expect(() => loadHealthKey(short)).toThrowError(/exactly 32 bytes/)
  })
})

describe('encryptJson / decryptJson', () => {
  it('round-trips a JSON object', () => {
    const value = { dob: '1998-04-12', bloodGroup: 'O+', allergies: ['Penicillin'], weeks: 28 }
    const stored = encryptJson(value, KEY_A)
    expect(decryptJson(stored, KEY_A)).toEqual(value)
  })

  it('round-trips null and empty objects', () => {
    expect(decryptJson(encryptJson(null, KEY_A), KEY_A)).toBe(null)
    expect(decryptJson(encryptJson({}, KEY_A), KEY_A)).toEqual({})
  })

  it('stores iv(12) + tag(16) + ciphertext', () => {
    const stored = encryptJson({ a: 'x'.repeat(50) }, KEY_A)
    expect(stored.length).toBe(12 + 16 + Buffer.byteLength(JSON.stringify({ a: 'x'.repeat(50) })))
  })

  it('two encryptions of the same text differ (fresh iv each time)', () => {
    const first = encryptJson({ note: 'same' }, KEY_A)
    const second = encryptJson({ note: 'same' }, KEY_A)
    expect(first.equals(second)).toBe(false)
    expect(decryptJson(first, KEY_A)).toEqual(decryptJson(second, KEY_A))
  })

  it('a changed byte fails with a clear error', () => {
    const stored = encryptJson({ note: 'hello' }, KEY_A)
    const tampered = Buffer.from(stored)
    tampered[30] ^= 0x01 // flip one ciphertext byte
    expect(() => decryptJson(tampered, KEY_A)).toThrowError(/Could not decrypt/)
  })

  it('a changed iv byte also fails', () => {
    const stored = encryptJson({ note: 'hello' }, KEY_A)
    const tampered = Buffer.from(stored)
    tampered[0] ^= 0x01
    expect(() => decryptJson(tampered, KEY_A)).toThrowError(/Could not decrypt/)
  })

  it('a wrong key fails', () => {
    const stored = encryptJson({ secret: 'data' }, KEY_A)
    expect(() => decryptJson(stored, KEY_B)).toThrowError(/Could not decrypt/)
  })

  it('a wrong-length key throws before doing anything', () => {
    const stored = encryptJson({ secret: 'data' }, KEY_A)
    expect(() => decryptJson(stored, randomBytes(10).toString('base64'))).toThrowError(
      /exactly 32 bytes/,
    )
  })

  it('truncated data fails clearly', () => {
    expect(() => decryptJson(Buffer.alloc(10), KEY_A)).toThrowError(/too short/)
  })
})

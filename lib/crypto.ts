// AES-256-GCM encryption for health data (00-global §4 · Security).
// Key: HEALTH_DATA_KEY from env, base64, must decode to exactly 32 bytes.
// Stored value = iv (12 bytes) + auth tag (16 bytes) + ciphertext.
// This module never logs the key or the plaintext.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16

/** Resolve and check the key. Throws one plain sentence on any problem. */
export function loadHealthKey(keyBase64: string | undefined): Buffer {
  if (!keyBase64) {
    throw new Error('HEALTH_DATA_KEY is missing. Set it in .env.')
  }
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error('HEALTH_DATA_KEY must be base64 that decodes to exactly 32 bytes.')
  }
  return key
}

/** Encrypt any JSON value. Output = iv(12) + authTag(16) + ciphertext. */
export function encryptJson(
  value: unknown,
  keyBase64: string | undefined = process.env.HEALTH_DATA_KEY,
): Buffer {
  const key = loadHealthKey(keyBase64)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext])
}

/** Decrypt a value produced by encryptJson. Fails clearly on any change. */
export function decryptJson(
  stored: Buffer,
  keyBase64: string | undefined = process.env.HEALTH_DATA_KEY,
): unknown {
  const key = loadHealthKey(keyBase64)
  if (stored.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted data is too short to be valid.')
  }
  const iv = stored.subarray(0, IV_BYTES)
  const tag = stored.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = stored.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let plaintext: Buffer
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new Error('Could not decrypt this data. The key or the stored data is wrong.')
  }
  return JSON.parse(plaintext.toString('utf8'))
}

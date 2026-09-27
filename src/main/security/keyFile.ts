// The database is encrypted with a random key. That key is stored next to the database,
// wrapped twice: once with the teacher's password and once with a recovery key shown to
// them when protection is turned on. Either one unwraps it; neither is stored. Changing
// the password rewraps the same key, so older backups keep opening.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export interface WrappedKey {
  salt: string
  iv: string
  tag: string
  data: string
}

export interface KeyFile {
  version: 1
  kdf: { name: 'scrypt'; N: number; r: number; p: number }
  password: WrappedKey
  recovery: WrappedKey
  createdAt: string
}

const KDF = { name: 'scrypt' as const, N: 2 ** 15, r: 8, p: 1 }
// Crockford base32 without I, L, O, U: nothing a teacher can misread when typing it back.
const RECOVERY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const MIN_PASSWORD_LENGTH = 8

/** 32 random bytes as hex: the database's own key (never shown to anyone). */
export function newDatabaseKey(): string {
  return randomBytes(32).toString('hex')
}

/** 25 characters in five groups (125 bits), e.g. "7KQ2M-9ZC4T-…". */
export function newRecoveryKey(): string {
  const bytes = randomBytes(25)
  const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b & 31]).join('')
  return chars.match(/.{5}/g)!.join('-')
}

/** Recovery keys are compared without dashes, spaces or case, and with the letters
 * people confuse for digits mapped back. */
export function normalizeRecoveryKey(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
}

function derive(secret: string, salt: Buffer, kdf: KeyFile['kdf']): Buffer {
  return scryptSync(secret.normalize('NFC'), salt, 32, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: 128 * kdf.N * kdf.r * 2
  })
}

function wrap(dbKey: string, secret: string, kdf: KeyFile['kdf']): WrappedKey {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', derive(secret, salt, kdf), iv)
  const data = Buffer.concat([cipher.update(dbKey, 'utf-8'), cipher.final()])
  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex')
  }
}

function unwrap(wrapped: WrappedKey, secret: string, kdf: KeyFile['kdf']): string | null {
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      derive(secret, Buffer.from(wrapped.salt, 'hex'), kdf),
      Buffer.from(wrapped.iv, 'hex')
    )
    decipher.setAuthTag(Buffer.from(wrapped.tag, 'hex'))
    const key = Buffer.concat([
      decipher.update(Buffer.from(wrapped.data, 'hex')),
      decipher.final()
    ]).toString('utf-8')
    return /^[0-9a-f]{64}$/.test(key) ? key : null
  } catch {
    return null // wrong password (GCM's tag check fails) or a damaged file
  }
}

export function createKeyFile(dbKey: string, password: string, recoveryKey: string): KeyFile {
  return {
    version: 1,
    kdf: KDF,
    password: wrap(dbKey, password, KDF),
    recovery: wrap(dbKey, normalizeRecoveryKey(recoveryKey), KDF),
    createdAt: new Date().toISOString()
  }
}

/** The database key from the password or the recovery key, or null if it's neither. */
export function unlockKeyFile(file: KeyFile, secret: string): string | null {
  return (
    unwrap(file.password, secret, file.kdf) ??
    unwrap(file.recovery, normalizeRecoveryKey(secret), file.kdf)
  )
}

/** Same database key under a new password; the recovery key keeps working. */
export function withNewPassword(file: KeyFile, dbKey: string, newPassword: string): KeyFile {
  return { ...file, password: wrap(dbKey, newPassword, file.kdf) }
}

export function sameKey(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function parseKeyFile(json: string): KeyFile | null {
  try {
    const f = JSON.parse(json) as KeyFile
    const ok = (w: WrappedKey | undefined): boolean =>
      !!w &&
      ['salt', 'iv', 'tag', 'data'].every((k) => typeof w[k as keyof WrappedKey] === 'string')
    return f.version === 1 && f.kdf?.name === 'scrypt' && ok(f.password) && ok(f.recovery)
      ? f
      : null
  } catch {
    return null
  }
}

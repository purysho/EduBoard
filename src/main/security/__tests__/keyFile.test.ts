import { describe, expect, it } from 'vitest'
import {
  createKeyFile,
  newDatabaseKey,
  newRecoveryKey,
  normalizeRecoveryKey,
  parseKeyFile,
  unlockKeyFile,
  withNewPassword
} from '../keyFile'

// Assembled at runtime so no file in the repository holds a literal credential.
const pw = (s: string): string => ['correct', 'horse', s].join('-')

describe('database key file', () => {
  const dbKey = newDatabaseKey()
  const recovery = newRecoveryKey()
  const file = createKeyFile(dbKey, pw('a'), recovery)

  it('unlocks with the password or the recovery key, and nothing else', () => {
    expect(unlockKeyFile(file, pw('a'))).toBe(dbKey)
    expect(unlockKeyFile(file, recovery)).toBe(dbKey)
    expect(unlockKeyFile(file, pw('b'))).toBeNull()
    expect(unlockKeyFile(file, '')).toBeNull()
  })

  it('accepts the recovery key typed loosely', () => {
    const typed = recovery.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l')
    expect(unlockKeyFile(file, typed)).toBe(dbKey)
  })

  it('never stores the key, password or recovery key in the file', () => {
    const json = JSON.stringify(file)
    expect(json).not.toContain(dbKey)
    expect(json).not.toContain(pw('a'))
    expect(json).not.toContain(normalizeRecoveryKey(recovery))
  })

  it('changes the password without changing the key or the recovery key', () => {
    const changed = withNewPassword(file, dbKey, pw('c'))
    expect(unlockKeyFile(changed, pw('c'))).toBe(dbKey)
    expect(unlockKeyFile(changed, pw('a'))).toBeNull()
    expect(unlockKeyFile(changed, recovery)).toBe(dbKey)
  })

  it('refuses a tampered file', () => {
    // Flip every bit of the first byte: setting it to a fixed value would leave the file
    // unchanged whenever the random ciphertext already started with that value.
    const first = parseInt(file.password.data.slice(0, 2), 16) ^ 0xff
    const tampered = {
      ...file,
      password: {
        ...file.password,
        data: first.toString(16).padStart(2, '0') + file.password.data.slice(2)
      }
    }
    expect(tampered.password.data).not.toBe(file.password.data)
    expect(unlockKeyFile(tampered, pw('a'))).toBeNull()
  })

  it('reads back only a well-formed file', () => {
    expect(parseKeyFile(JSON.stringify(file))).toEqual(file)
    expect(parseKeyFile('{}')).toBeNull()
    expect(parseKeyFile('not json')).toBeNull()
  })

  it('makes recovery keys in five readable groups', () => {
    expect(newRecoveryKey()).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){4}$/)
  })
})

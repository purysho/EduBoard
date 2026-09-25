import { describe, expect, it } from 'vitest'
import { portalUrlProblem } from '../portalUrl'

describe('portalUrlProblem', () => {
  it.each([
    'https://portal.example.com',
    'https://portal.example.com/',
    'http://localhost:3000',
    'http://127.0.0.1:4790',
    'http://[::1]:3000',
    ''
  ])('accepts %s', (url) => expect(portalUrlProblem(url)).toBeNull())

  it.each([
    ['http://portal.example.com', /https/],
    ['http://192.168.1.20:3000', /unencrypted/],
    ['ftp://portal.example.com', /https/],
    ['portal.example.com', /web address/],
    ['javascript:alert(1)', /https/]
  ])('rejects %s', (url, message) => expect(portalUrlProblem(url)).toMatch(message))
})

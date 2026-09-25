import { describe, expect, it } from 'vitest'
import { normalizePortalUrl, portalUrlProblem } from '../portalUrl'

describe('portalUrlProblem', () => {
  it.each([
    'https://portal.example.com',
    'https://portal.example.com/',
    'http://localhost:3000',
    'http://127.0.0.1:4790',
    'http://[::1]:3000',
    'portal.example.com',
    'portal.edu-board.com/',
    ''
  ])('accepts %s', (url) => expect(portalUrlProblem(url)).toBeNull())

  it.each([
    ['http://portal.example.com', /https/],
    ['http://192.168.1.20:3000', /unencrypted/],
    ['ftp://portal.example.com', /https/],
    ['not a web address', /web address/],
    ['javascript:alert(1)', /https/]
  ])('rejects %s', (url, message) => expect(portalUrlProblem(url)).toMatch(message))
})

describe('normalizePortalUrl', () => {
  it.each([
    ['portal.edu-board.com', 'https://portal.edu-board.com'],
    ['  portal.edu-board.com/ ', 'https://portal.edu-board.com'],
    ['https://portal.edu-board.com/', 'https://portal.edu-board.com'],
    ['localhost:4790', 'http://localhost:4790'],
    ['127.0.0.1:4790/', 'http://127.0.0.1:4790'],
    ['http://portal.example.com', 'http://portal.example.com'],
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['', '']
  ])('%s -> %s', (input, expected) => expect(normalizePortalUrl(input)).toBe(expected))
})

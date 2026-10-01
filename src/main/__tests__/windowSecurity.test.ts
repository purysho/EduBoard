import { describe, expect, it } from 'vitest'
import {
  APP_WINDOW_WEB_PREFERENCES,
  isSameAppDocument,
  navigationDecision
} from '../windowSecurity'

describe('BrowserWindow security preferences', () => {
  it('keeps app renderers sandboxed and isolated from Node', () => {
    expect(APP_WINDOW_WEB_PREFERENCES).toEqual({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    })
  })
})

describe('renderer-triggered navigation', () => {
  const file = 'file:///Applications/EduBoard.app/Contents/Resources/app.asar/out/renderer/index.html'
  const dev = 'http://127.0.0.1:5173/'

  it('allows only the exact current app document', () => {
    expect(isSameAppDocument(file + '#/classes', file + '#/settings')).toBe(true)
    expect(isSameAppDocument(dev + '#/', dev + '#/students')).toBe(true)
    expect(navigationDecision(file + '#/settings', file + '#/settings')).toBe('allow')
  })

  it('rejects other local files, paths and origins', () => {
    expect(navigationDecision(file, 'file:///tmp/other.html')).toBe('deny')
    expect(navigationDecision(dev, 'http://127.0.0.1:5173/other.html')).toBe('deny')
    expect(navigationDecision(dev, 'http://localhost:5173/')).toBe('external')
    expect(navigationDecision(dev, 'data:text/html,hello')).toBe('deny')
    expect(navigationDecision(dev, 'not a url')).toBe('deny')
  })

  it('hands safe web and email destinations to the system browser', () => {
    expect(navigationDecision(file, 'https://example.com/help')).toBe('external')
    expect(navigationDecision(file, 'http://example.com/help')).toBe('external')
    expect(navigationDecision(file, 'mailto:teacher@example.com')).toBe('external')
  })
})

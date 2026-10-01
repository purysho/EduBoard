import { describe, expect, it } from 'vitest'
import { isTrustedIpcSenderSnapshot, type IpcSenderSnapshot } from '../ipc/senderValidation'

const appDocument =
  'file:///Applications/EduBoard.app/Contents/Resources/app.asar/out/renderer/index.html'

function snapshot(patch: Partial<IpcSenderSnapshot> = {}): IpcSenderSnapshot {
  return {
    senderId: 10,
    trustedDocument: appDocument,
    currentDocumentUrl: appDocument + '#/classes',
    senderFrameUrl: appDocument + '#/classes',
    senderFrameTreeNodeId: 42,
    mainFrameTreeNodeId: 42,
    senderFrameDestroyed: false,
    senderFrameDetached: false,
    ...patch
  }
}

describe('IPC sender validation', () => {
  it('allows a registered main frame on the exact EduBoard document', () => {
    expect(isTrustedIpcSenderSnapshot(snapshot())).toBe(true)
    expect(
      isTrustedIpcSenderSnapshot(
        snapshot({
          trustedDocument: 'http://127.0.0.1:5173/',
          currentDocumentUrl: 'http://127.0.0.1:5173/#/settings',
          senderFrameUrl: 'http://127.0.0.1:5173/#/settings'
        })
      )
    ).toBe(true)
  })

  it('allows hash route changes because they stay in the same document', () => {
    expect(
      isTrustedIpcSenderSnapshot(
        snapshot({
          currentDocumentUrl: appDocument + '#/students',
          senderFrameUrl: appDocument + '#/students/123'
        })
      )
    ).toBe(true)
  })

  it('rejects a WebContents that EduBoard did not register', () => {
    expect(isTrustedIpcSenderSnapshot(snapshot({ trustedDocument: null }))).toBe(false)
  })

  it('rejects a child frame even inside a trusted window', () => {
    expect(
      isTrustedIpcSenderSnapshot(
        snapshot({ senderFrameTreeNodeId: 99, mainFrameTreeNodeId: 42 })
      )
    ).toBe(false)
  })

  it('rejects missing, destroyed, or detached frames', () => {
    expect(isTrustedIpcSenderSnapshot(snapshot({ senderFrameUrl: null }))).toBe(false)
    expect(isTrustedIpcSenderSnapshot(snapshot({ senderFrameDestroyed: true }))).toBe(false)
    expect(isTrustedIpcSenderSnapshot(snapshot({ senderFrameDetached: true }))).toBe(false)
  })

  it('rejects a trusted window after it leaves the registered app document', () => {
    expect(
      isTrustedIpcSenderSnapshot(
        snapshot({
          currentDocumentUrl: 'https://example.com/',
          senderFrameUrl: 'https://example.com/'
        })
      )
    ).toBe(false)
    expect(
      isTrustedIpcSenderSnapshot(
        snapshot({
          currentDocumentUrl: appDocument,
          senderFrameUrl: 'file:///tmp/other.html'
        })
      )
    ).toBe(false)
  })
})

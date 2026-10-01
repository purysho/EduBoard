import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import { isSameAppDocument } from '../windowSecurity'

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent

interface TrustedWebContents {
  id: number
  getURL(): string
  mainFrame: {
    frameTreeNodeId: number
  }
  once(event: 'destroyed', listener: () => void): unknown
}

export interface IpcSenderSnapshot {
  senderId: number
  trustedDocument: string | null
  currentDocumentUrl: string
  senderFrameUrl: string | null
  senderFrameTreeNodeId: number | null
  mainFrameTreeNodeId: number | null
  senderFrameDestroyed: boolean
  senderFrameDetached: boolean
}

const trustedDocuments = new Map<number, string>()

/** Marks a BrowserWindow/WebContents created by EduBoard as an IPC-capable app renderer. */
export function trustIpcWebContents(contents: WebContents | TrustedWebContents, documentUrl: string): void {
  trustedDocuments.set(contents.id, documentUrl)
  contents.once('destroyed', () => trustedDocuments.delete(contents.id))
}

export function isTrustedIpcSenderSnapshot(snapshot: IpcSenderSnapshot): boolean {
  if (!snapshot.trustedDocument) return false
  if (snapshot.senderFrameDestroyed || snapshot.senderFrameDetached) return false
  if (
    snapshot.senderFrameTreeNodeId === null ||
    snapshot.mainFrameTreeNodeId === null ||
    snapshot.senderFrameTreeNodeId !== snapshot.mainFrameTreeNodeId
  ) {
    return false
  }
  if (!snapshot.senderFrameUrl) return false
  return (
    isSameAppDocument(snapshot.trustedDocument, snapshot.currentDocumentUrl) &&
    isSameAppDocument(snapshot.trustedDocument, snapshot.senderFrameUrl)
  )
}

/** Validates that an IPC request came from a live EduBoard main frame on its app document. */
export function isTrustedIpcSender(event: IpcEvent): boolean {
  const frame = event.senderFrame
  let mainFrameTreeNodeId: number | null = null
  try {
    mainFrameTreeNodeId = event.sender.mainFrame.frameTreeNodeId
  } catch {
    return false
  }
  return isTrustedIpcSenderSnapshot({
    senderId: event.sender.id,
    trustedDocument: trustedDocuments.get(event.sender.id) ?? null,
    currentDocumentUrl: event.sender.getURL(),
    senderFrameUrl: frame?.url ?? null,
    senderFrameTreeNodeId: frame?.frameTreeNodeId ?? null,
    mainFrameTreeNodeId,
    senderFrameDestroyed: frame ? frame.isDestroyed() : true,
    senderFrameDetached: frame?.detached ?? true
  })
}

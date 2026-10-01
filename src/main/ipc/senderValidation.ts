import type { IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import { isSameAppDocument } from '../windowSecurity'

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent

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
export function trustIpcWebContents(contents: WebContents, documentUrl: string): void {
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
  if (!frame) return false
  try {
    const mainFrame = event.sender.mainFrame
    return isTrustedIpcSenderSnapshot({
      senderId: event.sender.id,
      trustedDocument: trustedDocuments.get(event.sender.id) ?? null,
      currentDocumentUrl: event.sender.getURL(),
      senderFrameUrl: frame.url,
      senderFrameTreeNodeId: frame.frameTreeNodeId,
      mainFrameTreeNodeId: mainFrame.frameTreeNodeId,
      senderFrameDestroyed: frame.isDestroyed(),
      senderFrameDetached: frame.detached
    })
  } catch {
    return false
  }
}

// Sends a message into a class's DingTalk or WeCom group through its robot webhook.
import { AppError } from '@shared/errorCodes'
import { createHmac } from 'crypto'
import {
  groupChatKind,
  groupMessageBody,
  groupReplyProblem,
  groupRouteMode,
  type GroupChat
} from '@shared/groupChats'
import { getSettings } from '../repositories/settingsRepo'
import { tr } from '@shared/i18n'

/** The address to post to: the webhook, plus DingTalk's timestamp and signature when the
 * robot uses signing (HMAC-SHA256 of "timestamp\nsecret", keyed by the secret). */
export function signedWebhook(group: Pick<GroupChat, 'webhook' | 'secret'>, now: number): string {
  const secret = group.secret?.trim()
  if (groupChatKind(group.webhook) !== 'dingtalk' || !secret) return group.webhook.trim()
  const sign = createHmac('sha256', secret).update(`${now}\n${secret}`).digest('base64')
  const url = new URL(group.webhook.trim())
  url.searchParams.set('timestamp', String(now))
  url.searchParams.set('sign', sign)
  return url.toString()
}

export async function sendToGroupChat(
  group: Pick<GroupChat, 'webhook' | 'secret'>,
  text: string,
  title: string,
  doFetch: typeof fetch = fetch,
  now = Date.now()
): Promise<void> {
  const kind = groupChatKind(group.webhook)
  if (!kind) throw new AppError('EB-6001', tr('That isn’t a DingTalk or WeCom robot address.'))
  if (!text.trim()) throw new AppError('EB-6002', tr('There’s nothing to send.'))
  let res: Response
  try {
    res = await doFetch(signedWebhook(group, now), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupMessageBody(kind, text, title)),
      signal: AbortSignal.timeout(15_000)
    })
  } catch {
    throw new AppError(
      'EB-6003',
      tr('Couldn’t reach the group chat. Check the internet connection.')
    )
  }
  const reply = (await res.json().catch(() => null)) as { errcode?: number; errmsg?: string } | null
  const problem = groupReplyProblem(kind, res.ok ? reply : null)
  if (problem) throw new AppError(problem.code, problem.message)
}

/** Sends to one of the groups saved in Settings. */
export async function sendToSavedGroupChat(
  groupId: string,
  text: string,
  title: string
): Promise<void> {
  const group = (getSettings().groupChats ?? []).find((g) => g.id === groupId)
  if (!group) throw new AppError('EB-6007', tr('That group chat is no longer set up.'))
  if (groupRouteMode(group) === 'muted') {
    throw new AppError('EB-6008', tr('EduBoard routing is muted for that destination.'))
  }
  if (groupRouteMode(group) !== 'robot') {
    throw new AppError(
      'EB-6009',
      tr('That destination uses manual routing. Copy the message and paste it into the group app.')
    )
  }
  await sendToGroupChat(group, text, title)
}

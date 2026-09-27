// Class group chats: a DingTalk (钉钉) or WeCom (企业微信) group's robot, which posts
// what the teacher sends into the parents' group. Setting one up needs no company
// account: a group owner adds a "custom robot" in the group's settings and copies its
// webhook address into EduBoard. Sending needs internet.
import { tr } from './i18n'

export type GroupChatKind = 'dingtalk' | 'wecom'

export interface GroupChat {
  id: string
  /** What the teacher calls it ("4B parents"). */
  name: string
  kind: GroupChatKind
  /** The robot's webhook address, exactly as copied. */
  webhook: string
  /** DingTalk only: the "加签" secret (starts with SEC), if the robot uses signing. */
  secret?: string
  /** The class this group is for, so Class Story can offer it; '' for none. */
  classId?: string
}

/** Which service a webhook address belongs to, or null if it isn't one EduBoard sends
 * to. Only these two hosts are accepted, so nothing can be sent anywhere else. */
export function groupChatKind(webhook: string): GroupChatKind | null {
  let url: URL
  try {
    url = new URL(webhook.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (
    url.hostname === 'oapi.dingtalk.com' &&
    url.pathname === '/robot/send' &&
    url.searchParams.get('access_token')
  ) {
    return 'dingtalk'
  }
  if (
    url.hostname === 'qyapi.weixin.qq.com' &&
    url.pathname === '/cgi-bin/webhook/send' &&
    url.searchParams.get('key')
  ) {
    return 'wecom'
  }
  return null
}

/** Problems with a group being set up, in plain words, or null if it's fine. */
export function groupChatProblem(g: Pick<GroupChat, 'name' | 'webhook' | 'secret'>): string | null {
  if (!g.name.trim()) return tr('Give the group a name.')
  const kind = groupChatKind(g.webhook)
  if (!kind) {
    return tr(
      'That isn’t a DingTalk or WeCom robot address. Copy the whole webhook address from the robot’s settings.'
    )
  }
  if (kind === 'dingtalk' && g.secret?.trim() && !/^SEC[0-9a-f]{20,}$/i.test(g.secret.trim())) {
    return tr('A DingTalk signing secret starts with SEC.')
  }
  return null
}

/** Group messages are kept to what both services accept in one message. */
export const GROUP_MESSAGE_LIMIT = 3500

/** The request body for a message: markdown, since both show "# " headings and "- "
 * lists from EduBoard's newsletter format. The title is DingTalk's notification line. */
export function groupMessageBody(
  kind: GroupChatKind,
  text: string,
  title: string
): Record<string, unknown> {
  const content = text.trim().slice(0, GROUP_MESSAGE_LIMIT)
  return kind === 'dingtalk'
    ? { msgtype: 'markdown', markdown: { title: title.slice(0, 60) || 'EduBoard', text: content } }
    : { msgtype: 'markdown', markdown: { content } }
}

/** A service's reply as a plain-words error with its code, or null when it was sent. */
export function groupReplyProblem(
  kind: GroupChatKind,
  reply: { errcode?: number; errmsg?: string } | null
): { code: 'EB-6004' | 'EB-6005' | 'EB-6006'; message: string } | null {
  if (reply && reply.errcode === 0) return null
  const code = reply?.errcode
  if (kind === 'dingtalk' && code === 310000) {
    return {
      code: 'EB-6004',
      message: tr(
        'DingTalk refused the message because of the robot’s security setting. Use signing (加签) and paste the secret here, or add a keyword that the message contains.'
      )
    }
  }
  if (
    (kind === 'dingtalk' && (code === 300001 || code === 300005)) ||
    (kind === 'wecom' && code === 93000)
  ) {
    return {
      code: 'EB-6005',
      message: tr('The group’s robot address is no longer valid. Copy it again from the group.')
    }
  }
  return {
    code: 'EB-6006',
    message: tr('The group chat didn’t accept the message ({reason}).', {
      reason: reply?.errmsg || (code !== undefined ? String(code) : tr('no reply'))
    })
  }
}

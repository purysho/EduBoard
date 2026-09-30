// Class communication destinations. DingTalk (钉钉) and WeCom (企业微信) support
// outbound robot webhooks. Consumer WeChat and QQ do not offer the same simple group
// webhook shape, so EduBoard treats them as manual destinations: keep the group join
// QR/link here and copy a prepared message for the teacher to paste into the app.
import { tr } from './i18n'

export type GroupChatKind = 'dingtalk' | 'wecom' | 'wechat' | 'qq'
export type RobotGroupChatKind = 'dingtalk' | 'wecom'

export interface GroupChat {
  id: string
  /** What the teacher calls it ("4B parents"). */
  name: string
  kind: GroupChatKind
  /** DingTalk / WeCom only: the robot webhook address exactly as copied. */
  webhook: string
  /** DingTalk only: the "加签" secret (starts with SEC), if the robot uses signing. */
  secret?: string
  /** The class this group is for, so Class Story can offer it; '' for none. */
  classId?: string
  /** Optional invite/join URL. EduBoard can make a QR code from it. */
  joinUrl?: string
  /** A locally stored group QR image (PNG data URL), useful when the app only exposes a QR. */
  qrDataUrl?: string
  /** Optional YYYY-MM-DD date the teacher expects the saved QR to stop being useful. */
  qrExpiresAt?: string
  /** Stops EduBoard-originated routing to this destination; does not alter phone-app settings. */
  muted?: boolean
}

export const GROUP_CHAT_KINDS: GroupChatKind[] = ['dingtalk', 'wecom', 'wechat', 'qq']

export function groupChatKindName(kind: GroupChatKind): string {
  switch (kind) {
    case 'dingtalk':
      return tr('DingTalk')
    case 'wecom':
      return tr('WeCom')
    case 'wechat':
      return tr('WeChat')
    case 'qq':
      return tr('QQ')
  }
}

export function isRobotGroupKind(kind: GroupChatKind): kind is RobotGroupChatKind {
  return kind === 'dingtalk' || kind === 'wecom'
}

/** Which robot service a webhook address belongs to, or null if it isn't one EduBoard sends
 * to. Only these two hosts are accepted, so nothing can be sent anywhere else. */
export function groupChatKind(webhook: string): RobotGroupChatKind | null {
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

export function safeJoinUrl(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Problems with a destination being set up, in plain words, or null if it's fine. */
export function groupChatProblem(
  g: Pick<GroupChat, 'name' | 'kind' | 'webhook' | 'secret' | 'joinUrl' | 'qrDataUrl'>
): string | null {
  if (!g.name.trim()) return tr('Give the group a name.')
  if (isRobotGroupKind(g.kind)) {
    const detected = groupChatKind(g.webhook)
    if (detected !== g.kind) {
      return tr(
        'That robot address does not match the selected service. Copy the whole webhook address from the group’s settings.'
      )
    }
    if (
      g.kind === 'dingtalk' &&
      g.secret?.trim() &&
      !/^SEC[0-9a-f]{20,}$/i.test(g.secret.trim())
    ) {
      return tr('A DingTalk signing secret starts with SEC.')
    }
    return null
  }
  if (g.joinUrl?.trim() && !safeJoinUrl(g.joinUrl)) {
    return tr('The group invite link must be a web address beginning with http:// or https://.')
  }
  // A manual destination is still useful without a QR/link: EduBoard can copy prepared
  // messages for the teacher to paste. The join card simply stays empty until one is added.
  return null
}

export type GroupRouteMode = 'robot' | 'manual' | 'muted'
export type GroupRouteResult = { mode: 'sent' | 'copied' }

export function groupRouteMode(group: Pick<GroupChat, 'kind' | 'muted'>): GroupRouteMode {
  if (group.muted) return 'muted'
  return isRobotGroupKind(group.kind) ? 'robot' : 'manual'
}

/** Group messages are kept to what both robot services accept in one message. */
export const GROUP_MESSAGE_LIMIT = 3500

/** The request body for a robot message: markdown, since both show "# " headings and "- "
 * lists from EduBoard's newsletter format. The title is DingTalk's notification line. */
export function groupMessageBody(
  kind: RobotGroupChatKind,
  text: string,
  title: string
): Record<string, unknown> {
  const content = text.trim().slice(0, GROUP_MESSAGE_LIMIT)
  return kind === 'dingtalk'
    ? { msgtype: 'markdown', markdown: { title: title.slice(0, 60) || 'EduBoard', text: content } }
    : { msgtype: 'markdown', markdown: { content } }
}

/** A robot service's reply as a plain-words error with its code, or null when it was sent. */
export function groupReplyProblem(
  kind: RobotGroupChatKind,
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

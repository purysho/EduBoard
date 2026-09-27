import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'
import { groupChatKind, groupChatProblem, groupMessageBody } from '@shared/groupChats'
import { sendToGroupChat, signedWebhook } from '../groupChat'

const ding = 'https://oapi.dingtalk.com/robot/send?access_token=abc123'
const wecom = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=k-1'

describe('group chats', () => {
  it('accepts only DingTalk and WeCom robot addresses', () => {
    expect(groupChatKind(ding)).toBe('dingtalk')
    expect(groupChatKind(wecom)).toBe('wecom')
    expect(groupChatKind('http://oapi.dingtalk.com/robot/send?access_token=a')).toBeNull()
    expect(groupChatKind('https://evil.example/robot/send?access_token=a')).toBeNull()
    expect(
      groupChatKind('https://oapi.dingtalk.com.evil.example/robot/send?access_token=a')
    ).toBeNull()
    expect(groupChatKind('https://oapi.dingtalk.com/robot/send')).toBeNull()
    expect(groupChatProblem({ name: '4B', webhook: 'nonsense' })).toMatch(/robot address/)
    expect(groupChatProblem({ name: '', webhook: ding })).toMatch(/name/)
    expect(groupChatProblem({ name: '4B', webhook: ding, secret: 'nope' })).toMatch(/SEC/)
    expect(
      groupChatProblem({ name: '4B', webhook: ding, secret: 'SEC' + 'a'.repeat(30) })
    ).toBeNull()
  })

  it('signs DingTalk requests when the robot has a secret', () => {
    const secret = 'SEC' + 'f'.repeat(40)
    const url = new URL(signedWebhook({ webhook: ding, secret }, 1700000000000))
    const expected = createHmac('sha256', secret)
      .update(`1700000000000\n${secret}`)
      .digest('base64')
    expect(url.searchParams.get('timestamp')).toBe('1700000000000')
    expect(url.searchParams.get('sign')).toBe(expected)
    expect(url.searchParams.get('access_token')).toBe('abc123')
    // No secret, or WeCom: the address is used as it is.
    expect(signedWebhook({ webhook: ding }, 1)).toBe(ding)
    expect(signedWebhook({ webhook: wecom, secret }, 1)).toBe(wecom)
  })

  it('sends markdown each service understands', () => {
    expect(groupMessageBody('dingtalk', '# Hi\n- one', 'News')).toEqual({
      msgtype: 'markdown',
      markdown: { title: 'News', text: '# Hi\n- one' }
    })
    expect(groupMessageBody('wecom', 'x'.repeat(5000), 'News')).toEqual({
      msgtype: 'markdown',
      markdown: { content: 'x'.repeat(3500) }
    })
  })

  it('posts to the robot and explains a refusal in plain words', async () => {
    const calls: { url: string; body: unknown }[] = []
    const reply = (json: unknown): typeof fetch =>
      (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) })
        return Response.json(json)
      }) as unknown as typeof fetch
    await sendToGroupChat({ webhook: wecom }, 'Trip on Friday', '4B', reply({ errcode: 0 }))
    expect(calls[0]).toEqual({
      url: wecom,
      body: { msgtype: 'markdown', markdown: { content: 'Trip on Friday' } }
    })
    await expect(
      sendToGroupChat({ webhook: ding }, 'Hi', '4B', reply({ errcode: 310000, errmsg: 'keywords' }))
    ).rejects.toThrow(/security setting/)
    await expect(
      sendToGroupChat({ webhook: wecom }, 'Hi', '4B', reply({ errcode: 93000 }))
    ).rejects.toThrow(/no longer valid/)
    // What DingTalk really answers for a robot that doesn't exist.
    await expect(
      sendToGroupChat(
        { webhook: ding },
        'Hi',
        '4B',
        reply({ errcode: 300005, errmsg: 'token is not exist' })
      )
    ).rejects.toThrow(/no longer valid/)
    await expect(
      sendToGroupChat({ webhook: 'https://example.com' }, 'Hi', '4B', reply({ errcode: 0 }))
    ).rejects.toThrow(/robot address/)
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(sendToGroupChat({ webhook: wecom }, 'Hi', '4B', offline)).rejects.toThrow(
      /internet/
    )
  })
})

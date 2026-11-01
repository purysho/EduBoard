// Local-only pilot mode: everything that would send data off the computer is refused in
// the main process, both at the IPC door and in the network code itself.
import { randomUUID } from 'crypto'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { spellcheckUrl, paths, releaseChecks, downloads } = vi.hoisted(() => ({
  spellcheckUrl: vi.fn(),
  paths: { userData: '' },
  releaseChecks: [] as (string | null)[],
  downloads: [] as string[]
}))
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '0.7.10',
    getPath: () => paths.userData,
    getLocale: () => 'en-US'
  },
  BrowserWindow: { getAllWindows: () => [] },
  Notification: { isSupported: () => false },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { defaultSession: { setSpellCheckerDictionaryDownloadURL: spellcheckUrl } }
}))

vi.mock('../selfUpdateCore', async (original) => ({
  ...(await original<typeof import('../selfUpdateCore')>()),
  fetchLatestRelease: vi.fn(async (portalUrl: string | null) => {
    releaseChecks.push(portalUrl)
    return {
      version: '9.9.9',
      assets: [
        {
          name: 'EduBoard.AppImage',
          size: 4,
          digest: `sha256:${'a'.repeat(64)}`,
          url: 'https://example.invalid/EduBoard.AppImage'
        }
      ]
    }
  }),
  downloadAsset: vi.fn(async (asset: { name: string }) => {
    downloads.push(asset.name)
    throw new Error('stop here: only whether a download starts matters')
  })
}))

import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { getSettings, updateSettings } from '../../repositories/settingsRepo'
import { createStudent, listStudents } from '../../repositories/students'
import { PILOT_BLOCKED_CHANNELS, DATA_FLOWS } from '@shared/dataFlows'
import { applyPilotSpellcheck, assertOutboundAllowed, pilotRefusal } from '../pilotMode'
import { portalFetch } from '../portalErrors'
import { getPublishStatus, publishToPortal, removeStudentFromPortal } from '../portalSyncService'
import { askAi, draftLessonPlan, testConnection } from '../aiService'
import { sendToGroupChat } from '../groupChat'
import { sendUsagePingIfDue, usagePingSettingChanged } from '../usagePing'
import { checkForUpdateInBackground, getAppUpdateInfo } from '../selfUpdate'

let dir: string
const realFetch = globalThis.fetch
const networkCalls: string[] = []

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-pilot-'))
  paths.userData = dir
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
  networkCalls.length = 0
  releaseChecks.length = 0
  downloads.length = 0
  globalThis.fetch = (async (url: string | URL) => {
    networkCalls.push(String(url))
    return Response.json({ ok: true })
  }) as typeof fetch
  // A teacher with everything set up: a Portal, an AI key, a group robot, the ping.
  updateSettings({
    portalUrl: 'https://portal.example.com',
    portalSyncSecret: 'synthetic-secret',
    aiProvider: 'deepseek',
    aiApiKey: 'sk-synthetic',
    usagePing: true
  })
  usagePingSettingChanged(true)
  networkCalls.length = 0
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.APPIMAGE
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const pilotOn = (): void => {
  updateSettings({ pilotMode: true })
}

const STUDENT = {
  firstName: 'Testa',
  lastName: 'Synthetic',
  preferredName: null,
  studentNumber: null,
  dateOfBirth: null,
  gradeLevel: null,
  guardianName: null,
  guardianContact: null,
  email: null,
  notes: null
}

describe('local-only pilot mode at the IPC door', () => {
  it('refuses every channel of every blocked flow with EB-7001, and nothing when off', () => {
    expect(PILOT_BLOCKED_CHANNELS.size).toBeGreaterThan(30)
    for (const channel of PILOT_BLOCKED_CHANNELS.keys()) {
      const refused = pilotRefusal(channel, true)
      expect(refused?.message, channel).toMatch(/\[EB-7001\]$/)
      expect(pilotRefusal(channel, false), channel).toBeNull()
    }
    for (const local of ['classes:list', 'scores:upsert', 'backup:create', 'settings:update']) {
      expect(pilotRefusal(local, true)).toBeNull()
    }
  })

  it('leaves the update check, links and the classroom Wi-Fi tools alone', () => {
    for (const flow of DATA_FLOWS.filter((f) => f.pilot !== 'blocked')) {
      for (const channel of flow.channels) expect(pilotRefusal(channel, true), channel).toBeNull()
    }
  })

  it('covers every IPC handler that calls a network service', () => {
    // Handlers that call one of these reach the internet. Each must be refused in pilot
    // mode, or be listed below with why it may still run.
    const NETWORK = [
      'publishToPortal',
      'pullSubmissionsFromPortal',
      'getStudentAiActivity',
      'getReviewStats',
      'pushSubmissionGrade',
      'pushSubmissionPortfolio',
      'downloadSubmissionFile',
      'listMessageThreads',
      'sendTeacherMessage',
      'markMessageThreadRead',
      'translateMessage',
      'listClassPosts',
      'listReportCardDeliveries',
      'withdrawReportCards',
      'createClassPost',
      'deleteClassPost',
      'remindUnrepliedFamilies',
      'sendDigestNow',
      'resetPortalPassword',
      'getPortalProfile',
      'previewDigest',
      'setDigestNewsletter',
      'emailTeacherSummary',
      'listPortalResetRequests',
      'answerPortalResetRequest',
      'sendReportCards',
      'aiService.',
      'draftSubmissionFeedback',
      'draftNewsletter',
      'sendToGroupChat',
      'sendToSavedGroupChat',
      'askNotebook',
      'draftPracticeSet(',
      'draftStudyGuide(',
      // Mixed: local work plus a Portal part, which pilot mode skips (see below).
      'removeStudentFromPortal',
      'mergeStudentsEverywhere',
      'getStudentsWithPortalAccounts',
      'usagePingSettingChanged',
      'installAppUpdate',
      'getAppUpdateInfo',
      'indexResource('
    ]
    const STILL_RUNS: Record<string, string> = {
      'students:remove': 'deletes here; its Portal part is skipped (no Portal in a pilot)',
      'students:erase': 'erases here; its Portal part is skipped',
      'students:merge': 'merges here; its Portal part is skipped',
      'portalJoinLinks:overview': 'shows saved links; the Portal accounts look-up is skipped',
      'settings:update': 'saves settings; the usage ping it may start is refused',
      'schoolPack:apply': 'applies a pack; turning the usage ping off sends nothing',
      'settings:installAppUpdate': 'updates download only when the teacher asks',
      'settings:appUpdateInfo': 'the update check sends only the version number',
      'notebook:indexResource': 'reads a page the teacher linked; sends nothing about classes',
      'notebook:indexAll': 'the same, for every linked resource'
    }
    const source = readFileSync(join(__dirname, '../../ipc/register.ts'), 'utf8')
    const ipc = readFileSync(join(__dirname, '../../../shared/ipc.ts'), 'utf8')
    const channelOf = (path: string): string => {
      const [area, name] = path.replace('IpcChannels.', '').split('.')
      const block = new RegExp(`\\b${area}: \\{([\\s\\S]*?)\\n  \\}`).exec(ipc)?.[1] ?? ''
      return new RegExp(`\\b${name}: '([^']+)'`).exec(block)?.[1] ?? path
    }
    const uncovered: string[] = []
    for (const part of source.split(/\n {2}handle\(/).slice(1)) {
      const path = /^\s*(IpcChannels\.[\w.]+)/.exec(part)?.[1]
      if (!path) continue
      const channel = channelOf(path)
      if (!NETWORK.some((name) => part.includes(name))) continue
      if (!PILOT_BLOCKED_CHANNELS.has(channel) && !(channel in STILL_RUNS)) uncovered.push(channel)
    }
    expect(uncovered).toEqual([])
  })
})

describe('local-only pilot mode in the network code', () => {
  it('never reaches the Portal, even when one is set up', async () => {
    pilotOn()
    await expect(portalFetch('https://portal.example.com/api/sync')).rejects.toMatchObject({
      code: 'EB-7001'
    })
    await expect(publishToPortal()).rejects.toThrow()
    expect(getPublishStatus().configured).toBe(false)
    expect(networkCalls).toEqual([])
  })

  it('still deletes a student here, skipping the Portal', async () => {
    pilotOn()
    const student = createStudent(STUDENT)
    expect(await removeStudentFromPortal(student.id)).toBe('no-portal')
    expect(listStudents(true).some((s) => s.id === student.id)).toBe(true)
    expect(networkCalls).toEqual([])
  })

  it('calls no AI provider, from any feature', async () => {
    pilotOn()
    await expect(askAi('system', 'user', 10)).rejects.toMatchObject({ code: 'EB-7001' })
    await expect(
      draftLessonPlan({ className: 'Class A', subject: null, gradeLevel: null, topic: 'Topic' })
    ).rejects.toMatchObject({ code: 'EB-7001' })
    const check = await testConnection({
      provider: 'deepseek',
      apiKey: 'sk-synthetic',
      customBaseUrl: '',
      customModel: ''
    })
    expect(check.ok).toBe(false)
    expect(networkCalls).toEqual([])
  })

  it('posts nothing to DingTalk or WeCom', async () => {
    pilotOn()
    const doFetch = vi.fn()
    await expect(
      sendToGroupChat(
        { webhook: 'https://oapi.dingtalk.com/robot/send?access_token=synthetic', secret: '' },
        'Synthetic post',
        'Title',
        doFetch as unknown as typeof fetch
      )
    ).rejects.toMatchObject({ code: 'EB-7001' })
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('sends no usage count, even if it was on before', async () => {
    pilotOn()
    const doFetch = vi.fn()
    expect(await sendUsagePingIfDue(new Date(), doFetch as unknown as typeof fetch)).toBe(false)
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('checks for updates at GitHub, not through the Portal, and never downloads by itself', async () => {
    process.env.APPIMAGE = join(dir, 'EduBoard.AppImage')
    await checkForUpdateInBackground()
    expect(downloads).toEqual(['EduBoard.AppImage']) // pilot off: downloads quietly
    expect(releaseChecks.at(-1)).toBe('https://portal.example.com')

    downloads.length = 0
    pilotOn()
    await checkForUpdateInBackground()
    expect(releaseChecks.at(-1)).toBeNull()
    expect(downloads).toEqual([])
    expect((await getAppUpdateInfo()).latest).toBe('9.9.9')
    expect(releaseChecks.at(-1)).toBeNull()
  })

  it('points the spelling dictionary download away from the internet', () => {
    applyPilotSpellcheck(true)
    expect(spellcheckUrl).toHaveBeenLastCalledWith('http://127.0.0.1:9/')
    applyPilotSpellcheck(false)
    expect(spellcheckUrl.mock.lastCall?.[0]).toMatch(/^https:\/\/redirector\.gvt1\.com\//)
  })

  it('lets everything through when pilot mode is off', () => {
    expect(getSettings().pilotMode).toBe(false)
    expect(() => assertOutboundAllowed('portal')).not.toThrow()
    expect(() => assertOutboundAllowed('desktopAi')).not.toThrow()
  })
})

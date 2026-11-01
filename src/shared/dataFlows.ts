// Every way EduBoard can send something off the teacher's computer, in one list. It is
// the single source for three things that must agree:
//   - Settings → What leaves this computer (pages/Settings/DataFlowsPanel.tsx),
//   - docs/DATA_FLOWS.md for school IT (npm run data-flows writes it from this file;
//     a test fails if it is out of date),
//   - local-only pilot mode: each flow marked 'blocked' has its IPC channels refused in
//     the main process (main/services/pilotMode.ts), and its network code checks too.
//
// When you add a network call anywhere in the app, add it here. The test in
// main/services/__tests__/pilotMode.test.ts reads register.ts and fails if a handler that
// calls a network service is neither blocked here nor named as allowed.
//
// The text is English, shown through tr(); the Chinese is in i18n/zh/pilot.ts.

export type DataFlowId =
  | 'updateCheck'
  | 'updateDownload'
  | 'portal'
  | 'desktopAi'
  | 'portalAi'
  | 'digest'
  | 'usagePing'
  | 'groupChats'
  | 'spellcheck'
  | 'linkPages'
  | 'classroomNetwork'
  | 'browserLinks'

/** What local-only pilot mode does with a flow. */
export type PilotTreatment =
  /** Turned off: the main process refuses it. */
  | 'blocked'
  /** Stays as it is. */
  | 'allowed'
  /** Happens only when the teacher asks, never on its own. */
  | 'askFirst'
  /** Stays: it only reaches devices on the same Wi-Fi, never the internet. */
  | 'localNetwork'

export interface DataFlow {
  id: DataFlowId
  name: string
  /** Where it goes. */
  destination: string
  /** What it sends. */
  sends: string
  /** When it happens. */
  when: string
  /** Whether it can happen on a new install with nothing set up. */
  onByDefault: boolean
  /** One line about the default. */
  defaultNote: string
  pilot: PilotTreatment
  /** One line about pilot mode. */
  pilotNote: string
  /** IPC channels that make this call. For a 'blocked' flow, every one is refused in
   * pilot mode. Channels that also do local work (deleting a student, say) aren't here:
   * their Portal part is skipped instead. */
  channels: readonly string[]
  /** Where the network code is, for school IT. */
  code: readonly string[]
}

export const DATA_FLOWS: readonly DataFlow[] = [
  {
    id: 'updateCheck',
    name: 'Checking for updates',
    destination:
      'GitHub (api.github.com), or your Portal server if you set one up, which asks GitHub for you.',
    sends:
      'An ordinary web request with EduBoard’s version number. Nothing about you, your classes or your students.',
    when: 'Shortly after EduBoard opens, then every 4 hours, and when you press Check for updates.',
    onByDefault: true,
    defaultNote: 'On.',
    pilot: 'allowed',
    pilotNote:
      'Stays on, because it sends only the version number. It goes straight to GitHub, not through a Portal.',
    channels: ['settings:appUpdateInfo', 'settings:appUpdateStatus'],
    code: ['src/main/services/selfUpdateCore.ts', 'src/main/services/selfUpdate.ts']
  },
  {
    id: 'updateDownload',
    name: 'Downloading an update',
    destination: 'GitHub’s download servers, or your Portal server if you set one up.',
    sends: 'A request for the new installer file. Nothing about you or your classes.',
    when: 'In the background when automatic updates are on, or when you press Update now.',
    onByDefault: true,
    defaultNote: 'On (Settings → Help and updates → automatic updates).',
    pilot: 'askFirst',
    pilotNote: 'Only when you press Update now. Nothing downloads by itself.',
    channels: ['settings:installAppUpdate'],
    code: ['src/main/services/selfUpdate.ts', 'src/main/services/selfUpdateCore.ts']
  },
  {
    id: 'portal',
    name: 'The student Portal (publishing and syncing)',
    destination: 'The Portal address in Settings → Portal and families: a server your school runs.',
    sends:
      'Class names; students’ names, dates of birth and student numbers; enrolments; grades and scores with your comments; attendance rates; class points; homework and attachments; shared resources; report cards, posts and messages; and your Portal AI key and email settings, so the Portal can use them. It reads back handed-in work, messages, profiles and new sign-ups.',
    when: 'When you publish, a moment after changes once a Portal is set up, and when you open Portal screens.',
    onByDefault: false,
    defaultNote: 'Off until you add a Portal address and sync secret.',
    pilot: 'blocked',
    pilotNote: 'Off. Nothing is published and Portal screens are turned off.',
    channels: [
      'portalSync:publish',
      'portalSync:pullSubmissions',
      'portalSync:aiActivity',
      'portalSync:reviewStats',
      'portalProfiles:get',
      'portalMessages:listThreads',
      'portalMessages:send',
      'portalMessages:markRead',
      'reportCards:send',
      'reportCards:list',
      'reportCards:withdraw',
      'classPosts:list',
      'classPosts:create',
      'classPosts:remove',
      'classPosts:remind',
      'portalAccounts:resetPassword',
      'portalAccounts:listResetRequests',
      'portalAccounts:answerResetRequest',
      'homeworkAssignments:setSubmissionGrade',
      'homeworkAssignments:setSubmissionPortfolio',
      'homeworkAssignments:openSubmissionFile',
      'homeworkRubricScores:save'
    ],
    code: ['src/main/services/portalSyncService.ts', 'src/main/services/reportCardDelivery.ts']
  },
  {
    id: 'desktopAi',
    name: 'AI suggestions in the app',
    destination:
      'The AI provider you choose in Settings → AI: DeepSeek, Qwen, Zhipu, Anthropic, or an address you enter.',
    sends:
      'What the button needs. Lesson and unit drafts: the topic, your class profile and counts about the class, no names. Report comment phrases: the student’s name, grade, attendance and recent notes. Feedback drafts: the student’s handed-in work. Notebook, study guides and practice sets: your resources’ text. Newsletter: the week’s facts.',
    when: 'Only when you press an AI button.',
    onByDefault: false,
    defaultNote: 'Off until you enter an AI key.',
    pilot: 'blocked',
    pilotNote: 'Off. AI buttons are greyed out.',
    channels: [
      'ai:draftLessonPlan',
      'ai:draftUnitPlan',
      'ai:suggestCommentPhrases',
      'ai:testConnection',
      'notebook:ask',
      'notebook:draftStudyGuide',
      'notebook:draftPracticeSet',
      'homeworkAssignments:draftFeedback',
      'newsletter:draft'
    ],
    code: ['src/main/services/aiService.ts']
  },
  {
    id: 'portalAi',
    name: 'AI for students on the Portal',
    destination:
      'Your Portal server, which calls the AI provider chosen in Settings → AI → AI for students.',
    sends:
      'Students’ Study Helper questions with matching class material and a nameless practice summary; messages and classwork to translate.',
    when: 'When students use the Study Helper or Translate on the Portal. Your key reaches the Portal when you publish.',
    onByDefault: false,
    defaultNote: 'Off until you enter a key for students and publish.',
    pilot: 'blocked',
    pilotNote: 'Off, because nothing is published.',
    channels: ['portalMessages:translate'],
    code: ['src/main/services/portalSyncService.ts', 'portal/services/ai.js']
  },
  {
    id: 'digest',
    name: 'Weekly email to families and to you',
    destination:
      'Your Portal server, which sends it through the email account in Settings → Portal and families.',
    sends:
      'Each family’s digest (their child’s grades, attendance, homework and class news) and your own weekly summary. Your email password goes to the Portal when you publish.',
    when: 'Once a week when the digest is on, or when you press Send now.',
    onByDefault: false,
    defaultNote: 'Off until you turn the digest on.',
    pilot: 'blocked',
    pilotNote: 'Off.',
    channels: ['digest:sendNow', 'digest:preview', 'digest:setNewsletter', 'weeklySummary:email'],
    code: ['src/main/services/portalSyncService.ts', 'portal/services/digest.js']
  },
  {
    id: 'usagePing',
    name: 'Anonymous weekly usage count',
    destination: 'The EduBoard project (portal.edu-board.com).',
    sends:
      'A random number made on this computer, the version, the system and language, roughly how many classes and students (as a range), and whether a Portal is set up. Never names, the school, grades or anything a student wrote.',
    when: 'Once a week.',
    onByDefault: false,
    defaultNote: 'Off unless you turn it on.',
    pilot: 'blocked',
    pilotNote: 'Off, and can’t be turned on.',
    channels: [],
    code: ['src/main/services/usagePing.ts']
  },
  {
    id: 'groupChats',
    name: 'Posting to DingTalk or WeCom groups',
    destination: 'DingTalk (oapi.dingtalk.com) or WeCom (qyapi.weixin.qq.com).',
    sends: 'The text of the post or newsletter you send, which may name students.',
    when: 'Only when you press Send to group.',
    onByDefault: false,
    defaultNote: 'Off until you add a group robot.',
    pilot: 'blocked',
    pilotNote: 'Off.',
    channels: ['groupChats:send', 'groupChats:route', 'groupChats:test'],
    code: ['src/main/services/groupChat.ts']
  },
  {
    id: 'spellcheck',
    name: 'Spelling dictionary',
    destination:
      'Google’s download servers (redirector.gvt1.com), used by Electron, the framework EduBoard is built on.',
    sends: 'Which language’s dictionary is needed. Nothing you type.',
    when: 'The first time you type in a text box, on Windows and Linux. Macs use their own dictionary.',
    onByDefault: true,
    defaultNote: 'On.',
    pilot: 'blocked',
    pilotNote:
      'Off. No dictionary is downloaded, so spelling suggestions may be missing until one is installed on the computer.',
    channels: [],
    code: ['src/main/services/pilotMode.ts']
  },
  {
    id: 'linkPages',
    name: 'Reading a web link you added',
    destination: 'The web page of a link you added to Resources.',
    sends: 'An ordinary request for that page. Nothing about your classes.',
    when: 'When the Notebook reads a link resource so you can search it.',
    onByDefault: true,
    defaultNote: 'Only for links you add.',
    pilot: 'allowed',
    pilotNote: 'Stays: it sends nothing about your classes.',
    channels: ['notebook:indexResource', 'notebook:indexAll'],
    code: ['src/main/services/notebookService.ts']
  },
  {
    id: 'classroomNetwork',
    name: 'Exit tickets, QR check-in and the classroom screen',
    destination:
      'Phones and the classroom computer on the same Wi-Fi. Nothing goes to the internet.',
    sends:
      'The question or check-in page, with the class list (full names) to choose from. Students’ answers come back to this computer. The page uses plain http on the school network, so anyone on that Wi-Fi with the link can see the class list.',
    when: 'Only while you have an exit ticket, a QR check-in or the classroom screen open.',
    onByDefault: false,
    defaultNote: 'Off until you open one.',
    pilot: 'localNetwork',
    pilotNote: 'Stays: it never leaves the school’s network.',
    channels: [
      'exitTickets:setOpen',
      'attendanceCheckIn:open',
      'classroomHub:open',
      'classroomHub:project'
    ],
    code: ['src/main/services/exitTicketServer.ts']
  },
  {
    id: 'browserLinks',
    name: 'Links you open',
    destination: 'Your web browser.',
    sends: 'Nothing from EduBoard. Your browser opens the page.',
    when: 'When you click a link, such as Help or a resource’s address.',
    onByDefault: true,
    defaultNote: 'Only when you click.',
    pilot: 'allowed',
    pilotNote: 'Stays.',
    channels: ['lessonResources:openExternal'],
    code: ['src/main/windows.ts']
  }
]

export function dataFlow(id: DataFlowId): DataFlow {
  const flow = DATA_FLOWS.find((f) => f.id === id)
  if (!flow) throw new Error(`Unknown data flow ${id}`)
  return flow
}

/** IPC channels refused while local-only pilot mode is on, with the flow each belongs to. */
export const PILOT_BLOCKED_CHANNELS: ReadonlyMap<string, DataFlowId> = new Map(
  DATA_FLOWS.filter((f) => f.pilot === 'blocked').flatMap((f) =>
    f.channels.map((c) => [c, f.id] as const)
  )
)

/** Whether a flow is turned off by local-only pilot mode. */
export function blockedInPilot(id: DataFlowId): boolean {
  return dataFlow(id).pilot === 'blocked'
}

/** Every piece of text above, for the translation coverage test (i18n/dynamicKeys.ts). */
/** How each treatment is shown, in Settings and in docs/DATA_FLOWS.md. */
export const PILOT_TREATMENT_LABELS: Record<PilotTreatment, string> = {
  blocked: 'Off',
  allowed: 'Stays on',
  askFirst: 'Only when you ask',
  localNetwork: 'Stays on (school Wi-Fi only)'
}

export const DATA_FLOW_TEXTS: readonly string[] = [
  ...Object.values(PILOT_TREATMENT_LABELS),
  ...DATA_FLOWS.flatMap((f) => [f.name, f.destination, f.sends, f.when, f.defaultNote, f.pilotNote])
]

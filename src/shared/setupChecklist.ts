// The teacher's "Getting started" checklist. Every step is ticked from real data (see
// main/services/setupProgress.ts), never by the teacher clicking a box, so it can't
// claim a step is done when it isn't, and it keeps up as the teacher works.

export interface SetupProgress {
  classCount: number
  activeEnrollmentCount: number
  publishedHomeworkCount: number
  /** Portal URL and sync secret are set, and the URL is one EduBoard will use. */
  portalConnected: boolean
  inviteBatchCount: number
  sharedResourceCount: number
  aiConfigured: boolean
  /** Where class-specific steps link to: the first active class, if any. */
  firstClassId: string | null
}

export interface SetupStep {
  id: string
  title: string
  description: string
  done: boolean
  optional: boolean
  /** In-app route for the step's button. */
  to: string
  actionLabel: string
}

export function setupSteps(p: SetupProgress): SetupStep[] {
  // Class-specific steps open the first class; until one exists, the Classes page.
  const cls = p.firstClassId ? `/classes/${p.firstClassId}` : null
  return [
    {
      id: 'class',
      title: 'Create your first class',
      description: 'Name it, pick the level, and set how it’s graded.',
      done: p.classCount > 0,
      optional: false,
      to: '/classes',
      actionLabel: 'Go to Classes'
    },
    {
      id: 'students',
      title: 'Add your students',
      description: 'Add them one by one, or import a roster from a spreadsheet.',
      done: p.activeEnrollmentCount > 0,
      optional: false,
      to: cls ?? '/classes',
      actionLabel: 'Open roster'
    },
    {
      id: 'homework',
      title: 'Publish an assignment',
      description: 'Drafts stay private. Publishing puts it on the Portal for students.',
      done: p.publishedHomeworkCount > 0,
      optional: false,
      to: cls ? `${cls}/homework` : '/classes',
      actionLabel: 'Open Homework'
    },
    {
      id: 'portal',
      title: 'Connect the student Portal',
      description: 'Paste your Portal address and sync secret in Settings.',
      done: p.portalConnected,
      optional: false,
      to: '/settings',
      actionLabel: 'Open Settings'
    },
    {
      id: 'invites',
      title: 'Invite your students',
      description:
        'Share a class join link (or QR code), or give a student their own link. Students sign up in a minute.',
      done: p.inviteBatchCount > 0,
      optional: false,
      to: cls ? `${cls}/portal` : '/classes',
      actionLabel: 'Get a join link'
    },
    {
      id: 'materials',
      title: 'Share study material',
      description:
        'Add a reading to Resources and share it with a class. Students get study guides, flashcards and quizzes.',
      done: p.sharedResourceCount > 0,
      optional: true,
      to: '/resources',
      actionLabel: 'Open Resources'
    },
    {
      id: 'ai',
      title: 'Add an AI key',
      description: 'Powers feedback drafts, study guides, flashcards and the student Study Helper.',
      done: p.aiConfigured,
      optional: true,
      to: '/settings',
      actionLabel: 'Open Settings'
    }
  ]
}

/** All the essentials are done (optional extras don't count). */
export function setupComplete(steps: SetupStep[]): boolean {
  return steps.every((s) => s.optional || s.done)
}

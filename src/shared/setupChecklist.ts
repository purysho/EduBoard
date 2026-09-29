import { tr } from './i18n'
// The teacher's "Getting started" checklist. Every step is ticked from real data (see
// main/services/setupProgress.ts), never by the teacher clicking a box, so it can't
// claim a step is done when it isn't, and it keeps up as the teacher works.

export interface SetupProgress {
  /** Terms set up (Settings → Grading and reports). */
  termCount: number
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
  // In the order a teacher can do them: the Portal before anything that goes on it.
  return [
    // Terms first: a class is created in a term, and reports and "Start next term" go by them.
    {
      id: 'terms',
      title: tr('Set up your terms'),
      description: tr(
        'Name this school year’s terms and their dates, so classes, reports and next term’s copies line up.'
      ),
      done: p.termCount > 0,
      optional: false,
      to: '/settings?section=grading&focus=terms',
      actionLabel: tr('Add terms')
    },
    {
      id: 'class',
      title: tr('Create your first class'),
      description: tr('Name it, pick the level, and set how it’s graded.'),
      done: p.classCount > 0,
      optional: false,
      to: '/classes',
      actionLabel: tr('Go to Classes')
    },
    {
      id: 'students',
      title: tr('Add your students'),
      description: tr('Add them one by one, or import a roster from a spreadsheet.'),
      done: p.activeEnrollmentCount > 0,
      optional: false,
      to: cls ?? '/classes',
      actionLabel: tr('Open roster')
    },
    {
      id: 'portal',
      title: tr('Connect the student Portal'),
      description: tr(
        'Where students and families sign in (needs internet). Paste its address and sync secret, from your school or your own Portal, in Settings.'
      ),
      done: p.portalConnected,
      optional: false,
      to: '/settings?section=portal',
      actionLabel: tr('Open Settings')
    },
    {
      id: 'invites',
      title: tr('Invite your students'),
      description: tr(
        'Share a class join link (or QR code), or give a student their own link. Students sign up in a minute.'
      ),
      done: p.inviteBatchCount > 0,
      optional: false,
      to: cls ? `${cls}/portal` : '/classes',
      actionLabel: tr('Get a join link')
    },
    {
      id: 'homework',
      title: tr('Publish an assignment'),
      description: tr('Drafts stay private. Publishing puts it on the Portal for students.'),
      done: p.publishedHomeworkCount > 0,
      optional: false,
      to: cls ? `${cls}/homework` : '/classes',
      actionLabel: tr('Open Homework')
    },
    {
      id: 'materials',
      title: tr('Share study material'),
      description: tr(
        'Add a reading to Resources and share it with a class. Students get study guides, flashcards and quizzes.'
      ),
      done: p.sharedResourceCount > 0,
      optional: true,
      to: '/resources',
      actionLabel: tr('Open Resources')
    },
    {
      id: 'ai',
      title: tr('Add an AI key'),
      description: tr(
        'Needs internet. Suggests feedback drafts, study guides, flashcards and the student Study Helper; you check everything before it’s used.'
      ),
      done: p.aiConfigured,
      optional: true,
      to: '/settings?section=ai',
      actionLabel: tr('Open Settings')
    }
  ]
}

/** All the essentials are done (optional extras don't count). */
export function setupComplete(steps: SetupStep[]): boolean {
  return steps.every((s) => s.optional || s.done)
}

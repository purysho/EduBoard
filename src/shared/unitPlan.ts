// A unit plan: what students need to know first, then a sequence of lessons that each
// build on the last and end with a quick check that the aim was met. The AI drafts it;
// the teacher reads it, and the lessons become ordinary planned lessons on the class's
// next teaching days (optionally each drafted in full, one by one, from the unit).

export const UNIT_MIN_LESSONS = 2
export const UNIT_MAX_LESSONS = 12

export interface DraftUnitPlanInput {
  classId: string
  className: string
  subject: string | null
  gradeLevel: string | null
  /** What the unit is about, in the teacher's words. */
  topic: string
  lessonCount: number
}

export interface UnitLesson {
  title: string
  objectives: string
  /** A quick check, at the end of the lesson, that shows whether the aim was met. */
  check: string
}

export interface DraftedUnitPlan {
  title: string
  /** What students must already know or be able to do; revisited in the first lesson. */
  prerequisites: string[]
  lessons: UnitLesson[]
}

/** One lesson of a unit, as the teacher accepted it, to be added to the class. */
export interface UnitLessonToCreate {
  title: string
  objectives: string
  materials?: string
  activities?: string
  support?: string
  stretch?: string
  homework?: string
}

export interface CreateUnitLessonsInput {
  classId: string
  unitTitle: string
  /** The first day a lesson may go on. */
  startDate: string
  lessons: UnitLessonToCreate[]
}

const MAX_FIELD = 600

const text = (value: unknown, max = MAX_FIELD): string =>
  (typeof value === 'string' ? value : '')
    .replace(/[^\P{Cc}\n\t]/gu, '')
    .trim()
    .slice(0, max)

export function clampLessonCount(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 6
  return Math.min(UNIT_MAX_LESSONS, Math.max(UNIT_MIN_LESSONS, v))
}

/** The AI's reply (already JSON-parsed) as a unit plan: every field a clean string, at
 * most the lessons asked for, lessons without a title dropped. Throws when no lesson is
 * usable, so the teacher sees a failure rather than an empty unit. */
export function parseUnitPlan(
  parsed: unknown,
  topic: string,
  lessonCount: number
): DraftedUnitPlan {
  const raw = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>
  const prerequisites = (Array.isArray(raw.prerequisites) ? raw.prerequisites : [])
    .map((p) => text(p, 200))
    .filter(Boolean)
    .slice(0, 6)
  const lessons = (Array.isArray(raw.lessons) ? raw.lessons : [])
    .map((l) => {
      const r = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
      return { title: text(r.title, 200), objectives: text(r.objectives), check: text(r.check) }
    })
    .filter((l) => l.title)
    .slice(0, clampLessonCount(lessonCount))
  if (!lessons.length) throw new Error('The AI reply had no lessons in it. Try again.')
  return { title: text(raw.title, 200) || text(topic, 200), prerequisites, lessons }
}

/** Where one lesson sits in its unit, for drafting that lesson in full. */
export function unitLessonContext(unit: DraftedUnitPlan, index: number): string {
  const lesson = unit.lessons[index]
  const lines = [
    `This is lesson ${index + 1} of ${unit.lessons.length} in the unit "${unit.title}".`,
    `Aims: ${lesson.objectives || lesson.title}`
  ]
  if (lesson.check) lines.push(`End the lesson with this check: ${lesson.check}`)
  if (index === 0 && unit.prerequisites.length) {
    lines.push(`Start by briefly revisiting: ${unit.prerequisites.join('; ')}`)
  }
  if (index > 0) lines.push(`The lesson before: ${unit.lessons[index - 1].title}`)
  if (index < unit.lessons.length - 1) {
    lines.push(`The lesson after: ${unit.lessons[index + 1].title}`)
  }
  return lines.join('\n')
}

/** The label a unit lesson carries in the planner and curriculum map, e.g. "Greetings 2/6". */
export function unitLessonLabel(unitTitle: string, index: number, count: number): string {
  const suffix = ` ${index + 1}/${count}`
  const title = unitTitle.trim()
  return (
    (title.length + suffix.length > 60 ? `${title.slice(0, 59 - suffix.length)}…` : title) + suffix
  )
}

/** The check, folded into a lesson's objectives so it shows on the plan. */
export function objectivesWithCheck(lesson: UnitLesson): string {
  return lesson.check ? `${lesson.objectives}\nCheck: ${lesson.check}`.trim() : lesson.objectives
}

// The sample school: EduBoard reopened on a separate database full of made-up classes,
// so a teacher (or a school, or an investor) can try everything without typing in real
// students. It lives in its own folder beside the real data (see db/path.ts), so the
// teacher's own classes are never read or changed, and leaving it reopens them.
import { app } from 'electron'
import { rmSync } from 'fs'
import { DEFAULT_GRADE_THRESHOLDS, type BehaviourPoint } from '@shared/types'
import type { MarkAttendanceInput, UpsertScoreInput } from '@shared/inputs'
import { uiLanguage } from '@shared/i18n'
import { getDb } from '../db/client'
import { behaviourPoints, homeworkSubmissions, studentLogEntries } from '../db/schema'
import { newId } from '../db/util'
import {
  SAMPLE_SCHOOL_FLAG,
  SAMPLE_SCHOOL_FRESH_FLAG,
  isSampleSchool,
  sampleSchoolDir
} from '../db/path'
import { createTerm } from '../repositories/terms'
import { createClass, listClasses } from '../repositories/classes'
import { createStudent } from '../repositories/students'
import { enrollStudent } from '../repositories/enrollments'
import { createGradeCategory } from '../repositories/gradeCategories'
import { createAssessment } from '../repositories/assessments'
import { upsertScoresBulk } from '../repositories/scores'
import { markAttendanceBulk } from '../repositories/attendanceRecords'
import { createHomeworkAssignment } from '../repositories/homeworkAssignments'
import { createLessonPlan } from '../repositories/lessonPlans'
import { setReportComment } from '../repositories/reportComments'
import { updateSettings } from '../repositories/settingsRepo'

export { isSampleSchool }

/** Reopens EduBoard in the sample school (from the start again when `fresh`). */
export function openSampleSchool(fresh = false): void {
  const args = process.argv
    .slice(1)
    .filter((a) => a !== SAMPLE_SCHOOL_FLAG && a !== SAMPLE_SCHOOL_FRESH_FLAG)
  app.relaunch({
    args: [...args, SAMPLE_SCHOOL_FLAG, ...(fresh ? [SAMPLE_SCHOOL_FRESH_FLAG] : [])]
  })
  app.exit(0)
}

/** Reopens EduBoard on the teacher's own data. */
export function leaveSampleSchool(): void {
  const args = process.argv
    .slice(1)
    .filter((a) => a !== SAMPLE_SCHOOL_FLAG && a !== SAMPLE_SCHOOL_FRESH_FLAG)
  app.relaunch({ args })
  app.exit(0)
}

/** "Start over": the sample school's folder is removed before its database opens. */
export function clearSampleSchoolIfAsked(): void {
  if (isSampleSchool() && process.argv.includes(SAMPLE_SCHOOL_FRESH_FLAG)) {
    rmSync(sampleSchoolDir(), { recursive: true, force: true })
  }
}

// ---- The made-up school ----------------------------------------------------------------

/** A small deterministic random generator, so the sample school is the same every time. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const iso = (d: Date): string => d.toISOString().slice(0, 10)
const daysAgo = (n: number, hour = 9): Date => {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}
const isSchoolDay = (d: Date): boolean => d.getDay() !== 0 && d.getDay() !== 6

// English-medium bilingual school: Chinese family names, pinyin given names, and the
// English name many students go by.
const STUDENTS: [string, string, string][] = [
  ['Chen', 'Yuxi', 'Amy'],
  ['Wang', 'Haoran', 'Leo'],
  ['Li', 'Xinyi', 'Cindy'],
  ['Zhang', 'Zihan', 'Kevin'],
  ['Liu', 'Yutong', 'Emma'],
  ['Yang', 'Jiahao', 'Jack'],
  ['Huang', 'Siqi', 'Sophie'],
  ['Zhao', 'Yichen', 'Eric'],
  ['Wu', 'Ruoxi', 'Lily'],
  ['Zhou', 'Zimo', 'Tom'],
  ['Xu', 'Keyi', 'Coco'],
  ['Sun', 'Junjie', 'Justin'],
  ['Ma', 'Yiran', 'Grace'],
  ['Zhu', 'Haoyu', 'Henry'],
  ['Hu', 'Shiyu', 'Stella'],
  ['Guo', 'Mingze', 'Max'],
  ['He', 'Anqi', 'Angel'],
  ['Lin', 'Zhiyuan', 'Oscar'],
  ['Gao', 'Yuhan', 'Hannah'],
  ['Luo', 'Chenxi', 'Chloe'],
  ['Zheng', 'Boyu', 'Brian'],
  ['Liang', 'Xiaoyu', 'Iris'],
  ['Song', 'Tianyi', 'Ethan'],
  ['Tang', 'Yixuan', 'Ella']
]

export function seedSampleSchoolIfEmpty(): void {
  if (!isSampleSchool() || listClasses(true).length > 0) return
  const zh = uiLanguage() === 'zh'
  const rand = seeded(20260928)
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]

  updateSettings({
    teacherName: zh ? '示例老师' : 'Ms Sample',
    schoolName: zh ? '河畔双语学校（示例）' : 'Riverside Bilingual School (sample)',
    onboardingDismissed: true
  })
  const termStart = daysAgo(56)
  const term = createTerm({
    name: zh ? '第一学期' : 'Term 1',
    schoolYear: `${termStart.getFullYear()}-${termStart.getFullYear() + 1}`,
    startDate: iso(termStart),
    endDate: iso(daysAgo(-60)),
    sortOrder: 0
  })

  const classSpecs = [
    {
      name: zh ? '四年级英语 4B' : 'Grade 4 English (4B)',
      grade: '4',
      room: '204',
      color: '#4f46e5',
      slice: [0, 12]
    },
    {
      name: zh ? '五年级英语 5A' : 'Grade 5 English (5A)',
      grade: '5',
      room: '305',
      color: '#0f766e',
      slice: [12, 24]
    }
  ]
  const students = STUDENTS.map(([last, first, english], i) =>
    createStudent({
      firstName: first,
      lastName: last,
      preferredName: english,
      studentNumber: String(2026100 + i),
      dateOfBirth: null,
      gradeLevel: i < 12 ? '4' : '5',
      guardianName: zh ? `${last}${first.slice(0, 1)}的家长` : `Parent of ${english}`,
      guardianContact: `138 0000 ${String(1000 + i * 37).slice(-4)}`,
      email: null,
      notes: null
    })
  )
  // Each student has a steady ability, so their scores and points look like a real
  // child's across the term, not noise.
  const ability = new Map(students.map((s) => [s.id, 0.55 + rand() * 0.42]))

  const assessmentsSpec = [
    { name: zh ? '单词测验 1' : 'Spelling quiz 1', max: 20, cat: 0, ago: 49 },
    { name: zh ? '阅读理解 1' : 'Reading check 1', max: 20, cat: 1, ago: 42 },
    { name: zh ? '口语任务：我的家庭' : 'Speaking task: my family', max: 30, cat: 2, ago: 35 },
    { name: zh ? '单词测验 2' : 'Spelling quiz 2', max: 20, cat: 0, ago: 28 },
    { name: zh ? '第一单元测试' : 'Unit 1 test', max: 100, cat: 1, ago: 21 },
    { name: zh ? '阅读理解 2' : 'Reading check 2', max: 20, cat: 1, ago: 14 },
    { name: zh ? '单词测验 3' : 'Spelling quiz 3', max: 20, cat: 0, ago: 7 }
  ]
  const categories = zh
    ? [
        ['词汇', 25],
        ['阅读与写作', 50],
        ['口语', 25]
      ]
    : [
        ['Vocabulary', 25],
        ['Reading and writing', 50],
        ['Speaking', 25]
      ]
  const comments = zh
    ? [
        '{name}本学期进步很大，上课积极发言。',
        '{name}阅读认真，下学期要多练习写作。',
        '{name}和同学合作很好，单词掌握扎实。'
      ]
    : [
        '{name} has made real progress this term and joins in every lesson.',
        '{name} reads carefully; next term the focus is longer pieces of writing.',
        '{name} works well with classmates and has learned the unit vocabulary thoroughly.'
      ]

  for (const spec of classSpecs) {
    const cls = createClass({
      name: spec.name,
      subject: zh ? '英语' : 'English',
      levelType: 'k12',
      gradeLevel: spec.grade,
      termId: term.id,
      schedule: zh ? '周一、周三、周五' : 'Mon, Wed, Fri',
      room: spec.room,
      color: spec.color,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const roster = students.slice(spec.slice[0], spec.slice[1])
    for (const s of roster) {
      enrollStudent({ studentId: s.id, classId: cls.id, enrolledOn: iso(termStart) })
    }
    const cats = categories.map(([name, weight], i) =>
      createGradeCategory({
        classId: cls.id,
        name: String(name),
        weightPercent: Number(weight),
        sortOrder: i
      })
    )

    // Scores
    const scoreInputs: UpsertScoreInput[] = []
    for (const a of assessmentsSpec) {
      const assessment = createAssessment({
        classId: cls.id,
        categoryId: cats[a.cat].id,
        name: a.name,
        description: null,
        assessmentDate: iso(daysAgo(a.ago)),
        maxScore: a.max
      })
      for (const s of roster) {
        if (rand() < 0.03) continue // not marked yet
        const p = Math.min(1, Math.max(0.2, ability.get(s.id)! + (rand() - 0.5) * 0.2))
        scoreInputs.push({
          assessmentId: assessment.id,
          studentId: s.id,
          pointsEarned: Math.round(p * a.max * 2) / 2,
          excused: false
        })
      }
    }
    upsertScoresBulk(scoreInputs)

    // Attendance on class days (Mon, Wed, Fri) since the term began.
    const marks: MarkAttendanceInput[] = []
    for (let n = 55; n >= 1; n--) {
      const day = daysAgo(n)
      if (!isSchoolDay(day) || ![1, 3, 5].includes(day.getDay())) continue
      for (const s of roster) {
        const r = rand()
        const status = r < 0.03 ? 'absent' : r < 0.07 ? 'late' : r < 0.08 ? 'excused' : 'present'
        marks.push({ classId: cls.id, studentId: s.id, date: iso(day), status })
      }
    }
    markAttendanceBulk(marks)

    // Class points over the last four weeks.
    const categoryIds = ['helping', 'on-task', 'great-answer', 'kindness', 'teamwork']
    const points: BehaviourPoint[] = []
    for (let n = 27; n >= 0; n--) {
      const day = daysAgo(n, 10)
      if (!isSchoolDay(day)) continue
      for (const s of roster) {
        if (rand() > 0.25 * ability.get(s.id)!) continue
        points.push({
          id: newId(),
          classId: cls.id,
          studentId: s.id,
          points: rand() < 0.06 ? -1 : 1,
          reason: null,
          category: pick(categoryIds),
          createdAt: day.toISOString()
        })
      }
    }
    if (points.length) getDb().insert(behaviourPoints).values(points).run()

    // Homework: two handed in and marked, one due next week.
    const homework = [
      { title: zh ? '写一写：我的周末' : 'Write about your weekend', due: 20, done: true },
      {
        title: zh ? '阅读第三章并回答问题' : 'Read chapter 3 and answer the questions',
        due: 9,
        done: true
      },
      { title: zh ? '准备口语展示' : 'Prepare your speaking presentation', due: -5, done: false }
    ]
    for (const h of homework) {
      const assignment = createHomeworkAssignment({
        classId: cls.id,
        title: h.title,
        description: null,
        dueDate: iso(daysAgo(h.due)),
        filePath: null,
        fileName: null,
        topic: zh ? '第一单元' : 'Unit 1',
        status: 'published',
        rubricId: null
      })
      if (!h.done) continue
      const rows = roster
        .filter(() => rand() < 0.88)
        .map((s) => {
          const at = daysAgo(h.due + (rand() < 0.8 ? 1 : -1), 19).toISOString()
          const a = ability.get(s.id)!
          return {
            id: newId(),
            homeworkAssignmentId: assignment.id,
            studentId: s.id,
            status: 'done',
            submittedAt: at,
            updatedAt: at,
            textAnswer: null,
            fileName: null,
            grade: a > 0.85 ? 'A' : a > 0.72 ? 'B' : 'C',
            feedback: null,
            gradedAt: at,
            portfolio: false,
            aiDeclared: false,
            aiHelpCount: 0,
            aiOverlap: null
          }
        })
      if (rows.length) getDb().insert(homeworkSubmissions).values(rows).run()
    }

    // Lesson plans: last week taught, this week and next planned.
    const lessons = zh
      ? ['家庭成员词汇', '阅读：我的家', '口语：介绍家人', '单元复习']
      : ['Family words', 'Reading: my home', 'Speaking: introduce your family', 'Unit review']
    lessons.forEach((title, i) => {
      createLessonPlan({
        classId: cls.id,
        date: iso(daysAgo(7 - i * 3)),
        weekLabel: null,
        title,
        objectives: zh
          ? '学生能用本课词汇描述自己的家庭。'
          : 'Students can describe their family using the unit words.',
        framework: null,
        materials: null,
        activities: null,
        homework: null,
        linkedAssessmentId: null,
        standards: null,
        status: i < 2 ? 'taught' : 'planned'
      })
    })

    // Report card comments for half the class, as if the teacher is partway through.
    roster.slice(0, Math.ceil(roster.length / 2)).forEach((s, i) => {
      setReportComment(
        cls.id,
        s.id,
        comments[i % comments.length].replace('{name}', s.preferredName ?? s.firstName)
      )
    })
  }

  // Log notes and parent contacts.
  const notes = zh
    ? [
        ['positive', '主动帮助新同学熟悉教室。', null],
        ['concern', '最近两次作业没有完成，需要关注。', null],
        ['contact', '给家长打电话，说明作业情况，家长会在家督促。', 'phone'],
        ['note', '坐在前排听得更清楚。', null]
      ]
    : [
        ['positive', 'Helped a new classmate find their way around.', null],
        ['concern', 'Two pieces of homework missing in a row; keep an eye on it.', null],
        [
          'contact',
          'Phoned home about the missing homework; parent will check it each evening.',
          'phone'
        ],
        ['note', 'Hears better sitting near the front.', null]
      ]
  const entries = students.slice(0, 8).map((s, i) => {
    const [type, text, method] = notes[i % notes.length]
    return {
      id: newId(),
      studentId: s.id,
      type: type as string,
      text: text as string,
      contactMethod: method,
      followUpNeeded: type === 'concern',
      followUpDone: false,
      createdAt: daysAgo(3 + i * 4, 15).toISOString()
    }
  })
  getDb().insert(studentLogEntries).values(entries).run()
}

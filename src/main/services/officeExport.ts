// Word and PowerPoint files from EduBoard, for teachers who finish things in Office or
// WPS: parent letters, report cards, newsletters and lesson plans as .docx, and a
// lesson plan as a starter .pptx deck. Everything is built here from this computer's
// data; nothing is uploaded anywhere.
import { AppError } from '@shared/errorCodes'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'
import PptxGenJS from 'pptxgenjs'
import { getClass } from '../repositories/classes'
import { getLessonPlan } from '../repositories/lessonPlans'
import { getLessonResource } from '../repositories/lessonResources'
import { listReportComments } from '../repositories/reportComments'
import { pointSummaries } from '../repositories/behaviourPoints'
import { resolveReportLayout } from '@shared/templates'
import type { PointSummaryItem } from '@shared/pointCategories'
import { getSettings } from '../repositories/settingsRepo'
import { getClassRoster, getStudentClassGrade } from './reports'
import { fillLetter } from '@shared/letters'
import { tr, uiLocale } from '@shared/i18n'

const today = (): string =>
  new Date().toLocaleDateString(uiLocale(), { day: 'numeric', month: 'long', year: 'numeric' })

const pct = (v: number | null, times = 1): string =>
  v === null ? '—' : `${Math.round(v * times)}%`

/** The school logo (a PNG data URL in settings) as a Word image, if there is one. */
function logoRun(size = 64): ImageRun | null {
  const logo = getSettings().schoolLogo
  const m = /^data:image\/png;base64,(.+)$/.exec(logo ?? '')
  if (!m) return null
  return new ImageRun({
    type: 'png',
    data: Buffer.from(m[1], 'base64'),
    transformation: { width: size, height: size }
  })
}

/** Text in EduBoard's newsletter format ("# " headings, "- " bullets, paragraphs) as
 * Word paragraphs. */
function formattedText(text: string): Paragraph[] {
  const out: Paragraph[] = []
  for (const block of text.split(/\n\s*\n/)) {
    for (const line of block.split('\n')) {
      if (!line.trim()) continue
      if (/^#{1,3}\s/.test(line)) {
        out.push(
          new Paragraph({ text: line.replace(/^#+\s*/, ''), heading: HeadingLevel.HEADING_2 })
        )
      } else if (/^\s*-\s+/.test(line)) {
        out.push(new Paragraph({ text: line.replace(/^\s*-\s+/, ''), bullet: { level: 0 } }))
      } else {
        out.push(new Paragraph({ children: [new TextRun(line)] }))
      }
    }
  }
  return out
}

const pack = (children: Paragraph[] | (Paragraph | Table)[]): Promise<Buffer> =>
  Packer.toBuffer(new Document({ sections: [{ children }] }))

/** Every active student's parent letter, a page each, from the letter template. */
export async function lettersDocx(classId: string): Promise<Buffer> {
  const settings = getSettings()
  const cls = getClass(classId)
  if (!cls) throw new AppError('EB-0002', tr('That class no longer exists.'))
  const rows = getClassRoster(classId)
    .filter((r) => r.enrollment.status === 'active')
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName))
  const date = today()
  const children: Paragraph[] = []
  rows.forEach((r, i) => {
    const logo = logoRun()
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          ...(logo ? [logo] : []),
          new TextRun({ text: settings.schoolName, bold: true }),
          new TextRun({ text: date, break: settings.schoolName ? 1 : 0 })
        ]
      }),
      ...fillLetter(settings.letterTemplate, {
        name: r.student.preferredName?.trim() || r.student.firstName,
        guardian: r.student.guardianName,
        className: cls.name,
        grade: r.grade.letter,
        percent: r.grade.percent,
        attendanceRate: r.attendanceRate,
        teacher: settings.teacherName,
        school: settings.schoolName,
        date
      })
        .split('\n')
        .map((line) => new Paragraph({ children: [new TextRun(line)], spacing: { after: 80 } }))
    )
    if (i < rows.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
  })
  return pack(children)
}

/** Every active student's report card: grade, categories, attendance and comment. An
 * editable companion to the printed PDF, for schools that finish reports in Word. */
export async function reportCardsDocx(classId: string): Promise<Buffer> {
  const settings = getSettings()
  const cls = getClass(classId)
  if (!cls) throw new AppError('EB-0002', tr('That class no longer exists.'))
  const comments = new Map(listReportComments(classId).map((c) => [c.studentId, c.text]))
  const points = resolveReportLayout(settings.reportCard).showPoints
    ? pointSummaries(classId)
    : new Map<string, PointSummaryItem[]>()
  const rows = getClassRoster(classId)
    .filter((r) => r.enrollment.status === 'active')
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName))
  const cell = (text: string, bold = false): TableCell =>
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] })
  const children: (Paragraph | Table)[] = []
  rows.forEach((r, i) => {
    const grade = getStudentClassGrade(r.student.id, classId)
    const name = `${r.student.firstName} ${r.student.lastName}`
    const logo = logoRun(48)
    children.push(
      new Paragraph({
        children: [
          ...(logo ? [logo] : []),
          new TextRun({ text: ` ${settings.schoolName}`, bold: true })
        ]
      }),
      new Paragraph({ text: cls.name, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: tr('Student report — {date}', { date: today() }) }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cell(tr('Student'), true),
              cell(tr('Overall grade'), true),
              cell(tr('Attendance'), true)
            ]
          }),
          new TableRow({
            children: [
              cell(name),
              cell(`${pct(grade?.percent ?? null)} ${grade?.letter ?? ''}`.trim()),
              cell(pct(r.attendanceRate, 100))
            ]
          })
        ]
      }),
      ...(grade?.categoryBreakdown.length
        ? [
            new Paragraph({ text: tr('Category breakdown'), heading: HeadingLevel.HEADING_3 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: grade.categoryBreakdown.map(
                (c) => new TableRow({ children: [cell(c.categoryName), cell(pct(c.percent))] })
              )
            })
          ]
        : []),
      ...(points.get(r.student.id)?.length
        ? [
            new Paragraph({ text: tr('Class points'), heading: HeadingLevel.HEADING_3 }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: points
                .get(r.student.id)!
                .map((p) => new TableRow({ children: [cell(p.name), cell(String(p.total))] }))
            })
          ]
        : []),
      new Paragraph({ text: tr('Comment'), heading: HeadingLevel.HEADING_3 }),
      ...(comments.get(r.student.id) ?? '')
        .split('\n')
        .map((line) => new Paragraph({ children: [new TextRun(line)] }))
    )
    if (i < rows.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
  })
  return pack(children)
}

/** A newsletter (EduBoard's "# " / "- " text format) as a Word document. */
export async function newsletterDocx(text: string): Promise<Buffer> {
  const settings = getSettings()
  const logo = logoRun(48)
  return pack([
    new Paragraph({
      children: [
        ...(logo ? [logo] : []),
        new TextRun({ text: ` ${settings.schoolName}`, bold: true })
      ]
    }),
    new Paragraph({ text: tr('Newsletter'), heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: today(), color: '64748B' })] }),
    ...formattedText(text)
  ])
}

function lessonOr404(planId: string): {
  plan: NonNullable<ReturnType<typeof getLessonPlan>>
  className: string
  /** "Homework", or "Consolidation in class" for a class that allows no homework. */
  homeworkTitle: string
} {
  const plan = getLessonPlan(planId)
  if (!plan) throw new AppError('EB-0002', tr('That lesson plan no longer exists.'))
  const cls = getClass(plan.classId)
  return {
    plan,
    className: cls?.name ?? '',
    homeworkTitle: cls?.noHomework ? tr('Consolidation in class') : tr('Homework')
  }
}

const lines = (s: string | null): string[] =>
  (s ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)

/** One lesson plan as a Word document. */
export async function lessonPlanDocx(planId: string): Promise<Buffer> {
  const { plan, className, homeworkTitle } = lessonOr404(planId)
  const section = (title: string, text: string | null): Paragraph[] =>
    lines(text).length
      ? [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }),
          ...lines(text).map((l) => new Paragraph({ text: l, bullet: { level: 0 } }))
        ]
      : []
  return pack([
    new Paragraph({ text: plan.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [new TextRun({ text: `${className} · ${plan.date}`, color: '64748B' })]
    }),
    ...section(tr('Objectives'), plan.objectives),
    ...section(tr('Materials'), plan.materials),
    ...section(tr('Activities / task'), plan.activities),
    ...section(tr('Support'), plan.support),
    ...section(tr('Stretch'), plan.stretch),
    ...section(homeworkTitle, plan.homework)
  ])
}

/** A lesson plan as a starter slide deck: a title slide, the objectives, then one slide
 * per activity, then homework. Plain and editable, for the teacher to build on. */
export async function lessonPlanPptx(planId: string): Promise<Buffer> {
  const { plan, className, homeworkTitle } = lessonOr404(planId)
  const settings = getSettings()
  const accent = (settings.accentColor || '#4f46e5').replace('#', '')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  const font = /^zh/.test(uiLocale()) ? 'Microsoft YaHei' : 'Calibri'

  const title = pptx.addSlide()
  title.background = { color: accent }
  title.addText(plan.title, {
    x: 0.6,
    y: 2.3,
    w: 12,
    h: 1.4,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    fontFace: font
  })
  title.addText(`${className} · ${plan.date}`, {
    x: 0.6,
    y: 3.7,
    w: 12,
    h: 0.6,
    fontSize: 20,
    color: 'FFFFFF',
    fontFace: font
  })

  const bulletSlide = (heading: string, items: string[]): void => {
    if (!items.length) return
    const slide = pptx.addSlide()
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: accent } })
    slide.addText(heading, {
      x: 0.6,
      y: 0.4,
      w: 12,
      h: 0.9,
      fontSize: 32,
      bold: true,
      color: '0F172A',
      fontFace: font
    })
    slide.addText(
      items.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
      {
        x: 0.8,
        y: 1.5,
        w: 11.6,
        h: 5.3,
        fontSize: 24,
        color: '334155',
        valign: 'top',
        fontFace: font
      }
    )
  }
  bulletSlide(tr('Objectives'), lines(plan.objectives))
  bulletSlide(tr('Materials'), lines(plan.materials))
  // One slide per activity step, so each can be built out on its own.
  for (const step of lines(plan.activities)) {
    const [head, ...rest] = step.split(/:\s+/)
    bulletSlide(rest.length ? head : tr('Activity'), rest.length ? [rest.join(': ')] : [step])
  }
  bulletSlide(homeworkTitle, lines(plan.homework))

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}


/** A printable/editable student worksheet from one Resource. Teacher-approved study
 * material is used; unapproved AI drafts are deliberately left out. */
export async function resourceWorksheetDocx(resourceId: string): Promise<Buffer> {
  const resource = getLessonResource(resourceId)
  if (!resource) throw new AppError('EB-0002', tr('That resource no longer exists.'))

  const cards =
    resource.aiApproved?.flashcards && resource.flashcards?.length ? resource.flashcards : []
  const quiz =
    resource.aiApproved?.practiceQuiz && resource.practiceQuiz?.length
      ? resource.practiceQuiz
      : []
  const guide =
    resource.aiApproved?.studyGuide && resource.studyGuide ? resource.studyGuide : null

  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: resource.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [new TextRun({ text: tr('Offline worksheet'), color: '64748B' })]
    })
  ]

  if (resource.notes?.trim()) {
    children.push(
      new Paragraph({ text: tr('Instructions / notes'), heading: HeadingLevel.HEADING_2 }),
      ...formattedText(resource.notes)
    )
  }
  if (guide) {
    children.push(
      new Paragraph({ text: tr('Study notes'), heading: HeadingLevel.HEADING_2 }),
      ...formattedText(guide)
    )
  }
  if (cards.length) {
    children.push(new Paragraph({ text: tr('Key terms / prompts'), heading: HeadingLevel.HEADING_2 }))
    cards.forEach((card, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. ${card.front}`, bold: true }),
            new TextRun({ text: '\n____________________________________________________________' })
          ],
          spacing: { after: 160 }
        })
      )
    })
  }
  if (quiz.length) {
    children.push(new Paragraph({ text: tr('Practice questions'), heading: HeadingLevel.HEADING_2 }))
    quiz.forEach((question, i) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${i + 1}. ${question.question}`, bold: true })],
          spacing: { before: 120, after: 60 }
        })
      )
      question.options.forEach((option) =>
        children.push(new Paragraph({ text: `○ ${option}`, indent: { left: 360 } }))
      )
    })
  }

  if (cards.length || quiz.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }))
    children.push(new Paragraph({ text: tr('Answer key'), heading: HeadingLevel.HEADING_1 }))
    cards.forEach((card, i) =>
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. ${card.front}: `, bold: true }),
            new TextRun({ text: card.back })
          ]
        })
      )
    )
    quiz.forEach((question, i) => {
      const answer = question.options[question.answerIndex] ?? ''
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Q${i + 1}: ${answer}`, bold: true }),
            new TextRun({ text: question.explanation ? ` — ${question.explanation}` : '' })
          ]
        })
      )
    })
  }

  return pack(children)
}

/** A projector-ready PowerPoint from approved flashcards and quiz questions. The deck
 * alternates prompt/answer slides so the teacher can reveal by advancing one slide. */
export async function resourcePracticePptx(resourceId: string): Promise<Buffer> {
  const resource = getLessonResource(resourceId)
  if (!resource) throw new AppError('EB-0002', tr('That resource no longer exists.'))
  const settings = getSettings()
  const accent = (settings.accentColor || '#4f46e5').replace('#', '')
  const font = /^zh/.test(uiLocale()) ? 'Microsoft YaHei' : 'Calibri'
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  let contentSlides = 0

  const addSlide = (heading: string, body: string, answer = false): void => {
    contentSlides++
    const slide = pptx.addSlide()
    if (answer) slide.background = { color: 'F8FAFC' }
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.16, fill: { color: accent } })
    slide.addText(heading, {
      x: 0.65,
      y: 0.45,
      w: 12,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: answer ? accent : '64748B',
      fontFace: font
    })
    slide.addText(body || '—', {
      x: 0.9,
      y: 1.5,
      w: 11.5,
      h: 4.8,
      fontSize: body.length > 220 ? 26 : 34,
      bold: !answer,
      color: '0F172A',
      valign: 'mid',
      align: 'center',
      margin: 0.1,
      fontFace: font
    })
  }

  const title = pptx.addSlide()
  title.background = { color: accent }
  title.addText(resource.title, {
    x: 0.7,
    y: 2.35,
    w: 11.9,
    h: 1.2,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: font
  })
  title.addText(tr('Offline practice deck'), {
    x: 0.7,
    y: 3.65,
    w: 11.9,
    h: 0.5,
    fontSize: 18,
    color: 'FFFFFF',
    align: 'center',
    fontFace: font
  })

  if (resource.aiApproved?.studyGuide && resource.studyGuide) {
    addSlide(tr('Study notes'), resource.studyGuide, true)
  }
  if (resource.aiApproved?.flashcards) {
    for (const [i, card] of (resource.flashcards ?? []).entries()) {
      addSlide(tr('Card {n}', { n: i + 1 }), card.front)
      addSlide(tr('Answer'), card.back, true)
    }
  }
  if (resource.aiApproved?.practiceQuiz) {
    for (const [i, question] of (resource.practiceQuiz ?? []).entries()) {
      const body = [
        question.question,
        '',
        ...question.options.map((option, optionIndex) =>
          `${String.fromCharCode(65 + optionIndex)}. ${option}`
        )
      ].join('\n')
      addSlide(tr('Question {n}', { n: i + 1 }), body)
      addSlide(
        tr('Answer'),
        `${question.options[question.answerIndex] ?? ''}${question.explanation ? `\n\n${question.explanation}` : ''}`,
        true
      )
    }
  }

  if (contentSlides === 0 && resource.notes?.trim()) {
    addSlide(tr('Notes'), resource.notes, true)
  }

  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}

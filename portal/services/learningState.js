// What a student is finding hard, for the Study Helper: the review cards they keep
// missing, quick-check questions they got wrong, and their own goal for this week. With
// it, quiz mode asks about what they're shaky on and help mode pitches at their level,
// instead of treating every student the same.
//
// It's the student's own data, used only for their own Study Helper, and it names nobody.
// Card and question text comes from class materials (a PDF or web page from anywhere) and
// the goal is the student's own words, so all of it goes to the model as data inside a
// <learning_state> block, never into its instructions (see services/studyHelper.js).
const db = require('../db')
const review = require('./review')

const MAX_WEAK_ITEMS = 6
const MAX_MISSED_CHECKS = 5
const MAX_TEXT = 160

const short = (text) => {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t
}

/** Monday of the week containing a YYYY-MM-DD date. */
function mondayOf(date) {
  const d = new Date(date + 'T00:00:00Z')
  return review.addDays(date, -((d.getUTCDay() + 6) % 7))
}

/**
 * @returns {{
 *   weakItems: {text: string, from: string, wrong: number}[],
 *   missedChecks: {text: string, from: string}[],
 *   weekGoal: string,
 *   reviewed: number,
 *   learned: number
 * }}
 */
function learningStateFor(studentId, today) {
  // Review cards: missed at least once and not yet back above box 2, most-missed first.
  const items = new Map(
    review.itemsForStudent(studentId).map((i) => [`${i.materialId}|${i.kind}|${i.key}`, i])
  )
  const states = db.prepare('SELECT * FROM review_items WHERE student_id = ?').all(studentId)
  const current = states.filter((s) => items.has(`${s.material_id}|${s.kind}|${s.item_key}`))
  const weakItems = current
    .filter((s) => s.times_wrong > 0 && s.box <= 2)
    .sort((a, b) => b.times_wrong - a.times_wrong || a.box - b.box)
    .slice(0, MAX_WEAK_ITEMS)
    .map((s) => {
      const item = items.get(`${s.material_id}|${s.kind}|${s.item_key}`)
      const text = item.kind === 'card' ? item.card.front : item.question.question
      return { text: short(text), from: short(item.materialTitle), wrong: s.times_wrong }
    })

  // Quick-check questions on homework in their current classes that they got wrong.
  const missedChecks = db
    .prepare(
      `SELECT q.prompt, h.title
       FROM homework_question_answers a
       JOIN homework_questions q ON q.id = a.homework_question_id
       JOIN homework_assignments h ON h.id = q.homework_assignment_id
       JOIN enrollments e ON e.class_id = h.class_id AND e.student_id = a.student_id
       WHERE a.student_id = ? AND a.correct = 0 AND e.status = 'active'
       ORDER BY h.due_date DESC, q.sort_order
       LIMIT ?`
    )
    .all(studentId, MAX_MISSED_CHECKS)
    .map((r) => ({ text: short(r.prompt), from: short(r.title) }))

  const goalRow = db
    .prepare('SELECT goal FROM study_goals WHERE student_id = ? AND week_start = ?')
    .get(studentId, mondayOf(today))

  return {
    weakItems,
    missedChecks,
    weekGoal: short(goalRow?.goal),
    reviewed: current.length,
    learned: current.filter((s) => s.box >= 4).length
  }
}

/** The state as the text of a <learning_state> block, or '' when there's nothing to say. */
function learningStateText(state) {
  const lines = []
  if (state.weekGoal) lines.push(`Their own goal this week: ${state.weekGoal}`)
  if (state.reviewed) {
    lines.push(`Spaced review: ${state.reviewed} cards practised, ${state.learned} well learned.`)
  }
  if (state.weakItems.length) {
    lines.push('Review cards they keep missing:')
    for (const i of state.weakItems) {
      lines.push(`- "${i.text}" (from ${i.from}; missed ${i.wrong}×)`)
    }
  }
  if (state.missedChecks.length) {
    lines.push('Homework quick-check questions they got wrong:')
    for (const c of state.missedChecks) lines.push(`- "${c.text}" (in ${c.from})`)
  }
  return lines.join('\n')
}

module.exports = { learningStateFor, learningStateText, mondayOf }

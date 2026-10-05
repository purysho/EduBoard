// Spaced review: the teacher's flashcards and practice-quiz questions come back to each
// student just as they're about to be forgotten.
//
// It's the Leitner box system, simple enough to explain to a student: every card starts
// in box 1. Get it right and it moves up a box, and each box waits longer before it's due
// again (1, 2, 4, 8, then 16 days). Get it wrong and it goes back to box 1, due tomorrow.
// Each day's review mixes cards from different classes and materials (interleaving),
// which is harder than doing one set at a time but sticks better.
//
// A card is recognised by its text, not its position, so a teacher regenerating or
// reordering a set keeps each student's progress on the cards that stayed the same.
const crypto = require('crypto')
const db = require('../db')

/** Days until an item in each box is due again (index = box). */
const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16]
const TOP_BOX = INTERVAL_DAYS.length - 1
/** At most this many never-seen items join one day's review, so it stays short. */
const NEW_PER_DAY = 10
const MAX_PER_SESSION = 30

const itemKey = (text) =>
  crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16)

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

function addDays(date, days) {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The student's own date (their phone's), when it's within a day of the server's: a
 * student in another time zone reviews on their own day, but can't jump ahead. */
function studentToday(clientDate, now = new Date()) {
  const server = now.toISOString().slice(0, 10)
  if (!isDate(clientDate)) return server
  return [addDays(server, -1), server, addDays(server, 1)].includes(clientDate)
    ? clientDate
    : server
}

/** Where an item goes after an answer. */
function nextState(box, correct, today) {
  const next = correct ? Math.min(TOP_BOX, (box || 1) + 1) : 1
  return { box: next, dueOn: addDays(today, INTERVAL_DAYS[next]) }
}

/** Every reviewable item in the student's current classes, from approved materials. */
function itemsForStudent(studentId) {
  const rows = db
    .prepare(
      `SELECT m.id, m.title, m.flashcards, m.practice_quiz, c.name AS class_name
       FROM materials m
       JOIN classes c ON c.id = m.class_id
       JOIN enrollments e ON e.class_id = m.class_id AND e.student_id = ? AND e.status = 'active'
       WHERE (c.finished IS NULL OR c.finished = 0)`
    )
    .all(studentId)
  const items = []
  for (const m of rows) {
    const from = { materialId: m.id, materialTitle: m.title, className: m.class_name }
    for (const card of m.flashcards ? JSON.parse(m.flashcards) : []) {
      items.push({ ...from, kind: 'card', key: itemKey(card.front), card })
    }
    for (const q of m.practice_quiz ? JSON.parse(m.practice_quiz) : []) {
      items.push({ ...from, kind: 'question', key: itemKey(q.question), question: q })
    }
  }
  return items
}

const idOf = (i) => `${i.materialId}|${i.kind}|${i.key}`

/** Takes items from each material in turn, so one day's review mixes topics. */
function interleave(items) {
  const byMaterial = new Map()
  for (const item of items) {
    if (!byMaterial.has(item.materialId)) byMaterial.set(item.materialId, [])
    byMaterial.get(item.materialId).push(item)
  }
  const queues = [...byMaterial.values()]
  const out = []
  while (queues.some((q) => q.length)) {
    for (const q of queues) if (q.length) out.push(q.shift())
  }
  return out
}

function statesFor(studentId) {
  const states = new Map()
  for (const r of db.prepare('SELECT * FROM review_items WHERE student_id = ?').all(studentId)) {
    states.set(`${r.material_id}|${r.kind}|${r.item_key}`, r)
  }
  return states
}

/** Today's review for one student: what's due, then a few new items, mixed together,
 * plus how their cards are spread across the boxes. */
function todaysReview(studentId, today) {
  const items = itemsForStudent(studentId)
  const states = statesFor(studentId)
  const due = []
  const fresh = []
  const boxes = [0, 0, 0, 0, 0, 0]
  let nextDueOn = null
  for (const item of items) {
    const state = states.get(idOf(item))
    if (!state) {
      fresh.push(item)
      continue
    }
    boxes[state.box]++
    if (state.due_on <= today) due.push({ ...item, box: state.box })
    else if (!nextDueOn || state.due_on < nextDueOn) nextDueOn = state.due_on
  }
  // Oldest-due first within the due pile, then mixed across materials.
  due.sort((a, b) => a.box - b.box)
  const newToday = interleave(fresh).slice(0, NEW_PER_DAY)
  const session = interleave(due)
    .concat(newToday.map((i) => ({ ...i, box: 0 })))
    .slice(0, MAX_PER_SESSION)
  return {
    today,
    items: session,
    dueCount: due.length,
    newCount: fresh.length,
    total: items.length,
    boxes: boxes.slice(1),
    nextDueOn
  }
}

/** How many cards come up for review on each of the next `days` days (anything overdue,
 * and today's new cards, count today), for the student's week plan and calendar. */
function reviewSchedule(studentId, today, days = 7) {
  const items = itemsForStudent(studentId)
  const states = statesFor(studentId)
  const counts = new Map()
  let fresh = 0
  for (const item of items) {
    const state = states.get(idOf(item))
    if (!state) {
      fresh++
      continue
    }
    const day = state.due_on < today ? today : state.due_on
    counts.set(day, (counts.get(day) || 0) + 1)
  }
  counts.set(today, (counts.get(today) || 0) + Math.min(fresh, NEW_PER_DAY))
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i)
    return { date, count: Math.min(counts.get(date) || 0, i === 0 ? MAX_PER_SESSION : Infinity) }
  })
}

/** Records one answer. Returns the item's new box and due date, or null when it isn't
 * one of this student's items (a material since removed, or not their class). */
function recordAnswer(studentId, { materialId, kind, key, correct }, today) {
  const item = itemsForStudent(studentId).find(
    (i) => i.materialId === materialId && i.kind === kind && i.key === key
  )
  if (!item) return null
  const prev = db
    .prepare(
      'SELECT box FROM review_items WHERE student_id = ? AND material_id = ? AND kind = ? AND item_key = ?'
    )
    .get(studentId, materialId, kind, key)
  const next = nextState(prev?.box, correct === true, today)
  db.prepare(
    `INSERT INTO review_items (student_id, material_id, kind, item_key, box, due_on,
       times_right, times_wrong, last_answered_at)
     VALUES (@studentId, @materialId, @kind, @key, @box, @dueOn, @right, @wrong, @now)
     ON CONFLICT(student_id, material_id, kind, item_key) DO UPDATE SET
       box = @box, due_on = @dueOn, times_right = times_right + @right,
       times_wrong = times_wrong + @wrong, last_answered_at = @now`
  ).run({
    studentId,
    materialId,
    kind,
    key,
    box: next.box,
    dueOn: next.dueOn,
    right: correct === true ? 1 : 0,
    wrong: correct === true ? 0 : 1,
    now: new Date().toISOString()
  })
  return next
}

/** For the teacher: per material, how many students review it and which items they
 * miss most, so they know what to re-teach. Items still in the current set only. */
function teacherReviewStats(teacherId) {
  const materials = db
    .prepare(
      `SELECT m.id, m.title, m.flashcards, m.practice_quiz FROM materials m
       JOIN classes c ON c.id = m.class_id WHERE c.teacher_id = ?`
    )
    .all(teacherId)
  const out = []
  for (const m of materials) {
    const texts = new Map()
    for (const card of m.flashcards ? JSON.parse(m.flashcards) : []) {
      texts.set(`card|${itemKey(card.front)}`, card.front)
    }
    for (const q of m.practice_quiz ? JSON.parse(m.practice_quiz) : []) {
      texts.set(`question|${itemKey(q.question)}`, q.question)
    }
    const rows = db
      .prepare(
        `SELECT kind, item_key, COUNT(*) AS students, SUM(times_right) AS right,
           SUM(times_wrong) AS wrong, SUM(box >= 4) AS learned
         FROM review_items WHERE material_id = ? GROUP BY kind, item_key`
      )
      .all(m.id)
      .filter((r) => texts.has(`${r.kind}|${r.item_key}`))
    if (!rows.length) continue
    const reviewers = db
      .prepare('SELECT COUNT(DISTINCT student_id) AS n FROM review_items WHERE material_id = ?')
      .get(m.id).n
    out.push({
      materialId: m.id,
      title: m.title,
      students: reviewers,
      items: rows
        .map((r) => ({
          kind: r.kind,
          text: texts.get(`${r.kind}|${r.item_key}`),
          students: r.students,
          right: r.right,
          wrong: r.wrong,
          learned: r.learned
        }))
        .sort((a, b) => b.wrong / (b.right + b.wrong) - a.wrong / (a.right + a.wrong))
    })
  }
  return out
}

module.exports = {
  INTERVAL_DAYS,
  addDays,
  reviewSchedule,
  itemKey,
  studentToday,
  nextState,
  interleave,
  itemsForStudent,
  todaysReview,
  recordAnswer,
  teacherReviewStats
}

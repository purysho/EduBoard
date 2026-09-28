// How much this Portal is used, for the admin page: who is signed up, and who did
// something each week. Worked out only from what the Portal already stores for its own
// features (read receipts, replies, messages, handed-in work, report cards opened), so
// nothing extra about anyone is recorded to produce it. A family that only looked at
// grades without doing anything else isn't counted: the Portal keeps no visit log.
const db = require('../db')
const { weekOf } = require('../routes/usage')
const { DEMO_TEACHER_ID } = require('./demo')

const addWeeks = (week, n) => {
  const d = new Date(`${week}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7 * n)
  return d.toISOString().slice(0, 10)
}
const ratio = (part, whole) => (whole ? part / whole : null)
const count = (sql, ...args) => db.prepare(sql).get(...args).n

function adoptionSummary(weeks = 12, now = new Date()) {
  const thisWeek = weekOf(now)
  const from = addWeeks(thisWeek, -(weeks - 1))

  // Families: an account that saw a Class Story post, opened a report card, answered a
  // notice, sent a message, handed in work or asked the Study Helper.
  const familyActs = db
    .prepare(
      `SELECT account_id AS who, read_at AS at FROM post_reads WHERE read_at >= @from
       UNION ALL SELECT account_id, read_at FROM report_card_reads WHERE read_at >= @from
       UNION ALL SELECT account_id, replied_at FROM post_replies WHERE replied_at >= @from
       UNION ALL SELECT account_id, created_at FROM messages
         WHERE sender = 'family' AND created_at >= @from
       UNION ALL SELECT account_id, created_at FROM ai_interactions WHERE created_at >= @from
       UNION ALL SELECT a.account_id, h.submitted_at FROM homework_submissions h
         JOIN account_students a ON a.student_id = h.student_id
         WHERE h.submitted_at >= @from`
    )
    .all({ from })
  // Teachers: posted to Class Story, sent report cards, marked handed-in work, or
  // messaged a family. (Publishing itself isn't dated, so a teacher who only publishes
  // grades isn't counted.)
  const teacherActs = db
    .prepare(
      `SELECT c.teacher_id AS who, p.created_at AS at FROM class_posts p
         JOIN classes c ON c.id = p.class_id WHERE p.created_at >= @from
       UNION ALL SELECT c.teacher_id, r.published_at FROM report_cards r
         JOIN classes c ON c.id = r.class_id WHERE r.published_at >= @from
       UNION ALL SELECT c.teacher_id, h.graded_at FROM homework_submissions h
         JOIN homework_assignments ha ON ha.id = h.homework_assignment_id
         JOIN classes c ON c.id = ha.class_id WHERE h.graded_at >= @from
       UNION ALL SELECT DISTINCT s.teacher_id, m.created_at FROM messages m
         JOIN account_students a ON a.account_id = m.account_id
         JOIN students s ON s.id = a.student_id
         WHERE m.sender = 'teacher' AND m.created_at >= @from`
    )
    .all({ from })

  // The public demo login and its teacher are left out of every number.
  const demoAccount = db
    .prepare(
      `SELECT a.account_id AS id FROM account_students a JOIN students s ON s.id = a.student_id
       WHERE s.teacher_id = ?`
    )
    .all(DEMO_TEACHER_ID)
    .map((r) => r.id)
  const excluded = new Set([DEMO_TEACHER_ID, ...demoAccount])
  const byWeek = (acts) => {
    const map = new Map()
    for (const { who, at } of acts) {
      if (!who || !at || excluded.has(who)) continue
      const w = weekOf(new Date(at))
      if (!map.has(w)) map.set(w, new Set())
      map.get(w).add(who)
    }
    return map
  }
  const families = byWeek(familyActs)
  const teachers = byWeek(teacherActs)
  const list = []
  for (let w = from; w <= thisWeek; w = addWeeks(w, 1)) {
    list.push({
      week: w,
      families: families.get(w)?.size ?? 0,
      teachers: teachers.get(w)?.size ?? 0
    })
  }

  // Now: sign-ups, and how families respond to what teachers send.
  const students = count(
    'SELECT COUNT(*) AS n FROM students WHERE teacher_id IS NOT ?',
    DEMO_TEACHER_ID
  )
  const studentsWithLogin = count(
    `SELECT COUNT(DISTINCT a.student_id) AS n FROM account_students a
     JOIN students s ON s.id = a.student_id WHERE s.teacher_id IS NOT ?`,
    DEMO_TEACHER_ID
  )
  const notDemoAccount = `id NOT IN (${demoAccount.map(() => '?').join(',') || "''"})`
  const accounts = count(
    `SELECT COUNT(*) AS n FROM accounts WHERE ${notDemoAccount}`,
    ...demoAccount
  )
  const accountsAgreed = count(
    `SELECT COUNT(*) AS n FROM accounts WHERE consent_version = ? AND ${notDemoAccount}`,
    require('./consent').CONSENT_VERSION,
    ...demoAccount
  )
  const accountsWithEmail = count(
    `SELECT COUNT(*) AS n FROM accounts WHERE email IS NOT NULL AND email != '' AND ${notDemoAccount}`,
    ...demoAccount
  )
  // Report cards a family could open (the student has a login), and how many were opened.
  const reportCards = count(
    `SELECT COUNT(*) AS n FROM report_cards r JOIN classes c ON c.id = r.class_id
     WHERE c.teacher_id IS NOT ?
       AND EXISTS (SELECT 1 FROM account_students a WHERE a.student_id = r.student_id)`,
    DEMO_TEACHER_ID
  )
  const reportCardsOpened = count(
    `SELECT COUNT(*) AS n FROM report_cards r JOIN classes c ON c.id = r.class_id
     WHERE c.teacher_id IS NOT ? AND EXISTS (
       SELECT 1 FROM report_card_reads x JOIN account_students a
         ON a.account_id = x.account_id AND a.student_id = r.student_id
       WHERE x.report_card_id = r.id)`,
    DEMO_TEACHER_ID
  )
  // Notices with a reply slip: of the students with a login in the class, how many
  // families replied.
  const slip = db
    .prepare(
      `SELECT COUNT(*) AS expected,
         SUM(EXISTS (SELECT 1 FROM post_replies r WHERE r.post_id = p.id AND r.student_id = e.student_id)) AS replied
       FROM class_posts p
       JOIN enrollments e ON e.class_id = p.class_id AND e.status = 'active'
       WHERE p.reply_kind IS NOT NULL
         AND p.class_id NOT IN (SELECT id FROM classes WHERE teacher_id = ?)
         AND EXISTS (SELECT 1 FROM account_students a WHERE a.student_id = e.student_id)`
    )
    .get(DEMO_TEACHER_ID)
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString()
  const notDemoClass = 'class_id NOT IN (SELECT id FROM classes WHERE teacher_id = ?)'
  const posts30 = count(
    `SELECT COUNT(*) AS n FROM class_posts WHERE created_at >= ? AND ${notDemoClass}`,
    since30,
    DEMO_TEACHER_ID
  )
  const seen = db
    .prepare(
      `SELECT COUNT(*) AS audience,
         SUM(EXISTS (SELECT 1 FROM post_reads r JOIN account_students a2
                       ON a2.account_id = r.account_id AND a2.student_id = e.student_id
                     WHERE r.post_id = p.id)) AS seen
       FROM class_posts p
       JOIN enrollments e ON e.class_id = p.class_id AND e.status = 'active'
       WHERE p.created_at >= ? AND p.${notDemoClass}
         AND EXISTS (SELECT 1 FROM account_students a WHERE a.student_id = e.student_id)`
    )
    .get(since30, DEMO_TEACHER_ID)
  const handedIn30 = count(
    `SELECT COUNT(*) AS n FROM homework_submissions h JOIN students s ON s.id = h.student_id
     WHERE h.submitted_at >= ? AND s.teacher_id IS NOT ?`,
    since30,
    DEMO_TEACHER_ID
  )

  return {
    generatedAt: now.toISOString(),
    totals: {
      teachers: count('SELECT COUNT(*) AS n FROM teachers WHERE id != ?', DEMO_TEACHER_ID),
      teachersPublishing: count(
        'SELECT COUNT(DISTINCT teacher_id) AS n FROM classes WHERE teacher_id != ?',
        DEMO_TEACHER_ID
      ),
      classes: count(
        'SELECT COUNT(*) AS n FROM classes WHERE finished = 0 AND teacher_id != ?',
        DEMO_TEACHER_ID
      ),
      students,
      studentsWithLogin,
      loginShare: ratio(studentsWithLogin, students),
      accounts,
      emailShare: ratio(accountsWithEmail, accounts),
      consentShare: ratio(accountsAgreed, accounts),
      reportCards,
      reportCardsOpenedShare: ratio(reportCardsOpened, reportCards),
      replySlipExpected: slip.expected || 0,
      replySlipShare: ratio(slip.replied || 0, slip.expected || 0),
      posts30,
      postsSeenShare30: ratio(seen.seen || 0, seen.audience || 0),
      handedIn30
    },
    weeks: list
  }
}

module.exports = { adoptionSummary }

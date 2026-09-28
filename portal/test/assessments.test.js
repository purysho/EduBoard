const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const assessments = [
  {
    id: 'a1',
    classId: 'c1',
    name: 'Quiz 1',
    category: 'Quizzes',
    date: '2026-09-10',
    maxScore: 20,
    classAverage: 71.5
  },
  {
    id: 'a2',
    classId: 'c1',
    name: 'Essay',
    category: null,
    date: '2026-09-20',
    maxScore: 12,
    classAverage: null
  }
]
const scores = [
  {
    assessmentId: 'a1',
    studentId: 's1',
    points: 17,
    excused: false,
    late: true,
    comment: null,
    rubric: null
  },
  {
    assessmentId: 'a2',
    studentId: 's1',
    points: 11,
    excused: false,
    late: false,
    comment: 'Lovely ending.',
    rubric: [{ criterion: 'Ideas', level: 'Excellent', points: 4, maxPoints: 4 }]
  }
]

test("a family sees each marked assessment with the student's own score", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, {
    payload: classPayload({ extra: { assessments, assessmentScores: scores } })
  })
  const me = await portal.call('GET', '/api/me', { cookie })
  const list = me.json.students[0].classes[0].assessments
  assert.deepEqual(
    list.map((a) => [a.name, a.points, a.maxScore, a.late]),
    [
      ['Quiz 1', 17, 20, true],
      ['Essay', 11, 12, false]
    ]
  )
  assert.equal(list[0].classAverage, 71.5)
  assert.equal(list[0].category, 'Quizzes')
  assert.equal(list[1].comment, 'Lovely ending.')
  assert.deepEqual(list[1].rubric, [
    { criterion: 'Ideas', level: 'Excellent', points: 4, maxPoints: 4 }
  ])

  // In Download my data too.
  const data = (await portal.call('GET', '/api/me/export', { cookie })).json
  assert.equal(data.children[0].classes[0].assessments.length, 2)

  // A publish without them (the teacher turned it off) removes them.
  await portal.sync('', classPayload())
  const after = await portal.call('GET', '/api/me', { cookie })
  assert.deepEqual(after.json.students[0].classes[0].assessments, [])
})

test('a publish only writes scores for its own classes and roster', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, {
    payload: classPayload({
      extra: {
        assessments: [
          ...assessments,
          // Not a class in this publish, and nonsense values: dropped.
          { id: 'x1', classId: 'elsewhere', name: 'Other', maxScore: 10 },
          { id: 'x2', classId: 'c1', name: 'No maximum', maxScore: 0 }
        ],
        assessmentScores: [
          ...scores,
          { assessmentId: 'a1', studentId: 'not-in-roster', points: 1 },
          { assessmentId: 'x1', studentId: 's1', points: 10 },
          { assessmentId: 'x2', studentId: 's1', points: 10 }
        ]
      }
    })
  })
  const list = (await portal.call('GET', '/api/me', { cookie })).json.students[0].classes[0]
    .assessments
  assert.deepEqual(
    list.map((a) => a.name),
    ['Quiz 1', 'Essay']
  )

  // Another teacher can't attach scores to this teacher's assessment by reusing its id.
  const other = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name: 'Other teacher' }
  })
  const theirs = classPayload({
    classId: 'c2',
    studentId: 's2',
    invite: 'INV2',
    extra: {
      assessments: [{ id: 'a1', classId: 'c2', name: 'Hijack', maxScore: 20 }],
      assessmentScores: [{ assessmentId: 'a1', studentId: 's2', points: 20 }]
    }
  })
  assert.equal((await portal.sync('', theirs, other.json.syncSecret)).status, 200)
  const still = (await portal.call('GET', '/api/me', { cookie })).json.students[0].classes[0]
    .assessments
  assert.equal(still[0].name, 'Quiz 1')
  assert.equal(still[0].points, 17)
})

test('removing a student removes their scores', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  await makeStudentAccount(portal, {
    payload: classPayload({ extra: { assessments, assessmentScores: scores } })
  })
  assert.equal((await portal.sync('/delete-student', { studentId: 's1' })).status, 200)
  const Database = require('better-sqlite3')
  const db = new Database(require('path').join(portal.dataDir, 'portal.db'), { readonly: true })
  t.after(() => db.close())
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_scores').get().n, 0)
})

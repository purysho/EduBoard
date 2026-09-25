const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const b64 = (s) => Buffer.from(s).toString('base64')

async function addTeacher(portal, name) {
  const res = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name }
  })
  return res.json.syncSecret
}

test('the full family path works: publish, redeem, dashboard, attachment, quick check', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const homework = {
    id: 'h1',
    classId: 'c1',
    title: 'Worksheet',
    fileName: 'ws.txt',
    fileData: b64('attachment body'),
    questions: [{ type: 'short_answer', prompt: '2+2', correctAnswer: '4', points: 1 }]
  }
  const payload = classPayload({ extra: { homeworkAssignments: [homework] } })
  const { cookie } = await makeStudentAccount(portal, { payload })

  const me = await portal.call('GET', '/api/me', { cookie })
  const cls = me.json.students[0].classes[0]
  assert.equal(cls.name, 'Biology 101')
  assert.equal(cls.homework[0].title, 'Worksheet')
  assert.ok(!('correctAnswer' in cls.homework[0].questions[0]), 'answers never reach the browser')

  const file = await portal.call('GET', '/api/me/homework/h1/file', { cookie })
  assert.equal(file.text, 'attachment body')

  const qid = cls.homework[0].questions[0].id
  const graded = await portal.call('POST', '/api/me/homework/h1/answers', {
    cookie,
    body: { studentId: 's1', answers: { [qid]: ' 4 ' } }
  })
  assert.equal(graded.json.grade, '1/1')
})

test("one teacher's publish never deletes another teacher's attachments", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const secretB = await addTeacher(portal, 'B')
  const hw = (id, classId, name) => ({ id, classId, title: id, fileName: name, fileData: b64(id) })

  await portal.sync('', {
    classes: [{ id: 'cA', name: 'A', levelType: 'university' }],
    homeworkAssignments: [hw('hA', 'cA', 'a.txt')]
  })
  await portal.sync(
    '',
    {
      classes: [{ id: 'cB', name: 'B', levelType: 'university' }],
      homeworkAssignments: [hw('hB', 'cB', 'b.txt')]
    },
    secretB
  )
  const uploads = fs.readdirSync(path.join(portal.dataDir, 'homework-uploads')).sort()
  assert.deepEqual(uploads, ['hA-a.txt', 'hB-b.txt'])

  // Teacher A dropping their assignment removes only their own file.
  await portal.sync('', { classes: [{ id: 'cA', name: 'A', levelType: 'university' }] })
  assert.deepEqual(fs.readdirSync(path.join(portal.dataDir, 'homework-uploads')), ['hB-b.txt'])
})

test("a teacher's sync secret cannot write into another teacher's class", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const secretB = await addTeacher(portal, 'B')
  const { cookie } = await makeStudentAccount(portal)
  await portal.sync(
    '',
    {
      classes: [{ id: 'cB', name: 'B', levelType: 'university' }],
      homeworkAssignments: [{ id: 'hEvil', classId: 'c1', title: 'Injected' }],
      grades: [{ studentId: 's1', classId: 'c1', percent: 0 }]
    },
    secretB
  )
  const cls = (await portal.call('GET', '/api/me', { cookie })).json.students[0].classes[0]
  assert.equal(cls.homework.length, 0)
  assert.equal(cls.percent, 91)
})

test('a material still shared to an archived class never breaks later publishes', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const material = { id: 'm1', classId: 'c2', title: 'Cells', chunks: ['mitochondria'] }
  const c1 = { id: 'c1', name: 'One', levelType: 'university' }
  const c2 = { id: 'c2', name: 'Two', levelType: 'university' }

  assert.equal((await portal.sync('', { classes: [c1, c2], materials: [material] })).status, 200)
  // c2 archived: the desktop stops sending the class but still sends the material.
  for (let i = 0; i < 3; i++) {
    assert.equal((await portal.sync('', { classes: [c1], materials: [material] })).status, 200)
  }
  // Un-archived again.
  assert.equal((await portal.sync('', { classes: [c1, c2], materials: [material] })).status, 200)
})

test('"send digest now" responds instead of crashing', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const res = await portal.sync('/digest/send-now', {})
  assert.equal(res.status, 200)
  assert.deepEqual(res.json, { sent: 0, total: 0, errors: [] })
})

test('homework shows Late/Missing using the time zone the teacher published', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const day = (offsetDays) =>
    new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
  const payload = classPayload({
    extra: {
      timeZone: 'Asia/Shanghai',
      homeworkAssignments: [
        { id: 'past-missing', classId: 'c1', title: 'Old', dueDate: day(-3) },
        { id: 'past-late', classId: 'c1', title: 'Late one', dueDate: day(-3) },
        { id: 'future', classId: 'c1', title: 'Upcoming', dueDate: day(3) }
      ]
    }
  })
  const { cookie } = await makeStudentAccount(portal, { payload })
  await portal.call('POST', '/api/me/homework/past-late/submit', {
    cookie,
    body: { studentId: 's1', textAnswer: 'sorry this is late' }
  })
  await portal.call('POST', '/api/me/homework/future/submit', {
    cookie,
    body: { studentId: 's1', textAnswer: 'early' }
  })
  const hw = (await portal.call('GET', '/api/me', { cookie })).json.students[0].classes[0].homework
  const timing = Object.fromEntries(hw.map((h) => [h.id, h.timing]))
  assert.deepEqual(timing, { 'past-missing': 'missing', 'past-late': 'late', future: 'on_time' })

  // A junk time zone from a buggy client is ignored rather than stored.
  const bad = await portal.sync('', { ...payload, timeZone: 'Not/AZone' })
  assert.equal(bad.status, 200)
})

test('flashcards and practice quizzes reach students only if they pass validation', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const cards = Array.from({ length: 5 }, (_, i) => ({ front: `Term ${i}`, back: `Meaning ${i}` }))
  const q = {
    question: 'Which organelle?',
    options: ['Nucleus', 'Mitochondria'],
    answerIndex: 1,
    explanation: 'Energy.'
  }
  const payload = classPayload({
    extra: {
      materials: [
        {
          id: 'good',
          classId: 'c1',
          title: 'Cells',
          chunks: ['x'],
          flashcards: cards,
          practiceQuiz: [q, q, q]
        },
        // A tampered or buggy client: out-of-range answer, not enough cards.
        {
          id: 'bad',
          classId: 'c1',
          title: 'Broken',
          chunks: ['x'],
          flashcards: cards.slice(0, 2),
          practiceQuiz: [{ ...q, answerIndex: 9 }, q, q]
        }
      ]
    }
  })
  const { cookie } = await makeStudentAccount(portal, { payload })
  const materials = (await portal.call('GET', '/api/me/materials', { cookie })).json
  const byId = Object.fromEntries(materials.map((m) => [m.id, m]))
  assert.equal(byId.good.flashcards.length, 5)
  assert.equal(byId.good.practiceQuiz[0].answerIndex, 1)
  assert.equal(byId.bad.flashcards, null)
  assert.equal(byId.bad.practiceQuiz, null)
  assert.equal(byId.bad.title, 'Broken', 'the material itself still publishes')
})

test('submissions are checked by content: disguised programs and macro files are refused', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const payload = classPayload({
    extra: { homeworkAssignments: [{ id: 'h1', classId: 'c1', title: 'Essay' }] }
  })
  const { cookie } = await makeStudentAccount(portal, { payload })
  const submit = (fileName, bytes) =>
    portal.call('POST', '/api/me/homework/h1/submit', {
      cookie,
      body: { studentId: 's1', fileName, fileData: Buffer.from(bytes).toString('base64') }
    })

  const exeAsDocx = await submit('essay.docx', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64)]))
  assert.equal(exeAsDocx.status, 400)
  assert.match(exeAsDocx.json.error, /Windows program/)
  assert.equal((await submit('run.bat', '@echo off')).status, 400)
  assert.equal((await submit('essay.pdf', '<html><script>x</script>')).status, 400)

  const ok = await submit('C:\\\\Users\\\\me\\\\..\\\\essay.pdf', '%PDF-1.7 fine')
  assert.equal(ok.status, 200)
  const pulled = await portal.sync('/submissions')
  assert.equal(pulled.json[0].fileName, 'essay.pdf', 'no path survives in the stored name')
})

test("removing a teacher deletes all of their students' data and files, and nobody else's", async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const fsx = require('node:fs')
  const pathx = require('node:path')
  const sharp = require('sharp')
  const Database = require('better-sqlite3')

  // Teacher A (the default) keeps a class with a student account.
  const { cookie: aCookie } = await makeStudentAccount(portal)

  // Teacher B gets the full set: homework with a file, a submission file, a post image,
  // a material, a student account with a profile photo and messages.
  const created = await portal.call('POST', '/api/admin/teachers', {
    headers: { 'X-Admin-Secret': portal.secrets.admin },
    body: { name: 'Teacher B' }
  })
  const secretB = created.json.syncSecret
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#123456' } })
    .png()
    .toBuffer()
  await portal.sync(
    '',
    {
      classes: [{ id: 'cB', name: 'B class', levelType: 'university' }],
      students: [{ id: 'sB', firstName: 'Bea', lastName: 'Bee', dateOfBirth: null }],
      enrollments: [{ studentId: 'sB', classId: 'cB', status: 'active' }],
      grades: [{ studentId: 'sB', classId: 'cB', percent: 80 }],
      invites: [{ code: 'INVB', classId: 'cB', revoked: false }],
      homeworkAssignments: [
        {
          id: 'hB',
          classId: 'cB',
          title: 'B hw',
          fileName: 'b.txt',
          fileData: b64('b'),
          questions: [{ type: 'short_answer', prompt: 'q', correctAnswer: 'a', points: 1 }]
        }
      ],
      materials: [{ id: 'mB', classId: 'cB', title: 'B mat', chunks: ['text'] }]
    },
    secretB
  )
  await portal.sync(
    '/posts',
    { classId: 'cB', body: 'hi', imageName: 'p.png', imageData: png.toString('base64') },
    secretB
  )
  const bea = await portal.call('POST', '/api/invites/INVB/redeem', {
    body: { studentId: 'sB', username: 'bea', password: 'bea-password-1' }
  })
  await portal.call('POST', '/api/me/homework/hB/submit', {
    cookie: bea.cookie,
    body: { studentId: 'sB', fileName: 'w.pdf', fileData: b64('%PDF-1.7 x') }
  })
  await portal.call('POST', '/api/me/profiles/sB/photo', {
    cookie: bea.cookie,
    body: { fileName: 'me.png', fileData: png.toString('base64') }
  })
  await portal.call('POST', '/api/me/messages', { cookie: bea.cookie, body: { body: 'hello' } })

  const dirs = ['homework-uploads', 'submission-uploads', 'post-images', 'profile-photos']
  const count = (d) => fsx.readdirSync(pathx.join(portal.dataDir, d)).length
  assert.deepEqual(dirs.map(count), [1, 1, 1, 1], 'one file of B’s in each folder')

  const del = await portal.call('DELETE', `/api/admin/teachers/${created.json.id}`, {
    headers: { 'X-Admin-Secret': portal.secrets.admin }
  })
  assert.equal(del.status, 200)
  assert.deepEqual(dirs.map(count), [0, 0, 0, 0], 'all of B’s files are gone')

  const db = new Database(pathx.join(portal.dataDir, 'portal.db'), { readonly: true })
  const left = (sql) => db.prepare(sql).get().n
  for (const [table, where] of [
    ['homework_assignments', "id = 'hB'"],
    ['homework_questions', "homework_assignment_id = 'hB'"],
    ['homework_submissions', "homework_assignment_id = 'hB'"],
    ['materials', "id = 'mB'"],
    ['material_chunks', "material_id = 'mB'"],
    ['class_posts', "class_id = 'cB'"],
    ['invites', "class_id = 'cB'"],
    ['grades', "student_id = 'sB'"],
    ['enrollments', "student_id = 'sB'"],
    ['student_profiles', "student_id = 'sB'"],
    ['accounts', "username = 'bea'"],
    ['students', "id = 'sB'"],
    ['classes', "id = 'cB'"]
  ]) {
    assert.equal(
      left(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`),
      0,
      `${table} still has B's rows`
    )
  }
  assert.equal(left("SELECT COUNT(*) AS n FROM messages WHERE body = 'hello'"), 0)
  db.close()

  // Teacher A and their student are untouched.
  assert.equal(
    (await portal.call('GET', '/api/me', { cookie: aCookie })).json.students[0].classes[0].name,
    'Biology 101'
  )
  assert.equal(
    (
      await portal.call('DELETE', `/api/admin/teachers/${created.json.id}`, {
        headers: { 'X-Admin-Secret': portal.secrets.admin }
      })
    ).status,
    404
  )
})

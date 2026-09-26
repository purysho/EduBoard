const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload } = require('./helpers')

const PASSWORD = 'a-good-password'

function roster(extraInvites = []) {
  const payload = classPayload()
  payload.students.push({ id: 's2', firstName: 'Bo', lastName: 'Chen', dateOfBirth: '2006-04-12' })
  payload.enrollments.push({ studentId: 's2', classId: 'c1', status: 'active' })
  payload.homeworkAssignments = [{ id: 'h1', classId: 'c1', title: 'Week 1 words' }]
  payload.invites = [
    { code: 'OLD-STRIP', classId: 'c1', revoked: false },
    { code: 'ADA-LINK', classId: 'c1', revoked: false, kind: 'student', studentId: 's1' },
    { code: 'CLASS-LINK', classId: 'c1', revoked: false, kind: 'class_link' },
    ...extraInvites
  ]
  return payload
}

async function setup(t) {
  const portal = await startPortal()
  t.after(portal.stop)
  assert.equal((await portal.sync('', roster())).status, 200)
  const join = (code, body) => portal.call('POST', `/api/invites/${code}/redeem`, { body })
  return { portal, join }
}

test('no invite link shows who else is in the class', async (t) => {
  const { portal } = await setup(t)
  for (const code of ['OLD-STRIP', 'CLASS-LINK', 'ADA-LINK']) {
    const res = await portal.call('GET', `/api/invites/${code}`)
    assert.equal(res.status, 200)
    assert.ok(!('students' in res.json), code)
    assert.doesNotMatch(res.text, /Chen|Lovelace/, code)
  }
  assert.deepEqual((await portal.call('GET', '/api/invites/CLASS-LINK')).json, {
    kind: 'class',
    className: 'Biology 101'
  })
})

test('a personal link greets one student and works once', async (t) => {
  const { portal, join } = await setup(t)
  const info = await portal.call('GET', '/api/invites/ADA-LINK')
  assert.deepEqual(info.json, {
    kind: 'student',
    className: 'Biology 101',
    firstName: 'Ada',
    hasDob: false
  })

  // Whatever student id is sent, the link decides who this is.
  const res = await join('ADA-LINK', { studentId: 's2', username: 'ada', password: PASSWORD })
  assert.equal(res.status, 200, res.text)
  const me = await portal.call('GET', '/api/me', { cookie: res.cookie })
  assert.equal(me.json.students[0].studentName, 'Ada Lovelace')

  assert.equal((await portal.call('GET', '/api/invites/ADA-LINK')).status, 404)
  assert.equal((await join('ADA-LINK', { username: 'ada2', password: PASSWORD })).status, 404)
  assert.deepEqual((await portal.sync('/accounts')).json, ['s1'])
})

test('a personal link checks the birth date the teacher has on file', async (t) => {
  const { portal } = await setup(t)
  await portal.sync(
    '',
    roster([{ code: 'BO-LINK', classId: 'c1', revoked: false, kind: 'student', studentId: 's2' }])
  )
  const bad = await portal.call('POST', '/api/invites/BO-LINK/redeem', {
    body: { username: 'bochen', password: PASSWORD, dateOfBirth: '2006-04-13' }
  })
  assert.equal(bad.status, 400)
  assert.match(bad.json.error, /Date of birth/)
  const ok = await portal.call('POST', '/api/invites/BO-LINK/redeem', {
    body: { username: 'bochen', password: PASSWORD, dateOfBirth: '2006-04-12' }
  })
  assert.equal(ok.status, 200)
})

test('the class link adds new students, who stay until the desktop imports them', async (t) => {
  const { portal, join } = await setup(t)
  const mai = await join('CLASS-LINK', {
    firstName: 'Mai',
    lastName: 'Mai',
    dateOfBirth: '2007-09-01',
    username: 'maimai',
    password: PASSWORD
  })
  assert.equal(mai.status, 200, mai.text)
  // Reusable: a second person joins with the same link.
  const second = await join('CLASS-LINK', {
    firstName: 'Li',
    lastName: 'Wei',
    dateOfBirth: '2007-01-02',
    username: 'liwei',
    password: PASSWORD
  })
  assert.equal(second.status, 200)

  const pending = (await portal.sync('/new-students')).json
  assert.deepEqual(
    pending.map((s) => [s.firstName, s.lastName, s.dateOfBirth, s.classIds]),
    [
      ['Mai', 'Mai', '2007-09-01', ['c1']],
      ['Li', 'Wei', '2007-01-02', ['c1']]
    ]
  )
  const seesClass = async () =>
    (await portal.call('GET', '/api/me', { cookie: mai.cookie })).json.students[0]?.classes[0]
      ?.homework.length
  assert.equal(await seesClass(), 1)

  // A publish from the desktop that doesn't know about Mai yet leaves her in the class.
  assert.equal((await portal.sync('', roster())).status, 200)
  assert.equal(await seesClass(), 1)
  assert.equal((await portal.sync('/new-students')).json.length, 2)

  // Once the desktop has imported her and publishes her, she's an ordinary student.
  const imported = roster()
  const maiId = pending[0].id
  imported.students.push({
    id: maiId,
    firstName: 'Mai',
    lastName: 'Mai',
    dateOfBirth: '2007-09-01'
  })
  imported.enrollments.push({ studentId: maiId, classId: 'c1', status: 'active' })
  assert.equal((await portal.sync('', imported)).status, 200)
  assert.deepEqual(
    (await portal.sync('/new-students')).json.map((s) => s.firstName),
    ['Li']
  )
  assert.equal(await seesClass(), 1)

  // And removing her on the desktop removes her from the class.
  assert.equal((await portal.sync('', roster())).status, 200)
  assert.equal(
    (await portal.call('GET', '/api/me', { cookie: mai.cookie })).json.students.length,
    0
  )
})

test('joining with the class link finds your place on the roster', async (t) => {
  const { portal, join } = await setup(t)
  const details = { firstName: ' bo ', lastName: 'CHEN', username: 'bochen', password: PASSWORD }

  // Bo's birth date is on file, so a classmate typing his name can't take his place.
  const wrong = await join('CLASS-LINK', { ...details, dateOfBirth: '2006-01-01' })
  assert.equal(wrong.status, 400)
  assert.match(wrong.json.error, /Date of birth/)

  const right = await join('CLASS-LINK', { ...details, dateOfBirth: '2006-04-12' })
  assert.equal(right.status, 200)
  const me = await portal.call('GET', '/api/me', { cookie: right.cookie })
  assert.equal(me.json.students[0].studentName, 'Bo Chen')
  assert.equal((await portal.sync('/new-students')).json.length, 0, 'matched, not duplicated')
})

test('class links check their input and can be turned off', async (t) => {
  const { portal, join } = await setup(t)
  const base = {
    firstName: 'X',
    lastName: 'Y',
    dateOfBirth: '2007-01-01',
    username: 'xyxy',
    password: PASSWORD
  }
  assert.equal((await join('CLASS-LINK', { ...base, firstName: '' })).status, 400)
  assert.equal((await join('CLASS-LINK', { ...base, dateOfBirth: '2007-02-30' })).status, 400)
  assert.equal((await join('CLASS-LINK', { ...base, dateOfBirth: '2999-01-01' })).status, 400)

  const off = roster()
  off.invites = off.invites.map((i) => (i.code === 'CLASS-LINK' ? { ...i, revoked: true } : i))
  await portal.sync('', off)
  assert.equal((await portal.call('GET', '/api/invites/CLASS-LINK')).status, 404)
  assert.equal((await join('CLASS-LINK', base)).status, 404)

  // A personal invite naming someone outside the published roster is ignored.
  await portal.sync(
    '',
    roster([{ code: 'GHOST', classId: 'c1', revoked: false, kind: 'student', studentId: 'nobody' }])
  )
  assert.equal((await portal.call('GET', '/api/invites/GHOST')).status, 404)
})

test('an older printed strip is now a fill-in form too, and single-use', async (t) => {
  const { portal, join } = await setup(t)
  const res = await join('OLD-STRIP', {
    firstName: 'Ada',
    lastName: 'Lovelace',
    dateOfBirth: '2006-12-10',
    username: 'ada',
    password: PASSWORD
  })
  assert.equal(res.status, 200, res.text)
  const me = await portal.call('GET', '/api/me', { cookie: res.cookie })
  assert.equal(me.json.students[0].studentName, 'Ada Lovelace', 'matched to her roster place')
  assert.equal((await portal.call('GET', '/api/invites/OLD-STRIP')).status, 404)
})

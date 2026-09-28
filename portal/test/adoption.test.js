const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const pdf = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')

test('the admin page counts sign-ups and weekly activity from what the Portal keeps', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  // Ada has a login; Grace doesn't.
  const payload = classPayload()
  payload.students.push({ id: 's2', firstName: 'Grace', lastName: 'Hopper', dateOfBirth: null })
  payload.enrollments.push({ studentId: 's2', classId: 'c1', status: 'active' })
  const { cookie } = await makeStudentAccount(portal, { payload })

  const adoption = () =>
    portal.call('GET', '/api/admin/adoption?weeks=4', {
      headers: { 'X-Admin-Secret': portal.secrets.admin }
    })
  let res = await adoption()
  assert.equal(res.status, 200)
  assert.equal(res.json.totals.students, 2)
  assert.equal(res.json.totals.studentsWithLogin, 1)
  assert.equal(res.json.totals.loginShare, 0.5)
  assert.equal(res.json.weeks.length, 4)
  assert.equal(res.json.weeks.at(-1).families, 0)

  // The teacher posts a notice and sends a report card; the family answers and opens it.
  await portal.sync('/posts', { classId: 'c1', body: 'Trip', replyKind: 'ack' })
  await portal.sync('/report-cards', { classId: 'c1', studentId: 's1', title: 'T1', fileData: pdf })
  const [post] = (await portal.call('GET', '/api/me/posts', { cookie })).json
  await portal.call('POST', `/api/me/posts/${post.id}/reply`, {
    cookie,
    body: { studentId: 's1', answer: 'ack' }
  })
  const [card] = (await portal.call('GET', '/api/me/report-cards', { cookie })).json
  await portal.call('GET', `/api/me/report-cards/${card.id}/file`, { cookie })

  res = await adoption()
  const week = res.json.weeks.at(-1)
  assert.equal(week.families, 1)
  assert.equal(week.teachers, 1)
  assert.equal(res.json.totals.reportCardsOpenedShare, 1)
  assert.equal(res.json.totals.replySlipShare, 1) // Grace has no login, so isn't expected
  assert.equal(res.json.totals.postsSeenShare30, 1)

  // Only with the admin secret.
  const anon = await portal.call('GET', '/api/admin/adoption')
  assert.equal(anon.status, 401)
})

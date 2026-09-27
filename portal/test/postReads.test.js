const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

test('the teacher sees which families have seen a Class Story post', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  // Ada has a login; Grace is enrolled but hasn't joined the Portal.
  const payload = classPayload()
  payload.students.push({ id: 's2', firstName: 'Grace', lastName: 'Hopper', dateOfBirth: null })
  payload.enrollments.push({ studentId: 's2', classId: 'c1', status: 'active' })
  const { cookie } = await makeStudentAccount(portal, { payload })

  assert.equal((await portal.sync('/posts', { classId: 'c1', body: 'Trip on Friday' })).status, 200)
  let [post] = (await portal.sync('/posts')).json
  assert.equal(post.seenCount, 0)
  assert.equal(post.audience, 1)
  assert.deepEqual(post.notSeen, ['Ada Lovelace'])
  assert.equal(post.noLogin, 1)

  // Opening Class Story counts; opening it twice doesn't count twice.
  for (let i = 0; i < 2; i++) {
    const feed = await portal.call('GET', '/api/me/posts', { cookie })
    assert.equal(feed.status, 200)
  }
  ;[post] = (await portal.sync('/posts')).json
  assert.equal(post.seenCount, 1)
  assert.deepEqual(post.notSeen, [])

  // A post made after she looked isn't seen yet.
  await portal.sync('/posts', { classId: 'c1', body: 'Hats tomorrow' })
  const posts = (await portal.sync('/posts')).json
  assert.equal(posts.find((p) => p.body === 'Hats tomorrow').seenCount, 0)

  // Deleting a post takes its receipts with it.
  const del = await portal.call('DELETE', `/api/sync/posts/${post.id}`, {
    headers: { 'X-Sync-Secret': portal.secrets.sync }
  })
  assert.equal(del.status, 200)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

test('the digest preview shows each family what they would get, as the teacher set it', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  await makeStudentAccount(portal)

  let [family] = (await portal.sync('/digest/preview')).json
  assert.equal(family.username, 'ada')
  assert.deepEqual(family.students, ['Ada Lovelace'])
  assert.match(family.html, /Weekly update/)
  assert.match(family.html, /91%/)

  // Grades off, Chinese, and a newsletter for this week.
  const payload = classPayload()
  payload.digestOptions = {
    grades: false,
    attendance: true,
    homework: true,
    classStory: true,
    messages: true
  }
  payload.digestLanguage = 'zh'
  assert.equal((await portal.sync('', payload)).status, 200)
  const until = new Date(Date.now() + 7 * 86400000).toISOString()
  const set = await portal.sync('/digest/newsletter', {
    text: '# This week\nWe read <b>Charlotte’s Web</b>.\n\n- Trip on Friday\n- Bring a hat',
    until
  })
  assert.equal(set.status, 200, set.text)

  ;[family] = (await portal.sync('/digest/preview')).json
  assert.match(family.html, /每周简报/)
  assert.doesNotMatch(family.html, /91%/)
  assert.match(family.html, /95%/) // attendance still shown
  assert.match(family.html, /老师的话/)
  assert.match(family.html, /&lt;b&gt;Charlotte/) // the teacher's text is escaped
  assert.match(family.html, /<li>Trip on Friday<\/li>/)

  // An expired newsletter drops out.
  await portal.sync('/digest/newsletter', { text: 'Old news', until: '2000-01-01T00:00:00Z' })
  ;[family] = (await portal.sync('/digest/preview')).json
  assert.doesNotMatch(family.html, /Old news/)
})

test('the teacher summary goes only to the teacher’s own address', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  assert.equal((await portal.sync('', classPayload())).status, 200)
  const res = await portal.sync('/digest/send-teacher', { subject: 'Summary', html: '<p>Hi</p>' })
  assert.equal(res.status, 400)
  assert.match(res.json.error, /own email/)
})

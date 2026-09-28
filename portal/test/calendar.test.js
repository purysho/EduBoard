const test = require('node:test')
const assert = require('node:assert/strict')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')
const { fold, escapeText } = require('../services/ics')

const homework = [
  { id: 'h1', classId: 'c1', title: 'Essay, part 1; draft', dueDate: '2026-10-05', questions: [] },
  { id: 'h2', classId: 'c1', title: 'Reading log', dueDate: null, questions: [] }
]

test('a private calendar link lists homework due dates, and can be replaced or turned off', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, {
    payload: classPayload({ extra: { homeworkAssignments: homework } })
  })
  assert.equal((await portal.call('GET', '/api/me', { cookie })).json.calendarOn, false)

  const made = await portal.call('POST', '/api/me/calendar', { cookie, body: { lang: 'zh' } })
  assert.equal(made.status, 200)
  assert.match(made.json.url, /\/calendar\/[^/]+\.ics\?lang=zh$/)
  assert.equal((await portal.call('GET', '/api/me', { cookie })).json.calendarOn, true)

  const path = new URL(made.json.url).pathname + new URL(made.json.url).search
  const feed = await portal.call('GET', path)
  assert.equal(feed.status, 200)
  assert.match(feed.headers.get('content-type'), /^text\/calendar/)
  const ics = feed.text
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /X-WR-CALNAME:EduBoard 作业/)
  assert.match(ics, /DTSTART;VALUE=DATE:20261005\r\n/)
  assert.match(ics, /DTEND;VALUE=DATE:20261006\r\n/)
  assert.ok(ics.includes(String.raw`SUMMARY:Essay\, part 1\; draft` + '\r\n'))
  assert.match(ics, /尚未提交/)
  // No due date, no event.
  assert.doesNotMatch(ics, /Reading log/)
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1)

  // Handing it in ticks it off.
  const handIn = await portal.call('POST', '/api/me/homework/h1/submit', {
    cookie,
    body: { studentId: 's1', textAnswer: 'My essay' }
  })
  assert.equal(handIn.status, 200, handIn.text)
  assert.match((await portal.call('GET', path)).text, /SUMMARY:✓ Essay/)

  // A new link turns the old one off; turning it off stops both.
  const again = await portal.call('POST', '/api/me/calendar', { cookie, body: {} })
  assert.equal((await portal.call('GET', path)).status, 404)
  const newPath = new URL(again.json.url).pathname
  assert.equal((await portal.call('GET', newPath)).status, 200)
  await portal.call('DELETE', '/api/me/calendar', { cookie })
  assert.equal((await portal.call('GET', newPath)).status, 404)
  assert.equal((await portal.call('GET', '/calendar/not-a-real-token-at-all.ics')).status, 404)
})

test('calendar text is escaped and long lines are folded without splitting characters', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), String.raw`a\,b\;c\\d\ne`)
  const line = 'SUMMARY:' + '作业'.repeat(40)
  const folded = fold(line)
  for (const part of folded.split('\r\n')) assert.ok(Buffer.byteLength(part) <= 75)
  assert.equal(folded.split('\r\n ').join(''), line)
})

// Load test for one Portal serving a whole school: TEACHERS teachers each publish CLASSES
// classes of PER students with ASSESS marked assessments per class; FAMILIES families sign
// up through personal invite links. Times each teacher's publish, families' page loads,
// and families' page loads while BURST teachers publish at the same moment (the Portal
// runs its database work on one thread, so a big publish holds up everyone else).
//   node scripts/load-test.js            (from portal/; takes a few minutes)
const fs = require('fs')
const path = require('path')
const { startPortal } = require('../test/helpers')

const n = (name, fallback) => Number(process.env[name] || fallback)
const TEACHERS = n('TEACHERS', 100)
const CLASSES = n('CLASSES', 4)
const PER = n('PER', 45)
const ASSESS = n('ASSESS', 30)
const FAMILIES = n('FAMILIES', 300)
const BURST = n('BURST', 20)

const ms = (t) => Number(process.hrtime.bigint() - t) / 1e6
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return `median ${at(0.5).toFixed(0)} ms, 95th ${at(0.95).toFixed(0)} ms, worst ${s[s.length - 1].toFixed(0)} ms`
}

function payload(t) {
  const classes = []
  const students = []
  const enrollments = []
  const grades = []
  const assessments = []
  const assessmentScores = []
  const invites = []
  for (let c = 0; c < CLASSES; c++) {
    const classId = `t${t}-c${c}`
    classes.push({ id: classId, name: `Class ${c + 1}`, levelType: 'k12' })
    for (let s = 0; s < PER; s++) {
      const studentId = `t${t}-c${c}-s${s}`
      students.push({ id: studentId, firstName: `S${s}`, lastName: `T${t}`, dateOfBirth: null })
      enrollments.push({ studentId, classId, status: 'active' })
      grades.push({ studentId, classId, percent: 60 + (s % 40), letter: 'B', attendanceRate: 0.95 })
      invites.push({
        code: `INV-${studentId}`,
        classId,
        revoked: false,
        kind: 'student',
        studentId
      })
    }
    for (let a = 0; a < ASSESS; a++) {
      const id = `${classId}-a${a}`
      assessments.push({
        id,
        classId,
        name: `Quiz ${a + 1}`,
        category: 'Quizzes',
        date: '2026-09-01',
        maxScore: 20
      })
      for (let s = 0; s < PER; s++) {
        assessmentScores.push({
          assessmentId: id,
          studentId: `${classId}-s${s}`,
          points: 10 + ((s + a) % 10),
          comment: s % 5 ? null : 'Good effort.'
        })
      }
    }
  }
  return { classes, students, enrollments, grades, assessments, assessmentScores, invites }
}

;(async () => {
  const portal = await startPortal()
  try {
    const secrets = []
    for (let t = 0; t < TEACHERS; t++) {
      const r = await portal.call('POST', '/api/admin/teachers', {
        body: { name: `Teacher ${t}` },
        headers: { 'X-Admin-Secret': portal.secrets.admin }
      })
      secrets.push(r.json.syncSecret)
    }

    const first = []
    for (let t = 0; t < TEACHERS; t++) {
      const body = payload(t)
      const s = process.hrtime.bigint()
      const r = await portal.sync('', body, secrets[t])
      if (r.status !== 200) throw new Error(`publish failed: ${r.text}`)
      first.push(ms(s))
    }
    const size = (JSON.stringify(payload(0)).length / 1024).toFixed(0)
    console.log(
      `${TEACHERS} teachers, each ${CLASSES}×${PER} students, ${ASSESS} assessments a class (${size} KB a publish)`
    )
    console.log(`first publish:        ${stats(first)}`)

    const again = []
    for (let t = 0; t < TEACHERS; t++) {
      const s = process.hrtime.bigint()
      await portal.sync('', payload(t), secrets[t])
      again.push(ms(s))
    }
    console.log(`publish again:        ${stats(again)}`)

    const cookies = []
    for (let f = 0; f < FAMILIES; f++) {
      const t = f % TEACHERS
      const studentId = `t${t}-c${f % CLASSES}-s${Math.floor(f / TEACHERS) % PER}`
      const r = await portal.call('POST', `/api/invites/INV-${studentId}/redeem`, {
        body: { username: `fam${f}`, password: 'a-long-enough-password-1' }
      })
      if (r.status === 200) cookies.push(r.cookie)
      else if (r.status === 429) break
    }
    console.log(`families signed up:   ${cookies.length}`)

    const home = []
    for (const cookie of cookies) {
      const s = process.hrtime.bigint()
      const r = await portal.call('GET', '/api/me', { cookie })
      if (r.status !== 200) throw new Error(`home failed: ${r.status}`)
      home.push(ms(s))
    }
    console.log(`family home (/api/me): ${stats(home)}`)

    // Families keep loading their pages while BURST teachers publish at once.
    const during = []
    let publishing = true
    const families = (async () => {
      let i = 0
      while (publishing) {
        const s = process.hrtime.bigint()
        await portal.call('GET', '/api/me', { cookie: cookies[i++ % cookies.length] })
        during.push(ms(s))
      }
    })()
    const burstStart = process.hrtime.bigint()
    await Promise.all(
      Array.from({ length: BURST }, (_, t) => portal.sync('', payload(t), secrets[t]))
    )
    const burst = ms(burstStart)
    publishing = false
    await families
    console.log(`${BURST} publishing at once: all done in ${burst.toFixed(0)} ms`)
    console.log(`family home meanwhile: ${stats(during)}`)

    const dbFile = fs.readdirSync(portal.dataDir).find((f) => f.endsWith('.db'))
    const mb = fs.statSync(path.join(portal.dataDir, dbFile)).size / 1024 / 1024
    console.log(`database: ${mb.toFixed(0)} MB`)
  } finally {
    await portal.stop()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})

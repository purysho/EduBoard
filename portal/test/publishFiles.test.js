const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { startPortal, classPayload, makeStudentAccount } = require('./helpers')

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex')
const FILE = Buffer.from('%PDF-1.4 worksheet contents')
const MATERIAL_FILE = Buffer.from('%PDF-1.4 original lesson resource')
const CHUNKS = ['Mitochondria release energy.', 'Cells divide by mitosis.']

function payload({
  fileHash = sha256(FILE),
  materialFileHash = sha256(MATERIAL_FILE),
  chunksHash = sha256(JSON.stringify(CHUNKS))
} = {}) {
  return classPayload({
    extra: {
      homeworkAssignments: [
        { id: 'h1', classId: 'c1', title: 'Worksheet', fileName: 'worksheet.pdf', fileHash }
      ],
      materials: [
        {
          id: 'm1',
          classId: 'c1',
          title: 'Cells',
          sourceType: 'file',
          fileName: 'cells.pdf',
          fileHash: materialFileHash,
          chunksHash
        }
      ]
    }
  })
}

async function upload(portal, id, bytes, secret = portal.secrets.sync, kind = 'homework') {
  const res = await fetch(`${portal.url}/api/sync/${kind}/${id}/file`, {
    method: 'POST',
    headers: { 'X-Sync-Secret': secret, 'Content-Type': 'application/octet-stream' },
    body: bytes
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}

test('attachments and material text are sent separately, and only when changed', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const { cookie } = await makeStudentAccount(portal, { payload: payload() })

  // The publish that created the account already asked for both.
  const first = await portal.sync('', payload())
  assert.deepEqual(first.json, {
    ok: true,
    needFiles: ['h1'],
    needMaterialFiles: ['m1'],
    needChunks: ['m1']
  })

  // Only the exact published file is accepted.
  assert.equal((await upload(portal, 'h1', Buffer.from('something else'))).status, 409)
  assert.equal((await upload(portal, 'h1', FILE, 'wrong-secret')).status, 401)
  assert.equal((await upload(portal, 'nope', FILE)).status, 404)
  assert.equal((await upload(portal, 'h1', FILE)).status, 200)
  const download = await fetch(`${portal.url}/api/me/homework/h1/file`, {
    headers: { Cookie: cookie }
  })
  assert.equal(download.status, 200)
  assert.equal(Buffer.from(await download.arrayBuffer()).toString(), FILE.toString())

  assert.equal((await upload(portal, 'm1', Buffer.from('wrong'), portal.secrets.sync, 'materials')).status, 409)
  assert.equal((await upload(portal, 'm1', MATERIAL_FILE, portal.secrets.sync, 'materials')).status, 200)
  const materials = await fetch(`${portal.url}/api/me/materials`, { headers: { Cookie: cookie } })
  assert.equal(materials.status, 200)
  const listed = await materials.json()
  assert.equal(listed[0].hasFile, true)
  assert.equal(listed[0].fileName, 'cells.pdf')
  const materialDownload = await fetch(`${portal.url}/api/me/materials/m1/file`, {
    headers: { Cookie: cookie }
  })
  assert.equal(materialDownload.status, 200)
  assert.equal(Buffer.from(await materialDownload.arrayBuffer()).toString(), MATERIAL_FILE.toString())

  assert.equal((await portal.sync('/materials/m1/chunks', { chunks: ['tampered'] })).status, 409)
  assert.equal((await portal.sync('/materials/m1/chunks', { chunks: CHUNKS })).status, 200)

  // Nothing changed: nothing is asked for again, and the file is still there.
  const again = await portal.sync('', payload())
  assert.deepEqual(again.json, { ok: true, needFiles: [], needMaterialFiles: [], needChunks: [] })
  const stillThere = await fetch(`${portal.url}/api/me/homework/h1/file`, {
    headers: { Cookie: cookie }
  })
  assert.equal(stillThere.status, 200)

  // A changed file is asked for again.
  const changed = await portal.sync('', payload({ fileHash: sha256(Buffer.from('v2')) }))
  assert.deepEqual(changed.json.needFiles, ['h1'])
})

test('a publish carrying no files stays small', async (t) => {
  const portal = await startPortal()
  t.after(portal.stop)
  const many = classPayload({
    extra: {
      homeworkAssignments: Array.from({ length: 40 }, (_, i) => ({
        id: `h${i}`,
        classId: 'c1',
        title: `Worksheet ${i}`,
        fileName: `w${i}.pdf`,
        fileHash: sha256(`file ${i}`)
      }))
    }
  })
  const res = await portal.sync('', many)
  assert.equal(res.status, 200)
  assert.equal(res.json.needFiles.length, 40)
  assert.deepEqual(res.json.needMaterialFiles, [])
  assert.ok(JSON.stringify(many).length < 20_000)
})

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const Database = require('better-sqlite3')

const SCRIPT = path.join(__dirname, '..', 'scripts', 'backup-data.js')

test('nightly backup copies the live database and uploads, and keeps only the newest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-portal-backup-'))
  try {
    const dataDir = path.join(root, 'data')
    const backupDir = path.join(root, 'backups')
    fs.mkdirSync(path.join(dataDir, 'submission-uploads'), { recursive: true })
    fs.writeFileSync(path.join(dataDir, 'submission-uploads', 'essay.docx'), 'essay')
    // A database still open for writing, in WAL mode, like the running Portal's.
    const live = new Database(path.join(dataDir, 'portal.db'))
    live.pragma('journal_mode = WAL')
    live.exec("CREATE TABLE accounts (username TEXT); INSERT INTO accounts VALUES ('maimai')")

    // Old backups beyond the limit are removed, oldest first.
    fs.mkdirSync(backupDir)
    for (let i = 1; i <= 3; i++) {
      fs.writeFileSync(path.join(backupDir, `eduboard-portal-2000-01-0${i}_00-00-00.tar.gz`), '')
    }
    const env = { ...process.env, PORTAL_DATA_DIR: dataDir, PORTAL_BACKUP_KEEP: '2' }
    execFileSync(process.execPath, [SCRIPT, backupDir], { env })
    live.close()

    const backups = fs.readdirSync(backupDir).sort()
    assert.strictEqual(backups.length, 2)
    assert.ok(!backups.includes('eduboard-portal-2000-01-01_00-00-00.tar.gz'))
    const newest = backups[backups.length - 1]
    const out = path.join(root, 'restored')
    fs.mkdirSync(out)
    execFileSync('tar', ['-xzf', path.join(backupDir, newest), '-C', out])
    assert.strictEqual(
      fs.readFileSync(path.join(out, 'data', 'submission-uploads', 'essay.docx'), 'utf8'),
      'essay'
    )
    const restored = new Database(path.join(out, 'data', 'portal.db'), { readonly: true })
    assert.strictEqual(restored.prepare('SELECT username FROM accounts').get().username, 'maimai')
    restored.close()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

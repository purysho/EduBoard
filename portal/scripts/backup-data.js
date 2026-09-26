#!/usr/bin/env node
// Makes one backup of the Portal's data, safe to run while the Portal is serving:
// the database is copied with SQLite's online backup (never a half-written file),
// then packed with the uploaded files and .env into one .tar.gz. Old backups beyond
// KEEP are deleted.
//
//   node scripts/backup-data.js [backup-folder]
//
// The folder defaults to PORTAL_BACKUP_DIR, then /root/eduboard-backups (or
// portal/backups when not running as root). update-server.sh schedules this nightly.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const PORTAL_DIR = path.join(__dirname, '..')
// Pick up PORTAL_DATA_DIR etc. from .env when run by cron/systemd without them.
const envFile = path.join(PORTAL_DIR, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const { DATA_DIR, DB_PATH } = require('../paths')
const Database = require('better-sqlite3')

const KEEP = Number(process.env.PORTAL_BACKUP_KEEP) || 14
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
const BACKUP_DIR =
  process.argv[2] ||
  process.env.PORTAL_BACKUP_DIR ||
  (isRoot ? '/root/eduboard-backups' : path.join(PORTAL_DIR, 'backups'))

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'eduboard-backup-'))
  try {
    const staged = path.join(work, 'data')
    fs.mkdirSync(staged)
    if (fs.existsSync(DB_PATH)) {
      const db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
      try {
        await db.backup(path.join(staged, path.basename(DB_PATH)))
      } finally {
        db.close()
      }
    }
    // Uploaded files: everything in the data folder except the live database files.
    if (fs.existsSync(DATA_DIR)) {
      for (const entry of fs.readdirSync(DATA_DIR)) {
        if (/^portal\.db(-wal|-shm|-journal)?$/.test(entry)) continue
        if (path.join(DATA_DIR, entry) === path.resolve(BACKUP_DIR)) continue
        fs.cpSync(path.join(DATA_DIR, entry), path.join(staged, entry), { recursive: true })
      }
    }
    if (fs.existsSync(envFile)) fs.copyFileSync(envFile, path.join(work, '.env'))

    const out = path.join(BACKUP_DIR, `eduboard-portal-${stamp}.tar.gz`)
    const items = fs.existsSync(path.join(work, '.env')) ? ['data', '.env'] : ['data']
    execFileSync('tar', ['-czf', out, '-C', work, ...items])
    fs.chmodSync(out, 0o600)

    const backups = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => /^eduboard-portal-.*\.tar\.gz$/.test(f))
      .sort()
    for (const old of backups.slice(0, Math.max(0, backups.length - KEEP))) {
      fs.unlinkSync(path.join(BACKUP_DIR, old))
    }
    const size = (fs.statSync(out).size / (1024 * 1024)).toFixed(1)
    console.log(`Backed up to ${out} (${size} MB); keeping the newest ${KEEP}.`)
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(`Portal backup failed: ${err.message}`)
  process.exit(1)
})

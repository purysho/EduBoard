import { app } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

/**
 * EduBoard is meant to run off a USB stick: when the data directory next to the
 * executable (or .app bundle) is writable, we keep the database there so the whole
 * app + its data travels together. When it isn't (e.g. installed into Program Files
 * without admin rights), we fall back to the OS-standard per-user app data folder.
 */
function isWritableDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, '.write-test')
    writeFileSync(probe, 'ok')
    unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function portableContainerDir(): string {
  const exePath = app.getPath('exe')
  if (process.platform === 'darwin') {
    const bundleMarker = '.app/'
    const idx = exePath.indexOf(bundleMarker)
    if (idx !== -1) {
      return dirname(exePath.slice(0, idx + bundleMarker.length - 1))
    }
  }
  return dirname(exePath)
}

export function resolveDataDir(): string {
  if (!app.isPackaged) {
    return join(process.cwd(), 'data')
  }

  const portableDataDir = join(portableContainerDir(), 'EduBoard-data')
  if (isWritableDir(portableDataDir)) {
    return portableDataDir
  }

  return join(app.getPath('userData'), 'data')
}

export function resolveDbPath(): string {
  return join(resolveDataDir(), 'eduboard.db')
}

export function resolveBackupsDir(): string {
  const dir = join(resolveDataDir(), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

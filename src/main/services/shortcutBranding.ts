// The school's name and logo on EduBoard's Windows shortcuts, not just inside the app: the
// desktop and Start menu shortcuts are renamed and get the logo as their icon, and a
// shortcut pinned to the taskbar gets the logo (pins keep their file name, so they stay
// pinned). The open window's taskbar button (and the Mac Dock) follow the logo through
// applyWindowIcon in windows.ts.
//
// Windows only rewrites shortcuts that point at this copy of EduBoard. An update puts an
// "EduBoard" shortcut back on the desktop; the next launch folds it into the renamed one.
// The uninstaller removes renamed shortcuts too (build/installer.nsh reads the list kept
// in BRANDED_LIST_FILE).
import { app, nativeImage, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { basename, join } from 'path'
import { displayAppName, PRODUCT_NAME } from '@shared/branding'

/** Renamed shortcuts, one path per line in UTF-16, for the uninstaller (build/installer.nsh). */
export const BRANDED_LIST_FILE = 'branded-shortcuts.txt'

// ---- Pure parts (tested) ----------------------------------------------------------------

/** An .ico file holding PNG images (Windows Vista and later read these). */
export function makeIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(images.length, 4)
  const entries: Buffer[] = []
  let offset = 6 + 16 * images.length
  for (const { size, png } of images) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1) // height
    e.writeUInt8(0, 2) // no palette
    e.writeUInt8(0, 3)
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i

/** The shortcut's file name for an app name: what Windows allows in a file name, so
 * "Riverside: Teachers" becomes "Riverside Teachers.lnk". */
export function shortcutFileName(appName: string): string {
  const cleaned = appName
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  return `${cleaned && !RESERVED.test(cleaned) ? cleaned : PRODUCT_NAME}.lnk`
}

export interface ShortcutAction {
  path: string
  /** Rename to this path (same folder). */
  renameTo?: string
  /** A second shortcut to EduBoard in the same folder (an update put "EduBoard" back). */
  remove?: boolean
}

/** What to do with EduBoard's shortcuts in one folder: keep one, named `fileName`
 * (renaming the first if none has that name), and remove any others. Pinned shortcuts
 * are never renamed or removed; they only get the icon. */
export function planFolder(
  folder: string,
  shortcuts: string[],
  fileName: string,
  pinned: boolean
): ShortcutAction[] {
  if (pinned || shortcuts.length === 0) return shortcuts.map((path) => ({ path }))
  const wanted = join(folder, fileName)
  const keep =
    shortcuts.find((p) => basename(p).toLowerCase() === fileName.toLowerCase()) ?? shortcuts[0]
  return shortcuts.map((path) =>
    path === keep
      ? path === wanted
        ? { path }
        : { path, renameTo: wanted }
      : { path, remove: true }
  )
}

// ---- Windows ------------------------------------------------------------------------------

function brandingDir(): string {
  return join(app.getPath('userData'), 'branding')
}

/** The logo as a square .ico at the sizes Windows uses, or null for EduBoard's own icon.
 * The file name changes with the logo so Windows doesn't keep showing a cached old icon. */
function logoIco(schoolLogo: string): string | null {
  if (!schoolLogo) return null
  const image = nativeImage.createFromDataURL(schoolLogo)
  if (image.isEmpty()) return null
  const square = squareImage(image, 256)
  const ico = makeIco(
    [256, 48, 32, 16].map((size) => ({
      size,
      png: (size === 256 ? square : square.resize({ width: size, quality: 'best' })).toPNG()
    }))
  )
  const dir = brandingDir()
  mkdirSync(dir, { recursive: true })
  const file = join(
    dir,
    `app-icon-${createHash('sha256').update(ico).digest('hex').slice(0, 8)}.ico`
  )
  if (!existsSync(file)) {
    for (const old of readdirSync(dir)) {
      if (/^app-icon-.*\.ico$/.test(old)) rmSync(join(dir, old), { force: true })
    }
    writeFileSync(file, ico)
  }
  return file
}

/** The image centred on a transparent square, so a wide logo isn't squashed. */
function squareImage(image: Electron.NativeImage, side: number): Electron.NativeImage {
  const { width, height } = image.getSize()
  const scale = side / Math.max(width, height)
  const fitted = image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: 'best'
  })
  const { width: w, height: h } = fitted.getSize()
  const src = fitted.toBitmap() // BGRA, 4 bytes a pixel
  const out = Buffer.alloc(side * side * 4) // transparent
  const left = Math.floor((side - w) / 2)
  const top = Math.floor((side - h) / 2)
  for (let y = 0; y < h; y++) {
    src.copy(out, ((top + y) * side + left) * 4, y * w * 4, (y + 1) * w * 4)
  }
  return nativeImage.createFromBitmap(out, { width: side, height: side })
}

function shortcutFolders(): { folder: string; pinned: boolean }[] {
  const appData = app.getPath('appData')
  const folders = [
    { folder: app.getPath('desktop'), pinned: false },
    { folder: join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), pinned: false },
    {
      folder: join(
        appData,
        'Microsoft',
        'Internet Explorer',
        'Quick Launch',
        'User Pinned',
        'TaskBar'
      ),
      pinned: true
    }
  ]
  // Installed for everyone: the shared desktop and Start menu (writable when run as admin).
  if (process.env.PUBLIC)
    folders.push({ folder: join(process.env.PUBLIC, 'Desktop'), pinned: false })
  if (process.env.ProgramData) {
    folders.push({
      folder: join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      pinned: false
    })
  }
  return folders
}

const samePath = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

function brandWindowsShortcuts(appName: string, schoolLogo: string): void {
  // A portable copy runs from a temporary folder: there are no shortcuts to it to change.
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) return
  const exe = process.execPath
  const icon = logoIco(schoolLogo) ?? exe
  const fileName = shortcutFileName(appName)
  const renamed: string[] = []

  for (const { folder, pinned } of shortcutFolders()) {
    let names: string[]
    try {
      names = readdirSync(folder).filter((n) => n.toLowerCase().endsWith('.lnk'))
    } catch {
      continue
    }
    const ours = names
      .map((n) => join(folder, n))
      .filter((p) => {
        try {
          return samePath(shell.readShortcutLink(p).target, exe)
        } catch {
          return false
        }
      })
    for (const action of planFolder(folder, ours, fileName, pinned)) {
      try {
        if (action.remove) {
          unlinkSync(action.path)
          continue
        }
        let path = action.path
        // Everything else about the shortcut (its target, start folder, and a pin's app id)
        // stays as it was.
        const details = {
          ...shell.readShortcutLink(path),
          icon,
          iconIndex: 0,
          description: appName
        }
        if (action.renameTo && !existsSync(action.renameTo)) {
          shell.writeShortcutLink(action.renameTo, 'create', details)
          unlinkSync(path)
          path = action.renameTo
        } else {
          shell.writeShortcutLink(path, 'update', details)
        }
        if (!pinned && basename(path) !== `${PRODUCT_NAME}.lnk`) renamed.push(path)
      } catch {
        // A shared folder that needs admin rights, or a file in use: leave it as it is.
      }
    }
  }

  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    // UTF-16 with a byte-order mark, so the uninstaller reads a Chinese name correctly.
    writeFileSync(
      join(app.getPath('userData'), BRANDED_LIST_FILE),
      Buffer.from('\ufeff' + renamed.join('\r\n'), 'utf16le')
    )
  } catch {
    // Only the uninstaller's clean-up needs it.
  }
}

/** Applies the school's app name and logo (or EduBoard's own) to the Windows shortcuts.
 * Never throws: branding the shortcuts is a nicety. */
export function applyShortcutBranding(settings: {
  appDisplayName?: string
  schoolLogo?: string
}): void {
  if (process.platform !== 'win32') return
  try {
    brandWindowsShortcuts(displayAppName(settings), settings.schoolLogo ?? '')
  } catch (err) {
    console.error('Couldn’t apply the school’s name and logo to the shortcuts:', err)
  }
}

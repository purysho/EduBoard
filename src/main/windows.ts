import { is } from '@electron-toolkit/utils'
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'path'
import { isSafeExternalUrl } from '@shared/externalUrl'
import { APP_WINDOW_WEB_PREFERENCES, navigationDecision } from './windowSecurity'
import icon from '../../resources/icon.png?asset'

const preloadPath = join(__dirname, '../preload/index.js')

function appWebPreferences(): Electron.WebPreferences {
  return {
    preload: preloadPath,
    ...APP_WINDOW_WEB_PREFERENCES
  }
}

function installWindowSecurity(win: BrowserWindow): void {
  // A renderer can request a new window through window.open(), target=_blank, etc. Never
  // create one. Safe web/email destinations leave EduBoard and open in the system app.
  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HashRouter changes stay in-page and never reach this event. A renderer-triggered
  // reload of the exact app document is allowed; any other document navigation is
  // prevented, with safe web/email URLs handed to the system browser instead.
  win.webContents.on('will-navigate', (event, url) => {
    const decision = navigationDecision(win.webContents.getURL(), url)
    if (decision === 'allow') return
    event.preventDefault()
    if (decision === 'external') void shell.openExternal(url)
  })
}

/** Loads a hash route (e.g. "/print/student/abc/def") into a window the same way in dev
 * (Vite dev server) and in a packaged build (the built index.html), so print/report
 * windows can reuse the same React app and routes as the main window. */
export async function loadAppRoute(win: BrowserWindow, hashRoute = '/'): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // Use the dev server URL exactly as electron-vite advertises it. It's derived from the
    // renderer's server.host/port in electron.vite.config.ts, which pins both, so this is
    // always the address the server really bound — never rewrite the host here, or the
    // client and server can end up on different loopback addresses (127.0.0.1 vs ::1).
    await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hashRoute}`)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'), { hash: hashRoute })
  }
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: appWebPreferences()
  })

  win.on('ready-to-show', () => win.show())
  installWindowSecurity(win)
  loadAppRoute(win, '/').catch((err) => {
    console.error(`[eduboard] Failed to load the app window: ${err}`)
    if (is.dev) {
      console.error(
        '[eduboard] The Vite dev server was unreachable. Close every other `npm run dev` / ' +
          'Electron process (check Task Manager for node.exe and electron.exe) and run it again.'
      )
    }
  })
  return win
}

/** The school's logo as the window's (and taskbar's) icon, or EduBoard's own when there's
 * none. On macOS windows have no icon: the logo goes on the Dock while EduBoard is open. */
export function applyWindowIcon(schoolLogo: string): void {
  const image = schoolLogo ? nativeImage.createFromDataURL(schoolLogo) : null
  if (process.platform === 'darwin') {
    app.dock?.setIcon(image && !image.isEmpty() ? image : nativeImage.createFromPath(icon))
    return
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (image && !image.isEmpty()) win.setIcon(image)
    else if (process.platform === 'linux' || schoolLogo === '') win.setIcon(icon)
  }
}

/** A hidden window used only to render a print-friendly route before printToPDF. */
export function createPrintWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    webPreferences: appWebPreferences()
  })
  installWindowSecurity(win)
  return win
}

/** The print route sets document.title once its data has finished loading; poll for it
 * instead of racing printToPDF against the render's async data fetch. */
export async function waitForPrintReady(win: BrowserWindow, timeoutMs = 8000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (win.webContents.getTitle() === 'eduboard-print-ready') return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

import { is } from '@electron-toolkit/utils'
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'

const preloadPath = join(__dirname, '../preload/index.js')

/** Loads a hash route (e.g. "/print/student/abc/def") into a window the same way in dev
 * (Vite dev server) and in a packaged build (the built index.html), so print/report
 * windows can reuse the same React app and routes as the main window. */
export async function loadAppRoute(win: BrowserWindow, hashRoute = '/'): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // A freshly created window (e.g. the hidden print window) resolves "localhost" on
    // its own, independently of any already-open window — on Windows that can come back
    // as the IPv6 loopback (::1) even when the main window's earlier connection landed
    // on IPv4 (127.0.0.1), which is all the Vite dev server actually listens on. Force
    // the unambiguous IPv4 address so a second window can't get a fresh DNS answer that
    // points nowhere.
    const devUrl = process.env['ELECTRON_RENDERER_URL'].replace('localhost', '127.0.0.1')

    // electron-vite starts the Electron process as soon as it sees the dev server begin
    // listening, but "listening" and "actually ready to serve a request" aren't the same
    // moment — on a slower machine (antivirus scanning node_modules, a cold disk cache
    // right after `npm install`) the very first loadURL can lose that race and come back
    // ERR_CONNECTION_REFUSED even though the server comes up a few hundred ms later.
    // Retry a few times with a short backoff instead of failing outright on that race.
    const maxAttempts = 20
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await win.loadURL(`${devUrl}#${hashRoute}`)
        return
      } catch (err) {
        if (attempt === maxAttempts || win.isDestroyed()) throw err
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
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
    webPreferences: {
      preload: preloadPath,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  void loadAppRoute(win, '/')
  return win
}

/** A hidden window used only to render a print-friendly route before printToPDF. */
export function createPrintWindow(): BrowserWindow {
  return new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false
    }
  })
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

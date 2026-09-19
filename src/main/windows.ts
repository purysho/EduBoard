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

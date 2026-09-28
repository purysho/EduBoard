// What the unit tests get for `import ... from 'electron'` (vitest.config.ts). Outside the
// app, the real package only gives the path to the Electron binary, downloading it first if
// it's missing, and throws when that download fails. That once failed a CI run in a test
// that never uses Electron.
// Like the real package under plain Node, every export here is undefined; a test that
// needs one mocks it (vi.mock('electron', ...)).
export const app = undefined
export const BrowserWindow = undefined
export const Notification = undefined
export const contextBridge = undefined
export const dialog = undefined
export const ipcMain = undefined
export const ipcRenderer = undefined
export const nativeImage = undefined
export const powerMonitor = undefined
export const shell = undefined
export default undefined

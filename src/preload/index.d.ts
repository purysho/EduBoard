import { ElectronAPI } from '@electron-toolkit/preload'
import type { EduBoardApi } from '@shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: EduBoardApi
  }
}

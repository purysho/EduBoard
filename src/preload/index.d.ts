import type { EduBoardApi } from '@shared/api'

declare global {
  interface Window {
    api: EduBoardApi
  }
}

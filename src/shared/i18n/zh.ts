// Simplified Chinese for every interface string, keyed by the English. Split by area
// so each file stays readable; later files win if a key is repeated.
import { CLASSES } from './zh/classes'
import { CODES } from './zh/codes'
import { COMMON } from './zh/common'
import { PAGES } from './zh/pages'
import { SETTINGS } from './zh/settings'
import { SYSTEM } from './zh/system'

export const ZH: Record<string, string> = {
  ...CLASSES,
  ...CODES,
  ...COMMON,
  ...PAGES,
  ...SETTINGS,
  ...SYSTEM
}

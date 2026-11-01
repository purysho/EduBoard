// Simplified Chinese for every interface string, keyed by the English. Split by area
// so each file stays readable; later files win if a key is repeated.
import { CLASSES } from './zh/classes'
import { CODES } from './zh/codes'
import { COMMON } from './zh/common'
import { DIGEST } from './zh/digest'
import { PAGES } from './zh/pages'
import { PILOT } from './zh/pilot'
import { SETTINGS } from './zh/settings'
import { SYSTEM } from './zh/system'
import { TEMPLATES } from './zh/templates'

export const ZH: Record<string, string> = {
  ...CLASSES,
  ...CODES,
  ...COMMON,
  ...DIGEST,
  ...PAGES,
  ...PILOT,
  ...SETTINGS,
  ...SYSTEM,
  ...TEMPLATES
}

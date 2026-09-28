// Imported first in main.tsx, so the interface language and the school's words are set
// before any screen code runs (some labels are worked out once, when their file loads).
// Changing either reloads the window.
import { setTerminology, setUiLanguage, type Terminology } from '@shared/i18n'
import { displayAppName } from '@shared/branding'

const prefs = (
  window as unknown as {
    eduboardUiPrefs?: { language?: string; terminology?: Terminology; appName?: string }
  }
).eduboardUiPrefs
const lang = prefs?.language === 'zh' ? 'zh' : 'en'
setUiLanguage(lang)
setTerminology(prefs?.terminology)
document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'

/** The school's name for the app, known before the database opens (the lock screen). */
export const bootAppName = displayAppName({ appDisplayName: prefs?.appName })
document.title = bootAppName

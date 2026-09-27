// Imported first in main.tsx, so the interface language is set before any screen code
// runs (some labels are worked out once, when their file loads). Changing the language
// reloads the window.
import { setUiLanguage } from '@shared/i18n'

const lang = (window as unknown as { eduboardLanguage?: string }).eduboardLanguage
setUiLanguage(lang === 'zh' ? 'zh' : 'en')
document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const PUBLIC = path.join(__dirname, '..', 'public')
const source = fs.readFileSync(path.join(PUBLIC, 'i18n.js'), 'utf8')
const page = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8')

/** Runs i18n.js the way a browser would, with a saved choice and a browser language. */
function load({ saved = null, browser = 'en-US' } = {}) {
  const store = new Map(saved ? [['eduboard-ui-lang', saved]] : [])
  const context = {
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    navigator: { language: browser },
    document: { documentElement: {}, title: '' },
    location: { reload: () => {} }
  }
  vm.createContext(context)
  vm.runInContext(
    `${source}\n;this.api = { t, tError, UI_LANG, ZH, uiLocale, defaultReadingLanguage }`,
    context
  )
  return { ...context.api, document: context.document, store }
}

test('the interface follows the saved choice, then the browser language', () => {
  assert.equal(load().UI_LANG, 'en')
  assert.equal(load({ browser: 'zh-CN' }).UI_LANG, 'zh')
  assert.equal(load({ browser: 'zh-TW' }).UI_LANG, 'zh')
  assert.equal(load({ browser: 'zh-CN', saved: 'en' }).UI_LANG, 'en')
  assert.equal(load({ saved: 'zh' }).document.documentElement.lang, 'zh-CN')
  assert.equal(load({ saved: 'zh' }).defaultReadingLanguage(), 'Chinese')
  assert.equal(load({ saved: 'fr' }).UI_LANG, 'en', 'an unknown saved value is ignored')
})

test('t() translates, fills placeholders, and falls back to English', () => {
  const zh = load({ saved: 'zh' })
  assert.equal(zh.t('Log in'), '登录')
  assert.equal(zh.t('Due {when}', { when: '9月28日' }), '截止：9月28日')
  assert.equal(zh.t('Not a real key'), 'Not a real key')
  assert.equal(zh.t('toString'), 'toString', 'object built-ins are not translations')
  const en = load()
  assert.equal(en.t('Log in'), 'Log in')
  assert.equal(en.t('Due {when}', { when: 'Mon 28 Sep' }), 'Due Mon 28 Sep')
})

test('server errors are shown in Chinese, including the detailed upload ones', () => {
  const { tError } = load({ saved: 'zh' })
  assert.equal(tError('Wrong username or password'), '用户名或密码错误')
  assert.equal(
    tError("This file can't be submitted: this is a Windows program, not a .docx file."),
    '这个文件无法提交：这是 Windows 程序，不是 .docx 文件。'
  )
  assert.equal(
    tError("This file can't be submitted: the document contains macros."),
    '这个文件无法提交：文档中包含宏。'
  )
  assert.equal(tError('Something new from the server'), 'Something new from the server')
  assert.equal(load().tError('Wrong username or password'), 'Wrong username or password')
})

test('every interface string on the page has a Chinese translation', () => {
  const { ZH } = load()
  const keys = new Set()
  // t('…'), t("…") and t(`…`) with a literal first argument.
  for (const m of page.matchAll(/\bt\((['"`])((?:\\.|(?!\1).)*)\1/g)) {
    keys.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'))
  }
  // Labels that reach t() through a variable.
  const tabs = /const TABS = \[([\s\S]*?)\n\]/.exec(page)[1]
  for (const m of tabs.matchAll(/\['\w+', '([^']+)'\]/g)) keys.add(m[1])
  const statuses = /const STATUS_LABELS = \{([^}]*)\}/.exec(page)[1]
  for (const m of statuses.matchAll(/'([^']+)'/g)) keys.add(m[1])
  const prompts = /const QUICK_PROMPTS = \[([\s\S]*?)\n\]/.exec(page)[1]
  for (const m of prompts.matchAll(/'([^']+)'/g)) keys.add(m[1])
  const languages = /const LANGUAGES = \[([\s\S]*?)\n\]/.exec(page)[1]
  for (const m of languages.matchAll(/\['\w+', '([^']+)'\]/g)) keys.add(m[1])

  assert.ok(keys.size > 150, `found only ${keys.size} strings; is the pattern still right?`)
  const missing = [...keys].filter((k) => !Object.hasOwn(ZH, k))
  assert.deepEqual(missing, [])

  // Placeholders must survive translation, or t() would print a raw {name}.
  for (const key of keys) {
    const wanted = (key.match(/\{\w+\}/g) || []).sort().join()
    assert.equal((ZH[key].match(/\{\w+\}/g) || []).sort().join(), wanted, key)
  }
})

test('the page loads the translations before its own script', () => {
  assert.ok(page.indexOf('<script src="/i18n.js"></script>') < page.indexOf('<script>\n'))
})

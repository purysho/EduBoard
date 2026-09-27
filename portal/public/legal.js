// The privacy notice and data processing terms hold both languages; this shows one.
// ?lang=zh or ?lang=en (the desktop app links with its own language) wins, then the
// language chosen on the homepage, then the browser's.
;(function () {
  let lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en'
  try {
    const saved = localStorage.getItem('eduboard-ui-lang')
    if (saved === 'zh' || saved === 'en') lang = saved
  } catch {
    // Storage blocked: the browser's language will do.
  }
  const asked = new URLSearchParams(location.search).get('lang')
  if (asked === 'zh' || asked === 'en') lang = asked

  function show() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    for (const el of document.querySelectorAll('[data-lang-block]')) {
      el.hidden = el.dataset.langBlock !== lang
    }
    for (const b of document.querySelectorAll('.lang button')) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang))
    }
    const title = document.querySelector(`[data-lang-block="${lang}"] h1`)
    if (title) document.title = title.textContent + ' · EduBoard'
  }
  for (const b of document.querySelectorAll('.lang button')) {
    b.addEventListener('click', () => {
      lang = b.dataset.lang
      try {
        localStorage.setItem('eduboard-ui-lang', lang)
      } catch {
        // Not remembered; still switches.
      }
      show()
    })
  }
  for (const b of document.querySelectorAll('.print')) {
    b.addEventListener('click', () => window.print())
  }
  show()
})()

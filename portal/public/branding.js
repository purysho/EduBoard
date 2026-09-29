// The Portal's name and logo (services/branding.js) on this page: the tab title, the
// header, the badge, and the name and icon when it's added to a phone's home screen.
// Remembered on this device so they show at once (and offline), then checked with the
// Portal. Loaded after i18n.js.
/* global t */
/* exported badgeHtml */
const BRANDING_KEY = 'eduboard-branding'
const LOGO_PATH = /^\/api\/branding\/logo\?v=[0-9a-f]{6,64}$/

function cleanBranding(b) {
  if (!b || typeof b.name !== 'string') return null
  return {
    name: b.name.slice(0, 60),
    logo: typeof b.logo === 'string' && LOGO_PATH.test(b.logo) ? b.logo : null
  }
}

let portalBranding = (() => {
  try {
    return cleanBranding(JSON.parse(localStorage.getItem(BRANDING_KEY))) || { name: '', logo: null }
  } catch {
    return { name: '', logo: null }
  }
})()

/** The full name: the school's, or "EduBoard Portal". */
function brandName() {
  return portalBranding.name || t('EduBoard Portal')
}

/** The short name, for a phone's app bar and home screen. */
function brandShortName() {
  return portalBranding.name || 'EduBoard'
}

/** Two letters for the badge when there's no logo: "Uni-Helper" → "UH", "河畔学校" → "河". */
function brandInitials() {
  const name = portalBranding.name.trim()
  if (!name) return 'EB'
  if (/^[㐀-鿿]/.test(name)) return name[0]
  const words = name.split(/[\s\-_.]+/).filter(Boolean)
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || 'EB'
}

const escapeBrand = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  )

/** The badge's inside: the logo, or the initials. */
function badgeInnerHtml() {
  return portalBranding.logo
    ? `<img src="${portalBranding.logo}" alt="" />`
    : escapeBrand(brandInitials())
}

function badgeHtml() {
  return `<div class="badge${portalBranding.logo ? ' has-logo' : ''}">${badgeInnerHtml()}</div>`
}

// The tab title, with the unread-message count in front when there is one (index.html).
let titleCount = 0
function setTitleCount(n) {
  titleCount = n
  document.title = (n > 0 ? `(${n}) ` : '') + brandName()
}

/** Puts the current name and logo everywhere on the page that shows them. */
function applyBranding() {
  setTitleCount(titleCount)
  for (const el of document.querySelectorAll('[data-brand]')) {
    el.textContent = el.dataset.brand === 'short' ? brandShortName() : brandName()
  }
  for (const el of document.querySelectorAll('.badge')) {
    el.classList.toggle('has-logo', !!portalBranding.logo)
    el.innerHTML = badgeInnerHtml()
  }
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute('content', brandShortName())
  document
    .querySelector('link[rel="icon"]')
    ?.setAttribute('href', portalBranding.logo || '/icon.svg')
  document
    .querySelector('link[rel="apple-touch-icon"]')
    ?.setAttribute('href', portalBranding.logo || '/apple-touch-icon.png')
}

fetch('/api/branding')
  .then((res) => (res.ok ? res.json() : null))
  .then((b) => {
    const fresh = cleanBranding(b)
    if (!fresh) return
    portalBranding = fresh
    try {
      localStorage.setItem(BRANDING_KEY, JSON.stringify(fresh))
    } catch {
      // Private browsing: shown this time, fetched again next time.
    }
    applyBranding()
  })
  .catch(() => {
    // Offline: the remembered name and logo stay.
  })

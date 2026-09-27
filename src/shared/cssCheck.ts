// What a school stylesheet will actually change in EduBoard, so loading one says so
// instead of silently doing nothing (a stylesheet made for a website, say, styles that
// website's parts, none of which exist here).

/** EduBoard's colour variables a school stylesheet can set (see assets/styles.css). */
export const EDUBOARD_COLOR_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-muted',
  '--color-border',
  '--color-text',
  '--color-text-muted',
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-soft',
  '--color-success',
  '--color-success-soft',
  '--color-warning',
  '--color-warning-soft',
  '--color-danger',
  '--color-danger-soft'
] as const

export interface CssCheck {
  /** EduBoard colour variables it sets. */
  tokens: string[]
  /** Rules for things every screen has (the page, headings, buttons, tables…). */
  generalRules: number
  /** Rules for anything else, which most likely match nothing in EduBoard. */
  otherRules: number
  /** Longer than EduBoard keeps, so only the start was used. */
  truncated: boolean
}

// A selector that reaches EduBoard's screens: the page itself, a plain element, or
// either with something after it ("body.dark", "h1 + p", "button:hover").
const GENERAL =
  /^(?::root|html|body|\.dark|\*|h[1-6]|p|a|button|input|select|textarea|label|table|thead|tbody|tr|th|td|ul|ol|li|nav|aside|main|header|footer|section|img|svg|code|pre|strong|em|small|hr)(?=$|[\s.:#[>+~(])/i

/** Whether a selector reaches EduBoard's screens: it starts with something every page
 * has, and doesn't depend on another site's classes or ids ("body .wp-site-blocks" is a
 * WordPress page, not EduBoard). EduBoard's own .dark and .high-contrast are fine. */
function isGeneral(selector: string): boolean {
  if (!GENERAL.test(selector)) return false
  let rest = selector
  // Drop everything in brackets (:not(…), :has(…), [attr]) before looking for classes.
  for (let prev = ''; prev !== rest;) {
    prev = rest
    rest = rest.replace(/\([^()]*\)|\[[^[\]]*\]/g, '')
  }
  return !/[.#]/.test(rest.replace(/\.(dark|high-contrast)\b/g, ''))
}

export function checkCss(css: string, maxChars: number): CssCheck {
  const truncated = css.length > maxChars
  const text = css.slice(0, maxChars).replace(/\/\*[\s\S]*?\*\//g, '')
  const tokens = EDUBOARD_COLOR_TOKENS.filter((t) =>
    new RegExp(`${t.replace(/-/g, '\\-')}\\s*:`).test(text)
  )
  let generalRules = 0
  let otherRules = 0
  // Every innermost "selector { declarations }" (rules inside @media too), skipping
  // at-rules (@font-face…) and keyframe steps.
  for (const m of text.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const prelude = m[1].trim()
    if (!prelude || prelude.startsWith('@') || /^(from|to|\d+%)/.test(prelude)) continue
    const selectors = prelude.split(',').map((s) => s.trim())
    // Only defining variables (--x: …) styles nothing by itself; EduBoard's own
    // variables are counted in `tokens` instead.
    const styles = m[2].split(';').some((d) => d.includes(':') && !d.trim().startsWith('--'))
    if (styles && selectors.some(isGeneral)) generalRules++
    else if (styles) otherRules++
  }
  return { tokens, generalRules, otherRules, truncated }
}

/** A starting point for a school: every colour EduBoard uses, light and dark, with notes. */
export function exampleStylesheet(): string {
  return `/* EduBoard school stylesheet
   Load it in Settings → Appearance → School stylesheet. Change the colours below to the
   school's own; delete any line you don't need. Nothing here can load from the internet,
   but a background image can be pasted in as a data: address (see the end). */

/* Light mode */
:root {
  --color-bg: #f8fafc;            /* the page behind everything */
  --color-surface: #ffffff;       /* cards and panels */
  --color-surface-muted: #f1f5f9; /* table headers, quiet areas */
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-primary: #4f46e5;       /* buttons, links, the selected menu item */
  --color-primary-hover: #4338ca;
  --color-primary-soft: #eef2ff;  /* pale backgrounds for selected things */
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;
}

/* Dark mode (Settings → You and your school → Theme) */
.dark {
  --color-bg: #0b1120;
  --color-surface: #111827;
  --color-surface-muted: #1a2332;
  --color-border: #263042;
  --color-text: #e5e7eb;
  --color-text-muted: #94a3b8;
  --color-primary: #818cf8;
  --color-primary-hover: #6366f1;
  --color-primary-soft: #1e1b4b;
}

/* The school's font, if it's installed on the computer:
body {
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}
*/

/* A background picture, pasted in as a data: address (PNG, JPEG, WebP or GIF):
body {
  background-image: url("data:image/png;base64,...");
  background-size: cover;
}
*/
`
}

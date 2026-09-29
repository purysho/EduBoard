// Ready-made school stylesheets (Settings → Appearance → Style library). Each one makes a
// change you can see at a glance, using only what a school stylesheet may use: EduBoard's
// colour names (see cssCheck.ts), fonts already on the computer, and gradients. Nothing
// loads from the internet. A school can use one as it is, or save a copy and edit it.
import { tr } from './i18n'

export interface LibraryStyle {
  id: string
  name: string
  description: string
  /** Page, card, main colour and text, for the preview in the library. */
  swatch: { bg: string; surface: string; primary: string; text: string }
  css: string
}

const HEADER = (name: string): string =>
  `/* EduBoard style library: ${name}
   Change any colour below and load the file again in Settings → Appearance. */
`

// The dark version of every style: the same main colour on EduBoard's dark background.
const darkWith = (primary: string, hover: string, soft: string): string => `
.dark {
  --color-primary: ${primary};
  --color-primary-hover: ${hover};
  --color-primary-soft: ${soft};
}
`

const FOREST =
  HEADER('Forest') +
  `:root {
  --color-bg: #f3f1e7;
  --color-surface: #fffdf6;
  --color-surface-muted: #ebe7d6;
  --color-border: #d6d0b8;
  --color-text: #1f2a1c;
  --color-text-muted: #5b6652;
  --color-primary: #2f6b3a;
  --color-primary-hover: #245430;
  --color-primary-soft: #e1eddc;
}
h1, h2, h3 {
  font-family: Georgia, "Songti SC", "SimSun", serif;
}
` +
  darkWith('#6fbf7c', '#57a865', '#16301b')

const OCEAN =
  HEADER('Ocean') +
  `:root {
  --color-bg: #eef6f9;
  --color-surface: #ffffff;
  --color-surface-muted: #e2eff4;
  --color-border: #c7dde6;
  --color-text: #0b2a36;
  --color-text-muted: #4d6b78;
  --color-primary: #0e7490;
  --color-primary-hover: #0b5c72;
  --color-primary-soft: #d9f0f6;
}
body {
  background-image: linear-gradient(180deg, #dff0f6 0%, #eef6f9 240px);
}
` +
  darkWith('#38bdf8', '#0ea5e9', '#0c2f3d')

const SUNSET =
  HEADER('Sunset') +
  `:root {
  --color-bg: #fff4ec;
  --color-surface: #ffffff;
  --color-surface-muted: #ffe8da;
  --color-border: #f5cdb6;
  --color-text: #3b1d12;
  --color-text-muted: #8a5a45;
  --color-primary: #e2572b;
  --color-primary-hover: #c44519;
  --color-primary-soft: #ffe1d3;
}
body {
  background-image: linear-gradient(135deg, #fff1e6 0%, #ffe4ec 100%);
}
button {
  border-radius: 999px;
}
` +
  darkWith('#fb8a5c', '#f06a3a', '#3d1a0f')

const CHALKBOARD =
  HEADER('Chalkboard') +
  `/* Always dark, like a classroom board, in light and dark mode alike. */
:root, .dark {
  --color-bg: #1f3b2d;
  --color-surface: #264634;
  --color-surface-muted: #2d523d;
  --color-border: #3f6b53;
  --color-text: #f4f1e8;
  --color-text-muted: #c5d3c8;
  --color-primary: #f2d85c;
  --color-primary-hover: #e6c63a;
  --color-primary-soft: #3a5a3f;
  --color-success: #8fe3a2;
  --color-success-soft: #24533a;
  --color-warning: #f7c46a;
  --color-warning-soft: #54452a;
  --color-danger: #ff9a8a;
  --color-danger-soft: #5a2f2b;
}
body {
  font-family: "Comic Sans MS", "Chalkboard SE", "Kaiti SC", "KaiTi", sans-serif;
}
`

const PAPER =
  HEADER('Paper and ink') +
  `:root {
  --color-bg: #f7f3ea;
  --color-surface: #fffdf8;
  --color-surface-muted: #f1ebdc;
  --color-border: #ddd3bd;
  --color-text: #1d2240;
  --color-text-muted: #5d6280;
  --color-primary: #1f3a93;
  --color-primary-hover: #182e75;
  --color-primary-soft: #e3e8f7;
}
body {
  font-family: Georgia, "Songti SC", "SimSun", serif;
  background-image: repeating-linear-gradient(0deg, transparent 0 31px, #ebe3d0 31px 32px);
}
` +
  darkWith('#8ea8f5', '#6d8cef', '#1b2448')

const BIG_BOLD =
  HEADER('Big and bold (classroom screen)') +
  `/* For a projector or classroom screen: larger text, stronger lines and colours. */
html {
  font-size: 118%;
}
:root {
  --color-text: #000000;
  --color-text-muted: #1f2937;
  --color-border: #6b7280;
  --color-primary: #1d4ed8;
  --color-primary-hover: #1e40af;
  --color-primary-soft: #dbeafe;
}
body {
  font-weight: 500;
}
h1, h2, h3, th, button {
  font-weight: 700;
}
*:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
` +
  darkWith('#93c5fd', '#60a5fa', '#1e3a8a')

const CALM =
  HEADER('Calm grey') +
  `:root {
  --color-bg: #f5f5f4;
  --color-surface: #ffffff;
  --color-surface-muted: #efefed;
  --color-border: #deded9;
  --color-text: #1c1917;
  --color-text-muted: #6b6560;
  --color-primary: #292524;
  --color-primary-hover: #0c0a09;
  --color-primary-soft: #eceae6;
}
` +
  darkWith('#e7e5e4', '#f5f5f4', '#2a2725')

export function styleLibrary(): LibraryStyle[] {
  return [
    {
      id: 'forest',
      name: tr('Forest'),
      description: tr('Deep green on warm cream, with classic headings.'),
      swatch: { bg: '#f3f1e7', surface: '#fffdf6', primary: '#2f6b3a', text: '#1f2a1c' },
      css: FOREST
    },
    {
      id: 'ocean',
      name: tr('Ocean'),
      description: tr('Teal and cool blue, light and airy.'),
      swatch: { bg: '#eef6f9', surface: '#ffffff', primary: '#0e7490', text: '#0b2a36' },
      css: OCEAN
    },
    {
      id: 'sunset',
      name: tr('Sunset'),
      description: tr('Warm orange and peach, with round buttons.'),
      swatch: { bg: '#fff4ec', surface: '#ffffff', primary: '#e2572b', text: '#3b1d12' },
      css: SUNSET
    },
    {
      id: 'chalkboard',
      name: tr('Chalkboard'),
      description: tr('A dark green board with chalk-white writing, always.'),
      swatch: { bg: '#1f3b2d', surface: '#264634', primary: '#f2d85c', text: '#f4f1e8' },
      css: CHALKBOARD
    },
    {
      id: 'paper',
      name: tr('Paper and ink'),
      description: tr('Lined paper, ink blue and a book font.'),
      swatch: { bg: '#f7f3ea', surface: '#fffdf8', primary: '#1f3a93', text: '#1d2240' },
      css: PAPER
    },
    {
      id: 'big-bold',
      name: tr('Big and bold'),
      description: tr('Larger text and stronger lines, for a projector or classroom screen.'),
      swatch: { bg: '#f8fafc', surface: '#ffffff', primary: '#1d4ed8', text: '#000000' },
      css: BIG_BOLD
    },
    {
      id: 'calm',
      name: tr('Calm grey'),
      description: tr('Quiet greys with black, nothing bright.'),
      swatch: { bg: '#f5f5f4', surface: '#ffffff', primary: '#292524', text: '#1c1917' },
      css: CALM
    }
  ]
}

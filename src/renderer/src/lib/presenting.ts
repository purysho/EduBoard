import { useSyncExternalStore } from 'react'

// Presenting mode: for when the screen is on the projector. Pages that show grades,
// notes, contact details or keys are replaced by a notice, and anything marked
// data-private on the pages that stay is blurred.

/** Pages a class sees on the projector anyway. Everything else is hidden. */
const SHOWN_PAGES = [
  /^\/classes\/?$/,
  /^\/classes\/[^/]+\/(attendance|lessons|seating|exit-ticket|story|classroom)\/?$/,
  /^\/timetable\/?$/,
  /^\/calendar\/?$/,
  /^\/resources\/?$/,
  /^\/notebook\/?$/,
  /^\/rubrics(\/[^/]+)?\/?$/
]

export function isShownWhilePresenting(path: string): boolean {
  return SHOWN_PAGES.some((re) => re.test(path))
}

const KEY = 'eduboard.presenting'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setPresenting(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Not remembered across restarts; still applies now.
  }
  document.documentElement.classList.toggle('presenting', on)
  listeners.forEach((l) => l())
}

export function usePresenting(): boolean {
  const on = useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, read)
  document.documentElement.classList.toggle('presenting', on)
  return on
}

import { useEffect } from 'react'
import { useSettings } from './queries'

export function useThemeEffect(): void {
  const { data: settings } = useSettings()

  useEffect(() => {
    const root = document.documentElement
    const theme = settings?.theme ?? 'system'

    function apply(isDark: boolean): void {
      root.classList.toggle('dark', isDark)
    }

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      apply(media.matches)
      const listener = (e: MediaQueryListEvent): void => apply(e.matches)
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }

    apply(theme === 'dark')
    return undefined
  }, [settings?.theme])
}

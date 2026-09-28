import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { displayAppName } from '@shared/branding'
import { useSettings } from '@renderer/lib/queries'
import { Sidebar } from './Sidebar'
import { ScreenErrorBoundary } from '../ScreenErrorBoundary'
import { DeviceSyncBanner } from './DeviceSyncBanner'
import { UpdateBanner } from './UpdateBanner'
import { SampleSchoolBanner } from './SampleSchoolBanner'
import { HiddenWhilePresenting, PresentingBanner } from './PresentingBanner'
import { isShownWhilePresenting, usePresenting } from '@renderer/lib/presenting'
import { useThemeEffect } from '@renderer/lib/useTheme'

export function AppShell(): React.JSX.Element {
  useThemeEffect()
  const presenting = usePresenting()
  const { pathname } = useLocation()
  const { data: settings } = useSettings()
  const appName = displayAppName(settings)
  // The window's title (and the taskbar's): the school's name for the app when it has one.
  useEffect(() => {
    document.title = appName
  }, [appName])

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <PresentingBanner />
        <SampleSchoolBanner />
        {!presenting && <UpdateBanner />}
        <DeviceSyncBanner />
        <div className="mx-auto max-w-6xl px-8 py-8">
          {presenting && !isShownWhilePresenting(pathname) ? (
            <HiddenWhilePresenting />
          ) : (
            <ScreenErrorBoundary resetKey={pathname}>
              <Outlet />
            </ScreenErrorBoundary>
          )}
        </div>
      </main>
    </div>
  )
}

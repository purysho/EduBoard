import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { DeviceSyncBanner } from './DeviceSyncBanner'
import { UpdateBanner } from './UpdateBanner'
import { HiddenWhilePresenting, PresentingBanner } from './PresentingBanner'
import { isShownWhilePresenting, usePresenting } from '@renderer/lib/presenting'
import { useThemeEffect } from '@renderer/lib/useTheme'

export function AppShell(): React.JSX.Element {
  useThemeEffect()
  const presenting = usePresenting()
  const { pathname } = useLocation()

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <PresentingBanner />
        {!presenting && <UpdateBanner />}
        <DeviceSyncBanner />
        <div className="mx-auto max-w-6xl px-8 py-8">
          {presenting && !isShownWhilePresenting(pathname) ? <HiddenWhilePresenting /> : <Outlet />}
        </div>
      </main>
    </div>
  )
}

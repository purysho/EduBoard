// Asked once, right after the teacher creates their first class: protect the classes
// with a password? Strongly recommended in a local-only pilot, never forced.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { useSecurityStatus, useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'

export function PasswordPrompt(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const { data: status } = useSecurityStatus()
  const update = useUpdateSettings()
  const navigate = useNavigate()
  const due = settings?.passwordPromptDue === true
  const alreadyProtected = status?.protected === true
  // Already protected (set from the checklist, say): nothing to ask, so clear it.
  useEffect(() => {
    if (due && alreadyProtected) update.mutate({ passwordPromptDue: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due, alreadyProtected])
  if (!due || !status || status.locked || status.protected) return null
  const pilot = settings?.pilotMode === true
  const answer = (turnOn: boolean): void => {
    update.mutate({ passwordPromptDue: false })
    if (turnOn) navigate('/settings?section=data&focus=security')
  }

  return (
    <Modal
      open
      onClose={() => answer(false)}
      title={tr('Protect your class data with a password?')}
      footer={
        <>
          <Button variant="secondary" onClick={() => answer(false)}>
            {tr('Later')}
          </Button>
          <Button variant="primary" onClick={() => answer(true)}>
            {tr('Turn on')}
          </Button>
        </>
      }
    >
      <div className="space-y-2 text-sm">
        <p className="flex items-start gap-2">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-[var(--color-success)]"
            aria-hidden
          />
          <span>
            {tr(
              'With a password, your classes are encrypted on this computer and EduBoard asks for it when it opens, so someone else using this computer can’t see your students. You get a recovery key in case you forget it.'
            )}
          </span>
        </p>
        {pilot && (
          <p className="font-medium">
            {tr('Strongly recommended in this pilot, especially on a shared or school computer.')}
          </p>
        )}
        <p className="text-[var(--color-text-muted)]">
          {tr('You can turn it on any time in Settings → Data and security.')}
        </p>
      </div>
    </Modal>
  )
}

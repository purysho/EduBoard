import { Modal } from './Modal'
import { Button } from './Button'
import { tr } from '@shared/i18n'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = tr('Confirm'),
  danger,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {tr('Cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
    </Modal>
  )
}

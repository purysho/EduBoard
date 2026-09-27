import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { tr } from '@shared/i18n'

interface State {
  ref: string | null
  failed: boolean
}

/** Catches a screen that fails to draw, so the rest of EduBoard keeps working: it logs
 * the error (EB-0901, with a reference) and offers a reload. Reset by `resetKey` (the
 * route), so moving to another screen tries again. */
export class ScreenErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  State
> {
  state: State = { ref: null, failed: false }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: Error): void {
    window.api.errorReport
      .logWindowError({
        message: error.message,
        stack: error.stack,
        where: location.hash.slice(1) || '/'
      })
      .then((ref) => this.setState({ ref }))
      .catch(() => this.setState({ ref: null }))
  }

  componentDidUpdate(prev: { resetKey?: string }): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, ref: null })
    }
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md space-y-3 text-center">
        <AlertTriangle size={28} className="mx-auto text-[var(--color-warning)]" aria-hidden />
        <h1 className="text-lg font-semibold">{tr('This screen couldn’t be shown')}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {tr(
            'Your data is safe. Reload to try again. If it happens again, copy the error report in Settings → Help and send it with this code:'
          )}
        </p>
        <p className="select-all font-mono text-sm">
          EB-0901{this.state.ref ? ` · ref ${this.state.ref}` : ''}
        </p>
        <button
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm text-white"
          onClick={() => location.reload()}
        >
          <RotateCcw size={13} aria-hidden />
          {tr('Reload')}
        </button>
      </div>
    )
  }
}

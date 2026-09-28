import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { tr } from '@shared/i18n'

/** Always on while EduBoard shows the sample school, so it's never mistaken for real
 * classes, with the way back. */
export function SampleSchoolBanner(): React.JSX.Element | null {
  const { data: inSample } = useQuery({
    queryKey: ['sampleSchool'],
    queryFn: () => window.api.sampleSchool.status(),
    staleTime: Infinity
  })
  if (!inSample) return null
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] px-4 py-2 text-sm"
    >
      <span className="flex items-center gap-2">
        <FlaskConical size={15} className="shrink-0 text-[var(--color-primary)]" aria-hidden />
        <span>
          <strong>{tr('Sample school.')}</strong>{' '}
          {tr(
            'Made-up classes and students to try everything with. Your own classes aren’t here and aren’t changed.'
          )}
        </span>
      </span>
      <span className="flex shrink-0 gap-3">
        <button
          type="button"
          className="text-[var(--color-text-muted)] hover:underline"
          onClick={() => void window.api.sampleSchool.open(true)}
        >
          {tr('Start over')}
        </button>
        <button
          type="button"
          className="font-medium text-[var(--color-primary)] hover:underline"
          onClick={() => void window.api.sampleSchool.leave()}
        >
          {tr('Back to my classes')}
        </button>
      </span>
    </div>
  )
}

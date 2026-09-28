import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { tr } from '@shared/i18n'

/** Settings → Help and updates: try EduBoard on made-up classes. */
export function SampleSchoolCard(): React.JSX.Element {
  const { data: inSample } = useQuery({
    queryKey: ['sampleSchool'],
    queryFn: () => window.api.sampleSchool.status(),
    staleTime: Infinity
  })
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <FlaskConical size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Sample school')}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {tr(
            'Two classes of made-up students with a term of scores, attendance, class points, homework, lesson plans and notes, to try EduBoard or show it to someone. It’s kept apart from your own classes, which it never reads or changes. EduBoard restarts to open it.'
          )}
        </p>
      </CardHeader>
      <CardBody className="flex flex-wrap gap-2">
        {inSample ? (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void window.api.sampleSchool.leave()}
            >
              {tr('Back to my classes')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void window.api.sampleSchool.open(true)}
            >
              {tr('Start the sample school over')}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => void window.api.sampleSchool.open()}>
            {tr('Open the sample school')}
          </Button>
        )}
      </CardBody>
    </Card>
  )
}

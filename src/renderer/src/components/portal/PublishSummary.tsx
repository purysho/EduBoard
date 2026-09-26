import type { PublishResult } from '@shared/types'

/** What a publish actually did: shown under both "Publish to portal" buttons. */
export function PublishSummary({ result }: { result: PublishResult }): React.JSX.Element {
  const sent = [
    result.attachmentsUploaded &&
      `${result.attachmentsUploaded} attachment${result.attachmentsUploaded === 1 ? '' : 's'}`,
    result.materialsUploaded &&
      `${result.materialsUploaded} study material${result.materialsUploaded === 1 ? '' : 's'}`
  ].filter(Boolean)
  return (
    <div className="space-y-1 text-xs">
      <p className="text-[var(--color-success)]">
        Published{sent.length ? `, including ${sent.join(' and ')}` : ''}.
      </p>
      {result.outdatedServer && (
        <p className="text-[var(--color-warning)]">
          Your Portal server is running an older version, so homework attachments and study material
          text weren&apos;t sent. Update the Portal server (see docs/TESTING_WITHOUT_A_TERMINAL.md)
          and publish again.
        </p>
      )}
      {result.studentsJoined > 0 && (
        <p className="text-[var(--color-success)]">
          {result.studentsJoined} new student{result.studentsJoined === 1 ? '' : 's'} joined through
          a class link and {result.studentsJoined === 1 ? 'was' : 'were'} added to your roster.
        </p>
      )}
      {result.skipped.length > 0 && (
        <p className="text-[var(--color-warning)]">Not sent: {result.skipped.join(', ')}.</p>
      )}
    </div>
  )
}

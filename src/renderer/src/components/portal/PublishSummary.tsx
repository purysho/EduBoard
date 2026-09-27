import type { PublishResult } from '@shared/types'
import { tr, trn } from '@shared/i18n'

/** What a publish actually did: shown under both "Publish to portal" buttons. */
export function PublishSummary({ result }: { result: PublishResult }): React.JSX.Element {
  const sent = [
    result.attachmentsUploaded &&
      trn('{n} attachment', '{n} attachments', result.attachmentsUploaded),
    result.materialsUploaded &&
      trn('{n} study material', '{n} study materials', result.materialsUploaded)
  ].filter(Boolean)
  return (
    <div className="space-y-1 text-xs">
      <p className="text-[var(--color-success)]">
        {sent.length
          ? tr('Published, including {list}.', { list: sent.join(tr(' and ')) })
          : tr('Published.')}
      </p>
      {result.outdatedServer && (
        <p className="text-[var(--color-warning)]">
          {tr(
            'Your Portal server is running an older version, so homework attachments and study material text weren’t sent. Update the Portal server (see docs/TESTING_WITHOUT_A_TERMINAL.md) and publish again.'
          )}
        </p>
      )}
      {result.studentsJoined > 0 && (
        <p className="text-[var(--color-success)]">
          {trn(
            '{n} new student joined through a class link and was added to your roster.',
            '{n} new students joined through a class link and were added to your roster.',
            result.studentsJoined
          )}
        </p>
      )}
      {result.skipped.length > 0 && (
        <p className="text-[var(--color-warning)]">
          {tr('Not sent: {join}.', { join: result.skipped.join(', ') })}
        </p>
      )}
    </div>
  )
}

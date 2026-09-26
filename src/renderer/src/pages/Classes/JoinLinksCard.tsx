import { useEffect, useState } from 'react'
import { Check, Copy, Link2, RefreshCw, UserPlus } from 'lucide-react'
import type { ClassSection, PortalJoinLink } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Input } from '@renderer/components/ui/Field'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useChangeJoinLink, useClassRoster, usePortalJoinLinks } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'

const linkUrl = (portalUrl: string, link: PortalJoinLink): string =>
  `${portalUrl || 'https://your-portal'}/?code=${link.code}`

function CopyButton({
  text,
  label = 'Copy link'
}: {
  text: string
  label?: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? (
        <Check size={13} className="mr-1 inline" aria-hidden />
      ) : (
        <Copy size={13} className="mr-1 inline" aria-hidden />
      )}
      {copied ? 'Copied' : label}
    </Button>
  )
}

/**
 * How students get onto the Portal for this class, without anyone seeing the class list:
 * one shareable class link where students type their own details, and a personal link
 * per student that greets them by name.
 */
export function JoinLinksCard({ classSection }: { classSection: ClassSection }): React.JSX.Element {
  const { data: overview, isLoading } = usePortalJoinLinks(classSection.id)
  const { data: roster } = useClassRoster(classSection.id)
  const change = useChangeJoinLink(classSection.id)
  // Keyed by the link it shows, so a reset link never shows the old link's QR code.
  const [qrFor, setQrFor] = useState<{ url: string; image: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const classUrl = overview?.classLink ? linkUrl(overview.portalUrl, overview.classLink) : null
  useEffect(() => {
    if (!classUrl) return
    let cancelled = false
    window.api.exitTickets.getQrDataUrl(classUrl).then((image) => {
      if (!cancelled) setQrFor({ url: classUrl, image })
    })
    return () => {
      cancelled = true
    }
  }, [classUrl])
  const qr = qrFor && qrFor.url === classUrl ? qrFor.image : null

  if (isLoading || !overview) return <Spinner />
  const accounts = overview.studentsWithAccounts ? new Set(overview.studentsWithAccounts) : null
  const activeRoster = (roster ?? []).filter((r) => r.enrollment.status === 'active')

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Link2 size={15} aria-hidden /> Class join link
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            One link for the whole class. Students open it, type their own name and date of birth,
            and choose a password. Nobody sees who else is in the class. If their name matches
            someone already on your roster, they&apos;re matched to that student; otherwise
            they&apos;re added to this class here the next time EduBoard syncs.
          </p>
        </CardHeader>
        <CardBody>
          {!overview.portalUrl && (
            <p className="mb-2 text-xs text-[var(--color-warning)]">
              Set your Portal URL in Settings first, so links point to the right place.
            </p>
          )}
          {overview.classLink && classUrl ? (
            <div className="flex flex-wrap items-start gap-4">
              {qr && (
                <img src={qr} alt="QR code for the class join link" className="h-28 w-28 rounded" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <Input readOnly value={classUrl} onFocus={(e) => e.target.select()} />
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={classUrl} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmReset(true)}
                    disabled={change.isPending}
                  >
                    <RefreshCw size={13} className="mr-1 inline" aria-hidden /> New link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => change.mutate({ type: 'turnOffClassLink' })}
                    disabled={change.isPending}
                  >
                    Turn off
                  </Button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Anyone with this link can join, so share it with your class only. Use New link if
                  it spreads further; the old one stops working.
                </p>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={() => change.mutate({ type: 'createClassLink' })}
              disabled={change.isPending}
            >
              Create class join link
            </Button>
          )}
          {change.isPending && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Updating the Portal…</p>
          )}
          {change.isError && (
            <p className="mt-2 text-xs text-[var(--color-danger)]">
              {ipcErrorMessage(
                change.error,
                'Saved here, but the Portal couldn’t be updated. Publish to try again.'
              )}
            </p>
          )}
          {change.isSuccess && change.data.studentsJoined > 0 && (
            <p className="mt-2 text-xs text-[var(--color-success)]">
              {change.data.studentsJoined} new student{change.data.studentsJoined === 1 ? '' : 's'}{' '}
              joined through the class link and {change.data.studentsJoined === 1 ? 'was' : 'were'}{' '}
              added to your roster.
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <UserPlus size={15} aria-hidden /> Personal invite links
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            A link for one student on your roster. It greets them by name and works once. If you
            recorded their date of birth, they must enter the same one.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {activeRoster.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
              No students in this class yet. Add students, or share the class join link.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {activeRoster.map(({ student }) => {
                const link = overview.studentLinks[student.id]
                const joined = accounts?.has(student.id)
                return (
                  <li key={student.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 text-sm">
                      {student.firstName} {student.lastName}
                    </span>
                    {joined ? (
                      <Badge tone="success">Has an account</Badge>
                    ) : link ? (
                      <>
                        <span className="font-mono text-xs text-[var(--color-text-muted)]">
                          {link.code}
                        </span>
                        <CopyButton text={linkUrl(overview.portalUrl, link)} />
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          change.mutate({ type: 'studentLink', studentId: student.id })
                        }
                        disabled={change.isPending}
                      >
                        Create link
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {accounts === null && (
            <p className="px-4 pb-3 text-xs text-[var(--color-text-muted)]">
              Couldn&apos;t check who already has an account (Portal not reachable).
            </p>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Make a new class link?"
        message="The current link will stop working. Students who already joined aren't affected."
        confirmLabel="New link"
        onConfirm={() => {
          setConfirmReset(false)
          change.mutate({ type: 'createClassLink' })
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  )
}

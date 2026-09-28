import { FormEvent, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BellRing, CheckSquare, Eye, Image as ImageIcon, Newspaper, Trash2 } from 'lucide-react'
import type { ClassPost, ClassSection, PostReplyKind } from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Textarea } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useClassPosts,
  useCreateClassPost,
  useDeleteClassPost,
  useRemindUnreplied,
  useSettings
} from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'
import { TemplatePicker } from '@renderer/components/TemplatePicker'
import { storyTemplates } from '@shared/templates'

export function ClassStoryTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: posts, isLoading } = useClassPosts(classSection.id)
  const createPost = useCreateClassPost(classSection.id)
  const deletePost = useDeleteClassPost()

  const [body, setBody] = useState('')
  const [imagePath, setImagePath] = useState<string | null>(null)
  // A reply slip (回执): families confirm they've read it, or answer yes / no.
  const [replyKind, setReplyKind] = useState<'' | PostReplyKind>('')
  const [replyQuestion, setReplyQuestion] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // A DingTalk / WeCom group to send the post to as well (Settings → Class group chats).
  const { data: settings } = useSettings()
  const groups = (settings?.groupChats ?? []).filter(
    (g) => !g.classId || g.classId === classSection.id
  )
  const [groupId, setGroupId] = useState<string | null>(null)
  const chosenGroup = groups.find(
    (g) => g.id === (groupId ?? groups.find((x) => x.classId === classSection.id)?.id ?? '')
  )
  const [groupStatus, setGroupStatus] = useState<{ ok: boolean; text: string } | null>(null)

  async function handlePickImage(): Promise<void> {
    const picked = await window.api.classPosts.pickImage()
    if (picked) setImagePath(picked)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!body.trim()) return
    await createPost.mutateAsync({
      body: body.trim(),
      imagePath,
      replySlip: replyKind
        ? { kind: replyKind, question: replyKind === 'yesno' ? replyQuestion.trim() || null : null }
        : null
    })
    setGroupStatus(null)
    if (chosenGroup) {
      try {
        await window.api.groupChats.send(chosenGroup.id, body.trim(), classSection.name)
        setGroupStatus({ ok: true, text: tr('Also sent to {name}.', { name: chosenGroup.name }) })
      } catch (err) {
        setGroupStatus({
          ok: false,
          text: tr('Posted, but not sent to {name}: {reason}', {
            name: chosenGroup.name,
            reason: ipcErrorMessage(err, tr('That didn’t work. Try again.'))
          })
        })
      }
    }
    setBody('')
    setImagePath(null)
    setReplyKind('')
    setReplyQuestion('')
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <Card className="mb-4">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-3">
            <TemplatePicker
              kind="story"
              builtIns={storyTemplates()}
              onPick={(choice) =>
                setBody(
                  'saved' in choice
                    ? (choice.saved.body ?? '')
                    : (storyTemplates().find((t) => t.id === choice.builtInId)?.body ?? '')
                )
              }
              current={() => (body.trim() ? { body } : null)}
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={tr('Share a quick update with families in this class…')}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" onClick={handlePickImage}>
                <ImageIcon size={13} className="mr-1 inline" aria-hidden />
                {imagePath ? tr('Change photo') : tr('Add photo')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!body.trim() || createPost.isPending}
              >
                {createPost.isPending ? tr('Posting…') : tr('Post to families')}
              </Button>
            </div>
            {imagePath && (
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                {imagePath.split(/[/\\]/).pop()}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <label className="flex items-center gap-2">
                {tr('Ask families to reply')}
                <select
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-xs"
                  value={replyKind}
                  onChange={(e) => setReplyKind(e.target.value as '' | PostReplyKind)}
                >
                  <option value="">{tr('No reply needed')}</option>
                  <option value="ack">{tr('“I’ve read this”')}</option>
                  <option value="yesno">{tr('A yes / no question')}</option>
                </select>
              </label>
              {replyKind === 'yesno' && (
                <input
                  aria-label={tr('The question')}
                  placeholder={tr('The question, e.g. “May your child come on the trip?”')}
                  value={replyQuestion}
                  maxLength={300}
                  onChange={(e) => setReplyQuestion(e.target.value)}
                  className="min-w-72 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)]"
                />
              )}
              {replyKind && (
                <span>{tr('You’ll see who has replied, and can remind the rest.')}</span>
              )}
            </div>
            {groups.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {tr('Also send to')}
                <select
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-xs"
                  value={chosenGroup?.id ?? ''}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">{tr('No group chat')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {chosenGroup && imagePath && (
                  <span>{tr('(text only; the photo stays on the Portal)')}</span>
                )}
              </label>
            )}
            {groupStatus && (
              <p
                role="status"
                className={`text-xs ${groupStatus.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
              >
                {groupStatus.text}
              </p>
            )}
          </form>
        </CardBody>
      </Card>

      {!posts?.length ? (
        <EmptyState
          icon={Newspaper}
          title={tr('No updates posted yet')}
          description={tr("Short posts here show up on every enrolled family's Portal dashboard.")}
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id}>
              <CardBody className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatDate(p.createdAt, 'MMM d, yyyy p')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{p.body}</p>
                  {p.hasImage && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {tr('📷 Photo attached')}
                    </p>
                  )}
                  <ReplySummary post={p} />
                  <SeenBy post={p} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(p.id)}>
                  <Trash2 size={13} className="mr-1 inline" aria-hidden />
                  {tr('Delete')}
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={tr('Delete post')}
        message={tr('Delete this update? Families will no longer see it.')}
        confirmLabel={tr('Delete')}
        danger
        onConfirm={async () => {
          if (pendingDelete) await deletePost.mutateAsync(pendingDelete)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

/** "Seen by 24 of 30 families", with who hasn't seen it yet. Nothing on an older Portal
 * that doesn't report it. */
function SeenBy({ post }: { post: ClassPost }): React.JSX.Element | null {
  if (post.seenCount === undefined || post.audience === undefined) return null
  const all = post.audience > 0 && post.seenCount === post.audience
  return (
    <details className="mt-1.5 text-xs text-[var(--color-text-muted)]">
      <summary className="flex cursor-pointer items-center gap-1 marker:content-none">
        <Eye size={12} aria-hidden className={all ? 'text-[var(--color-success)]' : undefined} />
        {tr('Seen by {seen} of {total} families', {
          seen: post.seenCount,
          total: post.audience
        })}
      </summary>
      <div className="mt-1 space-y-0.5 pl-4">
        {(post.notSeen?.length ?? 0) > 0 && (
          <p>{tr('Not seen yet: {names}', { names: post.notSeen!.join(', ') })}</p>
        )}
        {(post.noLogin ?? 0) > 0 && (
          <p>
            {trn(
              '{n} student has no Portal login yet, so their family can’t see posts.',
              '{n} students have no Portal login yet, so their families can’t see posts.',
              post.noLogin!
            )}
          </p>
        )}
        <p>{tr('A family has seen a post once they open the Portal after it went up.')}</p>
      </div>
    </details>
  )
}

/** The reply slip's answers: "Yes 12 · No 3 · Not replied 9" (or "Read 18 of 24"), who
 * hasn't replied, and a button that reminds them with a Portal message. */
function ReplySummary({ post }: { post: ClassPost }): React.JSX.Element | null {
  const remind = useRemindUnreplied()
  const [note, setNote] = useState<string | null>(null)
  if (!post.replyKind || !post.replies) return null
  const waiting = post.notReplied ?? []
  const answered = post.replyKind === 'ack' ? post.replies.ack : post.replies.yes + post.replies.no
  return (
    <div className="mt-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-xs">
      {post.replyQuestion && <p className="font-medium">{post.replyQuestion}</p>}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <CheckSquare size={12} aria-hidden className="text-[var(--color-text-muted)]" />
        {post.replyKind === 'ack' ? (
          <span>
            {tr('Confirmed by {n} of {total} families', {
              n: post.replies.ack,
              total: answered + waiting.length
            })}
          </span>
        ) : (
          <>
            <span>{tr('Yes: {n}', { n: post.replies.yes })}</span>
            <span>{tr('No: {n}', { n: post.replies.no })}</span>
            <span>{tr('Not replied: {n}', { n: waiting.length })}</span>
          </>
        )}
        {waiting.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={remind.isPending}
            onClick={async () => {
              try {
                const n = await remind.mutateAsync(post.id)
                setNote(
                  trn(
                    'Reminder sent to {n} family, as a Portal message.',
                    'Reminder sent to {n} families, as a Portal message.',
                    n
                  )
                )
              } catch (err) {
                setNote(ipcErrorMessage(err, tr('That didn’t work. Try again.')))
              }
            }}
          >
            <BellRing size={12} className="mr-1 inline" aria-hidden />
            {trn('Remind {n} family', 'Remind {n} families', waiting.length)}
          </Button>
        )}
      </p>
      {waiting.length > 0 && (
        <p className="mt-1 text-[var(--color-text-muted)]">
          {tr('Not replied yet: {names}', { names: waiting.join(', ') })}
        </p>
      )}
      {post.replyKind === 'yesno' && (post.answeredNo?.length ?? 0) > 0 && (
        <p className="mt-1 text-[var(--color-text-muted)]">
          {tr('Answered no: {names}', { names: post.answeredNo!.join(', ') })}
        </p>
      )}
      {note && (
        <p role="status" className="mt-1">
          {note}
        </p>
      )}
    </div>
  )
}

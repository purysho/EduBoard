import { FormEvent, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Image as ImageIcon, Newspaper, Trash2 } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Textarea } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useClassPosts, useCreateClassPost, useDeleteClassPost } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

export function ClassStoryTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: posts, isLoading } = useClassPosts(classSection.id)
  const createPost = useCreateClassPost(classSection.id)
  const deletePost = useDeleteClassPost()

  const [body, setBody] = useState('')
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  async function handlePickImage(): Promise<void> {
    const picked = await window.api.classPosts.pickImage()
    if (picked) setImagePath(picked)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!body.trim()) return
    await createPost.mutateAsync({ body: body.trim(), imagePath })
    setBody('')
    setImagePath(null)
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <Card className="mb-4">
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share a quick update with families in this class…"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" onClick={handlePickImage}>
                <ImageIcon size={13} className="mr-1 inline" aria-hidden />
                {imagePath ? 'Change photo' : 'Add photo'}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!body.trim() || createPost.isPending}
              >
                {createPost.isPending ? 'Posting…' : 'Post to families'}
              </Button>
            </div>
            {imagePath && (
              <p className="truncate text-xs text-[var(--color-text-muted)]">
                {imagePath.split(/[/\\]/).pop()}
              </p>
            )}
          </form>
        </CardBody>
      </Card>

      {!posts?.length ? (
        <EmptyState
          icon={Newspaper}
          title="No updates posted yet"
          description="Short posts here show up on every enrolled family's Portal dashboard."
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
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">📷 Photo attached</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(p.id)}>
                  <Trash2 size={13} className="mr-1 inline" aria-hidden />
                  Delete
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete post"
        message="Delete this update? Families will no longer see it."
        confirmLabel="Delete"
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

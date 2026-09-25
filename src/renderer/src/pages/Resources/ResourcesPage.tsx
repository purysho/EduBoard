import { useMemo, useState } from 'react'
import {
  ExternalLink,
  File,
  FolderOpen,
  Link2,
  Plus,
  Sparkles,
  StickyNote,
  Trash2
} from 'lucide-react'
import type { LessonResource } from '@shared/types'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useDeleteLessonResource,
  useDraftStudyGuide,
  useIndexResource,
  useLessonResources,
  useStandards
} from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { ResourceFormModal } from './ResourceFormModal'
import { PracticeSetModal } from './PracticeSetModal'

const TYPE_ICON = { link: Link2, file: File, note: StickyNote } as const

// The AI buttons index a resource themselves if needed, so they don't wait for "Index
// for Notebook". Only a resource with nothing to read hides them.
function canUseAi(resource: LessonResource): boolean {
  if (resource.type === 'note') return !!resource.notes?.trim()
  if (resource.type === 'link') return !!resource.url
  return !!resource.filePath
}

export function ResourcesPage(): React.JSX.Element {
  const { data: resources, isLoading } = useLessonResources()
  const { data: standards } = useStandards()
  const deleteResource = useDeleteLessonResource()
  const indexResource = useIndexResource()
  const draftStudyGuide = useDraftStudyGuide()
  const [indexingId, setIndexingId] = useState<string | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [guideId, setGuideId] = useState<string | null>(null)

  async function handleIndex(resource: LessonResource): Promise<void> {
    setIndexingId(resource.id)
    setIndexError(null)
    try {
      await indexResource.mutateAsync(resource.id)
    } catch (e) {
      setIndexError(ipcErrorMessage(e, `Could not index "${resource.title}".`))
    } finally {
      setIndexingId(null)
    }
  }

  async function handleStudyGuide(resource: LessonResource): Promise<void> {
    setGuideId(resource.id)
    setIndexError(null)
    try {
      await draftStudyGuide.mutateAsync(resource.id)
    } catch (e) {
      setIndexError(ipcErrorMessage(e, `Could not generate a study guide for "${resource.title}".`))
    } finally {
      setGuideId(null)
    }
  }

  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingResource, setEditingResource] = useState<LessonResource | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LessonResource | null>(null)
  const [practice, setPractice] = useState<{
    resourceId: string
    kind: 'flashcards' | 'quiz'
  } | null>(null)
  const practiceResource = practice
    ? resources?.find((r) => r.id === practice.resourceId)
    : undefined

  const standardById = new Map((standards ?? []).map((s) => [s.id, s]))

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const r of resources ?? []) for (const t of r.tags) set.add(t)
    return Array.from(set).sort()
  }, [resources])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (resources ?? []).filter((r) => {
      if (activeTag && !r.tags.includes(activeTag)) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [resources, search, activeTag])

  async function handleOpen(resource: LessonResource): Promise<void> {
    if (resource.type === 'link' && resource.url) {
      await window.api.lessonResources.openExternal(resource.url)
    } else if (resource.type === 'file' && resource.filePath) {
      await window.api.lessonResources.openPath(resource.filePath)
    }
  }

  return (
    <div>
      <PageHeader
        title="Resources"
        description="A searchable library of worksheets, slides, and links — tagged by topic and standard."
        actions={
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={15} className="mr-1 inline" aria-hidden />
            New resource
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, notes, tags…"
          className="max-w-xs"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs',
                  activeTag === tag
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]'
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {indexError && <p className="mb-4 text-sm text-[var(--color-danger)]">{indexError}</p>}

      {isLoading ? (
        <Spinner />
      ) : !resources?.length ? (
        <EmptyState
          icon={FolderOpen}
          title="No resources yet"
          description="Save links, files, and notes here as you build lessons — searchable by title, tag, or standard next time you need them."
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              New resource
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={FolderOpen}
          title="No matches"
          description="Try a different search or tag."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((resource) => {
            const Icon = TYPE_ICON[resource.type]
            const standard = resource.standardId ? standardById.get(resource.standardId) : null
            const openable = resource.type !== 'note'
            return (
              <Card key={resource.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="flex items-start gap-2 text-left"
                      onClick={() =>
                        openable ? handleOpen(resource) : setEditingResource(resource)
                      }
                    >
                      <Icon
                        size={15}
                        className="mt-0.5 shrink-0 text-[var(--color-text-muted)]"
                        aria-hidden
                      />
                      <h3 className="font-semibold hover:text-[var(--color-primary)]">
                        {resource.title}
                      </h3>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      {openable && (
                        <button
                          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
                          onClick={() => handleOpen(resource)}
                          aria-label="Open"
                        >
                          <ExternalLink size={13} aria-hidden />
                        </button>
                      )}
                      <button
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => setPendingDelete(resource)}
                        aria-label="Delete"
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </div>
                  </div>
                  {resource.notes && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                      {resource.notes}
                    </p>
                  )}
                  {(resource.tags.length > 0 || standard || resource.shareWithStudents) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {standard && <Badge tone="primary">{standard.code}</Badge>}
                      {resource.shareWithStudents && (
                        <Badge tone="success">Shared with students</Badge>
                      )}
                      {resource.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                      onClick={() => setEditingResource(resource)}
                    >
                      Edit
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                        onClick={() => handleIndex(resource)}
                        disabled={indexingId === resource.id}
                      >
                        <Sparkles size={12} aria-hidden />
                        {indexingId === resource.id
                          ? 'Indexing…'
                          : resource.indexedAt
                            ? 'Re-index'
                            : 'Index for Notebook'}
                      </button>
                      {canUseAi(resource) && (
                        <button
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                          onClick={() => handleStudyGuide(resource)}
                          disabled={guideId === resource.id}
                        >
                          <Sparkles size={12} aria-hidden />
                          {guideId === resource.id
                            ? 'Writing…'
                            : resource.studyGuide
                              ? 'Regenerate study guide'
                              : 'Study guide'}
                        </button>
                      )}
                      {canUseAi(resource) && (
                        <button
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          onClick={() =>
                            setPractice({ resourceId: resource.id, kind: 'flashcards' })
                          }
                        >
                          <Sparkles size={12} aria-hidden />
                          Flashcards{resource.flashcards ? ` (${resource.flashcards.length})` : ''}
                        </button>
                      )}
                      {canUseAi(resource) && (
                        <button
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          onClick={() => setPractice({ resourceId: resource.id, kind: 'quiz' })}
                        >
                          <Sparkles size={12} aria-hidden />
                          Practice quiz
                          {resource.practiceQuiz ? ` (${resource.practiceQuiz.length})` : ''}
                        </button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <ResourceFormModal open={showAdd} onClose={() => setShowAdd(false)} />
      {practice && practiceResource && (
        <PracticeSetModal
          resource={practiceResource}
          kind={practice.kind}
          onClose={() => setPractice(null)}
        />
      )}
      {editingResource && (
        <ResourceFormModal
          open
          onClose={() => setEditingResource(null)}
          resource={editingResource}
        />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete resource"
        message={`Delete "${pendingDelete?.title}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (pendingDelete) await deleteResource.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

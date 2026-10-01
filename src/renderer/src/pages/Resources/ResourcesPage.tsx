import { useMemo, useState } from 'react'
import {
  ClipboardCheck,
  Download,
  ExternalLink,
  File,
  FileText,
  FolderOpen,
  Link2,
  Plus,
  Presentation,
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
  useIndexResource,
  useLessonResources,
  useStandards
} from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { ResourceFormModal } from './ResourceFormModal'
import { PracticeSetModal, type StudyMaterialKind } from './PracticeSetModal'
import { hasUncheckedAiMaterial } from '@renderer/lib/aiMaterial'
import { StudyProgressModal } from './StudyProgressModal'
import { tr } from '@shared/i18n'

const TYPE_ICON = { link: Link2, file: File, note: StickyNote } as const

export function ResourcesPage(): React.JSX.Element {
  const { data: resources, isLoading } = useLessonResources()
  const { data: standards } = useStandards()
  const deleteResource = useDeleteLessonResource()
  const indexResource = useIndexResource()
  const [indexingId, setIndexingId] = useState<string | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  async function handleIndex(resource: LessonResource): Promise<void> {
    setIndexingId(resource.id)
    setIndexError(null)
    try {
      await indexResource.mutateAsync(resource.id)
    } catch (e) {
      setIndexError(ipcErrorMessage(e, tr('Could not index "{title}".', { title: resource.title })))
    } finally {
      setIndexingId(null)
    }
  }

  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingResource, setEditingResource] = useState<LessonResource | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LessonResource | null>(null)
  const [progressResource, setProgressResource] = useState<LessonResource | null>(null)
  const [practice, setPractice] = useState<{
    resourceId: string
    kind: StudyMaterialKind
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

  async function handleOfflinePack(resource: LessonResource): Promise<void> {
    setExportingId(resource.id)
    setExportMessage(null)
    try {
      const result = await window.api.lessonResources.exportOfflinePack(resource.id)
      if (result.saved) {
        setExportMessage(tr('Offline Study Pack saved. Students can open the HTML file without internet.'))
      }
    } catch (e) {
      setExportMessage(ipcErrorMessage(e, tr('Could not export the Offline Study Pack.')))
    } finally {
      setExportingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Resources')}
        description={tr(
          'A searchable library of worksheets, slides, and links — tagged by topic and standard.'
        )}
        actions={
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={15} className="mr-1 inline" aria-hidden />
            {tr('New resource')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr('Search title, notes, tags…')}
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
      {exportMessage && (
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">{exportMessage}</p>
      )}

      {isLoading ? (
        <Spinner />
      ) : !resources?.length ? (
        <EmptyState
          icon={FolderOpen}
          title={tr('No resources yet')}
          description={tr(
            'Save links, files, and notes here as you build lessons — searchable by title, tag, or standard next time you need them.'
          )}
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              {tr('New resource')}
            </Button>
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={FolderOpen}
          title={tr('No matches')}
          description={tr('Try a different search or tag.')}
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((resource) => {
            const Icon = TYPE_ICON[resource.type]
            const standard = resource.standardId ? standardById.get(resource.standardId) : null
            const openable = resource.type !== 'note'
            const hasStudentContent =
              !!resource.notes?.trim() ||
              (!!resource.studyGuide && !!resource.aiApproved?.studyGuide) ||
              (!!resource.flashcards?.length && !!resource.aiApproved?.flashcards) ||
              (!!resource.practiceQuiz?.length && !!resource.aiApproved?.practiceQuiz)
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
                      <button
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                        onClick={() => handleOfflinePack(resource)}
                        disabled={exportingId === resource.id}
                        aria-label={tr('Export Offline Study Pack')}
                        title={tr('Export Offline Study Pack')}
                      >
                        <Download size={13} aria-hidden />
                      </button>
                      <button
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
                        onClick={() => setProgressResource(resource)}
                        aria-label={tr('Offline study progress')}
                        title={tr('Import or view returned offline progress')}
                      >
                        <ClipboardCheck size={13} aria-hidden />
                      </button>
                      {openable && (
                        <button
                          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)]"
                          onClick={() => handleOpen(resource)}
                          aria-label={tr('Open')}
                        >
                          <ExternalLink size={13} aria-hidden />
                        </button>
                      )}
                      <button
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => setPendingDelete(resource)}
                        aria-label={tr('Delete')}
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
                        <Badge tone="success">{tr('Shared with students')}</Badge>
                      )}
                      {hasUncheckedAiMaterial(resource) && (
                        <Badge tone="warning">{tr('AI draft to check')}</Badge>
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
                      {tr('Edit')}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                        onClick={() => handleIndex(resource)}
                        disabled={indexingId === resource.id}
                      >
                        <Sparkles size={12} aria-hidden />
                        {indexingId === resource.id
                          ? tr('Indexing…')
                          : resource.indexedAt
                            ? tr('Re-index')
                            : tr('Index for Notebook')}
                      </button>
                      <button
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          onClick={() => setPractice({ resourceId: resource.id, kind: 'guide' })}
                        >
                          <Sparkles size={12} aria-hidden />
                          {tr('Study guide')}
                        </button>
                      <button
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          onClick={() =>
                            setPractice({ resourceId: resource.id, kind: 'flashcards' })
                          }
                        >
                          <Sparkles size={12} aria-hidden />
                          {tr('Flashcards{count}', {
                            count: resource.flashcards ? ` (${resource.flashcards.length})` : ''
                          })}
                        </button>
                      <button
                          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                          onClick={() => setPractice({ resourceId: resource.id, kind: 'quiz' })}
                        >
                          <Sparkles size={12} aria-hidden />
                          {tr('Practice quiz{count}', {
                            count: resource.practiceQuiz ? ` (${resource.practiceQuiz.length})` : ''
                          })}
                        </button>
                      {hasStudentContent && (
                        <>
                          <button
                            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            onClick={() => void window.api.office.resourceWorksheet(resource.id)}
                            title={tr('Editable student worksheet for Word or WPS')}
                          >
                            <FileText size={12} aria-hidden />
                            {tr('Worksheet')}
                          </button>
                          <button
                            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            onClick={() => void window.api.office.resourceSlides(resource.id)}
                            title={tr('Projector-ready PowerPoint practice deck')}
                          >
                            <Presentation size={12} aria-hidden />
                            {tr('Practice deck')}
                          </button>
                        </>
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
      {progressResource && (
        <StudyProgressModal
          resource={progressResource}
          onClose={() => setProgressResource(null)}
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
        title={tr('Delete resource')}
        message={tr('Delete "{title}"?', { title: pendingDelete?.title })}
        confirmLabel={tr('Delete')}
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

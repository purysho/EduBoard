import { FormEvent, useState } from 'react'
import type { LessonResource, LessonResourceType } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import {
  useClasses,
  useCreateLessonResource,
  useStandards,
  useUpdateLessonResource
} from '@renderer/lib/queries'

const TYPE_LABELS: Record<LessonResourceType, string> = {
  link: 'Link',
  file: 'File',
  note: 'Note'
}

export function ResourceFormModal({
  open,
  onClose,
  resource
}: {
  open: boolean
  onClose: () => void
  resource?: LessonResource
}): React.JSX.Element {
  const isEdit = !!resource
  const createResource = useCreateLessonResource()
  const updateResource = useUpdateLessonResource()
  const { data: standards } = useStandards()
  const { data: classes } = useClasses()

  const [title, setTitle] = useState(resource?.title ?? '')
  const [type, setType] = useState<LessonResourceType>(resource?.type ?? 'link')
  const [url, setUrl] = useState(resource?.url ?? '')
  const [filePath, setFilePath] = useState(resource?.filePath ?? '')
  const [notes, setNotes] = useState(resource?.notes ?? '')
  const [tagsText, setTagsText] = useState(resource?.tags.join(', ') ?? '')
  const [standardId, setStandardId] = useState(resource?.standardId ?? '')
  const [classId, setClassId] = useState(resource?.classId ?? '')
  const [shareWithStudents, setShareWithStudents] = useState(resource?.shareWithStudents ?? false)
  const [picking, setPicking] = useState(false)

  // The "new resource" modal instance stays mounted between opens (only `open` toggles,
  // not the component itself), so without this its fields would carry over from
  // whatever was last typed. Reset from `resource` (or blank, for create) each time the
  // modal transitions from closed to open — during render, not an effect, matching the
  // codebase's established resync pattern (see ScoreCell's lastSeenPoints).
  const [wasOpen, setWasOpen] = useState(open)
  if (open && !wasOpen) {
    setWasOpen(true)
    setTitle(resource?.title ?? '')
    setType(resource?.type ?? 'link')
    setUrl(resource?.url ?? '')
    setFilePath(resource?.filePath ?? '')
    setNotes(resource?.notes ?? '')
    setTagsText(resource?.tags.join(', ') ?? '')
    setStandardId(resource?.standardId ?? '')
    setClassId(resource?.classId ?? '')
    setShareWithStudents(resource?.shareWithStudents ?? false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const saving = createResource.isPending || updateResource.isPending

  async function handlePickFile(): Promise<void> {
    setPicking(true)
    try {
      const path = await window.api.lessonResources.pickFile()
      if (path) setFilePath(path)
    } finally {
      setPicking(false)
    }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const payload = {
      title: title.trim(),
      type,
      url: type === 'link' ? url.trim() || null : null,
      filePath: type === 'file' ? filePath.trim() || null : null,
      notes: notes.trim() || null,
      tags,
      standardId: standardId || null,
      classId: classId || null,
      shareWithStudents: classId ? shareWithStudents : false,
      studyGuide: resource?.studyGuide ?? null
    }

    if (isEdit) {
      await updateResource.mutateAsync({ id: resource.id, patch: payload })
    } else {
      await createResource.mutateAsync(payload)
    }
    onClose()
  }

  const canSave =
    title.trim().length > 0 &&
    (type !== 'link' || url.trim().length > 0) &&
    (type !== 'file' || filePath.trim().length > 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit resource' : 'New resource'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="resource-form"
            disabled={!canSave || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="resource-form" onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Title" hint='e.g. "Fractions worksheet", "Photosynthesis slides"'>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </FormRow>

        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as LessonResourceType)}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Standard (optional)">
            <Select value={standardId} onChange={(e) => setStandardId(e.target.value)}>
              <option value="">None</option>
              {standards?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>

        {type === 'link' && (
          <FormRow label="URL">
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </FormRow>
        )}

        {type === 'file' && (
          <FormRow label="File">
            <div className="flex items-center gap-2">
              <Input value={filePath} readOnly placeholder="No file selected" className="flex-1" />
              <Button variant="secondary" type="button" onClick={handlePickFile} disabled={picking}>
                {picking ? 'Picking…' : 'Choose file'}
              </Button>
            </div>
          </FormRow>
        )}

        <FormRow label={type === 'note' ? 'Note' : 'Notes (optional)'}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </FormRow>

        <FormRow label="Tags" hint="Comma-separated, e.g. fractions, unit 3, grade 5">
          <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </FormRow>

        <FormRow
          label="Class (optional)"
          hint="Link this to a class to make it eligible for sharing with students on the Portal"
        >
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Personal library only</option>
            {classes?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormRow>

        {classId && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shareWithStudents}
              onChange={(e) => setShareWithStudents(e.target.checked)}
            />
            Share with this class&apos;s students on the Portal (index it first in Notebook so it
            has searchable content)
          </label>
        )}
      </form>
    </Modal>
  )
}

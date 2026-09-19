import { FormEvent, useState } from 'react'
import type { ClassSection, LevelType } from '@shared/types'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { useCreateClass, useSettings, useTerms, useUpdateClass } from '@renderer/lib/queries'

const LEVEL_OPTIONS: { value: LevelType; label: string }[] = [
  { value: 'k12', label: 'K-12' },
  { value: 'university', label: 'University' },
  { value: 'club', label: 'Club / activity' },
  { value: 'other', label: 'Other' }
]

interface ClassFormModalProps {
  open: boolean
  onClose: () => void
  classSection?: ClassSection
}

export function ClassFormModal({
  open,
  onClose,
  classSection
}: ClassFormModalProps): React.JSX.Element {
  const isEdit = !!classSection
  const { data: terms } = useTerms()
  const { data: settings } = useSettings()
  const createClass = useCreateClass()
  const updateClass = useUpdateClass()

  const [name, setName] = useState(classSection?.name ?? '')
  const [subject, setSubject] = useState(classSection?.subject ?? '')
  const [levelType, setLevelType] = useState<LevelType>(classSection?.levelType ?? 'k12')
  const [gradeLevel, setGradeLevel] = useState(classSection?.gradeLevel ?? '')
  const [termId, setTermId] = useState(classSection?.termId ?? '')
  const [schedule, setSchedule] = useState(classSection?.schedule ?? '')
  const [room, setRoom] = useState(classSection?.room ?? '')

  const saving = createClass.isPending || updateClass.isPending

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const payload = {
      name: name.trim(),
      subject: subject.trim() || null,
      levelType,
      gradeLevel: gradeLevel.trim() || null,
      termId: termId || null,
      schedule: schedule.trim() || null,
      room: room.trim() || null,
      color: classSection?.color ?? null,
      passMark: classSection?.passMark ?? settings?.defaultPassMark ?? 60,
      maxScore: classSection?.maxScore ?? settings?.defaultMaxScore ?? 100,
      gradeThresholds:
        classSection?.gradeThresholds ??
        settings?.defaultGradeThresholds ??
        DEFAULT_GRADE_THRESHOLDS
    }

    if (isEdit) {
      await updateClass.mutateAsync({ id: classSection.id, patch: payload })
    } else {
      await createClass.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit class' : 'New class'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="class-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="class-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <FormRow
            label="Class name"
            hint='e.g. "Grade 5 Homeroom", "AP English 11", "Robotics Club"'
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </FormRow>
        </div>
        <FormRow label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </FormRow>
        <FormRow label="Level">
          <Select value={levelType} onChange={(e) => setLevelType(e.target.value as LevelType)}>
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Grade level / year" hint='e.g. "Grade 5", "Year 2"'>
          <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
        </FormRow>
        <FormRow label="Term">
          <Select value={termId} onChange={(e) => setTermId(e.target.value)}>
            <option value="">No term</option>
            {(terms ?? []).map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Schedule" hint="e.g. Mon/Wed/Fri 9:00–9:50">
          <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} />
        </FormRow>
        <FormRow label="Room">
          <Input value={room} onChange={(e) => setRoom(e.target.value)} />
        </FormRow>
      </form>
    </Modal>
  )
}

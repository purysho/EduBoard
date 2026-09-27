import { FormEvent, useState } from 'react'
import type { Student } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Textarea } from '@renderer/components/ui/Field'
import {
  useCreateStudent,
  useEnrollStudent,
  useUpdateStudent,
  useSettings
} from '@renderer/lib/queries'
import { todayIso } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

interface StudentFormModalProps {
  open: boolean
  onClose: () => void
  student?: Student
  /** When set (and creating, not editing), the new student is also enrolled in this class. */
  enrollInClassId?: string
}

export function StudentFormModal({
  open,
  onClose,
  student,
  enrollInClassId
}: StudentFormModalProps): React.JSX.Element {
  const isEdit = !!student
  const createStudent = useCreateStudent()
  const updateStudent = useUpdateStudent()
  const enrollStudent = useEnrollStudent(enrollInClassId ?? '')

  const [firstName, setFirstName] = useState(student?.firstName ?? '')
  const [lastName, setLastName] = useState(student?.lastName ?? '')
  const [preferredName, setPreferredName] = useState(student?.preferredName ?? '')
  const [studentNumber, setStudentNumber] = useState(student?.studentNumber ?? '')
  const [gradeLevel, setGradeLevel] = useState(student?.gradeLevel ?? '')
  const [email, setEmail] = useState(student?.email ?? '')
  const [guardianName, setGuardianName] = useState(student?.guardianName ?? '')
  const [guardianContact, setGuardianContact] = useState(student?.guardianContact ?? '')
  const [notes, setNotes] = useState(student?.notes ?? '')
  const { data: settings } = useSettings()
  const fields = settings?.studentFields ?? []
  const [custom, setCustom] = useState<Record<string, string>>(student?.customFields ?? {})

  const saving = createStudent.isPending || updateStudent.isPending

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      preferredName: preferredName.trim() || null,
      studentNumber: studentNumber.trim() || null,
      dateOfBirth: student?.dateOfBirth ?? null,
      gradeLevel: gradeLevel.trim() || null,
      guardianName: guardianName.trim() || null,
      guardianContact: guardianContact.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      customFields: Object.fromEntries(
        Object.entries(custom)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v)
      )
    }

    if (isEdit) {
      await updateStudent.mutateAsync({ id: student.id, patch: payload })
    } else {
      const created = await createStudent.mutateAsync(payload)
      if (enrollInClassId) {
        await enrollStudent.mutateAsync({
          studentId: created.id,
          classId: enrollInClassId,
          enrolledOn: todayIso()
        })
      }
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? tr('Edit student') : tr('Add student')}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr('Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="student-form" disabled={saving}>
            {saving ? tr('Saving…') : tr('Save')}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <FormRow label={tr('First name')}>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
          />
        </FormRow>
        <FormRow label={tr('Last name')}>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </FormRow>
        <FormRow label={tr('Preferred name')} hint={tr('Optional, shown instead of first name')}>
          <Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
        </FormRow>
        <FormRow label={tr('Student number / ID')}>
          <Input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
        </FormRow>
        <FormRow
          label={tr('Grade level / cohort')}
          hint={tr('e.g. "Grade 5", "Sophomore", "Chess Club"')}
        >
          <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
        </FormRow>
        <FormRow label={tr('Email')}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormRow>
        <FormRow label={tr('Guardian name')}>
          <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
        </FormRow>
        <FormRow label={tr('Guardian contact')}>
          <Input value={guardianContact} onChange={(e) => setGuardianContact(e.target.value)} />
        </FormRow>
        {fields.map((f) => (
          <FormRow key={f.id} label={f.label}>
            <Input
              value={custom[f.id] ?? ''}
              onChange={(e) => setCustom({ ...custom, [f.id]: e.target.value })}
            />
          </FormRow>
        ))}
        <div className="col-span-2">
          <FormRow label={tr('Notes')}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormRow>
        </div>
      </form>
    </Modal>
  )
}

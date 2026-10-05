import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Textarea } from '@renderer/components/ui/Field'
import { useClassAiProfile, useSaveClassAiProfile } from '@renderer/lib/queries'
import {
  CLASS_AI_PROFILE_FIELDS,
  CLASS_AI_PROFILE_MAX_CHARS,
  type ClassAiProfile
} from '@shared/classAiProfile'
import { tr } from '@shared/i18n'

const FIELD_TEXT: Record<keyof ClassAiProfile, { label: string; placeholder: string }> = {
  level: {
    label: tr("Students' level and background"),
    placeholder: tr('e.g. First-year university, A1–B1, several near zero')
  },
  lessonShape: {
    label: tr('Lesson length and structure'),
    placeholder: tr('e.g. 45 min + 10 min break + 45 min')
  },
  languageUse: {
    label: tr("Use of the students' first language"),
    placeholder: tr('e.g. Chinese for planning only; the task itself in English')
  },
  routines: {
    label: tr('Routines to include in every lesson'),
    placeholder: tr('e.g. rehearse in pairs before anyone speaks alone; exit ticket')
  },
  avoid: {
    label: tr('Avoid'),
    placeholder: tr('e.g. open questions to the whole class; long teacher talk')
  },
  notes: { label: tr('Anything else'), placeholder: tr('e.g. most students are silent at first') }
}

/** How the teacher teaches this class, in their own words. AI drafts for the class follow it. */
export function ClassAiProfileCard({ classId }: { classId: string }): React.JSX.Element {
  const { data } = useClassAiProfile(classId)
  // Kept here, not in the form: saving replaces the data, which remounts the form.
  const save = useSaveClassAiProfile(classId)
  return (
    <Card className="col-span-2 h-fit">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Teaching profile for AI drafts')}
        </h2>
      </CardHeader>
      <CardBody>
        {/* Remount when the saved profile arrives so the boxes start from it. */}
        {data && <ProfileForm key={JSON.stringify(data)} saved={data} save={save} />}
      </CardBody>
    </Card>
  )
}

function ProfileForm({
  saved,
  save
}: {
  saved: ClassAiProfile
  save: ReturnType<typeof useSaveClassAiProfile>
}): React.JSX.Element {
  const [profile, setProfile] = useState<ClassAiProfile>(saved)
  const changed = CLASS_AI_PROFILE_FIELDS.some((key) => profile[key] !== saved[key])

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-muted)]">
        {tr(
          'Describe how you teach this class. Every lesson plan drafted with AI for this class follows it. It describes the class, never a student.'
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {CLASS_AI_PROFILE_FIELDS.map((key) => (
          <FormRow key={key} label={FIELD_TEXT[key].label}>
            <Textarea
              rows={2}
              maxLength={CLASS_AI_PROFILE_MAX_CHARS}
              value={profile[key]}
              placeholder={FIELD_TEXT[key].placeholder}
              onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
            />
          </FormRow>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => save.mutate(profile)}
          disabled={!changed || save.isPending}
        >
          {tr('Save')}
        </Button>
        {save.isSuccess && !changed && (
          <span className="text-xs text-[var(--color-text-muted)]">{tr('Saved.')}</span>
        )}
      </div>
    </div>
  )
}

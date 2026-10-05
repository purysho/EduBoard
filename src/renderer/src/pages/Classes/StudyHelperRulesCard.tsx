import { useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { useClassHelperRules, useSaveClassHelperRules } from '@renderer/lib/queries'
import {
  HELPER_RULE_LIMITS,
  type HelperReplyLanguage,
  type StudyHelperRules
} from '@shared/studyHelperRules'
import { tr } from '@shared/i18n'

const LANGUAGE_LABELS: Record<HelperReplyLanguage, string> = {
  '': tr('Let each student choose'),
  english: tr('Simple English'),
  'english-gloss': tr("Simple English, hard words explained in the student's language"),
  own: tr("The student's own language")
}

/** How the Study Helper on the Portal talks to this class's students. The teacher's rules
 * come before each student's own choices. */
export function StudyHelperRulesCard({ classId }: { classId: string }): React.JSX.Element {
  const { data } = useClassHelperRules(classId)
  // Kept here, not in the form: saving replaces the data, which remounts the form.
  const save = useSaveClassHelperRules(classId)
  return (
    <Card className="col-span-2 h-fit">
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessageCircleQuestion size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Study Helper rules (Portal)')}
        </h2>
      </CardHeader>
      <CardBody>
        {data && <RulesForm key={JSON.stringify(data)} saved={data} save={save} />}
      </CardBody>
    </Card>
  )
}

function RulesForm({
  saved,
  save
}: {
  saved: StudyHelperRules
  save: ReturnType<typeof useSaveClassHelperRules>
}): React.JSX.Element {
  const [rules, setRules] = useState<StudyHelperRules>(saved)
  const changed = (Object.keys(rules) as (keyof StudyHelperRules)[]).some(
    (key) => rules[key] !== saved[key]
  )
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-muted)]">
        {tr(
          "How the Study Helper talks to this class's students on the Portal. Your rules come before each student's own choices. They reach the Portal when you next publish."
        )}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label={tr('Reply language')}>
          <Select
            value={rules.replyLanguage}
            onChange={(e) =>
              setRules((r) => ({ ...r, replyLanguage: e.target.value as HelperReplyLanguage }))
            }
          >
            {(Object.keys(LANGUAGE_LABELS) as HelperReplyLanguage[]).map((value) => (
              <option key={value} value={value}>
                {LANGUAGE_LABELS[value]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label={tr('Vocabulary and sentence level')}>
          <Input
            maxLength={HELPER_RULE_LIMITS.vocabulary}
            value={rules.vocabulary}
            placeholder={tr('e.g. A2: short sentences, common words')}
            onChange={(e) => setRules((r) => ({ ...r, vocabulary: e.target.value }))}
          />
        </FormRow>
        <div className="col-span-2">
          <FormRow label={tr('Your rules')}>
            <Textarea
              rows={2}
              maxLength={HELPER_RULE_LIMITS.rules}
              value={rules.rules}
              placeholder={tr(
                'e.g. Never write sentences for their speaking script; ask them to say it first.'
              )}
              onChange={(e) => setRules((r) => ({ ...r, rules: e.target.value }))}
            />
          </FormRow>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => save.mutate(rules)}
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

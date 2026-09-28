import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, FileText, Mail, Megaphone, MessagesSquare, Sparkles, Wand2 } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { useClasses, useSettings } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import {
  assembleNewsletter,
  newsletterStructures,
  type NewsletterFact,
  type NewsletterStructure
} from '@shared/newsletter'
import type { NewsletterSourceChoice } from '@shared/summaries'
import { tr } from '@shared/i18n'

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm'
const OLD_DRAFT_KEY = 'eduboard.newsletterDraft'

/** Sunday at the end of this week, when a newsletter added to the digest drops out. */
function endOfWeek(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}

/**
 * Newsletters: choose who it's for and a structure, tick this week's facts and add notes,
 * then EduBoard arranges them (or AI suggests the wording, from those facts only). The
 * teacher edits the result, then adds it to the family digest, posts it to Class Story or
 * copies it.
 */
export function NewsletterPage(): React.JSX.Element {
  const { data: classes } = useClasses()
  const { data: settings } = useSettings()
  const structures = newsletterStructures()
  const [classIds, setClassIds] = useState<string[] | null>(null)
  const chosenClasses = classIds ?? (classes ?? []).map((c) => c.id)
  const [structure, setStructure] = useState<NewsletterStructure>('friendly')
  const [customSections, setCustomSections] = useState('')
  const [include, setInclude] = useState({
    lessons: true,
    upcoming: true,
    homework: true,
    posts: true,
    numbers: false
  })
  const [dropped, setDropped] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  // The draft is kept in the database with the rest of this school's data, so it stays
  // with the right school (the sample school is separate) and is protected by the password.
  const [draft, setDraftText] = useState('')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let saved = await window.api.newsletter.savedDraft()
      // Older versions kept the draft in the window's own storage, which the sample school
      // shared: move it into the teacher's own data (never the sample school's), once.
      try {
        const old = localStorage.getItem(OLD_DRAFT_KEY)
        if (old !== null && !(await window.api.sampleSchool.status())) {
          if (old && !saved) {
            saved = old
            await window.api.newsletter.saveDraft(old)
          }
          localStorage.removeItem(OLD_DRAFT_KEY)
        }
      } catch {
        // Nothing to move.
      }
      if (!cancelled) setDraftText(saved)
    })()
    return () => {
      cancelled = true
    }
  }, [])
  function setDraft(text: string): void {
    setDraftText(text)
    window.api.newsletter.saveDraft(text).catch(() => {
      // A draft that isn't kept is only an inconvenience.
    })
  }
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const choice: NewsletterSourceChoice = { classIds: chosenClasses, ...include }
  const { data: facts, isFetching } = useQuery({
    queryKey: ['newsletterFacts', choice],
    queryFn: () => window.api.newsletter.facts(choice),
    enabled: chosenClasses.length > 0
  })
  const keep = useMemo(() => {
    const noteFacts: NewsletterFact[] = notes
      .split('\n')
      .map((l) => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean)
      .map((text) => ({ kind: 'note', text }))
    return [...(facts ?? []).filter((f) => !dropped.has(f.text)), ...noteFacts]
  }, [facts, dropped, notes])
  const sections = customSections
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const info = structures.find((s) => s.id === structure)!

  // DingTalk / WeCom groups from Settings; the one for the chosen class comes first.
  const groups = settings?.groupChats ?? []
  const [groupId, setGroupId] = useState<string | null>(null)
  const group =
    groups.find((g) => g.id === groupId) ??
    groups.find((g) => g.classId && chosenClasses.includes(g.classId)) ??
    groups[0]

  async function run(label: string, action: () => Promise<string | void>): Promise<void> {
    setBusy(label)
    setMessage(null)
    try {
      const ok = await action()
      if (ok) setMessage({ ok: true, text: ok })
    } catch (err) {
      setMessage({ ok: false, text: ipcErrorMessage(err, tr('That didn’t work. Try again.')) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={tr('Newsletter')}
        description={tr(
          'Put this week’s lessons, homework and news into a newsletter for families, students or school leaders. Nothing about any single student goes in.'
        )}
      />
      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <h2 className="text-sm font-semibold">{tr('What goes in')}</h2>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <fieldset>
              <legend className="mb-1 font-medium">{tr('Classes')}</legend>
              <div className="max-h-32 space-y-1 overflow-auto">
                {(classes ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={chosenClasses.includes(c.id)}
                      onChange={(e) =>
                        setClassIds(
                          e.target.checked
                            ? [...chosenClasses, c.id]
                            : chosenClasses.filter((id) => id !== c.id)
                        )
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1 block font-medium">
                {tr('Who it’s for, and how it’s set out')}
              </span>
              <select
                className={inputClass}
                value={structure}
                onChange={(e) => setStructure(e.target.value as NewsletterStructure)}
              >
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                {info.forWhom}
                {info.sections.length > 0 && ` (${info.sections.join(' · ')})`}
              </span>
            </label>
            {structure === 'custom' && (
              <textarea
                aria-label={tr('Your section headings')}
                className={inputClass}
                rows={3}
                placeholder={tr('One heading per line, e.g.\nThis week\nDates for your diary')}
                value={customSections}
                onChange={(e) => setCustomSections(e.target.value)}
              />
            )}
            <fieldset>
              <legend className="mb-1 font-medium">{tr('Include')}</legend>
              {(
                [
                  ['lessons', tr('Lessons taught this week')],
                  ['upcoming', tr('Lessons coming up')],
                  ['homework', tr('Homework due next week')],
                  ['posts', tr('This week’s Class Story posts')],
                  ['numbers', tr('Class average and attendance (class-level only)')]
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={include[key]}
                    onChange={(e) => setInclude({ ...include, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div>
              <p className="mb-1 font-medium">
                {tr('This week’s facts')} {isFetching && '…'}
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto rounded-md border border-[var(--color-border)] p-2 text-xs">
                {(facts ?? []).map((f) => (
                  <li key={f.text}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={!dropped.has(f.text)}
                        onChange={(e) => {
                          const next = new Set(dropped)
                          if (e.target.checked) next.delete(f.text)
                          else next.add(f.text)
                          setDropped(next)
                        }}
                      />
                      {f.text}
                    </label>
                  </li>
                ))}
                {!facts?.length && (
                  <li className="text-[var(--color-text-muted)]">
                    {tr('Nothing found for this week. Add your own notes below.')}
                  </li>
                )}
              </ul>
            </div>
            <label className="block">
              <span className="mb-1 block font-medium">{tr('Your notes')}</span>
              <textarea
                className={inputClass}
                rows={4}
                placeholder={tr('Events, reminders, thank-yous… one per line.')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </CardBody>
        </Card>

        <Card className="col-span-3">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{tr('Newsletter')}</h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!keep.length}
                onClick={() => setDraft(assembleNewsletter(structure, keep, sections))}
              >
                <Wand2 size={13} className="mr-1 inline" aria-hidden />
                {tr('Arrange for me')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!keep.length || !!busy}
                title={tr('Uses your AI provider (Settings), so it needs an internet connection')}
                onClick={() =>
                  run('ai', async () => {
                    setDraft(
                      await window.api.newsletter.draft({
                        structure,
                        customSections: sections,
                        facts: keep.filter((f) => f.kind !== 'note'),
                        notes
                      })
                    )
                    return tr(
                      'AI suggestion below. Check every line, and fill in anything in [brackets].'
                    )
                  })
                }
              >
                <Sparkles size={13} className="mr-1 inline" aria-hidden />
                {busy === 'ai' ? tr('Thinking…') : tr('Suggest wording with AI')}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p className="text-xs text-[var(--color-text-muted)]">
              {tr(
                '“Arrange for me” puts your facts under the headings, word for word, with no internet. AI (needs internet) only words and orders the facts and notes on the left; anything it would have to invent is left as [a gap] for you.'
              )}
            </p>
            <textarea
              aria-label={tr('Newsletter text')}
              className={`${inputClass} h-80 font-mono`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={tr('# Heading\n- A point\n\nA short paragraph.')}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={!draft.trim() || !!busy || /\[[^\]]+\]/.test(draft)}
                title={/\[[^\]]+\]/.test(draft) ? tr('Fill in the [gaps] first.') : undefined}
                onClick={() =>
                  run('digest', async () => {
                    await window.api.digest.setNewsletter(draft, endOfWeek())
                    return tr('Added to this week’s family digest. It drops out after Sunday.')
                  })
                }
              >
                <Mail size={13} className="mr-1 inline" aria-hidden />
                {tr('Add to this week’s family digest')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  !draft.trim() || chosenClasses.length !== 1 || !!busy || /\[[^\]]+\]/.test(draft)
                }
                title={
                  chosenClasses.length !== 1
                    ? tr('Choose one class to post to its Class Story.')
                    : undefined
                }
                onClick={() =>
                  run('story', async () => {
                    await window.api.classPosts.create(
                      chosenClasses[0],
                      draft.replace(/^#\s*/gm, '').trim(),
                      null
                    )
                    return tr('Posted to Class Story.')
                  })
                }
              >
                <Megaphone size={13} className="mr-1 inline" aria-hidden />
                {tr('Post to Class Story')}
              </Button>
              {groups.length > 0 && (
                <span className="flex items-center gap-1">
                  <select
                    aria-label={tr('Group chat')}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-1 text-xs"
                    value={group?.id ?? ''}
                    onChange={(e) => setGroupId(e.target.value)}
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!draft.trim() || !group || !!busy || /\[[^\]]+\]/.test(draft)}
                    title={tr('Needs internet. Everyone in the group sees it.')}
                    onClick={() =>
                      run('group', async () => {
                        await window.api.groupChats.send(group!.id, draft, tr('Newsletter'))
                        return tr('Sent to {name}.', { name: group!.name })
                      })
                    }
                  >
                    <MessagesSquare size={13} className="mr-1 inline" aria-hidden />
                    {tr('Send to group chat')}
                  </Button>
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={!draft.trim()}
                onClick={async () => {
                  await navigator.clipboard.writeText(draft)
                  setMessage({ ok: true, text: tr('Copied') })
                }}
              >
                <Copy size={13} className="mr-1 inline" aria-hidden />
                {tr('Copy')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!draft.trim()}
                onClick={() =>
                  run('word', async () => {
                    const r = await window.api.office.word({ kind: 'newsletter', text: draft })
                    return r.saved ? tr('Saved to {path}', { path: r.filePath }) : undefined
                  })
                }
              >
                <FileText size={13} className="mr-1 inline" aria-hidden />
                {tr('Word (.docx)')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!draft.trim() || !!busy}
                onClick={() =>
                  run('clear', async () => {
                    await window.api.digest.setNewsletter('', null)
                    return tr('Removed from the family digest.')
                  })
                }
              >
                {tr('Remove from digest')}
              </Button>
            </div>
            {message && (
              <p
                className={`text-sm ${message.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
              >
                {message.text}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

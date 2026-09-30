import JSZip from 'jszip'
import { readFile } from 'fs/promises'
import { basename, extname } from 'path'
import { AppError } from '@shared/errorCodes'
import { getClass } from '../repositories/classes'
import { getLessonPlan, listLessonResourceIds } from '../repositories/lessonPlans'
import { getLessonResource } from '../repositories/lessonResources'
import { offlineStudyPackHtml } from './offlineStudyPack'
import { tr } from '@shared/i18n'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textBlock(value: string | null): string {
  return value ? escapeHtml(value).replace(/\n/g, '<br>') : ''
}

function safeFileStem(value: string, fallback: string): string {
  return value.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 70) || fallback
}

/**
 * Creates a portable lesson ZIP for students. The pack itself is static HTML/files:
 * no EduBoard installation, server, account or internet connection is needed after
 * extraction. Only resources explicitly shared with students are included.
 */
export async function offlineLessonPackZip(planId: string): Promise<{
  buffer: Buffer
  resources: number
  files: number
}> {
  const plan = getLessonPlan(planId)
  if (!plan) throw new AppError('EB-0002', tr('That lesson plan no longer exists.'))
  const cls = getClass(plan.classId)
  const resources = listLessonResourceIds(plan.id)
    .map((id) => getLessonResource(id))
    .filter((resource): resource is NonNullable<typeof resource> => !!resource?.shareWithStudents)

  const zip = new JSZip()
  const resourceLinks: string[] = []
  let fileCount = 0

  for (const [i, resource] of resources.entries()) {
    const stem = safeFileStem(resource.title, `Resource ${i + 1}`)
    const studyName = `resources/${String(i + 1).padStart(2, '0')} - ${stem}.html`
    zip.file(studyName, offlineStudyPackHtml(resource))

    const links = [
      `<a href="${encodeURI(studyName)}">${escapeHtml(tr('Open offline study page'))}</a>`
    ]

    if (resource.type === 'file' && resource.filePath) {
      try {
        const originalName = basename(resource.filePath)
        const suffix = extname(originalName)
        const fileName = `files/${String(i + 1).padStart(2, '0')} - ${stem}${suffix}`
        zip.file(fileName, await readFile(resource.filePath))
        fileCount++
        links.push(
          `<a href="${encodeURI(fileName)}">${escapeHtml(tr('Open original file'))}</a>`
        )
      } catch {
        links.push(`<span>${escapeHtml(tr('Original file was not available when this pack was made.'))}</span>`)
      }
    } else if (resource.type === 'link' && resource.url) {
      links.push(
        `<a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tr('Open online source'))}</a>`
      )
    }

    resourceLinks.push(
      `<article><h3>${escapeHtml(resource.title)}</h3><div class="links">${links.join('')}</div></article>`
    )
  }

  const sections: [string, string | null][] = [
    [tr('Objectives'), plan.objectives],
    [tr('Activities'), plan.activities],
    [tr('Need more help?'), plan.support],
    [tr('Challenge'), plan.stretch],
    [cls?.noHomework ? tr('Consolidation in class') : tr('Homework'), plan.homework]
  ]
  const lessonSections = sections
    .filter(([, value]) => !!value?.trim())
    .map(
      ([label, value]) =>
        `<section><h2>${escapeHtml(label)}</h2><div class="body">${textBlock(value)}</div></section>`
    )
    .join('')

  const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${escapeHtml(plan.title)} · EduBoard</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f7fb;color:#111827}main{max-width:900px;margin:auto;padding:24px 16px 64px}
header{padding:26px;border-radius:20px;background:#4f46e5;color:white}header h1{margin:4px 0 0}.eyebrow{font-size:.78rem;font-weight:700;opacity:.82;text-transform:uppercase;letter-spacing:.06em}
section,article{margin-top:14px;padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:white}h2{margin:0 0 10px;font-size:1rem}.body{line-height:1.6}.links{display:flex;flex-wrap:wrap;gap:8px}
a,.links span{display:inline-block;border-radius:10px;padding:9px 12px;background:#eef2ff;color:#4338ca;text-decoration:none;font-size:.9rem}.links span{background:#f3f4f6;color:#6b7280}
.note{color:#6b7280;font-size:.86rem}.footer{text-align:center;color:#6b7280;font-size:.8rem;margin-top:22px}
@media(prefers-color-scheme:dark){body{background:#0b1120;color:#e5e7eb}section,article{background:#111827;border-color:#263042}a{background:#1e1b4b;color:#c7d2fe}.links span{background:#1f2937;color:#9ca3af}.note,.footer{color:#9ca3af}}
</style></head><body><main>
<header><div class="eyebrow">${escapeHtml(tr('Offline Lesson Pack'))}</div><h1>${escapeHtml(plan.title)}</h1><p>${escapeHtml(cls?.name ?? '')} · ${escapeHtml(plan.date)}</p></header>
<p class="note">${escapeHtml(tr('Everything in this pack marked offline works without internet after the ZIP is extracted. Online source links are optional.'))}</p>
${lessonSections}
${resourceLinks.length ? `<section><h2>${escapeHtml(tr('Resources and practice'))}</h2>${resourceLinks.join('')}</section>` : ''}
<p class="footer">${escapeHtml(tr('Made with EduBoard'))}</p>
</main></body></html>`

  zip.file('index.html', index)
  return {
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    resources: resources.length,
    files: fileCount
  }
}

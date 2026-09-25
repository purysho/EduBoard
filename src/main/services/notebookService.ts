import { readFile } from 'fs/promises'
import { extname } from 'path'
import { PDFParse } from 'pdf-parse'
import {
  getLessonResource,
  setLessonResourceStudyGuide,
  touchLessonResourceIndexedAt,
  setLessonResourcePracticeSet
} from '../repositories/lessonResources'
import {
  getAllResourceChunkText,
  replaceResourceChunks,
  searchResourceChunks
} from '../repositories/resourceChunks'
import { askAi } from './aiService'
import { AiDraftFormatError } from './feedbackPrompt'
import { extractOfficeText, OFFICE_EXTENSIONS } from './officeText'
import {
  buildPracticePrompt,
  MAX_SOURCE_CHARS,
  parsePracticeSet,
  type PracticeKind
} from './practicePrompt'
import type { LessonResource, NotebookAnswer } from '@shared/types'

const CHUNK_TARGET_CHARS = 800
const MAX_CONTEXT_CHUNKS = 8

export class NotebookExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotebookExtractionError'
  }
}

/** Strips tags/scripts/styles and decodes the handful of entities that actually show up
 * in ordinary web text — not a full HTML parser, but link resources are just meant to
 * be readable prose for search/citation purposes, not pixel-perfect rendering. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractText(resource: LessonResource): Promise<string> {
  if (resource.type === 'note') {
    return resource.notes ?? ''
  }

  if (resource.type === 'link') {
    if (!resource.url) throw new NotebookExtractionError('This resource has no URL.')
    const res = await fetch(resource.url)
    if (!res.ok) throw new NotebookExtractionError(`Could not fetch the URL (${res.status}).`)
    return htmlToText(await res.text())
  }

  // type === 'file'
  if (!resource.filePath) throw new NotebookExtractionError('This resource has no file.')
  return extractFileText(resource.filePath)
}

/** File types extractFileText can read. */
export function canExtractText(filePath: string): boolean {
  return [...TEXT_EXTENSIONS, ...OFFICE_EXTENSIONS].includes(extname(filePath).toLowerCase())
}

const TEXT_EXTENSIONS = ['.pdf', '.txt', '.md', '.markdown']

/** Plain text from a PDF, Word, PowerPoint, OpenDocument, .txt or .md file on disk. Also
 * used to read students' attached work when drafting feedback (see feedbackDraft.ts). */
export async function extractFileText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.pdf') {
    const buffer = await readFile(filePath)
    const parser = new PDFParse({ data: buffer })
    try {
      const parsed = await parser.getText()
      return parsed.text
    } finally {
      await parser.destroy()
    }
  }
  if (['.txt', '.md', '.markdown'].includes(ext)) {
    return readFile(filePath, 'utf-8')
  }
  if ((OFFICE_EXTENSIONS as readonly string[]).includes(ext)) {
    return extractOfficeText(await readFile(filePath), ext)
  }
  const hint =
    ext === '.doc' || ext === '.ppt'
      ? ` Open it in Word or PowerPoint and save it as ${ext}x, then add that copy.`
      : ''
  throw new NotebookExtractionError(
    `Can't read text from a "${ext || 'unknown'}" file. PDF, Word (.docx), PowerPoint (.pptx), OpenDocument, .txt and .md work.${hint}`
  )
}

/** Splits on paragraph breaks and greedily packs them into ~800-character chunks — good
 * enough at classroom-resource scale; no need for anything fancier (sentence-boundary
 * detection, overlap windows) than what a keyword search over short documents wants. */
function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph)
  if (!paragraphs.length) return []

  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > CHUNK_TARGET_CHARS) {
      chunks.push(current)
      current = paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/** PDFs often come out as one enormous "paragraph" with no blank lines. Split those at
 * sentence ends (or line breaks) so search still finds the relevant part. */
function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= CHUNK_TARGET_CHARS * 2) return [paragraph]
  const pieces = paragraph.match(/[^.!?。！？\n]+[.!?。！？]*\s*|\n/g) ?? [paragraph]
  const out: string[] = []
  let current = ''
  for (const piece of pieces) {
    if (current && current.length + piece.length > CHUNK_TARGET_CHARS) {
      out.push(current.trim())
      current = ''
    }
    current += piece
    // A single sentence longer than a chunk is cut hard rather than kept whole.
    while (current.length > CHUNK_TARGET_CHARS * 2) {
      out.push(current.slice(0, CHUNK_TARGET_CHARS).trim())
      current = current.slice(CHUNK_TARGET_CHARS)
    }
  }
  if (current.trim()) out.push(current.trim())
  return out.filter(Boolean)
}

/** Extracts, chunks, and (re)indexes one resource for Notebook search — safe to call
 * again after a resource's content changes, since it fully replaces that resource's
 * prior chunks first. */
export async function indexResource(resourceId: string): Promise<number> {
  const resource = getLessonResource(resourceId)
  if (!resource) throw new Error(`Resource ${resourceId} not found`)

  const text = await extractText(resource)
  const chunks = chunkText(text)
  replaceResourceChunks(resourceId, chunks)
  touchLessonResourceIndexedAt(resourceId)
  return chunks.length
}

/** Summarizes a resource's full indexed text into a study guide, saves it, and returns
 * it — read by students on the Portal (see publishToPortal) alongside the source
 * material, and playable aloud there via the browser's built-in text-to-speech. */
export async function draftStudyGuide(resourceId: string): Promise<string> {
  const text = (await textForAi(resourceId)).slice(0, MAX_SOURCE_CHARS)

  const system =
    'You write clear, student-friendly study guides. Summarize the given material into: ' +
    'a short overview (2-3 sentences), then "Key points" as a bulleted list, then, if the ' +
    'material supports it, "Check yourself" with 2-3 short self-test questions (no answers ' +
    'given, just the questions). Plain text only, no markdown headers — use blank lines and ' +
    '"- " list prefixes. Base this only on the material given.'
  const guide = (await askAi(system, text, 2048)).trim()
  if (!guide) throw new AiDraftFormatError('the AI returned an empty study guide')
  setLessonResourceStudyGuide(resourceId, guide)
  return guide
}

/** A resource's indexed text, indexing it first if that hasn't happened yet, so the AI
 * buttons work straight away instead of needing "Index for Notebook" pressed first. */
async function textForAi(resourceId: string): Promise<string> {
  let text = getAllResourceChunkText(resourceId)
  if (!text.trim()) {
    await indexResource(resourceId)
    text = getAllResourceChunkText(resourceId)
  }
  if (!text.trim()) {
    throw new NotebookExtractionError(
      'This resource has no readable text. If it is a scanned PDF (pictures of pages), there is no text in it for the AI to read.'
    )
  }
  return text
}

/** Drafts flashcards or a practice quiz from a resource's indexed text, validates the
 * model's reply (see practicePrompt.ts) and only then saves it, replacing any earlier
 * set of that kind. Shared resources publish it to students automatically. */
export async function draftPracticeSet(resourceId: string, kind: PracticeKind): Promise<number> {
  const text = await textForAi(resourceId)
  const { system, user } = buildPracticePrompt(kind, text)
  let set
  try {
    set = parsePracticeSet(kind, await askAi(system, user, 4096))
  } catch (err) {
    // Models occasionally return a cut-off or badly shaped reply. One retry usually
    // works; a second failure is reported rather than retried forever on the teacher's key.
    if (!(err instanceof AiDraftFormatError)) throw err
    set = parsePracticeSet(kind, await askAi(system, user, 4096))
  }
  setLessonResourcePracticeSet(resourceId, kind, set)
  return set.length
}

export function clearPracticeSet(resourceId: string, kind: PracticeKind): void {
  setLessonResourcePracticeSet(resourceId, kind, null)
}

/** Retrieves the top matching chunks (optionally scoped to a chosen set of resources),
 * then asks the configured AI provider to answer strictly from that context — never
 * inventing specifics the retrieved text doesn't contain — and returns the answer
 * alongside exactly which chunks it was grounded in, for citation links back to source. */
export async function askNotebook(
  question: string,
  resourceIds: string[] | null
): Promise<NotebookAnswer> {
  const matches = searchResourceChunks(question, resourceIds, MAX_CONTEXT_CHUNKS)
  if (!matches.length) {
    return {
      answer:
        "I couldn't find anything relevant in your indexed resources. Try indexing more resources, or rephrasing the question.",
      citations: []
    }
  }

  const resourceTitles = new Map<string, string>()
  for (const match of matches) {
    if (!resourceTitles.has(match.resourceId)) {
      const resource = getLessonResource(match.resourceId)
      resourceTitles.set(match.resourceId, resource?.title ?? 'Untitled resource')
    }
  }

  const contextBlock = matches
    .map((m, i) => `[${i + 1}] (from "${resourceTitles.get(m.resourceId)}")\n${m.text}`)
    .join('\n\n')

  const system =
    "You answer a teacher's question using ONLY the numbered excerpts given below — never " +
    'add facts not present in them. Cite which excerpt(s) support each claim using their ' +
    "bracketed number, like [1] or [2][3]. If the excerpts don't contain the answer, say so " +
    'plainly instead of guessing.'
  const user = `Excerpts:\n${contextBlock}\n\nQuestion: ${question}`

  const answer = await askAi(system, user, 1536)
  return {
    answer,
    citations: matches.map((m) => ({
      resourceId: m.resourceId,
      resourceTitle: resourceTitles.get(m.resourceId) ?? 'Untitled resource',
      chunkIndex: m.chunkIndex,
      snippet: m.text.length > 220 ? `${m.text.slice(0, 220)}…` : m.text
    }))
  }
}

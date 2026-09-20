import { readFile } from 'fs/promises'
import { extname } from 'path'
import { PDFParse } from 'pdf-parse'
import { getLessonResource, touchLessonResourceIndexedAt } from '../repositories/lessonResources'
import { replaceResourceChunks, searchResourceChunks } from '../repositories/resourceChunks'
import { askAi } from './aiService'
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
  const ext = extname(resource.filePath).toLowerCase()
  if (ext === '.pdf') {
    const buffer = await readFile(resource.filePath)
    const parser = new PDFParse({ data: buffer })
    try {
      const parsed = await parser.getText()
      return parsed.text
    } finally {
      await parser.destroy()
    }
  }
  if (['.txt', '.md', '.markdown'].includes(ext)) {
    return readFile(resource.filePath, 'utf-8')
  }
  throw new NotebookExtractionError(
    `Can't extract text from a "${ext || 'unknown'}" file yet — only PDF, .txt, and .md are supported.`
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

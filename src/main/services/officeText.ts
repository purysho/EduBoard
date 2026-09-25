import JSZip from 'jszip'

// Plain text from Word, PowerPoint and OpenDocument files, so teachers' usual lesson
// materials can be indexed for the Notebook and turned into study guides, flashcards and
// quizzes (before, only PDF, .txt and .md could). All of these are zip files of XML; the
// text lives in a few known parts, so no Office install or heavy parser is needed.
//
// Formatting, images and tables' layout are dropped: this text is for search and for
// the AI to read, not for display.

export const OFFICE_EXTENSIONS = ['.docx', '.pptx', '.odt', '.odp'] as const

/** Refuse to inflate more than this. A small file can declare a huge unpacked size
 * (a "zip bomb"); real lesson documents are far below it. */
const MAX_UNPACKED_BYTES = 80 * 1024 * 1024

export class OfficeTextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfficeTextError'
  }
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}

/** Text of one XML part: paragraphs become lines, tabs and line breaks are kept, and
 * everything else between tags is dropped. `paragraph` and `run` are the element names
 * for this format (w:p / w:t for Word, a:p / a:t for PowerPoint). */
function xmlText(xml: string, paragraph: string, run: string, separator = '\n'): string {
  const lines: string[] = []
  const paraRe = new RegExp(`<${paragraph}[\\s>][\\s\\S]*?</${paragraph}>`, 'g')
  const runRe = new RegExp(
    `<${run}(?:\\s[^>]*)?>([\\s\\S]*?)</${run}>|<w:tab/>|<w:br/>|<a:br/>`,
    'g'
  )
  for (const para of xml.match(paraRe) ?? []) {
    let line = ''
    for (const m of para.matchAll(runRe)) {
      if (m[0] === '<w:tab/>') line += '\t'
      else if (m[0] === '<w:br/>' || m[0] === '<a:br/>') line += '\n'
      else line += decodeXml(m[1])
    }
    if (line.trim()) lines.push(line)
  }
  return lines.join(separator)
}

/** OpenDocument paragraphs and headings, with any nested spans' text. */
function odfText(xml: string): string {
  const lines: string[] = []
  for (const m of xml.matchAll(/<text:(p|h)[\s>][\s\S]*?<\/text:\1>/g)) {
    const text = decodeXml(
      m[0]
        .replace(/<text:tab\/>/g, '\t')
        .replace(/<text:line-break\/>/g, '\n')
        .replace(/<text:s(?: text:c="(\d+)")?\/>/g, (_, n) => ' '.repeat(Number(n) || 1))
        .replace(/<[^>]+>/g, '')
    )
    if (text.trim()) lines.push(text)
  }
  // Blank lines between paragraphs, which is where the Notebook splits text into chunks.
  return lines.join('\n\n')
}

export async function extractOfficeText(bytes: Uint8Array, ext: string): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    throw new OfficeTextError(
      `This ${ext} file couldn't be opened. It may be damaged, or an older format (.doc/.ppt): save it as ${ext} and try again.`
    )
  }

  let unpacked = 0
  const read = async (name: string): Promise<string> => {
    const entry = zip.file(name)
    if (!entry) return ''
    // Declared size from the zip directory, checked before inflating anything.
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
      ?.uncompressedSize
    unpacked += size ?? 0
    if (unpacked > MAX_UNPACKED_BYTES) {
      throw new OfficeTextError('This file is too large to read.')
    }
    return entry.async('string')
  }

  if (ext === '.docx') {
    return xmlText(await read('word/document.xml'), 'w:p', 'w:t', '\n\n')
  }
  if (ext === '.pptx') {
    // Slides in order (slide2 before slide10), each with its speaker notes if any.
    const slideNumber = (name: string): number => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0)
    const slides = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => slideNumber(a) - slideNumber(b))
    const parts: string[] = []
    for (const slide of slides) {
      const n = slideNumber(slide)
      const text = xmlText(await read(slide), 'a:p', 'a:t')
      const notes = xmlText(await read(`ppt/notesSlides/notesSlide${n}.xml`), 'a:p', 'a:t')
        // Notes pages repeat the slide number as their own text.
        .replace(new RegExp(`^${n}$`, 'm'), '')
        .trim()
      parts.push([`Slide ${n}`, text, notes && `Notes: ${notes}`].filter(Boolean).join('\n'))
    }
    return parts.join('\n\n')
  }
  if (ext === '.odt' || ext === '.odp') {
    return odfText(await read('content.xml'))
  }
  throw new OfficeTextError(`Can't read ${ext} files.`)
}

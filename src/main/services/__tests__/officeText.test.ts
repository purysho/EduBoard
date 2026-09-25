import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extractOfficeText, OfficeTextError } from '../officeText'

async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const z = new JSZip()
  for (const [name, content] of Object.entries(files)) z.file(name, content)
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

describe('extractOfficeText', () => {
  it('reads Word paragraphs, tabs, line breaks and escaped characters', async () => {
    const doc = await zip({
      'word/document.xml':
        '<w:document><w:body>' +
        '<w:p><w:r><w:t>Photosynthesis</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t xml:space="preserve">Light </w:t></w:r><w:r><w:t>&amp; water</w:t></w:r><w:r><w:tab/><w:t>→ sugar</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>细胞</w:t><w:br/><w:t>第二行</w:t></w:r></w:p>' +
        '<w:p></w:p>' +
        '</w:body></w:document>'
    })
    expect(await extractOfficeText(doc, '.docx')).toBe(
      'Photosynthesis\n\nLight & water\t→ sugar\n\n细胞\n第二行'
    )
  })

  it('reads PowerPoint slides in order, with speaker notes', async () => {
    const slide = (t: string): string => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`
    const pptx = await zip({
      'ppt/slides/slide10.xml': slide('Ten'),
      'ppt/slides/slide2.xml': slide('Two'),
      'ppt/slides/slide1.xml': slide('One'),
      'ppt/notesSlides/notesSlide2.xml':
        '<p:notes><a:p><a:r><a:t>Say this out loud</a:t></a:r></a:p><a:p><a:r><a:t>2</a:t></a:r></a:p></p:notes>'
    })
    expect(await extractOfficeText(pptx, '.pptx')).toBe(
      'Slide 1\nOne\n\nSlide 2\nTwo\nNotes: Say this out loud\n\nSlide 10\nTen'
    )
  })

  it('reads OpenDocument headings and paragraphs', async () => {
    const odt = await zip({
      'content.xml':
        '<office:text><text:h>Unit 1</text:h><text:p>Cells <text:span>are</text:span><text:s text:c="2"/>small.</text:p></office:text>'
    })
    expect(await extractOfficeText(odt, '.odt')).toBe('Unit 1\n\nCells are  small.')
  })

  it('explains a file that is not really a zip (an old .doc renamed, or damage)', async () => {
    await expect(extractOfficeText(new TextEncoder().encode('not a zip'), '.docx')).rejects.toThrow(
      OfficeTextError
    )
  })

  it('refuses to inflate a document whose parts declare a huge size', async () => {
    // 100 MB of one repeated byte compresses to ~100 KB: a small file, a big unpack.
    const big = new JSZip()
    big.file('word/document.xml', new Uint8Array(100 * 1024 * 1024))
    const bytes = await big.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    expect(bytes.length).toBeLessThan(1024 * 1024)
    await expect(extractOfficeText(bytes, '.docx')).rejects.toThrow(/too large/)
  })
})

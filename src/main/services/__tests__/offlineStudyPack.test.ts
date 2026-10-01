import { describe, expect, it } from 'vitest'
import { offlineStudyPackHtml } from '../offlineStudyPack'
import type { LessonResource } from '@shared/types'

function resource(): LessonResource {
  return {
    id: 'r1',
    title: 'Museum <Basics>',
    type: 'note',
    url: null,
    filePath: null,
    notes: 'Ancient collections & galleries.',
    tags: [],
    standardId: null,
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    indexedAt: null,
    classId: null,
    shareWithStudents: false,
    studyGuide: 'A short guide.',
    flashcards: [{ front: 'Exhibit', back: 'Something shown in a museum.' }],
    practiceQuiz: [
      {
        question: 'What is an exhibit?',
        options: ['Something shown', 'A ticket'],
        answerIndex: 0,
        explanation: 'An exhibit is something shown to visitors.'
      }
    ],
    aiApproved: { studyGuide: true, flashcards: true, practiceQuiz: true }
  }
}

describe('offline study pack', () => {
  it('creates a self-contained offline HTML pack with approved practice', () => {
    const html = offlineStudyPackHtml(resource())
    expect(html).toContain('Works without internet')
    expect(html).toContain('A short guide.')
    expect(html).toContain('Exhibit')
    expect(html).toContain('What is an exhibit?')
    expect(html).toContain('localStorage')
    expect(html).toContain('Export progress for my teacher')
    expect(html).toContain("format:'eduboard-study-progress'")
    expect(html).toContain('new Blob')
    expect(html).not.toContain('<script src=')
    expect(html).toContain('Museum &lt;Basics&gt;')
  })

  it('does not expose unapproved AI material', () => {
    const r = resource()
    r.aiApproved = {}
    const html = offlineStudyPackHtml(r)
    expect(html).not.toContain('A short guide.')
    expect(html).not.toContain('Something shown in a museum.')
    expect(html).not.toContain('What is an exhibit?')
    expect(html).toContain('Ancient collections &amp; galleries.')
  })
})

import { AppError } from '@shared/errorCodes'
import { tr } from '@shared/i18n'
import type { HomeworkAssignment } from '@shared/types'
import * as classesRepo from '../repositories/classes'
import * as homeworkRepo from '../repositories/homeworkAssignments'
import * as homeworkQuestionsRepo from '../repositories/homeworkQuestions'

export function copyHomeworkToClasses(id: string, classIds: string[]): HomeworkAssignment[] {
  const source = homeworkRepo.getHomeworkAssignment(id)
  if (!source) throw new AppError('EB-0002', tr('That assignment no longer exists.'))

  const questions = homeworkQuestionsRepo.listHomeworkQuestions(source.id)
  const targetIds = [...new Set(classIds)].filter((classId) => classId !== source.classId)
  const created: HomeworkAssignment[] = []

  for (const classId of targetIds) {
    const target = classesRepo.getClass(classId)
    if (!target || target.archived) {
      throw new AppError('EB-0002', tr('One of the selected classes is no longer active.'))
    }

    const copy = homeworkRepo.createHomeworkAssignment({
      classId,
      title: source.title,
      description: source.description,
      dueDate: null,
      filePath: source.filePath,
      fileName: source.fileName,
      topic: source.topic,
      status: 'draft',
      rubricId: source.rubricId
    })

    if (questions.length) {
      homeworkQuestionsRepo.replaceHomeworkQuestions(
        copy.id,
        questions.map((q) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points
        }))
      )
    }
    created.push(copy)
  }

  return created
}

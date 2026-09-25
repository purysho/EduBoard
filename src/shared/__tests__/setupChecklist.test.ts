import { describe, expect, it } from 'vitest'
import { setupComplete, setupSteps, type SetupProgress } from '../setupChecklist'

const fresh: SetupProgress = {
  classCount: 0,
  activeEnrollmentCount: 0,
  publishedHomeworkCount: 0,
  portalConnected: false,
  inviteBatchCount: 0,
  sharedResourceCount: 0,
  aiConfigured: false,
  firstClassId: null
}

describe('setupSteps', () => {
  it('starts with nothing done and links class steps to the Classes page', () => {
    const steps = setupSteps(fresh)
    expect(steps.filter((s) => s.done)).toHaveLength(0)
    for (const id of ['students', 'homework', 'invites']) {
      expect(steps.find((s) => s.id === id)?.to).toBe('/classes')
    }
    expect(setupComplete(steps)).toBe(false)
  })

  it('ticks each step from the data and links into the first class', () => {
    const steps = setupSteps({
      ...fresh,
      classCount: 1,
      activeEnrollmentCount: 12,
      firstClassId: 'c1'
    })
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]))
    expect(byId.class.done).toBe(true)
    expect(byId.students.done).toBe(true)
    expect(byId.homework.done).toBe(false)
    expect(byId.homework.to).toBe('/classes/c1/homework')
    expect(byId.invites.to).toBe('/classes/c1/portal')
  })

  it('counts as complete without the optional extras', () => {
    const steps = setupSteps({
      ...fresh,
      classCount: 1,
      activeEnrollmentCount: 1,
      publishedHomeworkCount: 1,
      portalConnected: true,
      inviteBatchCount: 1,
      firstClassId: 'c1'
    })
    expect(setupComplete(steps)).toBe(true)
    expect(steps.filter((s) => s.optional && !s.done).map((s) => s.id)).toEqual(['materials', 'ai'])
  })
})

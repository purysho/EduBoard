import { describe, expect, it } from 'vitest'
import { setupComplete, setupSteps, type SetupProgress } from '../setupChecklist'

const fresh: SetupProgress = {
  termCount: 0,
  classCount: 0,
  activeEnrollmentCount: 0,
  publishedHomeworkCount: 0,
  portalConnected: false,
  inviteBatchCount: 0,
  sharedResourceCount: 0,
  aiConfigured: false,
  passwordProtected: false,
  pilotMode: false,
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
      termCount: 2,
      classCount: 1,
      activeEnrollmentCount: 1,
      publishedHomeworkCount: 1,
      portalConnected: true,
      inviteBatchCount: 1,
      firstClassId: 'c1'
    })
    expect(setupComplete(steps)).toBe(true)
    expect(steps.filter((s) => s.optional && !s.done).map((s) => s.id)).toEqual([
      'password',
      'materials',
      'ai'
    ])
  })

  it('asks for terms first, and isn’t complete until there is one', () => {
    const steps = setupSteps(fresh)
    expect(steps[0]).toMatchObject({ id: 'terms', done: false, optional: false })
    expect(steps[0].to).toBe('/settings?section=grading&focus=terms')
    const allButTerms = setupSteps({
      ...fresh,
      classCount: 1,
      activeEnrollmentCount: 1,
      publishedHomeworkCount: 1,
      portalConnected: true,
      inviteBatchCount: 1,
      firstClassId: 'c1'
    })
    expect(setupComplete(allButTerms)).toBe(false)
    expect(setupSteps({ ...fresh, termCount: 1 })[0].done).toBe(true)
  })

  it('reaches 100% without a Portal in a local-only pilot', () => {
    const pilot = { ...fresh, pilotMode: true }
    const ids = setupSteps(pilot).map((s) => s.id)
    for (const portalStep of ['portal', 'invites', 'homework', 'materials', 'ai']) {
      expect(ids).not.toContain(portalStep)
    }
    const done = setupSteps({
      ...pilot,
      termCount: 1,
      classCount: 1,
      activeEnrollmentCount: 20,
      firstClassId: 'c1'
    })
    // No Portal, no invites, nothing published: still all set up.
    expect(setupComplete(done)).toBe(true)
    const essentials = done.filter((s) => !s.optional)
    expect(essentials.every((s) => s.done)).toBe(true)
    // The password is strongly suggested, but not needed to finish.
    expect(done.find((s) => s.id === 'password')).toMatchObject({
      done: false,
      optional: true,
      recommended: true
    })
  })

  it('still asks for the Portal outside a pilot', () => {
    const steps = setupSteps({
      ...fresh,
      termCount: 1,
      classCount: 1,
      activeEnrollmentCount: 20,
      firstClassId: 'c1'
    })
    expect(setupComplete(steps)).toBe(false)
    expect(steps.find((s) => s.id === 'password')?.recommended).toBe(false)
  })
})

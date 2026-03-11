import { describe, it, expect } from 'vitest'
import { generateTaskId, generateActivityId, generateId } from '@shared/utils/id-generator'

describe('generateTaskId', () => {
  it('produces a string with "tsk_" prefix', () => {
    const id = generateTaskId()
    expect(id.startsWith('tsk_')).toBe(true)
  })

  it('produces an id of correct total length (tsk_ + 8 chars = 12)', () => {
    const id = generateTaskId()
    expect(id.length).toBe(12)
  })

  it('generates unique IDs across many calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateTaskId())
    }
    expect(ids.size).toBe(1000)
  })
})

describe('generateActivityId', () => {
  it('produces a string with "act_" prefix', () => {
    const id = generateActivityId()
    expect(id.startsWith('act_')).toBe(true)
  })

  it('produces an id of correct total length (act_ + 8 chars = 12)', () => {
    const id = generateActivityId()
    expect(id.length).toBe(12)
  })

  it('generates unique IDs across many calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateActivityId())
    }
    expect(ids.size).toBe(1000)
  })
})

describe('generateId', () => {
  it('produces a string of length 8', () => {
    const id = generateId()
    expect(id.length).toBe(8)
  })

  it('generates unique IDs across many calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(1000)
  })
})

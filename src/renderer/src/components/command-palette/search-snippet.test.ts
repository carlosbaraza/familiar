import { describe, it, expect } from 'vitest'
import { buildSearchSnippet } from './search-snippet'

describe('buildSearchSnippet', () => {
  it('returns null when content is empty', () => {
    expect(buildSearchSnippet('', 'foo')).toBeNull()
  })

  it('returns null when query is empty', () => {
    expect(buildSearchSnippet('some content', '')).toBeNull()
  })

  it('returns null when there is no match', () => {
    expect(buildSearchSnippet('hello world', 'xyz')).toBeNull()
  })

  it('matches case-insensitively and preserves original casing in match', () => {
    const snippet = buildSearchSnippet('The Quick Brown Fox', 'quick')
    expect(snippet).not.toBeNull()
    expect(snippet!.match).toBe('Quick')
  })

  it('omits leading ellipsis when the match is at the very start', () => {
    const snippet = buildSearchSnippet('Hello world, how are you?', 'hello')
    expect(snippet).not.toBeNull()
    expect(snippet!.before).toBe('')
    expect(snippet!.match).toBe('Hello')
    expect(snippet!.after.startsWith(' world')).toBe(true)
  })

  it('adds ellipses when trimmed on both sides', () => {
    const longContent =
      'a'.repeat(200) + ' needle ' + 'b'.repeat(200)
    const snippet = buildSearchSnippet(longContent, 'needle')
    expect(snippet).not.toBeNull()
    expect(snippet!.before.startsWith('…')).toBe(true)
    expect(snippet!.after.endsWith('…')).toBe(true)
    expect(snippet!.match).toBe('needle')
  })

  it('collapses whitespace and newlines around the match', () => {
    const content = 'line one\n\n\n  some\t\tneedle   here\n\nmore'
    const snippet = buildSearchSnippet(content, 'needle')
    expect(snippet).not.toBeNull()
    // No raw newlines or tabs in the rendered snippet
    expect(snippet!.before).not.toMatch(/[\n\t]/)
    expect(snippet!.after).not.toMatch(/[\n\t]/)
    // Before text should contain "some " (with collapsed spaces)
    expect(snippet!.before).toMatch(/some $/)
    expect(snippet!.after.startsWith(' here')).toBe(true)
  })

  it('finds the first occurrence of multiple matches', () => {
    const snippet = buildSearchSnippet('foo bar foo baz foo', 'foo')
    expect(snippet).not.toBeNull()
    expect(snippet!.before).toBe('')
    // The "after" text should include the next "foo"s
    expect(snippet!.after).toContain('bar foo')
  })
})

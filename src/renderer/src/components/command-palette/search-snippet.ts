/**
 * Result of a search snippet: the text before the match, the matched text
 * (preserved in original casing), and the text after. Leading/trailing
 * ellipses are included in before/after when the snippet is truncated.
 */
export interface SearchSnippet {
  before: string
  match: string
  after: string
}

const CONTEXT_CHARS = 40

/**
 * Build a short snippet from document content around the first case-insensitive
 * occurrence of `query`. Returns `null` if no match is found.
 *
 * - Collapses whitespace so multi-line markdown reads as a single line.
 * - Adds leading/trailing ellipsis when the snippet is trimmed at the edges.
 * - Preserves the original casing of the matched text.
 */
export function buildSearchSnippet(content: string, query: string): SearchSnippet | null {
  if (!content || !query) return null
  const lowerContent = content.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerContent.indexOf(lowerQuery)
  if (idx < 0) return null

  const start = Math.max(0, idx - CONTEXT_CHARS)
  const end = Math.min(content.length, idx + query.length + CONTEXT_CHARS)

  const rawBefore = content.slice(start, idx)
  const rawMatch = content.slice(idx, idx + query.length)
  const rawAfter = content.slice(idx + query.length, end)

  const cleanBefore = collapseWhitespace(rawBefore)
  const cleanAfter = collapseWhitespace(rawAfter)

  const before = (start > 0 ? '…' : '') + cleanBefore
  const after = cleanAfter + (end < content.length ? '…' : '')

  return { before, match: rawMatch, after }
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ')
}

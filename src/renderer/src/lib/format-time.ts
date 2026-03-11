/**
 * Format an ISO 8601 timestamp as a human-readable relative time string.
 *
 * Examples: "just now", "2m ago", "3h ago", "yesterday", "5d ago", "Mar 3"
 */
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()

  // Future dates or less than a minute ago
  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`

  // Older than a week — show short date
  const month = date.toLocaleString('en-US', { month: 'short' })
  const day = date.getDate()
  const yearNow = now.getFullYear()
  const yearDate = date.getFullYear()

  if (yearDate === yearNow) {
    return `${month} ${day}`
  }
  return `${month} ${day}, ${yearDate}`
}

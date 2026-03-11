import type { ActivityEntry as ActivityEntryType } from '@shared/types'
import { formatRelativeTime } from '@renderer/lib/format-time'
import styles from './ActivityEntry.module.css'

const TYPE_ICONS: Record<ActivityEntryType['type'], string> = {
  status_change: '\u2194',
  agent_event: '\u2699',
  note: '\u270E',
  created: '\u2795',
  updated: '\u270F'
}

interface ActivityEntryProps {
  entry: ActivityEntryType
}

export function ActivityEntryComponent({ entry }: ActivityEntryProps): React.JSX.Element {
  return (
    <div className={styles.entry}>
      <div className={styles.iconWrapper}>{TYPE_ICONS[entry.type]}</div>
      <div className={styles.content}>
        <div className={styles.message}>{entry.message}</div>
        <div className={styles.timestamp}>{formatRelativeTime(entry.timestamp)}</div>
      </div>
    </div>
  )
}

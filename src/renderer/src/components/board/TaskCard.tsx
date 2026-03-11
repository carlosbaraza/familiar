import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/constants'
import styles from './TaskCard.module.css'

interface TaskCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
  isSelected?: boolean
  isFocused?: boolean
}

const AGENT_STATUS_COLORS: Record<string, string> = {
  idle: 'var(--agent-idle)',
  running: 'var(--agent-running)',
  done: 'var(--agent-done)',
  error: 'var(--agent-error)'
}

export function TaskCard({
  task,
  onClick,
  isDragging = false,
  isSelected = false,
  isFocused = false
}: TaskCardProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1
  }

  const cardClass = [
    styles.card,
    isSelected ? styles.cardSelected : '',
    isDragging || isSortableDragging ? styles.cardDragging : '',
    isFocused ? styles.cardFocused : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardClass}
      onClick={onClick}
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      {...attributes}
      {...listeners}
    >
      <div className={styles.topRow}>
        <span
          className={styles.priorityDot}
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          title={`Priority: ${task.priority}`}
        />
        <span className={styles.title}>{task.title}</span>
      </div>

      <div className={styles.bottomRow}>
        {task.labels.map((label) => (
          <span key={label} className={styles.label}>
            {label}
          </span>
        ))}

        {task.agentStatus !== 'idle' && (
          <span
            className={`${styles.agentDot} ${task.agentStatus === 'running' ? styles.agentRunning : ''}`}
            style={{ backgroundColor: AGENT_STATUS_COLORS[task.agentStatus] }}
            title={`Agent: ${task.agentStatus}`}
          />
        )}
      </div>
    </div>
  )
}

/** Plain TaskCard without dnd-kit for use in DragOverlay */
export function TaskCardOverlay({
  task
}: {
  task: Task
}): React.JSX.Element {
  return (
    <div className={`${styles.card} ${styles.cardDragging}`}>
      <div className={styles.topRow}>
        <span
          className={styles.priorityDot}
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        />
        <span className={styles.title}>{task.title}</span>
      </div>
      <div className={styles.bottomRow}>
        {task.labels.map((label) => (
          <span key={label} className={styles.label}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

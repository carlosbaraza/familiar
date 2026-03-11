import { useState } from 'react'
import { SplitPanel } from './SplitPanel'
import { ActivityTimeline } from './ActivityTimeline'
import { TerminalPanel } from '@renderer/components/terminal/TerminalPanel'
import { useUIStore } from '@renderer/stores/ui-store'
import styles from './TaskDetailContent.module.css'

interface TaskDetailContentProps {
  taskId: string
}

type RightTab = 'terminal' | 'activity'

export function TaskDetailContent({ taskId }: TaskDetailContentProps): JSX.Element {
  const editorPanelWidth = useUIStore((s) => s.editorPanelWidth)
  const setEditorPanelWidth = useUIStore((s) => s.setEditorPanelWidth)
  const [rightTab, setRightTab] = useState<RightTab>('terminal')

  return (
    <div className={styles.container}>
      <SplitPanel
        left={
          <div className={styles.editorPlaceholder}>
            <div className={styles.editorArea}>Block editor (coming soon)</div>
            <ActivityTimeline taskId={taskId} />
          </div>
        }
        right={
          <div className={styles.rightPanel}>
            <div className={styles.tabBar}>
              <button
                className={`${styles.tab} ${rightTab === 'terminal' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('terminal')}
              >
                Terminal
              </button>
              <button
                className={`${styles.tab} ${rightTab === 'activity' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('activity')}
              >
                Activity
              </button>
            </div>
            <div className={styles.tabContent}>
              {rightTab === 'terminal' ? (
                <TerminalPanel taskId={taskId} />
              ) : (
                <ActivityTimeline taskId={taskId} />
              )}
            </div>
          </div>
        }
        defaultLeftWidth={editorPanelWidth}
        minLeftWidth={20}
        maxLeftWidth={80}
        onWidthChange={setEditorPanelWidth}
      />
    </div>
  )
}

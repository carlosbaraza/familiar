import { useEffect } from 'react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { AppShell } from '@renderer/components/layout'
import { KanbanBoard } from '@renderer/components/board'
import { CommandPalette } from './components/command-palette'
import { TaskDetail } from './components/task-detail'

function App(): React.JSX.Element {
  const loadProjectState = useTaskStore((s) => s.loadProjectState)
  const taskDetailOpen = useUIStore((s) => s.taskDetailOpen)
  const activeTaskId = useUIStore((s) => s.activeTaskId)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)

  useEffect(() => {
    loadProjectState()
  }, [loadProjectState])

  return (
    <AppShell>
      <KanbanBoard />
      <CommandPalette />
      {taskDetailOpen && activeTaskId && (
        <TaskDetail taskId={activeTaskId} onClose={closeTaskDetail} />
      )}
    </AppShell>
  )
}

export default App

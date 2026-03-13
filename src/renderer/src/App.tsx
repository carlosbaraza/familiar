import { useEffect } from 'react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useGlobalShortcuts } from '@renderer/hooks/useGlobalShortcuts'
import { AppShell, Navbar } from '@renderer/components/layout'
import { KanbanBoard } from '@renderer/components/board'
import { CommandPalette } from './components/command-palette'
import { TaskDetail } from './components/task-detail'
import { SettingsPage } from './components/settings'
import { CreateTaskModal, KeyboardShortcutsModal, UpdateBanner } from './components/common'
import { WorkspacePicker } from './components/workspace-picker'

function App(): React.JSX.Element {
  const loadProjectState = useTaskStore((s) => s.loadProjectState)
  const projectState = useTaskStore((s) => s.projectState)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
  const loadOpenProjects = useWorkspaceStore((s) => s.loadOpenProjects)
  const showWorkspacePicker = useWorkspaceStore((s) => s.showWorkspacePicker)
  const setShowWorkspacePicker = useWorkspaceStore((s) => s.setShowWorkspacePicker)
  const taskDetailOpen = useUIStore((s) => s.taskDetailOpen)
  const activeTaskId = useUIStore((s) => s.activeTaskId)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)
  const mountedTaskIds = useUIStore((s) => s.mountedTaskIds)
  const settingsOpen = useUIStore((s) => s.settingsOpen)

  // Centralized global keyboard shortcuts
  useGlobalShortcuts()

  useEffect(() => {
    loadProjectState()
    loadNotifications()
    loadOpenProjects()
  }, [loadProjectState, loadNotifications, loadOpenProjects])

  // Auto-show workspace picker on initial load when no project is initialized
  useEffect(() => {
    async function checkInitialized(): Promise<void> {
      const initialized = await window.api.isInitialized()
      if (!initialized && !projectState) {
        setShowWorkspacePicker(true)
      }
    }
    checkInitialized()
  }, [projectState, setShowWorkspacePicker])

  // Reload state when external changes are detected (e.g. CLI updates)
  useEffect(() => {
    const unwatch = window.api.watchProjectDir(() => {
      loadProjectState()
      loadNotifications()
    })
    return () => {
      unwatch()
    }
  }, [loadProjectState, loadNotifications])

  // Listen for "Open Workspace" from the application menu
  const openWorkspace = useTaskStore((s) => s.openWorkspace)
  useEffect(() => {
    const unsubscribe = window.api.onMenuOpenWorkspace(() => {
      openWorkspace()
    })
    return () => {
      unsubscribe()
    }
  }, [openWorkspace])

  // Listen for "Add Project" from the application menu
  const addProject = useWorkspaceStore((s) => s.addProject)
  useEffect(() => {
    const unsubscribe = window.api.onMenuAddProject(() => {
      addProject()
    })
    return () => {
      unsubscribe()
    }
  }, [addProject])

  // Listen for "Show Workspace Picker" from the application menu
  useEffect(() => {
    const unsubscribe = window.api.onMenuShowWorkspacePicker(() => {
      setShowWorkspacePicker(true)
    })
    return () => {
      unsubscribe()
    }
  }, [setShowWorkspacePicker])

  // Listen for "Run Onboarding" from the application menu
  const openOnboarding = useUIStore((s) => s.openOnboarding)
  useEffect(() => {
    const unsubscribe = window.api.onMenuRunOnboarding(() => {
      openOnboarding()
    })
    return () => {
      unsubscribe()
    }
  }, [openOnboarding])

  return (
    <>
      <UpdateBanner />
      <Navbar />
      <AppShell>
        <KanbanBoard />
        <CommandPalette />
        <CreateTaskModal />
        <KeyboardShortcutsModal />
        {settingsOpen && <SettingsPage />}
        {Array.from(mountedTaskIds).map((taskId) => (
          <TaskDetail
            key={taskId}
            taskId={taskId}
            visible={taskDetailOpen && activeTaskId === taskId}
            onClose={closeTaskDetail}
          />
        ))}
      </AppShell>
      {showWorkspacePicker && <WorkspacePicker />}
    </>
  )
}

export default App

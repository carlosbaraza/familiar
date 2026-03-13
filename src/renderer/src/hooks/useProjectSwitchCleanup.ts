import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useTerminalStore } from '@renderer/stores/terminal-store'

/**
 * Cleans up terminal sessions for tasks that no longer belong to the active
 * project when the user switches between projects in a multi-project workspace.
 *
 * Background tmux sessions keep running (they are OS-level processes), but the
 * in-memory terminal store entries are removed so stale tabs don't appear.
 */
export function useProjectSwitchCleanup(): void {
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)
  const prevProjectPath = useRef<string | null>(activeProjectPath)

  useEffect(() => {
    // Only act when the project path actually changes (not on initial mount)
    if (prevProjectPath.current === activeProjectPath) return
    prevProjectPath.current = activeProjectPath

    // After a project switch the task-store will have reloaded with the new
    // project's tasks. Collect their IDs and purge terminal state for any
    // tasks that are no longer part of the active project.
    const projectState = useTaskStore.getState().projectState
    const activeTaskIds = (projectState?.tasks ?? []).map((t) => t.id)

    useTerminalStore.getState().clearSessionsForNonActiveTasks(activeTaskIds)
  }, [activeProjectPath])
}

import { create } from 'zustand'
import type { Workspace } from '@shared/types'

export interface WorktreeInfo {
  path: string
  branch: string
  slug: string
  isMain: boolean
}

export interface ProjectInfo {
  path: string
  name: string
  taskCount?: number // non-archived task count
  worktrees?: WorktreeInfo[] // git worktrees associated with this project
  isWorktree?: boolean // true if this project is a worktree (hidden from main list, shown indented)
}

interface WorkspaceState {
  // Workspace data
  workspaces: Workspace[]
  activeWorkspace: Workspace | null

  // Multi-project state
  openProjects: ProjectInfo[]
  activeProjectPath: string | null

  // Sidebar state
  sidebarExpanded: boolean // Icon strip vs full sidebar
  sidebarVisible: boolean // Whether sidebar is visible at all (only when 2+ projects)

  // Workspace picker
  showWorkspacePicker: boolean

  // Workspace name prompt (shown when adding a folder to a single-project window)
  showWorkspaceNamePrompt: boolean
  workspaceNamePromptResolve: ((name: string | null) => void) | null

  // Actions
  loadWorkspaces: () => Promise<void>
  loadOpenProjects: () => Promise<void>
  openWorkspace: (workspaceId: string) => Promise<void>
  openSingleProject: (path: string) => Promise<void>
  switchProject: (path: string) => Promise<void>
  addProject: () => Promise<string | null>
  removeProject: (path: string) => Promise<void>
  toggleSidebar: () => void
  toggleSidebarVisible: () => void
  setSidebarExpanded: (expanded: boolean) => void
  setShowWorkspacePicker: (show: boolean) => void
  promptWorkspaceName: () => Promise<string | null>
  resolveWorkspaceNamePrompt: (name: string | null) => void

  updateProjectTaskCount: (projectPath: string, count: number) => void

  // Worktree actions
  loadWorktrees: () => Promise<void>
  createWorktree: (customSlug?: string) => Promise<WorktreeInfo>
  renameWorktree: (worktreePath: string, newSlug: string) => Promise<WorktreeInfo>
  removeWorktree: (worktreePath: string) => Promise<void>

  createWorkspace: (name: string, paths: string[]) => Promise<Workspace>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<Workspace>
  deleteWorkspace: (id: string) => Promise<void>
}

function getProjectName(projectPath: string): string {
  return projectPath.split('/').pop() || projectPath
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // State
  workspaces: [],
  activeWorkspace: null,
  openProjects: [],
  activeProjectPath: null,
  sidebarExpanded: false,
  sidebarVisible: false,
  showWorkspacePicker: false,
  showWorkspaceNamePrompt: false,
  workspaceNamePromptResolve: null,

  // Actions
  loadWorkspaces: async (): Promise<void> => {
    const workspaces = await window.api.workspaceList()
    set({ workspaces })
  },

  loadOpenProjects: async (): Promise<void> => {
    const paths = await window.api.workspaceGetOpenProjects()
    const activeProjectPath = await window.api.workspaceGetActiveProject()
    const openProjects: ProjectInfo[] = paths.map((p) => ({
      path: p,
      name: getProjectName(p)
    }))
    set((s) => ({
      openProjects,
      activeProjectPath,
      // Auto-show sidebar when multiple projects are open, but never auto-hide
      sidebarVisible: s.sidebarVisible || openProjects.length >= 2
    }))
    // Re-apply worktree filtering so worktrees don't appear as top-level projects
    await get().loadWorktrees()
  },

  openWorkspace: async (workspaceId: string): Promise<void> => {
    await window.api.workspaceOpen(workspaceId)
    const { loadOpenProjects, loadWorkspaces } = get()
    await loadOpenProjects()
    await loadWorkspaces()
    const config = await window.api.workspaceGetConfig()
    const ws = config.workspaces.find((w) => w.id === workspaceId)
    set({ activeWorkspace: ws ?? null, showWorkspacePicker: false })
  },

  openSingleProject: async (path: string): Promise<void> => {
    await window.api.workspaceOpenSingle(path)
    const { loadOpenProjects } = get()
    await loadOpenProjects()
    set({ activeWorkspace: null, showWorkspacePicker: false })
  },

  switchProject: async (path: string): Promise<void> => {
    await window.api.workspaceSetActiveProject(path)
    set({ activeProjectPath: path })
  },

  addProject: async (): Promise<string | null> => {
    const { openProjects, activeWorkspace, promptWorkspaceName } = get()

    // When adding a folder to a single-project window (no workspace yet),
    // prompt for a workspace name first so the user understands what's happening.
    let workspaceName: string | null = null
    if (!activeWorkspace && openProjects.length >= 1) {
      workspaceName = await promptWorkspaceName()
      if (workspaceName === null) return null // User cancelled
    }

    const selectedPath = await window.api.openDirectory()
    if (!selectedPath) return null

    await window.api.workspaceAddProject(selectedPath)

    // Re-read state after async operations
    const currentState = get()
    if (currentState.activeWorkspace) {
      // Workspace already exists — add the new path to it if not already present
      if (!currentState.activeWorkspace.projectPaths.includes(selectedPath)) {
        const updatedPaths = [...currentState.activeWorkspace.projectPaths, selectedPath]
        const ws = await window.api.workspaceUpdate(currentState.activeWorkspace.id, {
          projectPaths: updatedPaths
        })
        set({ activeWorkspace: ws })
      }
    } else if (currentState.openProjects.length >= 1) {
      // No workspace yet — create one with the given name
      const allPaths = [...currentState.openProjects.map((p) => p.path), selectedPath]
      const ws = await window.api.workspaceCreate(workspaceName || '', allPaths)
      // Sync activeWorkspaceId on the backend so future addProjectToWorkspace
      // calls update the workspace config. Don't use workspaceOpen which
      // would closeAll() and reset file watchers.
      await window.api.workspaceSetActiveWorkspaceId(ws.id)
      set({ activeWorkspace: ws })
    }

    const { loadOpenProjects } = get()
    await loadOpenProjects()
    return selectedPath
  },

  removeProject: async (path: string): Promise<void> => {
    await window.api.workspaceRemoveProject(path)
    const { loadOpenProjects } = get()
    await loadOpenProjects()
  },

  toggleSidebar: (): void => {
    set((s) => ({ sidebarExpanded: !s.sidebarExpanded }))
  },

  toggleSidebarVisible: (): void => {
    set((s) => ({ sidebarVisible: !s.sidebarVisible }))
  },

  setSidebarExpanded: (expanded: boolean): void => {
    set({ sidebarExpanded: expanded })
  },

  setShowWorkspacePicker: (show: boolean): void => {
    set({ showWorkspacePicker: show })
  },

  updateProjectTaskCount: (projectPath: string, count: number): void => {
    set((s) => ({
      openProjects: s.openProjects.map((p) =>
        p.path === projectPath ? { ...p, taskCount: count } : p
      )
    }))
  },

  loadWorktrees: async (): Promise<void> => {
    try {
      const worktrees = await window.api.worktreeList()
      const gitRoot = await window.api.worktreeGetGitRoot()
      if (!gitRoot || worktrees.length <= 1) {
        // No git repo or only main worktree — clear worktree info
        set((s) => ({
          openProjects: s.openProjects.map((p) => ({
            ...p, worktrees: undefined, isWorktree: false
          }))
        }))
        return
      }

      const nonMainWorktrees = worktrees.filter((w) => !w.isMain)
      const worktreePaths = new Set(nonMainWorktrees.map((w) => w.path))

      set((s) => ({
        openProjects: s.openProjects.map((p) => {
          if (p.path === gitRoot) {
            // Main project — attach worktrees to it
            return { ...p, worktrees: nonMainWorktrees, isWorktree: false }
          }
          if (worktreePaths.has(p.path)) {
            // This project IS a worktree — mark it so the UI can hide it
            return { ...p, worktrees: undefined, isWorktree: true }
          }
          return { ...p, worktrees: undefined, isWorktree: false }
        }),
        // Auto-show sidebar when worktrees exist
        sidebarVisible: s.sidebarVisible || nonMainWorktrees.length > 0
      }))
    } catch {
      // Not a git repo or git not available — ignore
    }
  },

  createWorktree: async (customSlug?: string): Promise<WorktreeInfo> => {
    const worktree = await window.api.worktreeCreate(customSlug)
    const { loadWorktrees } = get()
    await loadWorktrees()
    return worktree
  },

  renameWorktree: async (worktreePath: string, newSlug: string): Promise<WorktreeInfo> => {
    const result = await window.api.worktreeRename(worktreePath, newSlug)
    const { openProjects, activeProjectPath } = get()
    const wasActive = activeProjectPath === worktreePath
    const wasOpen = openProjects.some((p) => p.path === worktreePath)

    if (wasOpen) {
      // Remove old path, add new path in the workspace manager
      await window.api.workspaceRemoveProject(worktreePath)
      await window.api.workspaceAddProject(result.path)
      // If this was the active project, switch to the new path
      if (wasActive) {
        await window.api.workspaceSetActiveProject(result.path)
      }
    }
    const { loadOpenProjects } = get()
    await loadOpenProjects()
    return result
  },

  removeWorktree: async (worktreePath: string): Promise<void> => {
    const { openProjects, removeProject, loadWorktrees } = get()
    // If the worktree is currently open as a project, remove it first
    if (openProjects.some((p) => p.path === worktreePath)) {
      await removeProject(worktreePath)
    }
    await window.api.worktreeRemove(worktreePath)
    await loadWorktrees()
  },

  createWorkspace: async (name: string, paths: string[]): Promise<Workspace> => {
    const ws = await window.api.workspaceCreate(name, paths)
    const { loadWorkspaces } = get()
    await loadWorkspaces()
    return ws
  },

  updateWorkspace: async (id: string, updates: Partial<Workspace>): Promise<Workspace> => {
    const ws = await window.api.workspaceUpdate(id, updates)
    const { loadWorkspaces } = get()
    await loadWorkspaces()
    return ws
  },

  deleteWorkspace: async (id: string): Promise<void> => {
    await window.api.workspaceDelete(id)
    const { loadWorkspaces } = get()
    await loadWorkspaces()
  },

  promptWorkspaceName: (): Promise<string | null> => {
    return new Promise((resolve) => {
      set({
        showWorkspaceNamePrompt: true,
        workspaceNamePromptResolve: resolve
      })
    })
  },

  resolveWorkspaceNamePrompt: (name: string | null): void => {
    const { workspaceNamePromptResolve } = get()
    if (workspaceNamePromptResolve) {
      workspaceNamePromptResolve(name)
    }
    set({
      showWorkspaceNamePrompt: false,
      workspaceNamePromptResolve: null
    })
  }
}))

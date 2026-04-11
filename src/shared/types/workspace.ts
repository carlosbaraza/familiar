/**
 * Per-workspace theme preferences. When set, these override the global
 * theme stored in ~/.familiar/settings.json for this workspace.
 */
export interface WorkspaceTheme {
  themeMode: 'system' | 'light' | 'dark'
  darkTheme: string
  lightTheme: string
}

export interface Workspace {
  id: string // "ws_<nanoid>"
  name: string // User-given name (empty string for implicit single-project)
  projectPaths: string[] // Ordered list of project folder paths
  lastOpenedAt: string // ISO date
  createdAt: string // ISO date
  /** Per-workspace theme — persisted alongside the workspace so each
   * workspace can have its own theme preference. Falls back to global
   * settings when unset. */
  theme?: WorkspaceTheme
}

export interface WorkspaceConfig {
  workspaces: Workspace[]
  lastWorkspaceId: string | null
}

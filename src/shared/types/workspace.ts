/**
 * Theme preferences. Stored globally in ~/.familiar/settings.json — the
 * same theme applies to every workspace and single-project window.
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
  /** @deprecated Theme is now stored globally in ~/.familiar/settings.json.
   * Field retained on the type only to support the one-time migration that
   * copies the most-recently-opened workspace's theme to global settings. */
  theme?: WorkspaceTheme
}

export interface WorkspaceConfig {
  workspaces: Workspace[]
  lastWorkspaceId: string | null
}

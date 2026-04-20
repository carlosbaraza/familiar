import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WorkspaceManager } from './workspace-manager'
import fs from 'fs'
import path from 'path'
import os from 'os'

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.familiar')
const WORKSPACES_FILE = path.join(GLOBAL_CONFIG_DIR, 'workspaces.json')
const GLOBAL_SETTINGS_FILE = path.join(GLOBAL_CONFIG_DIR, 'settings.json')

// Save original files if they exist, restore after tests
let originalWorkspaces: string | null = null
let originalGlobalSettings: string | null = null

beforeEach(() => {
  try {
    originalWorkspaces = fs.readFileSync(WORKSPACES_FILE, 'utf-8')
  } catch {
    originalWorkspaces = null
  }
  try {
    originalGlobalSettings = fs.readFileSync(GLOBAL_SETTINGS_FILE, 'utf-8')
  } catch {
    originalGlobalSettings = null
  }
  // Write empty config for testing
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
  }
  fs.writeFileSync(WORKSPACES_FILE, JSON.stringify({ workspaces: [], lastWorkspaceId: null }))
  // Start each test from a clean global-settings slate so effective-theme
  // fallbacks are deterministic.
  try {
    fs.unlinkSync(GLOBAL_SETTINGS_FILE)
  } catch {
    // ignore
  }
})

afterEach(() => {
  // Restore original files
  if (originalWorkspaces !== null) {
    fs.writeFileSync(WORKSPACES_FILE, originalWorkspaces)
  } else {
    try {
      fs.unlinkSync(WORKSPACES_FILE)
    } catch {
      // ignore
    }
  }
  if (originalGlobalSettings !== null) {
    fs.writeFileSync(GLOBAL_SETTINGS_FILE, originalGlobalSettings)
  } else {
    try {
      fs.unlinkSync(GLOBAL_SETTINGS_FILE)
    } catch {
      // ignore
    }
  }
})

describe('WorkspaceManager', () => {
  describe('workspace CRUD', () => {
    it('creates a workspace with id, name, and project paths', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('My Stack', ['/tmp/project-a', '/tmp/project-b'])

      expect(ws.id).toMatch(/^ws_/)
      expect(ws.name).toBe('My Stack')
      expect(ws.projectPaths).toEqual(['/tmp/project-a', '/tmp/project-b'])
      expect(ws.lastOpenedAt).toBeTruthy()
      expect(ws.createdAt).toBeTruthy()
    })

    it('persists workspace to config file', () => {
      const wm = new WorkspaceManager()
      wm.createWorkspace('Test', ['/tmp/test'])

      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces).toHaveLength(1)
      expect(config.workspaces[0].name).toBe('Test')
    })

    it('lists workspaces sorted by lastOpenedAt descending', () => {
      const wm = new WorkspaceManager()
      const old = wm.createWorkspace('Old', ['/tmp/old'])
      // Manually set an older timestamp
      wm.updateWorkspace(old.id, { lastOpenedAt: '2020-01-01T00:00:00.000Z' })
      wm.createWorkspace('New', ['/tmp/new'])

      const list = wm.listWorkspaces()
      expect(list).toHaveLength(2)
      // New was created last so has the most recent lastOpenedAt
      expect(list[0].name).toBe('New')
      expect(list[1].name).toBe('Old')
    })

    it('updates a workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Before', ['/tmp/a'])
      const updated = wm.updateWorkspace(ws.id, { name: 'After' })

      expect(updated.name).toBe('After')
      expect(updated.projectPaths).toEqual(['/tmp/a'])
    })

    it('deletes a workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('ToDelete', ['/tmp/d'])
      wm.deleteWorkspace(ws.id)

      const list = wm.listWorkspaces()
      expect(list).toHaveLength(0)
    })

    it('updates lastWorkspaceId on create', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Test', ['/tmp/t'])
      const config = wm.loadWorkspaceConfig()
      expect(config.lastWorkspaceId).toBe(ws.id)
    })

    it('clears lastWorkspaceId when deleting the last workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Only', ['/tmp/o'])
      wm.deleteWorkspace(ws.id)
      const config = wm.loadWorkspaceConfig()
      expect(config.lastWorkspaceId).toBeNull()
    })

    it('throws when updating non-existent workspace', () => {
      const wm = new WorkspaceManager()
      expect(() => wm.updateWorkspace('ws_nonexist', { name: 'x' })).toThrow('Workspace not found')
    })
  })

  describe('runtime project management', () => {
    it('openSingleProject sets active project path', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/proj')
      expect(wm.getActiveProjectPath()).toBe('/tmp/proj')
      expect(wm.getOpenProjectPaths()).toEqual(['/tmp/proj'])
    })

    it('addProjectToWorkspace adds a second project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')

      expect(wm.getOpenProjectPaths()).toContain('/tmp/a')
      expect(wm.getOpenProjectPaths()).toContain('/tmp/b')
    })

    it('does not duplicate projects when adding same path', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/a')

      expect(wm.getOpenProjectPaths()).toHaveLength(1)
    })

    it('removeProjectFromWorkspace removes a project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.removeProjectFromWorkspace('/tmp/b')

      expect(wm.getOpenProjectPaths()).toEqual(['/tmp/a'])
    })

    it('switches active project when removing the active one', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.setActiveProjectPath('/tmp/b')
      wm.removeProjectFromWorkspace('/tmp/b')

      expect(wm.getActiveProjectPath()).toBe('/tmp/a')
    })

    it('setActiveProjectPath changes the active project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.setActiveProjectPath('/tmp/b')

      expect(wm.getActiveProjectPath()).toBe('/tmp/b')
    })

    it('auto-opens project when setting active to non-open project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.setActiveProjectPath('/tmp/b')

      expect(wm.getActiveProjectPath()).toBe('/tmp/b')
      expect(wm.getOpenProjectPaths()).toContain('/tmp/b')
    })

    it('setActiveWorkspaceId sets the active workspace ID', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      expect(wm.getActiveWorkspaceId()).toBeNull()

      wm.setActiveWorkspaceId('ws_test')
      expect(wm.getActiveWorkspaceId()).toBe('ws_test')
    })

    it('addProjectToWorkspace updates workspace config when activeWorkspaceId is set', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')

      // Create a workspace and set it as active
      const ws = wm.createWorkspace('Test', ['/tmp/a'])
      wm.setActiveWorkspaceId(ws.id)

      // Now adding a project should update the workspace config
      wm.addProjectToWorkspace('/tmp/b')
      const config = wm.loadWorkspaceConfig()
      const workspace = config.workspaces.find((w) => w.id === ws.id)
      expect(workspace?.projectPaths).toContain('/tmp/b')
    })

    it('closeAll clears all state', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')
      wm.closeAll()

      expect(wm.getActiveProjectPath()).toBeNull()
      expect(wm.getOpenProjectPaths()).toEqual([])
    })
  })

  describe('DataService routing', () => {
    it('getDataService returns the DataService for a specific project', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      wm.addProjectToWorkspace('/tmp/b')

      const dsA = wm.getDataService('/tmp/a')
      const dsB = wm.getDataService('/tmp/b')
      expect(dsA).toBeDefined()
      expect(dsB).toBeDefined()
      expect(dsA).not.toBe(dsB)
    })

    it('getDataService without arg returns active project DataService', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')

      const ds = wm.getDataService()
      expect(ds).toBeDefined()
    })

    it('throws when no active project for getDataService', () => {
      const wm = new WorkspaceManager()
      expect(() => wm.getDataService()).toThrow('No active project')
    })

    it('throws for unknown project path', () => {
      const wm = new WorkspaceManager()
      wm.openSingleProject('/tmp/a')
      expect(() => wm.getDataService('/tmp/nonexist')).toThrow('No DataService for project')
    })
  })

  describe('workspace open', () => {
    it('openWorkspace opens all projects in the workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Multi', ['/tmp/x', '/tmp/y'])
      wm.openWorkspace(ws.id)

      expect(wm.getOpenProjectPaths()).toContain('/tmp/x')
      expect(wm.getOpenProjectPaths()).toContain('/tmp/y')
      expect(wm.getActiveProjectPath()).toBe('/tmp/x')
    })

    it('openWorkspace throws for non-existent workspace', () => {
      const wm = new WorkspaceManager()
      expect(() => wm.openWorkspace('ws_fake')).toThrow('Workspace not found')
    })

    it('openWorkspace updates lastOpenedAt', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Test', ['/tmp/t'])
      const originalTime = ws.lastOpenedAt

      // Small delay to ensure time difference
      const now = new Date(Date.now() + 1000).toISOString()
      vi.setSystemTime(new Date(now))
      wm.openWorkspace(ws.id)
      vi.useRealTimers()

      const config = wm.loadWorkspaceConfig()
      const updated = config.workspaces.find((w) => w.id === ws.id)
      expect(updated!.lastOpenedAt).not.toBe(originalTime)
    })
  })

  describe('effective theme (global)', () => {
    it('returns defaults when no settings file exists', () => {
      const wm = new WorkspaceManager()
      const theme = wm.readEffectiveTheme()
      expect(theme.themeMode).toBe('system')
      expect(theme.darkTheme).toBe('familiar-dark')
      expect(theme.lightTheme).toBe('familiar-light')
    })

    it('reads theme from global settings', () => {
      fs.writeFileSync(
        GLOBAL_SETTINGS_FILE,
        JSON.stringify({
          themeMode: 'dark',
          darkTheme: 'dracula',
          lightTheme: 'solarized-light'
        })
      )

      const wm = new WorkspaceManager()
      const theme = wm.readEffectiveTheme()
      expect(theme.themeMode).toBe('dark')
      expect(theme.darkTheme).toBe('dracula')
      expect(theme.lightTheme).toBe('solarized-light')
    })

    it('writes to global settings regardless of active workspace', () => {
      const wm = new WorkspaceManager()
      const ws = wm.createWorkspace('Scoped', ['/tmp/a'])
      wm.setActiveWorkspaceId(ws.id)

      wm.writeEffectiveTheme({
        themeMode: 'dark',
        darkTheme: 'dracula',
        lightTheme: 'familiar-light'
      })

      // Global settings got the theme
      const raw = fs.readFileSync(GLOBAL_SETTINGS_FILE, 'utf-8')
      const global = JSON.parse(raw)
      expect(global.themeMode).toBe('dark')
      expect(global.darkTheme).toBe('dracula')

      // No per-workspace theme stored
      const config = wm.loadWorkspaceConfig()
      const stored = config.workspaces.find((w) => w.id === ws.id)
      expect(stored?.theme).toBeUndefined()
    })

    it('returns the same theme across different active workspaces', () => {
      const wm = new WorkspaceManager()
      const a = wm.createWorkspace('A', ['/tmp/a'])
      const b = wm.createWorkspace('B', ['/tmp/b'])

      wm.setActiveWorkspaceId(a.id)
      wm.writeEffectiveTheme({
        themeMode: 'dark',
        darkTheme: 'dracula',
        lightTheme: 'familiar-light'
      })

      wm.setActiveWorkspaceId(b.id)
      expect(wm.readEffectiveTheme().themeMode).toBe('dark')
      expect(wm.readEffectiveTheme().darkTheme).toBe('dracula')

      wm.setActiveWorkspaceId(a.id)
      expect(wm.readEffectiveTheme().themeMode).toBe('dark')
    })

    it('reads global theme even when activeWorkspaceId points to a missing workspace', () => {
      fs.writeFileSync(
        GLOBAL_SETTINGS_FILE,
        JSON.stringify({
          themeMode: 'dark',
          darkTheme: 'dracula',
          lightTheme: 'familiar-light'
        })
      )
      const wm = new WorkspaceManager()
      wm.setActiveWorkspaceId('ws_ghost')

      const theme = wm.readEffectiveTheme()
      expect(theme.themeMode).toBe('dark')
      expect(theme.darkTheme).toBe('dracula')
    })
  })

  describe('workspace-theme → global migration', () => {
    it('adopts the most-recently-opened workspace theme into global settings on first read', () => {
      fs.writeFileSync(
        WORKSPACES_FILE,
        JSON.stringify({
          workspaces: [
            {
              id: 'ws_old',
              name: 'Old',
              projectPaths: ['/tmp/old'],
              lastOpenedAt: '2026-01-01T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
              theme: {
                themeMode: 'light',
                darkTheme: 'familiar-dark',
                lightTheme: 'familiar-light'
              }
            },
            {
              id: 'ws_new',
              name: 'New',
              projectPaths: ['/tmp/new'],
              lastOpenedAt: '2026-04-20T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
              theme: {
                themeMode: 'dark',
                darkTheme: 'dracula',
                lightTheme: 'solarized-light'
              }
            }
          ],
          lastWorkspaceId: 'ws_new'
        })
      )

      const wm = new WorkspaceManager()
      const theme = wm.readEffectiveTheme()
      // Most-recent workspace wins
      expect(theme.themeMode).toBe('dark')
      expect(theme.darkTheme).toBe('dracula')
      expect(theme.lightTheme).toBe('solarized-light')

      // Global settings file created
      expect(fs.existsSync(GLOBAL_SETTINGS_FILE)).toBe(true)

      // All workspace theme fields stripped
      const config = wm.loadWorkspaceConfig()
      for (const w of config.workspaces) {
        expect(w.theme).toBeUndefined()
      }
    })

    it('workspace theme supersedes a stale global settings file', () => {
      // Pre-existing global file holds stale defaults; the user's real
      // preference lives on the workspace (that's where writes were going
      // before this refactor). Migration must promote the workspace value
      // so the user does not lose their actual theme choice.
      fs.writeFileSync(
        GLOBAL_SETTINGS_FILE,
        JSON.stringify({
          themeMode: 'system',
          darkTheme: 'familiar-dark',
          lightTheme: 'familiar-light'
        })
      )
      fs.writeFileSync(
        WORKSPACES_FILE,
        JSON.stringify({
          workspaces: [
            {
              id: 'ws_1',
              name: 'W',
              projectPaths: ['/tmp/w'],
              lastOpenedAt: '2026-04-20T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z',
              theme: {
                themeMode: 'dark',
                darkTheme: 'dracula',
                lightTheme: 'solarized-light'
              }
            }
          ],
          lastWorkspaceId: 'ws_1'
        })
      )

      const wm = new WorkspaceManager()
      const theme = wm.readEffectiveTheme()
      expect(theme.themeMode).toBe('dark')
      expect(theme.darkTheme).toBe('dracula')
      expect(theme.lightTheme).toBe('solarized-light')

      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces[0].theme).toBeUndefined()
    })

    it('is a noop when no workspace carries a theme', () => {
      fs.writeFileSync(
        WORKSPACES_FILE,
        JSON.stringify({
          workspaces: [
            {
              id: 'ws_1',
              name: 'W',
              projectPaths: ['/tmp/w'],
              lastOpenedAt: '2026-04-20T00:00:00.000Z',
              createdAt: '2026-01-01T00:00:00.000Z'
            }
          ],
          lastWorkspaceId: 'ws_1'
        })
      )

      const wm = new WorkspaceManager()
      wm.readEffectiveTheme()
      // No global settings file created — defaults remain in-memory only
      expect(fs.existsSync(GLOBAL_SETTINGS_FILE)).toBe(false)
    })
  })

  describe('config file handling', () => {
    it('handles missing workspaces.json gracefully', () => {
      try { fs.unlinkSync(WORKSPACES_FILE) } catch { /* ignore */ }

      const wm = new WorkspaceManager()
      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces).toEqual([])
      expect(config.lastWorkspaceId).toBeNull()
    })

    it('handles corrupt workspaces.json gracefully', () => {
      fs.writeFileSync(WORKSPACES_FILE, '{invalid json')

      const wm = new WorkspaceManager()
      const config = wm.loadWorkspaceConfig()
      expect(config.workspaces).toEqual([])
    })

    it('uses atomic writes (temp + rename)', () => {
      const wm = new WorkspaceManager()
      wm.createWorkspace('Atomic', ['/tmp/a'])

      // Verify the file exists and is valid JSON
      const raw = fs.readFileSync(WORKSPACES_FILE, 'utf-8')
      const config = JSON.parse(raw)
      expect(config.workspaces).toHaveLength(1)
    })
  })
})

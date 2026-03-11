import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@renderer/stores/ui-store'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset to defaults
    useUIStore.setState({
      sidebarOpen: true,
      sidebarWidth: 240,
      activeTaskId: null,
      taskDetailOpen: false,
      commandPaletteOpen: false,
      filters: {
        search: '',
        priority: [],
        labels: [],
        agentStatus: []
      },
      focusedColumnIndex: 0,
      focusedTaskIndex: 0,
      editorPanelWidth: 50
    })
  })

  describe('toggleSidebar', () => {
    it('toggles sidebarOpen from true to false', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true)
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(false)
    })

    it('toggles sidebarOpen from false to true', () => {
      useUIStore.setState({ sidebarOpen: false })
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })
  })

  describe('openTaskDetail / closeTaskDetail', () => {
    it('opens task detail with the given task id', () => {
      useUIStore.getState().openTaskDetail('tsk_abc')
      expect(useUIStore.getState().activeTaskId).toBe('tsk_abc')
      expect(useUIStore.getState().taskDetailOpen).toBe(true)
    })

    it('closes task detail and clears active task id', () => {
      useUIStore.getState().openTaskDetail('tsk_abc')
      useUIStore.getState().closeTaskDetail()
      expect(useUIStore.getState().activeTaskId).toBeNull()
      expect(useUIStore.getState().taskDetailOpen).toBe(false)
    })
  })

  describe('toggleCommandPalette', () => {
    it('toggles from false to true', () => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
      useUIStore.getState().toggleCommandPalette()
      expect(useUIStore.getState().commandPaletteOpen).toBe(true)
    })

    it('toggles from true to false', () => {
      useUIStore.setState({ commandPaletteOpen: true })
      useUIStore.getState().toggleCommandPalette()
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  describe('setFilter / clearFilters', () => {
    it('sets a search filter', () => {
      useUIStore.getState().setFilter('search', 'bug fix')
      expect(useUIStore.getState().filters.search).toBe('bug fix')
    })

    it('sets a priority filter', () => {
      useUIStore.getState().setFilter('priority', ['high', 'urgent'])
      expect(useUIStore.getState().filters.priority).toEqual(['high', 'urgent'])
    })

    it('sets a labels filter', () => {
      useUIStore.getState().setFilter('labels', ['feature'])
      expect(useUIStore.getState().filters.labels).toEqual(['feature'])
    })

    it('sets an agentStatus filter', () => {
      useUIStore.getState().setFilter('agentStatus', ['running'])
      expect(useUIStore.getState().filters.agentStatus).toEqual(['running'])
    })

    it('clearFilters resets all filters to defaults', () => {
      useUIStore.getState().setFilter('search', 'test')
      useUIStore.getState().setFilter('priority', ['high'])
      useUIStore.getState().setFilter('labels', ['bug'])
      useUIStore.getState().clearFilters()

      const { filters } = useUIStore.getState()
      expect(filters.search).toBe('')
      expect(filters.priority).toEqual([])
      expect(filters.labels).toEqual([])
      expect(filters.agentStatus).toEqual([])
    })
  })

  describe('setFocusedColumn', () => {
    it('sets focusedColumnIndex and resets focusedTaskIndex to 0', () => {
      useUIStore.setState({ focusedTaskIndex: 5 })
      useUIStore.getState().setFocusedColumn(3)
      expect(useUIStore.getState().focusedColumnIndex).toBe(3)
      expect(useUIStore.getState().focusedTaskIndex).toBe(0)
    })
  })

  describe('setEditorPanelWidth', () => {
    it('clamps to minimum 20', () => {
      useUIStore.getState().setEditorPanelWidth(5)
      expect(useUIStore.getState().editorPanelWidth).toBe(20)
    })

    it('clamps to maximum 80', () => {
      useUIStore.getState().setEditorPanelWidth(95)
      expect(useUIStore.getState().editorPanelWidth).toBe(80)
    })

    it('accepts valid values within range', () => {
      useUIStore.getState().setEditorPanelWidth(60)
      expect(useUIStore.getState().editorPanelWidth).toBe(60)
    })
  })
})

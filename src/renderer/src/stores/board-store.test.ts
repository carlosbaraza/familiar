import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '@renderer/stores/board-store'

describe('useBoardStore', () => {
  beforeEach(() => {
    useBoardStore.setState({
      draggedTaskId: null,
      dragOverColumn: null,
      selectedTaskIds: new Set<string>()
    })
  })

  describe('setDraggedTask', () => {
    it('sets draggedTaskId to the given value', () => {
      useBoardStore.getState().setDraggedTask('tsk_abc')
      expect(useBoardStore.getState().draggedTaskId).toBe('tsk_abc')
    })

    it('clears draggedTaskId when set to null', () => {
      useBoardStore.getState().setDraggedTask('tsk_abc')
      useBoardStore.getState().setDraggedTask(null)
      expect(useBoardStore.getState().draggedTaskId).toBeNull()
    })
  })

  describe('setDragOverColumn', () => {
    it('sets dragOverColumn to the given status', () => {
      useBoardStore.getState().setDragOverColumn('in-progress')
      expect(useBoardStore.getState().dragOverColumn).toBe('in-progress')
    })

    it('clears dragOverColumn when set to null', () => {
      useBoardStore.getState().setDragOverColumn('todo')
      useBoardStore.getState().setDragOverColumn(null)
      expect(useBoardStore.getState().dragOverColumn).toBeNull()
    })
  })

  describe('toggleTaskSelection', () => {
    it('selects a task when append is false and task is not selected', () => {
      useBoardStore.getState().toggleTaskSelection('tsk_a', false)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_a')).toBe(true)
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(1)
    })

    it('replaces selection when append is false', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a', 'tsk_b']) })
      useBoardStore.getState().toggleTaskSelection('tsk_c', false)
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(1)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_c')).toBe(true)
    })

    it('adds to selection when append is true', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a']) })
      useBoardStore.getState().toggleTaskSelection('tsk_b', true)
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(2)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_a')).toBe(true)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_b')).toBe(true)
    })

    it('deselects a task when append is true and task is already selected', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a', 'tsk_b']) })
      useBoardStore.getState().toggleTaskSelection('tsk_a', true)
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(1)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_a')).toBe(false)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_b')).toBe(true)
    })

    it('re-selects a task when append is false and task is the only one selected', () => {
      // With append=false, a fresh set is created (empty), so the task gets added back
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a']) })
      useBoardStore.getState().toggleTaskSelection('tsk_a', false)
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(1)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_a')).toBe(true)
    })
  })

  describe('setSelectedTaskIds', () => {
    it('sets the selectedTaskIds to the given set', () => {
      const ids = new Set(['tsk_a', 'tsk_b', 'tsk_c'])
      useBoardStore.getState().setSelectedTaskIds(ids)
      expect(useBoardStore.getState().selectedTaskIds).toEqual(ids)
    })

    it('replaces existing selection', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_old']) })
      useBoardStore.getState().setSelectedTaskIds(new Set(['tsk_new']))
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_old')).toBe(false)
      expect(useBoardStore.getState().selectedTaskIds.has('tsk_new')).toBe(true)
    })
  })

  describe('clearSelection', () => {
    it('clears all selected task ids', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a', 'tsk_b']) })
      useBoardStore.getState().clearSelection()
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(0)
    })

    it('is a no-op when already empty', () => {
      useBoardStore.getState().clearSelection()
      expect(useBoardStore.getState().selectedTaskIds.size).toBe(0)
    })
  })

  describe('isSelected', () => {
    it('returns true for a selected task', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a']) })
      expect(useBoardStore.getState().isSelected('tsk_a')).toBe(true)
    })

    it('returns false for a non-selected task', () => {
      useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a']) })
      expect(useBoardStore.getState().isSelected('tsk_b')).toBe(false)
    })

    it('returns false when selection is empty', () => {
      expect(useBoardStore.getState().isSelected('tsk_a')).toBe(false)
    })
  })
})

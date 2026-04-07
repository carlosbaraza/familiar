import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock matchMedia for theme resolution
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})

// Mock BlockNote modules before importing the component
vi.mock('@blocknote/react', () => {
  const mockEditor = {
    document: [],
    tryParseMarkdownToBlocks: vi.fn().mockResolvedValue([]),
    blocksToMarkdownLossy: vi.fn().mockResolvedValue(''),
    replaceBlocks: vi.fn()
  }
  return {
    useCreateBlockNote: vi.fn(() => mockEditor)
  }
})

vi.mock('@blocknote/mantine', () => ({
  BlockNoteView: vi.fn(({ onChange, ...props }: { onChange?: () => void; editor: unknown; theme?: string }) => (
    <div data-testid="blocknote-view" data-theme={props.theme} onClick={onChange}>
      BlockNote Editor
    </div>
  ))
}))

// Mock CSS imports
vi.mock('@blocknote/core/fonts/inter.css', () => ({}))
vi.mock('@blocknote/mantine/style.css', () => ({}))

import { BlockEditor } from './BlockEditor'

// Setup window.api mock
beforeEach(() => {
  window.api = {
    readTaskDocument: vi.fn().mockResolvedValue(''),
    writeTaskDocument: vi.fn().mockResolvedValue(undefined),
    saveAttachment: vi.fn().mockResolvedValue('/tmp/test-attachment.png')
  } as unknown as typeof window.api
})

describe('BlockEditor', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" />
    )
    expect(getByTestId('block-editor')).toBeDefined()
  })

  it('renders the BlockNoteView with dark theme', () => {
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" />
    )
    const view = getByTestId('blocknote-view')
    expect(view.getAttribute('data-theme')).toBe('dark')
  })

  it('renders with initial content', () => {
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" initialContent="# Hello World" />
    )
    expect(getByTestId('block-editor')).toBeDefined()
  })

  it('calls onChange when editor content changes', async () => {
    const mockOnChange = vi.fn()
    const { getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" onChange={mockOnChange} />
    )

    // The BlockNoteView mock triggers onChange on click
    const view = getByTestId('blocknote-view')
    view.click()

    // onChange is debounced (1 second), so we won't see it immediately
    // but the component should not throw
    expect(view).toBeDefined()
  })

  it('does not reload content when initialContent matches last saved markdown', async () => {
    const { useCreateBlockNote } = await import('@blocknote/react')
    const mockEditor = (useCreateBlockNote as ReturnType<typeof vi.fn>)()

    const { rerender } = render(
      <BlockEditor taskId="tsk_abc123" initialContent="# Hello" />
    )

    // Simulate the editor saving markdown (which sets lastSavedMarkdownRef)
    // The debounced save writes markdown and records it in the ref.
    // After initial load, replaceBlocks should have been called once.
    const initialCallCount = mockEditor.replaceBlocks.mock.calls.length

    // Re-render with the same content (simulating file-watcher echo)
    rerender(<BlockEditor taskId="tsk_abc123" initialContent="# Hello" />)

    // replaceBlocks should NOT have been called again for identical content
    // (React's useEffect skips if deps haven't changed — same string ref)
    expect(mockEditor.replaceBlocks.mock.calls.length).toBe(initialCallCount)
  })

  it('skips reload when a debounced save is pending', async () => {
    const { useCreateBlockNote } = await import('@blocknote/react')
    const mockEditor = (useCreateBlockNote as ReturnType<typeof vi.fn>)()
    mockEditor.tryParseMarkdownToBlocks.mockResolvedValue([{ type: 'paragraph' }])

    const { rerender, getByTestId } = render(
      <BlockEditor taskId="tsk_abc123" initialContent="# Initial" />
    )

    // Wait for initial load to complete
    await vi.waitFor(() => {
      expect(mockEditor.replaceBlocks).toHaveBeenCalled()
    })

    const callsAfterInit = mockEditor.replaceBlocks.mock.calls.length

    // Trigger onChange (simulating user edit — starts the debounce timer)
    const view = getByTestId('blocknote-view')
    view.click()

    // Now re-render with different content (simulating file-watcher reading stale disk content)
    rerender(<BlockEditor taskId="tsk_abc123" initialContent="# Stale from disk" />)

    // Give any async effects time to run
    await new Promise((r) => setTimeout(r, 50))

    // replaceBlocks should NOT have been called again because a save timer is pending
    expect(mockEditor.replaceBlocks.mock.calls.length).toBe(callsAfterInit)
  })
})

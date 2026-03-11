import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SplitPanel } from './SplitPanel'

describe('SplitPanel', () => {
  it('renders left and right content', () => {
    const { getByText } = render(
      <SplitPanel left={<div>Left Content</div>} right={<div>Right Content</div>} />
    )
    expect(getByText('Left Content')).toBeDefined()
    expect(getByText('Right Content')).toBeDefined()
  })

  it('applies default left width of 50%', () => {
    const { getByTestId } = render(
      <SplitPanel left={<div>L</div>} right={<div>R</div>} />
    )
    const leftPanel = getByTestId('split-left')
    expect(leftPanel.style.width).toBe('50%')
  })

  it('applies custom default left width', () => {
    const { getByTestId } = render(
      <SplitPanel left={<div>L</div>} right={<div>R</div>} defaultLeftWidth={30} />
    )
    const leftPanel = getByTestId('split-left')
    expect(leftPanel.style.width).toBe('30%')
  })

  it('renders the drag handle with separator role', () => {
    const { getByTestId } = render(
      <SplitPanel left={<div>L</div>} right={<div>R</div>} />
    )
    const handle = getByTestId('split-handle')
    expect(handle.getAttribute('role')).toBe('separator')
  })

  it('starts drag on mousedown and stops on mouseup', () => {
    const onWidthChange = vi.fn()
    const { getByTestId } = render(
      <SplitPanel
        left={<div>L</div>}
        right={<div>R</div>}
        onWidthChange={onWidthChange}
      />
    )
    const handle = getByTestId('split-handle')

    // Mousedown starts dragging
    fireEvent.mouseDown(handle)

    // Mouseup on document stops dragging
    fireEvent.mouseUp(document)

    // Verify cursor is restored
    expect(document.body.style.cursor).toBe('')
  })

  it('clamps width to min and max', () => {
    const onWidthChange = vi.fn()
    const { getByTestId } = render(
      <SplitPanel
        left={<div>L</div>}
        right={<div>R</div>}
        minLeftWidth={30}
        maxLeftWidth={70}
        onWidthChange={onWidthChange}
      />
    )
    const handle = getByTestId('split-handle')
    const container = getByTestId('split-panel')

    // Mock getBoundingClientRect
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
      right: 1000,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    fireEvent.mouseDown(handle)

    // Move to 10% (should be clamped to 30%)
    fireEvent.mouseMove(document, { clientX: 100 })
    expect(onWidthChange).toHaveBeenLastCalledWith(30)

    // Move to 90% (should be clamped to 70%)
    fireEvent.mouseMove(document, { clientX: 900 })
    expect(onWidthChange).toHaveBeenLastCalledWith(70)

    // Move to 50% (should be exact)
    fireEvent.mouseMove(document, { clientX: 500 })
    expect(onWidthChange).toHaveBeenLastCalledWith(50)

    fireEvent.mouseUp(document)
  })
})

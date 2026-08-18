import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestChoice } from '../../src/choice-dialog'
import { CsvContextToolbar } from '../../src/csv-context-toolbar'
import { createIcon, setIcon } from '../../src/icons'

const pointerAt = (x = 40, y = 50) => new MouseEvent('pointerdown', {
  bubbles: true,
  clientX: x,
  clientY: y,
}) as unknown as PointerEvent

describe('SVG icons', () => {
  it('renders a clean Sigma path without the removed horizontal strokes', () => {
    const icon = createIcon('formula')
    expect(icon.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(icon.querySelector('path')?.getAttribute('d')).toBe('M17 5H8l5 7-5 7h9')
  })

  it('replaces text content and records the semantic icon name', () => {
    const button = document.createElement('button')
    button.textContent = 'old unicode symbol'
    setIcon(button, 'save')
    expect(button.textContent).toBe('')
    expect(button.dataset.icon).toBe('save')
    expect(button.querySelector('svg')).not.toBeNull()
  })
})

describe('CSV context toolbar', () => {
  let toolbar: CsvContextToolbar

  beforeEach(() => {
    toolbar = new CsvContextToolbar()
  })

  afterEach(() => {
    toolbar.destroy()
    document.body.replaceChildren()
  })

  it('maps actions to compact accessible buttons and executes the callback', () => {
    const action = vi.fn()
    toolbar.open(pointerAt(), [
      { title: 'Insert a new row after', onclick: action },
      { type: 'line', title: '' },
      { title: 'Order ascending', onclick: vi.fn() },
    ] as never)

    const insert = toolbar.element.querySelector<HTMLButtonElement>(
      '[aria-label="Insert a blank row after the selected row"]',
    )
    expect(toolbar.element.hidden).toBe(false)
    expect(insert?.dataset.icon).toBe('row-after')
    insert?.click()
    expect(action).toHaveBeenCalledOnce()
    expect(toolbar.element.hidden).toBe(true)
  })

  it('flattens submenu actions and trims trailing separators', () => {
    toolbar.open(pointerAt(), [
      {
        title: 'Rows',
        submenu: [{ title: 'Delete selected rows', onclick: vi.fn() }],
      },
      { type: 'divisor', title: '' },
    ] as never)
    expect(toolbar.element.querySelectorAll('button')).toHaveLength(1)
    expect(toolbar.element.lastElementChild?.classList.contains(
      'csv-context-separator',
    )).toBe(false)
  })

  it('disables actions without callbacks and never invokes them', () => {
    toolbar.open(pointerAt(), [
      { title: 'Paste', disabled: true },
    ] as never)
    const button = toolbar.element.querySelector<HTMLButtonElement>('button')
    expect(button?.disabled).toBe(true)
  })

  it('closes on an outside pointer press and Escape', () => {
    toolbar.open(pointerAt(), [{ title: 'Copy', onclick: vi.fn() }] as never)
    document.body.dispatchEvent(pointerAt())
    expect(toolbar.element.hidden).toBe(true)

    toolbar.open(pointerAt(), [{ title: 'Copy', onclick: vi.fn() }] as never)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(toolbar.element.hidden).toBe(true)
  })

  it('does not open when there are no executable menu items', () => {
    toolbar.open(pointerAt(), [{ type: 'line', title: '' }] as never)
    expect(toolbar.element.hidden).toBe(true)
  })
})

describe('choice dialog', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) { this.open = true },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false
        this.dispatchEvent(new Event('close'))
      },
    })
  })

  afterEach(() => document.body.replaceChildren())

  it('resolves the selected stable value and removes itself', async () => {
    const result = requestChoice({
      title: 'Choose source',
      label: 'Source file',
      choices: [
        { value: 'plain', label: 'Blank Mermaid' },
        { value: 'csv-id', label: 'data.csv', detail: 'CSV source' },
      ],
    })
    const options = document.querySelectorAll<HTMLButtonElement>(
      '.choice-dialog-option',
    )
    options[1].click()
    await expect(result).resolves.toBe('csv-id')
    expect(document.querySelector('.choice-dialog')).toBeNull()
  })

  it('resolves undefined when cancelled', async () => {
    const result = requestChoice({
      title: 'Choose',
      label: 'One',
      choices: [{ value: 'one', label: 'One' }],
    })
    document.querySelector<HTMLButtonElement>('.choice-dialog-cancel')?.click()
    await expect(result).resolves.toBeUndefined()
  })
})

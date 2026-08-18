import type jspreadsheet from 'jspreadsheet-ce'
import { setIcon, type IconName } from './icons'

type ContextMenuItem = jspreadsheet.ContextMenuItem

type ActionPresentation = {
  icon: IconName
  tooltip: string
}

const actionPresentations: Array<[string, ActionPresentation]> = [
  [
    'Insert a new row before',
    { icon: 'row-before', tooltip: 'Insert a blank row before the selected row' },
  ],
  [
    'Insert a new row after',
    { icon: 'row-after', tooltip: 'Insert a blank row after the selected row' },
  ],
  ['Delete selected rows', { icon: 'row-delete', tooltip: 'Delete the selected rows' }],
  [
    'Insert a new column before',
    { icon: 'column-before', tooltip: 'Insert a blank column before the selected column' },
  ],
  [
    'Insert a new column after',
    { icon: 'column-after', tooltip: 'Insert a blank column after the selected column' },
  ],
  ['Delete selected columns', { icon: 'column-delete', tooltip: 'Delete the selected columns' }],
  ['Rename this column', { icon: 'edit', tooltip: 'Rename the selected column' }],
  [
    'Order ascending',
    { icon: 'sort-ascending', tooltip: 'Sort the selected column from smallest to largest' },
  ],
  [
    'Order descending',
    { icon: 'sort-descending', tooltip: 'Sort the selected column from largest to smallest' },
  ],
  ['Copy', { icon: 'copy', tooltip: 'Copy the selected cells (Ctrl + C)' }],
  ['Paste', { icon: 'paste', tooltip: 'Paste cells from the clipboard (Ctrl + V)' }],
  [
    'Save as',
    { icon: 'download', tooltip: 'Download this spreadsheet as a CSV file (Ctrl + S)' },
  ],
  ['About', { icon: 'info', tooltip: 'Show spreadsheet information' }],
  ['Add comments', { icon: 'comment', tooltip: 'Add comments to the selected cells' }],
]

const presentationFor = (item: ContextMenuItem): ActionPresentation => {
  const known = actionPresentations.find(([title]) => item.title.startsWith(title))
  if (known) return known[1]
  return {
    icon: 'more',
    tooltip: item.tooltip || item.title,
  }
}

const appendMenuItems = (
  target: HTMLElement,
  items: ContextMenuItem[],
) => {
  let hasAction = target.querySelector('button') !== null

  for (const item of items) {
    if (item.type === 'line' || item.type === 'divisor') {
      if (
        hasAction &&
        target.lastElementChild?.className !== 'csv-context-separator'
      ) {
        const separator = document.createElement('span')
        separator.className = 'csv-context-separator'
        separator.setAttribute('aria-hidden', 'true')
        target.append(separator)
      }
      continue
    }

    if (item.submenu?.length) {
      appendMenuItems(target, item.submenu)
      hasAction = target.querySelector('button') !== null
      continue
    }

    const presentation = presentationFor(item)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'csv-context-action'
    setIcon(button, presentation.icon)
    button.dataset.tooltip = presentation.tooltip
    button.setAttribute('aria-label', presentation.tooltip)
    button.disabled = Boolean(item.disabled || !item.onclick)
    if (item.onclick) {
      button.addEventListener('click', (event) => {
        item.onclick?.(button, event)
      }, { once: true })
    }
    target.append(button)
    hasAction = true
  }

  if (target.lastElementChild?.className === 'csv-context-separator') {
    target.lastElementChild.remove()
  }
}

export class CsvContextToolbar {
  readonly element: HTMLDivElement

  constructor() {
    this.element = document.createElement('div')
    this.element.className = 'csv-context-toolbar'
    this.element.hidden = true
    this.element.setAttribute('role', 'toolbar')
    this.element.setAttribute('aria-label', 'Spreadsheet actions')
    document.body.append(this.element)

    this.element.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
    })
    this.element.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) this.close()
    })
    this.element.addEventListener('contextmenu', (event) => event.preventDefault())
    document.addEventListener('pointerdown', this.onDocumentPointerDown, true)
    document.addEventListener('keydown', this.onDocumentKeyDown)
    window.addEventListener('blur', this.close)
    window.addEventListener('resize', this.close)
    window.addEventListener('scroll', this.close, true)
  }

  open = (event: PointerEvent, items: ContextMenuItem[]) => {
    this.element.replaceChildren()
    appendMenuItems(this.element, items)
    if (!this.element.querySelector('button')) {
      this.close()
      return
    }

    this.element.hidden = false
    const bounds = this.element.getBoundingClientRect()
    const left = Math.min(
      window.innerWidth - bounds.width - 8,
      Math.max(8, event.clientX),
    )
    const below = event.clientY + bounds.height + 8
    const top = below <= window.innerHeight - 8
      ? event.clientY + 8
      : Math.max(8, event.clientY - bounds.height - 8)
    this.element.style.left = `${Math.round(left)}px`
    this.element.style.top = `${Math.round(top)}px`
  }

  close = () => {
    this.element.hidden = true
    this.element.replaceChildren()
  }

  destroy = () => {
    document.removeEventListener('pointerdown', this.onDocumentPointerDown, true)
    document.removeEventListener('keydown', this.onDocumentKeyDown)
    window.removeEventListener('blur', this.close)
    window.removeEventListener('resize', this.close)
    window.removeEventListener('scroll', this.close, true)
    this.element.remove()
  }

  private onDocumentPointerDown = (event: PointerEvent) => {
    if (!this.element.hidden && !this.element.contains(event.target as Node)) {
      this.close()
    }
  }

  private onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.close()
  }
}

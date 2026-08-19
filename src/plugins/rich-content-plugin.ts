import type { Ctx } from '@milkdown/kit/ctx'
import { getMarkRange } from '@milkdown/kit/prose'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { redo, undo } from '@milkdown/kit/prose/history'
import {
  lift,
  setBlockType,
  toggleMark,
  wrapIn,
} from '@milkdown/kit/prose/commands'
import { liftListItem, wrapInList } from '@milkdown/kit/prose/schema-list'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  isInTable,
  selectedRect,
} from '@milkdown/kit/prose/tables'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { extendListItemSchemaForTask } from '@milkdown/kit/preset/gfm'
import { TooltipProvider, tooltipFactory } from '@milkdown/plugin-tooltip'
import { $view } from '@milkdown/kit/utils'
import { mathInlineSchema } from './latex-plugin'
import { setIcon, type IconName } from '../icons'

const [richContentTooltip, richContentTooltipPlugin] =
  tooltipFactory('rich-content')
const [tableTooltip, tableTooltipPlugin] = tooltipFactory('table-content')

type Command =
  | 'undo'
  | 'redo'
  | 'strong'
  | 'emphasis'
  | 'strike_through'
  | 'inlineCode'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'bullet_list'
  | 'task_list'
  | 'ordered_list'
  | 'blockquote'
  | 'table'
  | 'code_block'
  | 'formula'
  | 'diagram'

type DiagramCommandHandler = (
  view: EditorView,
) => boolean | Promise<boolean>

let diagramCommandHandler: DiagramCommandHandler | undefined

/** Connect the editor toolbar to the workspace-aware Mermaid workflow. */
export const configureDiagramCommand = (handler: DiagramCommandHandler) => {
  diagramCommandHandler = handler
}

type TableCommand =
  | 'add-row-before'
  | 'add-row-after'
  | 'delete-row'
  | 'add-column-before'
  | 'add-column-after'
  | 'delete-column'

export type TextDialogOptions = {
  title: string
  label: string
  value?: string
  submitLabel?: string
  removeLabel?: string
  multiline?: boolean
}

let activeTextDialog: ((value: string | null) => void) | undefined

/**
 * Use the app-owned dialog instead of browser prompt(). This also gives
 * callers such as the file browser a consistent multiline input surface.
 */
export const requestText = (
  options: TextDialogOptions,
): Promise<string | null> => {
  activeTextDialog?.(null)

  const dialog = document.querySelector<HTMLDivElement>('#source-dialog')
  const title = document.querySelector<HTMLElement>('#source-dialog-title')
  const label = document.querySelector<HTMLLabelElement>('#source-dialog-label')
  const input = document.querySelector<HTMLTextAreaElement>('#source-dialog-input')
  const remove = document.querySelector<HTMLButtonElement>('#source-dialog-remove')
  const cancel = document.querySelector<HTMLButtonElement>('#source-dialog-cancel')
  const submit = document.querySelector<HTMLButtonElement>('#source-dialog-submit')

  if (!dialog || !title || !label || !input || !remove || !cancel || !submit) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    let settled = false

    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      dialog.hidden = true
      remove.removeEventListener('click', onRemove)
      cancel.removeEventListener('click', onCancel)
      submit.removeEventListener('click', onSubmit)
      dialog.removeEventListener('pointerdown', onBackdropPointerDown)
      input.removeEventListener('keydown', onKeyDown)
      if (activeTextDialog === finish) activeTextDialog = undefined
      resolve(value)
    }

    const onRemove = () => finish('')
    const onCancel = () => finish(null)
    const onSubmit = () => finish(input.value)
    const onBackdropPointerDown = (event: PointerEvent) => {
      if (event.target === dialog) finish(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish(null)
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        finish(input.value)
      }
    }

    activeTextDialog = finish
    title.textContent = options.title
    label.textContent = options.label
    input.value = options.value ?? ''
    input.rows = options.multiline === false ? 1 : 8
    remove.textContent = options.removeLabel ?? 'Remove'
    remove.hidden = !options.removeLabel
    submit.textContent = options.submitLabel ?? 'Apply'
    dialog.hidden = false
    remove.addEventListener('click', onRemove)
    cancel.addEventListener('click', onCancel)
    submit.addEventListener('click', onSubmit)
    dialog.addEventListener('pointerdown', onBackdropPointerDown)
    input.addEventListener('keydown', onKeyDown)
    input.focus()
    input.select()
  })
}

type CommandSpec = {
  icon: IconName
  title: string
  command: Command
  group: 'history' | 'text' | 'structure' | 'insert'
}

const commands: CommandSpec[] = [
  { icon: 'undo', title: 'Undo', command: 'undo', group: 'history' },
  { icon: 'redo', title: 'Redo', command: 'redo', group: 'history' },
  { icon: 'bold', title: 'Bold', command: 'strong', group: 'text' },
  { icon: 'italic', title: 'Italic', command: 'emphasis', group: 'text' },
  { icon: 'strikethrough', title: 'Strikethrough', command: 'strike_through', group: 'text' },
  { icon: 'code', title: 'Inline code', command: 'inlineCode', group: 'text' },
  { icon: 'link', title: 'Add link', command: 'link', group: 'text' },
  { icon: 'heading-1', title: 'Heading 1', command: 'heading1', group: 'structure' },
  { icon: 'heading-2', title: 'Heading 2', command: 'heading2', group: 'structure' },
  { icon: 'list-bulleted', title: 'Bullet list', command: 'bullet_list', group: 'structure' },
  { icon: 'list-check', title: 'Checklist', command: 'task_list', group: 'structure' },
  { icon: 'list-numbered', title: 'Numbered list', command: 'ordered_list', group: 'structure' },
  { icon: 'quote', title: 'Blockquote', command: 'blockquote', group: 'structure' },
  { icon: 'table', title: 'Insert table', command: 'table', group: 'insert' },
  { icon: 'code-block', title: 'Code block', command: 'code_block', group: 'insert' },
  { icon: 'formula', title: 'Insert LaTeX formula', command: 'formula', group: 'insert' },
  { icon: 'diagram', title: 'Insert Mermaid diagram', command: 'diagram', group: 'insert' },
]

const createButton = (icon: IconName, title: string, command: string) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rich-content-button'
  button.dataset.command = command
  button.title = title
  button.dataset.tooltip = title
  button.setAttribute('aria-label', title)
  setIcon(button, icon)
  return button
}

const createToolbar = (className: string, specs: CommandSpec[]) => {
  const element = document.createElement('div')
  element.className = className
  element.setAttribute('role', 'toolbar')
  element.setAttribute('aria-label', 'Formatting toolbar')
  let previousGroup: CommandSpec['group'] | undefined
  for (const spec of specs) {
    if (previousGroup && previousGroup !== spec.group) {
      const separator = document.createElement('span')
      separator.className = 'rich-content-separator'
      separator.setAttribute('aria-hidden', 'true')
      element.append(separator)
    }
    element.append(createButton(spec.icon, spec.title, spec.command))
    previousGroup = spec.group
  }
  return element
}

const floatingCommands = commands.filter(({ group }) => group === 'text')
const floatingToolbar = createToolbar('rich-content-toolbar', floatingCommands)
const persistentToolbar = createToolbar(
  'rich-content-toolbar rich-content-toolbar--persistent',
  commands,
)
const toolbars = [floatingToolbar, persistentToolbar]

const taskListItemView = $view(
  extendListItemSchemaForTask.node,
  () => (initialNode, view, getPos) => {
    let currentNode = initialNode
    const dom = document.createElement('li')
    const checkbox = document.createElement('input')
    const contentDOM = document.createElement('div')
    checkbox.type = 'checkbox'
    checkbox.className = 'task-list-checkbox'
    checkbox.contentEditable = 'false'
    contentDOM.className = 'task-list-item-content'
    dom.append(checkbox, contentDOM)

    const render = (node: ProseNode) => {
      const isTask = typeof node.attrs.checked === 'boolean'
      dom.classList.toggle('task-list-item', isTask)
      dom.toggleAttribute('data-item-type', isTask)
      if (isTask) dom.dataset.itemType = 'task'
      if (isTask) dom.dataset.checked = String(node.attrs.checked)
      else delete dom.dataset.checked
      checkbox.hidden = !isTask
      checkbox.checked = node.attrs.checked === true
      checkbox.setAttribute(
        'aria-label',
        checkbox.checked ? 'Mark task incomplete' : 'Mark task complete',
      )
    }

    const onChange = () => {
      const position = getPos?.()
      if (typeof position !== 'number') return
      const node = view.state.doc.nodeAt(position)
      if (!node || node.type !== currentNode.type || node.attrs.checked == null) return
      view.dispatch(view.state.tr.setNodeMarkup(position, undefined, {
        ...node.attrs,
        checked: checkbox.checked,
      }))
    }
    checkbox.addEventListener('change', onChange)
    render(initialNode)

    return {
      dom,
      contentDOM,
      update: (updatedNode) => {
        if (updatedNode.type !== initialNode.type) return false
        currentNode = updatedNode
        render(updatedNode)
        return true
      },
      stopEvent: (event) => checkbox.contains(event.target as globalThis.Node),
      ignoreMutation: (mutation) => checkbox.contains(mutation.target),
      destroy: () => checkbox.removeEventListener('change', onChange),
    }
  },
)

const createTableButton = (
  icon: IconName,
  title: string,
  command: TableCommand,
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rich-content-button table-content-button'
  button.dataset.tableCommand = command
  button.title = title
  button.dataset.tooltip = title
  button.setAttribute('aria-label', title)
  setIcon(button, icon)
  return button
}

const tableToolbar = document.createElement('div')
tableToolbar.className = 'rich-content-toolbar table-content-toolbar'
tableToolbar.setAttribute('aria-label', 'Table toolbar')
tableToolbar.append(
  createTableButton('row-before', 'Insert row before', 'add-row-before'),
  createTableButton('row-after', 'Insert row after', 'add-row-after'),
  createTableButton('row-delete', 'Delete row', 'delete-row'),
  createTableButton('column-before', 'Insert column before', 'add-column-before'),
  createTableButton('column-after', 'Insert column after', 'add-column-after'),
  createTableButton('column-delete', 'Delete column', 'delete-column'),
)

const provider = new TooltipProvider({
  content: floatingToolbar,
  offset: 10,
  shouldShow: (view) => {
    const { selection } = view.state
    return !selection.empty && view.hasFocus() && view.editable
  },
})

const applyMark = (view: EditorView, markName: string) => {
  const mark = view.state.schema.marks[markName]
  if (!mark) return false
  return toggleMark(mark)(view.state, view.dispatch)
}

const applyLink = async (view: EditorView) => {
  const mark = view.state.schema.marks.link
  if (!mark) return false

  const { from, to, empty, $from } = view.state.selection
  const currentRange = getMarkRange($from, mark)
  const currentHref = currentRange?.mark.attrs.href
  const hasSelectedLink = !empty && view.state.doc.rangeHasMark(from, to, mark)
  const isEditing = Boolean(currentRange) || hasSelectedLink

  const href = await requestText({
    title: isEditing ? 'Edit link' : 'Add link',
    label: 'Link URL',
    value: currentHref || (isEditing ? '' : 'https://'),
    submitLabel: isEditing ? 'Update link' : 'Add link',
    removeLabel: isEditing ? 'Remove link' : undefined,
    multiline: false,
  })
  if (href === null) return false

  const targetFrom = empty && currentRange ? currentRange.from : from
  const targetTo = empty && currentRange ? currentRange.to : to
  if (!href.trim()) {
    if (targetFrom === targetTo) return false
    const transaction = view.state.tr.removeMark(targetFrom, targetTo, mark)
    if (!transaction.docChanged) return false
    view.dispatch(transaction)
    return true
  }

  if (targetFrom !== targetTo) {
    const transaction = view.state.tr.addMark(
      targetFrom,
      targetTo,
      mark.create({ href, title: currentRange?.mark.attrs.title ?? null }),
    )
    if (!transaction.docChanged) return false
    view.dispatch(transaction)
    return true
  }

  return toggleMark(mark, { href, title: null })(view.state, view.dispatch)
}

const applyBlockquote = (view: EditorView) => {
  const blockquote = view.state.schema.nodes.blockquote
  if (!blockquote) return false
  if (hasAncestor(view, 'blockquote')) {
    return lift(view.state, view.dispatch)
  }
  return wrapIn(blockquote)(view.state, view.dispatch)
}

const listItemsInSelection = (view: EditorView) => {
  const listItem = view.state.schema.nodes.list_item
  if (!listItem) return []
  const items: Array<{ node: ProseNode; position: number }> = []
  const positions = new Set<number>()
  const add = (node: ProseNode, position: number) => {
    if (node.type !== listItem || positions.has(position)) return
    positions.add(position)
    items.push({ node, position })
  }
  const { $from, from, to, empty } = view.state.selection

  if (empty) {
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth)
      if (node.type === listItem) {
        add(node, $from.before(depth))
        break
      }
    }
    return items
  }

  view.state.doc.nodesBetween(from, to, (node, position) => {
    if (node.type !== listItem) return true
    add(node, position)
    return false
  })
  return items
}

const setTaskListItems = (
  view: EditorView,
  items: ReturnType<typeof listItemsInSelection>,
  enabled: boolean,
) => {
  const transaction = view.state.tr
  for (const { node, position } of items) {
    const checked = enabled ? (node.attrs.checked ?? false) : null
    if (node.attrs.checked === checked) continue
    transaction.setNodeMarkup(position, undefined, { ...node.attrs, checked })
  }
  if (!transaction.docChanged) return false
  view.dispatch(transaction)
  return true
}

const applyTaskList = (view: EditorView) => {
  let items = listItemsInSelection(view)
  if (!items.length) {
    const bulletList = view.state.schema.nodes.bullet_list
    if (!bulletList || !wrapInList(bulletList)(view.state, view.dispatch)) return false
    items = listItemsInSelection(view)
  }
  if (!items.length) return false
  const enable = items.some(({ node }) => node.attrs.checked == null)
  return setTaskListItems(view, items, enable)
}

const applyFormula = (view: EditorView) => {
  const formula = view.state.schema.nodes.math_inline
  if (!formula) return false

  try {
    const transaction = view.state.tr.replaceSelectionWith(
      formula.create({ value: '' }),
    )
    if (!transaction.docChanged) return false
    view.dispatch(transaction)
    return true
  } catch (error) {
    console.error('Could not insert LaTeX formula.', error)
    return false
  }
}

const applyFormulaBlock = (view: EditorView) => {
  const formula = view.state.schema.nodes.math_block
  if (!formula) return false

  try {
    const { $from } = view.state.selection
    const insertPosition =
      $from.depth > 0 ? $from.after(1) : view.state.doc.content.size
    const transaction = view.state.tr.insert(
      insertPosition,
      formula.create({ value: '' }),
    )
    if (!transaction.docChanged) return false
    view.dispatch(transaction)
    return true
  } catch (error) {
    console.error('Could not insert a formula block.', error)
    return false
  }
}

const applyTable = async (view: EditorView) => {
  const dimensions = await requestText({
    title: 'Insert table',
    label: 'Body rows × columns (for example, 3x3)',
    value: '3x3',
    submitLabel: 'Insert table',
    multiline: false,
  })
  const match = dimensions?.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  if (!match) return false

  const bodyRows = Math.min(30, Math.max(1, Number(match[1])))
  const columns = Math.min(15, Math.max(1, Number(match[2])))
  const { schema } = view.state
  const table = schema.nodes.table
  const tableRow = schema.nodes.table_row
  const tableHeaderRow = schema.nodes.table_header_row ?? tableRow
  const tableCell = schema.nodes.table_cell
  const tableHeader = schema.nodes.table_header ?? tableCell
  const paragraph = schema.nodes.paragraph
  if (!table || !tableRow || !tableCell || !paragraph) return false

  const makeCell = (cellType: typeof tableCell, text: string) =>
    cellType.create(null, paragraph.create(null, text ? schema.text(text) : undefined))
  const header = tableHeaderRow.create(
    null,
    Array.from({ length: columns }, (_, index) =>
      makeCell(tableHeader, `Header ${index + 1}`),
    ),
  )
  const rows = Array.from({ length: bodyRows }, (_, rowIndex) =>
    tableRow.create(
      null,
      Array.from({ length: columns }, (_, columnIndex) =>
        makeCell(tableCell, `Cell ${rowIndex + 1}.${columnIndex + 1}`),
      ),
    ),
  )
  const tableNode = table.create(null, [header, ...rows])
  const { $from } = view.state.selection
  const insertPosition =
    $from.depth > 0 ? $from.after(1) : view.state.doc.content.size
  const transaction = view.state.tr.insert(insertPosition, tableNode)
  if (!transaction.docChanged) return false
  view.dispatch(transaction.scrollIntoView())
  view.focus()
  return true
}

const formulaChoiceMenu = document.createElement('div')
formulaChoiceMenu.className = 'formula-choice-menu'
formulaChoiceMenu.setAttribute('role', 'menu')
formulaChoiceMenu.innerHTML = `
  <button type="button" data-formula-kind="inline" role="menuitem">Inline formula</button>
  <button type="button" data-formula-kind="block" role="menuitem">Formula block</button>
`

let formulaChoiceCleanup: (() => void) | undefined

const hideFormulaChoice = () => {
  formulaChoiceCleanup?.()
  formulaChoiceCleanup = undefined
  formulaChoiceMenu.remove()
}

const showFormulaChoice = (view: EditorView, anchor: HTMLElement) => {
  hideFormulaChoice()
  document.body.append(formulaChoiceMenu)
  const bounds = anchor.getBoundingClientRect()
  formulaChoiceMenu.style.left = `${Math.min(
    window.innerWidth - formulaChoiceMenu.offsetWidth - 12,
    Math.max(12, bounds.left),
  )}px`
  formulaChoiceMenu.style.top = `${bounds.bottom + 8}px`

  const onPointerDown = (event: PointerEvent) => {
    if (!formulaChoiceMenu.contains(event.target as Node)) hideFormulaChoice()
  }
  const onClick = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '[data-formula-kind]',
    )
    if (!button) return
    event.preventDefault()
    const inserted = button.dataset.formulaKind === 'block'
      ? applyFormulaBlock(view)
      : applyFormula(view)
    if (inserted) view.focus()
    hideFormulaChoice()
    document.removeEventListener('pointerdown', onPointerDown)
  }
  formulaChoiceMenu.addEventListener('click', onClick)
  document.addEventListener('pointerdown', onPointerDown)
  formulaChoiceCleanup = () => {
    formulaChoiceMenu.removeEventListener('click', onClick)
    document.removeEventListener('pointerdown', onPointerDown)
  }
}

const applyCommand = async (view: EditorView, command: Command) => {
  if (command === 'undo') return undo(view.state, view.dispatch)
  if (command === 'redo') return redo(view.state, view.dispatch)
  if (command === 'blockquote') return applyBlockquote(view)
  if (command === 'task_list') return applyTaskList(view)
  if (command === 'link') return applyLink(view)
  if (command === 'formula') return applyFormula(view)
  if (command === 'table') return applyTable(view)
  if (command === 'diagram') return await diagramCommandHandler?.(view) ?? false
  if (command === 'heading1' || command === 'heading2') {
    const heading = view.state.schema.nodes.heading
    if (!heading) return false
    return setBlockType(heading, {
      level: command === 'heading1' ? 1 : 2,
    })(view.state, view.dispatch)
  }
  if (command === 'bullet_list' || command === 'ordered_list') {
    const list = view.state.schema.nodes[command]
    const listItem = view.state.schema.nodes.list_item
    if (!list || !listItem) return false
    if (hasAncestor(view, command)) {
      return liftListItem(listItem)(view.state, view.dispatch)
    }
    return wrapInList(list)(view.state, view.dispatch)
  }
  if (command === 'code_block') {
    const codeBlock = view.state.schema.nodes.code_block
    if (!codeBlock) return false
    return setBlockType(codeBlock)(view.state, view.dispatch)
  }
  return applyMark(view, command)
}

const applyTableCommand = (view: EditorView, command: TableCommand) => {
  if (isInTable(view.state)) {
    const rect = selectedRect(view.state)
    // The schema requires the header row — deleting it would corrupt the table.
    if (command === 'delete-row' && rect.top === 0) return false
    if (command === 'delete-column' && rect.map.width === 1) {
      return deleteTable(view.state, view.dispatch)
    }
    if (
      command === 'delete-row' &&
      rect.map.height === 2 &&
      rect.top > 0
    ) {
      return deleteTable(view.state, view.dispatch)
    }
    // Inserting a row before the header row should insert after it instead.
    if (command === 'add-row-before' && rect.top === 0) {
      return addRowAfter(view.state, view.dispatch)
    }
  }
  const commands: Record<
    TableCommand,
    (state: Parameters<typeof isInTable>[0], dispatch?: EditorView['dispatch']) => boolean
  > = {
    'add-row-before': addRowBefore,
    'add-row-after': addRowAfter,
    'delete-row': deleteRow,
    'add-column-before': addColumnBefore,
    'add-column-after': addColumnAfter,
    'delete-column': deleteColumn,
  }
  return commands[command](view.state, view.dispatch)
}

const hasAncestor = (view: EditorView, nodeName: string) => {
  const target = view.state.schema.nodes[nodeName]
  if (!target) return false

  const { $from } = view.state.selection
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if ($from.node(depth).type === target) return true
  }
  return false
}

const syncActiveButtons = (view: EditorView) => {
  const { from, to, empty } = view.state.selection

  for (const toolbar of toolbars) {
    toolbar.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(
      (button) => {
        const command = button.dataset.command as Command | undefined
        const mark = command ? view.state.schema.marks[command] : undefined
        const activeMark =
          !empty && !!mark && view.state.doc.rangeHasMark(from, to, mark)
        const activeBlock =
          command === 'heading1' && hasAncestor(view, 'heading')
            ? view.state.selection.$from.parent.attrs.level === 1
            : command === 'heading2' && hasAncestor(view, 'heading')
              ? view.state.selection.$from.parent.attrs.level === 2
              : command === 'bullet_list'
                ? hasAncestor(view, 'bullet_list')
                : command === 'task_list'
                  ? listItemsInSelection(view).some(
                      ({ node }) => node.attrs.checked != null,
                    )
                : command === 'ordered_list'
                  ? hasAncestor(view, 'ordered_list')
                  : command === 'blockquote'
                    ? hasAncestor(view, 'blockquote')
                    : command === 'code_block'
                      ? hasAncestor(view, 'code_block')
                      : false
        button.setAttribute('aria-pressed', String(activeMark || activeBlock))

        if (command === 'undo') button.disabled = !undo(view.state)
        if (command === 'redo') button.disabled = !redo(view.state)
      },
    )
  }
}

export const richContentConfig = (ctx: Ctx) => {
  ctx.set(richContentTooltip.key, {
    view: (view: EditorView) => {
      const onMouseDown = (event: MouseEvent) => event.preventDefault()
      const setLinkOpenModifier = (active: boolean) => {
        view.dom.classList.toggle('is-link-open-modifier', active)
      }
      const onLinkOpenModifierChange = (event: KeyboardEvent) => {
        setLinkOpenModifier(event.ctrlKey || event.metaKey)
      }
      const onEditorPointerMove = (event: PointerEvent) => {
        setLinkOpenModifier(event.ctrlKey || event.metaKey)
      }
      const clearLinkOpenModifier = () => setLinkOpenModifier(false)
      const onEditorLinkClick = (event: MouseEvent) => {
        if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) return
        const target = event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : undefined
        if (!target || !view.dom.contains(target)) return
        const href = target.getAttribute('href')?.trim()
        if (!href) return

        event.preventDefault()
        event.stopPropagation()
        window.open(href, '_blank', 'noopener,noreferrer')
      }
      const onClick = (event: MouseEvent) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '[data-command]',
        )
        if (!button?.dataset.command) return

        event.preventDefault()
        const command = button.dataset.command as Command
        if (command === 'formula') {
          showFormulaChoice(view, button)
          return
        }
        void applyCommand(view, command).then(() => {
          if (command !== 'diagram') view.focus()
        })
      }
      const onSelectionChange = () => syncActiveButtons(view)

      const toolbarHost = document.querySelector<HTMLElement>('#rich-toolbar')
      if (toolbarHost) toolbarHost.append(persistentToolbar)

      for (const toolbar of toolbars) {
        toolbar.addEventListener('mousedown', onMouseDown)
        toolbar.addEventListener('click', onClick)
      }
      view.dom.addEventListener('click', onEditorLinkClick, true)
      view.dom.addEventListener('pointermove', onEditorPointerMove)
      document.addEventListener('selectionchange', onSelectionChange)
      window.addEventListener('keydown', onLinkOpenModifierChange)
      window.addEventListener('keyup', onLinkOpenModifierChange)
      window.addEventListener('blur', clearLinkOpenModifier)
      syncActiveButtons(view)

      return {
        update: (updatedView, previousState) => {
          provider.update(updatedView, previousState)
          syncActiveButtons(updatedView)
        },
        destroy: () => {
          for (const toolbar of toolbars) {
            toolbar.removeEventListener('mousedown', onMouseDown)
            toolbar.removeEventListener('click', onClick)
          }
          view.dom.removeEventListener('click', onEditorLinkClick, true)
          view.dom.removeEventListener('pointermove', onEditorPointerMove)
          document.removeEventListener('selectionchange', onSelectionChange)
          window.removeEventListener('keydown', onLinkOpenModifierChange)
          window.removeEventListener('keyup', onLinkOpenModifierChange)
          window.removeEventListener('blur', clearLinkOpenModifier)
          clearLinkOpenModifier()
          provider.destroy()
          floatingToolbar.remove()
          persistentToolbar.remove()
        },
      }
    },
  })
}

export const tableContentConfig = (ctx: Ctx) => {
  ctx.set(tableTooltip.key, {
    view: (view: EditorView) => {
      const onMouseDown = (event: MouseEvent) => event.preventDefault()
      let positionFrame = 0

      const elementForNode = (node: Node | null | undefined) =>
        node instanceof Element
          ? node
          : node?.parentNode instanceof Element
            ? node.parentNode
            : undefined

      const positionToolbar = () => {
        positionFrame = 0
        if (!view.editable || !view.hasFocus()) {
          tableToolbar.dataset.show = 'false'
          return
        }

        const browserSelectionElement = elementForNode(
          document.getSelection()?.anchorNode,
        )
        const browserSelectionCell = browserSelectionElement
          ?.closest<HTMLElement>('td, th')
        const domAtSelection = view.domAtPos(view.state.selection.from).node
        const stateSelectionCell = elementForNode(domAtSelection)
          ?.closest<HTMLElement>('td, th')
        const cell = browserSelectionCell && view.dom.contains(browserSelectionCell)
          ? browserSelectionCell
          : stateSelectionCell
        if (!cell || (!isInTable(view.state) && !browserSelectionCell)) {
          tableToolbar.dataset.show = 'false'
          return
        }

        tableToolbar.dataset.show = 'true'
        const cellBounds = cell.getBoundingClientRect()
        const toolbarBounds = tableToolbar.getBoundingClientRect()
        const left = Math.min(
          window.innerWidth - toolbarBounds.width - 8,
          Math.max(8, cellBounds.left + (cellBounds.width - toolbarBounds.width) / 2),
        )
        const spaceAbove = cellBounds.top - toolbarBounds.height - 8
        const top = spaceAbove >= 8 ? spaceAbove : cellBounds.bottom + 8
        tableToolbar.style.left = `${Math.round(left)}px`
        tableToolbar.style.top = `${Math.round(top)}px`
      }

      const schedulePosition = () => {
        if (positionFrame) return
        positionFrame = window.requestAnimationFrame(positionToolbar)
      }

      const onClick = (event: MouseEvent) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '[data-table-command]',
        )
        const command = button?.dataset.tableCommand as TableCommand | undefined
        if (!command) return

        event.preventDefault()
        applyTableCommand(view, command)
        view.focus()
        schedulePosition()
      }

      tableToolbar.dataset.show = 'false'
      tableToolbar.style.position = 'fixed'
      document.body.append(tableToolbar)
      tableToolbar.addEventListener('mousedown', onMouseDown)
      tableToolbar.addEventListener('click', onClick)
      view.dom.addEventListener('pointerup', schedulePosition)
      view.dom.addEventListener('keyup', schedulePosition)
      view.dom.addEventListener('focusin', schedulePosition)
      view.dom.addEventListener('focusout', schedulePosition)
      document.addEventListener('selectionchange', schedulePosition)
      window.addEventListener('resize', schedulePosition)
      window.addEventListener('scroll', schedulePosition, true)
      schedulePosition()

      return {
        update: schedulePosition,
        destroy: () => {
          if (positionFrame) window.cancelAnimationFrame(positionFrame)
          tableToolbar.removeEventListener('mousedown', onMouseDown)
          tableToolbar.removeEventListener('click', onClick)
          view.dom.removeEventListener('pointerup', schedulePosition)
          view.dom.removeEventListener('keyup', schedulePosition)
          view.dom.removeEventListener('focusin', schedulePosition)
          view.dom.removeEventListener('focusout', schedulePosition)
          document.removeEventListener('selectionchange', schedulePosition)
          window.removeEventListener('resize', schedulePosition)
          window.removeEventListener('scroll', schedulePosition, true)
          tableToolbar.remove()
        },
      }
    },
  })
}

// A tooltip factory returns both the context slice and the ProseMirror
// plugin. Registering the pair injects the spec used by richContentConfig.
export const richContentPlugin = [
  taskListItemView,
  richContentTooltip,
  richContentTooltipPlugin,
  tableTooltip,
  tableTooltipPlugin,
]

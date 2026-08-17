import type { Ctx } from '@milkdown/kit/ctx'
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
  isInTable,
  selectedRect,
} from '@milkdown/kit/prose/tables'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { TooltipProvider, tooltipFactory } from '@milkdown/plugin-tooltip'
import { mathInlineSchema } from './latex-plugin'

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
  | 'ordered_list'
  | 'blockquote'
  | 'table'
  | 'code_block'
  | 'formula'
  | 'diagram'

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
  const cancel = document.querySelector<HTMLButtonElement>('#source-dialog-cancel')
  const submit = document.querySelector<HTMLButtonElement>('#source-dialog-submit')

  if (!dialog || !title || !label || !input || !cancel || !submit) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    let settled = false

    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      dialog.hidden = true
      cancel.removeEventListener('click', onCancel)
      submit.removeEventListener('click', onSubmit)
      dialog.removeEventListener('pointerdown', onBackdropPointerDown)
      input.removeEventListener('keydown', onKeyDown)
      if (activeTextDialog === finish) activeTextDialog = undefined
      resolve(value)
    }

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
    submit.textContent = options.submitLabel ?? 'Apply'
    dialog.hidden = false
    cancel.addEventListener('click', onCancel)
    submit.addEventListener('click', onSubmit)
    dialog.addEventListener('pointerdown', onBackdropPointerDown)
    input.addEventListener('keydown', onKeyDown)
    input.focus()
    input.select()
  })
}

const commands: Array<[label: string, title: string, command: Command]> = [
  ['↶', 'Undo', 'undo'],
  ['↷', 'Redo', 'redo'],
  ['B', 'Bold', 'strong'],
  ['I', 'Italic', 'emphasis'],
  ['S', 'Strikethrough', 'strike_through'],
  ['</>', 'Inline code', 'inlineCode'],
  ['H1', 'Heading 1', 'heading1'],
  ['H2', 'Heading 2', 'heading2'],
  ['•', 'Bullet list', 'bullet_list'],
  ['1.', 'Numbered list', 'ordered_list'],
  ['❝', 'Blockquote', 'blockquote'],
  ['▦', 'Insert table', 'table'],
  ['Code', 'Code block', 'code_block'],
  ['↗', 'Add link', 'link'],
  ['∑', 'Insert LaTeX formula', 'formula'],
  ['◇', 'Insert Mermaid diagram', 'diagram'],
]

const createButton = (label: string, title: string, command: string) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rich-content-button'
  button.dataset.command = command
  button.title = title
  button.setAttribute('aria-label', title)
  button.textContent = label
  return button
}

const createToolbar = (className: string) => {
  const element = document.createElement('div')
  element.className = className
  element.setAttribute('aria-label', 'Formatting toolbar')
  for (const [label, title, command] of commands) {
    element.append(createButton(label, title, command))
  }
  return element
}

const floatingToolbar = createToolbar('rich-content-toolbar')
const persistentToolbar = createToolbar(
  'rich-content-toolbar rich-content-toolbar--persistent',
)
const toolbars = [floatingToolbar, persistentToolbar]

const createTableButton = (
  label: string,
  title: string,
  command: TableCommand,
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'rich-content-button table-content-button'
  button.dataset.tableCommand = command
  button.title = title
  button.setAttribute('aria-label', title)
  button.textContent = label
  return button
}

const tableToolbar = document.createElement('div')
tableToolbar.className = 'rich-content-toolbar table-content-toolbar'
tableToolbar.setAttribute('aria-label', 'Table toolbar')
tableToolbar.append(
  createTableButton('↑ Row', 'Insert row before', 'add-row-before'),
  createTableButton('↓ Row', 'Insert row after', 'add-row-after'),
  createTableButton('- Row', 'Delete row', 'delete-row'),
  createTableButton('← Col', 'Insert column before', 'add-column-before'),
  createTableButton('→ Col', 'Insert column after', 'add-column-after'),
  createTableButton('- Col', 'Delete column', 'delete-column'),
)

const provider = new TooltipProvider({
  content: floatingToolbar,
  offset: 10,
  shouldShow: (view) => {
    const { selection } = view.state
    return !selection.empty && view.hasFocus() && view.editable
  },
})

const tableProvider = new TooltipProvider({
  content: tableToolbar,
  offset: 10,
  shouldShow: (view) =>
    view.hasFocus() && view.editable && isInTable(view.state),
})

const applyMark = (view: EditorView, markName: string) => {
  const mark = view.state.schema.marks[markName]
  if (!mark) return false
  return toggleMark(mark)(view.state, view.dispatch)
}

const applyLink = async (view: EditorView) => {
  const mark = view.state.schema.marks.link
  if (!mark) return false

  const href = await requestText({
    title: 'Add link',
    label: 'Link URL',
    value: 'https://',
    submitLabel: 'Add link',
    multiline: false,
  })
  if (!href) return false

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

const applyDiagram = (view: EditorView) => {
  const codeBlock = view.state.schema.nodes.code_block
  if (!codeBlock) return false

  try {
    const node = codeBlock.create({ language: 'mermaid' })
    const { $from } = view.state.selection
    const insertPosition =
      $from.depth > 0 ? $from.after(1) : view.state.doc.content.size
    const transaction = view.state.tr.insert(insertPosition, node)
    if (!transaction.docChanged) return false
    view.dispatch(transaction)
    return true
  } catch (error) {
    console.error('Could not insert Mermaid diagram.', error)
    return false
  }
}

const applyCommand = async (view: EditorView, command: Command) => {
  if (command === 'undo') return undo(view.state, view.dispatch)
  if (command === 'redo') return redo(view.state, view.dispatch)
  if (command === 'blockquote') return applyBlockquote(view)
  if (command === 'link') return applyLink(view)
  if (command === 'formula') return applyFormula(view)
  if (command === 'table') return applyTable(view)
  if (command === 'diagram') return applyDiagram(view)
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
      document.addEventListener('selectionchange', onSelectionChange)
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
          document.removeEventListener('selectionchange', onSelectionChange)
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
      const onClick = (event: MouseEvent) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
          '[data-table-command]',
        )
        const command = button?.dataset.tableCommand as TableCommand | undefined
        if (!command) return

        event.preventDefault()
        applyTableCommand(view, command)
        view.focus()
      }

      tableToolbar.addEventListener('mousedown', onMouseDown)
      tableToolbar.addEventListener('click', onClick)
      tableProvider.update(view)

      return {
        update: (updatedView, previousState) => {
          tableProvider.update(updatedView, previousState)
        },
        destroy: () => {
          tableToolbar.removeEventListener('mousedown', onMouseDown)
          tableToolbar.removeEventListener('click', onClick)
          tableProvider.destroy()
          tableToolbar.remove()
        },
      }
    },
  })
}

// A tooltip factory returns both the context slice and the ProseMirror
// plugin. Registering the pair injects the spec used by richContentConfig.
export const richContentPlugin = [
  richContentTooltip,
  richContentTooltipPlugin,
  tableTooltip,
  tableTooltipPlugin,
]

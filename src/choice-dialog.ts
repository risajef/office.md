export type ChoiceOption = {
  value: string
  label: string
  detail?: string
}

type ChoiceDialogOptions = {
  title: string
  label: string
  choices: ChoiceOption[]
}

/** Show a small, keyboard-accessible app dialog for choosing one workspace item. */
export const requestChoice = (
  options: ChoiceDialogOptions,
): Promise<string | undefined> => new Promise((resolve) => {
  const dialog = document.createElement('dialog')
  dialog.className = 'choice-dialog'

  const heading = document.createElement('h2')
  heading.textContent = options.title
  const description = document.createElement('p')
  description.className = 'choice-dialog-label'
  description.textContent = options.label
  const list = document.createElement('div')
  list.className = 'choice-dialog-list'
  list.setAttribute('role', 'listbox')
  list.setAttribute('aria-label', options.label)
  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'dialog-secondary choice-dialog-cancel'
  cancel.textContent = 'Cancel'

  dialog.append(heading, description, list, cancel)
  document.body.append(dialog)

  let settled = false
  const finish = (value?: string) => {
    if (settled) return
    settled = true
    dialog.close()
    dialog.remove()
    resolve(value)
  }

  for (const choice of options.choices) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'choice-dialog-option'
    button.setAttribute('role', 'option')
    const label = document.createElement('strong')
    label.textContent = choice.label
    button.append(label)
    if (choice.detail) {
      const detail = document.createElement('span')
      detail.textContent = choice.detail
      button.append(detail)
    }
    button.addEventListener('click', () => finish(choice.value))
    list.append(button)
  }

  cancel.addEventListener('click', () => finish())
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    finish()
  })
  dialog.addEventListener('close', () => finish())
  dialog.showModal()
  list.querySelector<HTMLButtonElement>('button')?.focus()
})

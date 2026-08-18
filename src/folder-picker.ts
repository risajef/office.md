import {
  browseLocalServerDirectory,
  type LocalServerDirectory,
} from './local-server-file-system'
import { setIcon, type IconName } from './icons'

const createButton = (
  label: string,
  className: string,
  ariaLabel?: string,
  icon?: IconName,
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  if (icon) setIcon(button, icon)
  else button.textContent = label
  if (ariaLabel) button.setAttribute('aria-label', ariaLabel)
  return button
}

export const pickLocalServerFolder = (
  initialPath: string,
): Promise<string | undefined> => new Promise((resolve) => {
  const dialog = document.createElement('dialog')
  dialog.className = 'folder-picker-dialog'
  dialog.setAttribute('aria-labelledby', 'folder-picker-title')

  const header = document.createElement('div')
  header.className = 'folder-picker-header'
  const heading = document.createElement('h2')
  heading.id = 'folder-picker-title'
  heading.textContent = 'Open folder'
  const closeButton = createButton('', 'folder-picker-close', 'Cancel', 'close')
  header.append(heading, closeButton)

  const location = document.createElement('form')
  location.className = 'folder-picker-location'
  const upButton = createButton('', 'folder-picker-up', 'Parent folder', 'up')
  const pathInput = document.createElement('input')
  pathInput.type = 'text'
  pathInput.value = initialPath
  pathInput.spellcheck = false
  pathInput.setAttribute('aria-label', 'Folder path')
  const goButton = createButton('', 'folder-picker-go', 'Go to path', 'arrow-right')
  goButton.type = 'submit'
  location.append(upButton, pathInput, goButton)

  const list = document.createElement('div')
  list.className = 'folder-picker-list'
  list.setAttribute('role', 'list')
  list.setAttribute('aria-label', 'Folders')

  const message = document.createElement('p')
  message.className = 'folder-picker-message'
  message.setAttribute('aria-live', 'polite')

  const footer = document.createElement('div')
  footer.className = 'folder-picker-footer'
  const cancelButton = createButton('Cancel', 'dialog-secondary')
  const openButton = createButton('Open this folder', 'dialog-primary')
  openButton.disabled = true
  footer.append(message, cancelButton, openButton)

  dialog.append(header, location, list, footer)
  document.body.append(dialog)

  let current: LocalServerDirectory | undefined
  let requestNumber = 0
  let settled = false

  const finish = (path?: string) => {
    if (settled) return
    settled = true
    dialog.close()
    dialog.remove()
    resolve(path)
  }

  const render = (directory: LocalServerDirectory) => {
    current = directory
    pathInput.value = directory.path
    upButton.disabled = !directory.parent
    openButton.disabled = false
    list.replaceChildren()

    if (!directory.directories.length) {
      const empty = document.createElement('p')
      empty.className = 'folder-picker-empty'
      empty.textContent = 'No subfolders'
      list.append(empty)
    } else {
      for (const child of directory.directories) {
        const button = createButton('', 'folder-picker-entry')
        button.setAttribute('role', 'listitem')
        const icon = document.createElement('span')
        icon.className = 'folder-picker-entry-icon'
        setIcon(icon, 'folder')
        icon.setAttribute('aria-hidden', 'true')
        const name = document.createElement('span')
        name.textContent = child.name
        button.append(icon, name)
        button.addEventListener('click', () => void load(child.path))
        list.append(button)
      }
    }
    message.textContent = `${directory.directories.length} subfolder${directory.directories.length === 1 ? '' : 's'}`
  }

  const load = async (path: string) => {
    const request = ++requestNumber
    list.setAttribute('aria-busy', 'true')
    pathInput.disabled = true
    goButton.disabled = true
    upButton.disabled = true
    openButton.disabled = true
    message.textContent = 'Loading…'
    try {
      const directory = await browseLocalServerDirectory(path)
      if (request !== requestNumber || settled) return
      render(directory)
    } catch (error) {
      if (request !== requestNumber || settled) return
      message.textContent = error instanceof Error
        ? error.message
        : 'Could not open this folder.'
      pathInput.disabled = false
      goButton.disabled = false
      upButton.disabled = !current?.parent
      openButton.disabled = !current
      pathInput.focus()
      pathInput.select()
    } finally {
      if (request === requestNumber) {
        list.removeAttribute('aria-busy')
        pathInput.disabled = false
        goButton.disabled = false
      }
    }
  }

  closeButton.addEventListener('click', () => finish())
  cancelButton.addEventListener('click', () => finish())
  openButton.addEventListener('click', () => finish(current?.path))
  upButton.addEventListener('click', () => {
    if (current?.parent) void load(current.parent)
  })
  location.addEventListener('submit', (event) => {
    event.preventDefault()
    if (pathInput.value.trim()) void load(pathInput.value)
  })
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault()
    finish()
  })
  dialog.addEventListener('close', () => finish())

  dialog.showModal()
  void load(initialPath)
})

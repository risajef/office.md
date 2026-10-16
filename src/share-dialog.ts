const dialog = () => {
  const element = document.querySelector<HTMLDialogElement>('#share-dialog')
  if (!element) throw new Error('The share dialog is unavailable.')
  return element
}

const element = <Name extends keyof HTMLElementTagNameMap>(
  tag: Name,
  className?: string,
  content?: string,
) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (content !== undefined) node.textContent = content
  return node
}

const prepare = (title: string, description: string) => {
  const modal = dialog()
  modal.replaceChildren()
  const form = element('form', 'share-dialog-card')
  form.addEventListener('submit', (event) => event.preventDefault())
  const heading = element('h2', undefined, title)
  heading.id = 'share-dialog-title'
  form.setAttribute('aria-labelledby', heading.id)
  const copy = element('p', 'share-dialog-copy', description)
  form.append(heading, copy)
  modal.append(form)
  return { modal, form }
}

const show = <Result>(
  modal: HTMLDialogElement,
  form: HTMLFormElement,
  configure: (finish: (value: Result) => void) => void,
) => new Promise<Result>((resolve) => {
  let finished = false
  const finish = (value: Result) => {
    if (finished) return
    finished = true
    modal.removeEventListener('cancel', cancel)
    modal.close()
    modal.replaceChildren()
    resolve(value)
  }
  const cancel = (event: Event) => {
    event.preventDefault()
    finish(undefined as Result)
  }
  modal.addEventListener('cancel', cancel)
  modal.showModal()
  configure(finish)
})

export const requestShareOptions = (input: {
  title: string
  description: string
  files?: string[]
  includeArchiveManifest?: boolean
  passwordLabel?: string
  passwordAvailable?: boolean
  passwordUnavailableMessage?: string
}) => {
  const { modal, form } = prepare(input.title, input.description)
  if (input.files) {
    const list = element('ul', 'share-file-list')
    list.setAttribute('aria-label', 'Files to be shared')
    for (const file of input.files) list.append(element('li', undefined, file))
    form.append(list)
  }
  if (input.includeArchiveManifest) {
    form.append(element(
      'p',
      'share-dialog-note',
      'Electron ZIPs also contain the hidden .office-md-share.json manifest.',
    ))
  }

  const passwordToggle = element('input')
  passwordToggle.type = 'checkbox'
  passwordToggle.id = 'share-password-toggle'
  passwordToggle.disabled = input.passwordAvailable === false
  const passwordLabel = element('label', 'share-password-toggle-label')
  passwordLabel.htmlFor = passwordToggle.id
  passwordLabel.append(passwordToggle, document.createTextNode(input.passwordLabel ?? 'Protect with a password'))
  form.append(passwordLabel)
  if (input.passwordAvailable === false) {
    form.append(element(
      'p',
      'share-dialog-note',
      input.passwordUnavailableMessage ?? 'Password protection is unavailable in this browser context.',
    ))
  }

  const passwordGroup = element('div', 'share-password-group')
  passwordGroup.hidden = true
  const passwordInput = element('input')
  passwordInput.id = 'share-password'
  passwordInput.type = 'password'
  passwordInput.autocomplete = 'new-password'
  passwordInput.required = false
  const passwordInputLabel = element('label', undefined, 'Password')
  passwordInputLabel.htmlFor = passwordInput.id
  const confirmationInput = element('input')
  confirmationInput.id = 'share-password-confirm'
  confirmationInput.type = 'password'
  confirmationInput.autocomplete = 'new-password'
  confirmationInput.required = false
  const confirmationLabel = element('label', undefined, 'Confirm password')
  confirmationLabel.htmlFor = confirmationInput.id
  const passwordHelp = element(
    'p',
    'share-dialog-note',
    'Share the password separately. It is never placed in the link.',
  )
  passwordGroup.append(
    passwordInputLabel,
    passwordInput,
    confirmationLabel,
    confirmationInput,
    passwordHelp,
  )
  form.append(passwordGroup)

  const error = element('p', 'share-dialog-error')
  error.setAttribute('role', 'status')
  form.append(error)
  passwordToggle.addEventListener('change', () => {
    passwordGroup.hidden = !passwordToggle.checked
    passwordInput.required = passwordToggle.checked
    confirmationInput.required = passwordToggle.checked
    if (passwordToggle.checked) passwordInput.focus()
  })
  passwordInput.addEventListener('input', () => { error.textContent = '' })
  confirmationInput.addEventListener('input', () => { error.textContent = '' })

  const actions = element('div', 'share-dialog-actions')
  const cancel = element('button', 'dialog-secondary', 'Cancel')
  cancel.id = 'share-cancel'
  cancel.type = 'button'
  const confirm = element('button', 'dialog-primary', 'Create share')
  confirm.id = 'share-confirm'
  confirm.type = 'submit'
  actions.append(cancel, confirm)
  form.append(actions)

  return show<{ password?: string } | undefined>(modal, form, (finish) => {
    cancel.addEventListener('click', () => finish(undefined))
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (passwordToggle.checked && !passwordInput.value) {
        error.textContent = 'Enter a password to protect this share.'
        passwordInput.focus()
        return
      }
      if (passwordToggle.checked && passwordInput.value !== confirmationInput.value) {
        error.textContent = 'The passwords do not match.'
        confirmationInput.focus()
        return
      }
      finish({ password: passwordToggle.checked ? passwordInput.value : undefined })
    })
  })
}

export const requestSharePassword = (title = 'Open password-protected share') => {
  const { modal, form } = prepare(title, 'Enter the password supplied by the sender.')
  const passwordInput = element('input')
  passwordInput.id = 'share-password'
  passwordInput.type = 'password'
  passwordInput.autocomplete = 'current-password'
  passwordInput.required = true
  const label = element('label', undefined, 'Password')
  label.htmlFor = passwordInput.id
  form.append(label, passwordInput)
  const error = element('p', 'share-dialog-error')
  error.setAttribute('role', 'status')
  form.append(error)
  const actions = element('div', 'share-dialog-actions')
  const cancel = element('button', 'dialog-secondary', 'Cancel')
  cancel.id = 'share-cancel'
  cancel.type = 'button'
  const confirm = element('button', 'dialog-primary', 'Unlock share')
  confirm.id = 'share-confirm'
  confirm.type = 'submit'
  actions.append(cancel, confirm)
  form.append(actions)
  return show<string | undefined>(modal, form, (finish) => {
    cancel.addEventListener('click', () => finish(undefined))
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (!passwordInput.value) {
        error.textContent = 'Enter a password to open this share.'
        passwordInput.focus()
        return
      }
      finish(passwordInput.value)
    })
  })
}

export const confirmLongShareUrl = (length: number) => {
  const { modal, form } = prepare(
    'This share link is long',
    `The complete URL is ${length.toLocaleString()} characters. Some destinations may truncate or reject long URLs. Continue anyway?`,
  )
  const actions = element('div', 'share-dialog-actions')
  const cancel = element('button', 'dialog-secondary', 'Cancel share')
  cancel.id = 'share-cancel'
  cancel.type = 'button'
  const confirm = element('button', 'dialog-primary', 'Continue')
  confirm.id = 'share-confirm'
  confirm.type = 'submit'
  actions.append(cancel, confirm)
  form.append(actions)
  return show<boolean | undefined>(modal, form, (finish) => {
    cancel.addEventListener('click', () => finish(false))
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      finish(true)
    })
  })
}

export const showShareLink = (url: string) => {
  const { modal, form } = prepare('Share link created', 'Copy this link and send it to the recipient.')
  const input = element('input')
  input.id = 'share-link-value'
  input.type = 'url'
  input.readOnly = true
  input.value = url
  input.addEventListener('focus', () => input.select())
  form.append(input)
  const status = element('p', 'share-dialog-note')
  status.id = 'share-link-status'
  form.append(status)
  const actions = element('div', 'share-dialog-actions')
  const close = element('button', 'dialog-secondary', 'Close')
  close.id = 'share-cancel'
  close.type = 'button'
  const copy = element('button', 'dialog-primary', 'Copy link')
  copy.id = 'share-copy-link'
  copy.type = 'button'
  actions.append(close, copy)
  form.append(actions)
  return show<void>(modal, form, (finish) => {
    close.addEventListener('click', () => finish(undefined))
    copy.addEventListener('click', () => {
      const write = navigator.clipboard?.writeText(url)
      if (!write) {
        input.focus()
        input.select()
        status.textContent = 'Clipboard access is unavailable. The link is selected for copying.'
        return
      }
      void write.then(() => {
        status.textContent = 'Link copied.'
      }).catch(() => {
        input.focus()
        input.select()
        status.textContent = 'Clipboard access is unavailable. The link is selected for copying.'
      })
    })
  })
}

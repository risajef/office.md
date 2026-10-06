export const OFFICE_MD_REPOSITORY_URL = 'https://github.com/risajef/office.md'

export type InfoDialogOptions = {
  type: 'info'
  title: string
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
}

export const createInfoAction = (dependencies: {
  version: string
  showMessageBox: (options: InfoDialogOptions) => Promise<{ response: number }>
  openExternal: (url: string) => Promise<void>
}) => async () => {
  const result = await dependencies.showMessageBox({
    type: 'info',
    title: 'About office.md',
    message: `office.md ${dependencies.version}`,
    detail: `Installed version: ${dependencies.version}\n\n${OFFICE_MD_REPOSITORY_URL}`,
    buttons: ['Open GitHub', 'Close'],
    defaultId: 0,
    cancelId: 1,
  })
  if (result.response === 0) {
    await dependencies.openExternal(OFFICE_MD_REPOSITORY_URL)
  }
}

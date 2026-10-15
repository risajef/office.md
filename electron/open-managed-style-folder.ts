export type StyleFolderShell = {
  openPath: (path: string) => Promise<string>
}

export const createOpenManagedStyleFolderHandler = (
  shell: StyleFolderShell,
  getManagedPath: () => string,
) => async () => {
  const managedPath = getManagedPath()
  const error = await shell.openPath(managedPath)
  if (error) throw new Error(error)
}

import type { MenuItemConstructorOptions } from 'electron'

export const createHelpMenuTemplate = (actions: {
  onInfo: () => void
  onUpdate: () => void
}): MenuItemConstructorOptions[] => [{
  label: 'Help',
  submenu: [
    {
      label: 'Info',
      id: 'office-md-help-info',
      click: actions.onInfo,
    },
    {
      label: 'Update...',
      id: 'office-md-help-update',
      click: actions.onUpdate,
    },
  ],
}]

## Why

The CSS themes shipped with office.md are not available as a persistent style library after a user opens a document workspace. Electron also starts without a default style folder and requires a separate folder selection, so users cannot easily customize the themes that ship with the app.

## What Changes

- Include the developed CSS themes in production builds and keep them available in the Styles section regardless of the opened document workspace.
- In Electron, initialize and select a writable app-managed styles folder from the shipped themes, preserve user edits and added CSS files across launches and updates, and provide an action to open the folder in the system file manager.
- Remove style-folder selection from the Styles section. In the hosted web build, show the bundled themes as read-only choices because the browser cannot open or edit the deployed server folder.
- Refresh Electron's available themes when office.md regains focus, applying edits to the active style and discovering newly added CSS files.

### Non-goals

- Editing CSS inside office.md.
- Opening or writing to a server-side styles directory from the hosted web build.
- Changing document-workspace CSS behavior or automatically applying a particular theme.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `style-folders`: Replace user-selected style-folder behavior with a deployed style library, including the editable Electron folder and read-only hosted-web themes.
- `markdown`: Apply themes from the app-provided library while keeping document CSS scoped.
- `export`: Include active themes from the app-provided library in HTML and print output.

## Impact

- Production CSS asset inclusion and global theme discovery in `src/main.ts`.
- Electron style-folder initialization, folder reveal bridge, and packaged resources in `electron/`, `src/electron-style-folder-port.ts`, and the build/package scripts.
- Styles-section controls, export behavior, and focus refresh behavior.
- Unit and end-to-end coverage for production themes, folder initialization, customization preservation, and focus refresh.

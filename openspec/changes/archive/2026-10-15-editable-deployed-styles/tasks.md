## 1. Production style library

- [x] 1.1 Add failing Playwright coverage that opens a real workspace and confirms the developed styles remain in the Styles section, the hosted web build has no style-folder chooser, and workspace CSS themes remain available; verify the scenarios fail before implementation.
- [x] 1.2 Make the bundled developed styles a global theme source independent of the fallback example workspace, remove the web style-folder chooser, and verify the focused Playwright coverage passes.

## 2. Electron app-managed styles folder

- [x] 2.1 Add failing public service tests for creating and seeding a styles folder, preserving existing and user-added CSS files, and adding missing shipped CSS files without overwriting; verify they fail before implementation.
- [x] 2.2 Package the developed CSS templates and initialize the Electron app-managed folder under user data as the automatically selected library; verify the focused service and startup tests pass.
- [x] 2.3 Add a secure Electron bridge action that opens the managed folder in the system file manager, replace the chooser with the Electron-only open-folder action, and verify the action reaches the managed path without accepting a renderer-supplied path.
- [x] 2.4 Add failing Electron end-to-end coverage for the default themes, the open-folder action, and persistence of edited and added CSS across launches; verify the scenarios fail before implementation, then pass after implementation.

## 3. Refresh themes after external edits

- [x] 3.1 Add failing coverage for adding, modifying, and removing CSS while Electron is unfocused, then verify that regaining focus refreshes the theme choices and active style; also cover a transient refresh failure retaining cached styles.
- [x] 3.2 Refresh the Electron styles folder on window focus, reapply a changed active theme, remove unavailable themes, and retain cached state after refresh failures; verify the focused unit and end-to-end coverage passes.

## 4. Final verification

- [x] 4.1 Run `npm test`, `npm run build`, `npm run build:electron`, `npm run test:e2e`, and `npm run spec:validate`; confirm all required checks pass and no generated build or test output is committed.

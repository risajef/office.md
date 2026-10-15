## Context

See `proposal.md` for the motivation and `specs/style-folders/spec.md` for the behavior contract. The renderer currently imports the example CSS as raw modules and places them in its example workspace; opening a real workspace replaces that list. Electron's current style-folder service reads a user-selected directory and stores its path, while the package does not contain a separate writable style directory.

## Goals / Non-Goals

**Goals:**

- Make the existing developed themes a global style source in production web and Electron builds.
- Give Electron a stable, writable style directory with defaults that survive app updates without overwriting user files.
- Keep the deployed web experience read-only and avoid asking browser users for a folder.
- Reuse the existing style-folder scan and theme application behavior for Electron edits.

**Non-Goals:**

- Add an in-app CSS editor or browser-side writes to a user's local directory.
- Monitor style files continuously while Electron is focused.
- Import or modify a previously selected external style directory during upgrade.

## Decisions

### Keep the developed CSS as the source for both builds

Continue to derive bundled themes from the existing CSS files under `examples/styles`. The renderer will make these files available as a global theme source instead of relying on their presence in the fallback example workspace. The web build uses these bundled CSS contents directly as read-only themes.

For Electron packaging, the build will also copy the CSS files into a packaged template directory. On startup the Electron host will create `<userData>/styles` and copy each shipped CSS file only when its destination is missing. This keeps the installed resources immutable while providing a user-editable location. Copying only missing files preserves edits and user-added CSS, and makes newly shipped styles available after app updates. The app-managed directory remains the selected style source; it does not restore the old user-selected path.

Keeping defaults in the app package and copying them to user data was chosen over reading themes directly from the installed package, because packaged resources may be read-only. A one-time copy was rejected because it would not make later shipped styles available to existing users.

### Keep theme sources separate from workspaces

The renderer will keep workspace CSS choices and the global library as distinct theme sources. When Electron has a readable managed folder, its scanned files supply the global choices; if that folder cannot be opened, the bundled modules supply read-only fallback choices. Hosted web always uses the bundled modules. Theme identity remains source-qualified so a workspace file and a library file with the same relative name do not collide.

The Styles section will no longer expose a folder chooser. It will show an **Open styles folder** action only in Electron. That action will call a narrow preload API which opens the known app-managed path in the system file manager; the renderer will not pass an arbitrary path to the shell.

Bundled and managed-library themes use the same document-scoped theme application and export pipeline as workspace CSS. This keeps HTML and print exports self-contained and independent of the filesystem path.

### Refresh the managed folder on Electron focus

The renderer will request a style-folder reload when the Electron window receives focus. A successful scan replaces the displayed library choices and reapplies the active library CSS so edits appear immediately. A transient scan failure leaves the last successful snapshot and active style in place; a later focus event retries.

Continuous polling was rejected because edits happen through the file manager and are naturally followed by returning to the app. This also keeps style-folder refresh separate from workspace polling and avoids repeated filesystem scans while the app is in use.

### Leave legacy selected folders untouched

The Electron app will stop restoring the saved external folder path. It will neither move nor copy files from that location. Users who want to keep custom themes from the previous behavior can copy them into the new app-managed folder through the file manager. This avoids silently mutating an arbitrary user directory while honoring the new default-folder behavior.

## Risks / Trade-offs

- **[User data directory cannot be created or read]** → Keep the editor available, show an actionable status, and provide bundled read-only themes as fallback.
- **[A user edits CSS into invalid syntax]** → Keep current CSS parsing and scoping behavior; report or recover through the existing theme application error path without losing the source file.
- **[A shipped file has the same path as a user-added file]** → Never overwrite existing destinations when initializing or updating the managed directory.
- **[A user expects a previously selected external folder to remain active]** → Leave it untouched and make the new managed location easy to open so files can be copied manually.
- **[Hosted browser users expect to edit deployed assets]** → Show the shipped themes as read-only and keep the Electron file-manager action out of the hosted web UI.

## Migration Plan

1. Package a template copy of the developed CSS files and make them globally available in the production renderer.
2. On Electron startup, seed missing templates into the app-managed user-data folder and restore that folder as the style source.
3. Add the Electron folder-reveal bridge and focus-triggered style refresh.
4. Remove the style-folder selection control and verify that workspace CSS themes still work.
5. Existing user-selected style paths are ignored by the new version but left unchanged on disk. If rollback is needed, the previous app can continue using the legacy preference and directory.

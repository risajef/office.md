## Why

Electron currently checks for updates during startup and displays a persistent notification in the editor. Users should be able to find the installed version and choose when to check for updates from the desktop application menu.

## What Changes

- Remove the automatic startup update check and persistent in-editor update notification.
- Add **Info** and **Update...** actions to Electron's **Help** menu.
- Show the installed app version and an action to open the office.md GitHub repository from **Info**.
- On **Update...**, show a version picker for published stable releases compatible with the installed platform. Include compatible versions both newer and older than the installed version, then ask before downloading and installing the selected version; declining leaves the running app unchanged.
- Report when no other compatible version is available or when release lookup fails.

Non-goals: automatic or scheduled update checks, changes to release packaging or update metadata, and update controls in the browser runtime.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `release-distribution`: specify Electron Help menu information and user-initiated update behavior.
- `electron-updates`: replace automatic latest-version checks and persistent update status with manual, version-specific update selection.

## Impact

Electron main-process menu and dialog handling, GitHub release discovery and selected-version updating, and removal of the renderer's update notification UI. The behavior will be covered by updater/menu tests and Electron end-to-end coverage. No new dependency is expected.

## Why

Users who install the Electron app currently have to discover and download every new release manually. The app should notice when a newer compatible GitHub Release exists and guide the user through updating so fixes and improvements reach installed copies without risking silent data loss or surprise restarts.

## What Changes

- Add a production-only Electron update checker that uses the GitHub Releases produced by `electron-release-pipeline` as its update source.
- Check for a newer stable release when the packaged app starts and expose a user-invoked “Check for updates” action.
- Show update status, the available version, download progress, errors, and the option to retry or postpone.
- Download an update only after user confirmation and install it through a controlled restart/quit flow after the update is ready.
- Keep the current application usable when no update exists or the network/update service is unavailable; workspace files remain untouched.
- Extend the release packaging path with the updater metadata required for Linux AppImage and Windows NSIS updates.
- Disable network update checks for development, unpackaged, and automated test runs.

### Non-goals

- Silent downloads, forced restarts, or automatic installation without user confirmation.
- macOS, ARM, prerelease-channel, or third-party update-provider support.
- Workspace migration, cloud synchronization, or changes to Markdown, CSV, export, or IPC workspace semantics.
- Code signing, notarization, or a replacement for the GitHub release pipeline; those remain separate concerns and limitations of the initial distribution.

## Capabilities

### New Capabilities

- `electron-updates`: Detect, present, download, and install newer stable Electron releases through a user-controlled update flow.

### Modified Capabilities

None. This adds an Electron lifecycle capability and its release metadata dependency without changing existing editor or workspace requirements.

## Impact

- Adds an Electron-main update service and a narrow preload/renderer bridge for update state and commands.
- Adds update status UI and user-confirmed download/restart interactions to the desktop experience.
- Adds the updater dependency and configuration for the GitHub repository/provider, plus generated Linux/Windows update metadata in the release workflow from `electron-release-pipeline`.
- Requires deterministic update state tests, Electron/packaged-app smoke coverage, and failure-path coverage for unavailable networks and invalid/mismatched releases.
- Must be implemented after or together with `electron-release-pipeline`, because updater discovery depends on its published package metadata and platform assets.

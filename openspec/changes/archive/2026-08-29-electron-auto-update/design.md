## Context

See `proposal.md` for the motivation and user-visible scope. The Electron shell currently owns window creation and allowlisted workspace IPC in `electron/main.ts`; `electron/preload.ts` exposes only the workspace API, while the shared renderer selects the Electron workspace adapter. The planned `electron-release-pipeline` produces x64 Linux AppImage and Windows NSIS packages from published GitHub Releases, but currently has no update metadata or client-side update flow.

The updater must remain outside the shared workspace capability. It must not block the editor from opening, write to workspace files, or make development and test runs depend on the network.

## Goals / Non-Goals

**Goals:**

- Provide a deterministic update state machine for packaged stable Electron builds on Linux x64 and Windows x64.
- Keep update-provider access and installation authority in the Electron main process.
- Expose only typed update status and explicit commands through the existing secure preload boundary.
- Make update metadata and package assets from GitHub Releases usable by the client.
- Preserve the current application and workspace when checks, downloads, or installs fail.

**Non-Goals:**

- Updating the browser target or adding a general-purpose runtime update abstraction.
- Silent downloads, forced restarts, prerelease channels, private repositories, or another update provider.
- Code signing, notarization, macOS, ARM, or a new persistence layer.

## Decisions

### Use electron-updater in the Electron main process

Add `electron-updater` to the Electron main-process dependencies and configure the same public GitHub repository used by the release pipeline. Use the packager's GitHub publish configuration so it generates the standard platform update metadata (`latest.yml` for Windows and `latest-linux.yml` for Linux) and the packaged application receives its update configuration. The client should use the configured provider rather than constructing arbitrary release URLs or calling `setFeedURL` from the renderer.

`electron-updater` is preferred over a custom GitHub API/download implementation because it already handles platform-specific installers, release metadata, artifact integrity checks, and installation handoff. A custom downloader would duplicate those security-sensitive details and could bypass the NSIS/AppImage installation semantics.

### Keep updater state behind a narrow typed bridge

Create a main-process update service that owns the updater instance, translates provider events into a small host-neutral state model, and serializes commands so a second check or download cannot race the current operation. The state model covers `disabled`, `checking`, `up-to-date`, `available`, `downloading` with progress, `downloaded`, and `error` with a retryable action. The service exposes only check, download, and install/restart commands plus state subscription; the updater object and filesystem paths never cross the preload boundary.

Extend the existing `contextBridge` API with update methods and an event subscription. The renderer consumes this API through the Electron bootstrap and renders a non-blocking update notification in the desktop UI. The web runtime receives no updater capability.

### Check only in packaged production sessions

After the production Electron window is ready, start one background check. Also expose a manual check action. Gate both paths on `app.isPackaged` and the existing test/development environment signals so `electron:start`, local dev-server sessions, and automated tests do not contact GitHub. Set automatic download and automatic install-on-quit off; downloading begins only after the user confirms, and installation occurs only after a second explicit restart/quit action.

### Use a stable GitHub Release channel

The client accepts only a newer stable semantic version with a matching supported platform artifact. Draft and prerelease releases are not candidates. The release workflow must upload the package-specific metadata and any referenced integrity files together with the AppImage/NSIS assets, and it must publish the release only after all assets are present because unpublished drafts are not discoverable by the updater.

### Test with an injected updater port

Keep provider/network behavior behind a small test seam so unit tests can drive available, unavailable, downloading, downloaded, invalid, and failed states without making network requests. Test the state transitions and user confirmation rules through that public seam. Add Electron smoke coverage with a deterministic fake or disabled provider, plus package/release checks that confirm the metadata points at the emitted versioned assets.

## Risks / Trade-offs

- **[Unsigned packages may be warned about or restricted by the OS]** → Preserve signing and notarization as an explicit follow-up, document the limitation, and never weaken metadata/integrity validation to make an update install.
- **[GitHub or the network may be unavailable]** → Run checks asynchronously, keep the editor usable, show a retryable error, and retain the current version.
- **[An update can be interrupted during download or restart]** → Keep the existing installation until the updater reports a completed download, allow postponement, and verify the next launch remains possible.
- **[Provider metadata can drift from release assets]** → Generate metadata from the same versioned packaging configuration, upload it in the same release job, and assert matching versions and filenames in CI.
- **[Update IPC could broaden the privileged surface]** → Keep all updater authority in main, expose fixed channels and typed payloads, and do not expose arbitrary URLs, paths, or provider tokens.

## Migration Plan

1. Add the updater state contract and fake seam, then implement main-process event translation with focused unit tests.
2. Extend the preload API and desktop UI with check, download, progress, retry, postpone, and install actions; keep web and non-packaged sessions disabled.
3. Extend the Electron packaging configuration and the `electron-release-pipeline` workflow to generate and publish matching updater metadata and referenced assets.
4. Add packaged/unpacked Electron smoke coverage and a controlled test-release procedure that verifies discovery, download confirmation, and restart installation on both supported platforms.
5. Update README/development documentation and run all unit, build, Electron/browser, package, and OpenSpec checks.

To roll back, disable the production update check and remove the updater UI/bridge; existing installed versions continue to launch and existing workspace files are unaffected. Releases remain downloadable manually through GitHub.

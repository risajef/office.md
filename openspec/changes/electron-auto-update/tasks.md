## 1. Update contract and state machine

- [ ] 1.1 Add red unit tests for the public update capability covering disabled, checking, up-to-date, available, downloading progress, downloaded, retryable error, and interrupted-download states; verify the focused Vitest tests fail before the capability exists.
- [ ] 1.2 Define the typed update status/command contract and deterministic fake provider, including newer-stable-version selection and rejection of older, equal, prerelease, or incompatible releases; verify the focused tests pass without network access.
- [ ] 1.3 Add red tests proving that postponing an available update performs neither download nor installation and that installation is possible only after a completed user-confirmed download; verify they fail before command gating is implemented.
- [ ] 1.4 Implement the command gating and state transitions behind the update capability; verify the focused tests pass for confirmation, postponement, retry, and progress behavior.

## 2. Electron main process and secure bridge

- [ ] 2.1 Add red main-process service tests using the fake provider for startup/manual checks, provider event translation, non-blocking failures, and disabled development/test sessions; verify no network call occurs in disabled sessions and the tests fail before integration exists.
- [ ] 2.2 Add the runtime updater dependency and implement the Electron main-process update service with GitHub provider configuration, packaged-session gating, stable-channel filtering, disabled automatic download, and disabled automatic install-on-quit; verify the focused service tests and `npm run build:electron` pass.
- [ ] 2.3 Add red preload/IPC contract tests that require fixed update channels for status, check, download, and install, and reject arbitrary URLs, paths, or provider tokens; verify they fail before the bridge is extended.
- [ ] 2.4 Extend the typed `contextBridge` API and Electron IPC handlers with update commands and state subscriptions while preserving the existing workspace allowlist; verify the IPC tests, existing workspace tests, and TypeScript/Electron build pass.

## 3. Desktop update experience

- [ ] 3.1 Add red renderer/DOM tests for the update notification and actions: available version with download/postpone, download progress, downloaded/restart, retryable error, and continued editor access; verify the focused UI tests fail before the controls exist.
- [ ] 3.2 Implement the non-blocking desktop update UI and connect it to the typed update capability; verify user confirmation is required for download and installation, progress is rendered, postpone leaves the editor usable, and retry returns to checking.
- [ ] 3.3 Add an Electron smoke scenario with a deterministic provider/test mode for a newer release, confirming the UI flow without contacting GitHub or modifying a test workspace; verify the existing Electron launch and workspace smoke scenarios remain green.

## 4. Release metadata and pipeline integration

- [ ] 4.1 Add a red packaging/configuration test for the public GitHub provider, stable release channel, auto-update metadata generation, and matching Linux/Windows package targets; verify it fails before the updater packaging configuration exists.
- [ ] 4.2 Extend the electron-builder configuration and lockfile with `electron-updater` runtime packaging and provider metadata generation for `latest.yml` and `latest-linux.yml` plus referenced integrity files; verify the configuration test, `npm ci`, and native package builds produce metadata pointing to the exact versioned assets.
- [ ] 4.3 Add a red release-workflow contract test requiring update metadata and integrity files to travel with both platform packages, remain in the staged draft until all assets are present, and be published only after verification; verify it fails before the workflow integration exists.
- [ ] 4.4 Update the `electron-release-pipeline` GitHub Actions workflow and release-asset manifest to collect, verify, upload/replace, and publish the updater metadata with the Linux and Windows packages while retaining tag/version checks and least-privilege permissions; verify the workflow contract test passes and a simulated missing-metadata case cannot publish.
- [ ] 4.5 Add a release metadata fixture test that parses the generated provider files and rejects mismatched versions, missing platform entries, prereleases, or package filenames not present in the same GitHub Release; verify the focused tests pass for valid and invalid fixtures.

## 5. Documentation and final verification

- [ ] 5.1 Update `README.md` and development workflow documentation with the production-only check, manual check action, confirmation/postpone/restart flow, GitHub Release source, offline behavior, and unsigned-package limitation; verify documented behavior and commands match the implementation.
- [ ] 5.2 Run the complete relevant validation after all behavior slices are green: `npm test`, `npm run build`, `npm run build:electron`, `npm run test:e2e`, `npm run spec:validate`, and native package/update smoke checks; verify no generated `dist/`, `release/`, `playwright-report/`, or `test-results/` output is committed.

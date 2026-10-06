## 1. Electron Help information

- [x] 1.1 Add a test through the menu or information presenter seam that verifies Info shows the installed version and repository link, and that activating the link opens the fixed GitHub URL.
- [x] 1.2 Implement the native Electron Help menu and Info action; verify the new information tests pass and the Electron build succeeds.

## 2. User-initiated update flow

- [x] 2.1 Add tests through an injectable release-list/update seam for stable published version filtering, platform compatibility, exact version selection, older-version selection, consent, refusal, and lookup failures; verify a declined choice performs no download or install.
- [x] 2.2 Implement the Help menu Update... modal version picker and version-specific updater flow; verify the selected tag's manifest and installer are used and the update-flow tests pass.

## 3. Remove persistent startup update UI

- [x] 3.1 Add Electron end-to-end coverage that verifies the Help actions are available and startup does not trigger an update check or show a persistent editor notification.
- [x] 3.2 Remove startup update checking, renderer update notification UI, and renderer-facing update IPC; verify Electron end-to-end coverage and production builds pass.

## 4. Final verification

- [x] 4.1 Run `npm test`, `npm run build:electron`, `npm run build`, `npm run test:e2e`, and `npm run spec:validate`; confirm all required checks pass.

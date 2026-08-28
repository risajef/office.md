## 1. Establish the host-neutral boundary

- [x] 1.1 Add red public-interface tests for a host-neutral workspace capability covering open, reload, read, write, rename, create, delete, and the existing unsafe-operation failures; verify the new tests fail because the shared port is not implemented yet.
- [x] 1.2 Define the minimal host-neutral workspace types and capability port, plus a deterministic fake used by application tests; make the tests from 1.1 green and verify the focused unit test file passes.
- [x] 1.3 Refactor the boundary after the tests are green so current filesystem behavior maps to the port without changing Markdown, CSV, or export modules; verify the existing workspace and filesystem unit tests remain green.

## 2. Move web workspace access behind the port

- [x] 2.1 Add red web-adapter contract tests for preferring the local development bridge, falling back to browser folder access, reporting unsupported access, and preserving disk-backed reload/save behavior; verify the tests fail before the adapter is wired.
- [x] 2.2 Implement the smallest web adapter over the existing local-server and browser-folder mechanisms, including host-neutral error and capability mapping; verify the adapter contract tests pass.
- [x] 2.3 Wire the web bootstrap to create the shared application with the web adapter and remove direct host checks from shared actions; verify `npm test` and the existing real-workspace web workflows pass.

## 3. Extract the shared editor runtime

- [x] 3.1 Add red application tests using the fake workspace port for opening/reloading a workspace, saving Markdown, retaining CSV formulas, resolving includes, exporting, and rejecting unsafe mutations; verify the tests fail against the current monolithic bootstrap seam.
- [x] 3.2 Extract application actions and state transitions from `src/main.ts` behind the host-neutral port, implementing only enough behavior to make 3.1 green; verify the focused application tests and existing Markdown/CSV/export tests pass.
- [x] 3.3 Move the editor UI bootstrap to consume the shared application runtime without importing browser, Node, or Electron APIs; verify a web smoke test opens, edits, reloads, and exports a representative workspace.
- [x] 3.4 Refactor shared modules only after the vertical slices are green, keeping the renderer behavior unchanged and documenting the stable bootstrap seam; verify `npm test` and `npm run build` pass.

## 4. Add the Electron host

- [x] 4.1 Add red tests for the Electron host contract: only allowlisted workspace operations are exposed, unsafe paths are rejected, and unknown requests fail without touching disk; verify the tests fail before the preload boundary exists.
- [x] 4.2 Implement the Electron main-process filesystem adapter and secure preload bridge with context isolation, disabled renderer Node integration, and host-neutral results/errors; verify the Electron boundary tests pass against temporary workspaces.
- [x] 4.3 Add the Electron shell and renderer bootstrap so it loads the same shared renderer and supplies the Electron adapter; verify a minimal desktop launch smoke test opens a temporary workspace.
- [x] 4.4 Run the shared adapter contract suite against the Electron adapter and fix only host translation differences; verify Markdown, CSV, include, export, reload, and workspace safety scenarios produce the same results as the web adapter.

## 5. Verify and document the two supported targets

- [x] 5.1 Add cross-host parity fixtures for representative Markdown and CSV workspaces, including a formula, an include, an export, and rejected unsafe mutations; verify the same expected outcomes in web and Electron tests.
- [x] 5.2 Add or extend Playwright coverage for the web target and Electron launch path using real temporary workspaces; verify `npm run test:e2e` passes without committing `dist/`, `playwright-report/`, or `test-results/`.
- [x] 5.3 Add explicit development and production build commands for the web and Electron targets, including packaging configuration only where needed; verify `npm run build` and the Electron build command complete successfully.
- [x] 5.4 Update the README and development workflow documentation to describe the shared runtime, web/Electron commands, source-of-truth file model, and the fact that VS Code integration is deferred; verify the documented commands match `package.json`.
- [x] 5.5 Perform final validation after all behavior slices are green: `npm test`, `npm run build`, `npm run test:e2e`, and `npm run spec:validate`; verify no generated build or test output is included in the change.

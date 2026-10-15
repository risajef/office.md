## 1. Refresh and protect workspace snapshots

- [x] 1.1 Add a failing public workspace application/port test that rejects a stale write without altering disk contents; verify the test fails before implementation.
- [x] 1.2 Implement version-checked writes in the Electron, local-server, and browser-folder adapters; verify the focused workspace tests pass across the supported adapters.
- [x] 1.3 Add failing public workspace application/port tests for external additions and edits, lost browser permission, and a transient refresh failure; verify the tests fail before implementation.
- [x] 1.4 Implement background-safe snapshot refresh in all three disk-backed adapters; verify the focused refresh and retry tests pass.

## 2. Reconcile external changes in the editor

- [x] 2.1 Add failing Playwright coverage with a temporary workspace for an external file addition, an external edit to a clean active document, and a same-document conflict with unsaved local edits; verify the new scenarios fail before implementation.
- [x] 2.2 Implement foreground polling, per-file reconciliation, visible external-change status, and per-document **Use disk version** / **Keep my version** conflict actions; verify the focused Playwright scenarios pass without pressing Reload.
## 3. Final verification

- [x] 3.1 Run `npm test`, `npm run build`, `npm run build:electron`, `npm run test:e2e`, and `npm run spec:validate`; confirm all required checks pass.

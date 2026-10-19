## 1. Startup UI and Runtime Differentiation

- [x] 1.1 Add the startup empty workspace button (`#startup-new-empty-project`) to `index.html` and verify it is rendered with disabled state on initial load in `tests/e2e/editor.spec.ts`.
- [x] 1.2 Hide the empty workspace button when running in Electron runtime in `src/main.ts` and verify it is hidden in `tests/e2e/electron.spec.ts`.

## 2. Empty Browser Workspace Initialization and Storage

- [x] 2.1 Implement the initialization action in `src/main.ts` that creates and loads an isolated empty browser workspace (with `document.md` and default workspace name), transitioning from startup choice to the active workspace editor. Verify with a new Playwright test in `tests/e2e/editor.spec.ts`.
- [x] 2.2 Verify that edits to documents in the browser empty workspace persist in IndexedDB and that `Share Workspace` / `Share File` actions generate valid share URLs in `tests/e2e/editor.spec.ts`.

## 3. Full Verification and Validation

- [x] 3.1 Run test suite (`npm test`, `npm run build`, `npm run test:e2e`, and `npm run spec:validate`) to ensure all existing and new scenarios pass cleanly.


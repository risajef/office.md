## 1. Startup choice and remembered location

- [x] 1.1 Add regression coverage that first confirms the startup choice appears on every launch, starts from the most recently selected location, and remains visible when selection is canceled; run `npm run test:e2e -- tests/e2e/editor.spec.ts tests/e2e/electron.spec.ts` and verify the new assertions fail before implementation.
- [x] 1.2 Implement the startup choice and persist/restore the last selected location across Electron, local bridge, and browser folder-access hosts; run `npm run test:e2e -- tests/e2e/editor.spec.ts tests/e2e/electron.spec.ts` and verify the startup and location scenarios pass.

## 2. Open a Markdown or CSV file

- [x] 2.1 Add regression coverage for the Markdown/CSV filter, opening the selected file's immediate parent folder, and activating a selected nested file; run `npm test -- tests/unit/workspace-parity.test.ts tests/unit/web-workspace-port.test.ts tests/unit/electron-workspace-port.test.ts` and `npm run test:e2e -- tests/e2e/editor.spec.ts tests/e2e/electron.spec.ts`, and verify the new assertions fail before implementation.
- [x] 2.2 Add host-specific file selection behind the workspace adapters, including browser folder access followed by an in-app editable-file choice; run the same unit and end-to-end commands and verify the file-opening scenarios pass in supported runtimes.

## 3. Choose the folder's initial document

- [x] 3.1 Add regression coverage that a selected folder activates the first editable file in visible file-view order and opens folders without editable files with no active document; run `npm test -- tests/unit/workspace-application.test.ts tests/unit/workspace-parity.test.ts` and `npm run test:e2e -- tests/e2e/editor.spec.ts`, and verify the new assertions fail before implementation.
- [x] 3.2 Implement folder initial-file selection and the no-active-document state; run the same unit and end-to-end commands and verify both folder-selection scenarios pass.

## 4. Integration verification

- [x] 4.1 Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm run spec:validate`; confirm browser scenarios pass, Electron adapter/build checks pass, and change artifacts validate. Run Electron shell scenarios when its binary is available.

The web end-to-end scenarios passed. Electron end-to-end scenarios were skipped because the Electron binary is not installed in this environment; the Electron adapter tests and TypeScript/build checks passed.

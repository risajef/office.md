## 1. Establish the independent style-source seam

- [ ] 1.1 Add red public-interface tests for selecting one style folder, listing only visible CSS files with relative paths, source-qualified identities, and reporting unreadable folders; verify the new tests fail before the style-folder port exists.
- [ ] 1.2 Define the host-neutral style-folder types and port, plus a deterministic fake style source; make the tests from 1.1 green and verify the focused style-folder unit tests pass.
- [ ] 1.3 Add red application tests proving external styles are not returned as workspace files, include sources, or workspace mutation targets; implement the smallest source separation and verify the focused tests pass.

## 2. Add independent web style-folder selection

- [ ] 2.1 Add red web-adapter tests for using the local bridge when available, falling back to browser folder access, handling cancellation/unsupported access, and scanning mixed or empty folders; verify the tests fail before the adapter is wired.
- [ ] 2.2 Implement the web style-folder adapter over the existing filesystem mechanisms and make the adapter tests green; verify the adapter contract suite passes without changing document-workspace behavior.
- [ ] 2.3 Add red DOM/application tests for selecting a style folder while a workspace and document are open, displaying only CSS themes, and leaving the open file and source unchanged; wire the independent picker and style choices, then verify the tests pass.
- [ ] 2.4 Add the unavailable-folder and replacement behavior, including an actionable status and preservation of document edits; verify focused tests cover cancellation, empty folders, missing folders, and switching sources.

## 3. Reuse theme application and export behavior

- [ ] 3.1 Add red tests for applying an external CSS theme, scoping it to the document surface, refreshing document/Mermaid typography, and switching back to a workspace theme; verify the tests fail before the shared theme path accepts external sources.
- [ ] 3.2 Generalize the existing theme application path to accept workspace and external style sources without duplicating CSS scoping; make 3.1 green and verify the Markdown styling and existing workspace-theme tests pass.
- [ ] 3.3 Add red export tests for standalone HTML and print/PDF surfaces when an external theme is active, including the absence of an external path dependency; implement the minimal export integration and verify the document-export tests pass.
- [ ] 3.4 Verify that external style files remain read-only and are unaffected by workspace save, rename, delete, include, and reload actions; verify the relevant workspace and application tests pass.

## 4. Persist the style-folder location in Electron

- [ ] 4.1 Add red Electron adapter tests for read-only CSS scanning, hidden/unsupported content filtering, and rejection of unsafe or out-of-scope paths; verify the tests fail before the desktop style adapter is implemented.
- [ ] 4.2 Implement the Electron style-folder adapter through the existing secure main/preload boundary from `multi-runtime-app`; verify the adapter contract tests pass with a real temporary folder.
- [ ] 4.3 Add red preference tests for remembering only a successfully selected folder, restoring it on startup, replacing it after a new selection, and clearing it when the folder is missing or unreadable; verify the tests fail before persistence is wired.
- [ ] 4.4 Implement Electron user-data preference persistence and startup restoration without storing the location in document files; make 4.3 green and verify an Electron relaunch smoke test restores a readable folder and handles a stale path safely.

## 5. Verify and document the feature

- [ ] 5.1 Add web end-to-end coverage using separate temporary document and style folders, including source separation, theme switching, empty/missing folders, scoped styling, and HTML/print export; verify `npm run test:e2e` passes.
- [ ] 5.2 Add Electron end-to-end coverage for selecting a style folder, closing/relaunching the app, restoring the last location, and recovering from a removed folder; verify the Electron Playwright path passes with real temporary folders.
- [ ] 5.3 Update README and development workflow documentation with independent style-folder selection, Electron restoration behavior, the read-only style-source boundary, and the text-only CSS resource limitation; verify documented commands and behavior match the implementation and specs.
- [ ] 5.4 Run final validation after all behavior slices are green: `npm test`, `npm run build`, `npm run test:e2e`, and `npm run spec:validate`; verify no generated `dist/`, `playwright-report/`, or `test-results/` output is included.

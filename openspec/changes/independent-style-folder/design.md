## Context

See `proposal.md` for the motivation and user-visible scope. Today, CSS themes are represented as workspace files in `src/main.ts`; the renderer discovers example CSS through Vite and discovers project CSS while loading the opened workspace. Applying a theme injects its text into a style element, scopes selectors to the document surface, and lets the export code serialize the active styles.

The existing folder picker and filesystem bridges are designed around opening the document workspace. The `multi-runtime-app` change establishes the shared host boundary that this change will consume. The style-folder feature must remain a separate source of read-only theme content and must not accidentally become a second document workspace.

## Goals / Non-Goals

**Goals:**

- Model an independent style source that can be used with any opened document workspace.
- Reuse the existing document-theme scoping, Mermaid typography refresh, and export path.
- Support folder selection in the web and Electron hosts through their existing host boundaries.
- Persist only the last Electron style-folder location and recover cleanly when it is stale.
- Keep the feature testable with fake ports, adapter contract tests, and real temporary folders.

**Non-Goals:**

- Editing, creating, renaming, or deleting CSS files from the style-folder feature.
- Selecting or merging multiple style folders at the same time.
- Moving workspace CSS files or changing Markdown include resolution.
- A new CSS asset pipeline for remote resources, relative images, or nested `@import` graphs.
- Persisting an absolute style-folder path as part of a document or synchronizing it between machines.

## Decisions

### Use a separate style-folder capability port

Shared application code will depend on a style-folder port distinct from the document `WorkspacePort`. The port will represent selecting a folder, listing readable CSS files with stable source-qualified identities, reading a selected stylesheet, and reporting capability or access failures. The application will not infer a style folder from the current workspace.

This separation prevents external styles from entering `WorkspaceFile` collections, include lookup, workspace save, or workspace mutation logic. A fake port can provide deterministic style files for application tests without requiring a browser directory handle or an Electron process.

### Treat one external folder as one replaceable style source

The application will keep one selected external style folder at a time. Selecting another folder replaces the external choices but does not reload the document workspace or change the document source. Theme identities will include their source and relative path so a `theme.css` in the workspace cannot collide with a `theme.css` in the style folder.

The style chooser will distinguish workspace and external themes by source and relative path. External files are read-only inputs; the existing workspace file actions continue to operate only on the opened document workspace.

### Reuse the existing theme application pipeline

Workspace and external CSS will converge on one document-theme application path after the source has been read. The path will preserve selector scoping to `.editor-wrap`, document-only application, Mermaid typography refresh, active-theme replacement, and serialization into standalone HTML and print surfaces. Export output will contain the CSS text rather than a reference to the external folder path.

This keeps the styling behavior consistent and avoids a second implementation of CSS scoping. The current example themes remain available as bundled examples, while workspace and external files become explicit theme sources.

### Use host adapters for folder selection

The web adapter will use the existing local filesystem bridge and its folder browsing flow when the bridge is available, and the browser directory picker when the web target is hosted without the bridge. Both paths will return the same style-folder model and will scan only visible CSS files while leaving the document workspace session intact.

The Electron adapter will use the desktop host's secure folder-selection and read-only filesystem capability from `multi-runtime-app`. The renderer will request style-folder operations through the host-neutral port; it will not receive direct Node filesystem access.

### Persist the Electron location in host preferences

Electron will store the last successfully selected style-folder location in the application's user-data preferences, separate from the opened document workspace. The location is written only after a successful selection and readable CSS scan. On launch, Electron validates the stored location before exposing it as restored; if it is missing or inaccessible, the preference is cleared and the UI asks the user to choose again.

Renderer `localStorage` is not used for this path because it is not a reliable desktop preference boundary and would make filesystem restoration dependent on renderer state. The web target has no required cross-session absolute-path restoration in this change.

### Keep the initial source contract text-based

The first version treats a CSS file as a readable stylesheet source and inlines its text into the document theme. It does not promise resolution of external resources or nested imports relative to the selected folder. This matches the current theme pipeline and keeps the feature local-first and deterministic; asset support can be added later as a separate behavior change.

## Risks / Trade-offs

- **[Stale Electron paths]** A remembered folder can be moved, deleted, or become inaccessible. → Validate it on every startup, clear it when invalid, and keep the document workspace usable.
- **[Theme identity collisions]** Workspace and style folders may contain the same relative filename. → Use source-qualified identities and show the source in the chooser.
- **[External CSS leakage]** A theme could accidentally affect application chrome. → Reuse the existing selector-scoping pipeline and keep a regression test for document-only application.
- **[Adapter divergence]** Web and Electron may list different files or handle failures differently. → Run the same style-folder contract suite against both adapters.
- **[CSS imports and assets]** Inlined CSS cannot automatically resolve every path relative to its original folder. → Keep the initial contract text-only, document the boundary, and do not silently claim support for external resources.
- **[Coupling to the runtime change]** Implementing this before the host boundary stabilizes could duplicate Electron wiring. → Consume the `multi-runtime-app` port and shell rather than creating a second host integration.

## Migration Plan

1. Complete or establish the host-neutral runtime seam from `multi-runtime-app`, then add the style-folder port, source types, fake, and contract tests.
2. Add web folder selection and CSS scanning behind the port; verify that selecting or replacing a style folder does not reload or mutate the document workspace.
3. Generalize the existing theme application and export wiring to accept source-qualified external styles, preserving workspace CSS behavior.
4. Add Electron style-folder selection through the existing secure host bridge and persist/restore the last successful location in user-data preferences.
5. Add unit, web end-to-end, and Electron coverage for empty/mixed folders, cancellation, missing folders, source switching, styling scope, and HTML/print export.
6. Run the complete test, build, end-to-end, and spec-validation commands before syncing this change into the main specifications.

The change is additive and has no document-data migration. If the feature must be rolled back, the independent style-folder entry point and Electron preference can be disabled while workspace CSS themes, document files, and existing exports continue to work.

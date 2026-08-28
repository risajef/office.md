## Why

Document themes are currently discovered only inside the opened document workspace. This makes reusable CSS libraries awkward: the user must copy styles into every project, and changing projects also changes the available themes. A separate style folder lets users reuse one CSS collection across workspaces while keeping the document files and theme files independent.

## What Changes

- Let the user select one CSS style folder independently from the currently opened document workspace.
- Discover visible `.css` files in the selected style folder and make them available in the existing document-theme picker.
- Keep external style files separate from the workspace file tree, document includes, workspace mutations, and document source.
- Apply external themes with the same document-only scoping and Mermaid/document typography behavior as workspace themes.
- Include the active external theme in standalone HTML and print/PDF output just like an active workspace theme.
- In the Electron target, remember the last selected style-folder location and try to restore it on the next launch.
- If a remembered or selected style folder is unavailable, show an actionable state and keep the opened document workspace usable.
- Preserve existing workspace CSS themes and allow the user to switch between workspace and external style sources.

The style folder is a theme source, not a second document workspace: CSS files from it are read for applying themes and are not edited or mutated by office.md.

## Capabilities

### New Capabilities

- `style-folders`: Select, scan, reuse, and restore an independent folder of CSS document themes.

### Modified Capabilities

- `markdown`: Allow document-only CSS themes to come from either the opened workspace or the selected independent style folder.
- `export`: Preserve the active external CSS theme in standalone HTML and print/PDF output.

## Impact

- Affected styling and theme selection in `src/main.ts`, the current workspace file list, and the existing folder-picker/runtime boundaries.
- New host-neutral style-folder capability and web/Electron adapters, building on the host boundary from `multi-runtime-app`.
- Electron persistence for the last style-folder location, with validation when the path no longer exists or is inaccessible.
- New unit, web end-to-end, and Electron coverage for independent selection, source separation, restoration, missing folders, scoping, and export.
- No change to Markdown include rules, CSV behavior, workspace source-of-truth files, or the application chrome styling.

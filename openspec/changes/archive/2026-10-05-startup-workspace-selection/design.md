## Context

See proposal.md for the motivation and specs for the user-visible contract. Today the editor restores a previous workspace during startup, and workspace selection APIs open folders only. Workspace files already have a stable tree order, with editable Markdown and CSV alongside non-editable CSS and image entries.

## Goals / Non-Goals

**Goals:**

- Put the folder-or-file choice before workspace restoration or document activation on every launch.
- Route folder and file selections through the existing workspace loaders while preserving the selected file and its immediate parent folder relationship.
- Reuse the workspace file view's ordering to choose the initial editable file after a folder selection.
- Remember the last selected location across launches in each supported host, using the containing folder when the user selected a file.

**Non-Goals:**

- Add editing support for CSS or images, or change which files are visible in a workspace.
- Change document save, reload, include, or filesystem mutation behavior.
- Restore and activate a previous workspace automatically before the user makes the startup choice.

## Decisions

### Gate workspace restoration behind the startup choice

Render the startup choice before loading or activating a cached workspace. Keep the remembered location as picker state, separate from restoring workspace contents. A canceled selection leaves the startup choice visible. Opening a folder uses the first editable entry in the same visible tree order used by the workspace file list; reloading an already open workspace can continue preserving its active file.

An empty or non-editable-only folder still opens as the workspace, with no active document. It must not activate a CSS/image entry or leave demo or previous-document content presented as active.

The alternative of restoring the last workspace and placing a welcome panel over it was rejected because it would still load a workspace before the user chooses where to work.

### Keep host-specific selection behind workspace adapters

Electron can use its native file dialog with Markdown and CSV filters, then open the selected file's immediate parent folder. The local filesystem bridge can extend its folder navigation picker to show supported file choices. In the browser-backed folder-access path, begin from the remembered directory, obtain folder access, and offer Markdown/CSV candidates from that folder in the app; selecting a nested candidate opens its immediate parent as the workspace. This uses the folder access the browser workspace already needs and produces the same active workspace and file result in every supported runtime.

Persist the last selected location with each host's existing local preference mechanism. When a file is selected, remember its immediate parent folder. When a folder is selected, remember that folder. If the remembered location is stale or inaccessible, let the host picker use its normal starting location.

A single native file picker for every host was not selected because the browser-backed workspace adapter currently grants folder access, and the workspace needs that parent-folder access to browse and edit files consistently.

### Use the file view's order for the folder default

Filter the visible workspace file list to Markdown and CSV and activate its first remaining entry. Keep the file-tree ordering as the source of truth rather than adding a second sort or preferring a remembered filename. This keeps the automatic choice predictable from the list the user sees.

## Risks / Trade-offs

- **A remembered location may no longer be accessible** → Fall back to the host's normal starting location and leave the startup choice available.
- **The browser-backed Open File flow may require selecting a folder before choosing a file inside it** → Keep the initial folder-or-file choice and the supported-file filter consistent, then activate the selected file with its immediate parent as the workspace.
- **A folder may contain no editable documents** → Open the workspace without an active document and avoid treating CSS or images as editable documents.

## Migration Plan

No workspace file format changes are required. Add persistent location state for hosts that do not already retain it across restarts. Existing workspace files and document settings remain readable; rolling back the app does not require a data migration.

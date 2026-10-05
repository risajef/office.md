## Why

The app currently opens into the editor and may silently restore a previous workspace, so users do not begin by choosing the folder or document they want to work on. A consistent startup choice should make the intended workspace explicit while letting users open a document directly.

## What Changes

- Show a folder-or-file choice at every app launch, with folder and file selection starting from the last selected location.
- Let users open Markdown and CSV files in every supported runtime; opening a file also opens its parent folder and activates that file.
- When a folder is selected, open the first visible editable Markdown or CSV file in the workspace file view's order.
- If a selected folder contains no Markdown or CSV files, open the folder without an active document.
- Keep existing behavior for supported workspace contents, editing, saving, and mutations outside this startup flow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Define startup folder/file selection, remembered selection location, file opening, and folder default behavior.
- `runtime-hosts`: Require the same folder/file startup behavior across web and Electron targets.

## Impact

Likely affected areas include startup UI, workspace selection and host adapters, and browser/Electron workflow coverage. No new dependencies are expected. Open File is limited to editable Markdown and CSV files; this change does not alter the set of files visible in a workspace or add editing support for CSS and images.

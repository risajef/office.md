## Why

In the web browser target, office.md now supports isolated document and workspace sharing via URLs without requiring a local disk folder. However, users starting the web version currently face a mandatory prompt to select a local disk folder or file. Users often want to start a new, empty document or project purely in browser storage (IndexedDB), edit it online without selecting a disk directory, and potentially export or share it as a link later. In the desktop Electron target, documents are strictly file-backed and opening an untracked in-memory/browser-only project does not make sense.

## What Changes

- Add a "New empty project" (or "Start empty project") option to the startup choice card, visible and enabled exclusively in the web target (hidden in Electron).
- When chosen, the web application opens an isolated browser-stored workspace containing a default initial document (`document.md`), immediately transitioning past the startup dialog into the workspace editor.
- The browser-stored workspace persists edits across reloads using browser storage (IndexedDB), matching the behavior of shared browser copies.
- Document and workspace sharing actions (`Share File` / `Share Workspace`), as well as export options, remain fully available in this browser-stored workspace so the project can later be shared via URL or exported.
- In Electron, the startup choice continues to offer only disk-backed folder and file selection (and shared ZIP opening).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Update startup workspace selection requirements to permit choosing a new browser-stored empty workspace in the web target, while keeping the existing disk-backed choices and Electron behavior unchanged.
- `runtime-hosts`: Clarify runtime-specific startup actions: the web target provides an action to start an isolated browser-stored empty project, whereas desktop Electron requires disk-backed project selection.

## Impact

- Startup UI in `index.html` and `src/main.ts`: Add button for empty project creation in web runtime.
- Workspace initialization in `src/main.ts`: Provide a flow to initialize an empty browser workspace backed by IndexedDB.
- Specifications: `workspace` and `runtime-hosts` spec deltas.
- Tests: Add unit and E2E tests verifying web startup with empty project, persistence, and exclusion from Electron.


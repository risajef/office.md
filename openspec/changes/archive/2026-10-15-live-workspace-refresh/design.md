## Context

See `proposal.md` for motivation and `specs/workspace/spec.md` for the behavior contract. The Electron, local-server, and browser-folder adapters expose disk-backed snapshots through the shared workspace application. The renderer currently refreshes only on the user's Reload action; that path rebuilds the whole editor state and clears dirty tracking, so it cannot be reused directly for background refresh.

## Goals / Non-Goals

**Goals:**

- Provide the same external-change behavior across all disk-backed runtimes.
- Keep the editor usable while checking for changes and retain local content during conflicts.
- Refresh only affected files and preserve unrelated editor and workspace state.
- Detect external changes before a pending save can silently replace a newer disk version.

**Non-Goals:**

- Real-time collaboration or synchronization between app instances.
- Monitoring an independently selected style folder.
- Background filesystem access when the editor window is hidden.

## Decisions

### Use a shared, foreground snapshot poll

The renderer will request a fresh workspace snapshot on a short interval while a disk-backed workspace is open and the window is visible. Only one refresh may run at once. Returning to the window triggers an immediate refresh. Browser-folder refreshes must use already granted permission and must not open a permission prompt from a timer.

Polling uses the same public workspace application boundary for Electron, the local filesystem bridge, and browser folder access. Host filesystem watchers were considered, but they have different behavior by runtime and no equivalent event source for browser folder handles. A shared poll gives consistent results and a single reconciliation path. The interval and foreground-only rule bound background work; scans continue to honor the existing visible-file filters.

### Reconcile snapshots without rebuilding the editor

The renderer will compare each fresh snapshot with its last known disk contents and current workspace model. New paths and directories update the file view without changing the active document. Changed clean files update their cached content; if the active Markdown or CSV document changed, only that document is reloaded and a visible status message reports the external update. Removed and renamed paths update the view as snapshot differences.

This avoids `loadWorkspaceFromSnapshot` for routine refreshes because that function resets dirty tracking and rebuilds unrelated UI state. Refresh failures leave the previous snapshot and editor state intact; the next scheduled or foreground refresh retries.

### Guard writes against an unseen external version

Before a workspace write replaces a file, the runtime adapter will compare the current on-disk contents with the last disk contents known to the workspace application. A mismatch rejects the write without changing either copy and returns the current disk version for conflict presentation. This check also protects autosaves that occur before the next polling pass. An explicit **Keep my version** action may then overwrite or recreate that file; **Use disk version** replaces or removes only the affected document. Both actions are per document.

Browser folder access uses the selected file handle and its granted read/write permission for the comparison. The Electron and local-server adapters perform the comparison at their filesystem boundary. No new dependency is required.

### Keep conflicts visible until resolved

An external modification or deletion to a document with unsaved local edits creates a conflict record containing the local version and the latest disk state. The editor keeps displaying local content, the file view reflects the disk paths, and a visible conflict notice identifies the document. **Use disk version** accepts the current disk contents or closes a deleted document. **Keep my version** explicitly writes the local content or recreates a deleted file. Resolving one conflict does not reload or discard other documents.

## Risks / Trade-offs

- **Repeated scans use disk and CPU** → Poll only while the window is visible, avoid overlapping scans, and reuse the existing workspace filters.
- **A browser permission may be revoked** → Background checks do not request permission; retain cached content and retry when access becomes available.
- **An external writer can race a check and write** → Compare versions at the runtime write boundary and reject detected mismatches; keep the interval short. Filesystem APIs do not provide a cross-runtime atomic compare-and-swap.
- **An external rename appears as a removed and added path** → Update the path list and preserve unrelated documents; do not infer rename identity from matching content.

## Migration Plan

No stored data or settings migration is needed. Existing manual Reload remains available as an explicit full-workspace reload.

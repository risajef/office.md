## Why

External edits and newly created workspace documents remain invisible until the user manually reloads the folder. This makes the open workspace appear stale and risks editing an outdated copy.

## What Changes

- Detect visible workspace files and folders added, changed, renamed, or removed while the workspace is open.
- Refresh the file view and automatically load external updates into documents without unsaved local edits.
- Preserve local edits and surface a clear conflict when the same document changes externally.
- Keep monitoring failures from interrupting normal editing; allow detection to resume when access returns.

### Non-goals

- Synchronizing workspaces across devices or users.
- Monitoring the separately selected style folder.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Detect and present external filesystem changes during an open workspace while preserving unsaved editor content.

## Impact

- Workspace snapshots and runtime ports in `src/`.
- The shared editor and workspace file view in `src/main.ts`.
- Electron and browser/local-server filesystem access paths.
- Unit and end-to-end tests for disk-backed workspace behavior.

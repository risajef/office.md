## Why

Renderer-owned dirty/clean/conflict maps and duplicate export/Node filesystem paths let behavior diverge across UI and hosts.

## What Changes

- Centralize document persistence state in a session controller.
- Share one export application between renderer and workspace tests.
- Use one Node workspace service behind HTTP and Electron.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Keep document session state coherent

## Impact

Session controller, shared export application, shared Node service and thin HTTP/IPC adapters; production-path tests.

Non-goals: Rewriting the UI framework or eliminating the deliberate distinction between editable session contents and last observed disk snapshots.

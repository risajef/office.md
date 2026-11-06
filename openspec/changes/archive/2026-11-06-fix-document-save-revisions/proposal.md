## Why

Save completion reads mutable editor state and marks newer text clean although only older text reached disk.

## What Changes

- Capture the document and workspace revision at save request time.
- Serialize per-document saves and reject queued saves after workspace switches.
- Acknowledge only the text actually persisted.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Acknowledge only persisted document revisions

## Impact

Document save controller, renderer autosave and workspace application state updates; delayed-I/O tests.

Non-goals: Full renderer decomposition or changes to external conflict resolution choices.

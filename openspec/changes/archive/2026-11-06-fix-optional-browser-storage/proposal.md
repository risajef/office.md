## Why

Browser cache exceptions can abort editor startup and prevent the disk autosave callback from running.

## What Changes

- Route optional browser storage through a nonthrowing boundary.
- Keep disk persistence and editor initialization available when browser storage is blocked or full.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Keep disk editing independent of browser cache

## Impact

Shared optional storage boundary, renderer storage accesses, Markdown plugin and browser workflows.

Non-goals: Changing IndexedDB shared-copy persistence or cache scheduling.

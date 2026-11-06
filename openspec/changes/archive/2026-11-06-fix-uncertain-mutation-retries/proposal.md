## Why

Reopening a workspace and retrying every failed mutation can reset conflict baselines and repeat writes whose outcome is unknown.

## What Changes

- Stop automatic retries of workspace mutations after transport or service errors.
- Keep explicit reload and read-only background reconnection available.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Do not repeat uncertain filesystem mutations

## Impact

Local-server backend mutation dispatch and network-boundary tests.

Non-goals: Adding exactly-once request identifiers or changing read-only refresh recovery.

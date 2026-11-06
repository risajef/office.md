## Why

Node services retain every opened workspace and style folder with their cached contents for the process lifetime.

## What Changes

- Retire replaced workspace and style sessions after successful selection.
- Add explicit workspace close across host transports and release browser handles/object URLs.
- Dispose disk sessions when entering an isolated shared copy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Dispose inactive filesystem sessions

## Impact

Node workspace/style services, HTTP sessions, workspace ports, Electron bridge and shared-copy entry.

Non-goals: Changing remembered picker locations or deleting user files.

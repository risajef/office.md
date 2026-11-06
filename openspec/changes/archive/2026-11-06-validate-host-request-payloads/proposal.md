## Why

IPC dispatch casts unknown payloads into request shapes and malformed inputs fail through incidental type errors; archive writes accept unbounded payloads.

## What Changes

- Parse workspace and style requests before dispatch.
- Validate optional picker paths and share archive metadata/size at Electron entry points.
- Return deliberate invalid-request errors without filesystem effects.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `runtime-hosts`: Validate host requests before executing capabilities

## Impact

Shared Node request parsers, workspace/style dispatch, Electron picker/archive entry points and invalid-input tests.

Non-goals: Changing valid IPC method names or introducing a general schema framework.

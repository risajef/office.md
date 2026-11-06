## Why

Browser-folder writes recreate an externally deleted root document before checking whether it was previously known.

## What Changes

- Detect deleted known files before creating new handles.
- Preserve new-file creation after an explicit fresh snapshot.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace`: Preserve deleted files until conflict resolution

## Impact

Browser folder adapter and filesystem boundary regression.

Non-goals: Changes to the conflict dialog or new-file naming.

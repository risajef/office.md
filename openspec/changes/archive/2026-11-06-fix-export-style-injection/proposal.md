## Why

Theme strings can terminate the exported style element and introduce executable HTML into exported documents and print previews.

## What Changes

- Keep CSS text in its CSS context when serializing HTML.
- Disable script execution in print surfaces and exported documents.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `export`: Keep exported styling inert

## Impact

Document export serialization, print frames, and DOM export tests.

Non-goals: Changing the supported theme selector policy or the Markdown sanitizer.

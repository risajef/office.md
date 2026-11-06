## Why

Standalone exports retain blob URLs and local bridge session URLs which stop working outside the editor.

## What Changes

- Embed local workspace images as data URLs before HTML and print export.
- Preserve remote image references without fetching them.
- Fail clearly if a required local image cannot be packaged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `export`: Package local images in standalone exports

## Impact

Shared async export application, image materialization and fresh-context browser tests.

Non-goals: Downloading remote images, packaging theme fonts or making remote network content available offline.

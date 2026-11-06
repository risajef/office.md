## Why

Raw and included HTML can retain executable URLs because handwritten checks do not match browser parsing.

## What Changes

- Sanitize HTML/SVG with DOMPurify at the shared rendering boundary.
- Preserve ordinary document markup and strip active content.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown`: Sanitize embedded HTML consistently

## Impact

HTML preview and include materialization, sanitizer dependency, regression tests.

Non-goals: Theme CSS containment or changes to the stored Markdown source.

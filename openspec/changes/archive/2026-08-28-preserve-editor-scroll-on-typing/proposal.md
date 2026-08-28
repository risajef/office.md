## Why

Typing in the paged Electron editor moves the viewport so that the active line
is placed at the bottom of the window. This interrupts normal editing because
the surrounding document moves even when the caret is already visible.

## What Changes

- Preserve the current editor viewport while ordinary text input remains inside
  the visible viewport.
- Keep caret visibility behavior when an edit, especially pressing Enter,
  moves the caret outside the visible viewport.
- Apply the behavior through the shared editor surface so the web and Electron
  targets remain consistent.
- Add an end-to-end regression test for typing in a visible line and moving the
  caret past the viewport boundary.

## Capabilities

### Modified Capabilities

- `markdown`: Treat typing as a non-scrolling edit while the caret remains
  visible, while still revealing a caret that moves outside the viewport.

## Impact

- The shared Milkdown editor view configuration and its end-to-end coverage.
- No change to document serialization, keyboard shortcuts, page layout modes,
  or deliberate navigation actions.

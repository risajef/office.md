## Context

Milkdown creates a ProseMirror `EditorView`. ProseMirror marks normal input
transactions with `scrollIntoView`, then uses the view's scroll callback to
reveal the selection. The editor also uses scaled paged surfaces and an
`editor-wrap` scroll container, so the default coordinate-based callback can
interpret a visible caret as needing a full viewport adjustment.

## Goals / Non-Goals

**Goals:**

- Keep the viewport stable for ordinary typing when the caret is already
  visible.
- Preserve automatic scrolling when the caret really leaves the visible
  editor viewport, including after Enter.
- Keep intentional application navigation (outline jumps, inserted content,
  page navigation, and explicit scroll actions) unchanged.
- Cover the behavior through a public DOM and scroll-position test.

**Non-Goals:**

- Removing ProseMirror's selection-scroll signal from input transactions.
- Changing page dimensions, zoom, pagination, or editor content serialization.
- Replacing the editor's scroll container or adding a second editor model.

## Decisions

### Configure the editor's selection-scroll seam

The page-layout plugin supplies a `handleScrollToSelection` callback as a
shared ProseMirror view prop. The callback uses the editor's actual scroll
parents and caret rectangle to determine whether the selection is outside the
usable viewport. It leaves scroll positions untouched when the caret is
visible and otherwise performs the minimal required scroll.

This keeps ProseMirror's normal input and Enter handling intact while adapting
the final scroll decision to the application's paged and transformed layout.

The plugin maps existing page-break decorations across document changes instead
of removing them for every character. The next layout refresh can still replace
stale breaks, while the current surface remains stable during the input update.

### Measure the viewport before moving it

The callback will inspect the window and the nearest scrollable editor wrapper,
accounting for the wrapper's client rectangle and scrollbars. It will scroll
only the parent whose viewport excludes the caret and will preserve the
existing margin used by the editor. No `scrollIntoView()` call will be made for
a caret that is already visible.

### Test through visible behavior

The regression test will use a long temporary Markdown document, place the
caret in a visible paragraph, type without pressing Enter, and assert that the
relevant scroll positions and caret location remain stable. A second step will
press Enter at the lower viewport boundary and assert that the new line becomes
visible, protecting the expected editor behavior at the boundary.

## Risks / Trade-offs

- **[Nested scroll parents]** The editor can be in the page viewport or in the
  paged `editor-wrap`. → Walk the actual DOM ancestors and handle both cases.
- **[Scaled pages]** CSS transforms make logical and client coordinates differ.
  → Compare client rectangles, which are in the same coordinate space as the
  browser viewport and scroll containers.
- **[Intentional commands]** Existing commands may rely on `scrollIntoView`.
  → Only replace the automatic selection-scroll callback; explicit command
  scrolling continues to use its existing transactions.
- **[Browser differences]** Selection rectangles can be empty or unavailable
  briefly during composition. → Fall back to ProseMirror's default behavior
  when no usable caret rectangle exists.

## Migration Plan

1. Add the OpenSpec delta and a failing editor scroll regression test.
2. Add the shared editor-view scroll callback and make the typing test pass.
3. Verify explicit navigation and existing page-layout tests remain green.
4. Run the full unit, build, end-to-end, and spec validation commands.

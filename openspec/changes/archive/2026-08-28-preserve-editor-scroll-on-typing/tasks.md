## 1. Reproduce the editor scroll regression

- [x] 1.1 Add a public end-to-end test with a long Markdown document that records the editor scroll state before and after typing in a visible line and verifies the stable viewport behavior.
- [x] 1.2 Extend the test to confirm pressing Enter at the viewport boundary still reveals the newly active line.

## 2. Implement stable selection scrolling

- [x] 2.1 Add a shared Milkdown editor-view scroll callback on the page-layout plugin that identifies the relevant window or editor-wrapper viewport and does nothing when the caret is already visible.
- [x] 2.2 Scroll the minimum amount when the caret is above or below the visible viewport, retaining explicit application scroll commands and page navigation behavior.
- [x] 2.3 Make the regression test green and verify existing editor, page-layout, and navigation tests remain green.

## 3. Verify the change

- [x] 3.1 Run focused unit and end-to-end checks for the editor scroll behavior.
- [x] 3.2 Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm run spec:validate`.
- [x] 3.3 Confirm no generated `dist/`, `playwright-report/`, or `test-results/` output is included in the change.

## 1. Mermaid error rendering

- [x] 1.1 Add an editor E2E regression scenario for invalid Mermaid syntax that expects the error inside `.mermaid-preview` and no `body > [id^="dmilkdown-mermaid-"]` node; verify the new test fails before the fix with `npx playwright test tests/e2e/editor.spec.ts -g "Mermaid syntax errors"`.
- [x] 1.2 Pass the existing Mermaid preview as the render container while preserving the current asynchronous error state; verify the regression scenario and existing Mermaid editor scenarios pass with `npx playwright test tests/e2e/editor.spec.ts -g "Mermaid"`.

## 2. Verification

- [x] 2.1 Validate the OpenSpec change and run the relevant unit, build, and browser checks with `openspec validate fix-mermaid-error-rendering --type change --strict --no-interactive`, `npm test`, `npm run build`, and `npm run test:e2e -- --grep "Mermaid"`.

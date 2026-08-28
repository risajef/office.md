# office.md development contract

## Source of truth

- `openspec/specs/` contains the current, accepted product behavior.
- `openspec/changes/<name>/` contains the proposal and spec deltas for work in progress.
- `CONTEXT.md` is the domain glossary. It must not become a design document or implementation diary.
- `docs/adr/` records only durable decisions that are difficult to reverse, surprising without context, and based on a real trade-off.
- `requirements.md` is a historical bootstrap checklist. Do not add new requirements there.

## Change workflow

For every behavior change or bug fix:

1. Read the affected main specs and the relevant source/tests.
2. If the idea, terminology, or design is ambiguous, explicitly invoke `$grill-with-docs` before planning. Let it update `CONTEXT.md` and ADRs as decisions become clear.
3. Use `$openspec-explore` for open-ended investigation, or `$openspec-propose <change>` when the desired outcome is already clear.
4. Review `proposal.md`, every delta in `specs/`, `design.md`, and `tasks.md` before code is written. A change must describe observable behavior and concrete scenarios.
5. Use `$openspec-apply-change <change>` to implement the tasks. Do not silently widen scope; revise the change artifacts first when the plan is wrong.
6. Use `$openspec-verify-change <change>`, then sync and archive only after all tasks are complete and the main specs reflect what shipped.

The preferred sequence is:

```text
$grill-with-docs
  -> $openspec-explore / $openspec-propose
  -> review the change artifacts
  -> $openspec-apply-change + $tdd
  -> $openspec-verify-change
  -> $openspec-sync-specs
  -> $openspec-archive-change
```

OpenSpec workflows are installed in `.agents/skills/`. The `tdd` and `grill-with-docs` skills are installed in the Codex skill directory; if they are missing on another machine, install them from `mattpocock/skills` together with their `grilling` and `domain-modeling` dependencies.

## TDD rules

- Test behavior through public interfaces and agreed seams, not private implementation details.
- Work vertically: one failing test, the smallest implementation that passes it, then the next test.
- Use independent expected values from the spec or a known-good example; do not duplicate production calculations in assertions.
- Refactor only after the test suite is green.

## Verification commands

Use the narrowest check while iterating, then the complete relevant set before handoff:

```bash
npm test
npm run build
npm run test:e2e
npm run spec:validate
```

Browser tests use real temporary workspaces and may require a locally installed Playwright Chromium. Never commit generated `dist/`, `playwright-report/`, or `test-results/` output.

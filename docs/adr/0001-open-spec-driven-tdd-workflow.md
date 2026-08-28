# ADR 0001: Use OpenSpec as the planning source of truth with TDD implementation

- Status: Accepted
- Date: 2026-08-28

## Context

office.md already has a useful README, a small legacy requirements checklist, and tests that describe important behavior. An AI-assisted codebase can still drift when implementation changes are not connected to an explicit, reviewable requirement. The project also has enough filesystem, export, and editor behavior that a code-first change can easily miss a persistence or boundary case.

## Decision

We will version accepted behavior in `openspec/specs/` and plan every behavior change in an OpenSpec change under `openspec/changes/`. The repository uses the OpenSpec `spec-driven` schema with the core workflows plus `verify`, delivered as Codex skills.

Before an ambiguous change, `grill-with-docs` is invoked to align terminology and record durable decisions. During implementation, each task is driven by TDD in vertical red-green-refactor slices. Before a change is archived, it is verified, its spec delta is synced into the main specs, and the relevant tests/build pass.

## Consequences

Positive:

- Reviewers can inspect intent and observable behavior before code.
- Main specs remain current after completed work instead of becoming a one-time requirements document.
- TDD keeps tests attached to public behavior and catches regressions at the seam being changed.
- The glossary and ADRs preserve vocabulary and rationale across future agent sessions.

Costs:

- Small changes require a small amount of planning and artifact maintenance.
- Developers need the OpenSpec CLI and the TDD/grill skill set available to the agent.
- A change may need to pause for a spec update when implementation exposes a missing decision.

## Alternatives considered

- Keep `requirements.md` as the living checklist: rejected because a flat checklist does not capture scenarios, design rationale, or in-flight change boundaries.
- Code first and update documentation afterward: rejected because it makes intent review and test design happen too late.
- Use only end-to-end tests: rejected because pure behavior and filesystem boundaries are faster and clearer to exercise at unit/DOM seams, with Playwright reserved for user-visible integration.

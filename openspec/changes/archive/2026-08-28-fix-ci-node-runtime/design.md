## Context

See `proposal.md` for the motivation. The repository's lockfile currently resolves `jsdom@30.0.1` and `undici@8.10.0`; their declared engine ranges require Node 22.22.2 or newer. The release workflow has three independent `actions/setup-node` steps, so the runtime contract must be applied consistently to validation, packaging, and publication jobs.

## Goals / Non-Goals

**Goals:**

- Make the documented package runtime, local dependency checks, and release workflow agree on one supported Node version.
- Keep the fix deterministic by selecting an explicit compatible Node 22 patch version in CI.
- Test the contract through a static workflow/package boundary so a later workflow edit cannot silently reintroduce Node 20.

**Non-Goals:**

- Change the test environment, Vitest pool, or application runtime.
- Downgrade dependencies solely to preserve Node 20 support.

## Decisions

- Use Node `22.22.2` as the minimum declared runtime and the exact CI setup version. This is the lowest version required by the locked `jsdom` release and also satisfies `undici`; using `22` without a patch would depend on the runner's moving Node 22 alias. Pinning Node 20 would preserve the existing workflow text but cannot satisfy the installed jsdom runtime. Downgrading jsdom is rejected because it changes the test environment rather than fixing the declared compatibility contract.
- Apply the exact version to all three release jobs. A single validation job alone is insufficient because packaging and publication also run `npm ci` and execute Node scripts independently.
- Keep `npm test` unchanged. The regression test reads the public `package.json` and workflow files and asserts their runtime agreement; it does not inspect Vitest internals or duplicate dependency implementation details.

## Risks / Trade-offs

- [Older developer machines] Node 20 users will see the package engine requirement rather than a misleading claim of support. -> Document Node 22.22.2 or newer as the development requirement and rely on npm's engine warning as a clear migration signal.
- [Pinned CI patch becomes stale] A future dependency may require a newer Node release. -> Keep the package engine as the source of the minimum contract and let the contract test be updated alongside dependency upgrades.
- [Other workflows drift] This change covers the Electron release workflow that currently runs the failing command. -> The package engine remains the shared guard for any future workflow, while this task's test explicitly protects all three release-job setup steps.

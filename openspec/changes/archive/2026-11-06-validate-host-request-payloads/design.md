## Context

IPC dispatch casts unknown payloads into request shapes and malformed inputs fail through incidental type errors; archive writes accept unbounded payloads.

## Goals / Non-Goals

Host capability boundaries SHALL parse untrusted request records and validate operation-specific field types and supported size bounds before filesystem or dialog effects. Malformed requests SHALL receive deliberate validation errors rather than incidental type errors.

Non-goals: Changing valid IPC method names or introducing a general schema framework.

## Decisions

Construct discriminated request objects from unknown records using small shared validators for strings, optional fields, booleans and bounded byte arrays. Dispatch only parsed requests. Share-save validation allows only a visible ZIP basename and at most 50 MiB; picker hints accept only optional bounded strings.

## Risks / Trade-offs

Missing refresh flags must remain compatible with existing clients. Unknown operations keep an explicit allowlist error. Existing filesystem path policy remains the authority for path confinement.

## Verification

Public test seams: Node workspace/style dispatch and Electron share/picker payload parsers. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

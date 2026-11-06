## Context

Reopening a workspace and retrying every failed mutation can reset conflict baselines and repeat writes whose outcome is unknown.

## Goals / Non-Goals

The system SHALL report a failed or uncertain mutation without reopening the workspace and repeating that mutation automatically. Subsequent reload and conflict reconciliation SHALL remain available.

Non-goals: Adding exactly-once request identifiers or changing read-only refresh recovery.

## Decisions

Remove the broad catch/reconnect/retry branch from mutation dispatch. The caller retains the original failure; explicit reload or background snapshot reconciliation restores a session and detects external changes before a user retries.

## Risks / Trade-offs

Users may need Reload after a bridge restart. This is preferable to silent duplicate operations or overwrites with a reset precondition.

## Verification

Public test seams: local-server WorkspacePort and HTTP transport. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

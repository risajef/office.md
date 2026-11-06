## Context

Node services retain every opened workspace and style folder with their cached contents for the process lifetime.

## Goals / Non-Goals

The system SHALL release cached contents and capabilities for replaced or explicitly closed workspace sessions. A failed selection SHALL preserve the previous active session. Opening an isolated shared copy SHALL close the disk-backed workspace session.

Non-goals: Changing remembered picker locations or deleting user files.

## Decisions

Keep at most one successfully opened workspace per Node service and one style session; clear replaced maps only after successful snapshots. Expose optional close through WorkspacePort/Backend for compatibility with existing injected hosts, implement concrete browser/HTTP/Electron disposal and clear application snapshots. Old saves are invalidated by the document session reset.

## Risks / Trade-offs

Opening a single file may inspect a parent then select a nested workspace; replacing sessions is safe because only the final session is returned. Concurrent old operations must never repopulate a new renderer snapshot.

## Verification

Public test seams: real Node workspace/style services, WorkspaceApplication close and host port disposal. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

## Context

Save completion reads mutable editor state and marks newer text clean although only older text reached disk.

## Goals / Non-Goals

The system SHALL serialize saves for each workspace document, retain dirty state when editing advances during a save, and prevent late or queued saves from updating another workspace session.

Non-goals: Full renderer decomposition or changes to external conflict resolution choices.

## Decisions

Introduce a host-neutral document save controller that captures content and workspace identity, queues writes by workspace/document, and reports whether the acknowledged revision is still current. The renderer records the captured content as clean and retains dirty state for newer text. WorkspaceApplication checks session identity before applying save completion to its snapshot.

## Risks / Trade-offs

Failed writes must not poison the queue. A workspace switch cancels queued work rather than rerouting it into the new host session.

## Verification

Public test seams: document save controller and WorkspaceApplication. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

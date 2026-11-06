## Context

Lexical traversal checks allow requests through symlinked ancestors to read or mutate outside the selected workspace.

## Goals / Non-Goals

The system SHALL reject workspace read and mutation requests whose target or any existing path component below the selected root is a symbolic link, including both rename endpoints and new file parents.

Non-goals: Supporting symlinked workspace entries or defending against an equally privileged hostile process swapping filesystem entries during a syscall sequence.

## Decisions

Resolve lexical paths and reject invalid/hidden segments, then lstat existing components relative to the canonical root. Reject symbolic links instead of following them, including directory links on Windows. Reuse the policy from both transports. Atomic document writes retain their temporary-file strategy.

## Risks / Trade-offs

Portable Node APIs do not provide descriptor-relative filesystem traversal on all supported systems; simultaneous hostile same-user filesystem mutation remains outside the supported concurrency model. Ordinary external edits remain supported.

## Verification

Public test seams: ElectronWorkspaceService and local HTTP workspace routes. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

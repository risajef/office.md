## Context

Electron IPC accepts requests without sender-frame checks and document navigation can leave the trusted application URL.

## Goals / Non-Goals

The Electron shell SHALL authorize workspace, style and share IPC only from its main application frame at the trusted application URL, block arbitrary renderer navigation and popups, and open only HTTP(S) external links in the system browser.

Non-goals: Changing ordinary in-editor link editing or updater network configuration.

## Decisions

A shared pure sender/URL policy validates window identity, main-frame identity and canonical application URL. Wrap main-process invoke handlers once. Deny window opens and will-navigate while routing safe web links to shell.openExternal. Update picker checks main-frame identity and blocks navigation/popups.

## Risks / Trade-offs

Development renderer URLs must remain supported exactly; hash changes must not break IPC. OS links are limited to explicit HTTP(S), and print subframes receive no capabilities.

## Verification

Public test seams: Electron renderer policy and real Electron application workflows. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

## Context

Standalone exports retain blob URLs and local bridge session URLs which stop working outside the editor.

## Goals / Non-Goals

The system SHALL embed local workspace images into standalone HTML and print exports so they remain viewable after the application session ends. Remote HTTP(S) images SHALL retain their external URLs and SHALL not be fetched during export. Required local image failures SHALL stop export with an explanatory error.

Non-goals: Downloading remote images, packaging theme fonts or making remote network content available offline.

## Decisions

Clone the rendered document, resolve relative image sources via the workspace image resolver, and fetch only blob or same-origin bridge assets. Convert their bytes through FileReader to data URLs, bounded to 50 MiB total. Use the async export pipeline for both HTML and print; do not alter the live editor.

## Risks / Trade-offs

Export now awaits image reads and must preserve SVG fragments and alt text. HTTP errors and revoked blobs fail explicitly; remote images remain network-dependent.

## Verification

Public test seams: document export application and fresh-context HTML browser rendering. Use existing behavior tests plus independent regression fixtures; run narrow tests red then green, the complete unit suite, build, and spec validation. Run relevant browser tests when available.

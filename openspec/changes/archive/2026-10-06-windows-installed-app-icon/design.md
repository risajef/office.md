## Context

See [proposal.md](proposal.md) for motivation. The Windows release is packaged as an NSIS installer by electron-builder. The repository has `public/favicon.svg`, but `electron-builder.json` does not set a Windows application icon.

## Goals / Non-Goals

**Goals:**

- Give the installed Windows application and its Start menu shortcut the existing office.md identity.
- Keep icon packaging deterministic in local and release builds.

**Non-Goals:**

- Redesign the office.md artwork or alter the web favicon.
- Change Linux package artwork, release filenames, installer wizard branding, or code signing.

## Decisions

### Package a checked-in Windows icon asset

Create a multi-resolution `.ico` from `public/favicon.svg` and store it in the repository. Point the electron-builder `win.icon` setting at this checked-in asset. A prebuilt asset avoids requiring an image conversion tool during Windows CI and gives Windows-native packaging the format it expects. Generating the icon during each build was considered, but would add a conversion dependency and platform-specific build behavior.

The NSIS installer wizard has separate artwork settings; they are not needed to give the installed application and Start menu shortcut their app icon, so they remain out of scope.

### Verify the Windows packaging contract

Extend the packaging configuration test to require the Windows icon path and confirm the referenced ICO asset exists and has a valid ICO header. The Windows release job remains the integration check that electron-builder consumes the asset while creating the NSIS package.

## Risks / Trade-offs

- A low-resolution ICO could look soft in Windows shell surfaces. → Include common Windows icon sizes through 256 pixels, rasterized from the existing vector artwork.
- A future artwork update could leave the checked-in ICO stale. → Keep the SVG source path documented beside the generated asset and include regeneration in the packaging task instructions.

## Migration Plan

No migration is needed. New Windows packages include the icon. Existing installations continue to use their current executable and shortcut metadata until users install an updated package.

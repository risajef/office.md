## Context

See proposal.md for motivation. Electron currently starts the update service when the app becomes ready and mounts an update notification in the renderer. The accepted `electron-updates` behavior also describes startup checks and a separate postpone-install step; both change to a manual version picker with consent before download.

## Goals / Non-Goals

**Goals:**

- Keep version information and manual update actions in Electron's native application menu.
- Let users choose a specific compatible release, including an older version, and require consent before downloading and installing it.
- Keep release discovery, selected-version validation, and update installation in the Electron main process, with a temporary picker window that has a dedicated, minimal preload bridge.
- Preserve platform, architecture, version, and package integrity checks for each selected release.

**Non-Goals:**

- Add update UI to the browser runtime.
- Change release metadata, package formats, or update hosting.
- Add background or scheduled update checks.

## Decisions

- Build a native application menu in the Electron main process with **Info** and **Update...** entries under **Help**. This works independently of workspace or editor state; a renderer-only control would be unavailable at startup choice screens and would retain the persistent in-app UI being removed.
- Use the Electron app version for the Info dialog and provide a fixed office.md GitHub repository action that opens through Electron's external-link API. This keeps the displayed version aligned with the installed package and avoids making arbitrary renderer-provided URLs open externally.
- On **Update...**, query the public GitHub Releases API for the fixed office.md repository and build a version list from published stable tags. Include a tag only when it has the current platform and architecture's installer and matching update metadata; omit the installed version, drafts, prereleases, and incomplete releases. This keeps the choices limited to releases the updater can verify and install.
- Use a modal version picker launched from **Update...** rather than adding every release as a permanent menu item. After the user selects a version, point the existing updater at that tag's release directory and load its platform metadata. Revalidate the tag and the metadata's version, installer name, and SHA-512 before download. Permit a downgrade only in this explicit, manually selected flow; installation still requires a separate confirmation.
- After consent, download the selected release through the existing updater and install when complete. Declining performs no download or install. Report an empty release list, lookup failures, and updater errors through the modal or a native dialog.
- Remove the startup call to the update service, the renderer notification mount and markup, and the update API from the editor window's preload. Keep update discovery and operations in the main process, and exercise user decisions through injectable menu, dialog, and update seams.

Alternatives considered: retaining a compact renderer banner would still make update state a persistent editor concern; adding every release as a menu item would clutter Help as release history grows; bypassing the update metadata and running downloaded installers directly would discard the existing updater's integrity and platform-specific installation handling.

## Risks / Trade-offs

- **Native menu and dialog behavior can vary by operating system** → use Electron's cross-platform menu and dialog APIs and verify the supported packaged Windows and Linux flows.
- **A long download has less visual progress detail than the existing banner** → mark the menu update action busy during the check/download and report completion or failure through a native dialog.
- **Some historical releases lack updater metadata or a platform installer** → omit them from the version picker; current releases with complete metadata remain selectable.
- **A selected older version may restore older bugs or security issues** → label the selected version clearly and require explicit confirmation before downloading it.
- **The repository link may be unavailable offline** → the Info dialog still shows the URL and installed version, and opening the link is a user-initiated system-browser action.

## Migration Plan

No user data migration is needed. Remove the automatic check and renderer notification in the application update; users will find version and update actions under **Help**. Rolling back the application restores the earlier update experience without changing workspace files or preferences.

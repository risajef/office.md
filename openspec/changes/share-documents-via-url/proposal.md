## Why

People need to pass either one document or a complete workspace to someone else. Web users need a self-contained URL, while packaged Electron users need a transportable archive because the local `file://` address cannot receive a shared link.

## What Changes

- Add `Share File` and `Share Workspace` actions.
- `Share File` uses portable Markdown, with resolvable includes and CSV-linked Mermaid values materialized, or CSV source that always preserves formulas.
- `Share Workspace` always lists every included relative path before sharing and preserves the workspace file tree, includes, and formulas.
- In the web app, either action creates a versioned self-contained URL payload. Try compression and use it only when the completed URL is shorter. Record whether the payload is compressed so it can be decoded reliably.
- Offer optional password protection for web links using Web Crypto AES-GCM with a PBKDF2-derived key. Keep the password out of the URL and ask recipients for it before showing the content.
- Warn when a web URL is longer than 8,000 characters, for either share mode, while allowing the user to continue and copy it.
- Limit decoded share payloads to 50 MiB to prevent excessive memory use.
- In packaged Electron, either action creates a ZIP archive instead of a URL. The file archive contains the portable Markdown or formula-preserving CSV; the workspace archive preserves the included workspace tree. Allow optional ZIP password protection, and let office.md open its versioned share archive directly.
- Open shares as isolated editable copies. Web recipients keep a separate local copy across reloads; changes do not write to another workspace or update the original share link.

## Capabilities

### New Capabilities

- `document-sharing`: Create and open standalone document and workspace shares as compressed or uncompressed web links, or package and open them as ZIP archives in Electron, with optional password protection.

### Modified Capabilities

- `workspace`: A valid web share URL or selected Electron share ZIP opens directly as an isolated copy instead of showing the normal folder-or-file startup choice.

## Impact

The renderer toolbar and startup flow in `index.html` and `src/main.ts`, document UI in `src/styles.css`, new share payload, compression, and encryption helpers, plus workspace startup behavior. The web app uses URL, compression, Web Crypto, and isolated browser storage. Electron needs ZIP creation/opening and an archive password option. No server API or online storage is introduced.

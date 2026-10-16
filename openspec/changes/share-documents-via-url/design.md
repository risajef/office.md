## Context

The app edits Markdown and CSV files inside a workspace. Markdown may include other Markdown and CSV files with `![[file]]`; portable Markdown materializes resolvable includes and CSV-linked Mermaid values. CSV source retains formulas while some export paths emit evaluated values. The workspace view also includes CSS and image files needed by rendered documents.

The web app runs over HTTP(S), and packaged Electron loads through `file://`. The app has no fragment router. A share URL can use the fragment so its content is not sent in routine HTTP requests, though it remains visible to the browser, page scripts, and anyone with the link.

## Goals / Non-Goals

**Goals:**

- Share either one portable Markdown document / formula-preserving CSV or all visible supported files in a workspace.
- Compare complete encoded web URLs and choose compression only if it shortens the result.
- Protect web links with Web Crypto and package Electron shares as optional password-protected ZIP files.
- Open received URLs and ZIPs as isolated editable copies, and preserve browser copies across reloads.

**Non-Goals:**

- Synchronize changes or store shared data on a service.
- Allow Electron to make receiver-accessible URLs.
- Automatically merge a shared copy into another opened workspace.

## Decisions

### Provide distinct file and workspace shares

The UI offers `Share File` and `Share Workspace`. File sharing includes the active editable Markdown or CSV, with unsaved in-app edits. Markdown uses the existing portable Markdown conversion, which materializes resolvable includes and CSV-linked Mermaid values; CSV always uses its current source, including formulas. The file share does not bundle images, CSS, or other workspace assets.

Workspace sharing serializes all visible supported workspace files and their relative paths, including Markdown, CSV, CSS, and image files, using current in-app content where there are unsaved edits. Hidden, ignored, unsupported, generated, and inaccessible content is excluded according to the existing workspace model. Always show the complete file path list before creating a workspace share. Do not show a file-count warning.

### Use a versioned URL-fragment envelope for web shares

Build a versioned share payload with a kind (`file` or `workspace`), a stable share identifier, document metadata, and file records. File records contain relative path, media type, and content. Text source is preserved as UTF-8; binary assets are represented in an encoding that can be reconstructed exactly. The payload never contains an absolute local path. For password-protected workspace links, keep all file names and contents inside ciphertext; expose only non-sensitive format metadata, a share identifier, and the data required to derive the key.

Create a URL from the current web app origin and path, discard unrelated query and fragment data, and store the share envelope in a `share` fragment. Read this fragment before normal workspace startup. Hosted HTTP(S) links work at the same app address; a localhost link only works for recipients who can reach that server.

### Compare complete encoded URL candidates

Serialize the share payload, gzip it, and build both complete URL candidates. Select gzip only if its final URL is shorter. Mark the compression state explicitly so decoding does not rely on heuristics. If Compression Streams is unavailable, create an uncompressed link and show a clear error only if asked to open a compressed link that cannot be decoded.

For password links, compress before encryption and compare the final URL lengths including ciphertext and envelope overhead. A web URL over 8,000 characters triggers a warning and a choice to continue or cancel, for either `Share File` or `Share Workspace`. It is never blocked solely by URL length. Limit the decoded share payload to 50 MiB and stop decompression at that boundary. The same 50 MiB uncompressed-content ceiling applies when opening Electron ZIPs.

### Use Web Crypto for protected web links

Use PBKDF2-HMAC-SHA-256 with 600,000 iterations and a fresh 16-byte random salt to derive a 256-bit AES-GCM key. Use a fresh 12-byte IV per encryption. Include the crypto profile in the versioned envelope and authenticate interpretation metadata, including the share identifier, as additional authenticated data. Keep the password in memory only, request confirmation when creating a password link, and prompt the recipient before decrypting or showing content. Wrong passwords and modified data produce the same clear decryption error.

Password links require a secure browser context (HTTPS or localhost). Plain links remain available without Web Crypto. This profile follows the current [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) guidance for PBKDF2-HMAC-SHA-256 and uses algorithms defined by the [W3C Web Cryptography specification](https://www.w3.org/TR/WebCryptoAPI/).

### Persist received copies separately from normal workspaces

A valid web share opens directly before the normal folder-or-file startup choice. Save its first decoded copy in IndexedDB, keyed by the share identifier. Reopening the same share resumes that recipient's saved copy; a different share gets a different local copy. This store is isolated from the disk-backed workspace write port, so edits cannot replace or write into an already-open workspace. If browser storage is unavailable or out of space, show that persistence failed and keep the copy available for the current session, with an option to export or share it.

For Electron, opening a shared ZIP creates or resumes an isolated copy in app-managed storage separate from user-selected workspaces. The app can edit it, share it again, or export it. It can never save those edits into the ZIP file or the currently open workspace.

### Create and open Electron ZIPs

Packaged Electron uses the same two share choices but creates a ZIP instead of a URL. A file ZIP contains one portable Markdown file or formula-preserving CSV. A workspace ZIP contains the reviewed files under their relative paths. Include a versioned hidden `.office-md-share.json` manifest that marks the archive kind and share identifier; disclose this metadata entry separately from the reviewed workspace file list. Generate archives and read received archives with `@zip.js/zip.js`. Save through an Electron file-save dialog exposed by the existing preload bridge. Add an `Open Share ZIP` option to the Electron file selection flow.

When a password is set, use WinZip AES-256 encryption for every file entry, including the manifest; the recipient must enter the password in office.md or use an archive utility that supports WinZip AES. Never add a plaintext password file to the archive. When opening, reject paths that are absolute or that escape the archive root, duplicate paths that conflict, unsupported formats, and archives exceeding 50 MiB of decoded content.

The library documents AES-256 WinZip AE-2 entries and support in Node.js and browsers: [zip.js documentation](https://gildas-lormeau.github.io/zip.js/). Archive protection is a ZIP-format operation and does not use the web-link AES-GCM envelope.

If a share is malformed, unsupported, too large, or cannot be decrypted, display a focused error and do not fall back to the previously selected workspace. Preserve the original web URL so it can be reopened; do not alter it as the recipient edits.

## Risks / Trade-offs

- **Plain links disclose all included content to anyone who receives them** → Label plain sharing clearly and offer password protection. A URL fragment avoids routine server request logging but is visible to browser history and page scripts.
- **Password-protected links can be guessed offline if the password is weak** → Use a slow PBKDF2 derivation, explain that the password must be communicated separately, and encourage a strong passphrase.
- **Large URLs may be truncated or rejected by messaging tools** → Warn above 8,000 characters, show the length, and allow the sender to continue or cancel.
- **A shared workspace may contain files the sender did not expect** → Always show every included relative path before creating the share.
- **AES-encrypted ZIPs are not supported by every built-in archive utility, and ZIP entry names remain visible** → Explain that office.md can open its own archives, external extraction requires WinZip AES support, and password protection encrypts file contents but does not conceal paths.
- **Browser storage can be cleared or run out of space** → Keep the active copy usable in memory and let the recipient export or share changes.
- **Older links and archives may become unreadable as formats evolve** → Version the web envelope and retain decoders for supported versions; use ordinary ZIP structures for Electron output.
- **Unbounded decompression risks memory exhaustion** → Enforce a 50 MiB decoded-data limit while streaming decompression and archive reads.

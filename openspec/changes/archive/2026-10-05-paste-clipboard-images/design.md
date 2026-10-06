## Context

See [proposal.md](proposal.md) for the motivation and [the delta specs](specs/) for the user-visible contract. The editor already renders workspace image files and can insert references to them. File drops currently insert data URLs, while workspace backends expose text writes only. The web runtime has a local filesystem bridge and a browser folder-access fallback; Electron uses a separate filesystem bridge.

## Goals / Non-Goals

**Goals:**

- Route image clipboard data through a workspace operation that writes image bytes beside the active Markdown document.
- Reuse the existing relative image reference and rendering path after the write succeeds.
- Keep the operation safe across each disk-backed workspace backend and refresh the workspace view so the new image is available immediately.

**Non-Goals:**

- Change toolbar insertion of remote or already-existing image paths.
- Change how ordinary text and HTML clipboard content is pasted.
- Add image editing, compression, or conversion.

## Decisions

### Intercept only supported image clipboard data in the Markdown editor

Handle paste at the editor boundary, identify a supported image blob from the clipboard, and leave the event to Milkdown for ordinary clipboard data. Capture the editor insertion bookmark before starting asynchronous file I/O so the reference returns to the paste location even if the write takes time. The inserted node continues to serialize as standard Markdown and uses the existing workspace image resolver.

Using an embedded data URL would avoid filesystem work, but would not create the adjacent reusable image file requested by the user. Pasting into CSV or handling arbitrary clipboard content is outside this change.

### Save through a workspace image operation that returns the actual path

Extend the workspace port with an image-byte save operation scoped to the active document's directory. It chooses a visible, supported image filename from the clipboard name when available or a `pasted-image` fallback, adds a numeric suffix on collisions, writes without replacing an existing entry, and returns the final workspace-relative path. The editor inserts a reference derived from that returned path only after the write succeeds.

Name allocation belongs with each backend's write operation rather than relying only on the editor's cached file list. This avoids replacing a file created after the snapshot was loaded. The operation must validate the path and image type using the same workspace safety rules as other mutations.

### Implement the operation for each disk-backed runtime

The local development bridge gets a binary image-write route; browser folder access writes bytes through the selected directory handle; Electron exposes the corresponding validated operation through its existing preload/IPC boundary. Keep the memory backend aligned for tests. Each implementation updates or refreshes the workspace snapshot after a successful save so the new asset appears in the file view and can be resolved by the editor.

A shared UI-only write path would not work because the three runtimes have different filesystem access boundaries. Embedded data URLs were also considered, but would bypass workspace safety and persistence.

### Do not change the document when an image write fails

If clipboard data cannot be read, the workspace write fails, or no unique path can be created, report the error through the existing status surface and leave the Markdown document unchanged. If a backend fails after creating an incomplete target, remove that partial file before returning the failure.

## Risks / Trade-offs

- Clipboard implementations may expose different image MIME types or omit a filename. → Accept only image types supported by the workspace, derive the extension from the MIME type, and use the fallback filename when the clipboard has no usable name.
- An image could be written successfully while insertion fails because the editor is no longer editable. → Validate the active Markdown editor before writing and retain a stable selection bookmark for the asynchronous operation; report a clear error if insertion cannot complete.
- Browser folder permissions can be revoked during a write. → Treat permission and I/O failures as save failures and do not insert a reference.
- A newly created asset could remain after a later document autosave failure. → Keep asset creation independent and atomic; the image remains a valid workspace file that the user can insert again.

## Migration Plan

No migration is needed. Existing Markdown image references and embedded data URLs remain readable. Rollback consists of removing the paste handler and image-byte write operation; files already saved by users remain normal workspace images.

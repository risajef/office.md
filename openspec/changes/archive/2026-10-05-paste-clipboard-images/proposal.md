## Why

Pasting an image into a Markdown document should create a durable image file and a usable Markdown reference. Today, image drops can become embedded data URLs and clipboard image paste has no workspace-file flow, leaving images difficult to manage and share with the document.

## What Changes

- Save pasted clipboard images beside the active Markdown document, then insert a relative Markdown image reference at the current editor selection.
- Choose a unique filename when the suggested image name already exists; preserve the existing file.
- Support the disk-backed workspace runtimes, and report a save failure without inserting a broken reference.
- Leave ordinary text paste and existing toolbar image insertion behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown`: define how pasted clipboard images are saved and inserted into the active document.
- `workspace`: define safe persistence of pasted image bytes in the document's directory across disk-backed workspace runtimes.

## Impact

The editor paste handling and image insertion path in `src/main.ts` will change. Workspace ports and their web, browser-folder, and Electron backends will need a binary image write operation; the local filesystem bridge and workspace file snapshots will need to recognize newly created image files. Editor and workspace specifications will be updated, with browser-level coverage for paste behavior and persistence.

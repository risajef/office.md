## 1. Workspace Image Writes

- [x] 1.1 Add failing public workspace-port tests for saving exact image bytes in a requested nested folder and preserving existing files on name collisions; verify the new contract tests fail before implementation.
- [x] 1.2 Add binary image saving to the local filesystem bridge and verify route tests cover exact bytes, safe paths, and no-overwrite behavior.
- [x] 1.3 Add binary image saving to the browser folder-access backend and verify backend tests cover nested document directories, byte preservation, and filename collisions.
- [x] 1.4 Add validated image saving to the Electron workspace service and preload/IPC API; verify service and bridge tests cover exact bytes, collision-safe naming, and rejection of unsafe targets.
- [x] 1.5 Update workspace snapshots after successful writes and verify saved images appear in the workspace file view and resolve through the existing image asset path.

## 2. Markdown Clipboard Paste

- [x] 2.1 Add a failing editor-level paste test using a real temporary nested workspace; verify it expects the pasted file beside the active Markdown file, a relative Markdown reference at the paste selection, and a rendered saved image.
- [x] 2.2 Handle supported clipboard image data in the Markdown editor, save it through the workspace image operation, and insert the reference at the captured editor selection; verify the editor-level paste test passes.
- [x] 2.3 Add failing tests for filename collisions, image-write failure, and ordinary text paste; implement the corresponding behavior and verify existing files stay unchanged, failed saves leave Markdown unchanged, and text paste still works.
- [x] 2.4 Run `npm test`, `npm run test:e2e`, `npm run build`, and `npm run spec:validate`; verify all supported runtime backends satisfy the image-save contract and the browser paste scenario passes end to end.

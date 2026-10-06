## ADDED Requirements

### Requirement: Save pasted image assets safely

The system SHALL let a disk-backed workspace save supported image bytes at a relative path within the workspace. The operation SHALL reject paths that escape the workspace, hidden paths, and unsupported image files, and the saved image SHALL become available as a workspace image. If a target path already exists, the operation SHALL save under another unique filename without replacing the existing file.

#### Scenario: A pasted image is saved in the workspace

- **WHEN** the editor saves a supported image to an unused visible workspace path
- **THEN** the exact image bytes are written within the workspace and the image appears in the workspace file view

#### Scenario: An image write targets an existing file

- **WHEN** an image write targets a path that already exists
- **THEN** the operation saves the image under another unique filename and leaves the existing file unchanged

#### Scenario: An image write targets an unsafe path

- **WHEN** an image write contains path traversal or a hidden path segment
- **THEN** the operation is rejected without writing outside the workspace or to the hidden path

#### Scenario: An image write is unavailable in a workspace runtime

- **WHEN** a supported image is pasted into a disk-backed workspace runtime
- **THEN** the runtime provides the same safe image-save behavior as the other disk-backed workspace runtimes

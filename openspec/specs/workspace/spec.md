# Workspace Specification

## Purpose

Describe how office.md opens a folder as a visible, disk-backed document project and safely manages its files and folders.

## Requirements

### Requirement: Show supported workspace content

The system SHALL show visible Markdown, CSV, CSS, and supported image files from the selected workspace, while excluding hidden paths, unsupported files, binary content, `.git`, `node_modules`, and generated `dist` content.

#### Scenario: Nested supported files are visible

- **WHEN** a selected workspace contains supported files inside visible nested folders
- **THEN** the files and their folder paths appear in the workspace file view

#### Scenario: Hidden and unsupported content is ignored

- **WHEN** a selected workspace contains hidden paths, dependency or generated directories, and unsupported file types
- **THEN** that content does not appear in the workspace file view

### Requirement: Browse the workspace hierarchy

The system SHALL let the user see, open, and collapse visible folders and select files from the hierarchy.

#### Scenario: A folder is expanded

- **WHEN** the user opens a visible folder in the file view
- **THEN** its nested folders and supported files become available without flattening away their paths

#### Scenario: A new folder is created

- **WHEN** the user creates a valid folder within the workspace
- **THEN** the folder is created on disk and appears in the file view

### Requirement: Support local and browser-backed folder access

The system SHALL use the local development filesystem bridge when available, SHALL use the Electron desktop filesystem capability in the desktop target, and SHALL fall back to the browser's supported local folder access when the bridge is unavailable in the web target.

#### Scenario: A local disk path is opened

- **WHEN** the user supplies a valid local, Windows, or WSL-style folder path while running the local application
- **THEN** the application opens the corresponding workspace and reports disk-backed access

#### Scenario: The local bridge is unavailable

- **WHEN** the application is hosted without the local bridge and the browser supports folder access
- **THEN** the user can open a workspace through the browser folder picker

#### Scenario: An Electron workspace is opened

- **WHEN** the user opens a valid local folder in the Electron target
- **THEN** the application opens the corresponding disk-backed workspace and exposes the same workspace browsing and mutation rules as the web target

### Requirement: Choose a workspace or editable file at startup

The system SHALL ask the user to open a folder or an editable Markdown or CSV file at every app launch unless a valid document share link is present. In packaged Electron, the file selection flow SHALL also allow the user to open a shared ZIP archive. When a valid share link or ZIP archive is opened, the system SHALL open its content directly as a separate isolated copy without restoring a previous workspace. In all other cases, the system SHALL not restore and activate a previous workspace before the user makes this choice. Folder and file selection SHALL start at the most recently selected location: the selected folder, or the containing folder of the selected file. If that location is unavailable, selection SHALL use the host's normal starting location.

#### Scenario: The app starts with a previous workspace available

- **WHEN** the app starts after a workspace was previously opened and no valid share link is present
- **THEN** the folder-or-file choice appears before the previous workspace is opened, and the selection starts at the most recently selected location

#### Scenario: The user cancels startup selection

- **WHEN** the user cancels the folder or file selection
- **THEN** the app remains at the startup choice without opening a previously selected workspace

#### Scenario: The previous selection location is unavailable

- **WHEN** the most recently selected location no longer exists or cannot be accessed
- **THEN** the folder or file selector starts at the host's normal starting location

#### Scenario: A valid share link is present at startup

- **WHEN** the app starts with a valid document share link
- **THEN** the shared document opens directly as an isolated copy and the previous workspace remains unchanged

#### Scenario: The user opens a shared ZIP in Electron

- **WHEN** the user selects a supported share ZIP in packaged Electron
- **THEN** the app opens its file or workspace as an isolated copy and the previous workspace remains unchanged

### Requirement: Keep startup selection actions unavailable until ready

The system SHALL keep the startup folder and file actions disabled until it can process their requests. Once enabled, activating an action SHALL begin the corresponding selection flow.

#### Scenario: Startup choice is visible while the application initializes

- **WHEN** the startup choice is visible before its selection actions can be handled
- **THEN** the folder and file actions remain disabled until the application is ready

#### Scenario: User activates a ready startup selection action

- **WHEN** the user activates the folder or file action after it becomes enabled
- **THEN** the corresponding selection flow begins and is not silently ignored

### Requirement: Open an editable file together with its parent workspace

The system SHALL let the user select Markdown and CSV files through Open File. The selection SHALL exclude other workspace file types. When a file is selected, the system SHALL open its parent folder as the workspace and activate the selected file.

#### Scenario: The user opens a Markdown or CSV file

- **WHEN** the user selects a supported Markdown or CSV file through Open File
- **THEN** the file's parent folder opens as the workspace and the selected file becomes the active document

#### Scenario: The user opens a file from a nested folder

- **WHEN** the user selects a supported Markdown or CSV file inside a nested folder
- **THEN** the file's immediate parent folder opens as the workspace and the selected file becomes active within that folder

### Requirement: Choose the first editable file when opening a folder

When a selected folder contains an editable Markdown or CSV file, the system SHALL activate the first such file in the workspace file view's visible order. If the folder contains no editable Markdown or CSV file, the system SHALL open the workspace without an active document.

#### Scenario: A folder contains multiple editable files

- **WHEN** the user opens a folder containing Markdown and CSV files
- **THEN** the first Markdown or CSV file in the workspace file view's visible order becomes active

#### Scenario: A folder contains no editable files

- **WHEN** the user opens a folder containing no Markdown or CSV files
- **THEN** the folder opens as the workspace without an active document

### Requirement: Persist and reload document changes

The system SHALL persist edits in a disk-backed workspace, provide Store as an explicit immediate save, and let Reload discard cached content and reread the workspace from disk.

#### Scenario: An editor change is persisted

- **WHEN** the user edits an open Markdown or CSV document in a disk-backed workspace
- **THEN** the updated source is written to the corresponding workspace file

#### Scenario: External changes are reloaded

- **WHEN** a workspace file changes outside the editor and the user selects Reload
- **THEN** the editor and file view reflect the current disk contents instead of the cached document

### Requirement: Perform safe workspace mutations

The system SHALL create, rename, and delete supported files and empty folders without overwriting existing entries or escaping the selected workspace.

#### Scenario: A file is renamed

- **WHEN** the user renames a supported file to a valid unused path
- **THEN** its contents are preserved at the new path and the old path no longer exists

#### Scenario: A rename would overwrite an entry

- **WHEN** the requested destination already exists
- **THEN** the operation is rejected and both source and destination contents remain unchanged

#### Scenario: A path escapes the workspace

- **WHEN** a file or folder operation contains traversal or a hidden path segment
- **THEN** the operation is rejected without writing outside the selected workspace

#### Scenario: A non-empty folder is deleted

- **WHEN** the user tries to delete a folder that still contains an entry (hidden or not)
- **THEN** the operation is rejected and the folder remains intact

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

### Requirement: Reflect external workspace changes while open

The system SHALL detect visible filesystem changes while a disk-backed workspace is open in Electron, the local filesystem bridge, and browser folder access. While the application window is visible, within five seconds of a change, the workspace view SHALL reflect visible files and folders added, renamed, or removed, and cached content for modified files. When the application window becomes visible, the system SHALL refresh the workspace immediately. A newly added document SHALL NOT become active automatically. A clean active Markdown or CSV document changed on disk SHALL update from disk and the application SHALL notify the user. Monitoring failures SHALL NOT interrupt editing or discard cached content, and monitoring SHALL resume when filesystem access returns.

#### Scenario: A document or folder is created outside office.md

- **WHEN** a visible supported document or folder is created in the open workspace
- **THEN** it appears in the workspace view within five seconds without changing the active document

#### Scenario: A workspace file is renamed or removed outside office.md

- **WHEN** a visible supported file is renamed or removed in the open workspace
- **THEN** the workspace view reflects the removed path and any new visible path within five seconds

#### Scenario: A clean active document changes outside office.md

- **WHEN** an active Markdown or CSV document with no unsaved local edits changes on disk
- **THEN** the editor displays the disk contents within five seconds and the user sees that the document was updated externally

#### Scenario: A non-active document changes outside office.md

- **WHEN** a workspace document that is not active changes on disk
- **THEN** its cached contents are refreshed so opening it or using it as an include reads the disk contents without reloading the workspace

#### Scenario: Filesystem monitoring temporarily fails

- **WHEN** the runtime cannot read the workspace during a background refresh
- **THEN** editing remains available, cached workspace content is preserved, and monitoring retries after access returns

#### Scenario: The application returns to the foreground

- **WHEN** the application window becomes visible after a workspace file changed while it was hidden
- **THEN** the workspace refreshes immediately and reflects the current disk contents

### Requirement: Preserve and resolve conflicting document changes

When a document has unsaved local edits and its disk contents change or the file is removed externally, the system SHALL preserve the local editor contents and SHALL NOT overwrite either version automatically. The system SHALL visibly identify the affected document and offer explicit per-document actions to use the disk version or keep the local version. Choosing either action SHALL resolve only that document's conflict.

#### Scenario: The active document changes externally while local edits are unsaved

- **WHEN** the runtime detects an external change to a document with unsaved local edits
- **THEN** the editor keeps the local contents, leaves the disk contents unchanged, and presents actions to use the disk version or keep the local version

#### Scenario: The user chooses the disk version

- **WHEN** the user chooses to use the disk version for a conflicted document
- **THEN** that document's editor contents are replaced by the latest disk contents, or the document is closed if it was removed, and the conflict is cleared

#### Scenario: The user keeps the local version

- **WHEN** the user chooses to keep the local version for a conflicted document
- **THEN** that document's local contents are written to disk and the conflict is cleared

#### Scenario: An external deletion conflicts with local edits

- **WHEN** a document with unsaved local edits is removed from disk outside office.md
- **THEN** the local editor contents remain available and the user can explicitly recreate the file from the local version or discard it

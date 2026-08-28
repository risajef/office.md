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

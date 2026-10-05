## ADDED Requirements

### Requirement: Choose a workspace or editable file at startup
The system SHALL ask the user to open a folder or an editable Markdown or CSV file at every app launch. It SHALL not restore and activate a previous workspace before the user makes this choice. Folder and file selection SHALL start at the most recently selected location: the selected folder, or the containing folder of the selected file. If that location is unavailable, selection SHALL use the host's normal starting location.

#### Scenario: The app starts with a previous workspace available
- **WHEN** the app starts after a workspace was previously opened
- **THEN** the folder-or-file choice appears before the previous workspace is opened, and the selection starts at the most recently selected location

#### Scenario: The user cancels startup selection
- **WHEN** the user cancels the folder or file selection
- **THEN** the app remains at the startup choice without opening a previously selected workspace

#### Scenario: The previous selection location is unavailable
- **WHEN** the most recently selected location no longer exists or cannot be accessed
- **THEN** the folder or file selector starts at the host's normal starting location

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

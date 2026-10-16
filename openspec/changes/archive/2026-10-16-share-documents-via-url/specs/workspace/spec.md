## MODIFIED Requirements

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

## Purpose

Provide a reusable, independently selected source of CSS document themes that remains separate from the workspace containing the document being edited.

## ADDED Requirements

### Requirement: Select an independent style folder

The system SHALL let the user select one style folder independently from the opened document workspace and SHALL discover its visible CSS files as available document themes.

#### Scenario: A style folder is selected while a workspace is open

- **WHEN** the user selects a valid style folder while a document workspace is open
- **THEN** the folder's visible CSS files appear in the style-theme choices and the current document workspace, open file, and document source remain unchanged

#### Scenario: A style folder contains mixed and nested content

- **WHEN** the selected style folder contains visible CSS files in nested folders alongside non-CSS files and hidden paths
- **THEN** only the visible CSS files are listed with their relative paths and unsupported or hidden content is ignored

#### Scenario: A style folder contains no usable CSS files

- **WHEN** the user selects a folder that contains no visible CSS files
- **THEN** the style choices show an explicit empty state and the opened document workspace remains usable

#### Scenario: Style-folder selection is cancelled or rejected

- **WHEN** the user cancels selection or the requested folder cannot be read
- **THEN** the current style source and document workspace remain unchanged and the user receives an actionable status message

### Requirement: Keep the style folder separate from the document workspace

The system SHALL treat CSS files from the selected style folder as read-only theme sources and SHALL not expose them as document-workspace files, Markdown include sources, or targets of workspace create, rename, delete, or save operations.

#### Scenario: An external CSS file is available as a theme

- **WHEN** a visible CSS file is discovered in the selected style folder
- **THEN** the user can apply it as a document theme while it remains absent from the document workspace file view

#### Scenario: A workspace operation targets an external CSS file

- **WHEN** the user performs a document-workspace save or mutation after selecting an external style folder
- **THEN** the operation affects only the opened document workspace and leaves the external CSS file unchanged

#### Scenario: The style source is switched

- **WHEN** the user selects a different style folder or chooses a workspace CSS theme after using an external theme
- **THEN** the previous external theme is no longer active and the newly selected source is applied without changing the document source

### Requirement: Handle an unavailable style folder

The system SHALL report when the selected style folder or an active external CSS file is no longer readable, remove unavailable external choices, and keep the document workspace available for editing.

#### Scenario: The selected style folder is removed

- **WHEN** the selected style folder no longer exists or becomes inaccessible during a reload or style operation
- **THEN** the application clears the unavailable external choices, reports that the style folder must be selected again, and does not discard document edits

#### Scenario: The active external theme is removed

- **WHEN** the active external CSS file is no longer available
- **THEN** the application removes that theme from the rendered document and returns to the normal document styling or another currently selected workspace theme

### Requirement: Remember the last style-folder location in Electron

The Electron target SHALL remember the last successfully selected style-folder location and SHALL attempt to restore it on the next application launch.

#### Scenario: The last style folder is restored

- **WHEN** the user has selected a readable style folder in Electron and starts Electron again
- **THEN** the application restores that folder, discovers its visible CSS files, and makes them available without requiring selection again

#### Scenario: The remembered style folder is unavailable

- **WHEN** the remembered location no longer exists or cannot be read at Electron startup
- **THEN** the application clears the unusable remembered location, keeps the editor usable, and prompts the user to select a style folder again

#### Scenario: A new Electron selection replaces the remembered location

- **WHEN** the user successfully selects a different style folder in Electron
- **THEN** the new location becomes the one attempted on the next launch

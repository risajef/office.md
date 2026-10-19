## MODIFIED Requirements

### Requirement: Preserve startup workspace selection across runtime targets

The system SHALL provide the folder-or-file startup choice in every supported web and Electron runtime. In the web target, the startup choice SHALL additionally offer an action to start an empty project stored in browser storage. The desktop Electron target SHALL require selecting a disk-backed workspace or file (or opening a shared ZIP archive) and SHALL NOT offer the empty browser-stored workspace action. Each runtime SHALL let the user open a Markdown or CSV file with its immediate parent folder as the workspace and the selected file active, while preserving the same resulting workspace and active-file behavior.

#### Scenario: A file is opened in a supported runtime

- **WHEN** the user selects a supported Markdown or CSV file in a supported web or Electron runtime
- **THEN** that runtime opens the parent workspace and activates the selected file

#### Scenario: A folder is opened in a supported runtime

- **WHEN** the user opens the same folder through a supported web or Electron runtime
- **THEN** the first editable Markdown or CSV file in the workspace file view's visible order becomes active, or no document is active if the folder contains none

#### Scenario: Startup in the web target offers an empty project option

- **WHEN** the application starts in the web target
- **THEN** the startup screen presents the option to start a new empty project stored in browser storage alongside the folder and file selection options

#### Scenario: Startup in the Electron target omits the empty browser project option

- **WHEN** the application starts in the desktop Electron target
- **THEN** the startup screen does not display the option to start an empty browser-only project


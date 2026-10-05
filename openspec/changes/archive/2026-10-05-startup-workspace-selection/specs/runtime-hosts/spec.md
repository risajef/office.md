## ADDED Requirements

### Requirement: Preserve startup workspace selection across runtime targets
The system SHALL provide the folder-or-file startup choice in every supported web and Electron runtime. Each runtime SHALL let the user open a Markdown or CSV file with its immediate parent folder as the workspace and the selected file active, while preserving the same resulting workspace and active-file behavior.

#### Scenario: A file is opened in a supported runtime
- **WHEN** the user selects a supported Markdown or CSV file in a supported web or Electron runtime
- **THEN** that runtime opens the parent workspace and activates the selected file

#### Scenario: A folder is opened in a supported runtime
- **WHEN** the user opens the same folder through a supported web or Electron runtime
- **THEN** the first editable Markdown or CSV file in the workspace file view's visible order becomes active, or no document is active if the folder contains none

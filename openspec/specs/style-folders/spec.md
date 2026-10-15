# style-folders Specification

## Purpose

Provide a reusable, independently selected source of CSS document themes that remains separate from the workspace containing the document being edited.

## Requirements

### Requirement: Keep the style folder separate from the document workspace

The system SHALL keep CSS from the styles folder separate from the document workspace, include sources, and workspace mutations. The application SHALL read these files as document-theme sources and SHALL NOT edit them through document-workspace actions. In Electron, users may edit the app-managed styles folder outside office.md.

#### Scenario: An external CSS file is available as a theme

- **WHEN** a visible CSS file is discovered in the app-provided style library
- **THEN** the user can apply it as a document theme while it remains absent from the document workspace file view

#### Scenario: A workspace operation targets an external CSS file

- **WHEN** the user performs a document-workspace save or mutation after the app-provided styles are loaded
- **THEN** the operation affects only the opened document workspace and leaves the styles folder unchanged

#### Scenario: The style source is switched

- **WHEN** the user selects a workspace CSS theme after using a style-library theme, or selects a style-library theme after using a workspace CSS theme
- **THEN** the newly chosen theme is applied without changing the document source or removing themes from either source

### Requirement: Handle an unavailable style folder

The system SHALL keep the document workspace usable if the Electron app-managed styles folder is unavailable. It SHALL retain the bundled themes as a read-only fallback and report that the managed folder could not be opened. When an active style-library CSS file becomes unavailable, the system SHALL remove it from the rendered document and return to the normal document styling or a currently selected workspace theme.

#### Scenario: The selected style folder is removed

- **WHEN** the Electron app-managed styles folder no longer exists or cannot be read during startup or refresh
- **THEN** the document workspace remains usable, bundled read-only themes remain available, and the user receives an actionable status message

#### Scenario: The active external theme is removed

- **WHEN** the active CSS file is removed from the Electron styles folder and the application refreshes the folder
- **THEN** the theme is removed from the style choices and rendered document, and the application returns to normal document styling or another currently selected workspace theme

#### Scenario: A styles-folder refresh fails

- **WHEN** the Electron app cannot read its managed styles folder while refreshing it
- **THEN** the last known theme choices and document styling remain available, the user receives a status message, and the application retries when office.md next regains focus

### Requirement: Provide the developed styles in production builds

Production builds SHALL include the developed CSS themes as a style library that remains available independently of the opened document workspace. The hosted web build SHALL expose the bundled styles as read-only themes and SHALL NOT offer a control to select or open a style folder.

#### Scenario: The user opens a document workspace

- **WHEN** the user opens a document workspace in a production web or Electron build
- **THEN** the developed styles remain available in the Styles section alongside any CSS themes from the workspace

#### Scenario: The user views styles in the hosted web build

- **WHEN** the hosted web build displays the Styles section
- **THEN** the bundled developed styles are available to apply, and no style-folder selection or file-manager action is offered

### Requirement: Use an app-managed Electron styles folder

The Electron target SHALL create and automatically select a writable styles folder under app-managed user data. It SHALL initialize the folder with shipped CSS files without overwriting existing files, and SHALL add any shipped CSS files missing from the folder when the app starts. The Styles section SHALL offer an action to open this folder in the system file manager and SHALL NOT offer a style-folder chooser.

#### Scenario: Electron starts without an app-managed styles folder

- **WHEN** the user launches Electron for the first time
- **THEN** the app creates the styles folder, copies in the shipped CSS files, and makes those files available without asking the user to select a folder

#### Scenario: Electron starts with an existing styles folder

- **WHEN** the user launches Electron after editing or adding CSS files in the app-managed folder
- **THEN** existing files and user-added files are preserved, missing shipped CSS files are added without overwriting existing files, and the folder is automatically selected

#### Scenario: The user opens the Electron styles folder

- **WHEN** the user activates the Styles section's open-folder action
- **THEN** the system file manager opens the app-managed styles folder

### Requirement: Refresh Electron themes when the app regains focus

The Electron target SHALL refresh the app-managed styles folder when its window regains focus. New or modified visible CSS files SHALL update the style choices, changes to the active CSS file SHALL update the rendered document theme, and removed files SHALL be removed from the style choices.

#### Scenario: The user adds or changes CSS outside office.md

- **WHEN** the user adds a visible CSS file or edits an existing file in the app-managed folder while office.md is unfocused, then returns to office.md
- **THEN** the new or changed theme is available, and an active theme reflects its latest CSS contents

#### Scenario: The active CSS file is removed outside office.md

- **WHEN** the user removes the active CSS file while office.md is unfocused, then returns to office.md
- **THEN** the removed theme is no longer available and the rendered document returns to normal styling or a currently selected workspace theme

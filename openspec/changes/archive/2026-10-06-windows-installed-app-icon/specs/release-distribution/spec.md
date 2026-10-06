## MODIFIED Requirements

### Requirement: Published packages launch the Electron application

Each published package SHALL contain the production renderer and Electron desktop shell required to launch office.md on its target x64 platform without the repository checkout or a separately installed Node.js runtime.

#### Scenario: A user launches the Linux download

- **WHEN** a user downloads the published x64 Linux AppImage and launches it on a compatible Linux desktop
- **THEN** the office.md Electron application opens and provides its supported desktop workspace experience

#### Scenario: A user installs the Windows download

- **WHEN** a user runs the published x64 Windows installer and starts the installed application
- **THEN** the office.md Electron application opens and provides its supported desktop workspace experience

#### Scenario: An installed Windows application uses the office.md icon

- **WHEN** a user installs the published x64 Windows package and views or launches office.md from the Windows shell
- **THEN** the installed application and its Windows Start menu shortcut display the office.md icon

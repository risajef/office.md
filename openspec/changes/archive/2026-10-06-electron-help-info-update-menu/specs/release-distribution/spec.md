## ADDED Requirements

### Requirement: Show application information in Electron Help

The Electron application SHALL provide an **Info** action in its **Help** menu. The information shown SHALL include the installed application version and a link to the office.md GitHub repository.

#### Scenario: The user opens application information

- **WHEN** the user selects **Info** from the Electron **Help** menu
- **THEN** the information dialog shows the installed version and the office.md GitHub repository link

#### Scenario: The user follows the GitHub link

- **WHEN** the user activates the repository link from the information dialog
- **THEN** the office.md GitHub repository opens in the system's default browser

### Requirement: Check and install Electron updates on demand

The Electron application SHALL provide an **Update...** action in its **Help** menu. It SHALL look up releases only after the user selects this action, SHALL let the user choose a published stable release with update metadata and an installer for the current platform and architecture, and SHALL ask before downloading the selected release. The choices SHALL include compatible releases older or newer than the installed version, but SHALL exclude the installed version, drafts, prereleases, and releases without compatible update metadata and an installer. The application SHALL not show a persistent in-application update notification.

#### Scenario: The application starts while other releases are available

- **WHEN** the Electron application launches while another compatible release exists
- **THEN** it does not check for updates automatically or show an update notification in the editor

#### Scenario: The user opens the version picker

- **WHEN** the user selects **Update...**
- **THEN** the application lists compatible published stable releases other than the installed version, including older and newer versions

#### Scenario: No other compatible release is available

- **WHEN** the user selects **Update...** and no other compatible release is available
- **THEN** the application reports that no other compatible version is available

#### Scenario: The user selects a release version

- **WHEN** the user selects a listed version
- **THEN** the application identifies that exact version and asks whether to download and install it

#### Scenario: The user declines an available update

- **WHEN** the user declines the update prompt
- **THEN** the application does not download or install the update and continues running

#### Scenario: The user accepts the selected version

- **WHEN** the user accepts the prompt for the selected version
- **THEN** the application downloads that exact release and installs it when the download completes, restarting as needed

#### Scenario: The user selects an older release

- **WHEN** the user selects a compatible release older than the installed version and accepts its confirmation prompt
- **THEN** the application installs the selected older release and restarts as needed

#### Scenario: Release lookup fails

- **WHEN** the user selects **Update...** and release lookup fails
- **THEN** the application reports the failure and remains available for normal use

#### Scenario: Updates are unavailable in the current Electron runtime

- **WHEN** the user selects **Update...** in an unpackaged or unsupported runtime
- **THEN** the application reports that updates are unavailable for this installation and does not download or install an update

## Purpose

This capability lets packaged Electron users discover newer stable releases and update through a visible, user-controlled process without interrupting the current workspace.

## ADDED Requirements

### Requirement: Detect newer compatible stable releases

The packaged Electron application SHALL check the configured GitHub Releases source after startup and when the user requests a manual check. It SHALL report only a stable release that is newer than the running version and has an artifact compatible with the current supported platform and architecture. Development, unpackaged, and automated test runs SHALL not perform network update checks.

#### Scenario: A newer release exists

- **WHEN** a packaged x64 Linux or Windows application checks GitHub Releases and a newer stable compatible release is available
- **THEN** the application reports that an update is available and identifies the newer version

#### Scenario: No newer release exists

- **WHEN** the update check finds no stable compatible release newer than the running version
- **THEN** the application reports that it is up to date and does not start an update download

#### Scenario: The application is not packaged

- **WHEN** the application runs in development, an unpackaged Electron session, or an automated test mode
- **THEN** it does not contact the update provider or show a false update state

### Requirement: Present observable update status

The Electron application SHALL expose update status to the user, including checking, update available, downloading with progress, downloaded and ready to install, up to date, and error states. An update error SHALL offer a retry path when retrying is meaningful and SHALL not hide the existing editor experience.

#### Scenario: An update is available

- **WHEN** the update check finds a newer compatible release
- **THEN** the desktop UI shows the available version and an action to start its download or postpone the update

#### Scenario: An update is downloading

- **WHEN** the user has confirmed an available update and bytes are being downloaded
- **THEN** the desktop UI shows that the update is downloading and reports its progress

#### Scenario: The update check or download fails

- **WHEN** the provider is unavailable, the network request fails, or the download cannot complete
- **THEN** the desktop UI shows an actionable error and the user can continue using the current application

### Requirement: Require confirmation before download and installation

The application SHALL not download or install an update without an explicit user action. After an update has downloaded successfully, the application SHALL offer a controlled restart or quit flow to install it and SHALL allow the user to postpone that restart.

#### Scenario: The user postpones an available update

- **WHEN** an update is available and the user chooses to postpone it
- **THEN** no update download starts, the current application remains open, and the user can check again later

#### Scenario: The user confirms the download

- **WHEN** the user explicitly starts downloading an available update
- **THEN** the application downloads the compatible release and, after completion, offers installation by restarting or quitting

#### Scenario: The user postpones installation

- **WHEN** an update is downloaded and ready but the user chooses to continue working
- **THEN** the current application remains usable and the update is not installed until the user starts the controlled restart/quit flow

#### Scenario: The user confirms installation

- **WHEN** the user confirms the controlled restart/quit flow for a downloaded update
- **THEN** the application closes or restarts, installs the downloaded release, and starts the updated Electron application

### Requirement: Preserve the current application when an update is unsafe or unavailable

The update process SHALL verify that release metadata and the downloaded artifact match the expected compatible release before installation. If verification fails, the network is unavailable, or an update is interrupted, the application SHALL keep the current version runnable, SHALL not modify workspace files, and SHALL allow a later retry.

#### Scenario: Release metadata is invalid

- **WHEN** the provider returns missing, malformed, incompatible, or integrity-check-failing update metadata
- **THEN** the application rejects the update, reports an error, and does not install it

#### Scenario: The network is unavailable at startup

- **WHEN** the packaged application cannot reach GitHub Releases during its startup check
- **THEN** the current editor opens normally, no workspace content changes, and the update status can be retried later

### Requirement: Publish updater metadata with supported release packages

The release process SHALL publish the platform-specific updater metadata required to discover and validate each supported Linux AppImage and Windows NSIS package alongside the corresponding GitHub Release. Metadata and packages SHALL refer to the same stable application version.

#### Scenario: A supported release is published

- **WHEN** a stable release is published for the supported x64 Linux and Windows targets
- **THEN** the GitHub Release contains each platform package and its matching updater metadata so a packaged application can discover that release

#### Scenario: Package and metadata versions differ

- **WHEN** updater metadata identifies a different application version than its package or release tag
- **THEN** the release is rejected by the update process and is not offered for installation

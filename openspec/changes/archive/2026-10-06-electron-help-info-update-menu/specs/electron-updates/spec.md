## MODIFIED Requirements

### Requirement: Detect newer compatible stable releases

The packaged Electron application SHALL query the configured GitHub Releases source only after the user requests **Help > Update...**. It SHALL list published stable releases that have valid update metadata and an artifact compatible with the current supported platform and architecture. The list SHALL include releases older or newer than the running version and SHALL exclude the running version, drafts, prereleases, and incompatible or incomplete releases. Development, unpackaged, and automated test runs SHALL not perform network update checks.

#### Scenario: A newer release exists

- **WHEN** a packaged x64 Linux or Windows application checks GitHub Releases and a newer stable compatible release is available
- **THEN** the application lists that release and identifies its version in the version picker

#### Scenario: No newer release exists

- **WHEN** the release list has no stable compatible version other than the running version
- **THEN** the application reports that no other compatible version is available and does not start a download

#### Scenario: The user opens the version picker

- **WHEN** a packaged x64 Linux or Windows user selects **Help > Update...**
- **THEN** the application lists all other published stable releases with matching platform and architecture metadata, including older and newer versions

#### Scenario: Incomplete and unstable releases exist

- **WHEN** GitHub Releases contains drafts, prereleases, or releases without matching update metadata and a compatible artifact
- **THEN** the application omits those releases from the version picker

#### Scenario: The application launches while another release exists

- **WHEN** a packaged application launches while another compatible release is published
- **THEN** it does not contact GitHub Releases or display an update notification

#### Scenario: The application is not packaged

- **WHEN** the application runs in development, an unpackaged Electron session, or an automated test mode
- **THEN** it does not contact the update provider or show a false update state

### Requirement: Present observable update status

The Electron application SHALL expose update discovery and installation status in a temporary version picker or update dialog opened from **Help > Update...**, including release choices, lookup progress, download progress, installation, and errors. It SHALL not show a persistent in-editor update notification. An update error SHALL offer a retry path when retrying is meaningful and SHALL not hide the existing editor experience.

#### Scenario: An update is available

- **WHEN** a release lookup finds another stable compatible version
- **THEN** the temporary update window shows available versions and lets the user choose one

#### Scenario: An update is downloading

- **WHEN** the user has selected and confirmed a release and its bytes are being downloaded
- **THEN** the temporary update window shows the selected version and download progress

#### Scenario: The user selects a release version

- **WHEN** the user selects a listed version
- **THEN** the application identifies that exact version and asks whether to download and install it

#### Scenario: The update check or download fails

- **WHEN** release lookup fails or a selected release cannot be downloaded
- **THEN** the temporary update window shows an actionable error and the user can continue using the current application

#### Scenario: The selected release is being installed

- **WHEN** the selected release finishes downloading
- **THEN** the update window reports that installation is starting before the application restarts to install it

### Requirement: Require confirmation before download and installation

The application SHALL not download or install a release until the user selects a specific compatible version and confirms the installation prompt for that version. After confirmation, the application SHALL download that exact release and install it by restarting when the download completes. Declining SHALL leave the current application running without downloading or installing the release.

#### Scenario: The user postpones an available update

- **WHEN** the user closes the version picker or declines the confirmation prompt for a selected version
- **THEN** no update download starts, the current application remains open, and the user can check again later

#### Scenario: The user confirms the download

- **WHEN** the user selects a specific compatible version and confirms its installation prompt
- **THEN** the application downloads that exact release and installs it by restarting after completion

#### Scenario: The user postpones installation

- **WHEN** the user declines the selected release's confirmation prompt before download begins
- **THEN** the application does not download or install the release, and the current application remains usable

#### Scenario: The user confirms installation

- **WHEN** the user confirms the installation prompt for a selected release before its download begins
- **THEN** the application downloads that exact version, then closes or restarts to install it

#### Scenario: The user selects and confirms an older release

- **WHEN** the user selects a compatible version older than the running version and confirms the prompt identifying it as an older version
- **THEN** the application downloads and installs that older version, restarting as needed

### Requirement: Preserve the current application when an update is unsafe or unavailable

The update process SHALL verify that the selected release metadata and downloaded artifact match the expected release version, platform, architecture, and integrity hash before installation. If verification fails, release lookup fails, the network is unavailable, or a download is interrupted, the application SHALL keep the current version runnable, SHALL not modify workspace files, and SHALL allow a later retry.

#### Scenario: Release metadata is invalid

- **WHEN** the selected release has missing, malformed, incompatible, or integrity-check-failing update metadata
- **THEN** the application rejects the release, reports an error, and does not install it

#### Scenario: The network is unavailable at startup

- **WHEN** the packaged application starts while GitHub Releases is unavailable and the user later requests **Help > Update...**
- **THEN** the current editor remains usable, workspace content remains unchanged, and the update window reports the failure and allows a later retry

#### Scenario: The network is unavailable during a user-requested update

- **WHEN** the packaged application cannot reach GitHub Releases after the user requests an update
- **THEN** the current editor remains usable, workspace content remains unchanged, and the user can retry later

#### Scenario: The selected release download is interrupted

- **WHEN** the selected release download is interrupted or fails
- **THEN** the application keeps the current version runnable, does not modify workspace files, and allows a later retry

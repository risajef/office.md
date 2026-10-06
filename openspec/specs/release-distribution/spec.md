# release-distribution Specification

## Purpose

This capability makes the Electron desktop application available as downloadable, versioned Linux and Windows packages through GitHub Releases.

## Requirements

### Requirement: Build platform packages for version tags

The release pipeline SHALL run for a stable semantic-version tag in the form `vMAJOR.MINOR.PATCH` and SHALL build one x64 Linux AppImage and one x64 Windows NSIS installer for the Electron application. The package version SHALL equal the version in the tag, and each artifact name SHALL identify the application, version, platform, and architecture.

#### Scenario: A matching version tag is pushed

- **WHEN** tag `v1.2.3` is pushed and the application package version is `1.2.3`
- **THEN** the pipeline produces `office.md-1.2.3-linux-x64.AppImage` and `office.md-1.2.3-windows-x64.exe`

#### Scenario: A non-release ref is pushed

- **WHEN** a branch, pull request, or tag that does not match `vMAJOR.MINOR.PATCH` is pushed
- **THEN** this release pipeline does not publish a GitHub Release or release assets

#### Scenario: The tag and package versions differ

- **WHEN** a matching version tag is pushed but its version does not equal the application package version
- **THEN** the pipeline fails before publishing a GitHub Release

### Requirement: Gate publication on validation and complete packaging

The release pipeline SHALL pass the repository's relevant tests, production builds, Electron build, and OpenSpec validation before publishing. It SHALL collect successful Linux and Windows packages before publication and SHALL not expose a published release containing only a subset of the required platform assets.

#### Scenario: Repository validation fails

- **WHEN** a required test, production build, Electron build, or specification validation command fails
- **THEN** the release pipeline fails and does not publish the tagged release

#### Scenario: One platform package fails

- **WHEN** the Linux or Windows packaging job fails for a valid version tag
- **THEN** the release is not published and no incomplete release is made available for download

### Requirement: Publish both packages to a GitHub Release

After all release checks and packaging jobs succeed, the pipeline SHALL create a published GitHub Release for the exact version tag and attach both platform packages as downloadable release assets. Re-running the pipeline for the same tag SHALL replace matching generated assets rather than create a second release for that tag.

#### Scenario: A release completes successfully

- **WHEN** validation passes and both platform packages are available for tag `v1.2.3`
- **THEN** the GitHub Release for `v1.2.3` is published and its assets include the Linux AppImage and Windows installer

#### Scenario: A release is retried

- **WHEN** the release pipeline is run again for an existing version tag
- **THEN** the corresponding GitHub Release is updated with the generated platform assets and no duplicate release for the tag is created

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

## ADDED Requirements

### Requirement: Authorize Electron renderer capabilities

The Electron shell SHALL authorize workspace, style and share IPC only from its main application frame at the trusted application URL, block arbitrary renderer navigation and popups, and open only HTTP(S) external links in the system browser.

#### Scenario: A child or foreign frame requests disk access

- **WHEN** IPC comes from a subframe, another window or a navigated untrusted document
- **THEN** the shell rejects the request before executing the operation

#### Scenario: A document opens a link

- **WHEN** renderer navigation or a new window targets an HTTP(S) external URL
- **THEN** the shell cancels renderer navigation and opens the URL in the system browser

#### Scenario: A document requests a custom protocol

- **WHEN** a link uses a non-HTTP(S) protocol
- **THEN** the shell blocks it without invoking an external application

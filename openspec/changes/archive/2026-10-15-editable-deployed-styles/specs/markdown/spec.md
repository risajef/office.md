## MODIFIED Requirements

### Requirement: Apply document-only CSS themes
The system SHALL apply a selected document CSS file from the opened workspace or app-provided style library to the rendered document, including document, heading, code, and diagram typography, without changing the surrounding application chrome.

#### Scenario: A document theme is selected
- **WHEN** the user applies a visible CSS theme from the workspace
- **THEN** the document presentation changes and the theme selectors are scoped to the document surface

#### Scenario: An app-provided style theme is selected
- **WHEN** the user applies a visible CSS theme from the app-provided style library
- **THEN** the document presentation changes with the same document-only scoping and the surrounding application chrome remains unchanged

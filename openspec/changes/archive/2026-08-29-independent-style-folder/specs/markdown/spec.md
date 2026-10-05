## MODIFIED Requirements

### Requirement: Apply document-only CSS themes

The system SHALL apply a selected document CSS file from either the opened workspace or the independently selected style folder to the rendered document, including document, heading, code, and diagram typography, without changing the surrounding application chrome.

#### Scenario: A document theme is selected

- **WHEN** the user applies a visible CSS theme from the workspace
- **THEN** the document presentation changes and the theme selectors are scoped to the document surface

#### Scenario: An independent style theme is selected

- **WHEN** the user applies a visible CSS theme from the selected independent style folder
- **THEN** the document presentation changes with the same document-only scoping and the surrounding application chrome remains unchanged

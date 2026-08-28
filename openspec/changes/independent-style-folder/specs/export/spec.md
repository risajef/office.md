## MODIFIED Requirements

### Requirement: Create standalone HTML

The system SHALL export a standalone HTML document containing the current rendered content, the active document style from either the document workspace or the independent style folder, and one export page for each layout page, without editor-only controls.

#### Scenario: HTML export contains included content

- **WHEN** the current document has a resolved include
- **THEN** the exported HTML contains the rendered included content but not its editor-only include header or remove control

#### Scenario: HTML export contains page dimensions

- **WHEN** the document is exported from a paged layout
- **THEN** the HTML declares the selected page dimensions and separates forced pages for screen and print output

#### Scenario: HTML export contains an active external style

- **WHEN** the document uses a CSS theme from the independent style folder
- **THEN** the standalone HTML contains the active document styling and does not depend on the external style-folder path at render time

### Requirement: Print the document as PDF

The system SHALL open the browser print flow using the standalone document export, including an active style from the document workspace or independent style folder, so the user can choose Save as PDF, and SHALL clean up the temporary print surface afterward.

#### Scenario: Print export is invoked

- **WHEN** the user chooses the PDF/print export
- **THEN** the browser print dialog is invoked with the document content and the temporary print frame is removed when printing completes or times out

#### Scenario: Print export uses an external style

- **WHEN** the document uses a CSS theme from the independent style folder and the user chooses PDF/print export
- **THEN** the print surface contains the active document styling without requiring the external style folder to remain mounted in the print surface

# Export Specification

## Purpose

Describe exports that turn the current rendered document or spreadsheet into portable files and printable output.

## Requirements

### Requirement: Create portable Markdown

The system SHALL export Markdown with resolvable Markdown includes recursively materialized and CSV-linked Mermaid values materialized into native Mermaid syntax.

#### Scenario: A nested include is exported

- **WHEN** an included Markdown file contains another resolvable include
- **THEN** the portable output contains the nested content and no live include marker for either resolved file

#### Scenario: An include is unresolved or cyclic

- **WHEN** an include cannot be resolved or would recurse into an ancestor file
- **THEN** the marker is preserved and export completes without infinite recursion

#### Scenario: CSV-backed Mermaid is exported

- **WHEN** a document contains a Mermaid block linked to a resolvable CSV file
- **THEN** the portable output contains a normal Mermaid block with the CSV values materialized and no live `mermaid(file.csv)` data-source marker

### Requirement: Create standalone HTML

The system SHALL export a standalone HTML document containing the current rendered content, active document styles, and one export page for each layout page, without editor-only controls.

#### Scenario: HTML export contains included content

- **WHEN** the current document has a resolved include
- **THEN** the exported HTML contains the rendered included content but not its editor-only include header or remove control

#### Scenario: HTML export contains page dimensions

- **WHEN** the document is exported from a paged layout
- **THEN** the HTML declares the selected page dimensions and separates forced pages for screen and print output

### Requirement: Print the document as PDF

The system SHALL open the browser print flow using the standalone document export so the user can choose Save as PDF, and SHALL clean up the temporary print surface afterward.

#### Scenario: Print export is invoked

- **WHEN** the user chooses the PDF/print export
- **THEN** the browser print dialog is invoked with the document content and the temporary print frame is removed when printing completes or times out

### Requirement: Export evaluated CSV

The system SHALL download a CSV representation whose formula cells contain evaluated results rather than formula expressions.

#### Scenario: A formula is exported

- **WHEN** an edited spreadsheet containing a formula is exported as CSV
- **THEN** the downloaded file contains the evaluated value and does not contain the source formula for that cell

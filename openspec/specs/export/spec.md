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

The system SHALL export a standalone HTML document containing the current rendered content, the active document style from the document workspace or app-provided style library, and one export page for each layout page, without editor-only controls.

#### Scenario: HTML export contains included content

- **WHEN** the current document has a resolved include
- **THEN** the exported HTML contains the rendered included content but not its editor-only include header or remove control

#### Scenario: HTML export contains page dimensions

- **WHEN** the document is exported from a paged layout
- **THEN** the HTML declares the selected page dimensions and separates forced pages for screen and print output

#### Scenario: HTML export contains an active style-library theme

- **WHEN** the document uses a CSS theme from the app-provided style library
- **THEN** the standalone HTML contains the active document styling and does not depend on the style-library path at render time

### Requirement: Print the document as PDF

The system SHALL open the browser print flow using the standalone document export, including an active style from the document workspace or app-provided style library, so the user can choose Save as PDF, and SHALL clean up the temporary print surface afterward.

#### Scenario: Print export is invoked

- **WHEN** the user chooses the PDF/print export
- **THEN** the browser print dialog is invoked with the document content and the temporary print frame is removed when printing completes or times out

#### Scenario: Print export uses a style-library theme

- **WHEN** the document uses a CSS theme from the app-provided style library and the user chooses PDF/print export
- **THEN** the print surface contains the active document styling without requiring the style library to remain mounted in the print surface

### Requirement: Export evaluated CSV

The system SHALL download a CSV representation whose formula cells contain evaluated results rather than formula expressions.

#### Scenario: A formula is exported

- **WHEN** an edited spreadsheet containing a formula is exported as CSV
- **THEN** the downloaded file contains the evaluated value and does not contain the source formula for that cell

### Requirement: Keep exported styling inert

The system SHALL preserve theme styling without interpreting theme text as HTML, and SHALL disable scripts in standalone exports and print previews.

#### Scenario: A theme contains HTML closing tags

- **WHEN** a theme contains mixed-case style closing tags followed by script markup
- **THEN** export preserves the CSS string and creates no injected HTML elements

#### Scenario: Print an untrusted document

- **WHEN** the print surface loads document content
- **THEN** scripts are disabled while the application can invoke the print dialog

### Requirement: Package local images in standalone exports

The system SHALL embed local workspace images into standalone HTML and print exports so they remain viewable after the application session ends. Remote HTTP(S) images SHALL retain their external URLs and SHALL not be fetched during export. Required local image failures SHALL stop export with an explanatory error.

#### Scenario: Export a workspace image

- **WHEN** a rendered document uses a blob or local filesystem bridge image
- **THEN** the exported image contains its own data URL and loads in a fresh browser context

#### Scenario: Export a remote image

- **WHEN** a document references a remote HTTP(S) image
- **THEN** export preserves the URL without requesting its bytes

#### Scenario: A local image cannot be read

- **WHEN** a required workspace image is unavailable during export
- **THEN** export fails clearly without producing a broken standalone file

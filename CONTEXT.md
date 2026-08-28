# Domain glossary

This glossary captures the terms used by office.md. It intentionally describes product concepts, not implementation details.

## Workspace

A folder opened as a small document project. It contains visible Markdown, CSV, CSS, and image files plus visible folders. Generated, hidden, unsupported, and dependency content is outside the workspace view.

## Markdown document

An editable document whose source uses Markdown and whose rendered form supports rich text, tables, code, LaTeX, Mermaid, images, and linked includes.

## Include

A `![[file]]` reference that places content from another Markdown or CSV file into the current Markdown document. An include is a linked piece of document content, not a copied code block.

## CSV spreadsheet

An editable rectangular table stored as CSV. A cell may contain a formula: the source keeps the formula while the spreadsheet can show its evaluated result.

## CSV-linked Mermaid diagram

A Mermaid diagram that names a CSV data source. Cell references and supported row or column ranges in the diagram are resolved from that source for rendering and portable export.

## Document style

A CSS theme associated with the rendered document. It controls document presentation, including page, heading, code, and diagram typography, without changing the surrounding application interface.

## Layout mode

The presentation of a document as continuous content, paged document, or presentation. Paged modes use page dimensions and margins; a thematic break can request a forced page break.

## Store and Reload

Store is an explicit request to persist the current editor state. Reload discards the cached project state and reads the selected workspace from disk again.

## Portable Markdown

An export form of Markdown in which resolvable includes and CSV-linked Mermaid values are materialized so the document can be used without the live workspace links.

## Local filesystem bridge

The local development access path that lets a disk-backed workspace be opened and mutated by the application. When it is unavailable, supported browsers can use their local folder-access capability instead.

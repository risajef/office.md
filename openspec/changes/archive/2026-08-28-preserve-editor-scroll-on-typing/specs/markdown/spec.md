## MODIFIED Requirements

### Requirement: Edit and render rich Markdown

The system SHALL let the user edit Markdown and render headings, lists, links, images, tables, checklists, code blocks, LaTeX, and Mermaid content in the document surface. Ordinary text input SHALL preserve the current viewport while the caret remains visible, and SHALL reveal the caret when an edit moves it outside the visible editor viewport.

#### Scenario: Source edits rerender the document

- **WHEN** the user changes the Markdown source and commits the edit
- **THEN** the rendered document reflects the new content without replacing the surrounding editor workspace

#### Scenario: A code block language is changed

- **WHEN** the user changes a code block's programming-language label
- **THEN** the rendered block and serialized Markdown use the new language label

#### Scenario: Typing in a visible line preserves the viewport

- **WHEN** the user types ordinary text while the caret is already inside the visible editor viewport
- **THEN** the editor keeps the current scroll position and does not reposition the active line at the bottom of the window

#### Scenario: Enter reveals the newly active line when needed

- **WHEN** the user presses Enter and the new caret position is outside the visible editor viewport
- **THEN** the editor scrolls only far enough to reveal the new active line

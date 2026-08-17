# A small Markdown studio

This is the live feature tour. Everything in this document is editable. Use
the toolbar, the outline, the file actions, and CSS files to explore the editor
without leaving this page.

## Rich text

Try **bold**, *italic*, ~~strikethrough~~, `inline code`, and this [Milkdown
link](https://milkdown.dev). Select text to open the floating toolbar, or use
the persistent toolbar above the document.

> The editor keeps the Markdown underneath the rendered document. Use “Copy
> markdown” to take the source with you.

## Lists and tables

- [x] Rich text marks and links
- [x] Undo and redo
- [ ] Add your own next step

1. Choose a block.
2. Format it with the toolbar.
3. Keep writing.

| Feature | Markdown | Renderer |
| --- | --- | --- |
| Code | Fenced block | Prism |
| Formula | Dollar delimiters | KaTeX |
| Diagram | Mermaid block | Mermaid |

## Code

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("Milkdown"))
```

## LaTeX

Inline math stays in the sentence: $E = mc^2$.

$$
\int_{0}^{\infty} e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}
$$

Click a formula to edit only its expression.

## Mermaid

Click the diagram preview to edit its source. The editor intentionally shows
only the Mermaid source; the surrounding Markdown code fence is preserved by
the document, not copied into the diagram.

```mermaid
flowchart LR
  idea[Idea] --> write[Write]
  write --> edit[Edit]
  edit --> share[Share]
```

## CSV-backed Mermaid

Open `csv-folder-demo/graph.csv` in the Files panel. The spreadsheet lets you
edit the CSV, **Insert table** adds its current contents as a Markdown table,
and **Linked Mermaid** creates a live diagram. CSV cell references such as
`A2` and `B2` become labelled Mermaid nodes, so changing the spreadsheet
updates the diagram preview.

```mermaid(csv-folder-demo/graph.csv)
flowchart LR
  A2 --> B2
  A3 --> B3
  A4 --> B4
```

**CSV → diagram** makes a portable one-time flowchart from the first two CSV
columns when a live template is not needed.

## CSV-backed plots

Open `csv-folder-demo/plot.csv` in the Files panel to try a linked Mermaid
plot. CSV ranges expand inside Mermaid's native `xychart-beta` syntax. A
range can point to either a CSV row or column.

```mermaid(csv-folder-demo/plot.csv)
xychart-beta
  title "Visitors and signups"
  x-axis [A2:A7]
  y-axis "Count" 0 --> 250
  %% Visitors
  line [B2:B7]
  %% Signups
  line [C2:C7]
```

The `%%` comments name each line; the linked Mermaid expansion adds that name
to the first point in the rendered diagram.

Change `line` to `bar`, edit the CSV, or point a series at a horizontal range
such as `line [B2:G2]` to explore the linked chart.

## Linked Markdown

The Include buttons in the Files panel insert live links. Try including
`notes.md` or `snippets.md`, then edit that file and switch back here.

![[notes.md]]

## Try the workspace

- Click a heading in the Outline to jump through this document.
- Create and rename browser-local files with the Files panel.
- Open `examples/local-folder-demo` with **Open folder** to edit real files.
- Open `examples/css-folder-demo` with **CSS folder**, then click a CSS file to
  load a custom theme.

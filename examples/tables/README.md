# CSV workspace demo

Open `graph.csv` in the editor's Files panel to edit it as a spreadsheet.

- **Insert table** adds the CSV as a Markdown table.
- **Mermaid** can create a normal diagram or link one to a selected CSV. A
  linked template keeps the filename in the code fence, for example
  `mermaid(graph.csv)`.
- **Export** creates portable Markdown with the references replaced by their
  current values. CSV export replaces formulas with their calculated values.

In a linked diagram, bare cell references such as `A2` and `B2` are labelled
from the current CSV values whenever the diagram is rendered.

`plot.csv` demonstrates linked Mermaid `xychart-beta` blocks. CSV ranges such
as `A2:A7` expand to their cell values inside `x-axis`, `line`, and `bar`
expressions. A `%%` comment before a line gives its first point a visible
label.
Ranges may run vertically or horizontally.

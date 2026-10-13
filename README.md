# YAAS (Yet Another Advanced Slides)

Turn any Obsidian note into full-screen slides.

- Split slides with a line of `---`
- Pick colours and themes per deck or per slide, from a side panel
- Diagrams (Mermaid) and code fit the slide by themselves
- Present in Obsidian or in your browser, or export a PDF to share

Works on Obsidian desktop (Windows, macOS, Linux).

## Install

In Obsidian: **Settings → Community plugins → Browse**, search for **YAAS**, then **Install** and **Enable**.

## Quick start

1. Write a note, with `---` between slides:

   ```markdown
   # Hello

   My first slide.

   ---

   ## Second slide

   - **Bold text** is highlighted
   - So are bullets
   ```

2. Click the **presentation icon** in the left ribbon to open the slides panel.
3. Click **Present**. Use the arrow keys to move, and **Esc** to stop.

## Learn more

- [Writing slides](docs/writing-slides.md): colours, images, layouts, code and diagrams
- [The slides panel](docs/slides-panel.md): themes, colours and per-slide settings without editing text
- [Presenting](docs/presenting.md): keys, speaker notes and the browser preview
- [Exporting](docs/exporting.md): PDF and HTML files to share
- [Settings and styling](docs/settings.md): defaults, and how to change the look
- [Development](docs/development.md): building and releasing the plugin

## Privacy

YAAS sends nothing over the internet. The browser preview runs a small server on your own computer only (`localhost`). [Details](docs/presenting.md#privacy).

## License

[MIT](LICENSE) © ervinismu

# YAAS (Yet Another Advanced Slides)

An Obsidian plugin that presents the open note as full-screen slides, split on `---`, with colours, images and layouts per slide. It has a slides panel with colour themes and live previews, a live preview in your browser, and export to a landscape PDF or a single HTML file. Slides have a soft, vintage cyberpunk finish; Mermaid diagrams and code fit the slide by themselves.

Desktop only (Windows, macOS, Linux). No build step: `main.js`, `styles.css` and `manifest.json` are the plugin.

## Install
- **From Obsidian**: Settings › **Community plugins** › *Browse* › search for **YAAS** › *Install*, then *Enable*.
- **By hand**: download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/ervinismu/yaas/releases/latest) into `<your vault>/.obsidian/plugins/yaas/`, then in Settings › **Community plugins** turn off *Restricted mode* if it is on and switch on **YAAS (Yet Another Advanced Slides)**.

## Present
Open a note, then **Present** in the slides panel (the presentation icon in the left ribbon), or the command palette (Ctrl/Cmd+P) › **YAAS (Yet Another Advanced Slides): Present this note**.

| Key | Does |
| --- | --- |
| → ↓ Space PageDown, or click the right of the screen | Next slide |
| ← ↑ PageUp, or click the left third | Previous slide |
| Home / End | First / last slide |
| N | Show or hide the speaker notes |
| Esc | Leave full screen and stop |

While a slide is shown, the next and previous ones are already being prepared, diagrams and code included, so moving on is instant.

## The slides panel
The **presentation icon** in the left ribbon, or command palette › **YAAS: Open the slides panel**. It sits in the right sidebar and follows the note you have open:

- **The top line**: the note's name, **Present**, then two icons: open in the browser, and export a PDF.
- **Deck colours**, on one line: the **theme** button, then three round swatches for background, text and highlight, for every slide. Hover a swatch to see what it colours. They are written to the note's properties (`slide-bg`, `slide-text`, `slide-accent`). A faded swatch is the colour from the YAAS settings; ↺ goes back to those.
- **Theme**: a list where every theme is shown in its own colours (its name in its text colour, on its background, with a dot of its highlight); choosing one sets background, text and highlight together. Arrow keys move through it, Esc closes it: Paper, Bubblegum, Lemonade, Lime, Mint pop, Sky candy, Peach fizz, Tangerine (bright), and Watermelon, Grape soda, Ocean, Neon night (bold). The button shows the theme in use the same way, or *Own colours*. Every theme keeps its text and highlight readable on its background.
- **The three colours**, and what each one is for:
  - **Background**: the whole slide, under the soft gradient.
  - **Text**: headings, body text, tables, and the text and lines of diagrams. The main reading colour.
  - **Highlight**: only what should stand out: **bold text**, bullets and numbers, links, the slide number, the progress line and diagram boxes. Pick one clearly different from the text colour and readable on the background, or bold text will not stand out.
- **Clicking a swatch** opens ready-made colours for that job: candy and bold colours for a background; for text and highlight, colours *On candy* and *On bold*, each readable on every background in its group. *Custom colour…* opens the full picker.
- **Every slide as its own framed card**, top to bottom: a line with its **number**, title, a dot when it has its own settings, and a **cog**; then its live preview (click it to present from that slide); then, when the cog is open, its settings, inside the same frame. The cards sit in as many columns as the panel has room for, at least 200 px wide each, and the previews grow and shrink with them. Previews are drawn as they scroll into view and without the grain, so long decks stay quick to scroll. The cog (or anywhere on the top line) opens only the settings that apply to that slide:
  - **Colours**, the same line as the deck's, for this slide only.
  - **Position**: *Middle* or *Top*.
  - **Layout** (only when the slide has an image in it): *In text*, *Image left* or *Image right*.
  - **Backdrop**: an image behind the whole slide; type a name or pick one from the vault. With an image: **Image fit** (*Fill* or *Whole*) and **Darken**.
  - **Reset this slide** clears all of its own settings.

  The panel writes the slide's `%% slide … %%` comment for you, and changes nothing else in the note.

## In the browser
**Open in browser** (panel, or command palette › *YAAS: Open this note in the browser*) starts a small web server inside Obsidian and opens the deck at `http://localhost:3939/…` in your computer's own browser (Firefox, Chrome…), not Obsidian's web viewer; the link is copied too.

- **Copy**: point at a code block or a diagram and a quiet copy icon shows: beside a diagram's top right corner (inside it when the diagram fills the slide), and in a code card's title row. A tick shows once it is copied. Code copies as plain text, a diagram as its Mermaid source (the text in the note), ready to paste into another note or mermaid.live. Only here: not when presenting in Obsidian, not in the exports.
- It **updates by itself** when you save the note. The same keys as in Obsidian, plus **F** for full screen; the slide number stays in the address (`#3`).
- **Only this computer** can open it: the server listens on 127.0.0.1, accepts only `localhost` as the host name, and every link carries a key that changes each time Obsidian starts. Old links stop working then: open the deck again from Obsidian.
- It serves notes and images from the vault, nothing else. Other people cannot see it, even on the same Wi-Fi.
- **YAAS: Stop the browser preview** stops the server; it also stops when Obsidian closes. The port is in Settings › YAAS. Desktop only.

## Export, to share with a client
**Export PDF** (panel, or command palette › *YAAS: Export this note as a PDF*) saves `<note name>.pdf` next to the note; a click on the notice shows it in your file manager.

- **Landscape, one slide per page**, 16:9 (20 × 11.25 in), with the colours and images exactly as on screen. Obsidian prints it itself in a hidden window, so no print settings can turn it portrait.
- **Speaker notes are left out.** They are for you, not the client.
- **Small files**: a PDF cannot hold blurs or generated textures, so on paper the grain is one small tile repeated (stored once) and code cards cast a hard shadow instead of a soft one. A deck is a few hundred KB, not a picture per page, and looks very close to the screen.
- Export again after changing the slides; it replaces the old file. It sits in the vault, so it is in git with the rest if you commit it. Desktop only.

**One HTML file** instead (command palette › *YAAS: Export this note as one HTML file*): the slides to click through in any browser, offline, images inside, no speaker notes. Use it when the client should present it themselves.

## Write a deck
The same markdown as Obsidian's own Slides, so a deck works in both:

- A line of only `---` starts a new slide (not inside a code block). The properties block at the top is not a slide.
- `%% … %%` comments are **speaker notes**: hidden on the slide, shown with **N**.
- A comment that starts with `slide` sets **that slide's colours**:
  `%% slide bg=#D01C7F text=#FFF3E2 accent=#FBEBB3 %%`
  Keys: `bg`, `text`, `accent` (the highlight: bold text, list numbers and bullets, links, the slide number; `highlight=` works too) and `align=left` to start at the top instead of the middle. Colours are hex, `rgb(…)`, `hsl(…)` or a colour name; anything else is ignored.
- **Images** go in the same `%% slide … %%` comment:
  - `image=[[lobby.jpg]]` fills the whole slide behind the text (also `image=lobby.jpg`, `image="Photos/My lobby.jpg"` or an `https://` address). Vault images are found the way `![[…]]` finds them; a missing one shows a notice and the slide keeps its colour.
  - `dim=0.4` lays black over that image, from `0` (none) to `1`, so text stays readable; pair it with `text=#FFF3E2`.
  - `layout=image-left` or `layout=image-right` puts the slide's **first image** (`![[…]]` in the slide) edge to edge in one half and the rest of the slide in the other.
  - `fit=contain` shows the whole picture instead of filling and cropping (`cover`, the default), for both. Use it for screenshots.
  - An image in the slide without `layout` simply sits in the text, up to 640 px tall.
- **Code blocks** sit on a dark terminal card (three dots on top), tinted by the slide's background, with their own neon colours that read on every theme: keywords pink, names yellow, strings mint, numbers blue, comments soft violet. Obsidian's copy button is hidden. Every card is at least 1200 px wide (of the 1920 px slide), however short its lines, so code slides look alike; wide code makes it wider, up to the slide's margins. Like a diagram, the card sits in the middle of the room left under the heading, both ways, and the code takes the largest size that still fits: short code grows (up to 56 px), long or wide code shrinks. Wide code shrinks only to 24 px: a line longer than that allows wraps onto the next lines instead, like word wrap in an editor, so it stays readable. Long code shrinks down to 20 px, the smallest still readable on a projector (about 20 lines under a heading). Code longer than that stays at 20 px and is cut off at the bottom, and the card says so: the last lines fade out above a small badge such as **↓ 12 more lines**, so nobody takes it for the end of the code. Split it over two slides to show it all. `Inline code` in a sentence is a small tinted chip.
- **Mermaid diagrams** (a ```` ```mermaid ```` block) take all the room left on the slide under the heading, scaled up or down to fit both its width and height, and centred. A wide flowchart fills the width; a tall sequence diagram fills the height. They take the slide's colours: text and lines in its text colour, boxes tinted with its highlight. They show the same in Obsidian, in the browser and in the exports.

  Example: `%% slide image=[[lobby.jpg]] dim=0.45 text=#FFF3E2 %%`, or a slide with `![[check-in.png]]` and `%% slide layout=image-right fit=contain %%`.
- **Colours for the whole deck** as note properties: `slide-bg`, `slide-text`, `slide-accent` (the highlight; `slide-highlight` works too).
- **Defaults for every deck** in Settings › YAAS (cream paper, ink and magenta), plus the font, the slide number, the progress line and the browser preview's port.

A slide's own colours win over the note's properties, which win over the settings.

The slides are a 1920×1080 stage scaled to the screen: `#` headings are 120 px, `##` 80 px, text 40 px. Change the look in `styles.css`.

Every slide has a vintage cyberpunk finish: soft glows in its highlight, violet, cyan and pink over the background colour, with grain and faint scanlines on top. In `styles.css`, `--ks-glow` sets how strong the glows are and `--ks-grain` the texture (now a light `.22`); `0` for both gives flat colours.

A thin **progress line** runs along the bottom edge of every slide, in the highlight colour, filled up to the slide you are on: in Obsidian, in the browser, and on every page of the PDF and HTML exports. Settings › YAAS › *Progress line* turns it off.

## Privacy and network use
YAAS sends nothing anywhere: no accounts, no telemetry, no requests to the internet.

- **Open in browser** starts a small web server inside Obsidian, on this computer only: it listens on `127.0.0.1` (port 3939 by default, changeable in the settings), accepts only `localhost`, and every link carries a key that changes each time Obsidian starts. It serves the open note's slides and the vault images they use, and stops when Obsidian closes or with **YAAS: Stop the browser preview**.
- **Export PDF** and **Export HTML** write files into your vault, next to the note.
- Slides may show images from `https://` addresses you put in a note; your browser or Obsidian loads those as usual.

## License
[MIT](LICENSE) © ervinismu

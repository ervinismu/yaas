# Presenting

## In Obsidian

Click **Present** in the slides panel, or run the command **Present this note**.

| Key | What it does |
| --- | --- |
| → ↓ Space Page Down, or click the right side | Next slide |
| ← ↑ Page Up, or click the left third | Previous slide |
| Home / End | First / last slide |
| N | Show or hide speaker notes |
| Esc | Stop |

The next and previous slides are prepared in the background, so moving on is instant.

## In your browser

Click 🌐 in the slides panel, or run **Open this note in the browser**. The deck opens in your usual browser, and the link is copied.

- It **updates by itself** when you save the note.
- Same keys as in Obsidian, plus **F** for full screen and **P** to print.
- Point at a code block or diagram to **copy** it: code as text, a diagram as its Mermaid source.

Run **Stop the browser preview** to stop it. It also stops when Obsidian closes.

## Privacy

YAAS sends nothing over the internet: no accounts, no tracking.

The browser preview runs a small web server inside Obsidian, for your computer only:

- It listens on `127.0.0.1` (port 3939 by default; change it in the [settings](settings.md)) and answers only to `localhost`.
- Every link has a secret key that changes each time Obsidian starts. Old links stop working.
- It only serves the open note's slides and the vault images they use.

Other people cannot see it, even on the same Wi-Fi.

What else YAAS touches, and why:

- **Your vault's file list**: only to show your images when you choose a backdrop in the slides panel.
- **The clipboard**: YAAS only writes to it, never reads it. It copies the preview link when you open the browser, and code or a diagram's source when you click a copy button.
- **Files**: exports are saved next to the note. A PDF export also writes a temporary page into YAAS's own plugin folder for a moment, then deletes it.

Slides can show pictures from `https://` links you put in a note; those load from the internet like any image.

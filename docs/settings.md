# Settings and styling

## Settings

**Settings → YAAS**:

| Setting | What it does |
| --- | --- |
| Background, Text, Highlight | Default colours for every deck |
| Font | A font installed on your computer. Empty: Obsidian's font |
| Slide number | Shows "3 / 7" in the corner |
| Progress line | A thin line along the bottom that fills up as you go |
| Port | The browser preview's port (default 3939) |

## Changing the look

Slides are a 1920 × 1080 stage, scaled to the screen. Headings are 120 px (`#`) and 80 px (`##`); text is 40 px.

The look lives in the plugin's `styles.css`. Two values control the vintage finish:

| Value | What it does | Default |
| --- | --- | --- |
| `--ks-glow` | Strength of the soft colour glows | `.35` |
| `--ks-grain` | Strength of the paper grain | `.22` |

Set both to `0` for flat colours. A [CSS snippet](https://help.obsidian.md/snippets) can override them without editing the plugin:

```css
.yaas-stage { --ks-glow: 0; --ks-grain: 0; }
```

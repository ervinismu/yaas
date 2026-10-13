# Development

YAAS follows the layout of the [Obsidian sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin): TypeScript in `src/`, bundled into `main.js` by esbuild.

## Setup

```bash
npm install
npm run dev     # rebuilds main.js on every change
npm run build   # type-checks and builds a minified main.js
npm run lint    # Obsidian's lint rules
```

To try it, put this folder (or a link to it) in a vault's `.obsidian/plugins/yaas/`, then reload Obsidian.

## Code map

| Path | What it holds |
| --- | --- |
| `src/main.ts` | The plugin: commands, ribbon icon, settings |
| `src/settings.ts` | Settings, defaults and the settings tab |
| `src/constants.ts` | Stage size, themes, swatches |
| `src/types.ts` | Shared types |
| `src/deck/parse.ts` | Splitting a note into slides, reading and writing `%% slide %%` comments |
| `src/render/slide.ts` | Rendering a slide off-screen, waiting for diagrams, fitting code |
| `src/ui/` | The stage, presenting, and the slides panel |
| `src/web/` | The browser page and the local preview server |
| `src/export/` | HTML and PDF export |
| `styles.css` | Every style, including the print rules for small PDFs |

## Releasing

1. `npm version patch` (or `minor`), which updates `manifest.json` and `versions.json`.
2. Push the commit and the tag: `git push --follow-tags`.
3. The **Release** workflow builds the plugin and creates a draft release with `main.js`, `manifest.json` and `styles.css`.
4. Review the draft on GitHub and publish it.

import { Component, MarkdownView, Notice, Platform, Plugin, TFile } from 'obsidian';
import { COLOR_KEYS, imageType, VIEW_TYPE } from './constants';
import { deckStyle, imageLink, isColor, mermaidSources, parseDeck, setStyleValue, STYLE_VALUES, writeSlideStyle } from './deck/parse';
import { exportHtml, exportPdf } from './export/export';
import { openExternal } from './export/electron';
import { arrange, renderSlide } from './render/slide';
import { DEFAULT_SETTINGS, YaasSettings, YaasSettingTab } from './settings';
import type { ColorKey, Colors, ResolvedStyle, SlideStyle, StyleKey, StylePatch, WebDeck } from './types';
import { YaasView } from './ui/panel';
import { Presentation } from './ui/presentation';
import { WebPreview } from './web/server';

export default class YaasPlugin extends Plugin {
	settings!: YaasSettings;
	presentation: Presentation | null = null;
	web!: WebPreview;
	private missing = new Set<string>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.web = new WebPreview(this);
		this.registerView(VIEW_TYPE, (leaf) => new YaasView(leaf, this));

		const withNote = (action: (file: TFile) => unknown) => (checking: boolean) => {
			const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
			if (!file) return false;
			if (!checking) void action(file);
			return true;
		};
		this.addCommand({ id: 'present', name: 'Present this note', checkCallback: withNote((file) => this.present(file)) });
		this.addCommand({ id: 'open-panel', name: 'Open the slides panel', callback: () => void this.openPanel() });
		this.addCommand({ id: 'export-html', name: 'Export this note as one HTML file', checkCallback: withNote((file) => exportHtml(this, file)) });
		if (Platform.isDesktopApp) {
			this.addCommand({ id: 'export-pdf', name: 'Export this note as a PDF', checkCallback: withNote((file) => this.exportPdf(file)) });
			this.addCommand({ id: 'open-browser', name: 'Open this note in the browser', checkCallback: withNote((file) => this.openInBrowser(file)) });
			this.addCommand({
				id: 'stop-browser',
				name: 'Stop the browser preview',
				callback: () => {
					this.web.stop();
					new Notice('Browser preview stopped.');
				},
			});
		}
		// One icon: the panel, where Present, Open in browser and every slide's settings are
		this.addRibbonIcon('presentation', 'Open the slides panel', () => void this.openPanel());
		this.registerEvent(this.app.vault.on('modify', (file) => { if (file instanceof TFile) this.web.changed(file); }));
		this.addSettingTab(new YaasSettingTab(this.app, this));
	}

	onunload(): void {
		this.presentation?.close();
		this.web.stop();
	}

	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<YaasSettings> | null) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** The colours every slide of a note starts from: the note's properties over the settings */
	baseStyle(file: TFile): Colors {
		const own = deckStyle(this.app.metadataCache.getFileCache(file)?.frontmatter);
		return { bg: own.bg ?? this.settings.bg, text: own.text ?? this.settings.text, accent: own.accent ?? this.settings.accent };
	}

	async present(file: TFile, start = 0): Promise<void> {
		this.presentation?.close();
		const slides = parseDeck(await this.app.vault.cachedRead(file));
		if (!slides.length) {
			new Notice('This note has no slides.');
			return;
		}
		this.presentation = new Presentation(this, file, slides, this.baseStyle(file), start);
		this.presentation.open();
	}

	async openPanel(): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
			await leaf?.setViewState({ type: VIEW_TYPE, active: true });
		}
		if (leaf) await this.app.workspace.revealLeaf(leaf);
	}

	async openInBrowser(file: TFile): Promise<void> {
		if (!this.web.running) {
			try {
				await this.web.start();
			} catch {
				new Notice(`Port ${this.settings.port} is in use. Choose another one in the plugin settings.`);
				return;
			}
		}
		const url = this.web.url(file);
		// The computer's own browser, not Obsidian's web viewer: full screen, a second screen and Print work there
		if (!openExternal(url)) window.open(url);
		navigator.clipboard.writeText(url).catch(() => { /* the link opened anyway */ });
		new Notice('Opened in your browser. The link is copied too.');
	}

	exportPdf(file: TFile): Promise<string | null> {
		return exportPdf(this, file);
	}

	// The panel writes a slide's styling comment; null or "" removes that key
	async setSlideStyle(file: TFile, index: number, patch: StylePatch): Promise<void> {
		await this.app.vault.process(file, (text) => {
			const slide = parseDeck(text)[index];
			if (!slide) return text;
			const style: SlideStyle = { ...slide.style };
			for (const [key, raw] of Object.entries(patch) as [StyleKey, string | number | null | undefined][]) {
				if (raw === null || raw === undefined || raw === '') {
					delete style[key];
					continue;
				}
				const value = key === 'image' ? imageLink(String(raw)) : String(raw);
				if (STYLE_VALUES[key](value)) setStyleValue(style, key, value);
			}
			return writeSlideStyle(text, index, style);
		});
	}

	/** Background, text and highlight into the note's properties in one write; null removes that one */
	async setDeckColors(file: TFile, colors: Partial<Record<ColorKey, string | null>>): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			for (const key of COLOR_KEYS) {
				if (!(key in colors)) continue;
				const value = colors[key];
				if (value && isColor(value)) frontmatter[`slide-${key}`] = value;
				else delete frontmatter[`slide-${key}`];
			}
		});
	}

	/** A vault image by link (resolved from the note, like ![[…]]) or an http(s) address; null when it is not there */
	imageUrl(link: string, file: TFile): string | null {
		if (/^https?:\/\//i.test(link)) return link;
		const target = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
		if (target) return this.app.vault.getResourcePath(target);
		if (!this.missing.has(link)) {
			this.missing.add(link);
			new Notice(`Image not found: ${link}`);
		}
		return null;
	}

	css(): Promise<string> {
		return this.app.vault.adapter.read(`${this.manifest.dir ?? ''}/styles.css`);
	}

	// The deck for the browser page: each slide drawn by Obsidian, with vault images pointed at the preview server.
	// fileUrl: how a vault image is addressed on the page (the preview server by default, or a marker export fills in)
	async deckData(file: TFile, fileUrl: (target: TFile) => string = (target) => `/file/${encodeURIComponent(target.path)}?key=${this.web.token}`): Promise<WebDeck> {
		const text = await this.app.vault.cachedRead(file);
		const base = this.baseStyle(file);
		const slides: WebDeck['slides'] = [];
		for (const slide of parseDeck(text)) {
			const style = { ...base, ...slide.style } as ResolvedStyle;
			const component = new Component();
			component.load();
			const holder = await renderSlide(this.app, slide.markdown, file.path, component);
			this.webImages(holder, file, fileUrl);
			// A drawn diagram no longer holds its source: keep it beside the drawing, for the browser's Copy button
			const sources = mermaidSources(slide.markdown);
			holder.querySelectorAll<HTMLElement>('.mermaid').forEach((diagram, i) => {
				const source = sources[i];
				if (source !== undefined) diagram.dataset.source = source;
			});
			const el = createDiv();
			arrange(el, holder, style);
			let image: string | null = null;
			if (style.image && /^https?:\/\//i.test(style.image)) image = style.image;
			else if (style.image) {
				const target = this.app.metadataCache.getFirstLinkpathDest(style.image, file.path);
				if (target) image = fileUrl(target);
			}
			slides.push({ html: el.innerHTML, classes: el.className, style: { ...style, image }, notes: slide.notes });
			component.unload();
		}
		return { title: file.basename, font: this.settings.font, counter: this.settings.counter, progress: this.settings.progress, slides };
	}

	/** Points a slide's vault images at fileUrl instead of Obsidian's own app:// addresses */
	private webImages(holder: HTMLElement, file: TFile, fileUrl: (target: TFile) => string): void {
		holder.querySelectorAll('.internal-embed[src]').forEach((embed) => {
			const link = (embed.getAttribute('src') ?? '').split('#')[0]?.split('|')[0] ?? '';
			const target = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
			if (!target || !imageType(target.extension)) return;
			const img = embed.querySelector('img') ?? embed.createEl('img');
			img.setAttribute('src', fileUrl(target));
		});
		const prefix = this.app.vault.adapter.getResourcePath('').split('?')[0] ?? '';
		holder.querySelectorAll('img').forEach((img) => {
			const src = img.getAttribute('src') ?? '';
			if (!prefix || !src.startsWith(prefix)) return;
			const target = this.app.vault.getAbstractFileByPath(decodeURIComponent(src.slice(prefix.length).split('?')[0] ?? ''));
			if (target instanceof TFile) img.setAttribute('src', fileUrl(target));
		});
	}
}

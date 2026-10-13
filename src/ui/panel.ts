// The panel: the open note's slides with previews, and pickers that write the note's properties and comments
import { App, FuzzySuggestModal, ItemView, Platform, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { COLOR_JOBS, COLOR_KEYS, imageType, STAGE_W, SWATCHES, THEMES, THUMB_W, VIEW_TYPE, type SwatchGroup } from '../constants';
import { deckStyle, parseDeck, slideTitle, STYLE_ORDER } from '../deck/parse';
import type YaasPlugin from '../main';
import type { ColorKey, Colors, ResolvedStyle, Slide, SlideStyle, StylePatch, Theme } from '../types';
import { toHex } from './color';
import { Stage } from './stage';

class ImagePicker extends FuzzySuggestModal<TFile> {
	constructor(app: App, private onPick: (file: TFile) => void) {
		super(app);
		this.setPlaceholder('Choose an image from the vault');
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter((file) => imageType(file.extension));
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onPick(file);
	}
}

/** A preview's hooks: drawn when it scrolls near view, scaled whenever its card is resized */
interface Thumb {
	draw: () => void;
	scale: (width: number) => void;
}

type ColorPatch = Partial<Record<ColorKey, string | null>>;

export class YaasView extends ItemView {
	private file: TFile | null = null;
	private opened = new Set<number>();
	private stages: Stage[] = [];
	private thumbs = new WeakMap<Element, Thumb>();
	private lazy: IntersectionObserver | null = null;
	private sizer: ResizeObserver | null = null;
	private timer: number | null = null;
	private swatches: { pop: HTMLElement; away: (event: Event) => void } | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: YaasPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Slides';
	}

	getIcon(): string {
		return 'presentation';
	}

	async onOpen(): Promise<void> {
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.follow()));
		this.registerEvent(this.app.vault.on('modify', (file) => { if (file === this.file) this.schedule(); }));
		this.registerEvent(this.app.metadataCache.on('changed', (file) => { if (file === this.file) this.schedule(); }));
		this.follow();
	}

	async onClose(): Promise<void> {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.lazy?.disconnect();
		this.sizer?.disconnect();
		this.closeSwatches();
		this.clearStages();
	}

	// The panel shows the last note opened in the editor; clicking into the panel keeps it
	private follow(): void {
		const file = this.app.workspace.getActiveFile();
		if (file && file.extension === 'md' && file !== this.file) {
			this.file = file;
			this.opened.clear();
			void this.refresh();
		} else if (!this.file) {
			void this.refresh();
		}
	}

	private schedule(): void {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => void this.refresh(), 300);
	}

	private clearStages(): void {
		this.stages.forEach((stage) => stage.unload());
		this.stages = [];
	}

	private async refresh(): Promise<void> {
		const root = this.contentEl;
		const scroll = root.scrollTop;
		this.closeSwatches();
		this.clearStages();
		root.empty();
		// Previews are drawn only when they scroll near view: a long deck does not render every slide on each save
		this.lazy?.disconnect();
		this.lazy = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				this.lazy?.unobserve(entry.target);
				this.thumbs.get(entry.target)?.draw();
			}
		}, { root, rootMargin: '600px 0px' });
		// Previews fill their card at any panel width: each stage is scaled to its box whenever the panel is resized
		this.sizer?.disconnect();
		this.sizer = new ResizeObserver((entries) => {
			for (const entry of entries) this.thumbs.get(entry.target)?.scale(entry.contentRect.width);
		});
		root.addClass('yaas-panel');
		if (!this.file) {
			root.createEl('p', { text: 'Open a note to see its slides here.', cls: 'yaas-hint' });
			return;
		}
		const file = this.file;
		const slides = parseDeck(await this.app.vault.cachedRead(file));
		const base = this.plugin.baseStyle(file);
		const own = deckStyle(this.app.metadataCache.getFileCache(file)?.frontmatter);

		// One line: the note's name, then Present and, as icons, the browser and the PDF
		const head = root.createDiv({ cls: 'yaas-panel-head' });
		head.createDiv({ cls: 'yaas-panel-title', text: file.basename });
		const actions = head.createDiv({ cls: 'yaas-panel-actions' });
		this.button(actions, 'Present', 'play', () => void this.plugin.present(file)).addClass('mod-cta');
		if (Platform.isDesktopApp) {
			this.button(actions, '', 'globe', () => void this.plugin.openInBrowser(file), 'Open in the browser');
			this.button(actions, '', 'download', () => void this.plugin.exportPdf(file), 'Export a PDF to share: one slide per page, no speaker notes');
		}

		const deck = root.createDiv({ cls: 'yaas-panel-section' });
		deck.createDiv({ cls: 'yaas-section-title', text: 'Deck colours' });
		this.colorStrip(deck, base, own, this.plugin.settings, (patch) => void this.plugin.setDeckColors(file, patch),
			'Every slide that does not set its own colours');

		const list = root.createDiv({ cls: 'yaas-panel-section' });
		list.createDiv({ cls: 'yaas-section-title', text: `Slides · ${slides.length}` });
		if (!slides.length) list.createEl('p', { cls: 'yaas-hint', text: 'No slides yet: separate them with a line of ---.' });
		const grid = list.createDiv({ cls: 'yaas-slides' });
		slides.forEach((slide, index) => this.slideCard(grid, file, slide, index, base));
		root.scrollTop = scroll;
	}

	// One framed card per slide, read top to bottom: its number, title and cog first, then its preview, then (open)
	// its settings. Only the settings that do something for this slide are shown: image fit and darken with a
	// background image, layout when the slide has an image in it
	private slideCard(parent: HTMLElement, file: TFile, slide: Slide, index: number, base: Colors): void {
		const style = { ...base, ...slide.style } as ResolvedStyle;
		const own = Object.keys(slide.style).length > 0;
		const card = parent.createDiv({ cls: 'yaas-card' });
		const head = card.createEl('button', { cls: 'yaas-card-head', attr: { 'aria-expanded': 'false', 'aria-label': `Settings for slide ${index + 1}` } });
		head.createSpan({ cls: 'yaas-card-number', text: String(index + 1) });
		head.createSpan({ cls: 'yaas-card-title', text: slideTitle(slide) });
		if (own) head.createSpan({ cls: 'yaas-card-own', attr: { title: 'This slide has its own settings' } });
		setIcon(head.createSpan({ cls: 'yaas-card-cog' }), 'settings-2');

		const thumb = card.createDiv({ cls: 'yaas-thumb', attr: { 'aria-label': `Present from slide ${index + 1}` } });
		thumb.addEventListener('click', () => void this.plugin.present(file, index));
		const stage = new Stage(this.plugin, thumb, { counter: false });
		stage.scale(THUMB_W / STAGE_W);
		this.stages.push(stage);
		this.thumbs.set(thumb, {
			draw: () => void stage.show(file, slide, style, ''),
			scale: (width) => { if (width) stage.scale(width / STAGE_W); },
		});
		this.lazy?.observe(thumb);
		this.sizer?.observe(thumb);

		const body = card.createDiv({ cls: 'yaas-card-body' });
		const toggle = (open: boolean) => {
			card.toggleClass('is-open', open);
			head.setAttribute('aria-expanded', String(open));
			if (open) this.opened.add(index);
			else this.opened.delete(index);
		};
		toggle(this.opened.has(index));
		head.addEventListener('click', () => toggle(!card.hasClass('is-open')));
		const set = (patch: StylePatch) => void this.plugin.setSlideStyle(file, index, patch);

		this.colorStrip(body, style, slide.style, base, set, 'This slide only');
		this.segmented(body, 'Position', slide.style.align ?? '', [['', 'Middle'], ['left', 'Top']], (value) => set({ align: value || null }));
		if (/!\[\[|!\[[^\]]*\]\(/.test(slide.markdown)) {
			this.segmented(body, 'Layout', slide.style.layout ?? '', [['', 'In text'], ['image-left', 'Image left'], ['image-right', 'Image right']],
				(value) => set({ layout: value || null }));
		}

		const imageRow = this.row(body, 'Backdrop');
		const input = imageRow.createEl('input', { type: 'text', value: slide.style.image ?? '', attr: { placeholder: 'No image' } });
		input.addEventListener('change', () => set({ image: input.value.trim() || null }));
		this.button(imageRow, '', 'image', () => new ImagePicker(this.app, (picked) => set({ image: picked.path })).open(), 'Choose an image from the vault');
		if (slide.style.image) this.button(imageRow, '', 'x', () => set({ image: null, dim: null }), 'Remove the image');
		if (slide.style.image || slide.style.layout) {
			this.segmented(body, 'Image fit', slide.style.fit ?? '', [['', 'Fill'], ['contain', 'Whole']], (value) => set({ fit: value || null }));
		}
		if (slide.style.image) {
			const dimRow = this.row(body, 'Darken');
			const range = dimRow.createEl('input', { type: 'range', attr: { min: '0', max: '0.9', step: '0.05' } });
			range.value = String(slide.style.dim ?? 0);
			const percent = () => `${Math.round(Number(range.value) * 100)}%`;
			const shown = dimRow.createSpan({ cls: 'yaas-value', text: percent() });
			range.addEventListener('input', () => shown.setText(percent()));
			range.addEventListener('change', () => set({ dim: Number(range.value) || null }));
		}
		if (own) {
			const reset = this.button(body, 'Reset this slide', 'rotate-ccw', () => set(Object.fromEntries(STYLE_ORDER.map((key) => [key, null]))),
				"Back to the deck's colours, no image, middle");
			reset.addClass('yaas-reset');
		}
	}

	private row(parent: HTMLElement, label: string): HTMLElement {
		const row = parent.createDiv({ cls: 'yaas-row' });
		row.createSpan({ cls: 'yaas-label', text: label });
		return row;
	}

	// A row of buttons, one lit: for choices of two or three, quicker than a dropdown
	private segmented(parent: HTMLElement, label: string, value: string, options: [string, string][], onSet: (value: string) => void): void {
		const group = this.row(parent, label).createDiv({ cls: 'yaas-seg', attr: { role: 'radiogroup', 'aria-label': label } });
		for (const [optionValue, text] of options) {
			const option = group.createEl('button', { text, attr: { role: 'radio', 'aria-checked': String(optionValue === value) } });
			option.toggleClass('is-active', optionValue === value);
			option.addEventListener('click', () => { if (optionValue !== value) onSet(optionValue); });
		}
	}

	// Colours in one line: the theme, then background, text and highlight as swatches, and ↺ when any are set here.
	// current: the colours in use; own: those set at this level; inherited: those from further up (faded swatches)
	private colorStrip(parent: HTMLElement, current: Colors, own: SlideStyle, inherited: Colors, onSet: (patch: ColorPatch) => void, hint: string): void {
		const row = parent.createDiv({ cls: 'yaas-strip', attr: { 'aria-label': hint } });
		this.themeButton(row, current, (theme) => onSet({ bg: theme.bg, text: theme.text, accent: theme.accent }));
		for (const [key, label, job] of COLOR_JOBS) {
			this.colorSwatch(row, key, label, job, own[key], inherited[key], (value) => onSet({ [key]: value }));
		}
		if (COLOR_KEYS.some((key) => own[key])) {
			this.button(row, '', 'rotate-ccw', () => onSet({ bg: null, text: null, accent: null }), 'Back to the inherited colours');
		}
	}

	// A list of the themes, each shown in its own colours: choosing one sets background, text and highlight together.
	// The button shows the colours in use, named after the theme they match, or "Own colours"
	private themeButton(parent: HTMLElement, current: Colors, onPick: (theme: Theme) => void): void {
		const inUse = THEMES.find((theme) => COLOR_KEYS.every((key) => toHex(current[key]) === theme[key].toLowerCase()));
		const button = parent.createEl('button', { cls: 'yaas-theme-select', attr: { 'aria-haspopup': 'listbox', 'aria-label': 'Theme' } });
		this.paintTheme(button, current, inUse ? inUse.name : 'Own colours');
		setIcon(button.createSpan({ cls: 'yaas-theme-chevron' }), 'chevron-down');
		button.addEventListener('click', () => this.popover(button, 'yaas-theme-menu', (pop, close) => {
			pop.setAttribute('role', 'listbox');
			for (const theme of THEMES) {
				const item = pop.createEl('button', { cls: 'yaas-theme-item', attr: { role: 'option', 'aria-selected': String(theme === inUse) } });
				this.paintTheme(item, theme, theme.name);
				item.toggleClass('is-current', theme === inUse);
				item.addEventListener('click', () => {
					close();
					onPick(theme);
				});
			}
			return pop.querySelector<HTMLElement>('.is-current') ?? pop.querySelector<HTMLElement>('.yaas-theme-item');
		}));
	}

	// The name in the theme's text colour on its background, and a dot of its highlight
	private paintTheme(el: HTMLElement, colors: Colors, name: string): void {
		el.setCssStyles({ background: colors.bg, color: colors.text });
		el.createSpan({ cls: 'yaas-theme-name', text: name });
		el.createSpan({ cls: 'yaas-theme-dot' }).setCssStyles({ background: colors.accent });
	}

	// The colour in use as a swatch: hovering says what it colours, a click opens the presets for this job, and
	// Custom… the full picker. Faded when it comes from further up
	private colorSwatch(parent: HTMLElement, key: ColorKey, label: string, job: string, own: string | undefined, inherited: string, onSet: (value: string | null) => void): void {
		const value = toHex(own ?? inherited);
		const from = own ? '' : ', inherited';
		const swatch = parent.createEl('button', { cls: 'yaas-swatch-button', attr: { 'aria-label': `${label} (${value}${from}): ${job}` } });
		swatch.setCssStyles({ background: value });
		swatch.toggleClass('is-inherited', !own);
		const input = parent.createEl('input', { type: 'color', cls: 'yaas-hidden-picker' });
		input.value = value;
		input.addEventListener('change', () => onSet(input.value));
		swatch.addEventListener('click', () => this.openSwatches(swatch, SWATCHES[key], value, onSet, input, label, job));
	}

	private openSwatches(anchor: HTMLElement, groups: SwatchGroup[], current: string, onPick: (hex: string) => void, input: HTMLInputElement, label: string, job: string): void {
		this.popover(anchor, 'yaas-swatches', (pop, close) => {
			pop.createDiv({ cls: 'yaas-swatches-title', text: label });
			pop.createDiv({ cls: 'yaas-swatches-job', text: job });
			for (const [group, colors] of groups) {
				pop.createDiv({ cls: 'yaas-swatches-group', text: group });
				const grid = pop.createDiv({ cls: 'yaas-swatches-grid' });
				for (const [name, hex] of colors) {
					const button = grid.createEl('button', { cls: 'yaas-swatch', attr: { 'aria-label': `${name} ${hex}` } });
					button.setCssStyles({ background: hex });
					button.toggleClass('is-current', hex.toLowerCase() === current);
					button.addEventListener('click', () => {
						close();
						onPick(hex);
					});
				}
			}
			const custom = pop.createEl('button', { cls: 'yaas-swatches-custom', text: 'Custom colour…' });
			custom.addEventListener('click', () => {
				close();
				input.click();
			});
			return pop.querySelector<HTMLElement>('.is-current') ?? pop.querySelector<HTMLElement>('.yaas-swatch');
		});
	}

	// A small menu under `anchor` (above it when there is no room), filled by build(pop, close), which returns the
	// button to focus. Closes on a click elsewhere or Escape; arrow keys move between its buttons
	private popover(anchor: HTMLElement, cls: string, build: (pop: HTMLElement, close: () => void) => HTMLElement | null): void {
		this.closeSwatches();
		const doc = anchor.doc;
		const pop = doc.body.createDiv({ cls: `yaas-popover ${cls}` });
		const close = () => {
			this.closeSwatches();
			anchor.focus();
		};
		const focus = build(pop, close);
		const box = anchor.getBoundingClientRect();
		const height = pop.offsetHeight;
		const win = anchor.win;
		const top = box.bottom + 6 + height > win.innerHeight ? Math.max(8, box.top - height - 6) : box.bottom + 6;
		pop.setCssStyles({ left: `${Math.max(8, Math.min(box.left, win.innerWidth - pop.offsetWidth - 8))}px`, top: `${top}px` });
		const away = (event: Event) => {
			if (event instanceof MouseEvent) {
				const target = event.target instanceof Node ? event.target : null;
				if (!pop.contains(target) && !anchor.contains(target)) this.closeSwatches();
				return;
			}
			if (!(event instanceof KeyboardEvent)) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				close();
				return;
			}
			const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[event.key];
			if (!step || !pop.contains(doc.activeElement)) return;
			event.preventDefault();
			const buttons = Array.from(pop.querySelectorAll('button'));
			const at = buttons.indexOf(doc.activeElement as HTMLButtonElement);
			buttons[(at + step + buttons.length) % buttons.length]?.focus();
		};
		doc.addEventListener('mousedown', away, true);
		doc.addEventListener('keydown', away, true);
		this.swatches = { pop, away };
		focus?.focus();
	}

	private closeSwatches(): void {
		if (!this.swatches) return;
		const doc = this.swatches.pop.doc;
		doc.removeEventListener('mousedown', this.swatches.away, true);
		doc.removeEventListener('keydown', this.swatches.away, true);
		this.swatches.pop.remove();
		this.swatches = null;
	}

	private button(parent: HTMLElement, text: string, icon: string, onClick: () => void, tooltip?: string): HTMLButtonElement {
		const button = parent.createEl('button', { cls: text ? 'yaas-button' : 'yaas-button clickable-icon' });
		setIcon(button.createSpan(), icon);
		if (text) button.createSpan({ text });
		if (tooltip) button.setAttribute('aria-label', tooltip);
		button.addEventListener('click', onClick);
		return button;
	}
}

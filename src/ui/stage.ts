import type { TFile } from 'obsidian';
import { fitCode, arrange, prepareSlide } from '../render/slide';
import type YaasPlugin from '../main';
import type { PreparedSlide, ResolvedStyle, Slide } from '../types';

/** The 1920×1080 stage a slide is drawn on, for presenting and for the panel's previews */
export class Stage {
	el: HTMLElement;
	private backdrop: HTMLElement;
	private dimmer: HTMLElement;
	private slideEl: HTMLElement;
	private counter: HTMLElement;
	private progressBar: HTMLElement;
	private rendering = 0;
	private component: PreparedSlide['component'] | null = null;

	constructor(private plugin: YaasPlugin, parent: HTMLElement, { counter = true, progress = false } = {}) {
		this.el = parent.createDiv({ cls: 'yaas-stage' });
		// Painted first, under the text: the slide's background image and its dark layer
		this.backdrop = this.el.createDiv({ cls: 'yaas-backdrop' });
		this.dimmer = this.el.createDiv({ cls: 'yaas-dim' });
		this.slideEl = this.el.createDiv({ cls: 'yaas-slide' });
		this.counter = this.el.createDiv({ cls: 'yaas-counter' });
		if (!counter) this.counter.hide();
		// A line along the bottom edge, filled up to this slide
		const progressEl = this.el.createDiv({ cls: 'yaas-progress' });
		this.progressBar = progressEl.createDiv({ cls: 'yaas-progress-bar' });
		if (!progress) progressEl.hide();
		if (plugin.settings.font) this.el.setCssProps({ '--ks-font': plugin.settings.font });
	}

	scale(factor: number): void {
		this.el.style.transform = `translate(-50%, -50%) scale(${factor})`;
	}

	// Renders off-screen, then swaps in: a quick second call never leaves an older slide showing. `ready` is a slide
	// rendered ahead of time, shown without rendering it again
	async show(file: TFile, slide: Slide, style: ResolvedStyle, label: string, fraction = 0, ready: Promise<PreparedSlide> | null = null): Promise<boolean> {
		const ticket = ++this.rendering;
		const { holder, component } = await (ready ?? prepareSlide(this.plugin.app, slide, file));
		if (ticket !== this.rendering || !this.el.isConnected) {
			component.unload();
			return false;
		}
		this.component?.unload();
		this.component = component;
		this.el.setCssProps({ '--ks-bg': style.bg, '--ks-text': style.text, '--ks-accent': style.accent });
		const url = style.image ? this.plugin.imageUrl(style.image, file) : null;
		this.backdrop.setCssStyles({
			backgroundImage: url ? `url(${JSON.stringify(url)})` : '',
			backgroundSize: style.fit === 'contain' ? 'contain' : 'cover',
		});
		this.dimmer.setCssStyles({ opacity: url ? String(style.dim ?? 0) : '0' });
		arrange(this.slideEl, holder, style);
		fitCode(this.slideEl);
		this.counter.setText(label);
		this.progressBar.setCssStyles({ width: `${fraction * 100}%` });
		return true;
	}

	unload(): void {
		this.rendering++;
		this.component?.unload();
		this.component = null;
	}
}

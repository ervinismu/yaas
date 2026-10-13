// Presenting inside Obsidian: full screen, keys and clicks to move, N for speaker notes
import type { TFile } from 'obsidian';
import { STAGE_H, STAGE_W } from '../constants';
import { prepareSlide } from '../render/slide';
import type YaasPlugin from '../main';
import type { Colors, PreparedSlide, ResolvedStyle, Slide } from '../types';
import { Stage } from './stage';

export class Presentation {
	private index: number;
	// The slides either side of this one, rendered in the background while it is shown. Moving on shows one at
	// once, diagrams and code done
	private ahead = new Map<number, Promise<PreparedSlide>>();
	private overlay!: HTMLElement;
	private stage!: Stage;
	private notesEl!: HTMLElement;
	private wasFullscreen = false;

	constructor(private plugin: YaasPlugin, private file: TFile, private slides: Slide[], private baseStyle: Colors, start: number) {
		this.index = Math.min(Math.max(start, 0), slides.length - 1);
	}

	private onKey = (event: KeyboardEvent) => {
		const next = () => this.go(this.index + 1);
		const previous = () => this.go(this.index - 1);
		const toggleNotes = () => this.notesEl.toggle(!this.notesEl.isShown());
		const keys: Record<string, () => void> = {
			ArrowRight: next, ArrowDown: next, PageDown: next, ' ': next,
			ArrowLeft: previous, ArrowUp: previous, PageUp: previous,
			Home: () => this.go(0),
			End: () => this.go(this.slides.length - 1),
			n: toggleNotes, N: toggleNotes,
			Escape: () => this.close(),
		};
		const action = keys[event.key];
		if (!action) return;
		// Keep Obsidian's own hotkeys out of the way while presenting
		event.preventDefault();
		event.stopPropagation();
		action();
	};

	private onResize = () => this.fit();

	// Esc in full screen is taken by the browser to leave full screen: leaving it ends the presentation too
	private onFullscreen = () => {
		if (this.wasFullscreen && !activeDocument.fullscreenElement) this.close();
	};

	open(): void {
		this.overlay = activeDocument.body.createDiv({ cls: 'yaas' });
		this.stage = new Stage(this.plugin, this.overlay, { counter: this.plugin.settings.counter, progress: this.plugin.settings.progress });
		this.notesEl = this.overlay.createDiv({ cls: 'yaas-notes' });
		this.notesEl.hide();
		this.overlay.addEventListener('click', (event) => {
			if (event.target instanceof Element && event.target.closest('a, .yaas-notes')) return;
			this.go(event.clientX < window.innerWidth / 3 ? this.index - 1 : this.index + 1);
		});
		activeDocument.addEventListener('keydown', this.onKey, true);
		window.addEventListener('resize', this.onResize);
		activeDocument.addEventListener('fullscreenchange', this.onFullscreen);
		this.overlay.requestFullscreen().then(() => { this.wasFullscreen = true; }).catch(() => { /* stays in the window */ });
		this.fit();
		void this.show();
	}

	close(): void {
		if (!this.overlay.isConnected) return;
		activeDocument.removeEventListener('keydown', this.onKey, true);
		window.removeEventListener('resize', this.onResize);
		activeDocument.removeEventListener('fullscreenchange', this.onFullscreen);
		this.stage.unload();
		this.ahead.forEach((ready) => void ready.then(({ component }) => component.unload()));
		this.ahead.clear();
		if (activeDocument.fullscreenElement) activeDocument.exitFullscreen().catch(() => { /* already left */ });
		this.overlay.remove();
		this.plugin.presentation = null;
	}

	private fit(): void {
		this.stage.scale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
	}

	private go(index: number): void {
		if (index < 0 || index >= this.slides.length || index === this.index) return;
		this.index = index;
		void this.show();
	}

	private async show(): Promise<void> {
		const slide = this.slides[this.index];
		if (!slide) return;
		const style: ResolvedStyle = { ...this.baseStyle, ...slide.style };
		const ready = this.ahead.get(this.index) ?? null;
		this.ahead.delete(this.index);
		const total = this.slides.length;
		const shown = await this.stage.show(this.file, slide, style, `${this.index + 1} / ${total}`, (this.index + 1) / total, ready);
		if (!shown) return;
		this.prepareAround();
		// Apply the colours before fades are switched on, or this very first change would fade too
		void this.stage.el.offsetWidth;
		this.stage.el.addClass('is-animated');
		this.notesEl.empty();
		if (slide.notes.length) slide.notes.forEach((note) => this.notesEl.createEl('p', { text: note }));
		else this.notesEl.createEl('p', { text: 'No speaker notes for this slide.', cls: 'is-empty' });
	}

	// Render the next and previous slides ahead, and let go of any further away
	private prepareAround(): void {
		if (!this.overlay.isConnected) return;
		for (const [index, ready] of this.ahead) {
			if (Math.abs(index - this.index) <= 1) continue;
			this.ahead.delete(index);
			void ready.then(({ component }) => component.unload());
		}
		for (const index of [this.index + 1, this.index - 1]) {
			const slide = this.slides[index];
			if (!slide || this.ahead.has(index)) continue;
			this.ahead.set(index, prepareSlide(this.plugin.app, slide, this.file));
		}
	}
}

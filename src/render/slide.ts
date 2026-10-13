// Drawing a slide: the same 1920×1080 stage for presenting, the panel's previews and the browser page
import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import type { PreparedSlide, ResolvedStyle, Slide } from '../types';

// Obsidian draws a Mermaid diagram only into an element that is on the page and shown, and after the markdown is
// rendered. So a slide is rendered in a hidden box off-screen, its diagrams awaited (3 s at most), and only then
// moved onto the stage or sent to the browser: never an empty or unrendered diagram
export async function renderSlide(app: App, markdown: string, path: string, component: Component): Promise<HTMLElement> {
	const holder = activeDocument.body.createDiv({ cls: 'yaas-offscreen' });
	try {
		await MarkdownRenderer.render(app, markdown, holder, path, component);
		for (let waited = 0; waited < 3000 && holder.querySelector('.mermaid:not(:has(svg)), code.language-mermaid'); waited += 50) {
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}
	} finally {
		holder.detach();
	}
	return holder;
}

/** A slide rendered and ready to be shown: its markdown, code colours and diagrams done */
export async function prepareSlide(app: App, slide: Slide, file: TFile): Promise<PreparedSlide> {
	const component = new Component();
	component.load();
	const holder = await renderSlide(app, slide.markdown, file.path, component);
	return { holder, component };
}

/** Fill a .yaas-slide from rendered markdown. layout=image-left|image-right: the first image takes one half */
export function arrange(slideEl: HTMLElement, holder: HTMLElement, style: ResolvedStyle): void {
	slideEl.empty();
	slideEl.className = 'yaas-slide';
	if (style.align === 'left') slideEl.addClass('is-left');
	const image = style.layout ? holder.querySelector('.image-embed, img') : null;
	if (!image) {
		slideEl.append(...Array.from(holder.childNodes));
		return;
	}
	slideEl.addClass('is-split', `is-${style.layout}`);
	const media = slideEl.createDiv({ cls: 'yaas-media' });
	const text = slideEl.createDiv({ cls: 'yaas-text' });
	const block = image.closest('.internal-embed') ?? image;
	const parent = block.parentElement;
	media.append(block);
	if (parent && parent !== holder && !parent.textContent?.trim() && !parent.querySelector('img')) parent.remove();
	if (style.fit === 'contain') media.addClass('is-contain');
	text.append(...Array.from(holder.childNodes));
}

// Code fills the slide like a diagram: the largest font from 24 to 56 px at which every code block shows whole,
// found by halving the range. When even 24 px is too wide, long lines wrap instead, and the size is found again from
// 20 px, the smallest still readable on a projector. Code too long even at 20 px stays at 20 px and is cut off at the
// bottom, and the card says so: a fade and "↓ 14 more lines". Needs the slide laid out on the page.
// The browser page runs this same function from its source text, so it uses nothing from outside itself
export function fitCode(slideEl: HTMLElement): void {
	const blocks = Array.from(slideEl.querySelectorAll('pre'));
	if (!blocks.length || !slideEl.isConnected) return;
	const setSize = (size: number) => {
		blocks.forEach((pre) => pre.style.setProperty('--ks-code-size', `${size}px`));
	};
	const fits = (size: number) => {
		setSize(size);
		return slideEl.scrollHeight <= slideEl.clientHeight + 1 && blocks.every((pre) =>
			pre.scrollWidth <= pre.clientWidth + 1 && pre.scrollHeight <= pre.clientHeight + 1);
	};
	// The largest size from low to high that fits, or 0 when even low does not
	const largest = (low: number, high: number) => {
		if (!fits(low)) return 0;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			if (fits(mid)) low = mid;
			else high = mid - 1;
		}
		return low;
	};
	blocks.forEach((pre) => {
		pre.classList.remove('is-wrapped', 'is-cut');
		pre.removeAttribute('data-more');
	});
	let size = largest(24, 56);
	if (!size) {
		blocks.forEach((pre) => pre.classList.add('is-wrapped'));
		size = largest(20, 56) || 20;
	}
	setSize(size);
	// Lines that do not fit: counted from how far the code runs past the bottom of its card
	blocks.forEach((pre) => {
		const code = pre.querySelector('code') ?? pre;
		const style = getComputedStyle(pre);
		const shown = pre.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
		const hidden = code.offsetHeight - shown;
		const line = parseFloat(getComputedStyle(code).lineHeight) || size * 1.55;
		if (hidden < line / 2) return;
		const more = Math.ceil(hidden / line);
		pre.classList.add('is-cut');
		pre.setAttribute('data-more', more === 1 ? '1 more line' : `${more} more lines`);
		// Where the card cuts the code off, for the fade
		code.style.setProperty('--ks-code-shown', `${shown}px`);
	});
}

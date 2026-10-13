// The deck format: slides split on ---, %% comments are speaker notes, one starting with "slide" styles its slide
import { COLOR_KEYS } from '../constants';
import type { Slide, SlideStyle, StyleKey } from '../types';

const STYLE_KEYS: Record<string, StyleKey> = {
	bg: 'bg', background: 'bg', text: 'text', color: 'text', accent: 'accent', highlight: 'accent', align: 'align',
	image: 'image', 'bg-image': 'image', fit: 'fit', dim: 'dim', layout: 'layout',
};

/** The order a slide's comment is written back in by the panel */
export const STYLE_ORDER: StyleKey[] = ['bg', 'text', 'accent', 'align', 'image', 'dim', 'fit', 'layout'];

export function isColor(value: string): boolean {
	return /^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|hsl)a?\([\d\s.,%/]+\)$/i.test(value) || /^[a-z]{3,20}$/i.test(value);
}

/** Each key takes only the values it understands; anything else is ignored, never passed to CSS */
export const STYLE_VALUES: Record<StyleKey, (value: string) => boolean> = {
	bg: isColor,
	text: isColor,
	accent: isColor,
	align: (value) => value === 'left' || value === 'center',
	fit: (value) => value === 'cover' || value === 'contain',
	layout: (value) => value === 'image-left' || value === 'image-right',
	dim: (value) => /^(0(\.\d+)?|1(\.0+)?)$/.test(value),
	image: (value) => value.length > 0 && value.length <= 500,
};

/** Set one key of a style from text, already checked against STYLE_VALUES */
export function setStyleValue(style: SlideStyle, key: StyleKey, value: string): void {
	if (key === 'dim') style.dim = Number(value);
	else style[key] = value;
}

/** image=[[photo.png]], image=photo.png or image=https://…: the link without [[ ]] or an |alias */
export function imageLink(value: string): string {
	return (value.replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0] ?? '').trim();
}

function parseStyle(source: string): SlideStyle {
	const style: SlideStyle = {};
	for (const match of source.matchAll(/([a-z-]+)\s*=\s*("[^"]*"|!?\[\[[^\]]+\]\]|\S+)/gi)) {
		const key = STYLE_KEYS[(match[1] ?? '').toLowerCase()];
		if (!key) continue;
		let value = (match[2] ?? '').replace(/^"|"$/g, '');
		if (key === 'image') value = imageLink(value);
		if (STYLE_VALUES[key](value)) setStyleValue(style, key, value);
	}
	return style;
}

function parseSlide(source: string): Omit<Slide, 'segment'> {
	const style: SlideStyle = {};
	const notes: string[] = [];
	const markdown = source.replace(/%%([\s\S]*?)%%/g, (_, inner: string) => {
		const directive = /^\s*slide\b([\s\S]*)$/.exec(inner);
		if (directive) Object.assign(style, parseStyle(directive[1] ?? ''));
		else if (inner.trim()) notes.push(inner.trim());
		return '';
	});
	return { markdown: markdown.trim(), style, notes };
}

function frontmatterEnd(text: string): number {
	const frontmatter = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(text);
	return frontmatter ? frontmatter[0].length : 0;
}

interface Segment {
	start: number;
	end: number;
	source: string;
}

// Like Obsidian's own Slides: a line of only --- (outside code fences) starts a new slide; the properties block at
// the top is not a slide. Each piece keeps where it sits in the note, so the panel can write back into it
function splitSegments(text: string): Segment[] {
	const bounds: { start: number; end: number }[] = [];
	let start = frontmatterEnd(text);
	let pos = start;
	let fence: string | null = null;
	for (;;) {
		const newline = text.indexOf('\n', pos);
		const line = text.slice(pos, newline === -1 ? text.length : newline).replace(/\r$/, '');
		const opener = /^\s*(`{3,}|~{3,})/.exec(line);
		if (opener) {
			if (!fence) fence = opener[1] ?? null;
			else if (line.trim().startsWith(fence)) fence = null;
		}
		if (!fence && /^\s*---\s*$/.test(line)) {
			bounds.push({ start, end: pos });
			start = newline === -1 ? text.length : newline + 1;
		}
		if (newline === -1) break;
		pos = newline + 1;
	}
	bounds.push({ start, end: text.length });
	return bounds.map((bound) => ({ ...bound, source: text.slice(bound.start, bound.end) }));
}

/** The slides worth showing: empty pieces (two --- in a row) are skipped. `segment` points back into the note */
export function parseDeck(text: string): Slide[] {
	return splitSegments(text)
		.map((segment, index) => ({ ...parseSlide(segment.source), segment: index }))
		.filter((slide) => slide.markdown || slide.notes.length);
}

function serializeStyle(style: SlideStyle): string {
	const parts: string[] = [];
	for (const key of STYLE_ORDER) {
		const value = style[key];
		if (value === undefined || value === '') continue;
		if (key === 'image') parts.push(/^https?:\/\//i.test(String(value)) ? `image=${value}` : `image=[[${value}]]`);
		else parts.push(`${key}=${value}`);
	}
	return parts.length ? `%% slide ${parts.join(' ')} %%` : '';
}

/** Replace slide number `slideIndex`'s styling comment (or add one at its top); everything else stays as written */
export function writeSlideStyle(text: string, slideIndex: number, style: SlideStyle): string {
	const slide = parseDeck(text)[slideIndex];
	if (!slide) return text;
	const segment = splitSegments(text)[slide.segment];
	if (!segment) return text;
	const cleaned = segment.source.replace(/%%\s*slide\b[\s\S]*?%%[ \t]*(\r?\n)?/g, '');
	const directive = serializeStyle(style);
	const lead = /^\s*/.exec(cleaned)?.[0] ?? '';
	const source = directive ? `${lead}${directive}\n${cleaned.slice(lead.length)}` : cleaned;
	return text.slice(0, segment.start) + source + text.slice(segment.end);
}

/** Deck-wide colours from the note's properties: slide-bg, slide-text, slide-accent (or slide-highlight) */
export function deckStyle(frontmatter: Record<string, unknown> | undefined): SlideStyle {
	const style: SlideStyle = {};
	if (!frontmatter) return style;
	for (const key of COLOR_KEYS) {
		const value = frontmatter[`slide-${key}`] ?? (key === 'accent' ? frontmatter['slide-highlight'] : undefined);
		if (typeof value === 'string' && isColor(value.trim())) style[key] = value.trim();
	}
	return style;
}

export function slideTitle(slide: Slide): string {
	const heading = /^#{1,6}\s+(.+)$/m.exec(slide.markdown);
	const line = heading?.[1] ?? slide.markdown.split('\n').find((l) => l.trim()) ?? '(speaker notes only)';
	const plain = line.replace(/[*_`[\]#|]/g, '').trim();
	return plain.length > 60 ? `${plain.slice(0, 57)}…` : plain;
}

/** The source of every ```mermaid block in a slide's markdown, in order */
export function mermaidSources(markdown: string): string[] {
	const sources: string[] = [];
	const fence = /^ {0,3}(`{3,}|~{3,})\s*mermaid\s*\n([\s\S]*?)\n {0,3}\1[`~]*\s*$/gim;
	for (const match of markdown.matchAll(fence)) sources.push(match[2] ?? '');
	return sources;
}

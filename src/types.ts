import type { Component } from 'obsidian';

/** The three colours of a slide; `accent` is shown as "Highlight" */
export type ColorKey = 'bg' | 'text' | 'accent';
export type Colors = Record<ColorKey, string>;

/** What a slide's `%% slide … %%` comment can set */
export interface SlideStyle {
	bg?: string;
	text?: string;
	accent?: string;
	align?: string;
	image?: string;
	dim?: number;
	fit?: string;
	layout?: string;
}

export type StyleKey = keyof SlideStyle;

/** A patch the panel writes: a value sets that key, null removes it */
export type StylePatch = { [K in StyleKey]?: string | number | null };

/** One slide of a note: its markdown without comments, its own styling and its speaker notes */
export interface Slide {
	markdown: string;
	style: SlideStyle;
	notes: string[];
	/** Which piece of the note (split on ---) it came from, so the panel can write back into it */
	segment: number;
}

/** The colours and styling a slide is drawn with: its own, over the note's, over the settings */
export type ResolvedStyle = Colors & Omit<SlideStyle, ColorKey>;

export interface Theme extends Colors {
	name: string;
}

/** A slide rendered off-screen and ready to be shown */
export interface PreparedSlide {
	holder: HTMLElement;
	component: Component;
}

/** A slide as the browser page draws it */
export interface WebSlide {
	html: string;
	classes: string;
	style: Omit<ResolvedStyle, 'image'> & { image: string | null };
	notes: string[];
}

export interface WebDeck {
	title: string;
	font: string;
	counter: boolean;
	progress: boolean;
	slides: WebSlide[];
}

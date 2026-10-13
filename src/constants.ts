import type { ColorKey, Theme } from './types';

/** Slides are a fixed 1920×1080 stage, scaled to the screen */
export const STAGE_W = 1920;
export const STAGE_H = 1080;
/** Width a panel preview starts at, before it is scaled to its card */
export const THUMB_W = 256;
export const VIEW_TYPE = 'yaas-panel';

export const IMAGE_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	avif: 'image/avif',
	bmp: 'image/bmp',
};

/** The image type of a file extension, or undefined when it is not an image */
export function imageType(extension: string): string | undefined {
	return IMAGE_TYPES[extension.toLowerCase()];
}

// Ready-made colours for the panel. Every theme keeps its text at 4.5:1 or more against its background and its
// highlight at 3:1 or more, which slide text (28 px and up) needs
export const THEMES: Theme[] = [
	{ name: 'Paper', bg: '#FFF3E2', text: '#241722', accent: '#D01C7F' },
	{ name: 'Bubblegum', bg: '#FFC8E3', text: '#4A0E33', accent: '#C4006A' },
	{ name: 'Lemonade', bg: '#FFF06B', text: '#2B2300', accent: '#C23A00' },
	{ name: 'Lime', bg: '#C9FF4D', text: '#162300', accent: '#6B00C2' },
	{ name: 'Mint pop', bg: '#9DF5D0', text: '#073B2A', accent: '#006E52' },
	{ name: 'Sky candy', bg: '#A9DCFF', text: '#0A2A55', accent: '#0049B8' },
	{ name: 'Peach fizz', bg: '#FFB38A', text: '#3A1100', accent: '#8E0057' },
	{ name: 'Tangerine', bg: '#FF7A1A', text: '#1F0A00', accent: '#5C00A3' },
	{ name: 'Watermelon', bg: '#CC0F47', text: '#FFF4F7', accent: '#FFE45C' },
	{ name: 'Grape soda', bg: '#6B2BD9', text: '#FFF7E8', accent: '#FFE45C' },
	{ name: 'Ocean', bg: '#0057C2', text: '#F2F8FF', accent: '#FFD84D' },
	{ name: 'Neon night', bg: '#15102E', text: '#F5F3FF', accent: '#3DFFC6' },
];

/** A named group of ready-made colours: [group name, [colour name, hex][]] */
export type SwatchGroup = [string, [string, string][]];

// What clicking a colour offers, by the job that colour does. Every "On candy" text and highlight reads on every
// candy background, every "On bold" one on every bold background
export const SWATCHES: Record<ColorKey, SwatchGroup[]> = {
	bg: [
		['Candy', [['Paper', '#FFF3E2'], ['Bubblegum', '#FFC8E3'], ['Cotton candy', '#FFE3F1'], ['Lemonade', '#FFF06B'], ['Lime', '#C9FF4D'],
			['Pistachio', '#E2F7B5'], ['Mint', '#9DF5D0'], ['Sky', '#A9DCFF'], ['Peach', '#FFB38A'], ['Lilac', '#D9C2FF']]],
		['Bold', [['Watermelon', '#CC0F47'], ['Magenta', '#D01C7F'], ['Grape', '#6B2BD9'], ['Ocean', '#0057C2'], ['Jungle', '#0B6B47'], ['Neon night', '#15102E']]],
	],
	text: [
		['On candy', [['Ink', '#241722'], ['Plum', '#4A0E33'], ['Navy', '#0A2A55'], ['Forest', '#073B2A'], ['Grape', '#250A4F'], ['Cocoa', '#3A1100']]],
		['On bold', [['Cream', '#FFF3E2'], ['Snow', '#FFFBF4'], ['Ice', '#F2F8FF'], ['Lavender', '#F5F3FF']]],
	],
	accent: [
		['On candy', [['Hot pink', '#C4006A'], ['Red', '#C2002F'], ['Orange', '#C23A00'], ['Berry', '#8E0057'],
			['Purple', '#6B00C2'], ['Blue', '#0049B8'], ['Teal', '#006E52']]],
		['On bold', [['Sunshine', '#FFE45C'], ['Neon mint', '#3DFFC6'], ['Bubblegum', '#FFB3DA'], ['Sky', '#9FD8FF'], ['Lime', '#C9FF4D']]],
	],
};

export const COLOR_KEYS: ColorKey[] = ['bg', 'text', 'accent'];

// The three colours of a slide, as the panel and the settings name and explain them. "Highlight" is the `accent` key
// in notes, which also accept `highlight`
export const COLOR_JOBS: [ColorKey, string, string][] = [
	['bg', 'Background', 'The whole slide, under the soft gradient'],
	['text', 'Text', 'Headings, body text, tables, and the text and lines of diagrams'],
	['accent', 'Highlight', 'What should stand out: bold text, bullets and numbers, links, the slide number, the progress line and diagram boxes'],
];

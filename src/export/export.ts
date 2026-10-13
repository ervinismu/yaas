// Export: the deck as one HTML file, or a landscape PDF, next to the note. Speaker notes are left out
import { arrayBufferToBase64, FileSystemAdapter, Notice, TFile } from 'obsidian';
import { imageType, STAGE_H, STAGE_W } from '../constants';
import type YaasPlugin from '../main';
import type { WebDeck } from '../types';
import { exportPage } from '../web/viewer';
import { pdfWindowClass } from './electron';

/** The page to share: one HTML file with the slides and their images inside, speaker notes left out */
export async function sharePage(plugin: YaasPlugin, file: TFile): Promise<string> {
	const marker = 'yaas-embed:';
	const deck = await plugin.deckData(file, (target) => marker + encodeURIComponent(target.path));
	deck.slides.forEach((slide) => { slide.notes = []; });
	let json = JSON.stringify(deck);
	const paths = new Set(Array.from(json.matchAll(/yaas-embed:([^"'\\)\s]+)/g), (match) => decodeURIComponent(match[1] ?? '')));
	for (const path of paths) {
		const target = plugin.app.vault.getAbstractFileByPath(path);
		const type = target instanceof TFile ? imageType(target.extension) : undefined;
		const uri = target instanceof TFile && type ? `data:${type};base64,${arrayBufferToBase64(await plugin.app.vault.readBinary(target))}` : '';
		json = json.split(marker + encodeURIComponent(path)).join(uri);
	}
	return exportPage(await plugin.css(), JSON.parse(json) as WebDeck);
}

function exportPath(file: TFile, extension: string): string {
	const folder = file.parent && file.parent.path !== '/' ? `${file.parent.path}/` : '';
	return `${folder}${file.basename}.${extension}`;
}

/** Writes a file into the vault, replacing it when it is already there */
async function save(plugin: YaasPlugin, path: string, data: string | ArrayBuffer): Promise<void> {
	const { vault } = plugin.app;
	const existing = vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		if (typeof data === 'string') await vault.modify(existing, data);
		else await vault.modifyBinary(existing, data);
	} else if (typeof data === 'string') {
		await vault.create(path, data);
	} else {
		await vault.createBinary(path, data);
	}
}

function exported(plugin: YaasPlugin, path: string, message: string): void {
	const notice = new Notice(`${message} ${path}. Click to show it.`, 8000);
	const app = plugin.app as unknown as { showInFolder?: (path: string) => void };
	if (app.showInFolder) notice.messageEl.addEventListener('click', () => app.showInFolder?.(path));
}

export async function exportHtml(plugin: YaasPlugin, file: TFile): Promise<string> {
	const path = exportPath(file, 'html');
	await save(plugin, path, await sharePage(plugin, file));
	exported(plugin, path, 'Exported to');
	return path;
}

// The same page, printed to PDF by Obsidian's own browser engine in a hidden window: every page 1920×1080,
// landscape, whatever the computer's print settings say. Desktop only
export async function exportPdf(plugin: YaasPlugin, file: TFile): Promise<string | null> {
	const BrowserWindow = pdfWindowClass();
	const adapter = plugin.app.vault.adapter;
	if (!BrowserWindow || !(adapter instanceof FileSystemAdapter)) {
		new Notice('This version of Obsidian cannot create a PDF, so an HTML file was exported instead. Open it in a browser and print it.', 10000);
		return exportHtml(plugin, file);
	}
	const notice = new Notice('Making the PDF…', 0);
	// The page is written for a moment into YAAS's own plugin folder, through Obsidian's file API, so the hidden
	// window can open it as a file: images inside it load the same way as in the HTML export
	const page = `${plugin.manifest.dir ?? ''}/print-${Date.now()}.html`;
	const win = new BrowserWindow({
		show: false,
		width: STAGE_W,
		height: STAGE_H,
		webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
	});
	try {
		await adapter.write(page, await sharePage(plugin, file));
		await win.loadFile(adapter.getFullPath(page));
		// Let images decode before printing
		await new Promise((resolve) => window.setTimeout(resolve, 600));
		const pdf = await win.webContents.printToPDF({
			printBackground: true,
			preferCSSPageSize: true,
			pageSize: { width: STAGE_W / 96, height: STAGE_H / 96 },
			margins: { top: 0, bottom: 0, left: 0, right: 0 },
		});
		const path = exportPath(file, 'pdf');
		await save(plugin, path, pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer);
		notice.hide();
		exported(plugin, path, 'PDF saved to');
		return path;
	} catch (error) {
		console.error('YAAS PDF export', error);
		notice.hide();
		new Notice(`The PDF could not be made (${error instanceof Error ? error.message : String(error)}).`, 10000);
		return null;
	} finally {
		win.destroy();
		adapter.remove(page).catch(() => { /* already gone */ });
	}
}

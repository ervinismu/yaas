// The parts of Electron YAAS uses, reached through Obsidian's desktop app. Each is null on mobile, or when an
// Obsidian version no longer offers it, and YAAS falls back
export interface PdfWindow {
	loadFile(path: string): Promise<void>;
	webContents: {
		printToPDF(options: {
			printBackground: boolean;
			preferCSSPageSize: boolean;
			pageSize: { width: number; height: number };
			margins: { top: number; bottom: number; left: number; right: number };
		}): Promise<Uint8Array>;
	};
	destroy(): void;
}

type BrowserWindowClass = new (options: {
	show: boolean;
	width: number;
	height: number;
	webPreferences: { nodeIntegration: boolean; contextIsolation: boolean; sandbox: boolean };
}) => PdfWindow;

interface Electron {
	shell?: { openExternal(url: string): Promise<void> };
	remote?: { BrowserWindow?: BrowserWindowClass };
}

function load<T>(id: string): T | null {
	const loader = (window as unknown as { require?: (id: string) => unknown }).require;
	try {
		return (loader?.(id) as T | undefined) ?? null;
	} catch {
		return null;
	}
}

/** Opens a link in the computer's own browser, not Obsidian's web viewer */
export function openExternal(url: string): boolean {
	const shell = load<Electron>('electron')?.shell;
	if (!shell) return false;
	shell.openExternal(url).catch(() => window.open(url));
	return true;
}

/** A hidden browser window that can print a page to PDF, or null when this Obsidian cannot make one */
export function pdfWindowClass(): BrowserWindowClass | null {
	return load<Electron>('electron')?.remote?.BrowserWindow
		?? load<{ BrowserWindow?: BrowserWindowClass }>('@electron/remote')?.BrowserWindow
		?? null;
}

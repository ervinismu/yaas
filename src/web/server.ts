// The live preview: a small web server on this computer only, http://localhost:<port>/?file=…&key=…
import { TFile } from 'obsidian';
import { imageType } from '../constants';
import type YaasPlugin from '../main';
import { loadHttp, type HttpRequest, type HttpResponse, type HttpServer } from './http';
import { previewPage } from './viewer';

export class WebPreview {
	private server: HttpServer | null = null;
	private port = 0;
	/** Open event streams, each with the note it follows */
	private clients = new Map<HttpResponse, string>();
	// Every link carries this key: another website open in the browser cannot guess it to read the vault
	readonly token = Array.from(window.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

	constructor(private plugin: YaasPlugin) {}

	get running(): boolean {
		return Boolean(this.server?.listening);
	}

	url(file: TFile): string {
		return `http://localhost:${this.port}/?file=${encodeURIComponent(file.path)}&key=${this.token}`;
	}

	start(): Promise<void> {
		const port = this.plugin.settings.port;
		const http = loadHttp();
		if (!http) return Promise.reject(new Error('The browser preview needs the desktop app.'));
		return new Promise((resolve, reject) => {
			const server = http.createServer((req, res) => {
				this.handle(req, res).catch((error) => {
					console.error('YAAS web preview', error);
					if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
					res.end('YAAS could not draw this deck.');
				});
			});
			server.once('error', reject);
			// 127.0.0.1 only: nothing on the network can reach it
			server.listen(port, '127.0.0.1', () => {
				this.server = server;
				this.port = port;
				resolve();
			});
		});
	}

	stop(): void {
		for (const res of this.clients.keys()) res.end();
		this.clients.clear();
		this.server?.close();
		this.server = null;
	}

	/** A note was saved: pages showing it draw it again */
	changed(file: TFile): void {
		for (const [res, path] of this.clients) if (path === file.path) res.write('data: change\n\n');
	}

	private note(url: URL): TFile | null {
		const file = this.plugin.app.vault.getAbstractFileByPath(url.searchParams.get('file') ?? '');
		return file instanceof TFile && file.extension === 'md' ? file : null;
	}

	private async handle(req: HttpRequest, res: HttpResponse): Promise<void> {
		const send = (status: number, type: string, body: string | Uint8Array, headers: Record<string, string> = {}) => {
			res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
			res.end(body);
		};
		// Only this computer's own names: a page that points another domain name at 127.0.0.1 is refused
		const host = (req.headers.host ?? '').replace(/:\d+$/, '');
		if (host !== 'localhost' && host !== '127.0.0.1') return send(403, 'text/plain', 'Forbidden');
		if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
		const url = new URL(req.url ?? '/', 'http://localhost');
		if (url.searchParams.get('key') !== this.token) return send(403, 'text/plain', 'This link is not valid any more: open the deck again from Obsidian.');

		if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', previewPage(this.token));
		if (url.pathname === '/yaas.css') return send(200, 'text/css; charset=utf-8', await this.plugin.css());
		if (url.pathname === '/deck.json') {
			const file = this.note(url);
			if (!file) return send(404, 'application/json', '{}');
			return send(200, 'application/json; charset=utf-8', JSON.stringify(await this.plugin.deckData(file)));
		}
		if (url.pathname === '/events') {
			const file = this.note(url);
			if (!file) return send(404, 'text/plain', 'Not found');
			res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
			res.write(': yaas\n\n');
			this.clients.set(res, file.path);
			const beat = window.setInterval(() => res.write(': beat\n\n'), 25000);
			req.on('close', () => {
				window.clearInterval(beat);
				this.clients.delete(res);
			});
			return;
		}
		if (url.pathname.startsWith('/file/')) {
			// Images only, found by their path inside the vault
			const file = this.plugin.app.vault.getAbstractFileByPath(decodeURIComponent(url.pathname.slice(6)));
			const type = file instanceof TFile ? imageType(file.extension) : undefined;
			if (!(file instanceof TFile) || !type) return send(404, 'text/plain', 'Not found');
			const bytes = new Uint8Array(await this.plugin.app.vault.readBinary(file));
			return send(200, type, bytes, { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
		}
		send(404, 'text/plain', 'Not found');
	}
}

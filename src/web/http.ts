// The few parts of Node's http module the browser preview uses, typed here and reached through Obsidian's desktop
// app like Electron is (see export/electron.ts)
export interface HttpRequest {
	method?: string;
	url?: string;
	headers: { host?: string };
	on(event: 'close', listener: () => void): void;
}

export interface HttpResponse {
	headersSent: boolean;
	writeHead(status: number, headers: Record<string, string>): void;
	write(chunk: string): void;
	end(body?: string | Uint8Array): void;
}

export interface HttpServer {
	listening: boolean;
	once(event: 'error', listener: (error: Error) => void): void;
	listen(port: number, host: string, listener: () => void): void;
	close(): void;
}

interface Http {
	createServer(handler: (req: HttpRequest, res: HttpResponse) => void): HttpServer;
}

/** Node's http module, or null where there is none (mobile) */
export function loadHttp(): Http | null {
	const loader = (window as unknown as { require?: (id: string) => unknown }).require;
	try {
		return (loader?.('http') as Http | undefined) ?? null;
	} catch {
		return null;
	}
}

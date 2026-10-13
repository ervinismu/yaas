/** Any CSS colour as #rrggbb, for colour pickers and for comparing colours; black when it is not a colour */
export function toHex(value: string | undefined): string {
	if (!value) return '#000000';
	if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
	if (/^#[0-9a-f]{3}$/i.test(value)) return `#${value.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase();
	const context = createEl('canvas').getContext('2d');
	if (!context) return '#000000';
	context.fillStyle = '#000000';
	context.fillStyle = value;
	return /^#[0-9a-f]{6}$/i.test(context.fillStyle) ? context.fillStyle : '#000000';
}

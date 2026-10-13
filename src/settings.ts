import { App, Platform, PluginSettingTab, Setting } from 'obsidian';
import { COLOR_JOBS } from './constants';
import { toHex } from './ui/color';
import type YaasPlugin from './main';

export interface YaasSettings {
	bg: string;
	text: string;
	accent: string;
	/** A font installed on the computer; empty: Obsidian's interface font */
	font: string;
	/** Show 3 / 7 in the corner */
	counter: boolean;
	/** A line along the bottom of the slide */
	progress: boolean;
	/** The browser preview's port on localhost */
	port: number;
}

export const DEFAULT_SETTINGS: YaasSettings = {
	bg: '#FFF3E2',
	text: '#241722',
	accent: '#D01C7F',
	font: '',
	counter: true,
	progress: true,
	port: 3939,
};

export class YaasSettingTab extends PluginSettingTab {
	plugin: YaasPlugin;

	constructor(app: App, plugin: YaasPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Default colours')
			.setHeading()
			.setDesc("For every deck. A note's deck colours and each slide's own colours, set in the slides panel, come first.");
		for (const [key, label, job] of COLOR_JOBS) {
			new Setting(containerEl)
				.setName(label)
				.setDesc(job)
				.addColorPicker((picker) => picker
					.setValue(toHex(this.plugin.settings[key]))
					.onChange(async (value) => {
						this.plugin.settings[key] = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl).setName('On every slide').setHeading();
		new Setting(containerEl)
			.setName('Font')
			.setDesc("The name of a font installed on this computer. Leave it empty to use Obsidian's interface font.")
			.addText((text) => text.setValue(this.plugin.settings.font).onChange(async (value) => {
				this.plugin.settings.font = value.trim();
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('Slide number')
			.setDesc('Show 3 / 7 in the corner.')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.counter).onChange(async (value) => {
				this.plugin.settings.counter = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName('Progress line')
			.setDesc('A line along the bottom of the slide, filled up to the slide you are on.')
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.progress).onChange(async (value) => {
				this.plugin.settings.progress = value;
				await this.plugin.saveSettings();
			}));

		if (Platform.isDesktopApp) {
			new Setting(containerEl).setName('Browser preview').setHeading();
			new Setting(containerEl)
				.setName('Port')
				.setDesc('The address is http://localhost:<port>. Takes effect the next time a deck is opened in the browser.')
				.addText((text) => text.setValue(String(this.plugin.settings.port)).onChange(async (value) => {
					const port = Number(value);
					if (!Number.isInteger(port) || port < 1024 || port > 65535) return;
					this.plugin.settings.port = port;
					await this.plugin.saveSettings();
					this.plugin.web.stop();
				}));
		}
	}
}

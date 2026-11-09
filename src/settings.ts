import { App, PluginSettingTab, Setting } from 'obsidian';
import BackupMyShitPlugin from './main.js';
import FancyTimer from './fancyTimer.js';

export interface BackupSettings {
	git_committer: string;
	git_author: string;
	git_email: string;
	save_delay_sec: number;
	close_delay_sec: number;
	setting_delay_sec: number;
}

export const DEFAULT_SETTINGS: BackupSettings = {
	git_committer: 'BackupMySh*t Automated Process',
	git_author: 'Username',
	git_email: 'user@email.com',
	save_delay_sec: 5,
	close_delay_sec: 2,
	setting_delay_sec: 2,
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: BackupMyShitPlugin;
	private timer: FancyTimer;

	constructor(app: App, plugin: BackupMyShitPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		this.timer = FancyTimer.create(() => {
			plugin.saveSettings()
		})
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Git Author')
			.setDesc("Username used in the author field of git commits")
			.addText((text) =>
				text
					.setPlaceholder('username')
					.setValue(this.plugin.settings.git_author)
					.onChange(async (value) => {
						this.plugin.settings.git_author = value != "" ? value : DEFAULT_SETTINGS.git_author;
						this.timer.reset(this.plugin.settings.setting_delay_sec * 1000);
					}),
			);

		new Setting(containerEl)
			.setName('Git Email')
			.setDesc("Email used in git commits")
			.addText((text) =>
				text
					.setPlaceholder('email')
					.setValue(this.plugin.settings.git_email)
					.onChange(async (value) => {
						this.plugin.settings.git_email = value != "" ? value : DEFAULT_SETTINGS.git_email;
						this.timer.reset(this.plugin.settings.setting_delay_sec * 1000);
					}),
			);

		new Setting(containerEl)
			.setName('Git Committer')
			.setDesc("Committer name used in git commits")
			.addText((text) =>
				text
					.setPlaceholder('email')
					.setValue(this.plugin.settings.git_committer)
					.onChange(async (value) => {
						this.plugin.settings.git_email = value != "" ? value : DEFAULT_SETTINGS.git_committer;
						this.timer.reset(this.plugin.settings.setting_delay_sec * 1000);
					}),
			);

		new Setting(containerEl)
			.setName('Saving delay')
			.setDesc("Seconds of inactivity before `git add *` command is run")
			.addSlider((number) =>
				number
					.setValue(this.plugin.settings.save_delay_sec)
					.setLimits(.5, 120, .5)
					.onChange(async (value) => {
						this.plugin.settings.save_delay_sec = value;
						this.timer.reset(this.plugin.settings.setting_delay_sec * 1000);
					}),
			);

		new Setting(containerEl)
			.setName('Closing delay')
			.setDesc("Seconds of inactivity in file closing before `git add *` command is run")
			.addSlider((number) =>
				number
					.setValue(this.plugin.settings.close_delay_sec)
					.setLimits(.5, 10, .5)
					.onChange(async (value) => {
						this.plugin.settings.close_delay_sec = value;
						this.timer.reset(this.plugin.settings.setting_delay_sec * 1000);
					}),
			);

	}
}

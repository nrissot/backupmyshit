import {
	Notice,
	Plugin,
	FileSystemAdapter,
	setIcon,
	Hotkey,
} from 'obsidian';

import {
	DEFAULT_SETTINGS,
	BackupSettings,
	SampleSettingTab,
} from './settings.js';

import GitManager from './gitManager.js'
import FancyTimer from './fancyTimer.js'

type Status = "Processing"
	| "Staged"
	| "Committed"
	| "Pushed"
	| "Error"
	| "Init"
	;

// Remember to rename these classes and interfaces!
export default class BackupMyShitPlugin extends Plugin {
	// state
	statusIcon!: HTMLElement;
	settings!: BackupSettings;
	status!: Status;
	openLeavesCount: number = 0;

	// tools / libs
	timer!: FancyTimer;
	git!: GitManager;

	async onload() {
		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.statusIcon = this.addStatusBarItem();
		this.statusIcon.setAttribute("data-tooltip-position", "top");

		this.updateStatus("Init");

		await this.loadSettings();

		// can technically fail when using a non local vault, not my usecase.
		this.git = await GitManager.create(
			// @ts-ignore				
			(this.app.vault.adapter as FileSystemAdapter).basePath,
			this.settings.git_author,
			this.settings.git_committer,
			this.settings.git_email,
		);

		// get the number of opened tabs
		this.app.workspace.onLayoutReady(() => {
			this.openLeavesCount = this.app.workspace.getLeavesOfType('markdown').length;
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// set up the timer object in order to not overload git
		this.timer = FancyTimer.create((plugin: BackupMyShitPlugin) => {
			plugin.git.addAll()
				.then(async () => {
					plugin.updateStatus("Staged")
				})
				.catch((error) => {
					console.error(error);
					new Notice('Error when staging');
					plugin.updateStatus("Error");
				})
		}, this);

		if (this.git.stagedFilesCount > 0) {
			this.updateStatus("Staged");
		} else if (await this.git.isLastCommitPushed()) {
			this.updateStatus("Pushed");
		} else {
			this.updateStatus("Committed")
		}
		this.statusIcon.setAttr("aria-label", this.customLabel())


		// register the on file modification (ie, on file save) event
		this.registerEvent(this.app.vault.on('modify', () => {
			this.timer.reset(this.settings.save_delay_sec * 1000);
			this.updateStatus("Processing");
		}));

		// register the on file close* event
		// (*almost, it doent exist, so this is a silly fix)
		this.registerEvent(this.app.workspace.on('layout-change', () => {
			const currentLeaveCount = this.app.workspace.getLeavesOfType("markdown").length
			if (currentLeaveCount < this.openLeavesCount) {
				this.timer.reset(this.settings.close_delay_sec * 1000);
				this.updateStatus("Processing");
			}
			this.openLeavesCount = currentLeaveCount;
		}));

		// register the commit command
		this.addCommand({
			id: "commit",
			name: "Commit changes to local git repo",
			callback: this.attemptCommit
		});

		this.addCommand({
			id: "push",
			name: "Push changes to remote git repo",
			callback: this.attemptPush
		});

		this.addCommand({
			id: "add-all",
			name: "Stage every file contents",
			callback: async () => {
				await this.timer.interrupt();
			},
			hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'S' }],
		});

		this.statusIcon.addEventListener("click", () => {
			switch (this.status) {
				case "Staged": {
					this.attemptCommit();
					break;
				}
				case "Committed": {
					this.attemptPush();
					break;
				}
				default: { }
			}
		});

		this.statusIcon.addEventListener("mouseenter", () => {
			this.statusIcon.setAttr("aria-label", this.customLabel())
		})

	}

	onunload() {
		try {
			this.timer.cancel();
		} catch { }
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BackupSettings>,
		);

	}

	attemptCommit = () => {
		this.git.commit()
			.then(async () => {
				new Notice("Commit successful")
				this.updateStatus("Committed")
			})
			.catch(async (error) => {
				console.error(error);
				new Notice(`Unable to Commit: ${error}`);
				this.updateStatus("Error");
			})
			;
	};

	attemptPush = () => {
		this.updateStatus("Processing");
		this.git.push()
			.then(() => {
				new Notice("Push successful");
				this.updateStatus("Pushed");
			})
			.catch((error) => {
				console.error(error);
				new Notice(`Unable to Push: ${error.message}`);
				this.updateStatus("Error");
			})
			;
	}

	customLabel(): string {
		let text = `last commit: [${this.git.lastCommitHash}] (${this.git.lastCommitTime.fromNow()})`;
		if (this.status === "Committed") {
			text = `${text}\nPush Changes (${this.git.unpushedCommits} commit${this.git.unpushedCommits > 1 ? 's' : ''})`;
		} else if (this.status === "Staged") {
			text = `${text}\nCommit Changes (${this.git.stagedFilesCount} file${this.git.stagedFilesCount > 1 ? 's' : ''})`;

		}
		return text
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.git.updateConfig(this.settings).then(
			(msgs) => {
				msgs.forEach(element => {
					new Notice(element)
				});
			}
		)
	}

	public updateStatus(status: Status) {
		this.status = status
		this.statusIcon.toggleClass('danger', status === "Error");
		this.statusIcon.toggleClass('mod-clickable', status === "Staged" || status === "Committed")
		switch (status) {
			case "Init": {
				setIcon(this.statusIcon, "check");
				// this.statusIcon.setAttr("aria-label", "Loaded Successfully");
				break;
			}
			case "Processing": {
				// this.statusIcon.setAttr("aria-label", "Processing Changes");
				setIcon(this.statusIcon, "refresh-ccw");
				break;
			}
			case "Error": {
				setIcon(this.statusIcon, "git-merge-conflict");
				break;
			}
			case "Staged": {
				setIcon(this.statusIcon, "file-diff");
				// this.statusIcon.setAttr("aria-label", "Commit Changes");
				break;
			}
			case "Committed": {
				setIcon(this.statusIcon, "git-commit-vertical");
				// this.statusIcon.setAttr("aria-label", "Push Changes");
				break;
			}
			case "Pushed": {
				// this.statusIcon.setAttr("aria-label", "Pushed Successfully");
				setIcon(this.statusIcon, "globe");
				break;
			}
		}
	}
}


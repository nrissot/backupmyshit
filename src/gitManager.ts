import { execFile } from 'child_process';
import {
	BackupSettings,
} from './settings.js';
import {
	moment,
	Notice,
} from 'obsidian';
import { Mutex } from './mutex.js';

export default class GitManager {
	private mutex: Mutex = new Mutex();
	public lastCommitHash!: string;
	public lastCommitTime!: moment.Moment;
	public stagedFilesCount!: number;
	public unpushedCommits!: number;

	constructor(
		private vaultRoot: string,
		private author: string,
		private committer: string,
		private email: string,
	) { }

	static async create(
		vaultRoot: string,
		author: string,
		committer: string,
		email: string,
	): Promise<GitManager> {
		const manager = new GitManager(
			vaultRoot,
			author,
			committer,
			email,
		)

		await manager.execute(["config", "user.email", email])
			.catch((error) => {
				console.error(error)
				new Notice("unable to set git commit email")
			});
		await manager.execute(["config", "user.name", committer])
			.catch((error) => {
				console.error(error)
				new Notice("unable to set git committer name")
			});
		manager.lastCommitTime = moment(await manager.getLastCommitTimeStamp(), "YYYY-MM-DD HH:mm:ss");
		manager.lastCommitHash = await manager.getLastCommitHash()
		manager.stagedFilesCount = await manager.getStagedFilesCount();
		manager.unpushedCommits = await manager.getUnpushCommitsCount();

		return manager;
	}



	async updateConfig(settings: BackupSettings): Promise<string[]> {
		let messages: string[] = [];

		if (this.author !== settings.git_author) {
			this.author = settings.git_author;
			messages.push("updated git commit author")
		}
		if (this.email !== settings.git_email) {
			await this.execute(["config", "user.email", settings.git_email])
				.then(() => {
					this.email = settings.git_email;
					messages.push("updated git commit email")
				}).catch((error) => {
					console.error(error)
					messages.push("unable to update git commit email")
				})
				;
		}
		if (this.committer !== settings.git_committer) {
			await this.execute(["config", "user.name", settings.git_committer])
				.then(() => {
					this.committer = settings.git_committer;
					messages.push("updated git committer name")
				}).catch((error) => {
					console.error(error)
					messages.push("unable to update git committer name")
				});
		}
		return messages;
	}

	async addAll(): Promise<string> {
		const out = this.execute(["add", "-A"])
		this.stagedFilesCount = await this.getStagedFilesCount();
		return out
	}

	async commit(): Promise<string> {
		const count = await this.getStagedFilesCount()
		if (count === 0) {
			return "nothing to commit"
		}
		const commit_message = this._commitMessage(count)
		await this.execute(["commit", "-m", commit_message, "--author", `${this.author} <${this.email}>`])
		
		this.lastCommitHash = await this.getLastCommitHash();
		this.lastCommitTime = moment();
		this.unpushedCommits++;
		
		return commit_message;
	}

	async push(): Promise<string> {
		return this.execute(["push", "-v"]).then(
			(value) => {
				this.unpushedCommits = 0;
				return value;
		});
	}

	getLastCommitMessage(): Promise<string> {
		return this.execute(["log", "--pretty=format:%s", "-1"])
	}

	getLastCommitTimeStamp(): Promise<string> {
		return this.execute(["log", "-1", '--date=format:%Y-%m-%d %T', "--format=%ad"])
	}

	getLastCommitHash(): Promise<string> {
		return this.execute(["log", "--pretty=format:%h", "-1"])
	}

	async isLastCommitPushed(): Promise<boolean> {
		try {
			await this.execute(["merge-base", "--is-ancestor", "HEAD", "@{u}"], false)
			return true
		} catch {
			return false;
		}
		;
	}

	async getUnpushCommitsCount(): Promise<number> {
		return parseInt(await this.execute(["rev-list", "--count", "@{u}..HEAD"]))
	}



	async getStagedFilesCount(): Promise<number> {
		const value = await this.execute(["diff", "--cached", "--name-only", "-z"]);
		return value.trim() === "" ? 0 : value.trim().split("\0").length -1;
	}

	private async execute(args: string[], logError:boolean=true) {
		const unlock = await this.mutex.lock()
		try {

			return new Promise<string>((resolve, reject) => {
				execFile(
					"git",
					args,
				{
					cwd: this.vaultRoot,
					encoding: 'utf-8',
					timeout: 120 * 1000 // 2 minutes
				},
				(error, stdout, stderr) => {
					if (error) {
						if (logError) { console.error(stderr) }
						reject(error);
					} else {
						resolve(stdout.trim());
					}
				})
			})
		} finally {
			unlock();
		}
	}


	private _commitMessage(count: number) {
		const timestamp = moment().format("YYYY-MM-DD HH[h]mm")
		const fileOrFiles = (count < 2) ? 'file' : 'files'

		return `${timestamp} (${count} ${fileOrFiles})`;
	}
}
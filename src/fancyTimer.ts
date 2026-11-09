import { setIcon } from "obsidian";

export default class FancyTimer {
	timer!: NodeJS.Timeout;

	constructor(
		private handler:(...args:any) => void,
		private args:any[],
	) { }

	public static create(
		handler:(...args:any) => void,
		...args:any
	): FancyTimer {
		return new FancyTimer(handler, args)
	}

	private async _done() {
		// method executed at the end of the timer.
		await this.handler(...this.args);
	}

	reset(delay_milliseconds:number) {
		// reset the timer to the specified delay.
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {this._done()}, delay_milliseconds);
	}

	async interrupt() {
		// stops the timer if it was running, execute the callback immediately.
		clearTimeout(this.timer);
		await this._done()
	}

	cancel() {
		clearTimeout(this.timer);
	}
}
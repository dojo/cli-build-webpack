export interface Callback {
	(...args: any[]): any;
}

export interface Plugins {
	[name: string]: Callback[];
}

export default class Pluginable {
	plugins: Plugins;

	constructor() {
		this.plugins = Object.create(null) as Plugins;
	}

	mockApply(name: string, ...args: any[]) {
		const callbacks = this.plugins[name];

		if (callbacks) {
			return callbacks.map((callback: Callback) => callback.apply(this, args));
		}

		return [];
	}

	plugin(name: string, callback: Callback) {
		let callbacks = this.plugins[name];

		if (!callbacks) {
			callbacks = this.plugins[name] = [];
		}

		callbacks.push(callback);
	}
}

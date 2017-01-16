let instances: MockPlugin[] = [];
export default class MockPlugin {
	static instances() {
		return instances.slice();
	}

	static reset() {
		instances = [];
	}

	options: any;

	constructor(options: any) {
		instances.push(this);
		this.options = options;
	}

	apply() {}
}

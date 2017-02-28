import Pluginable from './Pluginable';

class MockChunk extends Pluginable {
	modules: any[];

	constructor() {
		super();
		this.modules = [];
	}

	addModule(module: any) {
		this.modules.push(module);
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = MockChunk;

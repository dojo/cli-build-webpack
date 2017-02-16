import Pluginable from './Pluginable';

import CompilationParams = require('./CompilationParams');

class Compiler extends Pluginable {
	applied: any[];
	options: any;

	constructor(options?: any) {
		super();
		this.applied = [];
		this.options = options || {
			resolve: {
				modules: [ '/root/path' ]
			}
		};
	}

	apply(...args: any[]) {
		this.applied = this.applied.concat(args);
	}

	mockApply(name: string, ...args: any[]) {
		if (name === 'compilation' && args.length === 1) {
			args[1] = new CompilationParams();
		}
		return super.mockApply(name, ...args);
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = Compiler;

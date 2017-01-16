import Parser = require('./Parser');
import Pluginable from './Pluginable';

class Compiler extends Pluginable {
	applied: any[];
	options: any;
	parser: Parser;

	constructor(options?: any) {
		super();
		this.applied = [];
		this.parser = new Parser();
		this.options = options || {
			resolve: {
				root: '/root/path'
			}
		};
	}

	apply(...args: any[]) {
		this.applied = this.applied.concat(args);
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = Compiler;

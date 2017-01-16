import NormalModule = require('./NormalModule');
import Pluginable from './Pluginable';

interface ParserState {
	current?: NormalModule;
}

class Parser extends Pluginable {
	state: ParserState;

	constructor(options?: any) {
		super();
		this.state = {} as ParserState;
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = Parser;

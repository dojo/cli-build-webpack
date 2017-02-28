import Pluginable from './Pluginable';
import Parser = require('./Parser');

class MockCompilationParams {
	normalModuleFactory: Pluginable;
	parser: Parser;

	constructor() {
		this.normalModuleFactory = new Pluginable();
		this.parser = new Parser();
	}
}

export = MockCompilationParams;

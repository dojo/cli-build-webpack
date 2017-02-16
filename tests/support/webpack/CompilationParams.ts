import Pluginable from './Pluginable';
import Parser = require('./Parser');

class CompilationParams {
	normalModuleFactory: Pluginable;
	parser: Parser;

	constructor() {
		this.normalModuleFactory = new Pluginable();
		this.parser = new Parser();
	}
}

export = CompilationParams;

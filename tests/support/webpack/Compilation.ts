import Pluginable from './Pluginable';
import { Callback } from '../../../src/plugins/interfaces';

class Compilation extends Pluginable {
	inputFileSystem: any;
	options: any;
	modules: any[];
	moduleTemplate: Pluginable;
	resolvers: any[];

	constructor(options?: any) {
		super();
		this.inputFileSystem = Object.create(null);
		this.modules = [];
		this.moduleTemplate = new Pluginable();
		this.resolvers = [];
		this.options = options || {
			resolve: {
				modules: [ '/root/path' ]
			}
		};
	}

	addModule(module: any) {
		this.modules.push(module);
	}

	buildModule(module: any, callback: Callback) {
		module.isBuilt = true;
		callback();
	}

	processModuleDependencies(module: any, callback: Callback) {
		module.dependenciesProcessed = true;
		callback();
	}
}

// Node-style export used to maintain consistency with other webpack mocks.
export = Compilation;

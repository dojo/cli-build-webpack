import * as mockery from 'mockery';
import * as sinon from 'sinon';
import * as path from 'path';

function load(modulePath: string): any {
	return require(modulePath);
}

function resolvePath(basePath: string, modulePath: string): string {
	return modulePath.replace('./', `${basePath}/`);
}

export type MockDependency = string | { name: string; mock: any };

export default class MockModule {
	private basePath: string;
	private moduleUnderTestPath: string;
	private mocks: any;
	private sandbox: sinon.SinonSandbox;

	constructor(moduleUnderTestPath: string, require: NodeRequire) {
		this.moduleUnderTestPath = require.resolve(moduleUnderTestPath);
		this.basePath = path.dirname(this.moduleUnderTestPath);
		this.sandbox = sinon.sandbox.create();
		this.mocks = {};
	}

	dependencies(dependencies: MockDependency[]): void {
		dependencies.forEach((dependency) => {
			if (typeof dependency === 'string') {
				let module = load(resolvePath(this.basePath, dependency));
				const mock: any = {};

				for (let prop in module) {
					if (typeof module[prop] === 'function') {
						mock[prop] = function () {};
						this.sandbox.stub(mock, prop);
					} else {
						mock[prop] = module[prop];
					}
				}

				if (typeof module === 'function') {
					const ctor = this.sandbox.stub().returns(mock);
					Object.assign(ctor, mock);
					mockery.registerMock(dependency, ctor);
					mock.ctor = ctor;
				}
				else {
					mockery.registerMock(dependency, mock);
				}
				this.mocks[dependency] = mock;
			}
			else {
				const { name, mock } = dependency;
				mockery.registerMock(name, mock);
				this.mocks[name] = mock;
			}
		});
	}

	getMock(dependencyName: string): any {
		return this.mocks[dependencyName];
	}

	getModuleUnderTest(): any {
		this.start();
		const allowable = require(this.moduleUnderTestPath) + '.js';
		mockery.registerAllowable(allowable, true);
		return load(this.moduleUnderTestPath);
	}

	destroy(): void {
		this.sandbox.restore();
		mockery.deregisterAll();
		mockery.disable();
	}

	start() {
		mockery.enable({ warnOnUnregistered: false, useCleanCache: true });
	}
}

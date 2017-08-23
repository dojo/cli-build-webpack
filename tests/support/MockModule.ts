import { RootRequire } from '@dojo/interfaces/loader';
import * as mockery from 'mockery';
import * as sinon from 'sinon';

declare const require: RootRequire;
const dojoNodePlugin = 'intern/dojo/node';

function load(modulePath: string): any {
	const mid = `${dojoNodePlugin}!${modulePath}`;
	return require(mid);
}

function unload(modulePath: string): void {
	const abs = require.toUrl(modulePath);
	const plugin = require.toAbsMid(dojoNodePlugin);
	require.undef(`${plugin}!${abs}`);
}

function resolvePath(basePath: string, modulePath: string): string {
	return modulePath.replace('./', `${basePath}/`);
}

function getBasePath(modulePath: string): string {
	const chunks = modulePath.split('/');
	chunks.pop();
	return chunks.join('/');
}

export type MockDependency = string | { name: string; mock: any };

export default class MockModule {
	private basePath: string;
	private moduleUnderTestPath: string;
	private mocks: any;
	private sandbox: sinon.SinonSandbox;

	constructor(moduleUnderTestPath: string) {
		this.basePath = getBasePath(moduleUnderTestPath);
		this.moduleUnderTestPath = moduleUnderTestPath;
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
		const allowable = require.toUrl(this.moduleUnderTestPath) + '.js';
		mockery.registerAllowable(allowable, true);
		return load(this.moduleUnderTestPath);
	}

	destroy(): void {
		unload(this.moduleUnderTestPath);
		for (let mock in this.mocks) {
			unload(resolvePath(this.basePath, mock));
		}
		this.sandbox.restore();
		mockery.deregisterAll();
		mockery.disable();
	}

	start() {
		mockery.enable({ warnOnUnregistered: false, useCleanCache: true });
	}
}

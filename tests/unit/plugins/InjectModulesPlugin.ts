import { beforeEach, describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import * as path from 'path';
import * as sinon from 'sinon';
import Pluginable from '../../support/webpack/Pluginable';
import InjectModulesPlugin from '../../../src/plugins/InjectModulesPlugin';
import { assign } from '@dojo/core/lang';
import NormalModuleFactory = require('webpack/lib/NormalModuleFactory');
import MockChunk = require('../../support/webpack/Chunk');
import MockCompilation = require('../../support/webpack/Compilation');
import MockCompiler = require('../../support/webpack/Compiler');
import MockNormalModule = require('../../support/webpack/NormalModule');

function createModule(path: string): MockNormalModule {
	return new MockNormalModule(path, path, path, [], path, {});
}

function getRequestData(data?: any): NormalModuleFactory.AfterData {
	return assign({
		request: '/path/to/module.js',
		userRequest: '/path/to/module.js',
		rawRequest: './module',
		loaders: [],
		resource: '/path/to/module.js',
		parser: null
	}, data);
}

describe('inject-modules', () => {
	it('validates module IDs', () => {
		assert.throws(() => {
			new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: []
			});
		});
		assert.throws(() => {
			new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: {
					'/context': []
				}
			});
		});
		assert.doesNotThrow(() => {
			new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});
		});
	});

	describe('InjectModulesPlugin#resolve', () => {
		it('should resolve relative paths', () => {
			const data = getRequestData();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			let input: any;
			const resolver = function (value: any, callback: NormalModuleFactory.ResolverCallback) {
				input = value;
				callback(null, data);
			};

			return plugin.resolve('/parent/module', resolver)
				.then((result: any[]) => {
					assert.sameDeepMembers(result, [ data ]);
					assert.deepEqual(input, {
						context: '/parent',
						request: './module'
					}, 'The context is issuer.');
				})
				.then(() => {
					plugin.moduleIds = {
						'/context': [ './module' ]
					};
					return plugin.resolve('/parent/module', resolver);
				})
				.then((result: any[]) => {
					assert.sameDeepMembers(result, [ data ]);
					assert.deepEqual(input, {
						context: '/parent',
						request: './module'
					}, 'The context is issuer even when a context for the module is provided.');
				});
		});

		it('should resolve absolute paths', () => {
			const data = getRequestData();
			const plugin = new InjectModulesPlugin({
				context: '/base/path',
				resourcePattern: /test\/module/,
				moduleIds: [ 'module' ]
			});

			let input: any;
			const resolver = function (value: any, callback: NormalModuleFactory.ResolverCallback) {
				input = value;
				callback(null, data);
			};

			return plugin.resolve('/parent/module', resolver)
				.then((result: any[]) => {
					assert.sameDeepMembers(result, [ data ]);
					assert.deepEqual(input, {
						context: '/base/path',
						request: 'module'
					}, 'The default context is used.');
				})
				.then(() => {
					plugin.moduleIds = {
						'/context': [ 'module' ]
					};
					return plugin.resolve('/parent/module', resolver);
				})
				.then((result: any[]) => {
					assert.sameDeepMembers(result, [ data ]);
					assert.deepEqual(input, {
						context: '/context',
						request: 'module'
					}, 'The specified context is used.');
				});
		});

		it('should fail on error', () => {
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ 'module' ]
			});

			const resolver = function (value: any, callback: NormalModuleFactory.ResolverCallback) {
				callback(new Error('mock error'));
			};

			return plugin.resolve('/parent/module', resolver)
				.then(() => {
					throw new Error('Promise should not resolve.');
				}, (error: Error) => {
					assert.strictEqual(error.message, 'mock error');
				});
		});
	});

	describe('InjectModulesPlugin#createModules', () => {
		it('should add modules to the compilation', () => {
			const compilation = new MockCompilation();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});
			const data = getRequestData();

			return plugin.createModules([ data ], compilation as any)
				.then(() => {
					assert.strictEqual(compilation.modules.length, 1);

					const module = compilation.modules[0];
					assert.isTrue(module.isBuilt);
					assert.isTrue(module.dependenciesProcessed);
					assert.instanceOf(module, MockNormalModule);

					[ 'rawRequest', 'request', 'userRequest', 'loaders', 'resource', 'parser' ].forEach((key: string) => {
						assert.strictEqual((<any> module)[key], (<any> data)[key]);
					});
				});
		});

		it('should not add modules to the compilation on a build error', () => {
			const compilation = new MockCompilation();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			sinon.stub(compilation, 'buildModule', (module: MockNormalModule, optional: any, origin: MockNormalModule | null, dependencies: any[] | null, callback: NormalModuleFactory.ResolverCallback) => {
				callback(new Error('build error'));
			});
			sinon.spy(compilation, 'processModuleDependencies');

			return plugin.createModules([ getRequestData() ], compilation as any)
				.then(() => {
					throw new Error('Should not resolve.');
				}, (error: Error) => {
					assert.strictEqual(error.message, 'build error');
					assert.isFalse((<any> compilation.processModuleDependencies).called);
				});
		});

		it('should not add modules to the compilation on a processing modules error', () => {
			const compilation = new MockCompilation();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			sinon.stub(compilation, 'processModuleDependencies', (module: MockNormalModule, callback: NormalModuleFactory.ResolverCallback) => {
				callback(new Error('processing error'));
			});

			return plugin.createModules([ getRequestData() ], compilation as any)
				.then(() => {
					throw new Error('Should not resolve.');
				}, (error: Error) => {
					assert.strictEqual(error.message, 'processing error');
				});
		});
	});

	describe('InjectModulesPlugin#apply', () => {
		it('should register compiler plugins', () => {
			const compiler = new MockCompiler();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			const { plugins } = compiler;

			assert.strictEqual(plugins['compilation'].length, 1);
			assert.strictEqual(plugins['normal-module-factory'].length, 1);
		});

		it('should register compilation plugins', () => {
			const compiler = new MockCompiler();
			const compilation = new MockCompilation();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('compilation', compilation);
			const { plugins } = compilation;

			assert.strictEqual(plugins['optimize-chunks'].length, 1);
		});

		it('should register compilations plugins only once', () => {
			const compiler = new MockCompiler();
			const compilation = new MockCompilation();
			const otherCompilation = new MockCompilation();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('compilation', compilation);
			compiler.mockApply('compilation', otherCompilation);

			assert.strictEqual(compilation.plugins['optimize-chunks'].length, 1);
			assert.notOk(otherCompilation.plugins['optimize-chunks'],
				'Plugins for additional compilations not registered.');
		});

		it('should register factory plugins', () => {
			const compiler = new MockCompiler();
			const factory = new Pluginable();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('normal-module-factory', factory);

			const { plugins } = factory;
			assert.strictEqual(plugins['resolver'].length, 1);
		});

		it('should set the default context', () => {
			const compiler = new MockCompiler();
			let plugin = new InjectModulesPlugin({
				context: '/context',
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			assert.strictEqual(plugin.context, '/context', 'Context not updated.');

			plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});
			plugin.apply(compiler);
			assert.strictEqual(plugin.context, '/root/path', 'The `resolve.root` webpack option is used.');

			plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});
			compiler.options = {
				resolve: {
					modules: [ '/first', '/second' ]
				}
			};
			plugin.apply(compiler);
			assert.strictEqual(plugin.context, '/first', 'The first available `resolve.root` webpack option is used.');

			plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});
			compiler.options = {};
			plugin.apply(compiler);
			assert.strictEqual(plugin.context, path.join(process.cwd(), 'node_modules'),
				'"node_modules" within the current working directory is used.');
		});
	});

	describe('"resolver" factory plugin', () => {
		it('should immediately return on error', () => {
			const compiler = new MockCompiler();
			const factory = new Pluginable();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('normal-module-factory', factory);
			const resolver = factory.mockApply('resolver', (value: any, callback: NormalModuleFactory.ResolverCallback) => {
				callback(new Error('mock error'), value);
			})[0];

			sinon.spy(plugin, 'resolve');
			resolver({ resource: '/path/to/parent.js' }, (error: Error) => {
				assert.strictEqual(error.message, 'mock error');
				assert.isFalse((<any> plugin.resolve).called);
			});
		});

		it('should not generate data for non-matching issuers', () => {
			const compiler = new MockCompiler();
			const factory = new Pluginable();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('normal-module-factory', factory);
			const resolver = factory.mockApply('resolver', (value: any, callback: NormalModuleFactory.ResolverCallback) => {
				callback(null, value);
			})[0];

			sinon.spy(plugin, 'resolve');
			resolver({ resource: '/path/to/parent.js' }, () => {
				assert.isFalse((<any> plugin.resolve).called);
			});
		});

		it('should generate data for matching issuers', () => {
			const compiler = new MockCompiler();
			const factory = new Pluginable();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('normal-module-factory', factory);
			const resolver = factory.mockApply('resolver', (value: any, callback: NormalModuleFactory.ResolverCallback) => {
				callback(null, value);
			})[0];

			sinon.spy(plugin, 'resolve');
			sinon.stub(plugin, 'createModules').returns(Promise.resolve([ getRequestData() ]));

			return new Promise((resolve, reject) => {
				resolver({ resource: '/test/module.js' }, () => {
					resolve();
					assert.isTrue((<any> plugin.resolve).called);
					assert.isTrue((<any> plugin.createModules).calledWith([ { context: '/test', request: './module' } ]));
				});
			});
		});

		it('should not generate data for the same issuer more than once', () => {
			const compiler = new MockCompiler();
			const factory = new Pluginable();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('normal-module-factory', factory);
			const resolver = factory.mockApply('resolver', (value: any, callback: NormalModuleFactory.ResolverCallback) => {
				callback(null, value);
			})[0];

			assert.isFunction(resolver);
			sinon.spy(plugin, 'resolve');

			return new Promise((resolve, reject) => {
				resolver({ resource: '/test/module.js' }, () => {
					(<any> plugin.resolve).restore();
					sinon.spy(plugin, 'resolve');
					resolver({ resource: '/test/module.js' }, () => {
						resolve();
						assert.isFalse((<any> plugin.resolve).called);
					});
				});
			});
		});

		it('should not create modules with a resolve error', () => {
			const compiler = new MockCompiler();
			const factory = new Pluginable();
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('normal-module-factory', factory);
			const resolver = factory.mockApply('resolver', (value: any, callback: NormalModuleFactory.ResolverCallback) => {
				callback(null, value);
			})[0];

			sinon.stub(plugin, 'resolve').returns(Promise.reject(new Error('mock error')));
			sinon.spy(plugin, 'createModules');

			return new Promise((resolve, reject) => {
				resolver({ resource: '/test/module.js' }, (error: Error) => {
					resolve();
					assert.strictEqual(error.message, 'mock error');
					assert.isTrue((<any> plugin.resolve).called);
					assert.isFalse((<any> plugin.createModules).called);
				});
			});
		});
	});

	describe('"optimize-chunks" compilation plugin', () => {
		function generateBuild(plugin: InjectModulesPlugin, issuer: string) {
			return new Promise<MockChunk>(resolve => {
				const chunk = new MockChunk();
				const compilation = new MockCompilation();
				const compiler = new MockCompiler();
				const factory = new Pluginable();

				chunk.modules.push(createModule(issuer));
				plugin.apply(compiler);
				compiler.mockApply('compilation', compilation);
				compiler.mockApply('normal-module-factory', factory);

				const resolver = factory.mockApply('resolver', (value: any, callback: NormalModuleFactory.ResolverCallback) => {
					callback(null, value);
				})[0];

				resolver({ resource: '/test/module.js' }, function () {
					compilation.mockApply('optimize-chunks', [ chunk ]);
					resolve(chunk);
				});
			});
		}

		it('injects modules into the appropriate chunk', () => {
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			sinon.spy(plugin, 'injectModuleDependencies');
			return generateBuild(plugin, '/test/module.js').then(chunk => {
				const module = chunk.modules[1];

				assert.isTrue((<any> plugin.injectModuleDependencies).calledWith(module),
					'Module dependencies are added to the chunk.');
				assert.strictEqual(chunk.modules.length, 2, 'The injected module is added to the chunk.');
				assert.strictEqual(module.chunks.length, 1, 'The chunk is registered with the injected module.');
				assert.strictEqual(module.chunks[0], chunk);
			});
		});

		it('ignores chunks without the matched module', () => {
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			return generateBuild(plugin, '/unmatched/module.js').then(chunk => {
				assert.strictEqual(chunk.modules.length, 1, 'No module is added.');
			});
		});
	});

	describe('InjectModulesPlugin#injectModuleDependencies', () => {
		let plugin: InjectModulesPlugin;
		beforeEach(() => {
			plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});
		});

		it('should add dependencies to the current chunk', () => {
			const chunk = new MockChunk();
			const parent = createModule('/parent.ts');
			const child = createModule('/child.ts');
			const grandChild = createModule('/grandChild.ts');

			parent.dependencies.push({ module: [ child ] }); // `module` can be an array.
			child.dependencies.push({ module: grandChild }); // `module` can be a module.
			plugin.injectModuleDependencies(parent as any, chunk as any);

			assert.strictEqual(chunk.modules.length, 2, 'All descendants added to chunk.');
			assert.strictEqual(child.chunks.length, 1);
			assert.strictEqual(grandChild.chunks.length, 1);
		});

		it('should not register add the same dependencies twice', () => {
			const chunk = new MockChunk();
			const parent = createModule('/parent.ts');
			const child = createModule('/child.ts');

			parent.dependencies.push({ module: [ child ] });
			plugin.injectModuleDependencies(parent as any, chunk as any);
			plugin.injectModuleDependencies(parent as any, chunk as any);

			assert.strictEqual(chunk.modules.length, 1);
			assert.strictEqual(child.chunks.length, 1);
		});
	});

	describe('"done" plugin', () => {
		it('should reset modules added to the compilation', () => {
			const chunk = new MockChunk();
			const compiler = new MockCompiler();
			const parent = createModule('/parent.ts');
			const child = createModule('/child.ts');
			const plugin = new InjectModulesPlugin({
				resourcePattern: /test\/module/,
				moduleIds: [ './module' ]
			});

			parent.dependencies.push({ module: [ child ] });
			plugin.apply(compiler);
			plugin.injectModuleDependencies(parent as any, chunk as any);
			compiler.mockApply('done');
			plugin.injectModuleDependencies(parent as any, chunk as any);

			assert.strictEqual(chunk.modules.length, 2);
		});
	});
});

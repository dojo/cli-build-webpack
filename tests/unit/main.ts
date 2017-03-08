import { afterEach, beforeEach, describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import MockModule from '../support/MockModule';
import { throwImmediately } from '../support/util';
import * as sinon from 'sinon';
import * as fs from 'fs';

describe('main', () => {

	let moduleUnderTest: any;
	let mockModule: MockModule;
	let mockWebpack: any;
	let mockWebpackConfig: any;
	let mockWebpackConfigModule: any;
	let sandbox: sinon.SinonSandbox;
	let mockReadFile: any;

	function getMockConfiguration(config?: any) {
		return {
			configuration: {
				get(name: string) {
					if (config && name in config) {
						return config[name];
					}
				}
			}
		};
	}

	beforeEach(() => {
		process.env.DOJO_CLI = true;

		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../src/main');
		mockModule.dependencies(['./webpack.config', 'webpack', 'webpack-dev-server']);
		mockWebpack = mockModule.getMock('webpack').ctor;
		mockWebpackConfigModule = mockModule.getMock('./webpack.config').ctor;
		mockWebpackConfig = {
			entry: {
				'src/main': [
					'src/main.styl',
					'src/main.ts'
				]
			}
		};
		mockWebpackConfigModule.returns(mockWebpackConfig);
		moduleUnderTest = mockModule.getModuleUnderTest().default;
		sandbox.stub(console, 'log');
		sandbox.stub(console, 'error');
		mockReadFile = sandbox.stub(fs, 'readFileSync');
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should register supported arguments', () => {
		const options = sandbox.stub();
		moduleUnderTest.register(options);
		assert.deepEqual(
			options.firstCall.args,
			[ 'w', { alias: 'watch', describe: 'watch and serve' } ]
		);
		assert.deepEqual(
			options.secondCall.args,
			[ 'p', { alias: 'port', describe: 'port to serve on when using --watch', type: 'number' }],
		);
		assert.deepEqual(
			options.thirdCall.args,
			[ 't', { alias: 'with-tests', describe: 'build tests as well as sources' }]
		);
		assert.deepEqual(
			options.args[3],
			[ 'locale', { describe: 'The default locale for the application', type: 'string' }],
		);
		assert.deepEqual(
			options.args[4],
			[ 'supportedLocales', { describe: 'Any additional locales supported by the application', type: 'array' }]
		);
		assert.deepEqual(
			options.args[5],
			[ 'messageBundles', { describe: 'Any message bundles to include in the build', type: 'array' }]
		);
		assert.deepEqual(
			options.args[6],
			[ 'element', { describe: 'Path to a custom element descriptor factory', type: 'string' }]
		);
		assert.deepEqual(
			options.args[7],
			[ 'elementPrefix', { describe: 'Output file for custom element', type: 'string' }]
		);

		assert.deepEqual(
			options.args[ 8 ],
			[ 'debug', { describe: 'Generate package information useful for debugging', type: 'boolean' } ]
		);
	});

	it('should run compile and log results on success', () => {
		const run = sandbox.stub().yields(false, 'some stats');
		mockWebpack.returns({ run });
		return moduleUnderTest.run(getMockConfiguration(), {}).then(() => {
			assert.isTrue(run.calledOnce);
			assert.isTrue((<sinon.SinonStub> console.log).calledWith('some stats'));
		});
	});

	it('should not print stats if they aren\'t there', () => {
		const run = sandbox.stub().yields(false, null);
		mockWebpack.returns({ run });
		return moduleUnderTest.run(getMockConfiguration(), {}).then(() => {
			assert.isTrue(run.calledOnce);
			assert.isFalse((<sinon.SinonStub> console.log).called);
		});
	});

	it('should run compile and reject on failure', () => {
		const compilerError = new Error('compiler error');
		const run = sandbox.stub().yields(compilerError, null);
		mockWebpack.returns({ run });
		return moduleUnderTest.run(getMockConfiguration(), {}).then(
			throwImmediately,
			(e: Error) => {
				assert.isTrue(run.calledOnce);
				assert.equal(e, compilerError);
			}
		);
	});

	it('should run watch, setting appropriate webpack options', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		moduleUnderTest.run(getMockConfiguration(), { watch: true });
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce);
			assert.isTrue((<sinon.SinonStub> console.log).firstCall.calledWith('Starting server on http://localhost:9999'));
			assert.equal(mockWebpackConfig.devtool, 'inline-source-map');
			assert.equal(mockWebpackConfig.entry['src/main'][0], 'webpack-dev-server/client?');
		});
	});

	it('should run watch and reject on failure', () => {
		const compilerError = new Error('compiler error');
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields(compilerError);
		return moduleUnderTest.run(getMockConfiguration(), { watch: true }).then(
			throwImmediately,
			(e: Error) => {
				assert.isTrue(mockWebpackDevServer.listen.calledOnce);
				assert.equal(e, compilerError);
			}
		);
	});

	describe('i18n options', () => {
		beforeEach(() => {
			mockWebpack.returns({
				run: sandbox.stub().yields(null, 'stats and stuff')
			});
		});

		it('should correctly set i18n options', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				locale: 'en',
				supportedLocales: [ 'fr' ],
				messageBundles: [ 'nls/main' ]
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					locale: 'en',
					supportedLocales: [ 'fr' ],
					messageBundles: [ 'nls/main' ]
				}), JSON.stringify(mockWebpack.args));
			});
		});

		it('should allow string values for supported locales and message bundles', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				locale: 'en',
				supportedLocales: 'fr',
				messageBundles: 'nls/main'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					locale: 'en',
					supportedLocales: [ 'fr' ],
					messageBundles: [ 'nls/main' ]
				}), JSON.stringify(mockWebpack.args));
			});
		});

		it('should load options from .dojorc', () => {
			const config = getMockConfiguration({
				'build-webpack': {
					locale: 'en',
					supportedLocales: 'fr',
					messageBundles: 'nls/main'
				}
			});
			return moduleUnderTest.run(config, {}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					locale: 'en',
					supportedLocales: [ 'fr' ],
					messageBundles: [ 'nls/main' ]
				}), JSON.stringify(mockWebpack.args));
			});
		});

		it('should load use command line options over those from .dojorc', () => {
			const config = getMockConfiguration({
				'build-webpack': {
					supportedLocales: 'fr'
				}
			});
			return moduleUnderTest.run(config, {
				locale: 'en',
				supportedLocales: [ 'fr', 'es' ],
				messageBundles: 'nls/main'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					locale: 'en',
					supportedLocales: [ 'fr', 'es' ],
					messageBundles: [ 'nls/main' ]
				}), JSON.stringify(mockWebpack.args));
			});
		});

		it('should not override .dojorc with undefined values', () => {
			const config = getMockConfiguration({
				'build-webpack': {
					locale: 'en',
					supportedLocales: [ 'fr', 'es' ],
					messageBundles: 'nls/main'
				}
			});
			return moduleUnderTest.run(config, {
				locale: undefined,
				supportedLocales: undefined,
				messageBundles: undefined
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					locale: 'en',
					supportedLocales: [ 'fr', 'es' ],
					messageBundles: [ 'nls/main' ]
				}), JSON.stringify(mockWebpack.args));
			});
		});
	});

	describe('debug options', () => {
		beforeEach(() => {
			mockWebpack.returns({
				run: sandbox.stub().yields(null, {
					toJson() {
						return 'test json';
					}
				})
			});
		});

		it('should pass the profile option to webpack', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				debug: true
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					debug: true
				}), JSON.stringify(mockWebpack.args));
			});
		});

		it('should create profile json file', () => {
			const fsMock = sandbox.stub(fs, 'writeFileSync');

			mockWebpackConfigModule.returns({
				entry: {
					'src/main': [
						'src/main.styl',
						'src/main.ts'
					]
				},
				profile: true
			});

			return moduleUnderTest.run(getMockConfiguration(), {
				debug: true
			}).then(() => {
				assert.isTrue(fsMock.called);
				assert.strictEqual(fsMock.getCall(0).args[ 0 ], 'dist/profile.json');
				assert.strictEqual(fsMock.getCall(0).args[ 1 ], '"test json"');

				fsMock.restore();
			});
		});
	});

	describe('custom element options', () => {
		beforeEach(() => {
			mockWebpack.returns({
				run: sandbox.stub().yields(null, 'stats')
			});
		});

		it('should set the element prefix if it matches the pattern', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/createTestElement.ts'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					element: '/path/to/createTestElement.ts',
					elementPrefix: 'test'
				}), JSON.stringify(mockWebpackConfigModule.args));
			});
		});

		it('should error if the element prefix does not match the pattern', () => {
			const exitMock = sandbox.stub(process, 'exit');

			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/myelement.ts'
			}).then(() => {
				assert.isTrue(exitMock.called);
				assert.isTrue((<sinon.SinonStub> console.error).calledWith('"/path/to/myelement.ts" does not follow the pattern "createXYZElement". Use --elementPrefix to name element.'));

				exitMock.restore();
			});
		});
	});

	describe('eject', () => {
		it('should contain eject information', () => {
			mockReadFile.returns(`{
				"name": "@dojo/cli-build-webpack",
				"version": "test-version",
				"dependencies": {
					"dep1": "dep1v",
					"dep2": "dep2v"
				}
			}`);

			const result = moduleUnderTest.eject({});

			assert.isTrue('npm' in result, 'expecting npm property');
			assert.isTrue('devDependencies' in result.npm, 'expecting a devDependencies property');
			assert.deepEqual(result.npm.devDependencies, {
				'@dojo/cli-build-webpack': 'test-version',
				'dep1': 'dep1v',
				'dep2': 'dep2v'
			});
			assert.isTrue('copy' in result, 'expecting a copy property');
			assert.deepEqual(result.copy.files, [ './webpack.config.js' ]);
		});
	});
});

import * as fs from 'fs';
import * as sinon from 'sinon';
import MockModule from '../support/MockModule';
import { throwImmediately } from '../support/util';

const { assert } = intern.getPlugin('chai');
const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');

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
				get() {
					if (config) {
						return config['build-webpack'];
					}
				}
			}
		};
	}

	beforeEach(() => {
		process.env.DOJO_CLI = true;

		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../src/main', require);
		mockModule.dependencies(['./webpack.config', 'webpack', 'webpack-dev-server', 'net']);
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

	function markPortAsInUse(inUse: boolean, errorCode = 'EADDRINUSE') {
		const net = mockModule.getMock('net');
		net.createServer = () => {
			const callbacks: { [event: string]: Function } = {};

			return {
				once(event: string, fn: Function) {
					callbacks[event] = fn;
				},
				listen() {
					if (inUse) {
						callbacks['error']({code: errorCode, message: 'test error'});
					} else {
						callbacks['listening']();
					}
				},
				close() {
				}
			};
		};
	}

	function markPortsAsInUse(ports: number[]) {
		const net = mockModule.getMock('net');
		net.createServer = () => {
			const callbacks: { [event: string]: Function } = {};

			return {
				once(event: string, fn: Function) {
					callbacks[event] = fn;
				},
				listen(port: number) {
					if (ports.find(p => p === port)) {
						callbacks['error']({code: 'EADDRINUSE', message: 'test error'});
					} else {
						callbacks['listening']();
					}
				},
				close() {
				}
			};
		};
	}

	it('should register supported arguments', () => {
		const options = sandbox.stub();
		moduleUnderTest.register(options);

		function assureArgument(arg: string) {
			const supportedArgs = options.args.filter((args) => {
				return args[ 0 ] === arg;
			});

			assert.lengthOf(supportedArgs, 1);
		}

		assureArgument('w');
		assureArgument('p');
		assureArgument('t');
		assureArgument('locale');
		assureArgument('supportedLocales');
		assureArgument('messageBundles');
		assureArgument('element');
		assureArgument('elementPrefix');
		assureArgument('debug');
		assureArgument('force');
	});

	it('should run compile and log results on success', () => {
		const run = sandbox.stub().yields(false, 'some stats');
		mockWebpack.returns({ run });
		return moduleUnderTest.run(getMockConfiguration(), {}).then(() => {
			assert.isTrue(run.calledOnce);
			assert.isTrue((<sinon.SinonStub> console.log).calledWith('some stats'));
		});
	});

	it('should run compile and log results on failure, but reject the promise', () => {
		const run = sandbox.stub().yields(false, {
			toString() {
				return 'some stats';
			},
			compilation: {
				errors: [ 'some error' ]
			}
		});
		mockWebpack.returns({ run });
		return moduleUnderTest.run(getMockConfiguration(), {}).then(() => {
			throw new Error('shouldnt have succeeded');
		}, () => {
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
		markPortAsInUse(false);
		moduleUnderTest.run(getMockConfiguration(), { watch: true });
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce);
			assert.isTrue((<sinon.SinonStub> console.log).firstCall.calledWith('Starting server on http://localhost:9999'));
			assert.equal(mockWebpackConfig.devtool, 'inline-source-map');
			assert.equal(mockWebpackConfig.entry['src/main'][0], 'webpack-dev-server/client?');
		});
	});

	it('should run watch and reject on port in use', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		markPortAsInUse(true);
		return moduleUnderTest.run(getMockConfiguration(), { watch: true }).then(
			throwImmediately,
			(e: Error) => {
				assert.isTrue(e.message.indexOf('in use') >= 0);
			}
		);
	});

	it('should run watch and reject on any listening error', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		markPortAsInUse(true, 'SOMEERROR');
		return moduleUnderTest.run(getMockConfiguration(), { watch: true }).then(
			throwImmediately,
			(e: Error) => {
				assert.strictEqual(e.message, 'Unexpected error test error');
			}
		);
	});

	it('should run watch and reject on failure', () => {
		const compilerError = new Error('compiler error');
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields(compilerError);
		markPortAsInUse(false);
		return moduleUnderTest.run(getMockConfiguration(), { watch: true }).then(
			throwImmediately,
			(e: Error) => {
				assert.isTrue(mockWebpackDevServer.listen.calledOnce);
				assert.equal(e, compilerError);
			}
		);
	});

	it('should use a single port', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		markPortsAsInUse([]);
		moduleUnderTest.run(getMockConfiguration(), {watch: true, port: '123'});
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce, 'expected listen to be called on server');
			assert.isTrue(mockWebpackDevServer.listen.firstCall.calledWith(123), 'expected listen to be called with port');
		});
	});

	it('should pick from a list of ports', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		markPortsAsInUse([123]);
		moduleUnderTest.run(getMockConfiguration(), {watch: true, port: '123,456'});
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce, 'expected listen to be called on server');
			assert.isTrue(mockWebpackDevServer.listen.firstCall.calledWith(456), 'expected listen to be called with port');
		});
	});

	it('should pick from a range of ports', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		markPortsAsInUse([456]);
		moduleUnderTest.run(getMockConfiguration(), {watch: true, port: '456:454'});
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce, 'expected listen to be called on server');
			assert.isTrue(mockWebpackDevServer.listen.firstCall.calledWith(455), 'expected listen to be called with port');
		});
	});

	it('should pick from a range of ports, high to low', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		markPortsAsInUse([]);
		moduleUnderTest.run(getMockConfiguration(), {watch: true, port: '454:456'});
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce, 'expected listen to be called on server');
			assert.isTrue(mockWebpackDevServer.listen.firstCall.calledWith(456), 'expected listen to be called with port');
		});
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

		it('should set the element prefix based on the filename', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/TestWidget.ts'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					element: '/path/to/TestWidget.ts',
					elementPrefix: 'test-widget'
				}), JSON.stringify(mockWebpackConfigModule.args));
			});
		});

		it('should handle a filename without an extension', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/TestWidget'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					element: '/path/to/TestWidget',
					elementPrefix: 'test-widget'
				}), JSON.stringify(mockWebpackConfigModule.args));
			});
		});

		it('should support createXElement filename format', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/createTestElement.ts'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					element: '/path/to/createTestElement.ts',
					elementPrefix: 'test'
				}), JSON.stringify(mockWebpackConfigModule.args));
			});
		});

		it('should support createXElement filename format without an extension', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/createTestElement'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					element: '/path/to/createTestElement',
					elementPrefix: 'test'
				}), JSON.stringify(mockWebpackConfigModule.args));
			});
		});

		it('should allow the prefix to be specified', () => {
			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/TestWidget.ts',
				'elementPrefix': 'my-widget'
			}).then(() => {
				assert.isTrue(mockWebpackConfigModule.calledWith({
					element: '/path/to/TestWidget.ts',
					elementPrefix: 'my-widget'
				}), JSON.stringify(mockWebpackConfigModule.args));
			});
		});

		it('should error if the element prefix cannot be determined', () => {
			const exitMock = sandbox.stub(process, 'exit');

			return moduleUnderTest.run(getMockConfiguration(), {
				'element': '/path/to/'
			}).then(() => {
				assert.isTrue(exitMock.called);
				assert.isTrue((<sinon.SinonStub> console.error).calledWith('Element prefix could not be determined from element name: "/path/to/". Use --elementPrefix to name element.'));

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
			assert.isTrue('hints' in result, 'should provide build hints');
			assert.deepEqual(result.copy.files, [ './webpack.config.js' ]);
		});
	});
});

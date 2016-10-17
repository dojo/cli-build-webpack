import { join } from 'path';
import { beforeEach, afterEach, describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import MockModule from '../support/MockModule';
import { throwImmediatly } from '../support/util';
import * as sinon from 'sinon';

describe('main', () => {

	let moduleUnderTest: any;
	let mockModule: MockModule;
	let mockWebpack: any;
	let mockWebpackConfig: any;
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../src/main');
		mockModule.dependencies(['./webpack.config', 'webpack', 'webpack-dev-server']);
		mockWebpack = mockModule.getMock('webpack');
		mockWebpackConfig = mockModule.getMock('./webpack.config');
		mockWebpackConfig.entry = [];
		moduleUnderTest = mockModule.getModuleUnderTest().default;
		sandbox.stub(console, 'log');
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should register supported arguments', () => {
		const helper = { yargs: { option: sandbox.stub() } };
		moduleUnderTest.register(helper);
		assert.deepEqual(
			helper.yargs.option.firstCall.args,
			[ 'w', { alias: 'watch', describe: 'watch and serve' } ]
		);
		assert.deepEqual(
			helper.yargs.option.secondCall.args,
			[ 'p', { alias: 'port', describe: 'port to serve on when using --watch', type: 'number' }],
		);
	});

	it('should run compile and log results on success', () => {
		mockWebpack.run = sandbox.stub().yields(false, 'some stats');
		return moduleUnderTest.run({}, {}).then(() => {
			assert.isTrue(mockWebpack.run.calledOnce);
			assert.isTrue((<sinon.SinonStub> console.log).calledWith('some stats'));
		});
	});

	it('should run compile and reject on failure', () => {
		const compilerError = new Error('compiler error');
		mockWebpack.run = sandbox.stub().yields(compilerError, null);
		return moduleUnderTest.run({}, {}).then(
			throwImmediatly,
			(e: Error) => {
				assert.isTrue(mockWebpack.run.calledOnce);
				assert.equal(e, compilerError);
			}
		);
	});

	it('should run watch, setting appropriate webpack options', () => {
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields();
		moduleUnderTest.run({}, { watch: true });
		return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
			assert.isTrue(mockWebpackDevServer.listen.calledOnce);
			assert.isTrue((<sinon.SinonStub> console.log).firstCall.calledWith('Starting server on http://localhost:9999'));
			assert.equal(mockWebpackConfig.devtool, 'eval-source-map');
			assert.deepEqual(
				mockWebpackConfig.entry,
				[join(require.toUrl('src'), 'node_modules', 'webpack-dev-server/client?')]
			);
		});
	});

	it('should run watch and reject on failure', () => {
		const compilerError = new Error('compiler error');
		const mockWebpackDevServer = mockModule.getMock('webpack-dev-server');
		mockWebpackDevServer.listen = sandbox.stub().yields(compilerError);
		return moduleUnderTest.run({}, { watch: true }).then(
			throwImmediatly,
			(e: Error) => {
				assert.isTrue(mockWebpackDevServer.listen.calledOnce);
				assert.equal(e, compilerError);
			}
		);
	});
});

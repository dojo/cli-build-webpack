import * as sinon from 'sinon';
import MockModule from '../../support/MockModule';

const { afterEach, beforeEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

function getSourceMap() {
	return {
		sources: [ 'some/path!myFile.ts', 'myFile2.ts' ]
	};
}

describe('istanbul-loader', () => {
	let loaderUnderTest: any;
	let mockModule: MockModule;
	let mockIstanbul: any;
	let instrumentMock: any;
	let sourceMapMock: any;
	let sandbox: sinon.SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../../src/loaders/istanbul-loader/loader', require);
		mockModule.dependencies([
			'istanbul-lib-instrument'
		]);
		mockIstanbul = mockModule.getMock('istanbul-lib-instrument');
		instrumentMock = sandbox.stub().callsArg(2);
		sourceMapMock = sandbox.stub().returns({});
		mockIstanbul.createInstrumenter = sandbox.stub().returns({
			instrument: instrumentMock,
			lastSourceMap: sourceMapMock
		});
		loaderUnderTest = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it('should call istanbul to instrument files', () => {
		return new Promise((resolve, reject) => {
			loaderUnderTest.call({
				async() {
					return () => resolve();
				}
			}, 'content', getSourceMap());
		}).then(() => {
			assert.isTrue(instrumentMock.calledOnce);
		});
	});

	it('handles no source map', () => {
		return new Promise((resolve, reject) => {
			loaderUnderTest.call({
				async() {
					return () => resolve();
				}
			}, 'content', null);
		}).then(() => {
			assert.isTrue(instrumentMock.calledOnce);
		});
	});

	it('handles a source map with no sources', () => {
		return new Promise((resolve, reject) => {
			loaderUnderTest.call({
				async() {
					return () => resolve();
				}
			}, 'content', {});
		}).then(() => {
			assert.isTrue(instrumentMock.calledOnce);
		});
	});

	it('should fix source maps', () => {
		let sourceMap = getSourceMap();

		sourceMapMock.reset();
		sourceMapMock.returns(sourceMap);

		return new Promise((resolve, reject) => {
			loaderUnderTest.call({
				async() {
					return () => resolve();
				}
			}, 'content', sourceMap);
		}).then(() => {
			assert.deepEqual(sourceMap.sources, [ 'myFile.ts', 'myFile2.ts' ]);
		});
	});

	it('exports the loader in the index file', () => {
		mockModule = new MockModule('../../../src/loaders/istanbul-loader/index', require);
		mockModule.dependencies([
			'./loader'
		]);

		assert.isDefined(mockModule.getModuleUnderTest());
	});
});

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createContext, runInContext } from 'vm';
import MockModule from '../support/MockModule';

const { assert } = intern.getPlugin('chai');
const { describe, it, beforeEach, afterEach } = intern.getInterface('bdd');

const basePath = process.cwd();
const configPath = resolve(basePath, '_build/src/postcss.config.js');
const configString = readFileSync(configPath);
const dirname = resolve(basePath, '_build/src');
let mockModule: MockModule;

function start() {
	mockModule = new MockModule('../../src/postcss.config');
	mockModule.dependencies([
		'postcss-cssnext',
		'postcss-import'
	]);
	mockModule.start();

	const exports = {};
	const context: any = createContext({
		module: { exports },
		exports,
		process: {
			cwd: () => process.cwd()
		},
		require: (<any> require),
		__dirname: dirname
	});

	const js = configString.toString('utf8').replace(/\$\{packagePath\}/g, dirname);
	runInContext(js, context);
}

describe('postcss.config.ts', () => {
	afterEach(() => {
		mockModule && mockModule.destroy();
	});

	describe('plugins', () => {
		beforeEach(() => {
			start();
		});

		it('should load postcss-import', () => {
			const mock = mockModule.getMock('postcss-import');
			assert.isTrue(mock.ctor.calledOnce);
		});

		it('should load postcss-cssnext', () => {
			const mock = mockModule.getMock('postcss-cssnext');
			assert.isTrue(mock.ctor.firstCall.calledWith({
				features: {
					autoprefixer: {
						browsers: [ 'last 2 versions', 'ie >= 10' ]
					}
				}
			}));
		});
	});
});

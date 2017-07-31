import { readFileSync } from 'fs';
import { afterEach, beforeEach, describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import { resolve } from 'path';
import { createContext, runInContext } from 'vm';
import MockModule from '../support/MockModule';

const basePath = process.cwd();
const configPath = resolve(basePath, '_build/src/webpack.config.js');
const configString = readFileSync(configPath);
const dirname = resolve(basePath, '_build/src');
let mockModule: MockModule;

function start(cli = true) {
	mockModule = new MockModule('../../src/webpack.config');
	mockModule.dependencies([
		'./plugins/CoreLoadPlugin',
		'./plugins/I18nPlugin',
		'copy-webpack-plugin',
		'extract-text-webpack-plugin',
		'html-webpack-plugin',
		'optimize-css-assets-webpack-plugin',
		'postcss-cssnext',
		'postcss-import',
		'webpack-bundle-analyzer-sunburst',
		'webpack/lib/IgnorePlugin',
		'webpack'
	]);
	mockModule.start();

	const exports = {};
	const context: any = createContext({
		module: { exports },
		exports,
		process: {
			cwd: () => process.cwd(),
			env: { DOJO_CLI: cli }
		},
		require: (<any> require).nodeRequire,
		__dirname: dirname
	});

	const js = configString.toString('utf8').replace(/\$\{packagePath\}/g, dirname.replace(/\\/g, '/').replace(/^[cC]:/, ''));
	runInContext(js, context);

	if (cli) {
		context.module.exports({});
	}
}

describe('webpack.config.ts', () => {
	afterEach(() => {
		mockModule && mockModule.destroy();
	});

	function runTests() {
		it('should load the banner for the banner plugin', () => {
			const bannerPath = resolve(basePath, 'src/banner.md');
			const expected = readFileSync(bannerPath, 'utf8');

			const webpack = mockModule.getMock('webpack');
			assert.isTrue(webpack.BannerPlugin.calledWith(expected));
		});
	}

	describe('cli', () => {
		beforeEach(() => {
			start();
		});

		runTests();
	});

	describe('ejected', () => {
		beforeEach(() => {
			start(false);
		});

		runTests();
	});
});

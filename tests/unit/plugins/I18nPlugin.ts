import loadCldrData, { CldrDataResponse } from '@dojo/i18n/cldr/load';
import { afterEach, describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import * as NormalModuleReplacementPlugin from 'webpack/lib/NormalModuleReplacementPlugin';
import Compilation = require('../../support/webpack/Compilation');
import Compiler = require('../../support/webpack/Compiler');
import MockPlugin from '../../support/MockPlugin';
import I18nPlugin from '../../../src/plugins/I18nPlugin';

describe('i18n', () => {
	afterEach(() => {
		MockPlugin.reset();
	});

	it('should replace `@dojo/i18n/cldr/load` with a custom load module.', () => {
		const compiler = new Compiler();
		const plugin = new I18nPlugin({
			defaultLocale: 'en',
			supportedLocales: [ 'es' ]
		});
		plugin.apply(compiler);

		const replacementPlugin = compiler.applied[0];
		assert.instanceOf(replacementPlugin, NormalModuleReplacementPlugin);
		assert.strictEqual(replacementPlugin.resourceRegExp.toString(), '/\\/cldr\\/load$/');
		assert.strictEqual(replacementPlugin.newResource, '@dojo/i18n/cldr/load/webpack');
	});

	describe('CLDR data', () => {
		it('should inject data for the default locale', () => {
			const compiler = new Compiler();
			const compilation = new Compilation();
			const plugin = new I18nPlugin({
				defaultLocale: 'en'
			});

			plugin.apply(compiler);
			compiler.mockApply('compilation', compilation);
			assert.strictEqual(compilation.moduleTemplate.plugins['module'].length, 1);

			return loadCldrData('en').then((data: CldrDataResponse) => {
				const source = compilation.moduleTemplate.mockApply('module', '', {
					userRequest: '/path/to/@dojo/i18n/cldr/load/webpack.js'
				})[0];

				const injected = `var __cldrData__ = ${JSON.stringify(data)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should inject data for supported locales', () => {
			const compiler = new Compiler();
			const compilation = new Compilation();
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				supportedLocales: [ 'es' ]
			});

			plugin.apply(compiler);
			compiler.mockApply('compilation', compilation);
			assert.strictEqual(compilation.moduleTemplate.plugins['module'].length, 1);

			return loadCldrData([ 'en', 'es' ]).then((data: CldrDataResponse) => {
				const source = compilation.moduleTemplate.mockApply('module', '', {
					userRequest: '/path/to/@dojo/i18n/cldr/load/webpack.js'
				})[0];

				const injected = `var __cldrData__ = ${JSON.stringify(data)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should not inject data to other modules', () => {
			const compiler = new Compiler();
			const compilation = new Compilation();
			const plugin = new I18nPlugin({
				defaultLocale: 'en'
			});

			plugin.apply(compiler);
			compiler.mockApply('compilation', compilation);
			assert.strictEqual(compilation.moduleTemplate.plugins['module'].length, 1);

			const source = compilation.moduleTemplate.mockApply('module', '', {
				userRequest: '/path/to/module.js'
			})[0];
			assert.strictEqual(source, '', 'No data injected.');
		});
	});

	describe('message bundles', () => {
		it('should not inject messages without supported locales', () => {
			const compiler = new Compiler();
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				messageBundles: [ 'src/nls/main', 'src/nls/other' ]
			});
			plugin.apply(compiler);

			assert.strictEqual(MockPlugin.instances().length, 0, 'No message modules injected.');
		});

		it('should not inject messages without message bundle paths', () => {
			const compiler = new Compiler();
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				supportedLocales: [ 'es', 'fr', 'ar' ]
			});
			plugin.apply(compiler);

			assert.strictEqual(MockPlugin.instances().length, 0, 'No message modules injected.');
		});

		it('should inject messages for all supported locales', () => {
			const locales = [ 'es', 'fr', 'ar' ];
			const compiler = new Compiler();
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				supportedLocales: locales,
				messageBundles: [ 'tests/support/mocks/nls/main' ]
			});

			plugin.apply(compiler);
			const messagePlugins = MockPlugin.instances();
			const main = messagePlugins[0];

			assert.strictEqual(main.options.resourcePattern.toString(), new RegExp('tests/support/mocks/nls/main').toString());
			assert.sameMembers(main.options.moduleIds, locales.map((locale: string) => `tests/support/mocks/nls/${locale}/main`));
		});

		it('should ignore non-existent bundles', () => {
			const compiler = new Compiler();
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				supportedLocales: [ 'it' ],
				messageBundles: [ 'tests/support/mocks/nls/main' ]
			});

			plugin.apply(compiler);
			const messagePlugins = MockPlugin.instances();
			assert.strictEqual(messagePlugins.length, 0, 'Non-existent paths are ignored.');
		});

		it('should allow extensions in the message paths', () => {
			const locales = [ 'es', 'fr', 'ar' ];
			const compiler = new Compiler();
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				supportedLocales: locales,
				messageBundles: [ 'tests/support/mocks/nls/main.ts' ]
			});

			plugin.apply(compiler);
			const messagePlugins = MockPlugin.instances();
			const main = messagePlugins[0];

			assert.strictEqual(main.options.resourcePattern.toString(), new RegExp('tests/support/mocks/nls/main.ts').toString());
			assert.sameMembers(main.options.moduleIds, locales.map((locale: string) => `tests/support/mocks/nls/${locale}/main.ts`));
		});
	});
});

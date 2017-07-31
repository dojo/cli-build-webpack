import coreLoad from '@dojo/core/load';
import { Require } from '@dojo/interfaces/loader';
import { Program } from 'estree';
import { afterEach, describe, it } from 'intern!bdd';
import { sep as separator } from 'path';
import * as assert from 'intern/chai!assert';
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
import Compilation = require('../../support/webpack/Compilation');
import Compiler = require('../../support/webpack/Compiler');
import MockPlugin from '../../support/MockPlugin';
import { fetchCldrData } from '../../support/util';
import I18nPlugin from '../../../src/plugins/I18nPlugin';
import { hasExtension } from '../../../src/plugins/util/main';
declare const require: Require;

interface CldrTestOptions {
	ast?: Program;
	moduleCount: number;
	moduleInfo: ModuleInfo | null;
	moduleTemplateId: string;
}

interface ModuleInfo {
	context?: string;
	request: string;
	issuer?: string;
}

function applyCompilationPlugins(compilation: Compilation, ast: Program, moduleInfo?: ModuleInfo | null) {
	const { normalModuleFactory, parser } = compilation.params;
	if (typeof moduleInfo === 'undefined') {
		moduleInfo = {
			issuer: '/path/to/module/that/includes/cldrLoad.ts',
			request: '@dojo/i18n/cldr/load/webpack'
		};
	}
	normalModuleFactory.mockApply('before-resolve', getBeforeResolveModule(moduleInfo), () => undefined);
	normalModuleFactory.mockApply('after-resolve', getAfterResolveModule(moduleInfo), () => undefined);
	parser.state.current = <any> {
		userRequest: moduleInfo && moduleInfo.issuer
	};
	normalModuleFactory.mockApply('parser', parser);
	parser.mockApply('program', ast);
}

function getAfterResolveModule(module: ModuleInfo | null) {
	if (module === null) {
		return module;
	}
	const { context, request } = module;
	return {
		context,
		rawRequest: request,
		userRequest: hasExtension(request) ? request : `${request}.ts`
	};
}

function getBeforeResolveModule(module: ModuleInfo | null) {
	if (module === null) {
		return module;
	}
	const { context, issuer, request } = module;
	const result: any = { context, request };
	if (issuer) {
		result.contextInfo = { issuer };
	}
	return result;
}

function loadAst() {
	const url = require.toUrl('../../support/mocks/ast/cldr-complete.json');
	return coreLoad(url).then(([ json ]: [ Program ]) => json);
}

function testCldrInjection(plugin: I18nPlugin, options: Partial<CldrTestOptions>) {
	const {
		ast,
		moduleCount = 1,
		moduleInfo,
		moduleTemplateId = '/path/to/@dojo/i18n/cldr/load/webpack.js'
	} = options;

	const compiler = new Compiler();
	const compilation = new Compilation();

	plugin.apply(compiler);
	compiler.mockApply('compilation', compilation);

	if (ast) {
		let i = 0;
		while (i < moduleCount) {
			applyCompilationPlugins(compilation, ast, moduleInfo);
			i++;
		}
	}

	return compilation.moduleTemplate.mockApply('module', '', {
		userRequest: moduleTemplateId
	})[0];
}

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
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, { ast });

				const cldrData = fetchCldrData('en');
				const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should inject data for supported locales', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({
					defaultLocale: 'en',
					supportedLocales: [ 'es' ]
				});
				const source = testCldrInjection(plugin, { ast });

				const cldrData = fetchCldrData([ 'en', 'es' ]);
				const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should inject data only once', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, { ast, moduleCount: 2 });

				const cldrData = fetchCldrData('en');
				const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should include CLDR data from previous builds with the `cacheCldrUrls` option', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({
					cacheCldrUrls: true,
					defaultLocale: 'en'
				});
				testCldrInjection(plugin, { ast });
				const source = testCldrInjection(plugin, {});

				const cldrData = fetchCldrData('en');
				const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should not inject CLDR data `@dojo/i18n/cldr/load` is not used', () => {
			return loadAst().then((ast: Program) => {
				const request = '/path/to/module.js';
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleInfo: {
						context: '/parent/context',
						issuer: '/issuer/path',
						request
					},
					moduleTemplateId: request
				});

				assert.strictEqual(source, '');
			});
		});

		it('should not inject data to other modules', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleTemplateId: '/path/to/module.js'
				});
				assert.strictEqual(source, '', 'No data injected.');
			});
		});

		it('should ignore node modules', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleInfo: {
						context: '/parent/context',
						issuer: '/node_modules/issuer/path',
						request: '/node_modules/@dojo/i18n/cldr/load/webpack'
					}
				});

				const injected = 'var __cldrData__ = {}';
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should ignore modules without an issuer', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleInfo: {
						request: '@dojo/i18n/cldr/load/webpack'
					}
				});

				const injected = `var __cldrData__ = {}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should ignore non-JS modules', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleInfo: {
						context: '/parent/context',
						issuer: '/issuer/path',
						request: '/@dojo/i18n/cldr/load/webpack.css'
					}
				});

				const injected = 'var __cldrData__ = {}';
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should allow requests with relative paths', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleInfo: {
						context: '/path/to/@dojo/i18n',
						request: './cldr/load/webpack',
						issuer: '/path/to/module/that/includes/cldr/load.ts'
					}
				});

				const cldrData = fetchCldrData('en');
				const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
		});

		it('should ignore falsy modules passed to "before-resolve"', () => {
			return loadAst().then((ast: Program) => {
				const plugin = new I18nPlugin({ defaultLocale: 'en' });
				const source = testCldrInjection(plugin, {
					ast,
					moduleInfo: null
				});

				const injected = `var __cldrData__ = {}`;
				assert.strictEqual(source.source().indexOf(injected), 0);
			});
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
			assert.sameMembers(
				main.options.moduleIds,
				locales.map((locale: string) => `tests/support/mocks/nls/${locale}/main`.replace(/\//g, separator))
			);
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
			assert.sameMembers(
				main.options.moduleIds,
				locales.map((locale: string) => `tests/support/mocks/nls/${locale}/main.ts`.replace(/\//g, separator))
			);
		});
	});
});

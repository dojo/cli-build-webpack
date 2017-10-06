import { Program } from 'estree';
import { beforeEach } from 'intern/lib/interfaces/tdd';
import { sep as separator } from 'path';
import I18nPlugin from '../../../src/plugins/I18nPlugin';
import { hasExtension, resolveMid } from '../../../src/plugins/util/main';
import MockModule from '../../support/MockModule';
import MockPlugin from '../../support/MockPlugin';
import { fetchCldrData } from '../../support/util';
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
import Compilation = require('../../support/webpack/Compilation');
import Compiler = require('../../support/webpack/Compiler');

const { assert } = intern.getPlugin('chai');
const { afterEach, describe, it } = intern.getInterface('bdd');

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
	return require('../../support/mocks/ast/cldr-complete.json') as Program;
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
		assert.strictEqual(replacementPlugin.resourceRegExp.toString(), '/(\\\\|\\/)cldr(\\\\|\\/)load($|\\.js)/');
		assert.strictEqual(replacementPlugin.newResource, resolveMid('@dojo/i18n/cldr/load/webpack'));
	});

	describe('CLDR data', () => {
		it('should inject data for the default locale', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, { ast: loadAst() });

			const cldrData = fetchCldrData('en');
			const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should inject data for supported locales', () => {
			const plugin = new I18nPlugin({
				defaultLocale: 'en',
				supportedLocales: [ 'es' ]
			});
			const source = testCldrInjection(plugin, { ast: loadAst() });

			const cldrData = fetchCldrData([ 'en', 'es' ]);
			const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should inject data only once', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, { ast: loadAst(), moduleCount: 2 });

			const cldrData = fetchCldrData('en');
			const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should include CLDR data from previous builds with the `cacheCldrUrls` option', () => {
			const plugin = new I18nPlugin({
				cacheCldrUrls: true,
				defaultLocale: 'en'
			});
			testCldrInjection(plugin, { ast: loadAst() });
			const source = testCldrInjection(plugin, {});

			const cldrData = fetchCldrData('en');
			const injected = `var __cldrData__ = ${JSON.stringify(cldrData)}`;
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should not inject CLDR data `@dojo/i18n/cldr/load` is not used', () => {
			const request = '/path/to/module.js';
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
				moduleInfo: {
					context: '/parent/context',
					issuer: '/issuer/path',
					request
				},
				moduleTemplateId: request
			});

			assert.strictEqual(source, '');
		});

		it('should not inject data to other modules', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
				moduleTemplateId: '/path/to/module.js'
			});
			assert.strictEqual(source, '', 'No data injected.');
		});

		it('should ignore node modules', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
				moduleInfo: {
					context: '/parent/context',
					issuer: '/node_modules/issuer/path',
					request: '/node_modules/@dojo/i18n/cldr/load/webpack'
				}
			});

			const injected = 'var __cldrData__ = {}';
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should ignore modules without an issuer', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
				moduleInfo: {
					request: '@dojo/i18n/cldr/load/webpack'
				}
			});

			const injected = `var __cldrData__ = {}`;
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should ignore non-JS modules', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
				moduleInfo: {
					context: '/parent/context',
					issuer: '/issuer/path',
					request: '/@dojo/i18n/cldr/load/webpack.css'
				}
			});

			const injected = 'var __cldrData__ = {}';
			assert.strictEqual(source.source().indexOf(injected), 0);
		});

		it('should allow requests with relative paths', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
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

		it('should ignore falsy modules passed to "before-resolve"', () => {
			const plugin = new I18nPlugin({ defaultLocale: 'en' });
			const source = testCldrInjection(plugin, {
				ast: loadAst(),
				moduleInfo: null
			});

			const injected = `var __cldrData__ = {}`;
			assert.strictEqual(source.source().indexOf(injected), 0);
		});
	});

	describe('message bundles', () => {
		let mockModule: MockModule;

		beforeEach(() => {
			mockModule = new MockModule('../../src/plugins/I18nPlugin');
			mockModule.dependencies([
				{
					name: './InjectModulesPlugin',
					mock: require('../../support/MockPlugin')
				}
			]);
		});

		afterEach(() => {
			mockModule.destroy();
		});

		it('should not inject messages without supported locales', () => {
			const compiler = new Compiler();
			const plugin = new (mockModule.getModuleUnderTest().default)({
				defaultLocale: 'en',
				messageBundles: [ 'src/nls/main', 'src/nls/other' ]
			});
			plugin.apply(compiler);

			assert.strictEqual(MockPlugin.instances().length, 0, 'No message modules injected.');
		});

		it('should not inject messages without message bundle paths', () => {
			const compiler = new Compiler();
			const plugin = new (mockModule.getModuleUnderTest().default)({
				defaultLocale: 'en',
				supportedLocales: [ 'es', 'fr', 'ar' ]
			});
			plugin.apply(compiler);

			assert.strictEqual(MockPlugin.instances().length, 0, 'No message modules injected.');
		});

		it('should inject messages for all supported locales', () => {
			const locales = [ 'es', 'fr', 'ar' ];
			const compiler = new Compiler();
			const plugin = new (mockModule.getModuleUnderTest().default)({
				defaultLocale: 'en',
				supportedLocales: locales,
				messageBundles: [ 'tests/support/mocks/nls/main' ]
			});

			plugin.apply(compiler);
			const messagePlugins = MockPlugin.instances();
			const main = messagePlugins[0];

			const expectedPattern = new RegExp([ 'tests', 'support', 'mocks', 'nls', 'main' ].join('(\\\\|\\/)'));
			assert.strictEqual(main.options.resourcePattern.toString(), expectedPattern.toString());
			assert.sameMembers(
				main.options.moduleIds,
				locales.map((locale: string) => `tests/support/mocks/nls/${locale}/main`.replace(/\//g, separator))
			);
		});

		it('should ignore non-existent bundles', () => {
			const compiler = new Compiler();
			const plugin = new (mockModule.getModuleUnderTest().default)({
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
			const plugin = new (mockModule.getModuleUnderTest().default)({
				defaultLocale: 'en',
				supportedLocales: locales,
				messageBundles: [ 'tests/support/mocks/nls/main.ts' ]
			});

			plugin.apply(compiler);
			const messagePlugins = MockPlugin.instances();
			const main = messagePlugins[0];

			const expectedPattern = new RegExp([ 'tests', 'support', 'mocks', 'nls', 'main.ts' ].join('(\\\\|\\/)'));
			assert.strictEqual(main.options.resourcePattern.toString(), expectedPattern.toString());
			assert.sameMembers(
				main.options.moduleIds,
				locales.map((locale: string) => `tests/support/mocks/nls/${locale}/main.ts`.replace(/\//g, separator))
			);
		});
	});
});

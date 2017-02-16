import { describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import * as path from 'path';
// import * as sinon from 'sinon';
import * as ConcatSource from 'webpack-sources/lib/ConcatSource';
import * as NormalModuleReplacementPlugin from 'webpack/lib/NormalModuleReplacementPlugin';
import Compilation = require('../../support/webpack/Compilation');
import CompilationParams = require('../../support/webpack/CompilationParams');
import Compiler = require('../../support/webpack/Compiler');
import NormalModule = require('../../support/webpack/NormalModule');
import LoadPlugin from '../../../src/plugins/CoreLoadPlugin';
import { resolveMid } from '../../../src/plugins/util';

if (typeof __dirname === 'undefined') {
	(<any> global).__dirname = path.join(process.cwd(), 'src', 'plugins', 'core-load');
}

function createModule(context: string, mid: string, id: number, params: CompilationParams): NormalModule {
	const url = path.resolve(context, `${mid}.js`);
	const module = new NormalModule(url, url, mid, [], url, params.parser);
	module.id = id;
	return module;
}

describe('core-load', () => {
	it('should add event listeners', () => {
		const compiler = new Compiler();
		const compilation = new Compilation();
		const params = new CompilationParams();
		const { parser } = params;
		const plugin = new LoadPlugin();
		const { moduleTemplate } = compilation;

		plugin.apply(compiler);
		assert.strictEqual(compiler.plugins['compilation'].length, 1);

		compiler.mockApply('compilation', compilation, params);
		params.normalModuleFactory.mockApply('parser', parser);
		assert.strictEqual(parser.plugins['expression require'].length, 1);
		assert.strictEqual(moduleTemplate.plugins['module'].length, 1);
		assert.strictEqual(compilation.plugins['optimize-module-ids'].length, 1);
	});

	it('should replace `@dojo/core/load` with the custom load module', () => {
		const compiler = new Compiler();
		const plugin = new LoadPlugin();

		plugin.apply(compiler);
		const replacementPlugin = compiler.applied[0];
		assert.instanceOf(replacementPlugin, NormalModuleReplacementPlugin);
		assert.strictEqual(replacementPlugin.resourceRegExp.toString(), '/@dojo\\/core\\/load\\.js/');
		assert.strictEqual(replacementPlugin.newResource, resolveMid('@dojo/core/load/webpack'));
	});

	it('should inject a custom require into the issuer source', () => {
		const compilation = new Compilation();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation);
		const source = compilation.moduleTemplate.mockApply('module', '', {
			meta: { isPotentialLoad: true },
			userRequest: '/root/path/src/module.js'
		})[0];

		assert.instanceOf(source, ConcatSource, 'A new `ConcatSource` is created.');
		assert.strictEqual(source.source(), `var require = function () { return 'src/module'; };\n`,
			'A custom `require` function is injected into the source.');
	});

	it('should inject a module ID map into the custom load module', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const url = '/path/to/@dojo/core/load.js';
		const load = new NormalModule(url, url, '@dojo/core/load', [], url, params.parser);

		load.id = 42;
		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation);
		compilation.mockApply('optimize-module-ids', [ load ]);

		const source = compilation.moduleTemplate.mockApply('module', '', load)[0];
		assert.instanceOf(source, ConcatSource, 'A new `ConcatSource` is created.');

		const idMap = { '@dojo/core/load': { id: 42, lazy: false } };
		assert.strictEqual(source.source(), `var __modules__ = ${JSON.stringify(idMap)};\n`);
	});

	it('should not modify other module sources', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const module = createModule('/path/to', 'module', 42, params);

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation, params);
		compilation.mockApply('optimize-module-ids', [ module ]);

		const source = compilation.moduleTemplate.mockApply('module', '', module)[0];
		assert.strictEqual(source, '', 'Source not modified');
	});

	it('should ignore modules without requests', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const load = createModule('/path/to', '@dojo/core/load', 42, params);
		const module = createModule('', '', 0, params);

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation, params);
		compilation.mockApply('optimize-module-ids', [ module, load ]);

		const source = compilation.moduleTemplate.mockApply('module', '', load)[0];
		const idMap = { '@dojo/core/load': { id: 42, lazy: false } };
		assert.strictEqual(source.source(), `var __modules__ = ${JSON.stringify(idMap)};\n`,
			'Module not added to ID map.');
	});

	it('should include modules absolute mids', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const load = createModule('/path/to', '@dojo/core/load', 42, params);
		const module = createModule('/path/to', 'module/id', 8675309, params);

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation, params);
		compilation.mockApply('optimize-module-ids', [ module, load ]);

		const source = compilation.moduleTemplate.mockApply('module', '', load)[0];
		const idMap = {
			'module/id': { id: 8675309, lazy: false },
			'@dojo/core/load': { id: 42, lazy: false }
		};
		assert.strictEqual(source.source(), `var __modules__ = ${JSON.stringify(idMap)};\n`,
			'Module added to ID map.');
	});

	it('should add modules with relative IDs when an issuer is the base path', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const issuer = createModule('/path/to', 'parent', 0, params);
		const module = createModule('/path/to', './module', 1, params);
		const load = createModule('/path/to', '@dojo/core/load', 42, params);

		plugin.apply(compiler);
		params.parser.state = { current: issuer };
		compiler.mockApply('compilation', compilation, params);
		params.normalModuleFactory.mockApply('parser', params.parser);
		params.parser.mockApply('expression require');
		compilation.mockApply('optimize-module-ids', [ module, load ]);

		const source = compilation.moduleTemplate.mockApply('module', '', load)[0];
		const idMap = {
			'/path/to/module': { id: 1, lazy: false },
			'@dojo/core/load': { id: 42, lazy: false }
		};
		assert.strictEqual(source.source(), `var __modules__ = ${JSON.stringify(idMap)};\n`,
			'Module added to ID map.');
	});

	it('should ignore modules with relative IDs when an issuer is not the base path', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const issuer = createModule('/path/to', 'parent', 0, params);
		const module = createModule('/different/path/to', './module', 1, params);
		const load = createModule('/path/to', '@dojo/core/load', 42, params);

		plugin.apply(compiler);
		params.parser.state = { current: issuer };
		compiler.mockApply('compilation', compilation, params);
		params.normalModuleFactory.mockApply('parser', params.parser);
		params.parser.mockApply('expression require');
		compilation.mockApply('optimize-module-ids', [ module, load ]);

		const source = compilation.moduleTemplate.mockApply('module', '', load)[0];
		const idMap = { '@dojo/core/load': { id: 42, lazy: false } };
		assert.strictEqual(source.source(), `var __modules__ = ${JSON.stringify(idMap)};\n`,
			'Module not added to ID map.');
	});

	it('should lazy load bundle modules', () => {
		const compilation = new Compilation();
		const params = new CompilationParams();
		const compiler = new Compiler();
		const plugin = new LoadPlugin();
		const load = createModule('/path/to', '@dojo/core/load', 42, params);
		const module = createModule('/path/to', 'bundle!module', 1, params);

		plugin.apply(compiler);
		compiler.mockApply('compilation', compilation);
		compilation.mockApply('optimize-module-ids', [ module, load ]);

		const source = compilation.moduleTemplate.mockApply('module', '', load)[0];
		const idMap = {
			'module': { id: 1, lazy: true },
			'@dojo/core/load': { id: 42, lazy: false }
		};
		assert.strictEqual(source.source(), `var __modules__ = ${JSON.stringify(idMap)};\n`,
			'Module added to ID map.');
	});
});

declare module 'tapable' {
	class Tapable {
		protected _plugins: { [key: string]: Function[] };

		apply(...args: any[]): void;
		plugin(name: string | string[], fn: Function): void;

		protected applyPlugins(name: string, ...args: any[]): void;
		protected applyPluginsWaterfall(name: string, initial: any, ...args: any[]): any;
		protected applyPluginsAsync(name: string, ...args: any[]): void;
		protected applyPluginsBailResult(name: string, ...args: any[]): any;
		protected applyPluginsAsyncWaterfall(name: string, initial: any, callback: (error: Error | null, value: any) => void): void;
		protected applyPluginsAsyncSeries(name: string, ...args: any[]): void;
		protected applyPluginsAsyncSeriesBailResult(name: string, ...args: any[]): void;
		protected applyPluginsParallel(name: string, ...args: any[]): void;
		protected applyPluginsParallelBailResult(name: string, ...args: any[]): void;
	}
	export = Tapable;
}

declare module 'webpack-sources/lib/ConcatSource' {
	import Source = require('webpack-sources/lib/Source');
	import sourceMap = require('source-map');

	class ConcatSource extends Source {
		constructor(...children: (string | Source)[]);

		add(child: string | Source): void;
		node(options: Source.Options): sourceMap.SourceNode;
	}

	export = ConcatSource;
}

declare module 'webpack-sources/lib/Source' {
	import * as crypto from 'crypto';

	abstract class Source {
		map(options: Source.Options): string;
		size(): number;
		source(): string;
		sourceAndMap(options: Source.Options): { code: string; map: any; };
		updateHash(hash: crypto.Hash): void;
	}

	namespace Source {
		interface Options {
			columns?: boolean;
			module?: boolean;
		}
	}

	export = Source;
}

declare module 'webpack' {
	import webpack = require('webpack/lib/webpack');

	export = webpack;
}

declare module 'webpack/lib/webpack' {
	import WebpackBannerPlugin = require('webpack/lib/BannerPlugin');
	import WebpackCompiler = require('webpack/lib/Compiler');
	import WebpackContextReplacementPlugin = require('webpack/lib/ContextReplacementPlugin');
	import WebpackNormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
	import WebpackCommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
	import WebpackUglifyJsPlugin = require('webpack/lib/optimize/UglifyJsPlugin');

	function webpack(options: webpack.Config, callback?: Function): WebpackCompiler;

	namespace webpack {
		export type BannerPlugin = WebpackBannerPlugin;
		export type Compiler = WebpackCompiler;
		export type ContextReplacementPlugin = WebpackContextReplacementPlugin;
		export type NormalModuleReplacementPlugin = WebpackNormalModuleReplacementPlugin;
		export const BannerPlugin: typeof WebpackBannerPlugin;
		export const Compiler: typeof WebpackCompiler;
		export const ContextReplacementPlugin: typeof WebpackContextReplacementPlugin;
		export const NormalModuleReplacementPlugin: typeof WebpackNormalModuleReplacementPlugin;

		namespace optimize {
			type CommonsChunkPlugin = WebpackCommonsChunkPlugin;
			type UglifyJsPlugin = WebpackUglifyJsPlugin;
			export const CommonsChunkPlugin: typeof WebpackCommonsChunkPlugin;
			export const UglifyJsPlugin: typeof WebpackUglifyJsPlugin;
		}

		type Condition = _Condition | _Condition[];
		type _Condition = string | RegExp | ConditionFunction | ConditionObject;
		type ConditionFunction = (input: string) => boolean;
		interface ConditionObject {
			and?: _Condition[];
			exclude?: Condition;
			include?: Condition;
			not?: _Condition;
			or?: _Condition[];
			test?: Condition;
		}

		interface Node {
			console?: boolean | 'mock';
			global?: boolean;
			process?: boolean;
			__filename?: boolean | 'mock';
			__dirname?: boolean | 'mock';
			Buffer?: boolean | 'mock';
			setImmediate?: boolean | 'mock' | 'empty';
			[moduleName: string]: boolean | 'empty' | 'mock' | undefined;
		}

		interface Config {
			entry: string | string[] | { [key: string]: string | string[] };
			output: Output;
			module: Module;
			node?: Node | false;
			resolve?: Resolve;
			resolveLoader?: {
				modules?: string[];
				extensions?: string[];
				packageMains?: string[];
				moduleExtensions?: string[];
			};
			devtool?: false | 'eval' | 'cheap-eval-source-map' | 'cheap-source-map' | 'cheap-module-eval-source-map' | 'cheap-module-source-map' | 'eval-source-map' | 'source-map' | 'nosources-source-map' | 'inline-source-map' | 'hidden-source-map';
			context?: string;
			target?: 'async-node' | 'electron-main' | 'electron-renderer' | 'node' | 'node-webkit' | 'web' | 'webworker';
			externals?: { [key: string]: string | string[] | Object } | ((context: string, request: string, callback: Function) => void)[];
			stats?: Stats;
			plugins?: Plugin[];
			profile?: boolean;
		}
		type DevtoolFilenameTemplateFunction = (info: DevtoolFilenameTemplateInfo) => string;
		interface DevtoolFilenameTemplateInfo {
			absoluteResourcePath: string;
			allLoaders: string;
			hash: string;
			id: string;
			loaders: string;
			resource: string;
			resourcePath: string;
		}
		interface LoaderContext {
			version: number;
			context: string;
			request: string;
			query: string;
			data: any;
			loaders: any[];
			loaderIndex: number;
			resource: string;
			resourcePath: string;
			value: any;
			inputValue: any;
			options: any;
			debug: boolean;
			minimize: boolean;
			sourceMap: boolean;
			target: string;
			webpack: boolean;

			async(): (error?: Error | null, content?: string | Buffer, sourceMap?: any) => void;
			cacheable(flag?: boolean): void;
			emitWarning(warning: string): void;
			emitError(error: string): void;
			exec(code: string, filename: string): void;
			resolve(context: string, request: string, callback: (error?: Error | null, result?: string) => void): void;
			addDependency(file: string): void;
			dependency(file: string): void;
			addContextDependency(directory: string): void;
			clearDependencies(): void;
			emitFile(name: string, content: String | Buffer, sourceMap: any): void;
		}
		interface Module {
			rules: Rule[];
		}
		interface Output {
			path: string;
			filename: string;
			publicPath?: string;
			library?: string;
			libraryTarget?: 'var' |	'this' | 'window' | 'global' | 'commonjs' | 'commonjs2' | 'commonjs-module' | 'amd' | 'umd' | 'assign' | 'jsonp';
			pathinfo?: boolean;
			chunkFilename?: string;
			jsonpFunction?: string;
			sourceMapFilename?: string;
			devtoolModuleFilenameTemplate?: string | DevtoolFilenameTemplateFunction;
			devtoolFallbackModuleFilenameTemplate?: string | DevtoolFilenameTemplateFunction;
			umdNamedDefine?: boolean;
			crossOriginLoading?: boolean | 'anonymous' | 'use-credentials';
		}
		interface Plugin {
			apply(compiler?: WebpackCompiler): void;
		}
		interface Resolve {
			alias?: { [key: string]: string; };
			aliasFields?: string[];
			cachePredicate?: (info: { path: string; request: string; }) => boolean;
			descriptionFiles?: string[];
			enforceExtension?: boolean;
			enforceModuleExtension?: boolean;
			extensions?: string[];
			mainFields?: string[];
			mainFiles?: string[];
			modules?: string[];
			plugins?: any[];
			symlinks?: boolean;
			unsafeCache?: boolean | RegExp | RegExp[];
		}
		interface Rule {
			enforce?: 'pre' | 'post';
			exclude?: Condition;
			include?: Condition;
			issuer?: _Condition;
			loader?: string;
			loaders?: (string | UseEntry)[];
			oneOf?: Rule[];
			options?: string | Object;
			resource?: _Condition;
			rules?: Rule[];
			test?: Condition;
			use?: (string | UseEntry)[];
		}
		type Stats = boolean | 'errors-only' | 'minimal' | 'none' | 'normal' | 'verbose' | StatsOptions;
		interface StatsOptions {
			assets?: boolean;
			assetsSort?: string;
			cached?: boolean;
			children?: boolean;
			chunks?: boolean;
			chunkModules?: boolean;
			chunkOrigins?: boolean;
			chunksSort?: string;
			context?: string;
			colors?: boolean;
			errors?: boolean;
			errorDetails?: boolean;
			hash?: boolean;
			modules?: boolean;
			modulesSort?: string;
			publicPath?: boolean;
			reasons?: boolean;
			source?: boolean;
			timings?: boolean;
			version?: boolean;
			warnings?: boolean;
		}
		interface UseEntry {
			loader: string;
			options?: string | Object;
		}
	}

	export = webpack;
}

declare module 'webpack/lib/dependencies/ConstDependency' {
	import NullDependency = require('webpack/lib/dependencies/NullDependency');

	class ConstDependencyTemplate {
		apply(dep: any, source: any): void;
	}

	class ConstDependency extends NullDependency {
		constructor(expression?: any, range?: [number, number]);

		public expression?: any;
		public loc?: any;
		public range?: [number, number];

		updateHash(hash: any): void;

		static Template: typeof ConstDependencyTemplate;
	}

	export = ConstDependency;
}

declare module 'webpack/lib/dependencies/NullDependency' {
	import Dependency = require('webpack/lib/Dependency');

	class NullDependencyTemplate {
		apply(dep: any, source: any): void;
	}

	class NullDependency extends Dependency {
		readonly type: string;
		isEqualResource(): boolean;
		updateHash(hash: any): void;
		static Template: typeof NullDependencyTemplate;
	}

	export = NullDependency;
}

declare module 'webpack/lib/BannerPlugin' {
	import webpack = require('webpack');

	interface BannerOptions {
		banner: string;
		entryOnly: boolean;
		exclude: string | RegExp | (string | RegExp)[];
		include: string | RegExp | (string | RegExp)[];
		raw: boolean;
		test: string | RegExp | (string | RegExp)[];
	}

	class BannerPlugin implements webpack.Plugin {
		constructor(options: string | BannerOptions);
		apply(compiler: webpack.Compiler): void;
	}
	export = BannerPlugin;
}

declare module 'webpack/lib/Chunk' {
	import Module = require('webpack/lib/Module');
	import DependenciesBlock = require('webpack/lib/DependenciesBlock');

	class Chunk {
		id: number;
		ids: number[];
		debugId: number;
		name: string;
		modules: Module[];
		chunks: Chunk[];
		parents: Chunk[];
		blocks: DependenciesBlock[];
		origins: Chunk.Origin[];
		files: any[];
		rendered: boolean;

		constructor(name: string, module: Module, loc: any);

		addChunk(chunk: Chunk): boolean;
		addParent(chunk: Chunk): boolean;
		hasRuntime(): boolean;
		isInitial(): boolean;
		hasEntryModule(): boolean;
		addModule(module: Module): boolean;
		removeModule(module: Module): void;
		removeChunk(chunk: Chunk): void;
		removeParent(chunk: Chunk): void;

		addBlock(block: DependenciesBlock): boolean;
		addOrigin(origin: Chunk.Origin): void;

		remove(reason: string): void;

		moveModule(module: Module, other: Chunk): void;
	}

	namespace Chunk {
		interface Origin {
			module: Module;
			loc: any;
			name: string;
		}
	}

	export = Chunk;
}

declare module 'webpack/lib/Compilation' {
	import Tapable = require('tapable');
	import MainTemplate = require('webpack/lib/MainTemplate');
	import Module = require('webpack/lib/Module');
	import Chunk = require('webpack/lib/Chunk');
	import Source = require('webpack-sources/lib/Source');
	import ModuleTemplate = require('webpack/lib/ModuleTemplate');
	import Compiler = require('webpack/lib/Compiler');
	import Dependency = require('webpack/lib/Dependency');

	class Compilation extends Tapable {
		dependencyFactories: Map<typeof Dependency, any>;
		dependencyTemplates: Map<typeof Dependency, any>;
		mainTemplate: MainTemplate;
		moduleTemplate: ModuleTemplate;
		errors?: Error[];

		constructor(compiler: Compiler);

		addModule(module: Module, cacheGroup?: string): Module | boolean;
		buildModule(module: Module, optional: boolean, origin: Module | null, dependencies: any[] | null, callback: (error?: Error) => void): void;
		processModuleDependencies(module: Module, callback: (error?: Error) => void): void;

		plugin(name: 'normal-module-loader', fn: (this: Compilation, loaderContext: any, module: Module) => void): void;
		plugin(name: 'seal', fn: (this: Compilation) => void): void;
		plugin(name: 'optimize', fn: (this: Compilation) => void): void;
		plugin(name: 'optimize-tree', fn: (this: Compilation, chunks: Chunk[], modules: Module[], callback: (error?: Error) => void) => void): void;
		plugin(name: 'optimize-modules', fn: (this: Compilation, modules: Module[]) => any): void;
		plugin(name: 'after-optimize-modules', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'optimize-chunks', fn: (this: Compilation, chunks: Chunk[]) => any): void;
		plugin(name: 'after-optimize-chunks', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'revive-modules', fn: (this: Compilation, modules: Module[], records: any) => void): void;
		plugin(name: 'optimize-module-order', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'optimize-module-ids', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'after-optimize-module-ids', fn: (this: Compilation, modules: Module[]) => void): void;
		plugin(name: 'revive-chunks', fn: (this: Compilation, chunks: Chunk[], records: any) => void): void;
		plugin(name: 'optimize-chunk-order', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'optimize-chunk-ids', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'after-optimize-chunk-ids', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'record-modules', fn: (this: Compilation, modules: Module[], records: any) => void): void;
		plugin(name: 'record-chunks', fn: (this: Compilation, chunks: Chunk[], records: any) => void): void;
		plugin(name: 'before-hash', fn: (this: Compilation) => void): void;
		plugin(name: 'after-hash', fn: (this: Compilation) => void): void;
		plugin(name: 'before-chunk-assets', fn: (this: Compilation) => void): void;
		plugin(name: 'additional-chunk-assets', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'record', fn: (this: Compilation, compilation: Compilation, records: any) => void): void;
		plugin(name: 'optimize-chunk-assets', fn: (this: Compilation, chunks: Chunk[], callback: (error?: Error) => void) => void): void;
		plugin(name: 'after-optimize-chunk-assets', fn: (this: Compilation, chunks: Chunk[]) => void): void;
		plugin(name: 'optimize-assets', fn: (this: Compilation, assets: { [key: string]: Source }, callback: (error?: Error) => void) => void): void;
		plugin(name: 'after-optimize-assets', fn: (this: Compilation, assets: { [key: string]: Source }) => void): void;
		plugin(name: 'build-module', fn: (this: Compilation, module: Module) => void): void;
		plugin(name: 'succeed-module', fn: (this: Compilation, module: Module) => void): void;
		plugin(name: 'failed-module', fn: (this: Compilation, module: Module, error: Error) => void): void;
		plugin(name: 'module-asset', fn: (this: Compilation, module: Module, file: string) => void): void;
		plugin(name: 'chunk-asset', fn: (this: Compilation, chunk: Chunk, file: string) => void): void;
		plugin(name: 'need-additional-pass', fn: (this: Compilation) => boolean): void;
	}

	export = Compilation;
}

declare module 'webpack/lib/Compiler' {
	import Tapable = require('tapable');
	import webpack = require('webpack');
	import Compilation = require('webpack/lib/Compilation');
	import NormalModuleFactory = require('webpack/lib/NormalModuleFactory');
	import ContextModuleFactory = require('webpack/lib/ContextModuleFactory');
	import Dependency = require('webpack/lib/Dependency');

	class Compiler extends Tapable {
		options: any;
		watchFileSystem: any;

		run(callback: Compiler.Callback): void;
		runAsChild(callback: Compiler.Callback): void;
		watch(options: any, callback: Compiler.Callback): Compiler.Watching;

		plugin(name: 'watch-run', fn: (this: Compiler, compiler: Compiler) => void): void;
		plugin(name: 'done', fn: (this: Compiler, stats: any) => void): void;
		plugin(name: 'emit', fn: (this: Compiler, compilation: Compilation, callback: () => void) => void): void;
		plugin(name: 'falied', fn: (this: Compiler, error: Error) => void): void;
		plugin(name: 'invalid', fn: (this: Compiler) => void): void;
		plugin(name: 'run', fn: (this: Compiler, compiler: Compiler) => void): void;
		plugin(name: 'emit', fn: (this: Compiler, compilation: Compilation) => void): void;
		plugin(name: 'after-emit', fn: (this: Compiler, compilation: Compilation) => void): void;
		plugin(name: 'compilation', fn: (this: Compiler, compilation: Compilation, params: Compiler.CompilationParams) => void): void;
		plugin(name: 'normal-module-factory', fn: (this: Compiler, factory: NormalModuleFactory) => void): void;
		plugin(name: 'context-module-factory', fn: (this: Compiler, factory: ContextModuleFactory) => void): void;
		plugin(name: 'compile', fn: (this: Compiler, params: any) => void): void;
		plugin(name: 'make', fn: (this: Compiler, compilation: Compilation) => void): void;
		plugin(name: 'after-compile', fn: (this: Compiler, compilation: Compilation) => void): void;
		plugin(name: 'after-environment', fn: (this: Compiler) => void): void;
	}

	namespace Compiler {
		type Callback = (error?: Error | null, stats?: StatsObject) => void;
		interface CompilationParams {
			normalModuleFactory: NormalModuleFactory;
			contextModuleFactory: ContextModuleFactory;
			compilationDependencies: Dependency[];
		}
		interface StatsObject {
			hasErrors(): boolean;
			hasWarnings(): boolean;
			toJson(options?: webpack.Stats): {};
			toString(options?: webpack.Stats): string;
			compilation: Compilation;
		}
		class Watching {
			close(callback: () => void): void;
			invalidate(): void;
			watch(files: any, dirs: any, missing: any): void;
		}
	}

	export = Compiler;
}

declare module 'webpack/lib/ContextModuleFactory' {
	import Tapable = require('tapable');
	import Parser = require('webpack/lib/Parser');

	class ContextModuleFactory extends Tapable {
		plugin(name: 'parser', fn: (this: ContextModuleFactory, parser: Parser, options: any) => void): void;
	}

	export = ContextModuleFactory;
}

declare module 'webpack/lib/ContextReplacementPlugin' {
	import webpack = require('webpack');

	class ContextReplacementPlugin implements webpack.Plugin {
		constructor(resourceRegExp: RegExp, newContentResource?: any, newContentRecursive?: any, newContentRegExp?: any);
		apply(compiler: webpack.Compiler): void;
	}
	export = ContextReplacementPlugin;
}

declare module 'webpack/lib/DependenciesBlock' {
	import Dependency = require('webpack/lib/Dependency');
	import DependenciesBlockVariable = require('webpack/lib/DependenciesBlockVariable');
	import * as crypto from 'crypto';

	class DependenciesBlock {
		dependencies: Dependency[];
		blocks: DependenciesBlock[];
		variables: DependenciesBlockVariable[];

		addBlock(block: DependenciesBlock): void;
		addDependency(dependency: Dependency): void;
		addVariable(name: string, expression: string, dependencies?: Dependency[]): void;
		updateHash(hash: crypto.Hash): void;
		disconnect(): void;
		unseal(): void;
		hasDependencies(filter: (dependency: Dependency) => boolean): boolean;
		sortItems(): void;
	}
	export = DependenciesBlock;
}

declare module 'webpack/lib/DependenciesBlockVariable' {
	import Dependency = require('webpack/lib/Dependency');
	import * as crypto from 'crypto';

	class DependenciesBlockVariable {
		name: string;
		expression: string;
		dependencies: Dependency[];

		constructor(name: string, expression: string, dependencies?: Dependency[]);

		updateHash(hash: crypto.Hash): void;
	}

	export = DependenciesBlockVariable;
}

declare module 'webpack/lib/Dependency' {
	import Module = require('webpack/lib/Module');
	import * as crypto from 'crypto';

	class Dependency {
		static compare(a: any, b: any): boolean;

		module: Module;

		isEqualResource(): boolean;
		getReference(): { module: Module; importedNames: boolean; } | null;
		getExports(): string[] | null;
		getWarnings(): string[] | null;
		getErrors(): string[] | null;
		updateHash(hash: crypto.Hash): void;
		disconnect(): void;
		compare(a: any, b: any): boolean;
	}
	export = Dependency;
}

declare module 'webpack/lib/MainTemplate' {
	class MainTemplate {
		plugin(name: string, fn: Function): void;
	}
	export = MainTemplate;
}

declare module 'webpack/lib/Module' {
	import DependenciesBlock = require('webpack/lib/DependenciesBlock');
	import Chunk = require('webpack/lib/Chunk');

	class Module extends DependenciesBlock {
		context: any;
		reasons: any[];
		debugId: number;
		lastId: number;
		id: number;
		portableId: number;
		chunks: Chunk[];
		strict: boolean;
		meta: any;

		addChunk(chunk: Chunk): void;
		removeChunk(chunk: Chunk): void;
	}

	export = Module;
}

declare module 'webpack/lib/ModuleTemplate' {
	import Template = require('webpack/lib/Template');
	import Module = require('webpack/lib/Module');
	import Chunk = require('webpack/lib/Chunk');
	import Source = require('webpack-sources/lib/Source');
	import * as crypto from 'crypto';

	class ModuleTemplate extends Template {
		plugin(name: 'module', fn: (this: ModuleTemplate, moduleSource: Source, module: Module, chunk: Chunk, dependencyTemplates: Template[]) => Source): void;
		plugin(name: 'render', fn: (this: ModuleTemplate, moduleSource: Source, module: Module, chunk: Chunk, dependencyTemplates: Template[]) => Source): void;
		plugin(name: 'package', fn: (this: ModuleTemplate, moduleSource: Source, module: Module, chunk: Chunk, dependencyTemplates: Template[]) => Source): void;
		plugin(name: 'hash', fn: (this: ModuleTemplate, hash: crypto.Hash) => void): void;
	}

	export = ModuleTemplate;
}

declare module 'webpack/lib/NormalModule' {
	import Module = require('webpack/lib/Module');
	import Parser = require('webpack/lib/Parser');

	class NormalModule extends Module {
		request: string;
		userRequest: string;
		rawRequest: string;
		parser: Parser;
		resource: string;
		context: any;
		loaders: string[];

		constructor(request: string, userRequest: string, rawRequest: string, loaders: string[], resource: string, parser: Parser);
	}

	export = NormalModule;
}

declare module 'webpack/lib/NormalModuleReplacementPlugin' {
	import webpack = require('webpack');
	import NormalModuleFactory = require('webpack/lib/NormalModuleFactory');

	class NormalModuleReplacementPlugin implements webpack.Plugin {
		constructor(resourceRegExp: RegExp, newResource: string | NormalModuleReplacementPlugin.ResourceCallback);

		apply(compiler: webpack.Compiler): void;
	}

	namespace NormalModuleReplacementPlugin {
		type ResourceCallback = (resource: NormalModuleFactory.BeforeData) => void;
	}

	export = NormalModuleReplacementPlugin;
}

declare module 'webpack/lib/NormalModuleFactory' {
	import Tapable = require('tapable');
	import Parser = require('webpack/lib/Parser');
	import Dependency = require('webpack/lib/Dependency');

	class NormalModuleFactory extends Tapable {
		plugin(name: 'after-resolve', fn: NormalModuleFactory.AfterHandler): void;
		plugin(name: 'before-resolve', fn: NormalModuleFactory.BeforeHandler): void;
		plugin(name: 'parser', fn: (this: NormalModuleFactory, parser: Parser, options: any) => void): void;
		plugin(name: 'resolver', fn: (this: NormalModuleFactory, resolver: NormalModuleFactory.Resolver) => NormalModuleFactory.Resolver): void;
	}
	namespace NormalModuleFactory {
		interface BeforeData {
			contextInfo?: any;
			context: string;
			dependencies?: Dependency[];
			request: string;
		}

		type BeforeHandler = (this: NormalModuleFactory, current: BeforeData, callback: Callback<BeforeData>) => void;

		type Callback<T> = (error?: Error | null, nextValue?: T) => void;

		interface AfterData {
			context: string;
			request: string;
			userRequest: string;
			rawRequest: string;
			loaders: string[];
			resource: string;
			parser: Parser;
		}

		type AfterHandler = (this: NormalModuleFactory, current: AfterData, callback: Callback<AfterData>) => void;

		type Resolver = (data: BeforeData, callback: ResolverCallback) => void;
		type ResolverCallback = (error?: Error | null, value?: AfterData) => void;
	}

	export = NormalModuleFactory;
}

declare module 'webpack/lib/NullFactory' {
	class NullFactory {
		create(data: any, callback: () => void): void;
	}

	export = NullFactory;
}

declare module 'webpack/lib/Parser' {
	import Tapable = require('tapable');
	import NormalModule = require('webpack/lib/NormalModule');
	import Module = require('webpack/lib/Module');
	import Compilation = require('webpack/lib/Compilation');
	import Dependency = require('webpack/lib/Dependency');

	class Parser extends Tapable {
		state: Parser.NormalModuleState | Parser.ParsedVariableState;
		plugin(name: string, fn: (this: Parser, ...args: any[]) => any): void;
	}

	namespace Parser {
		interface NormalModuleState {
			current: NormalModule;
			module: NormalModule;
			compilation: Compilation;
			options: any;
		}
		interface ParsedVariableState {
			current: {
				addDependency(dependency: Dependency): void;
			};
			module: Module;
		}
	}

	export = Parser;
}

declare module 'webpack/lib/Template' {
	import Tapable = require('tapable');

	class Template extends Tapable {
		constructor(options: any);
	}

	export = Template;
}

declare module 'webpack/lib/optimize/CommonsChunkPlugin' {
	import webpack = require('webpack');

	class CommonsChunkPlugin implements webpack.Plugin {
		constructor(options: CommonsChunkPlugin.Options);
		apply(compiler: webpack.Compiler): void;
	}
	module CommonsChunkPlugin {
		interface Options {
			name?: string;
			names?: string[];
			filename?: string;
			minChunks?: number | Function;
			chunks?: string[];
			children?: boolean;
			async?: boolean | string;
			minSize?: number;
		}
	}
	export = CommonsChunkPlugin;
}

declare module 'webpack/lib/optimize/UglifyJsPlugin' {
	import webpack = require('webpack');

	class UglifyJsPlugin implements webpack.Plugin {
		constructor(options?: UglifyJsPlugin.Options);
		apply(compiler: webpack.Compiler): void;
	}
	module UglifyJsPlugin {
		type CommentCallback = (astNode: any, comment: any) => boolean;
		interface Compress {
			sequences?: boolean;
			properties?: boolean;
			dead_code?: boolean;
			drop_debugger?: boolean;
			unsafe?: boolean;
			conditionals?: boolean;
			comparisons?: boolean;
			evaluate?: boolean;
			booleans?: boolean;
			loops?: boolean;
			unused?: boolean;
			hoist_funs?: boolean;
			hoist_vars?: boolean;
			if_return?: boolean;
			join_vars?: boolean;
			cascade?: boolean;
			side_effects?: boolean;
			warnings?: boolean;
			global_defs?: { [key: string]: boolean; };
		}
		interface ExtractComments {
			condition?: RegExp | string | CommentCallback;
			filename?: string | ((original: string) => string);
			banner?: false | string | ((original: string) => string);
		}
		interface Mangle {
			except?: string[];
			toplevel?: boolean;
			eval?: boolean;
			keep_fnames?: boolean;
		}
		interface Options {
			compress?: boolean | Compress;
			mangle?: boolean | Mangle;
			beautify?: boolean;
			output?: Output;
			comments?: boolean | RegExp | CommentCallback;
			extractComments?: boolean | RegExp | string | CommentCallback | ExtractComments;
			sourceMap?: boolean;
			test?: RegExp | RegExp[];
			include?: RegExp | RegExp[];
			exclude?: RegExp | RegExp[];
		}
		interface Output {
			indent_start?: number;
			indent_level?: number;
			quote_keys?: boolean;
			space_colon?: boolean;
			ascii_only?: boolean;
			unescape_regexps?: boolean;
			inline_script?: boolean;
			width?: number;
			max_line_length?: number;
			beautify?: boolean;
			source_map?: any | null;
			bracketize?: boolean;
			semicolons?: boolean;
			comments?: boolean;
			shebang?: boolean;
			preserve_line?: boolean;
			screw_ie8?: boolean;
			preamble?: boolean;
			quote_style?: number;
			keep_quoted_props?: boolean;
			wrap_iife?: boolean;
		}
	}
	export = UglifyJsPlugin;
}

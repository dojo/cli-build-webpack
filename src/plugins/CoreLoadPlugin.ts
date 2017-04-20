import * as path from 'path';
import { getBasePath, resolveMid } from './util/main';
import { CallExpression, Program } from 'estree';
import { getNextItem } from './util/parser';
import Set from '@dojo/shim/Set';
import ConcatSource = require('webpack-sources/lib/ConcatSource');
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
import Compiler = require('webpack/lib/Compiler');
import NormalModule = require('webpack/lib/NormalModule');
import Parser = require('webpack/lib/Parser');

const RequireEnsureDependenciesBlock = require('webpack/lib/dependencies/RequireEnsureDependenciesBlock');
const RequireEnsureItemDependency = require('webpack/lib/dependencies/RequireEnsureItemDependency');
const ConstDependency = require('webpack/lib/dependencies/ConstDependency');

interface ModuleIdMap {
	[id: string]: any;
}

/**
 * @private
 * Regular expression that matches JS module IDs.
 */
const jsMidPattern = /\.(t|j)sx?$/;

/**
 * @private
 * Test whether a module was required with a relative mid and is relative to a module with a contextual require.
 *
 * @param module
 * The module to test.
 *
 * @param issuers
 * The userRequest paths for all modules with a contextual require.
 *
 * @return
 * True if the module should be included in the load map; false otherwise.3u
 */
function isContextual(module: NormalModule, issuers: string[]): boolean {
	const { rawRequest, userRequest } = module;
	const relative = /^\.(\.*)\//;
	const request = userRequest.replace(/\.[a-z0-9]+$/i, '');
	return relative.test(rawRequest) && issuers.some((issuer: string) => path.resolve(issuer, rawRequest) === request);
}

/**
 * @private
 * Remove the specified base path from the specified path. If the path begins with the base path, then also remove
 * the node_modules path segment.
 *
 * @param basePath
 * The base path.
 *
 * @param path
 * The path to modify.
 *
 * @return
 * The updated path.
 */
function stripPath(basePath: string, path: string): string {
	let resolved = path.replace(basePath + '/', '').replace(/\..*$/, '');

	if (path.indexOf(basePath) === 0) {
		resolved = resolved.replace('node_modules/', '');
	}

	return resolved;
}

interface CallExpressionWithParent {
	callExpression: CallExpression;
	path: any[];
}

/**
 * Iterate through a Statement and find all the CallExpressions. The call expression and the
 * AST path to the expressio is saved.
 *
 * @param statement
 * @return {CallExpressionWithParent[]}
 */
function findCallExpressions(statement: Program) {
	const callExpressions: CallExpressionWithParent[] = [];

	function walker(path: any[], item: any) {
		if (!item) {
			return;
		}

		if (item instanceof Array) {
			item.forEach(arrayItem => walker([ ...path, item ], arrayItem));
			return;
		}
		else if (item.type === 'CallExpression') {
			callExpressions.push({
				callExpression: item,
				path: path
			});
		}

		const next = getNextItem(item);
		next && walker([ ...path, item ], next);
	}

	walker([], statement);

	return callExpressions;
}

/**
 * An object of chunk names and regular expressions. If the requested resource matches the RegExp, the chunk name
 * will be used.
 */
export interface DojoLoadChunkNames {
	[key: string]: RegExp;
}

/**
 * Options for the DojoLoadPlugin
 */
export interface DojoLoadPluginOptions {
	basePath?: string;
	chunkNames?: DojoLoadChunkNames;
	detectLazyLoads?: boolean;
	ignoredModules?: string[];
	mapAppModules?: boolean;
}

/**
 * A webpack plugin that forces webpack to ignore `require` passed as a value, and replaces `@dojo/core/load` with a
 * custom function that maps string module IDs to webpack's numerical module IDs.
 */
export default class DojoLoadPlugin {
	private _basePath: string;
	private _detectLazyLoads: boolean;
	private _ignoredModules = new Set<string>();
	private _lazyChunkNames: DojoLoadChunkNames;
	private _mapAppModules: boolean;

	constructor(options: DojoLoadPluginOptions = {}) {
		const { basePath = '', chunkNames, detectLazyLoads, ignoredModules, mapAppModules = false } = options;

		this._basePath = basePath;
		this._detectLazyLoads = detectLazyLoads || false;
		this._lazyChunkNames = chunkNames || {};
		this._mapAppModules = mapAppModules;

		if (ignoredModules) {
			ignoredModules.forEach(moduleName => {
				const absolutePath = path.resolve(basePath, moduleName);

				this._ignoredModules.add(absolutePath);
			});
		}
	}

	/**
	 * Set up event listeners on the compiler and compilation. Register any module that uses a contextual require,
	 * replace use of `@dojo/core/load` with a custom load module, passing it a map of all dynamically-required
	 * module IDs.
	 *
	 * @param compiler
	 * The compiler instance.
	 */
	apply(compiler: Compiler) {
		const idMap = Object.create(null) as ModuleIdMap;
		const basePath = this._basePath;
		const bundleLoader = /bundle.*\!/;
		const issuers: string[] = [];
		const detectLazyLoads = this._detectLazyLoads;
		const chunkNames = this._lazyChunkNames;
		const ignoredModules = this._ignoredModules;

		compiler.apply(new NormalModuleReplacementPlugin(/@dojo\/core\/load\.js/, resolveMid('@dojo/core/load/webpack')));

		compiler.plugin('compilation', (compilation, params) => {
			params.normalModuleFactory.plugin('parser', function (parser) {
				parser.plugin('expression require', function (): boolean {
					const state = <Parser.NormalModuleState> this.state;
					if (state && state.current && state.current.meta) {
						issuers.push(getBasePath(state.current.userRequest));
						state.current.meta.isPotentialLoad = true;
						return true;
					}

					return false;
				});

				if (detectLazyLoads) {
					/*
					 Detect lazy loads by iterating through a module and looking for a pattern,
					 call_expression(require, 'some string')
					 */
					parser.plugin('program', function (program: Program) {
						if (parser.state && parser.state.current) {
							const { userRequest } = parser.state.current as any;

							if (userRequest) {
								const source = (<any> parser.state.module)._source;

								if (!source || source.source().indexOf('@dojo/core/load') === -1) {
									return;
								}

								findCallExpressions(program).filter(expression => expression.callExpression.arguments.length === 2).forEach(callExpressionAndParent => {
									const [ first, second ] = callExpressionAndParent.callExpression.arguments;

									if (first.type === 'Identifier' && first.name === 'require') {
										if (second.type === 'Literal' && typeof(second.value) === 'string') {
											const callPath = [ ...callExpressionAndParent.path ];

											const absolutePath = path.resolve(path.dirname(userRequest), second.value);

											if (ignoredModules.has(absolutePath)) {
												return;
											}

											let foundDefineCall = false;

											let index = callPath.length - 1;
											while (index > 0) {
												const entry = callPath[ index-- ];

												if (entry.type === 'CallExpression') {
													if (entry.callee.type === 'MemberExpression' && entry.callee.property.type === 'Identifier' && entry.callee.property.name === 'define') {
														foundDefineCall = true;
														break;
													}
												}
											}

											/*
											We only want to process calls that were made inside of a `registry.define` call.
											 */
											if (!foundDefineCall) {
												return;
											}

											/*
											 Find the containing function of the expression. We'll want this whole
											 function to be wrapped in the require.ensure
											 */
											let fnExpression = callPath.pop();
											while (fnExpression && fnExpression.type !== 'FunctionExpression') {
												fnExpression = callPath.pop();
											}

											/*
											 The require.ensure plugin expects you to actually be calling require.ensure,
											 which has a signature like require.ensure([], function() { }). We need to mock
											 the plugin has a hard coded check on 'expression.arguments[1]' to get a handle
											 to the actual function we want to ensure, so we need to make a pretend expression
											 that looks like a require.ensure call.
											 */
											const temp = {
												type: 'CallExpression',
												arguments: [
													{},
													fnExpression
												],
												range: fnExpression.range
											};

											/*
											 Find an appropriate chunk name (null is an appropriate chunk name).
											 */
											let chunkName = path.basename(absolutePath);

											const applicableNames = Object.keys(chunkNames).filter(name => {
												return chunkNames[ name ].test(<string> second.value);
											});

											if (applicableNames.length > 0) {
												chunkName = applicableNames[ 0 ];
											}

											/*
											 Create the require.ensure block
											 */
											const dep = new RequireEnsureDependenciesBlock(temp, fnExpression, null, chunkName, null, parser.state.module, fnExpression.loc);

											const old: any = parser.state.current;
											parser.state.current = dep;

											/*
											 We add our one dependency to the [] in the ensure
											 */
											(<any> parser).inScope([], () => {
												const edep = new RequireEnsureItemDependency(second.value, second.range);
												edep.loc = dep.loc;
												dep.addDependency(edep);
											});

											/*
											 By default, the require.ensure is not going to execute when we want. We wrap it in a function block
											 to control the execution.
											 */
											old.addDependency(new ConstDependency('function() { return (', fnExpression.range[0]));
											old.addDependency(new ConstDependency('})', fnExpression.range[1] + 1));

											old.addBlock(dep);

											parser.state.current = old;
										}
									}
								});
							}
						}
					});
				}
			});

			compilation.moduleTemplate.plugin('module', (source, module: NormalModule) => {
				if (module.meta && module.meta.isPotentialLoad) {
					const path = stripPath(basePath, module.userRequest);
					const require = `var require = function () { return '${path}'; };`;
					return new ConcatSource(require, '\n', source);
				}
				const load = idMap['@dojo/core/load'] || { id: null };
				if (module.id === load.id) {
					const moduleMap = `var __modules__ = ${JSON.stringify(idMap)};`;
					return new ConcatSource(moduleMap, '\n', source);
				}

				return source;
			});

			compilation.plugin('optimize-module-ids', (modules: NormalModule[]) => {
				const appPath = this._basePath ? path.join(this._basePath, 'src') : 'src';
				function mapModuleId(modulePath: string, module: NormalModule) {
					const { rawRequest, userRequest } = module;
					let lazy = false;
					if (bundleLoader.test(rawRequest)) {
						const afterLoader = userRequest.split('!')[1];
						modulePath = stripPath(basePath, afterLoader);
						lazy = true;
					}
					idMap[modulePath] = { id: module.id, lazy };
				}

				modules.forEach(module => {
					const { rawRequest, userRequest } = module;

					if (rawRequest) {
						if (this._mapAppModules && userRequest.indexOf(appPath) === 0) {
							if (jsMidPattern.test(userRequest)) {
								let modulePath = userRequest.replace(`${this._basePath}/`, '').replace(jsMidPattern, '');
								mapModuleId(modulePath, module);
							}
						}
						else if (rawRequest.indexOf('@dojo') === 0 || !/^\W/.test(rawRequest)) {
							let modulePath = rawRequest;
							mapModuleId(modulePath, module);
						}
						else if (isContextual(module, issuers)) {
							const modulePath = stripPath(basePath, userRequest);
							idMap[modulePath] = { id: module.id, lazy: false };
						}
					}
				});
			});
		});
	}
};

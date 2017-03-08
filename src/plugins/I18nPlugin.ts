import { deepAssign } from '@dojo/core/lang';
import { CldrData } from '@dojo/i18n/cldr/load';
import { Require } from '@dojo/interfaces/loader';
import Map from '@dojo/shim/Map';
import Set from '@dojo/shim/Set';
import { Program } from 'estree';
import * as fs from 'fs';
import * as path from 'path';
import ConcatSource = require('webpack-sources/lib/ConcatSource');
import NormalModule = require('webpack/lib/NormalModule');
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
import Compiler = require('webpack/lib/Compiler');
import InjectModulesPlugin from './InjectModulesPlugin';
import getCldrUrls from './util/i18n';
import { hasExtension, mergeUnique } from './util/main';

declare const require: Require;

export interface DojoI18nPluginOptions {
	/**
	 * The default locale to use as a fallback when the system locale is unsupported. Assumed to correspond to the
	 * default messages in any message bundles.
	 */
	defaultLocale: string;

	/**
	 * A list of message bundle paths. Messages for all supported locales will be included in the build.
	 * Unless the message bundle paths have an extension, a `ts` extension is assumed.
	 */
	messageBundles?: string[];

	/**
	 * The locales whose CLDR data and messages will be included in the main build.
	 */
	supportedLocales?: string[];
}

/**
 * @private
 * Return a list of locale-specific message bundle paths for the provided bundle ID and supported locales.
 * Only paths for existing modules are included.
 *
 * @param bundle
 * The default bundle module ID or path.
 *
 * @param supportedLocales
 * The list of supported locales.
 *
 * @return
 * The list of paths for the locale-specific message bundles.
 */
function getMessageLocalePaths(bundle: string, supportedLocales: string[]): string[] {
	const idSegments = bundle.split('/');
	const base = idSegments.slice(0, -1).join('/');
	const name = idSegments.slice(-1).join();
	const extension = hasExtension(name) ? '' : '.ts';

	return supportedLocales
		.map((locale: string) => path.join(base, locale, name))
		.filter((path: string) => {
			try {
				fs.accessSync(`${path}${extension}`);
				return true;
			}
			catch (error) {
				return false;
			}
		});
}

/**
 * @private
 * Determine whether the specified path is for the `@dojo/i18n/cldr/load` module.
 */
function isCldrLoadModule(path: string): boolean {
	return /cldr\/load\/webpack/.test(path);
}

/**
 * @private
 * Determine whether the specified module path is for a JavaScript/TypeScript module.
 */
function isJsModule(mid: string): boolean {
	return /\.(j|t)sx?$/.test(mid);
}

/**
 * @private
 * Determine whether the specified module path is for a node module.
 */
function isNodeModule(mid: string): boolean {
	return mid.indexOf('node_modules') > -1;
}

/**
 * A webpack plugin that ensures CLDR data and locale-specific messages are available to webpack.
 */
export default class DojoI18nPlugin {
	defaultLocale: string;
	messageBundles?: string[];
	supportedLocales?: string[];

	constructor(options: DojoI18nPluginOptions) {
		const { defaultLocale, messageBundles, supportedLocales } = options;

		this.defaultLocale = defaultLocale;
		this.messageBundles = messageBundles;
		this.supportedLocales = supportedLocales;
	}

	/**
	 * Add messages and CLDR data to the build, and replace `@dojo/i18n/cldr/load` with a webpack-specific
	 * load module.
	 *
	 * @param compiler
	 * The current compiler.
	 */
	apply(compiler: Compiler) {
		const { defaultLocale, messageBundles, supportedLocales } = this;

		compiler.apply(new NormalModuleReplacementPlugin(/\/cldr\/load$/, '@dojo/i18n/cldr/load/webpack'));

		if (supportedLocales && messageBundles && messageBundles.length) {
			messageBundles.forEach(bundle => {
				const localePaths = getMessageLocalePaths(bundle, supportedLocales);

				if (localePaths.length) {
					compiler.apply(new InjectModulesPlugin({
						resourcePattern: new RegExp(bundle),
						moduleIds: localePaths
					}));
				}
			});
		}

		compiler.plugin('compilation', (compilation, data) => {
			const astMap = new Map<string, Program>();
			const containsLoad: string[] = [];
			const contextMap = new Map<string, { issuer: string; request: string; }[]>();

			// An internal set of all fully-resolved module paths, used to determine whether a module path
			// should be added to the issuer map (see below). This exists entirely for performance reasons,
			// specifically to reduce the number of AST objects held in memory. Since modules are parsed only
			// once, this is needed to ensure the issuer map decrementer works correctly.
			const moduleSet = new Set<string>();

			// An internal map of issuer paths to an array of fully-resolved dependency paths.
			// This map exists entirely for performance reasons, specifically to reduce the number of AST
			// objects held in memory.
			const issuerMap = new Map<string, string[]>();

			data.normalModuleFactory.plugin('before-resolve', (result, callback) => {
				if (!result) {
					return callback();
				}

				const { context, contextInfo, request } = result;
				const issuer = contextInfo && contextInfo.issuer;

				if (issuer && !isNodeModule(issuer)) {
					let requestData = contextMap.get(context);
					if (!requestData) {
						requestData = [];
						contextMap.set(context, requestData);
					}
					requestData.push({ issuer, request });
				}

				return callback(null, result);
			});

			data.normalModuleFactory.plugin('after-resolve', (result, callback) => {
				if (!result) {
					return callback();
				}

				const { context, rawRequest, userRequest } = result;
				const requestData = contextMap.get(context);
				if (requestData) {
					const issuer = requestData.filter((item: { issuer: string; request: string; }) => item.request === rawRequest)
						.map(item => item.issuer)[0];

					let issuerData = issuerMap.get(issuer);
					if (!issuerData) {
						issuerData = [];
						issuerMap.set(issuer, issuerData);
					}

					if (isJsModule(userRequest)) {
						if (!moduleSet.has(userRequest)) {
							issuerData.push(userRequest);
							moduleSet.add(userRequest);
						}

						if (isCldrLoadModule(userRequest)) {
							containsLoad.push(issuer);
						}
					}
				}

				return callback(null, result);
			});

			data.normalModuleFactory.plugin('parser', (parser) => {
				parser.plugin('program', (ast: Program) => {
					const { issuer, userRequest } = parser.state.current as any;

					if (userRequest) {
						if (!isNodeModule(userRequest) && isJsModule(userRequest)) {
							astMap.set(userRequest, ast);
						}

						/* istanbul ignore next: internal performance enhancement that has no effect on output */
						if (issuer && issuer.userRequest) {
							const issuerData = issuerMap.get(issuer.userRequest) as string[];

							if (issuerData) {
								const index = issuerData.indexOf(userRequest);

								if (index > -1) {
									issuerData.splice(index, 1);
								}

								if (issuerData.length === 0) {
									issuerMap.delete(issuer.userRequest);
									if (containsLoad.indexOf(issuer.userRequest) < 0) {
										astMap.delete(issuer.userRequest);
									}
								}
							}
						}
					}
				});
			});

			compilation.moduleTemplate.plugin('module', (source, module: NormalModule) => {
				if (isCldrLoadModule(module.userRequest)) {
					const locales = this._getLocales();
					const cldrData = containsLoad.map((path: string) => getCldrUrls(path, astMap.get(path) as Program))
						.reduce(mergeUnique, [])
						.map((url: string) => {
							return locales.map((locale: string) => url.replace('{locale}', locale));
						})
						.reduce(mergeUnique, [])
						.map((mid: string) => require(mid) as CldrData)
						.reduce((cldrData: CldrData, source: CldrData) => {
							return deepAssign(cldrData, source);
						}, Object.create(null));

					astMap.clear();
					return new ConcatSource(`var __cldrData__ = ${JSON.stringify(cldrData)}`, '\n', source);
				}

				return source;
			});
		});
	}

	/**
	 * @protected
	 * Returns a merged array of supported locales.
	 */
	protected _getLocales(this: DojoI18nPlugin) {
		const { defaultLocale, supportedLocales } = this;
		const locales = [ defaultLocale ];
		return Array.isArray(supportedLocales) ? locales.concat(supportedLocales) : locales;
	}
}

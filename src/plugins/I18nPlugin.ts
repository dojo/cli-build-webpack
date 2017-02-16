import { CldrData, CldrDataResponse, localeCldrPaths, supplementalCldrPaths } from '@dojo/i18n/cldr/load';
import { Require } from '@dojo/interfaces/loader';
import * as fs from 'fs';
import * as path from 'path';
import * as ConcatSource from 'webpack-sources/lib/ConcatSource';
import * as NormalModuleReplacementPlugin from 'webpack/lib/NormalModuleReplacementPlugin';
import InjectModulesPlugin from './InjectModulesPlugin';
import { hasExtension } from './util';

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
 * Loads the supplemental CLDR modules, as well as the CLDR modules for the specified locales.
 *
 * @param locales
 * The locales to load.
 *
 * @return
 * The loaded CLDR data.
 */
function getCldrData(locales: string[] = []): CldrDataResponse {
	return locales
		.reduce((result: CldrDataResponse, locale: string) => {
			const localePaths = localeCldrPaths.map((path: string) => path.replace('{locale}', locale));
			result[locale] = requirePaths(localePaths);
			return result;
		}, {
			supplemental: requirePaths(supplementalCldrPaths)
		});
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
 * Loads and returns the CLDR modules for the specified paths.
 *
 * @param paths
 * The CLDR paths
 *
 * @return
 * The loaded CLDR modules.
 */
function requirePaths(paths: ReadonlyArray<string>): CldrData[] {
	return paths.map((path: string) => require(`${path}.json`) as CldrData);
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
	apply(this: DojoI18nPlugin, compiler: any) {
		const { defaultLocale, messageBundles, supportedLocales } = this;

		compiler.apply(new NormalModuleReplacementPlugin(/\/cldr\/load$/, '@dojo/i18n/cldr/load/webpack'));

		if (supportedLocales && messageBundles && messageBundles.length) {
			messageBundles.forEach((bundle: string) => {
				const localePaths = getMessageLocalePaths(bundle, supportedLocales);

				if (localePaths.length) {
					compiler.apply(new InjectModulesPlugin({
						resourcePattern: new RegExp(bundle),
						moduleIds: localePaths
					}));
				}
			});
		}

		compiler.plugin('compilation', (compilation: any) => {
			compilation.moduleTemplate.plugin('module', (source: any, module: any) => {
				if (/\/cldr\/load\/webpack/.test(module.userRequest)) {
					const cldrData = getCldrData([ defaultLocale ].concat(supportedLocales || []));
					return new ConcatSource(`var __cldrData__ = ${JSON.stringify(cldrData)}`, '\n', source);
				}
				return source;
			});
		});
	}
}

import webpack = require('webpack');
import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import ExternalLoaderPlugin from '@dojo/webpack-contrib/external-loader-plugin/ExternalLoaderPlugin';
import CssModulePlugin from '@dojo/webpack-contrib/css-module-plugin/CssModulePlugin';
import { BuildArgs } from './main';

const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AutoRequireWebpackPlugin = require('auto-require-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;
const DefinePlugin = require('webpack/lib/DefinePlugin');

const isCLI = process.env.DOJO_CLI;
const packagePath = isCLI ? '.' : '@dojo/cli-build-webpack';
const CoreLoadPlugin = require(`${packagePath}/plugins/CoreLoadPlugin`).default;
const I18nPlugin = require(`${packagePath}/plugins/I18nPlugin`).default;
const IgnoreUnmodifiedPlugin = require(`${packagePath}/plugins/IgnoreUnmodifiedPlugin`).default;
const basePath = process.cwd();

const packageJsonPath = path.join(basePath, 'package.json');
const packageJson = existsSync(packageJsonPath) ? require(packageJsonPath) : undefined;

let tslintExists = false;
try {
	require(path.join(basePath, 'tslint'));
	tslintExists = true;
} catch (ignore) { }

type IncludeCallback = (args: BuildArgs) => any;

function getJsonpFunction(name?: string) {
	let jsonpFunction = 'dojoWebpackJsonp';
	if (name) {
		jsonpFunction += '_' + name.replace(/[^a-z0-9_]/g, ' ').trim().replace(/\s+/g, '_');
	}
	return jsonpFunction;
}

interface UMDCompatOptions {
	bundles?: {
		[key: string]: string[];
	};
}

function getUMDCompatLoader(options: UMDCompatOptions) {
	const { bundles = {} } = options;
	return {
		loader: 'umd-compat-loader',
		options: {
			imports(module: string, context: string) {
				const filePath = path.relative(basePath, path.join(context, module));
				let chunkName = filePath;
				Object.keys(bundles).some((name) => {
					const bundlePaths = bundles[name].map(bundlePath => path.normalize(bundlePath));
					if (bundlePaths.indexOf(filePath) > -1) {
						chunkName = name;
						return true;
					}
					return false;
				});
				return `promise-loader?global,${chunkName}!${module}`;
			}
		}
	};
}

interface BuildConfigOptions {
	target?: 'web' | 'node';
}

function webpackConfig(args: Partial<BuildArgs>) {
	args = args || {};

	const cssLoader = ExtractTextPlugin.extract({ use: 'css-loader?sourceMap' });
	const localIdentName = (args.watch || args.withTests) ? '[name]__[local]__[hash:base64:5]' : '[hash:base64:8]';
	const externalDependencies = (args.externals && args.externals.dependencies) || [];
	const includesExternals = Boolean(externalDependencies.length);
	const cssModuleLoader = ExtractTextPlugin.extract({
		use: [
			'@dojo/webpack-contrib/css-module-decorator-loader',
			`css-loader?modules&sourceMap&importLoaders=1&localIdentName=${localIdentName}`,
			{
				loader: 'postcss-loader?sourceMap',
				options: {
					config: {
						path: path.join(__dirname, 'postcss.config.js')
					}
				}
			}
		]
	});

	function includeWhen(predicate: any, callback: IncludeCallback, elseCallback: IncludeCallback | null = null) {
		return predicate ? callback(args as any) : (elseCallback ? elseCallback(args as any) : []);
	}

	const ignoredModules: string[] = [];

	if (args.bundles && Object.keys(args.bundles)) {
		Object.keys(args.bundles).forEach(bundleName => {
			(args.bundles || {})[bundleName].forEach(moduleName => {
				ignoredModules.push(moduleName);
			});
		});
	}

	const jsonpFunctionName = getJsonpFunction(packageJson && packageJson.name);

	const outputConfig: webpack.Output = {
		chunkFilename: '[name].js',
		filename: '[name].js',
		jsonpFunction: jsonpFunctionName,
		libraryTarget: 'umd',
		path: path.resolve('./dist')
	};

	const config: webpack.Config = {
		externals: [
			function (context, request, callback) {
				const externals = externalDependencies || [];
				function findExternalType(externals: (string | { name?: string; type?: string; })[]): string | void {
					for (let external of externals) {
						const name = external && (typeof external === 'string' ? external : external.name);
						if (name && new RegExp(`^${name}[!\/]`).test(request)) {
							return (typeof external === 'string' ? '' : external.type) || 'amd';
						}
					}
				}

				const type = findExternalType(externals.concat('intern'));
				if (type) {
					return callback(null, `${type} ${request}`);
				}

				callback();
			}
		],
		entry: includeWhen(args.element, args => {
			return {
				[args.elementPrefix]: `${__dirname}/templates/custom-element.js`,
				'widget-core': '@dojo/widget-core'
			};
		}, args => {
			return {
				...includeWhen(args.withTests, () => {
					return {
						[`../_build/tests/unit/all`]: [ path.join(basePath, 'tests/unit/all.ts') ],
						[`../_build/tests/functional/all`]: [ path.join(basePath, 'tests/functional/all.ts') ],
						[`../_build/src/main`]: [
							path.join(basePath, 'src/main.css'),
							path.join(basePath, 'src/main.ts')
						]
					};
				}, () => {
					return {
						'src/main': [
							'@dojo/shim/main',
							'@dojo/shim/browser',
							path.join(basePath, 'src/main.css'),
							path.join(basePath, 'src/main.ts')
						]
					};
				})
			};
		}),
		node: {
			dgram: 'empty',
			net: 'empty',
			tls: 'empty',
			fs: 'empty'
		},
		plugins: [
			new CleanWebpackPlugin([ '_build', 'dist' ], { root: basePath }),
			new AutoRequireWebpackPlugin(/src\/main/),
			new webpack.BannerPlugin(readFileSync(require.resolve(`${packagePath}/banner.md`), 'utf8')),
			/**
			 * We're using the banner plugin here to fix a bug with the webpack jsonp function. When the function is used
			 * in the test bundle, the variable is not scoped at all, so it has, in our case, a function scope in node.
			 * This little hack makes sure the function is defined by grabbing it from the window scope (jsdom).
			 */
			new webpack.BannerPlugin(<any> {
				banner: `var ${jsonpFunctionName} = ${jsonpFunctionName} || window["${jsonpFunctionName}"];`,
				raw: true,
				test: /tests\/unit\/all\.*/
			}),
			new CssModulePlugin(basePath),
			new IgnorePlugin(/request\/providers\/node/),
			new webpack.ContextReplacementPlugin(/dojo-app[\\\/]lib/, { test: () => false }),
			...includeWhen(args.watch, () => {
				return [ new IgnoreUnmodifiedPlugin() ];
			}),
			...includeWhen(args.element, () => [ new DefinePlugin({
				__dojoCustomElements__: true
			}) ]),
			includeWhen(args.element, args => {
				return new ExtractTextPlugin({ filename: `${args.elementPrefix}.css` });
			}, () => {
				return new ExtractTextPlugin({ filename: 'main.css', allChunks: true });
			}),
			...includeWhen(!args.watch && !args.withTests, () => {
				return [ new OptimizeCssAssetsPlugin({
					cssProcessorOptions: {
						map: { inline: false }
					}
				}) ];
			}),
			includeWhen(args.element, () => {
				return new CopyWebpackPlugin([
					{ context: 'src', from: '**/*', ignore: [ '*.ts', '*.css', '*.html' ] }
				]);
			}, () => {
				return new CopyWebpackPlugin([
					{ context: 'src', from: '**/*', ignore: '*.ts' }
				]);
			}),
			new CoreLoadPlugin({
				basePath,
				detectLazyLoads: !args.disableLazyWidgetDetection,
				ignoredModules,
				mapAppModules: args.withTests
			}),

			...includeWhen(args.element, () => {
				return [ new webpack.optimize.CommonsChunkPlugin({
					name: 'widget-core',
					filename: 'widget-core.js'
				})];
			}),
			...includeWhen(!args.watch && !args.withTests, () => {
				return [ new webpack.optimize.UglifyJsPlugin({
					sourceMap: true,
					compress: { warnings: false },
					exclude: /tests[/]/
				}) ];
			}),
			includeWhen(args.element, args => {
				return new HtmlWebpackPlugin({
					inject: false,
					template: path.join(__dirname, 'templates/custom-element.html'),
					filename: `${args.elementPrefix}.html`
				});
			}, () => {
				return new HtmlWebpackPlugin({
					inject: true,
					chunks: [ 'src/main' ],
					template: 'src/index.html'
				});
			}),
			...includeWhen(args.locale, args => {
				const { locale, messageBundles, supportedLocales, watch } = args;
				return [
					new I18nPlugin({
						cacheCldrUrls: watch,
						defaultLocale: locale,
						supportedLocales,
						messageBundles
					})
				];
			}),
			...includeWhen(!args.watch && !args.withTests, () => {
				return [
					new BundleAnalyzerPlugin({
						analyzerMode: 'static',
						openAnalyzer: false,
						reportType: 'sunburst'
					})
				];
			}),
			...includeWhen(args.withTests, () => {
				return [
					new CopyWebpackPlugin([
						{context: 'tests', from: '**/*', ignore: '*.ts', to: '../_build/tests' }
					]),
					new HtmlWebpackPlugin ({
						inject: true,
						chunks: [ 'src', '../_build/src/main' ],
						template: 'src/index.html',
						filename: '../_build/src/index.html'
					}),
					new webpack.optimize.CommonsChunkPlugin({
						name: 'src',
						filename: '../_build/src/src.js',
						chunks: ['../_build/src/main', '../_build/tests/unit/all'],
						minChunks: (module: any) => {
							if (module.resource && !(/^.*\.(ts)$/).test(module.resource)) {
								return false;
							}

							return module.context && module.context.indexOf('src/') !== -1;
						}
					})];
			}),
			...includeWhen(includesExternals, () => [
				new ExternalLoaderPlugin({
					dependencies: externalDependencies,
					outputPath: args.externals && args.externals.outputPath,
					pathPrefix: args.withTests ? '../_build/src' : ''
				})
			])
		],
		output: includeWhen(args.element, args => {
			return Object.assign(outputConfig, {
				libraryTarget: 'jsonp',
				path: path.resolve(`./dist/${args.elementPrefix}`)
			});
		}, () => {
			return Object.assign(outputConfig, {
				library: '[name]',
				umdNamedDefine: true
			});
		}),
		devtool: 'source-map',
		resolve: {
			modules: [
				basePath,
				path.join(basePath, 'node_modules')
			],
			extensions: ['.ts', '.tsx', '.js']
		},
			resolveLoader: {
				modules: [
					path.join(isCLI ? __dirname : 'node_modules/@dojo/cli-build-webpack', 'loaders'),
					path.join(__dirname, 'node_modules'),
					'node_modules' ]
			},
			module: {
				rules: [
					...includeWhen(tslintExists, () => {
						return [
							{
								test: /\.ts$/,
								enforce: 'pre',
								loader: 'tslint-loader',
								options: {
									tsConfigFile: path.join(basePath, 'tslint.json'),
								...includeWhen(!args.watch && !args.withTests, () => {
									return {
										emitErrors: true,
										failOnHint: true
									};
								})}
						}
					];
				}),
				{ test: /@dojo\/.*\.js$/, enforce: 'pre', loader: 'source-map-loader-cli', options: { includeModulePaths: true } },
				{ test: /src[\\\/].*\.ts?$/, enforce: 'pre', loader: '@dojo/webpack-contrib/css-module-dts-loader?type=ts&instanceName=0_dojo' },
				{ test: /src[\\\/].*\.m\.css?$/, enforce: 'pre', loader: '@dojo/webpack-contrib/css-module-dts-loader?type=css' },
				{ test: /src[\\\/].*\.ts(x)?$/, use: [
					{
						loader: '@dojo/webpack-contrib/static-build-loader',
						options: {
							features: args.features
						}
					},
					getUMDCompatLoader({ bundles: args.bundles }),
					{
						loader: 'ts-loader',
						options: {
							instance: 'dojo',
							onlyCompileBundledFiles: true
						}
					}
				]},
				{ test: /\.js?$/, use: [
					{
						loader: '@dojo/webpack-contrib/static-build-loader',
						options: {
							features: args.features
						}
					},
					'umd-compat-loader'
				]},
				{ test: new RegExp(`globalize(\\${path.sep}|$)`), loader: 'imports-loader?define=>false' },
				...includeWhen(!args.element, () => {
					return [
						{ test: /\.html$/, loader: 'html-loader' }
					];
				}),
				{ test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i, loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]' },
				{ test: /\.css$/, exclude: /src[\\\/].*/, loader: cssLoader },
				{ test: /src[\\\/].*\.css?$/, loader: cssModuleLoader },
				{ test: /\.m\.css\.js$/, exclude: /src[\\\/].*/, use: ['json-css-module-loader'] },
				...includeWhen(args.withTests, () => {
					return [
						{ test: /tests[\\\/].*\.ts?$/, use: [
							'umd-compat-loader',
							{
								loader: 'ts-loader',
								options: {
									instance: 'dojo',
									onlyCompileBundledFiles: true
								}
							}
						] },
						{
							test: /src\/.*\.ts$/,
							use: {
								loader: 'istanbul-loader'
							},
							enforce: 'post'
						}
					];
				}),
				...includeWhen(args.element, args => {
					return [
						{ test: /custom-element\.js/, loader: `imports-loader?widgetFactory=${args.element}` }
					];
				}),
				...includeWhen(args.bundles && Object.keys(args.bundles).length, () => {
					const loaders: any[] = [];

					Object.keys(args.bundles || {}).forEach(bundleName => {
						(args.bundles || {})[ bundleName ].forEach(fileName => {
							loaders.push({
								test: /main\.ts/,
								loader: {
									loader: 'imports-loader',
									options: {
										'__manual_bundle__': `bundle-loader?lazy&name=${bundleName}!${fileName}`
									}
								}
							});
						});
					});

					return loaders;
				})
			]
		}
	};

	if (args.debug) {
		config.profile = true;
	}

	return config;
}

module.exports = isCLI ? webpackConfig : webpackConfig({});

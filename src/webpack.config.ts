import webpack = require('webpack');
import NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
import * as path from 'path';
import { existsSync } from 'fs';
import { BuildArgs } from './main';
import Set from '@dojo/shim/Set';
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;
const postcssImport = require('postcss-import');
const postcssCssNext = require('postcss-cssnext');

const isCLI = process.env.DOJO_CLI;
const packagePath = isCLI ? '.' : '@dojo/cli-build-webpack';
const CoreLoadPlugin = require(`${packagePath}/plugins/CoreLoadPlugin`).default;
const I18nPlugin = require(`${packagePath}/plugins/I18nPlugin`).default;

const basePath = process.cwd();

type IncludeCallback = (args: BuildArgs) => any;

function webpackConfig(args: Partial<BuildArgs>) {
	args = args || {};

	const cssLoader = ExtractTextPlugin.extract({ use: 'css-loader?sourceMap' });
	const localIdentName = args.watch ? '[name]__[local]__[hash:base64:5]' : '[hash:base64:8]';
	const cssModuleLoader = ExtractTextPlugin.extract({
		use: [
			'css-module-decorator-loader',
			`css-loader?modules&sourceMap&importLoaders=1&localIdentName=${localIdentName}`,
			{
				loader: 'postcss-loader?sourceMap',
				options: {
					plugins: [
						postcssImport,
						postcssCssNext({
							features: {
								autoprefixer: {
									browsers: [ 'last 2 versions', 'ie >= 10' ]
								}
							}
						})
					]
				}
			}
		]
	});

	const replacedModules = new Set<string>();

	function includeWhen(predicate: any, callback: IncludeCallback, elseCallback: IncludeCallback | null = null) {
		return predicate ? callback(args as any) : (elseCallback ? elseCallback(args as any) : []);
	}

	const config: webpack.Config = {
		externals: [
			function (context, request, callback) {
				if (/^intern[!\/]/.test(request)) {
					return callback(null, 'amd ' + request);
				}

				if (/request\/providers\/node/.test(request)) {
					return callback(null, 'amd ' + request);
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
				'src/main': [
					path.join(basePath, 'src/main.css'),
					path.join(basePath, 'src/main.ts')
				],
				...includeWhen(args.withTests, () => {
					return {
						'../_build/tests/unit/all': [ path.join(basePath, 'tests/unit/all.ts') ],
						'../_build/tests/functional/all': [ path.join(basePath, 'tests/functional/all.ts') ],
						'../_build/src/main': [
							path.join(basePath, 'src/main.css'),
							path.join(basePath, 'src/main.ts')
						]
					};
				})
			};
		}),
		plugins: [
			new NormalModuleReplacementPlugin(/\.css$/, result => {
				const requestFileName = path.resolve(result.context, result.request);
				const jsFileName = requestFileName + '.js';

				if (replacedModules.has(requestFileName)) {
					replacedModules.delete(requestFileName);
				} else if (existsSync(jsFileName)) {
					replacedModules.add(requestFileName);
					result.request = result.request.replace(/\.css$/, '.css.js');
				}
			}),
			new webpack.ContextReplacementPlugin(/dojo-app[\\\/]lib/, { test: () => false }),
			includeWhen(args.element, args => {
				return new ExtractTextPlugin({ filename: `${args.elementPrefix}.css` });
			}, () => {
				return new ExtractTextPlugin({ filename: 'main.css', allChunks: true });
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
			new CoreLoadPlugin(),
			...includeWhen(args.element, () => {
				return [ new webpack.optimize.CommonsChunkPlugin({
					name: 'widget-core',
					filename: 'widget-core.js'
				}) ];
			}),
			new webpack.optimize.UglifyJsPlugin({ sourceMap: true, compress: { warnings: false }, exclude: /tests[/]/ }),
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
				const supportedLocales = Array.isArray(args.supportedLocales) ? args.supportedLocales : [ args.supportedLocales ];
				const messageBundles = Array.isArray(args.messageBundles) ? args.messageBundles : [ args.messageBundles ];
				return [
					new I18nPlugin({
						defaultLocale: args.locale,
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
						chunks: [ '../_build/src/main' ],
						template: 'src/index.html',
						filename: '../_build/src/index.html'
					})
				];
			})
		],
		output: {
			libraryTarget: 'umd',
			path: includeWhen(args.element, args => {
				return path.resolve(`./dist/${args.elementPrefix}`);
			}, () => {
				return path.resolve('./dist');
			}),
			filename: '[name].js'
		},
		devtool: 'source-map',
		resolve: {
			modules: [
				basePath,
				path.join(basePath, 'node_modules')
			],
			extensions: ['.ts', '.js']
		},
		resolveLoader: {
			modules: [
				path.join(isCLI ? __dirname : 'node_modules/@dojo/cli-build-webpack', 'loaders'),
				path.join(__dirname, 'node_modules'),
				'node_modules' ]
		},
		module: {
			rules: [
				{ test: /@dojo\/.*\.js$/, enforce: 'pre', loader: 'source-map-loader', options: { includeModulePaths: true } },
				{ test: /src[\\\/].*\.ts?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=ts&instanceName=0_dojo' },
				{ test: /src[\\\/].*\.css?$/, enforce: 'pre', loader: 'css-module-dts-loader?type=css' },
				{ test: /src[\\\/].*\.ts?$/, use: [
					'umd-compat-loader',
					{
						loader: 'ts-loader',
						options: {
							instance: 'dojo'
						}
					}
				]},
				{ test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: /globalize(\/|$)/, loader: 'imports-loader?define=>false' },
				...includeWhen(!args.element, () => {
					return [
						{ test: /\.html$/, loader: 'html-loader' }
					];
				}),
				{ test: /.*\.(gif|png|jpe?g|svg)$/i, loader: 'file-loader?hash=sha512&digest=hex&name=[hash:base64:8].[ext]' },
				{ test: /\.css$/, exclude: /src[\\\/].*/, loader: cssLoader },
				{ test: /src[\\\/].*\.css?$/, loader: cssModuleLoader },
				{ test: /\.css.js$/, exclude: /src[\\\/].*/, use: ['json-css-module-loader'] },
				...includeWhen(args.withTests, () => {
					return [
						{ test: /tests[\\\/].*\.ts?$/, use: [
							'umd-compat-loader',
							{
								loader: 'ts-loader',
								options: {
									instance: 'dojo'
								}
							}
						] }
					];
				}),
				...includeWhen(args.element, args => {
					return [
						{ test: /custom-element\.js/, loader: `imports-loader?widgetFactory=${args.element}` }
					];
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

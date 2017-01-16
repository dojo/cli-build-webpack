const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer-sunburst').BundleAnalyzerPlugin;
const path = require('path');
const CoreLoadPlugin = require('./plugins/CoreLoadPlugin').default;
const I18nPlugin = require('./plugins/I18nPlugin').default;
const InjectModulesPlugin = require('./plugins/InjectModulesPlugin').default;
const basePath = process.cwd();

module.exports = function (args) {
	args = args || {};

	const plugins = [
		new webpack.ContextReplacementPlugin(/dojo-app[\\\/]lib/, { test: () => false }),
		new ExtractTextPlugin('main.css'),
		new CopyWebpackPlugin([
			{ context: 'src', from: '**/*', ignore: '*.ts' },
		]),
		new webpack.optimize.DedupePlugin(),
		new InjectModulesPlugin({
			resourcePattern: /dojo-core\/request(\.js)?$/,
			moduleIds: [ './request/xhr' ]
		}),
		new CoreLoadPlugin(),
		new webpack.optimize.UglifyJsPlugin({ compress: { warnings: false }, exclude: /tests[/]/ }),
		new HtmlWebpackPlugin ({
			inject: true,
			chunks: [ 'src/main' ],
			template: 'src/index.html'
		})
	];

	if (!args.watch && !args.withTests) {
		plugins.push(new BundleAnalyzerPlugin({
			analyzerMode: 'static',
			openAnalyzer: false,
			reportType: 'sunburst'
		}));
	}

	if (args.locale) {
		plugins.push(new I18nPlugin({
			defaultLocale: args.locale,
			supportedLocales: args.supportedLocales,
			messageBundles: args.messagesBundles
		}));
	}

    const webpackConfig = {
        externals: [
            function (context, request, callback) {
                if (/^intern[!\/]/.test(request)) {
                    return callback(null, "amd " + request);
                }
                callback();
            }
        ],
        entry: {
            'src/main': [
                path.join(basePath, 'src/main.styl'),
                path.join(basePath, 'src/main.ts')
            ]
        },
        plugins: plugins,
        output: {
            libraryTarget: 'umd',
            path: path.resolve('./dist'),
            filename: '[name].js'
        },
        devtool: 'source-map',
        resolve: {
            root: [ basePath ],
            extensions: ['', '.ts', '.tsx', '.js'],
            alias: {
                rxjs: '@reactivex/rxjs/dist/amd'
            }
        },
        resolveLoader: {
            root: [ path.join(__dirname, 'node_modules') ]
        },
        module: {
            preLoaders: [
                {
                    test: /dojo-.*\.js$/,
                    loader: 'source-map-loader'
                }
            ],
            loaders: [
                { test: /src[\\\/].*\.ts?$/, loader: 'umd-compat-loader!ts-loader' },
                { test: /\.js?$/, loader: 'umd-compat-loader' },
				{ test: /globalize(\/|$)/, loader: 'imports-loader?define=>false' },
                { test: /\.html$/, loader: 'html' },
                { test: /\.(jpe|jpg|png|woff|woff2|eot|ttf|svg)(\?.*$|$)/, loader: 'file?name=[path][name].[hash:6].[ext]' },
                { test: /\.styl$/, loader: ExtractTextPlugin.extract(['css-loader?sourceMap', 'stylus-loader']) },
                { test: /\.css$/, loader: 'style-loader!css-loader?modules' },
            ]
        }
    };

    if (args.withTests) {
        plugins.push(
            new CopyWebpackPlugin([
                {context: 'tests', from: '**/*', ignore: '*.ts', to: '../_build/tests' },
            ]),
            new HtmlWebpackPlugin ({
                inject: true,
                chunks: [ '../_build/src/main' ],
                template: 'src/index.html',
                filename: '../_build/src/index.html'
            })
        );
        webpackConfig.entry['../_build/tests/unit/all'] = path.join(basePath, 'tests/unit/all.ts');
        webpackConfig.entry['../_build/tests/functional/all'] = path.join(basePath, 'tests/functional/all.ts');
        webpackConfig.entry['../_build/src/main'] = [
            path.join(basePath, 'src/main.styl'),
            path.join(basePath, 'src/main.ts')
        ];
        webpackConfig.module.loaders.push({ test: /tests[\\\/].*\.ts?$/, loader: 'umd-compat-loader!ts-loader' });
    }
    return webpackConfig;
};

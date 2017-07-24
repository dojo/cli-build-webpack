import { Command, EjectOutput, Helper, OptionsHelper } from '@dojo/cli/interfaces';
import { Argv } from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import { underline } from 'chalk';
import webpack = require('webpack');
const WebpackDevServer: any = require('webpack-dev-server');
const config: ConfigFactory = require('./webpack.config');
const pkgDir = require('pkg-dir');

export interface Bundles {
	[key: string]: string[];
}

export interface BuildArgs extends Argv {
	locale: string;
	messageBundles: string | string[];
	supportedLocales: string | string[];
	watch: boolean;
	port: number;
	element: string;
	elementPrefix: string;
	withTests: boolean;
	debug: boolean;
	disableLazyWidgetDetection: boolean;
	bundles: Bundles;
}

interface ConfigFactory {
	(args: Partial<BuildArgs>): webpack.Config;
}

interface WebpackOptions {
	compress: boolean;
	stats: {
		colors: boolean
		chunks: boolean
	};
}

function getConfigArgs(args: BuildArgs): Partial<BuildArgs> {
	const { locale, messageBundles, supportedLocales, watch } = args;
	const options: Partial<BuildArgs> = Object.keys(args).reduce((options: Partial<BuildArgs>, key: string) => {
		if (key !== 'messageBundles' && key !== 'supportedLocales') {
			options[key] = args[key];
		}
		return options;
	}, Object.create(null));

	if (messageBundles) {
		options.messageBundles = Array.isArray(messageBundles) ? messageBundles : [ messageBundles ];
	}

	if (supportedLocales) {
		options.supportedLocales = Array.isArray(supportedLocales) ? supportedLocales : [ supportedLocales ];
	}

	if (args.element && !args.elementPrefix) {
		const factoryPattern = /create(.*?)Element.*?\.ts$/;
		const matches = args.element.match(factoryPattern);

		if (matches && matches[ 1 ]) {
			options.elementPrefix = matches[ 1 ].replace(/[A-Z][a-z]/g, '-\$&').replace(/^-+/g, '').toLowerCase();
		} else {
			console.error(`"${args.element}" does not follow the pattern "createXYZElement". Use --elementPrefix to name element.`);
			process.exit();
		}
	}

	return options;
}

function mergeConfigArgs(...sources: BuildArgs[]): BuildArgs {
	return sources.reduce((args: BuildArgs, source: BuildArgs) => {
		Object.keys(source).forEach((key: string) => {
			const value = source[key];
			if (typeof value !== 'undefined') {
				args[key] = source[key];
			}
		});
		return args;
	}, Object.create(null));
}

function watch(config: webpack.Config, options: WebpackOptions, args: BuildArgs) {
	config.devtool = 'inline-source-map';

	config.entry = (function (entry) {
		if (typeof entry === 'object' && !Array.isArray(entry)) {
			Object.keys(entry).forEach((key) => {
				const value = entry[key];
				if (typeof value === 'string') {
					entry[key] = [ 'webpack-dev-server/client?', value ];
				}
				else {
					value.unshift('webpack-dev-server/client?');
				}
			});
		}
		return entry;
	})(config.entry);

	const compiler = webpack(config);
	const server = new WebpackDevServer(compiler, options);

	return new Promise((resolve, reject) => {
		const port = args.port || 9999;
		server.listen(port, '127.0.0.1', (err: Error) => {
			console.log(`Starting server on http://localhost:${port}`);
			if (err) {
				reject(err);
				return;
			}
		});
	});
}

function compile(config: webpack.Config, options: WebpackOptions) {
	const compiler = webpack(config);
	return new Promise((resolve, reject) => {
		compiler.run((err, stats) => {
			if (err) {
				reject(err);
				return;
			}

			if (stats) {
				if (config.profile) {
					fs.writeFileSync('dist/profile.json', JSON.stringify(stats.toJson()));
				}

				console.log(stats.toString(options.stats));
			}
			resolve({});
		});
	});
}

function buildNpmDependencies(): any {
	try {
		const packagePath = pkgDir.sync(__dirname);
		const packageJsonFilePath = path.join(packagePath, 'package.json');
		const packageJson = <any> require(packageJsonFilePath);

		return {
			[packageJson.name]: packageJson.version,
			...packageJson.dependencies
		};
	}
	catch (e) {
		throw new Error('Failed reading dependencies from package.json - ' + e.message);
	}
}

const command: Command = {
	description: 'create a build of your application',
	register(options: OptionsHelper): void {
		options('w', {
			alias: 'watch',
			describe: 'watch and serve'
		});

		options('p', {
			alias: 'port',
			describe: 'port to serve on when using --watch',
			type: 'number'
		});

		options('t', {
			alias: 'with-tests',
			describe: 'build tests as well as sources'
		});

		options('locale', {
			describe: 'The default locale for the application',
			type: 'string'
		});

		options('supportedLocales', {
			describe: 'Any additional locales supported by the application',
			type: 'array'
		});

		options('messageBundles', {
			describe: 'Any message bundles to include in the build',
			type: 'array'
		});

		options('element', {
			describe: 'Path to a custom element descriptor factory',
			type: 'string'
		});

		options('elementPrefix', {
			describe: 'Output file for custom element',
			type: 'string'
		});

		options('debug', {
			describe: 'Generate package information useful for debugging',
			type: 'boolean'
		});

		options('disableLazyWidgetDetection', {
			describe: 'Disable lazy widget loading detection',
			type: 'boolean'
		});
	},
	run(helper: Helper, args: BuildArgs): Promise<void> {
		const dojoRc = helper.configuration.get() || Object.create(null);
		const options: WebpackOptions = {
			compress: true,
			stats: {
				colors: true,
				chunks: false
			}
		};
		const configArgs = getConfigArgs(mergeConfigArgs(dojoRc as BuildArgs, args));

		if (args.watch) {
			return watch(config(configArgs), options, args) as Promise<void>;
		}
		else {
			return compile(config(configArgs), options) as Promise<void>;
		}
	},
	eject(helper: Helper) {
		const ejectOutput: EjectOutput = {
			npm: {
				devDependencies: {
					...buildNpmDependencies()
				}
			},
			copy: {
				path: __dirname,
				files: [
					'./webpack.config.js'
				]
			},
			hints: [
				'to build run ' + underline('./node_modules/.bin/webpack --config ./config/build-webpack/webpack.config.js')
			]
		};

		return ejectOutput;
	}
};
export default command;

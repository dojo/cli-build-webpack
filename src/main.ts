import { Command, EjectOutput, Helper, OptionsHelper } from '@dojo/interfaces/cli';
import { underline } from 'chalk';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { ExternalDep } from './plugins/ExternalLoaderPlugin';
import webpack = require('webpack');

const WebpackDevServer: any = require('webpack-dev-server');
const config: ConfigFactory = require('./webpack.config');
const pkgDir = require('pkg-dir');

const portRangeDelimeter = ':';
const portListDelimeter = ',';
const defaultPortRange = '9999:9990';

function portStringToInt(portString: string) {
	return parseInt(portString, 10);
}

export interface Bundles {
	[key: string]: string[];
}

export interface BuildArgs {
	[index: string]: any;
	messageBundles: string | string[];
	supportedLocales: string | string[];
	watch: boolean;
	port: string;
	element: string;
	elementPrefix: string;
	withTests: boolean;
	debug: boolean;
	disableLazyWidgetDetection: boolean;
	bundles: Bundles;
	externals: { outputPath?: string; dependencies: ExternalDep[] };
	features: string | string[];
	force: boolean;
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
	const { messageBundles, supportedLocales, watch } = args;
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
		}
		else {
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

async function isPortAvailable(port: number): Promise<boolean> {
	const server = net.createServer();

	return new Promise<boolean>((resolve, reject) => {
		server.once('error', function (err: any) {
			if (err.code === 'EADDRINUSE') {
				resolve(false);
			}
			else {
				reject(new Error(`Unexpected error ${err.message}`));
			}
		});

		server.once('listening', function () {
			server.close();
			resolve(true);
		});

		server.listen(port, '127.0.0.1');
	});
}

async function watch(config: webpack.Config, options: WebpackOptions, args: BuildArgs): Promise<void> {
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
	const portRange = String(args.port || defaultPortRange);
	let ports: number[] = [];
	let serverPort: number | undefined;

	if (portRange.indexOf(portRangeDelimeter) >= 0) {
		let [ low, high ] = portRange.split(portRangeDelimeter).map(portStringToInt);

		if (high < low) {
			[ low, high ] = [ high, low ];
		}

		for (let port = high; port >= low; port--) {
			ports.push(port);
		}
	}
	else if (portRange.indexOf(portListDelimeter) >= 0) {
		ports = portRange.split(portListDelimeter).map(portStringToInt);
	}
	else {
		ports.push(portStringToInt(portRange));
	}

	for (let i = 0; i < ports.length; i++) {
		if (await isPortAvailable(ports[i])) {
			serverPort = ports[i];
			break;
		}
	}

	if (!serverPort) {
		return Promise.reject(new Error(`Cannot start a build server because the port is in use, tried ${ports.join(', ')}. Do you already have a build server running?`));
	}

	const server = new WebpackDevServer(compiler, options);

	return new Promise<void>((resolve, reject) => {
		server.listen(serverPort, '127.0.0.1', (err: Error) => {
			console.log(`Starting server on http://localhost:${serverPort}`);
			if (err) {
				reject(err);
				return;
			}
		});
	});
}

function compile(config: webpack.Config, options: WebpackOptions, args: BuildArgs): Promise<void> {
	const compiler = webpack(config);
	return new Promise<void>((resolve, reject) => {
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

				if (stats.compilation && stats.compilation.errors && stats.compilation.errors.length > 0 && !args.force) {
					reject({
						exitCode: 1,
						message: 'The build failed with errors. Use the --force to overcome this obstacle.'
					});
					return;
				}
			}
			resolve();
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

const command: Command<BuildArgs> = {
	group: 'build',
	name: 'webpack',
	description: 'create a build of your application',
	register(options: OptionsHelper): void {
		options('w', {
			alias: 'watch',
			describe: 'watch and serve'
		});

		options('p', {
			alias: 'port',
			describe: 'port to serve on when using --watch. Can be a single port (9999), a range (9999:9990) or a list (9999,9997)',
			type: 'string'
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

		options('f', {
			alias: 'features',
			describe: 'Features sets to optimize the build with\n\nValid values are: android, chrome, edge, firefox, ie11, ios, node, node8, safari',
			type: 'array'
		});

		options('force', {
			describe: 'Ignore build errors and use a successful return code',
			default: false,
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
			return compile(config(configArgs), options, args) as Promise<void>;
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

import Compiler = require('webpack/lib/Compiler');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');

export type ExternalDescriptor = {
	/**
	 * The path that will be used to load this module. This property is used to configure the build to defer to the
	 * external loader.
	 */
	name?: string
	/**
	 * If this is a boolean, it indicates whether to inject this dependency into the application. If inject is set to
	 * true, this dependency should be a script or stylesheet. If this dependency is a directory and contains one or
	 * more stylesheets or scripts that  should be injected into the application inject can be set to a string or array
	 * of strings that point to the resource(s) to be injected. Only scripts and stylehseets can be injected.
	 */
	inject?: boolean | string | string[];

	/**
	 * Optional property to indicate how this external should be loaded
	 */
	type?: string;

	/**
	 * This is used to specify the location, relative to the project root, from where the dependency should be copied.
	 */
	from?: string;

	/**
	 * This can be used to specify the location, relative to the externals folder, where the dependency should be copied.
	 */
	to?: string;
};

/**
 * Describes an external dependency
 */
export type ExternalDep = string | ExternalDescriptor;

export interface ExternalLoaderOptions {
	/**
	 * The external dependencies
	 */
	dependencies: ExternalDep[];

	/**
	 * Whether to use the build's hash to cache bust injected dependencies.
	 *
	 */
	hash?: boolean;

	/**
	 * Where to copy dependencies to; defaults to "externals"
	 */
	outputPath?: string;

	/**
	 * Used to modify where files are placed(e.g. an alternate location for testing)
	 */
	pathPrefix?: string;
}

export default class ExternalLoaderPlugin {
	private _dependencies: ExternalDep[];
	private _outputPath: string;
	private _pathPrefix: string;
	private _hash: boolean;

	constructor({ dependencies, outputPath, pathPrefix, hash }: ExternalLoaderOptions) {
		this._dependencies = dependencies;
		this._outputPath = outputPath || 'externals';
		this._hash = Boolean(hash);
		this._pathPrefix = pathPrefix ? `${pathPrefix}/` : '';
	}

	apply(compiler: Compiler) {
		const prefixPath = (path: string) => `${this._pathPrefix}${this._outputPath}/${path}`;

		const toInject = this._dependencies.reduce((assets, external) => {
				if (typeof external === 'string') {
					return assets;
				}

				const { inject, to, from } = external;

				if (!inject || !from) {
					return assets;
				}

				const base = to || from;

				if (Array.isArray(inject)) {
					return assets.concat(inject.map(path => prefixPath(`${base}/${path}`)));
				}

				return assets.concat(prefixPath(`${base}${typeof inject === 'string' ? `/${inject}` : ''}`));
			}, [] as string[]);

		compiler.apply(new CopyWebpackPlugin(
			this._dependencies.reduce((config, dependency) => (typeof dependency === 'string' || !dependency.from) ? config : config.concat([ {
				from: `${dependency.from}`,
				to: prefixPath(dependency.to || dependency.from)

			} ]), [] as { from: string, to: string, transform?: Function }[])
		));
		compiler.apply(
			new HtmlWebpackIncludeAssetsPlugin({
				assets: toInject,
				append: false,
				files: `${this._pathPrefix}index.html`,
				hash: this._hash
			})
		);
	}
}

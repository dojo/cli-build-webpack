import * as path from 'path';
import * as NormalModule from 'webpack/lib/NormalModule';
import { Callback, RequestData, Resolver } from './interfaces';
import { getBasePath } from './util';
const basePath = path.join(process.cwd(), 'node_modules');

export interface InjectModulesPluginOptions {
	/**
	 * An optional base path for the injected modules. If not provided, defaults to the `resolve.root` option.
	 * If `resolve.root` is an array, then the first path is used. If there is no `resolve.root`, then
	 * `${process.cwd()}/node_modules/` is used.
	 */
	context?: string;

	/**
	 * The IDs for modules that should be injected into the build. If an array is provided, then the plugin's
	 * `context` is used as the context. An object of contexts to module IDs can also be provided. IDs can be
	 * either relative or absolute. If an ID is relative, then it will be resolved relative to the issuer; if
	 * absolute, it will be resolved relative to the context.
	 */
	moduleIds: ModuleIds;

	/**
	 * The regular expression that matches module paths to determine whether the specified module IDs should
	 * be injected into the relevant chunk(s).
	 */
	resourcePattern: RegExp;
}

export type ModuleIds = string[] | { [basePath: string]: string[] };

/**
 * @private
 * Test whether a module ID is relative or absolute.
 *
 * @param id
 * The module ID.
 */
function isRelative(id: string): boolean {
	return /^\W/.test(id);
}

/**
 * @private
 * Generate the request and loader data for the specified module ID within the specified context.
 *
 * @param id
 * The module ID.
 *
 * @param absContext
 * The context used when the module ID is absolute.
 *
 * @param relativeContext
 * The context used when the module ID is relative.
 *
 * @param resolver
 * The resolver function.
 *
 * @return
 * A promise to the resolved module paths data.
 */
function resolveContextPath(id: string, absContext: string, relativeContext: string, resolver: Resolver): Promise<any> {
	return new Promise((resolve, reject) => {
		resolver({
			context: isRelative(id) ? relativeContext : absContext,
			request: id
		}, (error?: Error, result?: any) => {
			if (error) {
				return reject(error);
			}

			resolve(result);
		});
	});
}

/**
 * @private
 * Resolve the default context to use when resolving the IDs for any injected modules.
 *
 * @param plugin
 * The plugin instance.
 *
 * @param compiler
 * The compiler instance.
 */
function setContext(plugin: InjectModulesPlugin, compiler: any) {
	if (plugin.context) {
		return;
	}

	const resolve = compiler.options.resolve;
	const root = resolve && resolve.root;

	plugin.context = Array.isArray(root) ? root[0] :
		(typeof root === 'string') ? root : basePath;
}

/**
 * @private
 * Validate the presence of module IDs.
 *
 * @param module IDs
 * The module ID array or hash to validate.
 *
 * @throws Error
 */
function validateModuleIds(moduleIds: ModuleIds) {
	const length = Array.isArray(moduleIds) ?
		moduleIds.length :
		Object.keys(moduleIds).reduce((length: number, context: string) => {
			return length + moduleIds[context].length;
		}, 0);

	if (!length) {
		throw new Error('Missing module IDs.');
	}
}

/**
 * A webpack plugin that injects arbitrary modules into the relevant build chunks if a module matching a specified
 * pattern is included somewhere in the current module hierarchy.
 */
export default class InjectModulesPlugin {
	protected _added: string[];
	protected _modules: Map<string, any>;

	context?: string;
	moduleIds: ModuleIds;
	resourcePattern: RegExp;

	constructor(options: InjectModulesPluginOptions) {
		const { context, moduleIds, resourcePattern } = options;

		validateModuleIds(moduleIds);
		this._added = [];
		this._modules = new Map();
		this.context = context;
		this.moduleIds = moduleIds;
		this.resourcePattern = resourcePattern;
	}

	/**
	 * Set up the compiler and compilation event listeners.
	 *
	 * @param compiler
	 * The compiler instance.
	 */
	apply(this: InjectModulesPlugin, compiler: any) {
		const { resourcePattern } = this;
		const resources: string[] = [];
		let compilation: any;

		setContext(this, compiler);

		compiler.plugin('compilation', (currentCompilation: any) => {
			if (!compilation) {
				compilation = currentCompilation;
				compilation.plugin('optimize-chunks', (chunks: any[]) => {
					this._modules.forEach((module: any) => {
						chunks.forEach((chunk: any) => {
							const requests = chunk.modules.map((module: any) => module.userRequest);

							if (requests.some((id: string) => resources.indexOf(id) > -1)) {
								chunk.addModule(module);
								module.addChunk(chunk);
								this.injectModuleDependencies(module, chunk);
							}
						});
					});
				});
			}
		});

		compiler.plugin('done', () => {
			this._added.length = 0;
			compilation = null;
		});

		compiler.plugin('normal-module-factory', (factory: any) => {
			// Listening to the "resolver" event gives access to the resolver function that allows the injected module
			// IDs to be mapped to not only their resources, but also to any loaders.
			factory.plugin('resolver', (resolver: Resolver): Resolver => {
				return (data: any, callback: Callback): any => {
					resolver(data, (error?: Error, result?: any) => {
						if (error) {
							return callback(error);
						}

						const { resource } = result;
						if (resourcePattern.test(resource) && resources.indexOf(resource) === -1) {
							return this.resolve(resource, resolver)
								.then((resolved: RequestData[]) => {
									resources.push(resource);
									return this.createModules(resolved, compilation);
								})
								.then(() => {
									callback(null, result);
								})
								.catch((error: Error) => {
									callback(error);
								});
						}

						callback(null, result);
					});
				};
			});
		});
	}

	/**
	 * Generate and build the module instances, and then inject them into the current compilation.
	 *
	 * @param data
	 * An array of resolved request data used to generate the module object.
	 *
	 * @param compilation
	 * The current compilation.
	 *
	 * @return
	 * A promise that resolves once all modules have been built.
	 */
	createModules(data: RequestData[], compilation: any): Promise<void[]> {
		return Promise.all(data.map((item: any) => {
			return new Promise<void>((resolve, reject) => {
				const { request, userRequest, rawRequest, loaders, resource, parser } = item;
				const module = new NormalModule(request, userRequest, rawRequest, loaders, resource, parser);
				compilation.addModule(module);
				compilation.buildModule(module, (error?: Error) => {
					if (error) {
						return reject(error);
					}

					compilation.processModuleDependencies(module, (error?: Error) => {
						if (error) {
							return reject(error);
						}

						this._modules.set(resource, module);
						resolve();
					});
				});
			});
		}));
	}

	injectModuleDependencies(module: any, chunk: any) {
		if (this._added.indexOf(module.userRequest) > -1) {
			return;
		}

		this._added.push(module.userRequest);
		module.dependencies.forEach((dependency: any) => {
			const modules = Array.isArray(dependency.module) ? dependency.module : [ dependency.module ];
			modules.filter((module?: any) => Boolean(module))
				.forEach((module: any) => {
					chunk.addModule(module);
					module.addChunk(chunk);
					this.injectModuleDependencies(module, chunk);
				});
		});
	}

	/**
	 * Resolve the request data for all modules injected for the specified resource.
	 *
	 * @param resource
	 * The context for the injected modules.
	 *
	 * @param resolver
	 * The resolver function.
	 *
	 * @return
	 * A promise that resolves to the request data for the injected modules.
	 */
	resolve(resource: string, resolver: Resolver): Promise<RequestData[]> {
		const { context, moduleIds } = this;
		const resourcePath = getBasePath(resource);

		if (Array.isArray(moduleIds)) {
			return Promise.all(moduleIds.map((id: string) => {
				return resolveContextPath(id, context as string, resourcePath, resolver);
			}));
		}
		else {
			return Promise.all(Object.keys(moduleIds).reduce((promises: any[], context: string) => {
				return promises.concat(moduleIds[context].map((id: string) => {
					return resolveContextPath(id, context, resourcePath, resolver);
				}));
			}, []));
		}
	}
}

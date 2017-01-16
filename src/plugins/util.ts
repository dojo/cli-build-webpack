/**
 * Strips the module name from the provided path.
 *
 * @param context
 * The context module path.
 *
 * @return
 * The base path.
 */
export function getBasePath(context: string): string {
	const base = context.split('/').slice(0, -1).join('/');
	return base === '' ? '/' : base;
}

const extensionPattern = /\.[a-z0-9]+$/i;

/**
 * Tests a file path for the presence of an extension. Note that the test only accounts for alphanumeric extensions.
 *
 * @param path
 * The file path to test.
 *
 * @return
 * `true` if the file path has an extension; false otherwise.
 */
export function hasExtension(path: string): boolean {
	return extensionPattern.test(path);
}

/**
 * Resolve a module ID to its absolute file path.
 *
 * @param mid
 * The module ID to resolve.
 *
 * @return
 * The resolved module file path.
 */
export function resolveMid(mid: string): string {
	const rootRequire: any = require;
	return typeof rootRequire.toUrl === 'function' ? rootRequire.toUrl(mid) : rootRequire.resolve(mid);
}

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
 * Add any unique strings from the second array into the first array.
 *
 * @param left
 * An array to merge values into.
 *
 * @param right
 * An array with values to merge into the first array.
 *
 * @return
 * A new array containing all unique values from both input arrays.
 */
export function mergeUnique(left: string[], right: string[]): string[] {
	return right.reduce((result: string[], value: string) => {
		if (result.indexOf(value) < 0) {
			result.push(value);
		}
		return result;
	}, left.slice());
}

/**
 * Test whether a module ID is relative or absolute.
 *
 * @param id
 * The module ID.
 *
 * @return
 * `true` if the path is relative; `false` otherwise.
 */
export function isRelative(id: string): boolean {
	const first = id.charAt(0);
	return first !== '/' && first !== '@' && /^\W/.test(id);
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

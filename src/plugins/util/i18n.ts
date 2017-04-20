import Map from '@dojo/shim/Map';
import { CallExpression, Identifier, Program, VariableDeclaration, VariableDeclarator } from 'estree';
import * as path from 'path';
import { getBasePath, isRelative, mergeUnique } from './main';
import { extractArrayValues, getNextItem, isShadowing } from './parser';

/**
 * Return an array of URLs that are passed as arguments to `@dojo/i18n/cldr/load.default` in the specified AST program
 * and with the specified import variable names.
 *
 * @param ast
 * An AST program to parse
 *
 * @param importNames
 * The variables name(s) in the AST program that represent the `@dojo/i18n/cldr/load.default` function.
 * In the overwhelming majority of use cases, there will only be one.
 *
 * @return
 * An array of containing all the string URLs that were passed to the cldr/load function.
 */
export const getLoadCallUrls = (function () {
	// A map of AST nodes to their parent nodes, used to recursively walk back up the tree when a variable
	// is passed to `@dojo/i18n/cldr/load.default`.
	const treeMap = new Map<any, any>();

	/**
	 * @private
	 * Recursively walk the provided AST tree, extracting URL arrays passed to `@dojo/i18n/core/load`.
	 */
	function getLoadCallUrls(item: any, importNames: string[], urls: string[] = []): string[] {
		if (!item || importNames.length === 0) {
			return urls;
		}

		if (Array.isArray(item)) {
			return item.reduce((urls, child: any) => {
				treeMap.set(child, item);
				return getLoadCallUrls(child, importNames, urls);
			}, urls);
		}
		else {
			// If the node in question is redefining our `load.default`, ignore the entire node.
			if (isShadowing(item, importNames)) {
				return urls;
			}

			if (item.type === 'CallExpression') {
				if (item.callee.type === 'MemberExpression' && testMemberExpression(item.callee, importNames)) {
					const arg = item.arguments.length > 1 ? item.arguments[1] : item.arguments[0];
					const argArray = extractArrayValues(arg);

					if (argArray) {
						urls = mergeUnique(urls, argArray);
					}
					else if (arg && arg.type === 'Identifier') {
						// walk up the tree to find the first value with the given name.
						const value = findFirstValue(item, arg.name);

						if (value) {
							const argArray = extractArrayValues(value.init);
							if (argArray) {
								urls = mergeUnique(urls, argArray);
							}
						}
					}
				}
			}

			const nextItem = getNextItem(item);
			treeMap.set(nextItem, item);
			return getLoadCallUrls(nextItem, importNames, urls);
		}
	}

	/**
	 * @private
	 * Walk back up the AST tree from the specified node, looking for a variable with the provided name.
	 */
	function findFirstValue(item: any, name: string): any {
		let parent = treeMap.get(item);
		while (parent) {
			const variableDeclaration = getMatchingVariableDeclaration(parent, name);
			if (variableDeclaration) {
				return variableDeclaration;
			}

			parent = treeMap.get(parent);
		}
	}

	/**
	 * @private
	 * Return the first variable declarations whos name matches the provided name.
	 *
	 * @param item
	 * An AST node, or an array of AST nodes, to inspect.
	 *
	 * @param name
	 * A variable name.
	 *
	 * @return
	 * The variable declaration with the specified name if it exists, `undefined` if it does not.
	 */
	function getMatchingVariableDeclaration(item: any, name: string): any {
		if (Array.isArray(item)) {
			for (let i = 0; i < item.length; i++) {
				const result = getMatchingVariableDeclaration(item[i], name);
				if (result) {
					return result;
				}
			}
		}
		else if (item.type === 'VariableDeclaration') {
			const matching = item.declarations.filter((declaration: any) => declaration.id.name === name);
			return matching[0];
		}
	}

	/**
	 * @private
	 * Determine whether the specified member expression represents the `default` value on the
	 * on an object with at least one of the specified variable names.
	 *
	 * For example, if `importNames` is `[ 'loadCldrData' ]`, then a call to `loadCldrData.default` will match.
	 *
	 * @param item
	 * A MemberExpression node
	 *
	 * @param importNames
	 * A list of variable names.
	 *
	 * @return
	 * `true` if the test passes; `false` otherwise.
	 */
	function testMemberExpression(item: any, importNames: string[]): boolean {
		const { object, property } = item;
		return importNames.indexOf(object.name) > -1 && property.name === 'default';
	}

	return function (program: Program, importNames: string[]): string[] {
		const urls = getLoadCallUrls(program, importNames);
		treeMap.clear();
		return urls;
	};
})();

/**
 * Return an array of variable names for `@dojo/i18n/cldr/load` imports.
 *
 * @param ast
 * An AST program to parse.
 *
 * @return
 * A list of variable names.
 */
export function getLoadImports(ast: Program): string[] {
	return ast.body.filter(item => item.type === 'VariableDeclaration')
		.reduce((a: VariableDeclarator[], b: VariableDeclaration) => {
			return a.concat(b.declarations);
		}, [])
		.filter(((item: VariableDeclarator) => {
			const expression = item.init as CallExpression;
			const callee = expression && expression.callee as Identifier;
			const args = expression && expression.arguments;

			return callee && callee.name === 'require' && args && args.length === 1 && /cldr\/load/.test((<any> args[0]).value);
		}))
		.map(item => (<Identifier> item.id).name);
}

/**
 * Parse an AST program for all URLs passed to `@dojo/i18n/cldr/load`.
 *
 * Note that `@dojo/i18n/cldr/load` must be loaded with `require` for it to be recognized.
 * URLs can be injected as an array either directly to cldr/load function, or via a variable that is defined within
 * the same program. If a variable is used, then its definition MUST be a straightforward array expression:
 * `const cldrUrls = [ ... ]`. More complex operatiions will not be registered (for example:
 * `const supplemental = [ 'likelySubtags' ].map(name => `cldr-data/supplemental/${name}.json`).
 *
 * @param ast
 * An AST program
 *
 * @return
 * An array of any URLs parsed from calls to `@dojo/i18n/cldr/load.default`.
 */
export default function getCldrUrls(context: string, ast: Program): string[] {
	const importNames = getLoadImports(ast);
	const urls = getLoadCallUrls(ast, importNames);
	return urls.map((url: string) => {
		return isRelative(url) ? path.resolve(getBasePath(context), url) : url;
	});
}

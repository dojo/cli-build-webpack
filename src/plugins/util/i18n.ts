import Map from '@dojo/shim/Map';
import {
	ArrayExpression,
	AssignmentExpression,
	BaseFunction,
	CallExpression,
	Expression,
	Identifier,
	Program,
	Property,
	Statement,
	SwitchCase,
	VariableDeclaration,
	VariableDeclarator
} from 'estree';
import * as path from 'path';
import { getBasePath, isRelative, mergeUnique } from './main';

/**
 * @private
 * If the provided node is an array expression, then return an array containing its values.
 *
 * @param item
 * An AST node
 *
 * @return
 * An array of values if the node is an array expression; otherwise, `undefined`.
 */
function extractArrayValues(item: any) {
	if (!isArrayExpression(item)) {
		return;
	}
	return item.elements.map((element: any) => element.value);
}

/**
 * @private
 * Return a parent node's child node, if it exists.
 *
 * @param item
 * The parent node.
 *
 * @return
 * The child node, if it exists.
 */
const getNextItem = (function () {
	const getters = {
		argument: (item: { argument: Expression | null }) => item.argument,
		arguments: (item: { arguments: Expression[] }) => item.arguments,
		assignment: (item: AssignmentExpression) => item.right,
		body: (item: { body: any }) => item.body,
		'case': (item: SwitchCase) => item.consequent,
		cases: (item: { cases: SwitchCase[] }) => item.cases,
		conditional: (item: { alternate: Expression; consequent: Expression; }) => [ item.alternate, item.consequent ],
		elements: (item: { elements: Expression[] }) => item.elements,
		expression: (item: { expression: Expression }) => item.expression,
		expressions: (item: { expressions: Expression[] }) => item.expressions,
		loop: (item: { test: Expression; body: Statement; }) => [ item.test, item.body ],
		properties: (item: { properties: Property[] }) => item.properties,
		value: (item: { value: Expression }) => item.value
	};

	const nextItemMap: { [key: string]: (item: any) => any; } = {
		ArrayExpression: getters.elements,
		AssignmentExpression: getters.assignment,
		CallExpression: getters.arguments,
		ConditionalExpression: getters.conditional,
		DoWhileStatement: getters.loop,
		ExpressionStatement: getters.expression,
		IfStatement: getters.conditional,
		NewExpression: getters.arguments,
		ObjectExpression: getters.properties,
		Property: getters.value,
		ReturnStatement: getters.argument,
		SequenceExpression: getters.expressions,
		SwitchCase: getters['case'],
		SwitchStatement: getters.cases,
		VariableDeclaration: (item: VariableDeclaration) => item.declarations,
		WhileStatement: getters.loop
	};

	[
		'ArrowExpression',
		'ArrowFunctionExpression',
		'BlockStatement',
		'ForInStatement',
		'ForOfStatement',
		'ForStatement',
		'FunctionDeclaration',
		'FunctionExpression',
		'LetStatement',
		'Program',
		'TryStatement'

	].forEach((type: string) => {
		nextItemMap[type] = getters.body;
	});

	return function (item: any): any {
		const getter = nextItemMap[item.type];
		return typeof getter === 'function' ? getter(item) : null;
	};
})();

/**
 * @private
 * Determine whether the provided node is an array expression.
 *
 * @param item
 * The node to test.
 *
 * @return
 * `true` if the item is an array expression; false otherwise.
 */
function isArrayExpression(item: any): item is ArrayExpression {
	return item && item.type === 'ArrayExpression';
}

/**
 * @private
 * Determine whether the provided node is a function declaration.
 *
 * @param item
 * The item to test.
 *
 * @return
 * `true` if the node represents either function declaration or a function expression.
 */
function isFunctionDefinition(item: any): item is BaseFunction {
	const { type } = item;
	return type === 'FunctionDeclaration' || type === 'ArrowFunctionExpression' || type === 'FunctionExpression';
}

/**
 * @private
 * Determine whether the specified node is shadowing any of the specified variable names.
 *
 * @param item
 * The node to test
 *
 * @param importNames
 * A list of variable names.
 *
 * @return
 * `true` if the
 */
function isShadowing(item: any, importNames: string[]): boolean {
	if (isFunctionDefinition(item)) {
		const { params } = item;
		const paramNames = params.map((param: any) => param.name);
		return paramNames.some((name: string) => importNames.indexOf(name) > -1);
	}

	if (item.type === 'BlockStatement') {
		return item.body.filter((child: any) => child.type === 'VariableDeclaration')
			.some((child: any) => {
				return child.declarations.some((declaration: any) => {
					return importNames.indexOf(declaration.id.name) > -1 && (!declaration.init || !declaration.init.callee || declaration.init.callee.name !== 'require');
				});
			});
	}

	return false;
}

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
	 * Recursively walk the provided AST tree, extracting URL arrays passes to `@dojo/i18n/core/load`.
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
					const arg = item.arguments[0];
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

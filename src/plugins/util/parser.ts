import {
	ArrayExpression,
	AssignmentExpression,
	BaseFunction,
	Expression,
	Node,
	Property,
	Statement,
	SwitchCase,
	VariableDeclaration
} from 'estree';

/**
 * If the provided node is an array expression, then return an array containing its values.
 * @private
 *
 * @param item An AST node
 * @return An array of values if the node is an array expression; otherwise, `undefined`.
 */
export function extractArrayValues(item: any) {
	if (!isArrayExpression(item)) {
		return;
	}
	return item.elements.map((element: any) => element.value);
}

/**
 * Return a parent node's child node, if it exists.
 *
 * @param item The parent node.
 * @return The child node, if it exists.
 */
export const getNextItem: (item: Node) => Node | null = (function () {
	const getters = {
		argument: (item: { argument: Expression | null }) => item.argument,
		arguments: (item: { arguments: Expression[] }) => item.arguments,
		assignment: (item: AssignmentExpression) => item.right,
		body: (item: { body: any }) => item.body,
		call: (item: { callee: any, arguments: any[] }) => [ item.callee, ...(item.arguments || []) ],
		'case': (item: SwitchCase) => item.consequent,
		cases: (item: { cases: SwitchCase[] }) => item.cases,
		conditional: (item: { alternate: Expression; consequent: Expression; }) => [ item.alternate, item.consequent ],
		elements: (item: { elements: Expression[] }) => item.elements,
		expression: (item: { expression: Expression }) => item.expression,
		expressions: (item: { expressions: Expression[] }) => item.expressions,
		loop: (item: { test: Expression; body: Statement; }) => [ item.test, item.body ],
		object: (item: { object: Expression | null }) => item.object,
		properties: (item: { properties: Property[] }) => item.properties,
		value: (item: { value: Expression }) => item.value
	};

	const nextItemMap: { [key: string]: (item: any) => any; } = {
		ArrayExpression: getters.elements,
		AssignmentExpression: getters.assignment,
		CallExpression: getters.call,
		ConditionalExpression: getters.conditional,
		DoWhileStatement: getters.loop,
		ExpressionStatement: getters.expression,
		IfStatement: getters.conditional,
		MemberExpression: getters.object,
		NewExpression: getters.arguments,
		ObjectExpression: getters.properties,
		Property: getters.value,
		ReturnStatement: getters.argument,
		SequenceExpression: getters.expressions,
		SwitchCase: getters[ 'case' ],
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
		nextItemMap[ type ] = getters.body;
	});

	return function (item: Node): Node | null {
		if (!item) {
			return null;
		}

		const getter = nextItemMap[ item.type ];
		return typeof getter === 'function' ? getter(item) : null;
	};
})();

/**
 * Determine whether the provided node is an array expression.
 * @private
 *
 * @param item The node to test.
 * @return `true` if the item is an array expression; false otherwise.
 */
export function isArrayExpression(item: any): item is ArrayExpression {
	return item && item.type === 'ArrayExpression';
}

/**
 * Determine whether the provided node is a function declaration.
 * @private
 *
 * @param item The item to test.
 * @return `true` if the node represents either function declaration or a function expression.
 */
export function isFunctionDefinition(item: any): item is BaseFunction {
	if (!item) {
		return false;
	}

	const { type } = item;
	return type === 'FunctionDeclaration' || type === 'ArrowFunctionExpression' || type === 'FunctionExpression';
}

/**
 * Determine whether the specified node is shadowing any of the specified variable names.
 * @private
 *
 * @param item The node to test
 * @param importNames A list of variable names.
 * @return `true` if the node is a shadowing node
 */
export function isShadowing(item: Node, importNames: string[]): boolean {
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

process.env.DOJO_CLI = true;

export const capabilities = {
	'project': 'Dojo 2',
	'name': '@dojo/cli-build-webpack'
};

export const suites = '_build/tests/unit/all';

export const coverage = [
	'_build/src/**/*.js'
];

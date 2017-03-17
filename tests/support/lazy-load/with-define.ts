import load from '@dojo/core/load';

declare const require: any;

const registry = {
	define: function (one: string, two: any) {
	}
};

registry.define('some-module', function () {
	return load(require, './some-module').then(([ module ]) => module.default);
});

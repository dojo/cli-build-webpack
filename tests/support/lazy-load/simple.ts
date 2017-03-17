import load from '@dojo/core/load';

declare const require: any;

export default function doTheThing(fn: any) {
	fn();
};

doTheThing(function () {
	return load(require, './some-module').then(([ module ]) => module.default);
});

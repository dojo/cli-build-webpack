import { describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import loader from '../../../src/loaders/css-module-decorator-loader/loader';

describe('css-module-decorator-loader', () => {
	it('should not effect content without local exports', () => {
		const content = `exports = 'abc'
		exports.push(['a', 'b'])`;

		const result = loader.call({ resourcePath: 'blah' }, content);
		assert.equal(result, content);
	});

	it('should wrap local exports with decorator', () => {
		const content = `exports.locals = { "hello": "world" };`;

		const result = loader.bind({ resourcePath: 'testFile.m.css' })(content);
		assert.equal(result, 'exports.locals = {"hello":"world"," _key":"testFile"};');
	});

	it('should wrap multi line local exports with decorator', () => {
		const content = `exports.locals = {
			"hello": "world",
			"foo": "bar"
		};`;

		const result = loader.bind({ resourcePath: 'testFile.m.css' })(content);
		assert.equal(result, 'exports.locals = {"hello":"world","foo":"bar"," _key":"testFile"};');
	});
});

import { describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import * as sinon from 'sinon';
import Compiler = require('../../support/webpack/Compiler');
import IgnoreUnmodifiedPlugin from '../../../src/plugins/IgnoreUnmodifiedPlugin';

const FILE_PATH = '/path/to/myWidget.m.css';
const MTIME = 8675309;
const FS_ACCURACY = 10000;

function setup(useCustomWfs = false) {
	const compiler = new Compiler();
	const plugin = new IgnoreUnmodifiedPlugin();
	const onChange = sinon.spy();

	if (useCustomWfs) {
		compiler.watchFileSystem.wfs = {};
	}

	plugin.apply(compiler);
	compiler.mockApply('after-environment');

	const watcher = { _onChange: onChange };
	const wfs = useCustomWfs ? compiler.watchFileSystem.wfs : compiler.watchFileSystem;
	wfs.watcher = watcher;

	return { compiler, onChange, plugin, watcher };
}

describe('IgnoreUnmodifiedPlugin', () => {
	it('should not emit change events when the mtime has not changed', () => {
		const { compiler, onChange, watcher } = setup();

		assert.strictEqual(compiler.watchFileSystem.watcher, watcher);

		watcher._onChange(FILE_PATH, MTIME);
		assert.isTrue(onChange.calledWith(FILE_PATH, MTIME));

		watcher._onChange(FILE_PATH, MTIME - FS_ACCURACY);
		assert.strictEqual(onChange.callCount, 1);

		for (let i = 1; i <= 10; i++) {
			watcher._onChange(FILE_PATH, MTIME + (FS_ACCURACY * i));
			assert.strictEqual(onChange.callCount, i + 1);
		}
	});

	it('should function identically when a custom file watcher is used', () => {
		const { compiler, onChange, watcher } = setup(true);

		assert.strictEqual(compiler.watchFileSystem.wfs.watcher, watcher);

		watcher._onChange(FILE_PATH, MTIME);
		assert.isTrue(onChange.calledWith(FILE_PATH, MTIME));

		watcher._onChange(FILE_PATH, MTIME - FS_ACCURACY);
		assert.strictEqual(onChange.callCount, 1);

		for (let i = 1; i <= 10; i++) {
			watcher._onChange(FILE_PATH, MTIME + (FS_ACCURACY * i));
			assert.strictEqual(onChange.callCount, i + 1);
		}
	});
});

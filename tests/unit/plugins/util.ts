import { describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import { getBasePath, hasExtension } from '../../../src/plugins/util';

describe('plugins/util', () => {
	describe('getBasePath', () => {
		it('should strip the module name and return the parent path', () => {
			assert.strictEqual(getBasePath('/module'), '/');
			assert.strictEqual(getBasePath('/module.ts'), '/');
			assert.strictEqual(getBasePath('./parent/module'), './parent');
			assert.strictEqual(getBasePath('./parent/module.ts'), './parent');
			assert.strictEqual(getBasePath('/parent/module'), '/parent');
			assert.strictEqual(getBasePath('/parent/module.ts'), '/parent');
		});
	});

	describe('hasExtension', () => {
		it('should return false if there is no extension', () => {
			assert.isFalse(hasExtension('/module'));
			assert.isFalse(hasExtension('/module.'));
			assert.isFalse(hasExtension('/module.@@'));
		});

		it('should return true if there is an extension', () => {
			assert.isTrue(hasExtension('/module.ts'));
			assert.isTrue(hasExtension('/module.js'));
			assert.isTrue(hasExtension('/module.jsx'));
			assert.isTrue(hasExtension('/module.c'));
			assert.isTrue(hasExtension('/module.c2'));
			assert.isTrue(hasExtension('/module.C2cAx99'));
		});
	});
});

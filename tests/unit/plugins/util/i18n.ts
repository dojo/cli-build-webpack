import coreLoad from '@dojo/core/load';
import { Require } from '@dojo/interfaces/loader';
import { Program } from 'estree';
import { describe, it } from 'intern!bdd';
import * as assert from 'intern/chai!assert';
import * as path from 'path';
import getCldrUrls, { getLoadCallUrls, getLoadImports } from '../../../../src/plugins/util/i18n';

declare const require: Require;

function loadAst(complete = true) {
	const file = complete ? 'complete' : 'relative';
	const url = require.toUrl(`../../../support/mocks/ast/cldr-${file}.json`);
	return coreLoad(url).then(([ json ]: [ Program ]) => json);
}

describe('plugins/util/i18n', () => {
	describe('getLoadImports', () => {
		it('should return an array of variable names for `cldr/load` imports', () => {
			return loadAst().then((ast) => {
				assert.sameMembers(getLoadImports(ast), [ 'load' ]);
			});
		});
	});

	describe('getLoadCallUrls', () => {
		it('should return an object with urls and variable names passed to `cldr/load`', () => {
			return loadAst().then((ast) => {
				const importNames = [ 'load' ];
				assert.sameMembers(getLoadCallUrls(ast, importNames), [
					'cldr-data/main/{locale}/ca-gregorian.json',
					'cldr-data/main/{locale}/dateFields.json',
					'cldr-data/main/{locale}/numbers.json',
					'cldr-data/main/{locale}/units.json',
					'cldr-data/supplemental/currencyData.json',
					'cldr-data/supplemental/likelySubtags.json',
					'cldr-data/supplemental/numberingSystems.json',
					'cldr-data/supplemental/plurals.json'
				]);
			});
		});
	});

	describe('getCldrUrls', () => {
		it('should return an object with urls and variable names passed to `cldr/load`', () => {
			return loadAst().then((ast) => {
				assert.sameMembers(getCldrUrls('/context', ast), [
					'cldr-data/main/{locale}/ca-gregorian.json',
					'cldr-data/main/{locale}/dateFields.json',
					'cldr-data/main/{locale}/numbers.json',
					'cldr-data/main/{locale}/units.json',
					'cldr-data/supplemental/currencyData.json',
					'cldr-data/supplemental/likelySubtags.json',
					'cldr-data/supplemental/numberingSystems.json',
					'cldr-data/supplemental/plurals.json'
				]);
			});
		});

		it('should resolve relative urls', () => {
			return loadAst(false).then((ast) => {
				assert.sameMembers(getCldrUrls('/parent/context/mid.ts', ast), [
					path.resolve('/parent/path/to/cldr/data.json')
				]);
			});
		});
	});
});

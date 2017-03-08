import { deepAssign } from '@dojo/core/lang';
import { CldrData } from '@dojo/i18n/cldr/load';

/**
 * Thenable represents any object with a callable `then` property.
 */
export interface Thenable<T> {
	then<U>(onFulfilled?: (value?: T) => U | Thenable<U>, onRejected?: (error?: any) => U | Thenable<U>): Thenable<U>;
}

export function isEventuallyRejected<T>(promise: Thenable<T>): Thenable<boolean> {
	return promise.then<any>(function () {
		throw new Error('unexpected code path');
	}, function () {
		return true; // expect rejection
	});
}

export function throwImmediately() {
	throw new Error('unexpected code path');
}

/**
 * Load all supplemental CLDR data, and all CLDR data for the specified locale(s).
 */
export function fetchCldrData(locales: string | string[]): CldrData {
	const data = Object.create(null);
	// Since we are using string comparisons to test which data are injected into the build,
	// the URLs need to be in the order in which they were picked up by `I18nPlugin`.
	const urls = [
		'cldr-data/supplemental/numberingSystems.json',
		'cldr-data/supplemental/currencyData.json',
		'cldr-data/main/{locale}/ca-gregorian.json',
		'cldr-data/main/{locale}/dateFields.json',
		'cldr-data/supplemental/plurals.json',
		'cldr-data/main/{locale}/numbers.json',
		'cldr-data/main/{locale}/units.json',
		'cldr-data/supplemental/likelySubtags.json'
	];

	locales = Array.isArray(locales) ? locales : [ locales ];
	locales.forEach((locale: string) => {
		urls.forEach((url: string) => {
			deepAssign(data, require(url.replace('{locale}', locale)));
		});
	});

	deepAssign(data, require('cldr-data/supplemental/likelySubtags.json'));

	return data;
}

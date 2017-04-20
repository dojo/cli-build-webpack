The `cldr-complete.json` found in this directory is the AST object output by webpack (`parser.plugin('program')`) for the following JavaScript:

```javascript
const load = require('@dojo/i18n/cldr/load');
const fr = { main: { fr: {} } };
const urls = [
	'cldr-data/main/{locale}/numbers.json',
	'cldr-data/main/{locale}/ca-gregorian.json',
	'cldr-data/main/{locale}/units.json'
];

function secondLoad(load, urls) {
	console.log(load(urls));
}

function thirdLoad(other) {
	const load = (value) => value;
	load(other);
}

function fourthLoad() {
	const urls = [
		'/path/to/fourth.json',
		'/path/to/fifth.json'
	];
	const load = {
		default(urls) {
			return urls;
		}
	};
	load.default(urls);
}

function getLoad() {
	return (value) => value;
}

function fifthLoad(urls) {
	let load = getLoad();
	return load(urls);
}

function* gen(load) {
	yield load;
}

function conditionals() {
	switch (42) {
		case 42:
			console.log(42);
			break;
		default:
			load.default([ 'cldr-data/supplemental/numberingSystems.json' ]);
	}

	if (true) {
		load.default(require, [ 'cldr-data/supplemental/currencyData.json' ]);
	}

	return false ? null : load.default([ 'cldr-data/main/{locale}/ca-gregorian' ]);
}

function loops() {
	let i = 0;
	while (i < 1) {
		load.default([ 'cldr-data/main/{locale}/dateFields.json' ]);
		i++;
	}
}

function sequence() {
	let value;
	return (value = {},
		value.promise = load.default([ 'cldr-data/supplemental/plurals.json' ]),
		value);
}

Promise.resolve().then(() => {
	// Variables are traced back to their `ArrayExpression` value.
	load.default(urls);

	// URLs can also be passed directly.
	load.default([ 'cldr-data/supplemental/likelySubtags.json' ]);

	// Duplicates are filtered out.
	load.default([ 'cldr-data/supplemental/likelySubtags.json' ]);

	// Anything other than an `ArrayExpression` is ignored.
	load.default({
		main: { en: {} }
	});

	// `fr` is still traced back to its value, but because it is not an `ArrayExpression`, it is ignored.
	load.default(fr);

	// Conditional statements are also traversed:
	conditionals();

	// As are loops and sequence expressions:
	loops();
	sequence();

	// The following are instances of `load` being shadowed, and their entire blocks are ignored.
	secondLoad(() => null, urls);
	thirdLoad(urls);
	fourthLoad();
	fifthLoad(urls);
	gen(load).next();
});
```

`cldr-relative.json` is the AST object output for the following JavaScript:

```javascript
const load = require('@dojo/i18n/cldr/load');
load.default([ '../path/to/cldr/data.json' ]);
```

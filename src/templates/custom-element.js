var registerCustomElement = require('@dojo/widget-core/registerCustomElement').default;

var isFactory;
try {
	const descriptor = widgetFactory.default();
	if (descriptor && typeof descriptor.tagName === 'string') {
		isFactory = true;
	}
}
catch (e) {
}

if (isFactory) {
	registerCustomElement(widgetFactory.default);
}

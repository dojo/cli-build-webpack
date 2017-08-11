import webpack = require('webpack');
import { basename } from 'path';

const themeKey = ' _key';

export default function (this: webpack.LoaderContext, content: string, map?: any): string {
	let response = content;
	const localsRexExp = /exports.locals = {([.\s\S]*)};/;
	const matches = content.match(localsRexExp);

	if (matches && matches.length > 0) {
		const key = basename(this.resourcePath, '.m.css');
		const localExports = `{"${themeKey}": "${key}",${matches[1]}}`;
		response = content.replace(localsRexExp, `exports.locals = ${localExports};`);
	}

	return response;
};

import webpack = require('webpack');
import { createSourceFile, forEachChild, Node, ScriptTarget, SyntaxKind } from 'typescript';
import { statSync } from 'fs';
import { dirname, resolve } from 'path';
import Map from '@dojo/shim/Map';
import Promise from '@dojo/shim/Promise';
const DtsCreator = require('typed-css-modules');
const { getOptions } = require('loader-utils');
const instances = require('ts-loader/dist/instances');

type TSLoaderInstances = {
	files: {
		[key: string]: boolean;
	}
};

type DtsResult = {
	writeFile(): Promise<void>;
};

type DtsCreatorInstance = {
	create(filePath: string, initialContents: boolean, clearCache: boolean): Promise<DtsResult>;
};

type LoaderArgs = {
	type: string;
	instanceName?: string;
};

const creator: DtsCreatorInstance = new DtsCreator();

const mTimeMap = new Map<string, Date>();

function generateDTSFile(filePath: string): Promise<void> {
	return Promise.resolve().then(() => {
		const { mtime } = statSync(filePath);
		const lastMTime = mTimeMap.get(filePath);

		if (!lastMTime || mtime > lastMTime) {
			mTimeMap.set(filePath, mtime);
			return creator.create(filePath, false, true)
				.then((content) => content.writeFile());
		}
	});
}

function getCssImport(node: Node): string | void {
	if (node.kind === SyntaxKind.StringLiteral) {
		const importPath = node.getText().replace(/\'|\"/g, '');
		if (/.css$/.test(importPath)) {
			const parentFileName = node.getSourceFile().fileName;
			return resolve(dirname(parentFileName), importPath);
		}
	}
}

function traverseNode(node: Node, filePaths: string[] = []): string[] {
	switch (node.kind) {
		case SyntaxKind.SourceFile:
			forEachChild(node, (childNode: Node) => {
				traverseNode(childNode, filePaths);
			});
			break;
		case SyntaxKind.ImportDeclaration:
			forEachChild(node, (childNode: Node) => {
				const path = getCssImport(childNode);
				path && filePaths.push(path);
			});
			break;
	}
	return filePaths;
}

export default function (this: webpack.LoaderContext, content: string, sourceMap?: string) {
	const callback = this.async();
	const { type = 'ts', instanceName }: LoaderArgs = getOptions(this);

	Promise.resolve().then(() => {
		let generationPromises: Promise<void>[] = [];
		switch (type) {
			case 'css':
				generationPromises.push(generateDTSFile(this.resourcePath));
				break;
			case 'ts':
				const sourceFile = createSourceFile(this.resourcePath, content, ScriptTarget.Latest, true);
				const cssFilePaths = traverseNode(sourceFile);

				if (cssFilePaths.length) {

					if (instanceName) {
						const instanceWrapper = instances.getTypeScriptInstance({ instance: instanceName });

						if (instanceWrapper.instance) {
							instanceWrapper.instance.files[ this.resourcePath ] = false;
						}
					}

					generationPromises = cssFilePaths.map((cssFilePath) => generateDTSFile(cssFilePath));
				}
				break;
		}
		return Promise.all(generationPromises);
	})
	.then(() => callback(null, content, sourceMap));
}

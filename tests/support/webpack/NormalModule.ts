class MockNormalModule {
	static buildError = false;

	id: number;
	isBuilt: boolean;
	chunks: any[];
	dependencies: any[];
	dependenciesProcessed: boolean;
	meta: any;
	request: string;
	userRequest: string;
	rawRequest: string;
	loaders: string[];
	resource: string;
	parser: any;

	constructor(request: string, userRequest: string, rawRequest: string, loaders: string[], resource: string, parser: any) {
		this.isBuilt = false;
		this.chunks = [];
		this.dependencies = [];
		this.meta = {};
		this.request = request;
		this.userRequest = userRequest;
		this.rawRequest = rawRequest;
		this.loaders = loaders;
		this.resource = resource;
		this.parser = parser;
	}

	addChunk(chunk: any) {
		this.chunks.push(chunk);
	}
}

export = MockNormalModule;

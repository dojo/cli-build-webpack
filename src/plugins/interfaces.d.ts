export interface Callback {
	(error?: Error | null, value?: any): any;
}

export interface RequestData {
	request: string;
	userRequest: string;
	rawRequest: string;
	loaders: string[];
	resource: string[];
	parser: any;
}

export interface Resolver {
	(data: any, callback: Callback): void;
}

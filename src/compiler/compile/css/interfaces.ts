export type CssNode = {
	type: string;
	start: number;
	end: number;
	[prop_name: string]: any;
}
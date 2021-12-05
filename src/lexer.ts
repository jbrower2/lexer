import { BaseToken, LiteralTokenType, TokenType } from "./token-type";

export type LexerFields = {
	[key: string]: any;
};

export type LexerTokensInput<L extends LexerFields> = {
	[K in keyof L]: L[K] extends undefined
		? string | TokenType<L[K]>
		: TokenType<L[K]>;
};

export type LexerTokens<L extends LexerFields> = {
	[K in keyof L]: TokenType<L[K]>;
};

export type Token<L extends LexerFields, K extends keyof L = keyof L> = {
	key: K;
	data: L[K];
	start: Position;
	end: Position;
};

function newToken<L extends LexerFields, K extends keyof L>(
	key: K,
	data: L[K],
	start: Position,
	end: Position
): Token<L, K> {
	return { key, data, start, end };
}

export type Position = {
	index: number;
	line: number;
	col: number;
};

export class Lexer<L extends LexerFields> {
	private readonly tokenTypes: LexerTokens<L>;

	constructor(tokenTypes: LexerTokensInput<L>) {
		this.tokenTypes = Object.entries(tokenTypes).reduce(
			(o, [k, v]) => ({
				...o,
				[k]: typeof v === "string" ? new LiteralTokenType(v) : v,
			}),
			{} as LexerTokens<L>
		);
	}

	lex = (input: string): readonly Token<L>[] => {
		const lineBreaks = new Array<{ index: number; end: number }>();
		for (let re = /\r\n|[\r\n]/g, m = re.exec(input); m; m = re.exec(input)) {
			lineBreaks.push({ index: m.index, end: m.index + m[0].length });
		}
		let index = 0;
		const tokens = new Array<Token<L>>();
		let line = 1;
		let col = 1;
		while (index < input.length) {
			const start: Position = { index, line, col };
			let best: (BaseToken<any> & { key: keyof L; skip: boolean }) | undefined;
			for (const [key, type] of Object.entries(this.tokenTypes)) {
				if (!(type instanceof TokenType)) {
					continue;
				}
				const res = type.match(input, index);
				if (res && (!best || res.end > best.end)) {
					best = { ...res, key, skip: type.skip };
				}
			}
			if (!best) {
				throw new Error(
					`Unexpected input at character ${index} (line ${line}, column ${col})`
				);
			}
			index = best.end;
			const lbs = lineBreaks.filter(
				(lb) => start.index <= lb.index && lb.index < index
			);
			if (lbs.length) {
				line += lbs.length;
				col = 1 + index - lbs[lbs.length - 1].end;
			} else {
				col += index - start.index;
			}
			if (!best.skip) {
				tokens.push(newToken(best.key, best.data, start, { index, line, col }));
			}
		}
		return tokens;
	};

	isField = (key: keyof any): key is string & keyof L =>
		typeof key === "string" && this.tokenTypes.hasOwnProperty(key);
}

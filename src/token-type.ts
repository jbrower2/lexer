export class BaseToken<T> {
	constructor(public readonly data: T, public readonly end: number) {}

	map = <U>(f: (data: T) => U): BaseToken<U> => {
		return new BaseToken(f(this.data), this.end);
	};
}

export abstract class TokenType<T> {
	protected constructor(public readonly skip: boolean) {}

	abstract match(input: string, start: number): BaseToken<T> | undefined;

	map = <U>(f: (data: T) => U): TokenType<U> => new MappedTokenType(this, f);

	asSkip = (): TokenType<never> =>
		new MappedTokenType<T, never>(this, () => undefined as never, true);
}

export class LiteralTokenType extends TokenType<undefined> {
	constructor(private readonly literal: string) {
		super(false);

		if (!literal) {
			throw new Error("Cannot use an empty string as a token");
		}
	}

	match = (input: string, start: number): BaseToken<undefined> | undefined => {
		const end = start + this.literal.length;
		if (end > input.length) {
			return undefined;
		}
		for (let i = 0, j = start; j < end; i++, j++) {
			if (this.literal.charAt(i) !== input.charAt(j)) {
				return undefined;
			}
		}
		return new BaseToken(undefined, end);
	};
}

export class CharsTokenType extends TokenType<string> {
	constructor(private readonly chars: readonly string[]) {
		super(false);

		if (!chars.length || chars.some((c) => !c)) {
			throw new Error("Cannot specify empty characters");
		}
	}

	match = (input: string, start: number): BaseToken<string> | undefined => {
		let end = start;
		for (; end < input.length; end++) {
			const c = input.charAt(end);
			if (!this.chars.some((ch) => c === ch)) {
				break;
			}
		}
		return end > start
			? new BaseToken(input.substring(start, end), end)
			: undefined;
	};
}

export class RegExpTokenType extends TokenType<RegExpExecArray> {
	private readonly regExp: RegExp;

	constructor(regExp: RegExp) {
		super(false);

		const { source, flags } = regExp;
		this.regExp = new RegExp(source, flags.replace(/[gy]/g, "") + "y");
	}

	match = (
		input: string,
		start: number
	): BaseToken<RegExpExecArray> | undefined => {
		this.regExp.lastIndex = start;
		const match = this.regExp.exec(input);
		if (!match) {
			return undefined;
		}
		const { length } = match[0];
		return length ? new BaseToken(match, start + length) : undefined;
	};

	mapToString = () => this.map((m) => m[0]);
}

export class MappedTokenType<I, O> extends TokenType<O> {
	constructor(
		private readonly wrapped: TokenType<I>,
		private readonly f: (data: I) => O,
		skip: boolean = wrapped.skip
	) {
		super(skip);
	}

	match = (input: string, start: number): BaseToken<O> | undefined => {
		return this.wrapped.match(input, start)?.map(this.f);
	};
}


export type Operator = ':' | '=' | '!=' | '<' | '<=' | '>' | '>='

export type Criterion = {
	column?: string
	end: number
	field: string
	fieldEnd: number
	fieldStart: number
	operator: Operator
	separatorEnd: number
	start: number
	value: string
	valueEnd: number
	valueStart: number
}

type CriterionHead = Pick<Criterion, 'field' | 'fieldEnd' | 'fieldStart' | 'operator' | 'separatorEnd' | 'start'>
type Quote = '"' | "'"

export type SearchNode = Criterion | {
	end: number
	operands: SearchNode[]
	operator: 'AND' | 'OR'
	start: number
}

export type SearchSyntax = {
	criteria: Criterion[]
	error?: number
	expression?: SearchNode
	incomplete?: true
	partial?: SearchNode
}

const andOperator    = /^[&+]/
const columnOperator = /^[&+|,]/
const comparison     = /^(?:!=|<>|[<>]=?|[=≠])/
const fieldPart      = /^[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/u
const legacyWord     = /^[^"\s]+/
const negative       = /^(?:!=|<>|[!-])/
const orOperator     = /^[|,]/
const separator      = /^(?:!=|<>|[<>]=?|[:=≠])/
const spaces         = /^\s+/
const word           = /^[^"\s&+|,()]+/

function combine(operator: 'AND' | 'OR', operands: SearchNode[]): SearchNode
{
	if (operands.length === 1) return operands[0]
	return { end: operands[operands.length - 1].end, operands, operator, start: operands[0].start }
}

export function formatSearchField(field: string, original = ''): string
{
	const opening = original[0]
	if ((opening !== '"') && (opening !== "'") && field.split('.').every(part => fieldPart.exec(part)?.[0] === part)) {
		return field
	}
	const quote   = (opening === "'") ? "'" : '"'
	const escaped = field.replaceAll('\\', '\\\\').replaceAll(quote, '\\' + quote)
	return quote + escaped + quote
}

function operatorOf(symbol: string): Operator
{
	if (['!', '!=', '<>', '≠'].includes(symbol)) return '!='
	return symbol as Operator
}

export function parseSearch(text: string, legacy = false): SearchSyntax
{
	return new Parser(text, legacy).parse()
}

class Parser
{

	private criteria: Criterion[] = []
	private failed = false
	private position = 0

	constructor(private readonly text: string, private readonly legacy: boolean) {}

	private and(): SearchNode | undefined
	{
		const operands: SearchNode[] = []
		do {
			const operand = this.primary()
			if (!operand) break
			operands.push(operand)
		} while (!this.failed && this.takeAnd())
		return operands.length ? combine('AND', operands) : undefined
	}

	private columnGroup(): boolean
	{
		do {
			this.match(spaces)
			if (this.take('(')) {
				if (!this.columnGroup() || !this.take(')')) return false
			}
			else if (!this.columnOperand()) return false
			this.match(spaces)
		} while (this.match(columnOperator))
		return this.text[this.position] === ')'
	}

	private columnOperand(): boolean
	{
		const start = this.position
		let quoted = false
		while (this.position < this.text.length) {
			const character = this.text[this.position]
			if (!quoted && ',|&+()'.includes(character)) break
			this.position ++
			if (character === '"') {
				quoted = !quoted
			}
			else if (
				(character === '\\')
				&& (this.position < this.text.length)
				&& ',|&+()"\\'.includes(this.text[this.position])
			) {
				this.position ++
			}
		}
		return !quoted && (start < this.position)
	}

	private field(): string
	{
		const parts: string[] = []
		do {
			const quote = this.openQuote()
			const part  = quote ? this.quotedText(quote) : this.match(fieldPart)
			if (!part || (quote && !this.take(quote))) return ''
			parts.push(part)
		} while (this.take('.'))
		return parts.join('.')
	}

	private match(pattern: RegExp): string
	{
		const match = pattern.exec(this.text.slice(this.position))?.[0] ?? ''
		this.position += match.length
		return match
	}

	private openQuote(): Quote | undefined
	{
		const quote = this.text[this.position]
		if ((quote !== '"') && (quote !== "'")) return
		this.position ++
		return quote
	}

	private or(): SearchNode | undefined
	{
		const operands: SearchNode[] = []
		do {
			this.match(spaces)
			const operand = this.and()
			if (!operand) break
			operands.push(operand)
		} while (!this.failed && !this.legacy && this.match(orOperator))
		return operands.length ? combine('OR', operands) : undefined
	}

	parse(): SearchSyntax
	{
		this.match(spaces)
		if (this.position === this.text.length) {
			return { criteria: this.criteria }
		}
		const expression = this.or()
		const partial    = expression && { partial: expression }
		if (this.position !== this.text.length) {
			return { criteria: this.criteria, error: this.position, ...partial }
		}
		if (this.failed) {
			return { criteria: this.criteria, incomplete: true, ...partial }
		}
		return { criteria: this.criteria, expression }
	}

	private primary(): SearchNode | undefined
	{
		if (this.legacy || this.text[this.position] !== '(') {
			const criterion = this.readCriterion()
			this.failed = !criterion
			return criterion
		}
		const start = this.position ++
		const inner = this.or()
		if (!inner || this.failed) return inner
		if (!this.take(')')) {
			this.failed = true
			return inner
		}

		return ('operands' in inner)
			? { ...inner, end: this.position, start }
			: { end: this.position, operands: [inner], operator: 'AND', start }
	}

	private quotedText(quote: Quote): string
	{
		let value = ''
		while ((this.position < this.text.length) && (this.text[this.position] !== quote)) {
			const character = this.text[this.position ++]
			if ((character === '\\') && [quote, '\\'].includes(this.text[this.position])) {
				value += this.text[this.position ++]
			}
			else {
				value += character
			}
		}
		return value
	}

	private readCriterion(): Criterion | undefined
	{
		const start      = this.position
		const negated    = this.match(negative) !== ''
		const fieldStart = this.position
		const field      = this.field()
		const fieldEnd   = this.position
		if (!field) return

		if (!this.legacy) {
			this.match(spaces)
		}
		const separatorStart = this.position
		const symbol         = this.match(separator)
		const separatorEnd   = this.position
		if (!symbol) {
			// A lone ! may be the start of !=.
			this.take('!')
			return
		}
		if (negated && ![':', '='].includes(symbol)) {
			this.position = separatorStart
			return
		}
		if (!this.legacy) {
			this.match(spaces)
		}

		const operator = negated ? '!=' as const : operatorOf(symbol)
		const criterion = { field, fieldEnd, fieldStart, operator, separatorEnd, start }
		return (!this.legacy && (operator === ':') && this.take('('))
			? this.readColumn(criterion)
			: this.readValue(criterion)
	}

	private readColumn(criterion: CriterionHead): Criterion | undefined
	{
		const valueStart = this.position
		const complete   = this.columnGroup()
		const valueEnd   = this.position
		const column     = this.text.slice(valueStart, valueEnd)
		if (complete) {
			this.position ++
		}
		const result = { ...criterion, column, end: this.position, value: column, valueEnd, valueStart }
		this.criteria.push(result)
		return complete ? result : undefined
	}

	private readValue(criterion: CriterionHead): Criterion | undefined
	{
		let { operator } = criterion
		if (operator === ':') {
			operator = this.valueOperator()
			if (!this.legacy && operator !== ':') {
				this.match(spaces)
			}
		}
		const quote = this.openQuote()
		if (quote && (operator === ':')) {
			operator = this.valueOperator()
		}

		const valueStart = this.position
		const value      = quote ? this.quotedText(quote) : this.match(this.legacy ? legacyWord : word)
		const valueEnd   = this.position
		const complete   = quote ? this.take(quote) : (valueStart !== valueEnd)
		const result = { ...criterion, end: this.position, operator, value, valueEnd, valueStart }
		this.criteria.push(result)
		return complete ? result : undefined
	}

	private take(character: string): boolean
	{
		if (this.text[this.position] !== character) return false
		this.position ++
		return true
	}

	private takeAnd(): boolean
	{
		const whitespace = this.match(spaces)
		if (!this.legacy && this.match(andOperator)) {
			this.match(spaces)
			return true
		}
		if (!whitespace || (this.position === this.text.length)) return false
		return this.legacy || !'|,)'.includes(this.text[this.position])
	}

	private valueOperator(): Operator
	{
		const symbol = this.match(comparison)
		if (symbol) return operatorOf(symbol)
		return this.take('!') ? '!=' : ':'
	}

}


export type Operator = ':' | '=' | '!' | '!=' | '<' | '<=' | '>' | '>='

export type Criterion = {
	column?: string
	columnSyntax?: true
	end: number
	field: string
	fieldEnd: number
	fieldStart: number
	implicitEmpty?: true
	operator: Operator
	separatorEnd: number
	start: number
	value: string
	valueEnd: number
	valueStart: number
}

type CriterionHead = Omit<Criterion, 'column' | 'end' | 'value' | 'valueEnd' | 'valueStart'>
type LogicalOperator = 'AND' | 'OR'
type LogicalWords = Record<LogicalOperator, string>
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
const negative       = /^[!-]/
const orOperator     = /^[|,]/
const separator      = /^(?:!=|<>|[<>]=?|[:=≠])/
const spaces         = /^\s+/
const wordOperator   = /^\p{L}[\p{L}\p{M}]*(?=[\s(]|$)(?!\s+(?:[:<>=≠]|!=))/u
const word           = /^[^"\s&+|,()]+/

const englishWords: LogicalWords = { AND: 'and', OR: 'or' }
const wordsByLocale = new Map<string, LogicalWords>()

const oppositeOperator: Record<Operator, Operator> = {
	':': '!', '=': '!=', '!': ':', '!=': '=', '<': '>=', '<=': '>', '>': '<=', '>=': '<'
}

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

export function formatLogicalSeparator(separator: string, left: string, right: string, translated?: string): string
{
	const match = /^(\s*)(\p{L}[\p{L}\p{M}]*)(\s*)$/u.exec(separator)
	if (!match) return separator

	const [, before, original, after] = match
	const word = translated && (original === original.toUpperCase() ? translated.toUpperCase() : translated)
	return (before || (left.endsWith(')') ? '' : ' ')) + (word ?? original)
		+ (after || (right.startsWith('(') ? '' : ' '))
}

function operatorOf(symbol: string): Operator
{
	if (symbol === '<>' || symbol === '≠') return '!='
	return symbol as Operator
}

export function logicalWords(locale: string): LogicalWords
{
	const cached = wordsByLocale.get(locale)
	if (cached) return cached

	const word = (type: 'conjunction' | 'disjunction', fallback: string) => {
		const parts = new Intl.ListFormat(locale, { type }).formatToParts(['A', 'B'])
		const label = parts.find(part => part.type === 'literal')?.value.trim().toLowerCase() ?? ''
		return /^\p{L}[\p{L}\p{M}]*$/u.test(label) ? label : fallback
	}
	const words = { AND: word('conjunction', 'and'), OR: word('disjunction', 'or') }
	wordsByLocale.set(locale, words)
	return words
}

export function parseSearch(text: string, locale = 'en'): SearchSyntax
{
	return new Parser(text, locale === 'en' ? englishWords : logicalWords(locale)).parse()
}

class Parser
{

	private criteria: Criterion[] = []
	private failed = false
	private position = 0

	constructor(
		private readonly text: string,
		private readonly words: LogicalWords
	) {}

	private atCriterionBoundary(): boolean
	{
		return this.position === this.text.length || /[|,&+)]/.test(this.text[this.position])
	}

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

	private compactAlternative(): boolean
	{
		const end = this.position
		if (!'|,'.includes(this.text[end] ?? ' ')) return false

		this.position ++
		const start = this.position
		const explicitCriterion = this.criterionStartsHere()
		this.position = start

		const value = explicitCriterion ? '' : this.match(word)
		if (value && !value.startsWith("'") && !value.includes('\\') && this.text[this.position] !== '"') return true

		this.position = end
		return false
	}

	private criterionStartsHere(): boolean
	{
		this.match(negative)
		if (!this.field()) return false
		this.match(spaces)
		return !!this.match(separator) || this.take('!')
	}

	private emptyBeforeLogicalWord(): boolean
	{
		const start = this.position
		if (!this.takeLogicalWord('AND') && !this.takeLogicalWord('OR')) return false

		while (this.take('(')) {
			this.match(spaces)
		}
		const hasCriterion = this.criterionStartsHere()
		this.position      = start
		return hasCriterion
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
		} while (!this.failed && (this.match(orOperator) || this.takeLogicalWord('OR')))
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
		if (this.text[this.position] !== '(') {
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
		const negated    = !!this.match(negative)
		const fieldStart = this.position
		const field      = this.field()
		const fieldEnd   = this.position
		if (!field) return

		this.match(spaces)
		const separatorStart = this.position
		const symbol         = this.match(separator) || this.match(/^!/)
		const separatorEnd   = this.position
		if (!symbol) return
		this.match(spaces)

		let operator = operatorOf(symbol)
		if (negated) {
			if (symbol === ':' || symbol === '=' || this.atCriterionBoundary() || this.emptyBeforeLogicalWord()) {
				operator = oppositeOperator[operator]
			}
			else {
				this.position = separatorStart
				return
			}
		}
		const columnSyntax = symbol === ':' || symbol === '!'
			? { columnSyntax: true as const }
			: {}
		const criterion    = { ...columnSyntax, field, fieldEnd, fieldStart, operator, separatorEnd, start }
		return (operator === ':' && this.take('('))
			? this.readColumn(criterion)
			: this.readValue(criterion, operator === ':' && !negated ? '=' : operator)
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

	private readValue(criterion: CriterionHead, bareOperator: Operator): Criterion | undefined
	{
		let { operator } = criterion
		let emptyEnd     = criterion.separatorEnd
		if (operator === ':') {
			operator = this.valueOperator()
			if (operator !== ':') {
				emptyEnd = this.position
				this.match(spaces)
			}
		}
		const beforeLogicalWord = this.emptyBeforeLogicalWord()
		if (beforeLogicalWord) {
			// Leave the spaces for the connector so they survive saving and field reordering.
			this.position = emptyEnd
		}
		const quote = this.openQuote()
		if (quote && (operator === ':')) {
			operator = this.valueOperator()
		}

		const valueStart = this.position
		const value      = quote ? this.quotedText(quote) : this.match(word)
		const valueEnd   = this.position
		const implicitEmpty = !quote && !value && (beforeLogicalWord || this.atCriterionBoundary())
		const complete   = quote
			? this.take(quote)
			: (valueStart !== valueEnd || implicitEmpty
				|| (criterion.columnSyntax && criterion.operator !== operator))
		if (!quote && operator === ':' && value && !value.includes('\\')) {
			while (this.compactAlternative()) { /* Read adjacent alternatives for this field. */ }
		}
		const column = this.position > valueEnd && !quote ? this.text.slice(valueStart, this.position) : undefined
		const result: Criterion = {
			...criterion,
			...(column === undefined ? {} : { column }),
			end: this.position,
			...(implicitEmpty ? { implicitEmpty: true, operator: operator === ':' ? bareOperator : operator } : { operator }),
			value: column ?? value,
			valueEnd: column === undefined ? valueEnd : this.position,
			valueStart
		}
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
		if (this.match(andOperator)) {
			this.match(spaces)
			return true
		}
		if (this.takeLogicalWord('AND')) return true
		if (this.logicalWord('OR')) return false
		return !!whitespace && (this.position < this.text.length) && !'|,)'.includes(this.text[this.position])
	}

	private logicalWord(operator: LogicalOperator): string
	{
		if (this.position === 0 || !/[\s)]/.test(this.text[this.position - 1])) return ''
		const word  = wordOperator.exec(this.text.slice(this.position))?.[0] ?? ''
		const lower = word.toLowerCase()
		return lower === englishWords[operator] || lower === this.words[operator] ? word : ''
	}

	private takeLogicalWord(operator: LogicalOperator): boolean
	{
		const word = this.logicalWord(operator)
		if (!word) return false

		this.position += word.length
		this.match(spaces)
		return true
	}

	private valueOperator(): Operator
	{
		const symbol = this.match(comparison)
		if (symbol) return operatorOf(symbol)
		return this.take('!') ? '!' : ':'
	}

}

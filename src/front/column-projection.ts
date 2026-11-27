import { columnComparison }       from '@itrocks/list/search-expression.js'
import { searchExpression }       from '@itrocks/list/search-expression.js'
import type { SearchExpression } from '@itrocks/list/search-expression.js'
import type { Criterion }         from './syntax.js'
import { formatSearchField }      from './syntax.js'
import { parseSearch }            from './syntax.js'
import type { SearchNode }        from './syntax.js'

type Clause = { operator?: 'AND' | 'OR' | 'column', quoted?: string, text: string }
type PathOf = (field: string) => string

function clause(node: SearchNode): Clause | undefined
{
	if ('operands' in node) {
		const operands: Clause[] = []
		for (const operand of node.operands) {
			const projected = clause(operand)
			if (!projected) return
			operands.push(projected)
		}
		return combine(operands, node.operator)
	}
	if (node.column !== undefined) {
		return /[,|&+()]/.test(node.column)
			? { operator: 'column', text: node.column }
			: { text: node.column }
	}
	const text = columnValue(node)
	if (text === undefined) return
	// A standalone column value keeps its spaces. A combined expression needs quotes around edge spaces.
	return text.trim() === text ? { text } : { quoted: quoteValue(text), text }
}

function collect(node: SearchNode, pathOf: PathOf, clauses: Map<string, Clause[] | undefined>): void
{
	const path = singleField(node, pathOf)
	if (path) {
		// A field is displayed only when all its independent predicates can be represented.
		if (clauses.has(path) && !clauses.get(path)) return
		const operand = clause(node)
		if (!operand) {
			clauses.set(path, undefined)
			return
		}
		if (operand.text) {
			const previous = clauses.get(path) ?? []
			previous.push(operand)
			clauses.set(path, previous)
		}
	}
	else if ('operands' in node && node.operator === 'AND') {
		for (const operand of node.operands) {
			collect(operand, pathOf, clauses)
		}
	}
}

export function columnProjection(expression: SearchNode | undefined, pathOf: PathOf): Map<string, string>
{
	const clauses = new Map<string, Clause[] | undefined>()
	if (expression) {
		collect(expression, pathOf, clauses)
	}
	return new Map([...clauses].flatMap(([path, operands]) => operands ? [[path, combine(operands, 'AND').text]] : []))
}

function columnValue({ columnSyntax, operator, value }: Criterion): string | undefined
{
	if (!columnSyntax && value.trim() !== value) return
	if (!value) return operator === ':' ? '""' : operator

	let prefix = operator === ':' ? '' : operator
	// The column parser recognises the longest comparison before trimming its operand.
	if (
		(['<', '>', '!'].includes(prefix) && value.startsWith('='))
		|| (prefix === '<' && value.startsWith('>'))
	) {
		prefix += ' '
	}
	const escaped = /[,|&+()"\\]/.test(value) ? quoteValue(value) : value
	return prefix + escaped
}

function combine(operands: Clause[], operator: 'AND' | 'OR'): Clause
{
	if (operands.length === 1) return operands[0]
	const separator = (operator === 'AND') ? ' & ' : ' | '
	const text = operands.map(operand =>
		(operand.operator === 'column' || (operator === 'AND' && operand.operator === 'OR'))
			? `(${operand.text})`
			: (operand.quoted ?? operand.text)
	).join(separator)
	return { operator, text }
}

export function formatColumnCriterion(field: string, value: string, original = ''): string
{
	const name = formatSearchField(field, original)
	try {
		return formatColumnExpression(name, searchExpression(value))
	}
	catch (error) {
		if (!(error instanceof SyntaxError)) throw error
		// Keep unfinished column input visible as an unfinished general criterion.
		return name + ':' + quoteValue(value).slice(0, -1)
	}
}

function formatColumnExpression(field: string, expression: SearchExpression, parent?: 'AND' | 'OR'): string
{
	if (!('value' in expression)) {
		const { operands, operator } = expression
		const separator = operator === 'AND' ? ' & ' : ' | '
		const text      = operands.map(operand => formatColumnExpression(field, operand, operator)).join(separator)
		return (operator === 'OR' && parent === 'AND') ? '(' + text + ')' : text
	}
	const comparison = columnComparison.exec(expression.value)
	const operator   = comparison?.[1]
	const value      = comparison ? comparison[2].trim() : expression.value
	const prefix     = operator === '!' ? '!' + field + ':' : field + (operator ?? ':')
	if (operator && operator !== '!' && !value) return field + ':' + operator

	const joined = (operator === '<' || operator === '>') && value.startsWith('=')
		|| (operator === '<' && value.startsWith('>'))
	if (!value || joined || /[\s&+|,()"\\]|^'/.test(value)) return prefix + quoteValue(value)
	return prefix + value
}

export function groupSearchAlternative(text: string, locale = 'en'): string
{
	const root = parseSearch(text, locale).expression
	return root && 'operands' in root && root.operator === 'OR' && root.start === root.operands[0].start
		? '(' + text + ')'
		: text
}

function quoteValue(value: string): string
{
	return '"' + value.replace(/[\\"]/g, '\\$&') + '"'
}

export function singleField(node: SearchNode, pathOf: PathOf): string | undefined
{
	if (!('operands' in node)) return pathOf(node.field)
	const [first, ...rest] = node.operands
	const path = first && singleField(first, pathOf)
	if (path && rest.every(operand => singleField(operand, pathOf) === path)) return path
}

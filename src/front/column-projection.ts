import type { Criterion }    from './syntax.js'
import { formatSearchField } from './syntax.js'
import { parseSearch }       from './syntax.js'
import type { SearchNode }   from './syntax.js'

type Clause = { operator?: 'AND' | 'OR' | 'column', quoted?: string, text: string }
type PathOf = (field: string) => string

function clause(node: SearchNode, emptyAliases: readonly string[]): Clause | undefined
{
	if ('operands' in node) {
		const operands: Clause[] = []
		for (const operand of node.operands) {
			const projected = clause(operand, emptyAliases)
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
	const text = columnValue(node, emptyAliases)
	if (text === undefined) return
	// A standalone column value keeps its spaces. A combined expression needs quotes around edge spaces.
	return text.trim() === text ? { text } : { quoted: quoteValue(text), text }
}

function collect(
	node: SearchNode, pathOf: PathOf, emptyAliases: readonly string[], clauses: Map<string, Clause[] | undefined>
): void
{
	const path = singleField(node, pathOf)
	if (path) {
		// A field is displayed only when all its independent predicates can be represented.
		if (clauses.has(path) && !clauses.get(path)) return
		const operand = clause(node, emptyAliases)
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
			collect(operand, pathOf, emptyAliases, clauses)
		}
	}
}

export function columnProjection(
	expression: SearchNode | undefined, pathOf: PathOf, emptyAlias = 'empty'
): Map<string, string>
{
	const clauses = new Map<string, Clause[] | undefined>()
	if (expression) {
		collect(expression, pathOf, ['empty', emptyAlias.toLocaleLowerCase()], clauses)
	}
	return new Map([...clauses].flatMap(([path, operands]) => operands ? [[path, combine(operands, 'AND').text]] : []))
}

function columnValue({ end, operator, value, valueEnd }: Criterion, emptyAliases: readonly string[]): string | undefined
{
	const trimmed = value.trim()
	const alias   = operator === ':' ? trimmed.replace(/^(?:!=|<>|!)\s*/, '') : trimmed
	const empty   = emptyAliases.includes(alias.toLocaleLowerCase())
	if (operator === ':' && (empty || /[-*?%_\\]/.test(value))) return
	if (operator === '!=' && (empty || /[*?]/.test(value))) return
	if (operator !== ':' && trimmed !== value) return

	let prefix = operator === ':' ? '' : operator === '!=' ? '!' : operator
	// The legacy parser recognises the longest comparison before trimming its operand.
	if (
		(['<', '>', '!'].includes(prefix) && value.startsWith('='))
		|| (prefix === '<' && value.startsWith('>'))
	) {
		prefix += ' '
	}
	const quotedEmpty = !value && end > valueEnd
	const escaped     = quotedEmpty || /[,|&+()"\\]/.test(value) ? quoteValue(value) : value
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

export function formatColumnCriterion(field: string, value: string, emptyAlias = 'empty', original = ''): string
{
	const prefix       = formatSearchField(field, original) + ':'
	const emptyAliases = ['empty', emptyAlias.toLocaleLowerCase()]
	const quoted       = quoteValue(value)
	const operands     = /\s/.test(value) ? [quoted, value] : [value, quoted]
	// Use the short form only when the general editor projects it back to the same column value.
	for (const operand of operands) {
		const text = prefix + operand
		const node = parseSearch(text).expression
		if (node && 'field' in node && node.column === undefined && columnValue(node, emptyAliases) === value) {
			return text
		}
	}
	return `${prefix}(${value})`
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

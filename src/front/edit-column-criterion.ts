import { formatColumnCriterion } from './column-projection.js'
import { singleField }           from './column-projection.js'
import { parseSearch }           from './syntax.js'
import type { SearchNode }       from './syntax.js'

type Fragment = { operator?: 'AND' | 'OR', parenthesised: boolean, text: string }
type PathOf = (field: string) => string

export function editColumnCriterion(
	text: string, path: string, name: string, value: string, pathOf: PathOf, emptyAlias?: string
): string
{
	const search      = parseSearch(text)
	const expression  = search.expression ?? search.partial
	const field       = search.criteria.find(criterion => pathOf(criterion.field) === path)
	const original    = field ? text.slice(field.fieldStart, field.fieldEnd) : ''
	const replacement = value ? formatColumnCriterion(name, value, emptyAlias, original) : ''
	const matches     = expression ? matchingSubtrees(expression, path, pathOf) : []
	const trailing    = search.criteria.find(criterion =>
		criterion.start >= (expression?.end ?? 0) && pathOf(criterion.field) === path
	)
	if (trailing) {
		if (!matches.length && replacement) return replaceSpan(text, trailing, replacement)
		text = text.slice(0, expression?.end ?? trailing.start) + text.slice(trailing.end)
		if (!matches.length) return text
	}
	if (!expression) {
		return (replacement && text.trim()) ? `${replacement} ${text}` : (replacement + text)
	}

	if (matches.length === 1 && replacement) {
		return replaceSpan(text, matches[0], replacement)
	}
	if (!matches.length && !replacement) return text

	const remaining = withoutField(text, expression, path, pathOf)
	const before    = remaining && (replacement ? forOperator(remaining, 'AND') : remaining.text)
	const next      = [before, replacement].filter(Boolean).join(' ')
	return replaceSpan(text, expression, next)
}

function forOperator(fragment: Fragment, operator: 'AND' | 'OR'): string
{
	return (operator === 'AND' && fragment.operator === 'OR' && !fragment.parenthesised)
		? `(${fragment.text})`
		: fragment.text
}

function matchingSubtrees(node: SearchNode, path: string, pathOf: PathOf): SearchNode[]
{
	if (singleField(node, pathOf) === path) return [node]
	return ('operands' in node) ? node.operands.flatMap(operand => matchingSubtrees(operand, path, pathOf)) : []
}

function replaceSpan(text: string, { start, end }: SearchNode, next: string): string
{
	return text.slice(0, start) + next + text.slice(end)
}

function sourceFragment(text: string, node: SearchNode): Fragment
{
	const source = text.slice(node.start, node.end)
	if (!('operands' in node)) return { parenthesised: false, text: source }
	return {
		operator: node.operator,
		parenthesised: node.start < node.operands[0].start,
		text: source
	}
}

function withoutField(text: string, node: SearchNode, path: string, pathOf: PathOf): Fragment | undefined
{
	if (!('operands' in node)) {
		return (pathOf(node.field) === path) ? undefined : sourceFragment(text, node)
	}

	const remaining = node.operands.flatMap((operand, index) => {
		const fragment = withoutField(text, operand, path, pathOf)
		return fragment ? [{ fragment, index }] : []
	})
	const original = sourceFragment(text, node)
	if (remaining.length === node.operands.length && remaining.every(({ fragment, index }) =>
		fragment.text === text.slice(node.operands[index].start, node.operands[index].end)
	)) return original

	if (!remaining.length) return
	if (remaining.length === 1) return remaining[0].fragment

	let source = ''
	for (const { fragment, index } of remaining) {
		if (source) {
			const previous = node.operands[index - 1]
			source += text.slice(previous.end, node.operands[index].start)
		}
		source += forOperator(fragment, node.operator)
	}
	return {
		operator: node.operator,
		parenthesised: original.parenthesised,
		text: original.parenthesised ? `(${source})` : source
	}
}

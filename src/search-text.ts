import { formatLogicalSeparator } from './front/syntax'
import { formatSearchField }      from './front/syntax'
import { logicalWords }       from './front/syntax'
import { parseSearch }       from './front/syntax'
import type { SearchNode }   from './front/syntax'

type LogicalWords = ReturnType<typeof logicalWords>

type Rendered = { fields: string[]; text: string }

function compareFields(left: readonly string[], right: readonly string[], collator: Intl.Collator): number
{
	for (const [index, field] of left.entries()) {
		if (index === right.length) return 1
		const order = collator.compare(field, right[index])
		if (order) return order
	}
	return left.length - right.length
}

function renderSearch(
	text: string, node: SearchNode, fieldOf: (field: string) => string, collator: Intl.Collator, words?: LogicalWords
): Rendered
{
	if ('field' in node) {
		const field    = fieldOf(node.field)
		const spelling = text.slice(node.fieldStart, node.fieldEnd)
		const rendered = field === node.field ? spelling : formatSearchField(field, spelling)
		// A bare empty operand could absorb the next criterion when the fields are reordered.
		const sourceSuffix = text.slice(node.fieldEnd, node.end)
		if (node.implicitEmpty) {
			const spaces = sourceSuffix.match(/\s*$/)?.[0] ?? ''
			return { fields: [field], text: rendered + node.operator + '""' + spaces }
		}
		return {
			fields: [field],
			text:    text.slice(node.start, node.fieldStart) + rendered + sourceSuffix
		}
	}

	const operands = node.operands.map(operand => renderSearch(text, operand, fieldOf, collator, words))
		.sort((left, right) => compareFields(left.fields, right.fields, collator))
	const first = node.operands[0]
	const last  = node.operands[node.operands.length - 1]
	let result  = text.slice(node.start, first.start) + operands[0].text
	for (let index = 1; index < operands.length; index ++) {
		const separator = text.slice(node.operands[index - 1].end, node.operands[index].start)
		const next      = operands[index].text
		result += formatLogicalSeparator(separator, operands[index - 1].text, next, words?.[node.operator]) + next
	}
	return { fields: operands.flatMap(operand => operand.fields), text: result + text.slice(last.end, node.end) }
}

export function searchCaret(
	before: string, after: string, offset: number, pathOf = (field: string) => field, locale = 'en'
): number
{
	if (before === after) return offset
	const previous  = parseSearch(before, locale).criteria
	const current   = parseSearch(after, locale).criteria
	const index     = previous.findLastIndex(criterion => criterion.start <= offset)
	const criterion = previous[index]
	if (!criterion) return Math.min(offset, after.length)

	const path = pathOf(criterion.field)
	const same = (item: typeof criterion) =>
		pathOf(item.field) === path && item.operator === criterion.operator && item.value === criterion.value
	const occurrence = previous.slice(0, index).filter(same).length
	const updated    = current.filter(same)[occurrence] ?? current[index]
	if (!updated) return Math.min(offset, after.length)
	if (offset < criterion.fieldEnd) {
		return Math.min(updated.start + offset - criterion.start, updated.fieldEnd)
	}
	return Math.min(updated.fieldEnd + offset - criterion.fieldEnd, updated.end)
}

export function sortSearch(
	text: string, fieldOf: (field: string) => string, locale: string, inputLocale = locale, outputLocale?: string
): string
{
	const expression = parseSearch(text, inputLocale).expression
	if (!expression) return text

	const sorted = renderSearch(text, expression, fieldOf, new Intl.Collator(locale), outputLocale ? logicalWords(outputLocale) : undefined)
	return text.slice(0, expression.start) + sorted.text + text.slice(expression.end)
}

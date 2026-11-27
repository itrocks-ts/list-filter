import type { Type }           from '@itrocks/class-type'
import { Filter }              from '@itrocks/list/filter'
import { Parameter }           from '@itrocks/list/parameter'
import type { ListQueryState } from '@itrocks/list/session-state'
import type { Request }        from '@itrocks/request-response'
import { AND }                 from '@itrocks/sql-functions'
import { OR }                  from '@itrocks/sql-functions'
import type { SearchType }     from '@itrocks/storage'
import { lang }                from '@itrocks/translate'
import { formatColumnCriterion } from './front/column-projection'
import { groupSearchAlternative } from './front/column-projection'
import { parseSearch }         from './front/syntax'
import type { SearchNode }     from './front/syntax'
import { resolveSearchField }  from './search-field'
import { sortSearch }          from './search-text'

export class InvalidListQuery extends Error
{

	constructor(message: string, readonly parameters: string[] = [])
	{
		super(message)
	}

}

export class ListQuery extends Parameter
{

	text = ''

	displayText(type: Type): string
	{
		return sortSearch(this.text, field =>
			resolveSearchField(type, field, false)?.field ?? field, lang(), 'en', lang()
		)
	}

	getParams(request: Request, type?: Type): void
	{
		if ('reset' in request.data) {
			this.unserialize()
			return
		}
		const text = request.data.listQuery
		if (text === undefined) return
		if (typeof text !== 'string') throw new InvalidListQuery('Invalid list filter')

		const { error, expression, incomplete } = parseSearch(text, lang())
		if (incomplete) throw new InvalidListQuery('Incomplete list filter')
		if (error !== undefined) throw new InvalidListQuery('Unexpected character at position $1', [String(error + 1)])

		this.text = expression ? sortSearch(text, field => {
			if (!type) return field
			const resolved = resolveSearchField(type, field)
			if (!resolved) throw new InvalidListQuery('Unknown list filter field: $1', [field])
			return resolved.path
		}, 'en', lang(), 'en') : ''

	}

	serialize(): ListQueryState | undefined
	{
		return this.text ? { fields: {}, syntax: 'logical', text: this.text } : undefined
	}

	unserialize(state?: ListQueryState): void
	{
		this.text = state?.text ?? ''
	}

}

export class SearchFilter<T extends object> extends Filter<T>
{

	constructor(columns: Filter<T>['columns'], private readonly query: ListQuery)
	{
		super(columns)
	}

	getParams(request: Request, type?: Type): void
	{
		this.query.getParams(request, type)
		super.getParams(request)
		if (request.data.listQuerySync === '1' && typeof request.data.listQuery === 'string') {
			for (const field of Object.keys(this.search)) {
				this.search[field] = ''
			}
		}
	}

	queryText(type: Type): string
	{
		const columns = Object.entries(this.search).flatMap(([path, value]) => {
			if (value === '') return []
			const field = resolveSearchField(type, path, false)?.field ?? path
			return [formatColumnCriterion(field, value)]
		})
		const general = this.query.displayText(type)
		const criteria = [general, ...columns].filter(Boolean)
		const text     = criteria.length === 1 ? criteria[0] : criteria.map(text => groupSearchAlternative(text, lang())).join(' ')
		return sortSearch(text, field => field, lang())
	}

	private queryCondition(type: Type, node: SearchNode): SearchType
	{
		if ('field' in node) {
			const path = node.field
			if (node.column !== undefined) return this.columnCondition(type, path, node.column)
			if (node.columnSyntax) {
				const value = node.operator === ':' ? node.value : `${node.operator} ${node.value}`
				return this.condition(type, path, { value })
			}
			return this.condition(type, path, { comparison: node.operator, value: node.value })
		}

		const operands = node.operands.map(operand => this.queryCondition(type, operand))
			.filter(operand => Reflect.ownKeys(operand).length)
		if (!operands.length) return {}
		if (operands.length === 1) return operands[0]
		return { [node.operator === 'AND' ? AND : OR]: operands }
	}

	searchObject(type: Type)
	{
		const search     = super.searchObject(type)
		const expression = parseSearch(this.query.text).expression
		if (expression) {
			const condition = this.queryCondition(type, expression)
			if (Reflect.ownKeys(condition).length) {
				search[AND] = [...(search[AND] ?? []), condition]
			}
		}
		return search
	}

}

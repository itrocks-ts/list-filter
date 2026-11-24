import type { Type }           from '@itrocks/class-type'
import { Filter }              from '@itrocks/list/filter'
import { Parameter }           from '@itrocks/list/parameter'
import type { ListQueryState } from '@itrocks/list/session-state'
import type { Request }        from '@itrocks/request-response'
import { AND }                 from '@itrocks/sql-functions'
import { OR }                  from '@itrocks/sql-functions'
import type { SearchType }     from '@itrocks/storage'
import { lang }                from '@itrocks/translate'
import { formatSearchField }   from './front/syntax'
import { parseSearch }         from './front/syntax'
import type { SearchNode }     from './front/syntax'
import { resolveSearchField }  from './search-field'
import { sortSearch }          from './search-text'
import { upgradeSearch }       from './search-text'

export class InvalidListQuery extends Error
{

	constructor(message: string, readonly parameters: string[] = [])
	{
		super(message)
	}

}

export class ListQuery extends Parameter
{

	// Older sessions store localised text with a separate property map.
	private fields: Record<string, string> = {}
	private syntax?: 'logical'
	text = ''

	displayText(type: Type): string
	{
		return sortSearch(this.expressionText(), field =>
			resolveSearchField(type, this.path(field), false)?.field ?? field, lang()
		)
	}

	expressionText(): string
	{
		return this.syntax ? this.text : upgradeSearch(this.text)
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

		const { error, expression, incomplete } = parseSearch(text)
		if (incomplete) throw new InvalidListQuery('Incomplete list filter')
		if (error !== undefined) throw new InvalidListQuery('Unexpected character at position $1', [String(error + 1)])

		const canonical = expression ? sortSearch(text, field => {
			if (!type) return field
			const previous = this.path(field)
			const saved    = (previous !== field) && resolveSearchField(type, previous, false)
			const resolved = saved || resolveSearchField(type, field)
			if (!resolved) throw new InvalidListQuery('Unknown list filter field: $1', [field])
			return resolved.path
		}, 'en') : ''

		this.fields = {}
		this.syntax = 'logical'
		this.text   = canonical
	}

	path(field: string): string
	{
		return Object.hasOwn(this.fields, field) ? this.fields[field] : field
	}

	serialize(): ListQueryState | undefined
	{
		return this.text ? { fields: this.fields, syntax: this.syntax, text: this.text } : undefined
	}

	unserialize(state?: ListQueryState | string): void
	{
		this.fields = (typeof state === 'string') ? {} : (state?.fields ?? {})
		this.syntax = (typeof state === 'string') ? undefined : state?.syntax
		this.text   = (typeof state === 'string') ? state : (state?.text ?? '')
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
			return [`${formatSearchField(field)}:(${value})`]
		})
		const general = this.query.displayText(type)
		const root    = parseSearch(general).expression
		const query   = (columns.length && root?.operator === 'OR') ? `(${general})` : general

		return sortSearch([query, ...columns].filter(Boolean).join(' '), field => field, lang())
	}

	private queryCondition(type: Type, node: SearchNode): SearchType
	{
		if ('field' in node) {
			const path = this.query.path(node.field)
			return (node.column === undefined)
				? this.condition(type, path, { comparison: node.operator, value: node.value })
				: this.columnCondition(type, path, node.column)
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
		const expression = parseSearch(this.query.expressionText()).expression
		if (expression) {
			const condition = this.queryCondition(type, expression)
			if (Reflect.ownKeys(condition).length) {
				search[AND] = [...(search[AND] ?? []), condition]
			}
		}
		return search
	}

}

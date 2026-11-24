import { Request }            from '@itrocks/action-request'
import { List }               from '@itrocks/list'
import { listAccess }         from '@itrocks/list'
import { escapeFilterText }   from '@itrocks/list/filter-summary'
import { SearchType }         from '@itrocks/storage'
import { tr }                 from '@itrocks/translate'
import { parseSearch }        from './front/syntax'
import { InvalidListQuery }   from './list-query'
import { ListQuery }          from './list-query'
import { SearchFilter }       from './list-query'
import { resolveSearchField } from './search-field'
import { searchCaret }        from './search-text'

export class ListWithFilters<T extends object = object> extends List<T>
{

	listQuery = new ListQuery
	filter    = new SearchFilter(this.columns, this.listQuery)

	private async fieldCorrection(request: Request<T>, field: string)
	{
		const resolved = resolveSearchField(request.type, field)
		if (!resolved) return this.jsonResponse({})
		const access = await listAccess(request)
		try {
			await access.authorise(resolved.path)
		}
		catch {
			return this.jsonResponse({})
		}
		return this.jsonResponse({
			field: (resolved.field === field) ? undefined : resolved.field,
			path:  resolved.path
		})
	}

	protected filterBar(request: Request<T>)
	{
		const type  = request.type
		const query = this.filter.queryText(type)
		const { focusListCaret, listQuery } = request.request.data
		const original = (typeof listQuery === 'string') ? listQuery : query
		const caret = (
			request.request.method === 'POST' && typeof focusListCaret === 'string' && /^\d+$/.test(focusListCaret)
		) ? String(searchCaret(original, query, Math.min(Number(focusListCaret), original.length),
			field => resolveSearchField(type, field)?.path ?? field
		)) : ''

		const paths  = new Map<string, string>()
		const fields = [
			...this.columns.map(column => column.name),
			...parseSearch(query).criteria.map(criterion => criterion.field)
		]
		for (const field of fields) {
			const resolved = resolveSearchField(request.type, field, false)
			if (!resolved) continue
			paths.set(resolved.field, resolved.path)
			paths.set(resolved.path, resolved.path)
			paths.set(field, resolved.path)
		}

		const escaped = escapeFilterText(query)
		return {
			emptyAlias: escapeFilterText(tr('empty')),
			focusCaret: caret,
			formFields: {
				query:    escapeFilterText(this.listQuery.displayText(type)),
				template: '/@itrocks/list-filter/cjs/search-input.html'
			},
			hasQuery: !!query,
			paths:    encodeURIComponent(JSON.stringify([...paths])),
			query:    escaped,
			template: '/@itrocks/list-filter/cjs/search-editor.html'
		}
	}

	async html(request: Request<T>, scope?: SearchType<T>)
	{
		const field = request.request.data.listFilterField
		if (request.request.method === 'GET' && typeof field === 'string') {
			return this.fieldCorrection(request, field)
		}
		try {
			return await super.html(request, scope)
		}
		catch (error) {
			if (!(error instanceof InvalidListQuery)) throw error
			return this.htmlTemplateResponse(
				{ message: escapeFilterText(tr(error.message, error.parameters)) }, request, __dirname + '/search-error.html', 400
			)
		}
	}

}

export default ListWithFilters

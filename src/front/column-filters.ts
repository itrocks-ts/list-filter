import { highlightColumnFilter } from '@itrocks/list/column-filter.js'
import { columnProjection }      from './column-projection.js'
import type { SearchSyntax }     from './syntax.js'

const columnFilter = 'input[data-property-filter]'

function showValue(input: HTMLInputElement, value: string): void
{
	if (input.value === value) return
	const start     = input.selectionStart
	const end       = input.selectionEnd
	const direction = input.selectionDirection
	const selected  = start === 0 && end === input.value.length && end !== 0
	input.value = value
	if (document.activeElement === input) {
		input.setSelectionRange(start, selected ? value.length : end, direction ?? undefined)
	}
	highlightColumnFilter(input)
}

export class ColumnFilters
{

	private readonly edits = new Map<string, string>()
	private projections = new Map<string, string>()

	constructor(
		private readonly form: HTMLFormElement,
		private readonly pathOf: (field: string) => string,
		change: (path: string, value: string) => void
	)
	{
		form.addEventListener('input', event => {
			const input = event.target
			if (!(input instanceof HTMLInputElement) || !input.matches(columnFilter)) return
			const path = input.dataset.propertyFilter!
			this.edits.set(path, input.value)
			change(path, input.value)
		})
		const header = form.querySelector('table.objects > thead')
		if (header) {
			new MutationObserver(() => this.render()).observe(header, { childList: true, subtree: true })
		}
	}

	clearEdits(): void
	{
		this.edits.clear()
	}

	formData(data: FormData): void
	{
		for (const input of this.inputs()) {
			const value = this.edits.get(input.dataset.propertyFilter!)
			if (value !== undefined && data.has(input.name)) {
				data.set(input.name, value)
			}
			else {
				data.delete(input.name)
			}
		}
	}

	private inputs(): NodeListOf<HTMLInputElement>
	{
		return this.form.querySelectorAll<HTMLInputElement>(columnFilter)
	}

	private render(): void
	{
		for (const input of this.inputs()) {
			const path = input.dataset.propertyFilter!
			showValue(input, this.edits.get(path) ?? this.projections.get(path) ?? '')
		}
	}

	update(search: SearchSyntax): void
	{
		const expression = search.expression ?? search.partial
		if (!expression && (search.incomplete || search.error !== undefined)) return
		this.projections = columnProjection(expression, this.pathOf)
		this.render()
	}

}

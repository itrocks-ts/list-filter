import type { Criterion }    from './syntax.js'
import { formatSearchField } from './syntax.js'
import { parseSearch }       from './syntax.js'
import type { SearchSyntax } from './syntax.js'
import { editorText }        from './text-range.js'
import { replaceText }       from './text-range.js'
import { textOffset }        from './text-range.js'

type Change = { afterEnd: number, beforeEnd: number, start: number }
type Lookup = { controller: AbortController, criterion: Criterion, result?: Resolution }
type Resolution = { field?: string, path?: string }

function textChange(before: string, after: string, editStart = Infinity): Change
{
	const limit     = Math.min(before.length, after.length, editStart)
	let   start     = 0
	let   beforeEnd = before.length
	let   afterEnd  = after.length

	while (start < limit && before[start] === after[start]) {
		start ++
	}
	while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
		beforeEnd --
		afterEnd --
	}
	return { afterEnd, beforeEnd, start }
}

function unchangedFields(
	before: Criterion[], after: Criterion[], { afterEnd, beforeEnd, start }: Change
): Map<Criterion, Criterion>
{
	const positions = new Map(after.map(criterion => [criterion.fieldStart, criterion]))
	const unchanged = new Map<Criterion, Criterion>()
	for (const criterion of before) {
		// The first separator character anchors the occurrence even when the user extends > to >=.
		let offset = 0
		if (criterion.fieldStart >= beforeEnd) {
			offset = afterEnd - beforeEnd
		}
		else if (criterion.fieldEnd >= start) continue

		const next = positions.get(criterion.fieldStart + offset)
		if (next?.field === criterion.field && next.fieldEnd === criterion.fieldEnd + offset) {
			unchanged.set(criterion, next)
		}
	}
	return unchanged
}

export class FieldCorrection
{

	composing = false
	private criteria: Criterion[]
	private editStart?: number
	private lookups = new Set<Lookup>()
	private text: string

	constructor(
		private readonly editor: HTMLElement,
		private readonly action: string,
		private readonly resolved: (path: string, field: string, preferred?: string) => void
	)
	{
		this.text     = editorText(editor)
		this.criteria = parseSearch(this.text).criteria
	}

	private apply(lookup: Lookup): void
	{
		if (this.composing || !lookup.result || !this.lookups.delete(lookup)) return
		if (!this.editor.isConnected || this.text !== editorText(this.editor)) return
		const { field, path } = lookup.result
		if (path) {
			this.resolved(path, lookup.criterion.field, field)
		}
		if (!field || document.activeElement !== this.editor) return
		const { fieldStart, fieldEnd } = lookup.criterion
		const original = this.text.slice(fieldStart, fieldEnd)
		const corrected = formatSearchField(field, original)
		if (corrected !== original) {
			replaceText(this.editor, fieldStart, fieldEnd, corrected)
		}
	}

	beforeInput(range?: AbstractRange): void
	{
		if (this.composing && this.editStart !== undefined) return
		this.editStart = range && textOffset(this.editor, range.startContainer, range.startOffset)
	}

	cancel(): void
	{
		for (const { controller } of this.lookups) {
			controller.abort()
		}
		this.lookups.clear()
	}

	private async lookup(criterion: Criterion): Promise<void>
	{
		const controller = new AbortController()
		const lookup: Lookup = { controller, criterion }
		const url = new URL(this.action)
		url.searchParams.set('listFilterField', criterion.field)
		this.lookups.add(lookup)
		try {
			const response = await fetch(url, { cache: 'no-store', mode: 'same-origin', signal: controller.signal })
			if (response.ok) {
				const result = await response.json() as Resolution
				if (result.field || result.path) {
					lookup.result = result
					this.apply(lookup)
					return
				}
			}
		}
		catch {
			// A cancelled or failed lookup leaves the spelling as entered.
		}
		this.lookups.delete(lookup)
	}

	update(text: string, search: SearchSyntax, inputType = '', lookupNewFields = true): void
	{
		if (this.composing) return
		const change = textChange(this.text, text, this.editStart)
		this.editStart = undefined
		if (text !== this.text) {
			const history = inputType === 'historyUndo' || inputType === 'historyRedo'
			const unchanged = unchangedFields(this.criteria, search.criteria, change)
			const retained = new Set(unchanged.values())
			this.criteria = search.criteria
			this.text     = text

			for (const lookup of this.lookups) {
				const current = unchanged.get(lookup.criterion)
				if (current && !history) {
					lookup.criterion = current
				}
				else {
					lookup.controller.abort()
					this.lookups.delete(lookup)
				}
			}
			if (lookupNewFields && !history && change.afterEnd > change.start) {
				for (const criterion of search.criteria) {
					if (retained.has(criterion) || criterion.fieldEnd >= change.afterEnd) continue
					if (criterion.separatorEnd <= change.start) continue
					void this.lookup(criterion)
				}
			}
		}
		for (const lookup of this.lookups) {
			if (lookup.result) {
				queueMicrotask(() => this.apply(lookup))
			}
		}
	}

}

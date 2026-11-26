import type { SearchSyntax } from './syntax.js'
import { textRange }         from './text-range.js'

const criterionHighlight = 'list-search-criterion'
const errorHighlight     = 'list-search-error'
const spaceHighlight     = 'list-search-error-space'
const valueHighlight     = 'list-search-value'

let highlightedEditor: HTMLElement | undefined

const removalObserver = new MutationObserver(() => {
	if (highlightedEditor?.isConnected !== false) return
	CSS.highlights.delete(criterionHighlight)
	CSS.highlights.delete(errorHighlight)
	CSS.highlights.delete(spaceHighlight)
	CSS.highlights.delete(valueHighlight)
	highlightedEditor = undefined
	removalObserver.disconnect()
})

export function highlightSearch(editor: HTMLElement, text: string, search: SearchSyntax): void
{
	if (!('highlights' in CSS)) return
	if (!highlightedEditor) {
		removalObserver.observe(document.body, { childList: true, subtree: true })
	}
	highlightedEditor = editor

	const criteria = new Highlight()
	const values   = new Highlight()
	for (const { end, start, valueStart, valueEnd } of search.criteria) {
		const criterion = textRange(editor, start, end)
		const value     = textRange(editor, valueStart, valueEnd)
		if (criterion) {
			criteria.add(criterion)
		}
		if (value) {
			values.add(value)
		}
	}

	const error = new Highlight()
	const space = new Highlight()
	if (search.error !== undefined) {
		const character = String.fromCodePoint(text.codePointAt(search.error)!)
		const range     = textRange(editor, search.error, search.error + character.length)
		if (range) {
			const highlight = /\s/.test(character) ? space : error
			highlight.add(range)
		}
	}
	error.priority = 1
	space.priority = 1
	CSS.highlights.set(criterionHighlight, criteria)
	CSS.highlights.set(errorHighlight, error)
	CSS.highlights.set(spaceHighlight, space)
	CSS.highlights.set(valueHighlight, values)
}

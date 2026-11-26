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

function underlineSearch(editor: HTMLElement, text: string): Highlight
{
	const underline = new Highlight()
	let depth = 0
	let quote = ''
	let start = 0
	let end   = 0
	for (; end < text.length; end ++) {
		const character = text[end]
		const next      = text[end + 1]
		if (quote) {
			if ((character === '\\') && ((next === quote) || (next === '\\'))) {
				end ++
			}
			else if (character === quote) {
				quote = ''
			}
		}
		else if (
			(character === '"')
			|| ((character === "'") && (!end || /[\s.:=<>≠!&+|,(-]/.test(text[end - 1])))
		) {
			quote = character
		}
		else if (depth && (character === '\\') && next && '()"\\'.includes(next)) {
			end ++
		}
		else if (character === '(') {
			depth ++
		}
		else if (depth && (character === ')')) {
			depth --
		}
		else if (!depth && /\s/.test(character)) {
			const range = textRange(editor, start, end)
			if (range) {
				underline.add(range)
			}
			start = end + 1
		}
	}
	const range = textRange(editor, start, end)
	if (range) {
		underline.add(range)
	}
	return underline
}

export function highlightSearch(editor: HTMLElement, text: string, search: SearchSyntax): void
{
	if (!('highlights' in CSS)) return
	if (!highlightedEditor) {
		removalObserver.observe(document.body, { childList: true, subtree: true })
	}
	highlightedEditor = editor

	const values = new Highlight()
	for (const { valueStart, valueEnd } of search.criteria) {
		const value = textRange(editor, valueStart, valueEnd)
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
	CSS.highlights.set(criterionHighlight, underlineSearch(editor, text))
	CSS.highlights.set(errorHighlight, error)
	CSS.highlights.set(spaceHighlight, space)
	CSS.highlights.set(valueHighlight, values)
}

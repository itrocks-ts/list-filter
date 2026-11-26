import { build }               from '@itrocks/build/build.js'
import { ContentEditable }     from '@itrocks/contenteditable/contenteditable.js'
import { ColumnFilters }       from './column-filters.js'
import { editColumnCriterion } from './edit-column-criterion.js'
import { FieldCorrection }     from './field-correction.js'
import { highlightSearch }     from './highlight.js'
import { selectCriteria }      from './select-criteria.js'
import { parseSearch }         from './syntax.js'
import { editorText }          from './text-range.js'
import { textOffset }          from './text-range.js'
import { textPoint }           from './text-range.js'

type ColumnDraft = { origin: string, path: string, text: string }

const editors = new WeakMap<HTMLElement, () => void>()

function placeCaret(editor: HTMLElement, offset: number): void
{
	const selection = document.getSelection()
	if (!selection) return
	selection.collapse(...textPoint(editor, offset))
	if (!selection.rangeCount || editor.scrollWidth <= editor.clientWidth) return

	const caret = selection.getRangeAt(0).getBoundingClientRect()
	const left  = editor.getBoundingClientRect().left + editor.clientLeft
	const right = left + editor.clientWidth
	if (caret.left < left) {
		editor.scrollLeft += Math.floor(caret.left - left)
	}
	else if (caret.right >= right) {
		editor.scrollLeft += Math.ceil(caret.right - right + 1)
	}
}

function readEditorText(editor: HTMLElement, padding: HTMLElement): string
{
	if (editor.lastChild !== padding) {
		editor.append(padding)
	}
	const original = editorText(editor)
	const text     = singleLine(original)
	if (text === original) return text

	// Normalise saved text and edits the browser did not let us intercept.
	const selection = document.getSelection()
	const anchor    = selection?.anchorNode && textOffset(editor, selection.anchorNode, selection.anchorOffset)
	const focus     = selection?.focusNode && textOffset(editor, selection.focusNode, selection.focusOffset)
	editor.replaceChildren(text, padding)
	if (selection && typeof anchor === 'number' && typeof focus === 'number') {
		selection.setBaseAndExtent(
			...textPoint(editor, singleLine(original.slice(0, anchor)).length),
			...textPoint(editor, singleLine(original.slice(0, focus)).length)
		)
	}
	return text
}

function singleLine(text: string): string
{
	return text.replace(/[\r\n\u2028\u2029]+/g, ' ')
}

function activate(toolbar: HTMLElement): void
{
	const refresh = editors.get(toolbar)
	if (refresh) {
		refresh()
		return
	}

	const article   = toolbar.closest('article[data-action="list"]')!
	const form      = article.querySelector<HTMLFormElement>(':scope > form')!
	const editor    = toolbar.querySelector<HTMLElement>('.list-filter-text')!
	const padding   = editor.querySelector<HTMLElement>('.list-filter-padding')!
	const query     = form.querySelector<HTMLInputElement>('input[name="listQuery"]')!
	const submit    = form.querySelector<HTMLInputElement>('.search-submit')!
	const trigger   = toolbar.parentElement!.querySelector<HTMLButtonElement>('button.list-filter-icon')!
	const aliases   = new Map<string, string>(JSON.parse(decodeURIComponent(toolbar.dataset.listQueryPaths ?? '[]')))
	const names     = new Map<string, string>()
	const editable  = new ContentEditable(editor)
	const onKeyDown = editable.onKeyDown
	const pathOf    = (field: string) => aliases.get(field) ?? aliases.get(field.normalize().toLocaleLowerCase()) ?? field
	let columnDraft:  ColumnDraft | undefined
	let synchronized = false

	editor.enterKeyHint = 'search'
	padding.textContent = ' '.repeat(6)
	editor.addEventListener('focus', () => {
		const selection = document.getSelection()
		if (!selection?.isCollapsed || !selection.focusNode) return
		const caret = textOffset(editor, selection.focusNode, selection.focusOffset)
		const end   = editorText(editor).length
		if (caret !== undefined && caret > end) {
			placeCaret(editor, end)
		}
	})
	padding.addEventListener('pointerdown', event => {
		if (event.button !== 0) return
		event.preventDefault()
		editor.focus({ preventScroll: true })
		placeCaret(editor, editorText(editor).length)
	})
	selectCriteria(editor)
	for (const [field, path] of aliases) {
		if (!names.has(path)) {
			names.set(path, field)
		}
	}
	const columns = new ColumnFilters(form, pathOf, toolbar.dataset.listEmptyAlias, (path, value) => {
		const text   = editorText(editor)
		const origin = (columnDraft?.path === path && columnDraft.text === text) ? columnDraft.origin : text
		const next   = editColumnCriterion(origin, path, names.get(path) ?? path, value, pathOf, toolbar.dataset.listEmptyAlias)
		columnDraft  = { origin, path, text: next }
		if (next !== text) {
			editor.replaceChildren(next, padding)
			editor.dispatchEvent(new Event('input', { bubbles: true }))
		}
	})

	const readSearch = (composing = false) => {
		const text   = composing ? editorText(editor) : readEditorText(editor, padding)
		const search = parseSearch(text)
		editor.dataset.filled = String(!!text.trim())
		editor.setAttribute('aria-invalid', String(search.error !== undefined))
		highlightSearch(editor, text, search)
		columns.update(search)
		return { search, text }
	}
	const correction = new FieldCorrection(editor, form.action, (path, field, preferred) => {
		aliases.set(field, path)
		if (preferred) {
			aliases.set(preferred, path)
			names.set(path, preferred)
		}
		readSearch()
	})
	editors.set(toolbar, readSearch)

	form.addEventListener('submit', event => {
		synchronized = false
		if (event.submitter?.getAttribute('name') === 'reset') {
			event.preventDefault()
			event.stopImmediatePropagation()
			correction.cancel()
			columnDraft = undefined
			columns.clearEdits()
			editor.replaceChildren(padding)
			query.value = ''
			editor.focus()
			placeCaret(editor, 0)
			readSearch()
			return
		}
		if (event.submitter && !event.submitter.matches('.search-submit')) return
		const { search, text } = readSearch()
		if (search.incomplete || search.error !== undefined) {
			editor.setAttribute('aria-invalid', 'true')
			event.preventDefault()
			event.stopImmediatePropagation()
			return
		}
		query.value = text.trim()
		synchronized = true
		correction.cancel()
	}, { capture: true })

	form.addEventListener('formdata', event => {
		if (synchronized) {
			columns.formData(event.formData)
			event.formData.set('listQuerySync', '1')
			synchronized = false
		}
		const selection = document.getSelection()
		if (document.activeElement !== editor || !selection?.focusNode) return
		const caret = textOffset(editor, selection.focusNode, selection.focusOffset)
		if (caret !== undefined) {
			const text    = editorText(editor)
			const leading = text.length - text.trimStart().length
			event.formData.set('focusListCaret', String(Math.max(0, Math.min(caret - leading, text.trim().length))))
		}
	})
	const keepEditorFocus = (event: PointerEvent) => {
		// Preserve the editor and its caret when either control applies the query.
		if (event.button === 0 && document.activeElement === editor) {
			event.preventDefault()
		}
	}

	submit.addEventListener('pointerdown', keepEditorFocus)
	trigger.addEventListener('pointerdown', keepEditorFocus)
	trigger.addEventListener('click', () => {
		if (document.activeElement === editor) {
			form.requestSubmit(submit)
			return
		}
		editor.focus()
		placeCaret(editor, editorText(editor).length)
		readSearch()
	})
	editor.addEventListener('input', event => {
		const userInput = event instanceof InputEvent
		if (userInput) {
			columnDraft = undefined
			columns.clearEdits()
		}
		const { search, text } = readSearch(userInput && event.isComposing)
		correction.update(text, search, userInput ? event.inputType : '', userInput)
	})
	editor.addEventListener('compositionstart', () => {
		correction.composing = true
	})
	editor.addEventListener('compositionend', () => queueMicrotask(() => {
		correction.composing = false
		const { search, text } = readSearch()
		correction.update(text, search)
	}))
	editor.addEventListener('paste', event => {
		if (!event.clipboardData) return
		event.preventDefault()
		const selection = document.getSelection()
		const text      = singleLine(event.clipboardData.getData('text/plain'))
		correction.beforeInput(selection?.rangeCount ? selection.getRangeAt(0) : undefined)
		// Keep the insertion in the browser's undo history.
		document.execCommand('insertText', false, text)
	})
	editor.addEventListener('beforeinput', event => {
		if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
			event.preventDefault()
			if (!event.isComposing && !correction.composing) {
				form.requestSubmit(submit)
			}
			return
		}
		const target = event.getTargetRanges()[0]
		correction.beforeInput(target)
		const input = event.data ?? event.dataTransfer?.getData('text/plain')
		if (event.isComposing || !event.cancelable || input == null) return
		const text = singleLine(input)
		if (text === input) return

		event.preventDefault()
		if (target) {
			document.getSelection()?.setBaseAndExtent(
				target.startContainer, target.startOffset, target.endContainer, target.endOffset
			)
		}
		document.execCommand('insertText', false, text)
	})
	editable.onKeyDown = function (event: KeyboardEvent): void {
		if (event.key !== 'Enter') {
			onKeyDown.call(this, event)
			return
		}
		if (event.isComposing || correction.composing || event.keyCode === 229) return
		event.preventDefault()
		form.requestSubmit(submit)
	}
	const caret = toolbar.dataset.focusCaret
	delete toolbar.dataset.focusCaret
	const offset = caret ? singleLine(editorText(editor).slice(0, Number(caret))).length : undefined
	readSearch()
	if (offset !== undefined) {
		editor.focus()
		placeCaret(editor, offset)
	}
}

build<HTMLElement, 'call'>({ callback: activate, priority: 2000, selector: '.list-search-editor' })

build<HTMLElement, 'click'>('.list-filter', 'click', function (event) {
	if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return
	const toolbar = this.querySelector<HTMLElement>(':scope > .list-search-editor')
	if (!toolbar || event.target.closest('button, .list-filter-text')) return
	const editor = toolbar.querySelector<HTMLElement>('.list-filter-text')!

	editor.focus({ preventScroll: true })
	const offset = (event.clientX <= editor.getBoundingClientRect().left) ? 0 : editorText(editor).length
	placeCaret(editor, offset)
	editors.get(toolbar)?.()
})

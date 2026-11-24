import { build }               from '@itrocks/build/build.js'
import { ContentEditable }     from '@itrocks/contenteditable/contenteditable.js'
import { ColumnFilters }       from './column-filters.js'
import { editColumnCriterion } from './edit-column-criterion.js'
import { FieldCorrection }     from './field-correction.js'
import { highlightSearch }     from './highlight.js'
import { selectCriteria }      from './select-criteria.js'
import { parseSearch }         from './syntax.js'
import { textOffset }          from './text-range.js'
import { textPoint }           from './text-range.js'

type ColumnDraft = { origin: string, path: string, text: string }

const editors = new WeakMap<HTMLElement, () => void>()

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
	const query     = form.querySelector<HTMLInputElement>('input[name="listQuery"]')!
	const submit    = form.querySelector<HTMLInputElement>('.search-submit')!
	const trigger   = toolbar.querySelector<HTMLButtonElement>('.list-filter-icon')!
	const aliases   = new Map<string, string>(JSON.parse(decodeURIComponent(toolbar.dataset.listQueryPaths ?? '[]')))
	const names     = new Map<string, string>()
	const editable  = new ContentEditable(editor)
	const onKeyDown = editable.onKeyDown
	const pathOf    = (field: string) => aliases.get(field) ?? aliases.get(field.normalize().toLocaleLowerCase()) ?? field
	let columnDraft:  ColumnDraft | undefined
	let synchronized = false

	editor.enterKeyHint = 'search'
	selectCriteria(editor)
	for (const [field, path] of aliases) {
		if (!names.has(path)) {
			names.set(path, field)
		}
	}
	const columns = new ColumnFilters(form, pathOf, toolbar.dataset.listEmptyAlias, (path, value) => {
		const text   = editor.textContent ?? ''
		const origin = (columnDraft?.path === path && columnDraft.text === text) ? columnDraft.origin : text
		const next   = editColumnCriterion(origin, path, names.get(path) ?? path, value, pathOf, toolbar.dataset.listEmptyAlias)
		columnDraft  = { origin, path, text: next }
		if (next !== text) {
			editor.textContent = next
			editor.dispatchEvent(new Event('input', { bubbles: true }))
		}
	})

	const readSearch = () => {
		const text   = editor.textContent ?? ''
		const search = parseSearch(text)
		editor.dataset.filled = String(!!text)
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
			correction.cancel()
			return
		}
		if (event.submitter && !event.submitter.matches('.search-submit, .search-menu button.search')) return
		const { search, text } = readSearch()
		if (search.incomplete || search.error !== undefined) {
			editor.setAttribute('aria-invalid', 'true')
			event.preventDefault()
			event.stopImmediatePropagation()
			return
		}
		query.value = text
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
			event.formData.set('focusListCaret', String(caret))
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
		editor.dataset.filled = 'true'
		editor.focus()
		window.getSelection()?.collapse(editor, editor.childNodes.length)
		readSearch()
	})
	editor.addEventListener('input', event => {
		const userInput = event instanceof InputEvent
		if (userInput) {
			columnDraft = undefined
			columns.clearEdits()
		}
		const { search, text } = readSearch()
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
		const text      = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ')
		correction.beforeInput(selection?.rangeCount ? selection.getRangeAt(0) : undefined)
		// Keep the insertion in the browser's undo history.
		document.execCommand('insertText', false, text)
	})
	editor.addEventListener('beforeinput', event => {
		if (!event.isComposing && ['insertLineBreak', 'insertParagraph'].includes(event.inputType)) {
			event.preventDefault()
			form.requestSubmit(submit)
			return
		}
		correction.beforeInput(event.getTargetRanges()[0])
	})
	editable.onKeyDown = function (event: KeyboardEvent): void {
		if (event.key !== 'Enter') {
			onKeyDown.call(this, event)
			return
		}
		if (event.isComposing || event.keyCode === 229) return
		event.preventDefault()
		form.requestSubmit(submit)
	}
	const caret = toolbar.dataset.focusCaret
	delete toolbar.dataset.focusCaret
	if (caret) {
		editor.dataset.filled = 'true'
		editor.focus()
		document.getSelection()?.collapse(...textPoint(editor, Number(caret)))
	}
	readSearch()
}

build<HTMLElement, 'call'>({ callback: activate, priority: 2000, selector: '.list-search-editor' })

build<HTMLElement, 'click'>('.list-filter', 'click', function (event) {
	if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return
	const toolbar = this.querySelector<HTMLElement>(':scope > .list-search-editor')
	if (!toolbar || event.target.closest('.list-filter-icon, .list-filter-text')) return
	const editor = toolbar.querySelector<HTMLElement>('.list-filter-text')!

	editor.dataset.filled = 'true'
	editor.focus({ preventScroll: true })
	const offset = (event.clientX <= editor.getBoundingClientRect().left) ? 0 : (editor.textContent?.length ?? 0)
	document.getSelection()?.collapse(...textPoint(editor, offset))
	editors.get(toolbar)?.()
})

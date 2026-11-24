import { parseSearch } from './syntax.js'
import { textOffset }  from './text-range.js'
import { textRange }   from './text-range.js'

function selectAt(editor: HTMLElement, x: number, y: number): boolean
{
	const caret    = document.caretPositionFromPoint?.(x, y)
	const range    = caret ? null : document.caretRangeFromPoint?.(x, y)
	const node     = caret?.offsetNode ?? range?.startContainer
	const position = caret?.offset ?? range?.startOffset
	if (!node || position === undefined) return false
	const offset = textOffset(editor, node, position)
	if (offset === undefined) return false

	const text         = editor.textContent ?? ''
	const { criteria } = parseSearch(text)
	const index        = criteria.findIndex(({ start, end }) => start <= offset && offset <= end)
	if (index === -1) return false
	let { start, end } = criteria[index]
	if (index < criteria.length - 1) {
		end += /^\s+/.exec(text.slice(end))?.[0].length ?? 0
	}
	else if (index > 0) {
		start -= /\s+$/.exec(text.slice(0, start))?.[0].length ?? 0
	}

	const selection = document.getSelection()
	const selected  = textRange(editor, start, end)
	if (!selection || !selected) return false
	editor.focus({ preventScroll: true })
	selection.removeAllRanges()
	selection.addRange(selected)
	return true
}

export function selectCriteria(editor: HTMLElement): void
{
	let press: Touch | undefined
	let selected = false
	let timer    = 0

	const cancel = () => {
		window.clearTimeout(timer)
		press    = undefined
		selected = false
	}
	editor.addEventListener('click', event => {
		if (event.detail !== 3) return
		selectAt(editor, event.clientX, event.clientY)
	})
	editor.addEventListener('touchstart', event => {
		cancel()
		if (event.touches.length !== 1) return
		press = event.touches[0]
		const { clientX, clientY } = press
		timer = window.setTimeout(() => {
			selected = selectAt(editor, clientX, clientY)
		}, 450)
	}, { passive: true })
	editor.addEventListener('touchmove', event => {
		if (!press) return
		const touch = event.touches[0]
		if (event.touches.length !== 1 || Math.hypot(touch.clientX - press.clientX, touch.clientY - press.clientY) > 10) {
			cancel()
		}
	}, { passive: true })
	editor.addEventListener('touchcancel', cancel)
	editor.addEventListener('touchend', event => {
		if (selected) {
			event.preventDefault()
		}
		cancel()
	})
	editor.addEventListener('contextmenu', event => {
		if (selected) {
			event.preventDefault()
		}
	})
}

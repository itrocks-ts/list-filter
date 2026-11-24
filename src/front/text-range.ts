
type TextPoint = [Node, number]

function movedOffset(offset: number, start: number, end: number, length: number): number
{
	if (offset <= start) return offset
	if (offset >= end) return offset + length - (end - start)
	return Math.min(offset, start + length)
}

export function replaceText(editor: HTMLElement, start: number, end: number, value: string): void
{
	const selection = document.getSelection()
	if (!selection?.anchorNode || !selection.focusNode) return
	const anchor = textOffset(editor, selection.anchorNode, selection.anchorOffset)
	const focus  = textOffset(editor, selection.focusNode, selection.focusOffset)
	const range  = textRange(editor, start, end)
	if (!range || anchor === undefined || focus === undefined) return

	selection.removeAllRanges()
	selection.addRange(range)
	// Use an editing command so replacing a field can be undone with the surrounding edits.
	const inserted = document.execCommand('insertText', false, value)
	const move     = (offset: number) => inserted ? movedOffset(offset, start, end, value.length) : offset
	selection.setBaseAndExtent(...textPoint(editor, move(anchor)), ...textPoint(editor, move(focus)))
}

export function textOffset(editor: HTMLElement, node: Node, offset: number): number | undefined
{
	if (!editor.contains(node)) return
	const range = document.createRange()
	range.selectNodeContents(editor)
	range.setEnd(node, offset)
	return range.toString().length
}

export function textPoint(editor: HTMLElement, offset: number): TextPoint
{
	const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
	for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
		if (offset <= node.length) return [node, offset]
		offset -= node.length
	}
	return [editor, editor.childNodes.length]
}

export function textRange(editor: HTMLElement, start: number, end: number): Range | undefined
{
	if (start === end) return
	const range = document.createRange()
	range.setStart(...textPoint(editor, start))
	range.setEnd(...textPoint(editor, end))
	return range
}

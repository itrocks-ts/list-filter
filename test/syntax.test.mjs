import assert from 'node:assert/strict'
import test   from 'node:test'
import search from '../cjs/front/syntax.js'

const { formatSearchField, parseSearch } = search

function tree(node)
{
	if ('operands' in node) return [node.operator, ...node.operands.map(tree)]
	return [node.field, node.value]
}

test('accepts all spellings of not equal and preserves their source ranges', () => {
	const spellings = [
		'!title:1900', '-title:1900', '!=title:1900', '<>title:1900',
		'title!=1900', 'title<>1900', 'title≠1900', 'title:!1900'
	]
	const parsed = parseSearch(spellings.join(' '))
	assert.equal(parsed.error, undefined)
	assert.equal(parsed.incomplete, undefined)
	assert.deepEqual(parsed.criteria.map(({ field, operator, value }) => [field, operator, value]),
		spellings.map(() => ['title', '!=', '1900']))
	assert.deepEqual(parsed.criteria.map(({ start, end }) => spellings.join(' ').slice(start, end)), spellings)
})

test('accepts equality, ordered comparisons and multiple criteria', () => {
	const parsed = parseSearch('  année>=1900  score:<10\tperson.name:"A B"  title=ok  ')
	assert.equal(parsed.error, undefined)
	assert.equal(parsed.incomplete, undefined)
	assert.deepEqual(parsed.criteria.map(({ field, operator, value }) => [field, operator, value]), [
		['année', '>=', '1900'], ['score', '<', '10'], ['person.name', ':', 'A B'], ['title', '=', 'ok']
	])
})

test('ignores spaces around field separators while preserving the source and quoted spaces', () => {
	const text   = `titre  :  " A B "  année >= 1978 & -score = 5 lieu : >= 4 titre : (A | B)`
	const parsed = parseSearch(text)
	assert.equal(parsed.error, undefined)
	assert.equal(parsed.incomplete, undefined)
	assert.deepEqual(parsed.criteria.map(({ field, operator, value }) => [field, operator, value]), [
		['titre', ':', ' A B '], ['année', '>=', '1978'], ['score', '!=', '5'],
		['lieu', '>=', '4'], ['titre', ':', 'A | B']
	])
	const first = parsed.criteria[0]
	assert.equal(text.slice(first.fieldEnd, first.separatorEnd), '  :')
	assert.equal(text.slice(first.valueStart, first.valueEnd), ' A B ')
	assert.equal(parsed.criteria[4].column, 'A | B')
})

test('accepts both quote styles for fields, paths and path segments', () => {
	const text   = `-'nombre de vues':1900 "réalisateur.nom complet"='Jean Reno' réalisateur.'nom complet':Jean`
	const parsed = parseSearch(text)
	assert.equal(parsed.error, undefined)
	assert.equal(parsed.incomplete, undefined)
	assert.deepEqual(parsed.criteria.map(({ field, operator, value }) => [field, operator, value]), [
		['nombre de vues', '!=', '1900'],
		['réalisateur.nom complet', '=', 'Jean Reno'],
		['réalisateur.nom complet', ':', 'Jean']
	])
	assert.deepEqual(parsed.criteria.map(({ fieldStart, fieldEnd }) => text.slice(fieldStart, fieldEnd)), [
		"'nombre de vues'", '"réalisateur.nom complet"', "réalisateur.'nom complet'"
	])
})

test('allows optional quotes and keeps apostrophes inside bare values', () => {
	const text   = `title:O'Neil "title":'1900' 'title'="!A" title:'>=A B' title:!='C D'`
	const parsed = parseSearch(text)
	assert.equal(parsed.error, undefined)
	assert.deepEqual(parsed.criteria.map(({ field, operator, value }) => [field, operator, value]), [
		['title', ':', "O'Neil"],
		['title', ':', '1900'],
		['title', '=', '!A'],
		['title', '>=', 'A B'],
		['title', '!=', 'C D']
	])
	assert.deepEqual(parsed.criteria.map(({ valueStart, valueEnd }) => text.slice(valueStart, valueEnd)), [
		"O'Neil", '1900', '!A', 'A B', 'C D'
	])
})

test('formats field names with minimal quoting or the original outer quote', () => {
	assert.equal(formatSearchField('réalisateur.nom'), 'réalisateur.nom')
	assert.equal(formatSearchField('nombre de vues'), '"nombre de vues"')
	assert.equal(formatSearchField('titre', "'titre'"), "'titre'")
	assert.equal(formatSearchField('titre', '"titre"'), '"titre"')

	const field     = "nombre d'entrées \\ sorties"
	const formatted = formatSearchField(field, "'nom'")
	const text      = `!${formatted}=x`
	const parsed    = parseSearch(text)
	assert.equal(parsed.error, undefined)
	const criterion = parsed.criteria[0]
	assert.equal(criterion.field, field)
	assert.equal(text.slice(criterion.fieldStart, criterion.fieldEnd), formatted)
	assert.equal(text.slice(criterion.fieldEnd, criterion.separatorEnd), '=')
})

test('decodes escapes for the matching quote and keeps the opposite quote literal', () => {
	const text   = String.raw`'nombre d\'entrées':"l'année" "a \"quote\"":'du "cinéma"' title:'L\'A \ B'`
	const parsed = parseSearch(text)
	assert.equal(parsed.error, undefined)
	assert.deepEqual(parsed.criteria.map(({ field, value }) => [field, value]), [
		["nombre d'entrées", "l'année"], ['a "quote"', 'du "cinéma"'], ['title', "L'A \\ B"]
	])
})

test('keeps leading symbols literal after an explicit comparison', () => {
	const parsed = parseSearch('title="!A B" count>=<10 -video:!live title:>">A B"')
	assert.equal(parsed.error, undefined)
	assert.deepEqual(parsed.criteria.map(({ operator, value }) => [operator, value]),
		[['=', '!A B'], ['>=', '<10'], ['!=', '!live'], ['>', '>A B']])
})

test('locates the first unexpected character and keeps understood operands', () => {
	const text   = 'title:"🎬 A"year:1900 @extra'
	const parsed = parseSearch(text)
	assert.equal(parsed.error, text.indexOf('year'))
	assert.deepEqual(parsed.criteria.map(({ valueStart, valueEnd }) => text.slice(valueStart, valueEnd)), ['🎬 A'])
	assert.equal(parseSearch('title!x').error, 6)
	assert.equal(parseSearch('!title>value').error, 6)
})

test('reads leading comparisons inside quoted values and decodes escapes', () => {
	const text   = String.raw`name:">=A \"B\" \\ C" title:!="D E"`
	const parsed = parseSearch(text)
	assert.equal(parsed.error, undefined)
	assert.deepEqual(parsed.criteria.map(({ operator, value }) => [operator, value]),
		[['>=', 'A "B" \\ C'], ['!=', 'D E']])
	assert.deepEqual(parsed.criteria.map(({ valueStart, valueEnd }) => text.slice(valueStart, valueEnd)),
		[String.raw`A \"B\" \\ C`, 'D E'])
})

test('retains known values while criteria are incomplete at the end of input', () => {
	for (const text of ['title', 'title!', 'title:', 'title : ', 'title:!', 'title : ! ', 'title:"A B', "title:'A B", 'person.', "'nom"]) {
		assert.equal(parseSearch(text).incomplete, true, text)
		assert.equal(parseSearch(text).error, undefined, text)
	}
	assert.equal(parseSearch('title:"A B').criteria[0].value, 'A B')
	assert.equal(parseSearch('title=""').criteria[0].value, '')
	assert.equal(parseSearch('title=""').incomplete, undefined)
})

test('reports unexpected characters around quoted fields and values', () => {
	assert.equal(parseSearch("''=1900").error, 1)
	assert.equal(parseSearch("'titre'abc=1900").error, 7)
	assert.equal(parseSearch('titre:Foo"Bar').error, 9)
	assert.equal(parseSearch("titre:'Foo'Bar").error, 11)
	assert.equal(parseSearch("titre:'Foo\"").incomplete, true)
})

test('groups AND before OR, including whitespace and both explicit spellings', () => {
	const parsed = parseSearch('title:Alien & year:1979+studio:Fox|title:Aliens year:1986, score>=9')
	assert.equal(parsed.error, undefined)
	assert.deepEqual(tree(parsed.expression), [
		'OR',
		['AND', ['title', 'Alien'], ['year', '1979'], ['studio', 'Fox']],
		['AND', ['title', 'Aliens'], ['year', '1986']],
		['score', '9']
	])
})

test('includes both parentheses in group spans without widening criterion spans', () => {
	const text   = '  (title:Alien|title:Aliens) & (year:1986)  '
	const parsed = parseSearch(text)
	assert.deepEqual(tree(parsed.expression), [
		'AND',
		['OR', ['title', 'Alien'], ['title', 'Aliens']],
		['AND', ['year', '1986']]
	])
	assert.deepEqual(parsed.expression.operands.map(({ end, start }) => text.slice(start, end)),
		['(title:Alien|title:Aliens)', '(year:1986)'])
	assert.deepEqual(parsed.criteria.map(({ end, start }) => text.slice(start, end)),
		['title:Alien', 'title:Aliens', 'year:1986'])
})

test('retains raw column syntax with nested groups, escapes and quotes', () => {
	const raw    = String.raw`  A | (B + "C ) & D"), E\) | O'Neil  `
	const text   = `title:(${raw}) year>=1979`
	const parsed = parseSearch(text)
	assert.equal(parsed.incomplete, undefined)
	assert.equal(parsed.error, undefined)
	assert.deepEqual(tree(parsed.expression), ['AND', ['title', raw], ['year', '1979']])
	const criterion = parsed.criteria[0]
	assert.equal(criterion.column, raw)
	assert.equal(text.slice(criterion.start, criterion.end), `title:(${raw})`)
	assert.equal(text.slice(criterion.valueStart, criterion.valueEnd), raw)
})

test('requires colon by itself for column groups and fields for general operands', () => {
	const cases = [
		['title=(Alien | Aliens)', '('],
		['-title:(Alien | Aliens)', '('],
		['title:>(Alien | Aliens)', '('],
		['title:Alien | Aliens year:1986', 'year'],
		['title:Alien&|year:1986', '|'],
		['title:(Alien | | Aliens)', '| Aliens'],
		['title:(Alien)(year:1986)', '(year']
	]
	for (const [text, unexpected] of cases) {
		const parsed = parseSearch(text)
		assert.equal(parsed.error, text.indexOf(unexpected), text)
		assert.equal(parsed.expression, undefined, text)
	}
})

test('retains valid subexpressions and understood ranges for unfinished queries', () => {
	const parsed = parseSearch('title:Alien | (title:Aliens + year:')
	assert.equal(parsed.incomplete, true)
	assert.equal(parsed.expression, undefined)
	assert.deepEqual(tree(parsed.partial), ['OR', ['title', 'Alien'], ['title', 'Aliens']])
	assert.deepEqual(parsed.criteria.map(({ field, value }) => [field, value]), [
		['title', 'Alien'], ['title', 'Aliens'], ['year', '']
	])
	const column = parseSearch('title:(A | (B & "C')
	assert.equal(column.incomplete, true)
	assert.equal(column.criteria[0].column, 'A | (B & "C')
	const invalid = parseSearch('title:Alien |)')
	assert.equal(invalid.error, 13)
	assert.deepEqual(tree(invalid.partial), ['title', 'Alien'])
})

test('keeps quoted logic punctuation literal and reads saved flat punctuation in legacy mode', () => {
	const text = `title:"A,B & C" studio:'(D+E|F)'`
	assert.deepEqual(tree(parseSearch(text).expression), ['AND', ['title', 'A,B & C'], ['studio', '(D+E|F)']])
	assert.deepEqual(tree(parseSearch('title:A,B studio:(D+E|F)', true).expression),
		['AND', ['title', 'A,B'], ['studio', '(D+E|F)']])
})

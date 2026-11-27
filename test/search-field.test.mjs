import assert            from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test }          from 'node:test'

const require = createRequire(import.meta.url)
const { trInit, translations, trWithLanguage } = require('@itrocks/translate')
const { AND, OR } = require('@itrocks/sql-functions')
const { columnProjection } = require('../cjs/front/column-projection.js')
const { parseSearch } = require('../cjs/front/syntax.js')
const { ListQuery, SearchFilter } = require('../cjs/list-query.js')
const { searchCaret } = require('../cjs/search-text.js')
const { resolveSearchField } = require('../cjs/search-field.js')
const { Film } = require('./fixtures/search-fields.cjs')

trInit('fr-FR')
for (const [english, french] of [
	['added', 'ajouté'], ['director', 'réalisateur'], ['empty', 'vide'], ['name', 'nom'], ['original title', 'titre original'], ['title', 'titre'],
	['watch count', 'nombre de vues']
]) {
	translations.set(english, french)
}

test('resolves English names, localised labels, unique prefixes and close typos throughout a property path', () => {
	for (const [input, field, path] of [
		['added', 'ajouté', 'added'],
		['ajouté', 'ajouté', 'added'],
		['ajou', 'ajouté', 'added'],
		['ajoutè', 'ajouté', 'added'],
		['studio.name', 'studio.nom', 'studio.name'],
		['studo.nam', 'studio.nom', 'studio.name'],
		['watch count', 'nombre de vues', 'watchCount'],
		['nombre de vues', 'nombre de vues', 'watchCount']
	]) {
		assert.deepEqual(resolveSearchField(Film, input), { field, path })
	}
	for (const input of ['qqzzx', 'studio.qqzzx', 'tit', 'title.name']) {
		assert.equal(resolveSearchField(Film, input), undefined)
	}
})

test('stores canonical paths and displays new and existing queries in the request language', () => {
	const query = new ListQuery()
	query.getParams({ data: { listQuery: `ajouté:13/01/2026   'watch count'>='8'` } }, Film)
	assert.deepEqual(query.serialize(), { fields: {}, syntax: 'logical', text: `added:13/01/2026   'watchCount'>='8'` })
	assert.equal(query.displayText(Film), `ajouté:13/01/2026   'nombre de vues'>='8'`)
	assert.equal(trWithLanguage('en-US', () => query.displayText(Film)), `added:13/01/2026   'watch count'>='8'`)

	const restored = new ListQuery()
	restored.unserialize(query.serialize())
	assert.equal(restored.displayText(Film), query.displayText(Film))
	assert.equal(trWithLanguage('en-US', () => restored.displayText(Film)), `added:13/01/2026   'watch count'>='8'`)
	restored.getParams({ data: { reset: '' } }, Film)
	assert.equal(restored.serialize(), undefined)
	assert.equal(restored.displayText(Film), '')
})

test('sorts paths in English when saving and in the request language when rendering', () => {
	const query = new ListQuery()
	query.getParams({ data: { listQuery: `'nombre de vues'>=8 | (titre:1900 ajouté:13/01/2026)` } }, Film)
	assert.equal(query.text, `(added:13/01/2026 title:1900) | 'watchCount'>=8`)
	assert.equal(query.displayText(Film), `(ajouté:13/01/2026 titre:1900) | 'nombre de vues'>=8`)

	query.getParams({ data: { listQuery: `'nombre de vues'>=8 titre:1900` } }, Film)
	assert.equal(query.text, `title:1900 'watchCount'>=8`)
	assert.equal(query.displayText(Film), `'nombre de vues'>=8 titre:1900`)
})

test('stores connector words in English and localises them on display without changing values', () => {
	const query = new ListQuery()
	query.getParams({ data: { listQuery: '(titre:Alien ou titre:Predator) ET titre:"Rock et métal"' } }, Film)
	assert.equal(query.text, 'title:"Rock et métal" AND (title:Alien or title:Predator)')
	assert.equal(query.displayText(Film), 'titre:"Rock et métal" ET (titre:Alien ou titre:Predator)')
	assert.equal(trWithLanguage('en-US', () => query.displayText(Film)), query.text)
})

test('maps the caret to the same criterion after translating and sorting fields', () => {
	const before = 'watchCount>=8 title=1900'
	const after  = 'titre=1900 "nombre de vues">=8'
	const pathOf = field => resolveSearchField(Film, field).path

	assert.equal(searchCaret(before, after, before.indexOf('>='), pathOf), after.indexOf('>='))
	assert.equal(searchCaret(before, after, before.indexOf('8') + 1, pathOf), after.indexOf('8') + 1)
	assert.equal(searchCaret(before, after, before.length - 2, pathOf), 'titre=1900'.length - 2)
})

test('preserves quoted punctuation and prefix exclusion when reopening a saved filter', () => {
	const query = new ListQuery()
	const input = 'titre="A,B" !titre:Alien'
	query.getParams({ data: { listQuery: input } }, Film)
	const restored = new ListQuery()
	restored.unserialize(query.serialize())
	assert.equal(restored.displayText(Film), input)
	const [condition] = new SearchFilter([], restored).searchObject(Film)[AND]
	assert.deepEqual(condition[AND].map(({ title }) => title.build()), [
		{ sql: ' = ?', values: ['A,B'] },
		{ sql: ' NOT LIKE ?', values: ['Alien%'] }
	])
	assert.throws(() => query.getParams({ data: { listQuery: '!=title:Alien' } }, Film))
})

test('resolves quoted English names and looks for an actual field when the exclamation mark is inside quotes', () => {
	const filter = new SearchFilter([{ name: 'watchCount' }], new ListQuery())
	for (const text of ['!"nombre de vues"=10', '!"watch count"=10', 'watchCount!=10']) {
		filter.getParams({ data: { listQuery: text, listQuerySync: '1' } }, Film)
		assert.deepEqual(filter.searchObject(Film)[AND][0].watchCount.build(), { sql: ' <> ?', values: [10] })
	}
	assert.throws(() => filter.getParams({ data: { listQuery: '"!nombre de vues"=10' } }, Film), /Unknown/)
	filter.getParams({ data: { listQuery: '"watch count"="1.25e+2"', listQuerySync: '1' } }, Film)
	assert.deepEqual(filter.searchObject(Film)[AND][0].watchCount.build(), { sql: ' = ?', values: [125] })
})

test('matches numeric and relationship absence through either filter and keeps object representatives for values', () => {
	const filter = new SearchFilter(['director', 'watchCount'].map(name => ({ name })), new ListQuery())
	for (const [field, path] of [['réalisateur', 'director'], ['"nombre de vues"', 'watchCount']]) {
		for (const [input, sql] of [['vide', ' IS NULL'], ['!vide', ' IS NOT NULL']]) {
			const text = field + ':' + input
			filter.getParams({ data: { listQuery: text, listQuerySync: '1' } }, Film)
			assert.deepEqual(filter.searchObject(Film)[AND][0][path].build(), { sql, values: [] })
			filter.getParams({ data: { listQuery: '', ['search.' + path]: input } }, Film)
			assert.deepEqual(filter.searchObject(Film)[path].build(), { sql, values: [] })
		}
	}
	filter.getParams({ data: { listQuery: 'réalisateur:Jean', listQuerySync: '1' } }, Film)
	const [last, first] = filter.searchObject(Film)[AND][0][OR]
	assert.deepEqual(last['director.lastName'].build(), { sql: ' LIKE ?', values: ['Jean%'] })
	assert.deepEqual(first['director.firstName'].build(), { sql: ' LIKE ?', values: ['Jean%'] })
})

test('uses the column search semantics in a group and applies synchronized values only once', () => {
	const query   = new ListQuery()
	const columns = ['title', 'watchCount'].map(name => ({ name }))
	const filter  = new SearchFilter(columns, query)
	filter.unserialize({ title: 'A,B', watchCount: '' })

	assert.equal(filter.queryText(Film), 'titre:A | titre:B')
	filter.getParams({ data: {
		listQuery: 'titre:(A,B) | "nombre de vues">=8 titre=Other',
		listQuerySync: '1',
		'search.title': 'A,B'
	} }, Film)
	assert.deepEqual(filter.search, { title: '', watchCount: '' })
	const alternatives = filter.searchObject(Film)[AND][0][OR]
	assert.equal(alternatives[0].title.operator, 'OR')
	assert.deepEqual(alternatives[0].title.operands.map(operand => operand.build().values[0]), ['A%', 'B%'])
	assert.equal(alternatives[1][AND][0].title.value, 'Other')
	assert.equal(alternatives[1][AND][1].watchCount.value, 8)
})

test('summarises plain column values without parentheses and preserves column search semantics', () => {
	for (const [value, text, display = value] of [
		[' ', 'titre:" "'],
		[' Autant', 'titre:" Autant"'],
		['Alien', 'titre:Alien'],
		['Alien Resurrection', 'titre:"Alien Resurrection"'],
		['Autant ', 'titre:"Autant "'],
		['Autant e', 'titre:"Autant e"'],
		['=Alien', 'titre=Alien'],
		['Alien*', 'titre:Alien*'],
		['Ali%n', 'titre:Ali%n'],
		['!A_en', '!titre:A_en'],
		['!vide', '!titre:vide'],
		['!=Alien', 'titre!=Alien'],
		['<>Alien', 'titre<>Alien', '!=Alien'],
		['<>vide', 'titre<>vide', '!=vide'],
		[' !vide', 'titre:" !vide"'],
		['>=10', 'titre>=10'],
		['"a+b"', 'titre:"a+b"'],
		['"Alien (1979)"', 'titre:"Alien (1979)"'],
		['≠Alien', 'titre≠Alien', '!=Alien'],
		['vide', 'titre:vide']
	]) {
		const filter = new SearchFilter([{ name: 'title' }], new ListQuery())
		filter.unserialize({ title: value })
		assert.equal(filter.queryText(Film), text)
		const projected = columnProjection(
			parseSearch(text).expression, field => resolveSearchField(Film, field).path
		)
		assert.equal(projected.get('title'), display)
		const criterion = filter.searchObject(Film).title
		filter.getParams({ data: { listQuery: text, listQuerySync: '1' } }, Film)
		assert.deepEqual(filter.searchObject(Film)[AND][0].title, criterion)
	}
})

test('expands logical column searches and keeps each group in scope when editing or submitting', () => {
	const filter = new SearchFilter([{ name: 'title' }, { name: 'watchCount' }], new ListQuery())
	filter.unserialize({ title: 'Alien | (Aliens & !vide)', watchCount: '>=8' })
	const expected = '"nombre de vues">=8 (titre:Alien | titre:Aliens & !titre:vide)'
	assert.equal(filter.queryText(Film), expected)
	const pathOf = field => resolveSearchField(Film, field).path
	assert.deepEqual([...columnProjection(parseSearch(expected).expression, pathOf)], [
		['watchCount', '>=8'], ['title', 'Alien | Aliens & !vide']
	])
	filter.getParams({ data: { listQuery: expected, listQuerySync: '1' } }, Film)
	const criteria = filter.searchObject(Film)[AND][0][AND]
	assert.equal(criteria.find(criterion => 'watchCount' in criterion).watchCount.value, 8)
	const alternatives = criteria.find(criterion => OR in criterion)[OR]
	assert.deepEqual(alternatives[0].title.build().values, ['Alien%'])
	assert.deepEqual(alternatives[1][AND][0].title.build().values, ['Aliens%'])
	assert.deepEqual(alternatives[1][AND][1].title.build().values, ['_%'])
})

test('preserves spaces when combining multiple criteria in one column', () => {
	const expression = parseSearch('titre:"Autant " | titre:" Autres"').expression
	const projected  = columnProjection(expression, field => resolveSearchField(Film, field).path)
	assert.equal(projected.get('title'), '"Autant " | " Autres"')
})

test('uses the same wildcard patterns in the search editor and column inputs', () => {
	const columns = ['title', 'watchCount', 'added'].map(name => ({ name }))
	const query   = new ListQuery()
	const filter  = new SearchFilter(columns, query)
	for (const [text, path, column, sql, pattern] of [
		['title:Alien', 'title', 'Alien', ' LIKE ?', 'Alien%'],
		['title:A*B', 'title', 'A*B', ' LIKE ?', 'A%B'],
		['title:A%B', 'title', 'A%B', ' LIKE ?', 'A%B'],
		['title:A?B', 'title', 'A?B', ' LIKE ?', 'A_B'],
		['title:A_B', 'title', 'A_B', ' LIKE ?', 'A_B'],
		['title=100%', 'title', '=100%', ' = ?', '100%'],
		['!title:Alien', 'title', '!Alien', ' NOT LIKE ?', 'Alien%'],
		['-title:Alien', 'title', '!Alien', ' NOT LIKE ?', 'Alien%'],
		['title!Alien', 'title', '!Alien', ' NOT LIKE ?', 'Alien%'],
		['title:!Alien', 'title', '!Alien', ' NOT LIKE ?', 'Alien%'],
		['!title:A%B', 'title', '!A%B', ' NOT LIKE ?', 'A%B'],
		['-title:A%B', 'title', '!A%B', ' NOT LIKE ?', 'A%B'],
		['title!A%B', 'title', '!A%B', ' NOT LIKE ?', 'A%B'],
		['title<>A_B', 'title', '!=A_B', ' <> ?', 'A_B'],
		['title≠A_B', 'title', '!=A_B', ' <> ?', 'A_B'],
		['title:!=A*B', 'title', '!=A*B', ' <> ?', 'A*B'],
		['!title=A*B', 'title', '!=A*B', ' <> ?', 'A*B'],
		['-title=Alien', 'title', '!=Alien', ' <> ?', 'Alien'],
		['title:(!A_B)', 'title', '!A_B', ' NOT LIKE ?', 'A_B'],
		['watchCount:1_', 'watchCount', '1_', ' LIKE ?', '1_'],
		['watchCount!=1%', 'watchCount', '!=1%', ' <> ?', '1%'],
		['added:2020-03-__', 'added', '2020-03-__', ' LIKE ?', '2020-03-__%'],
		['added<>2020-03-__', 'added', '!=2020-03-__', ' NOT LIKE ?', '2020-03-__%']
	]) {
		filter.getParams({ data: { listQuery: text, listQuerySync: '1' } }, Film)
		const result = filter.searchObject(Film)[AND][0][path]
		assert.deepEqual(result.build(), { sql, values: [pattern] }, text)

		const projected = columnProjection(parseSearch(text).expression, field => field)
		assert.equal(projected.get(path), column, text)
		filter.getParams({ data: { listQuery: '', [`search.${path}`]: column } }, Film)
		assert.deepEqual(filter.searchObject(Film)[path], result, text)
	}
})

test('projects empty equality as equals in the column before and after saving the general filter', () => {
	const query  = new ListQuery()
	const pathOf = field => resolveSearchField(Film, field).path
	const cases  = [
		['titre=', '='],
		['titre:', '='],
		['titre=""', '='],
		['titre:=""', '='],
		['(titre:"" | titre=)', '"" | ='],
		['titre= | titre:Alien', '= | Alien']
	]
	for (const [text, column] of cases) {
		query.getParams({ data: { listQuery: text } }, Film)
		for (const source of [text, query.displayText(Film)]) {
			assert.equal(columnProjection(parseSearch(source).expression, pathOf).get('title'), column, source)
		}
	}
})

test('projects empty comparisons and their negations before and after saving', () => {
	const query  = new ListQuery()
	const pathOf = field => resolveSearchField(Film, field).path
	for (const [separator, direct, negated] of [
		[':', '=', '!'], ['=', '=', '!='], ['!', '!', '""'], ['!=', '!=', '='],
		['<>', '!=', '='], ['≠', '!=', '='], ['<', '<', '>='], ['<=', '<=', '>'], ['>', '>', '<='], ['>=', '>=', '<']
	]) {
		for (const [prefix, column] of [['', direct], ['!', negated], ['-', negated]]) {
			const text = prefix + 'titre' + separator
			query.getParams({ data: { listQuery: text } }, Film)
			for (const source of [text, query.displayText(Film)]) {
				assert.equal(columnProjection(parseSearch(source).expression, pathOf).get('title'), column, text)
			}
		}
	}
})

test('applies column rules to single values and grouped expressions after a colon', () => {
	const columns = ['title', 'watchCount', 'added'].map(name => ({ name }))
	const filter  = new SearchFilter(columns, new ListQuery())
	for (const [query, path, value] of [
		['titre:vide', 'title', 'vide'],
		['titre:!vide', 'title', '!vide'],
		['!titre:vide', 'title', '!vide'],
		['titre:=', 'title', '='],
		['titre:="Paris, Texas"', 'title', '="Paris, Texas"'],
		['titre:"Rock & Roll"', 'title', '"Rock & Roll"'],
		['watchCount:10-20', 'watchCount', '10-20'],
		['watchCount:10-', 'watchCount', '10-'],
		['watchCount:-20', 'watchCount', '-20'],
		['watchCount:"10 - 20"', 'watchCount', '10 - 20'],
		['watchCount:<= 20', 'watchCount', '<=20'],
		['added:2020-2022', 'added', '2020-2022'],
		[String.raw`titre:(Paris\, Texas | (Alien & !*test*))`, 'title', String.raw`Paris\, Texas | (Alien & !*test*)`]
	]) {
		filter.getParams({ data: { listQuery: query, listQuerySync: '1' } }, Film)
		const actual = filter.searchObject(Film)[AND][0][path]

		const projected = columnProjection(
			parseSearch(query).expression, field => resolveSearchField(Film, field).path
		)
		filter.getParams({ data: { listQuery: '', [`search.${path}`]: value } }, Film)
		assert.deepEqual(filter.searchObject(Film)[path], actual, query)
		filter.getParams({ data: { listQuery: '', [`search.${path}`]: projected.get(path) } }, Film)
		assert.deepEqual(filter.searchObject(Film)[path], actual, query)
	}
	filter.getParams({ data: { listQuery: 'watchCount:-', listQuerySync: '1' } }, Film)
	assert.equal(filter.searchObject(Film)[AND][0].watchCount.operator, 'OR')
	assert.deepEqual(filter.searchObject(Film)[AND][0].watchCount.operands, [])
})

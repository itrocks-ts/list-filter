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
	['added', 'ajouté'], ['empty', 'vide'], ['name', 'nom'], ['original title', 'titre original'], ['title', 'titre'],
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

	query.unserialize({ fields: { ajouté: 'added' }, text: 'ajouté:13/01/2026' })
	assert.equal(trWithLanguage('en-US', () => query.displayText(Film)), 'added:13/01/2026')
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

test('maps the caret to the same criterion after translating and sorting fields', () => {
	const before = 'watchCount>=8 title=1900'
	const after  = 'titre=1900 "nombre de vues">=8'
	const pathOf = field => resolveSearchField(Film, field).path

	assert.equal(searchCaret(before, after, before.indexOf('>='), pathOf), after.indexOf('>='))
	assert.equal(searchCaret(before, after, before.indexOf('8') + 1, pathOf), after.indexOf('8') + 1)
	assert.equal(searchCaret(before, after, before.length - 2, pathOf), 'titre=1900'.length - 2)
})

test('preserves punctuation as literal text from old saved general filters', () => {
	const query = new ListQuery()
	query.unserialize({ fields: {}, text: 'title:A,B title:A+B' })
	assert.equal(query.displayText(Film), 'titre:"A,B" titre:"A+B"')
})

test('uses the column search semantics in a group and applies synchronized values only once', () => {
	const query   = new ListQuery()
	const columns = ['title', 'watchCount'].map(name => ({ name }))
	const filter  = new SearchFilter(columns, query)
	filter.unserialize({ title: 'A,B', watchCount: '' })

	assert.equal(filter.queryText(Film), 'titre:(A,B)')
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
	assert.equal(alternatives[1][AND][1].watchCount.value, '8')
})

test('summarises plain column values without parentheses and preserves column search semantics', () => {
	for (const [value, text] of [
		['Alien', 'titre:Alien'],
		['Alien Resurrection', 'titre:"Alien Resurrection"'],
		['=Alien', 'titre:=Alien'],
		['Alien*', 'titre:(Alien*)'],
		['(Alien | Aliens) & !vide', 'titre:((Alien | Aliens) & !vide)'],
		['vide', 'titre:(vide)']
	]) {
		const filter = new SearchFilter([{ name: 'title' }], new ListQuery())
		filter.unserialize({ title: value })
		assert.equal(filter.queryText(Film), text)
		const projected = columnProjection(parseSearch(text).expression, field => resolveSearchField(Film, field).path, 'vide')
		assert.equal(projected.get('title'), value)
		const criterion = filter.searchObject(Film).title
		filter.getParams({ data: { listQuery: text, listQuerySync: '1' } }, Film)
		assert.deepEqual(filter.searchObject(Film)[AND][0].title, criterion)
	}
})

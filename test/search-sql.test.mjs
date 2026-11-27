import assert            from 'node:assert/strict'
import { readFileSync }  from 'node:fs'
import { createRequire } from 'node:module'
import { test }          from 'node:test'
import { editColumnCriterion } from '../edit-column-criterion.js'

const require = createRequire(import.meta.url)
const { Count, Select } = require('@itrocks/sql-build')
const { sqlJoinDependsOn } = require('@itrocks/sql-join')
const { trInit, translations } = require('@itrocks/translate')
const { InvalidListQuery, ListQuery, SearchFilter } = require('../cjs/list-query.js')
const { resolveSearchField } = require('../cjs/search-field.js')
const { Film } = require('./fixtures/search-fields.cjs')

const columnPaths = {
	Ajouté: 'added',
	'Nom du réalisateur': 'director.lastName',
	'Nom du studio': 'studio.name',
	'Nombre de vues': 'watchCount',
	'Prénom du réalisateur': 'director.firstName',
	Réalisateur: 'director',
	Titre: 'title'
}
const columns = Object.values(columnPaths).map(name => ({ name }))
const scalar  = name => ({ name, scalar: true })
const schema  = {
	table: 'film',
	columns: {
		added: scalar('ajoute'),
		director: {
			name: 'director',
			target: { table: 'director', columns: { firstName: scalar('prenom'), lastName: scalar('nom') } }
		},
		studio: {
			name: 'studio',
			target: { table: 'studio', columns: { name: scalar('nom') } }
		},
		title: scalar('titre'),
		watchCount: scalar('vues')
	}
}

const sqlLiteral = /'(?:''|\\.|[^'\\])*'/g
const sqlToken   = /'(?:''|\\.|[^'\\])*'|\(|\)|\b(?:AND|OR|BETWEEN)\b/g
const dateTime   = /^'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}'$/
const rejections = {
	'Champ inconnu': /^Unknown list filter field/,
	'Critère incomplet': /^Incomplete list filter$/,
	'Saisie refusée': /^Unexpected character/
}

function inlineCode(cell)
{
	const match = /^`([^`]*)`$/.exec(cell)
	assert.ok(match, 'Expected an inline code cell, got ' + cell)
	return match[1]
}

function documentedRows()
{
	const markdown = readFileSync(new URL('../docs/search-sql-examples.fr.md', import.meta.url), 'utf8')
	const rows = []
	let section
	let previous
	for (const [index, line] of markdown.split(/\r?\n/).entries()) {
		if (line.startsWith('## ')) {
			section = line.slice(3)
			previous = undefined
		}
		if (!line.startsWith('|')) continue
		const lineNumber = index + 1
		assert.ok(section && line.endsWith('|'), 'Malformed table row at line ' + lineNumber)
		const cells = line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll('\\|', '|'))
		assert.equal(cells.length, 4, 'Expected four columns at line ' + lineNumber)
		if (cells[0] === 'Filtre général' || cells.every(cell => /^-+$/.test(cell))) continue
		if (/^\*\*.+\*\*$/.test(cells[0])) {
			assert.deepEqual(cells.slice(1), ['', '', ''], 'Invalid type heading at line ' + lineNumber)
			previous = undefined
			continue
		}
		const expanded = cells.map((cell, column) => {
			if (cell !== '"') return cell
			assert.ok(previous, 'No previous row for ditto mark at line ' + lineNumber)
			return previous[column]
		})
		const [general, sql, columnFilter, generated] = expanded
		assert.equal(generated === '—', columnFilter === '—', 'Unpaired column input and report at line ' + lineNumber)
		assert.ok(general !== '—' || columnFilter !== '—', 'No input to test at line ' + lineNumber)
		rows.push({ columnFilter, general, generated, lineNumber, section, sql })
		previous = expanded
	}
	assert.ok(rows.length, 'No SQL examples found in the Markdown specification')
	return rows
}

function formFields(columnFilter)
{
	const entries = columnFilter.split(/(?<=`|Champ laissé vide)\s*<br\s*\/?>\s*/i)
	const fields = Object.fromEntries(entries.map(entry => {
		const [, name, input] = /^([^:]+): (.+)$/.exec(entry) ?? []
		assert.ok(name, 'Expected a column name and a value: ' + entry)
		assert.ok(Object.hasOwn(columnPaths, name), 'Unknown documented column: ' + name)
		return ['search.' + columnPaths[name], input === 'Champ laissé vide' ? '' : inlineCode(input)]
	}))
	assert.equal(Object.keys(fields).length, entries.length, 'Duplicate column in ' + columnFilter)
	return fields
}

function generalFromColumns(data)
{
	const pathOf = field => resolveSearchField(Film, field, false)?.path ?? field
	let text = ''
	for (const [name, value] of Object.entries(data)) {
		const path = name.slice('search.'.length)
		const field = resolveSearchField(Film, path, false)?.field ?? path
		text = editColumnCriterion(text, path, field, value, pathOf)
	}
	return text
}

// Ignore the order of AND/OR siblings while retaining precedence and BETWEEN bounds.
function predicateKey(sql)
{
	const operators = []
	let depth = 0
	let range = false
	for (const { 0: token, index } of sql.matchAll(sqlToken)) {
		if (token === '(') {
			depth ++
		}
		else if (token === ')') {
			depth --
			if (!depth && sql.startsWith('(') && index === sql.length - 1 && !operators.length) {
				return predicateKey(sql.slice(1, -1).trim())
			}
		}
		else if (!depth && !token.startsWith("'")) {
			if (token === 'BETWEEN') {
				range = true
			}
			else if (token === 'AND' && range) {
				range = false
			}
			else {
				operators.push({ index, token })
			}
		}
	}
	if (!operators.length) return sql

	const separator = operators.some(({ token }) => token === 'OR') ? 'OR' : 'AND'
	const operands  = []
	let start = 0
	for (const { index, token } of operators) {
		if (token !== separator) continue
		operands.push(predicateKey(sql.slice(start, index).trim()))
		start = index + token.length
	}
	operands.push(predicateKey(sql.slice(start).trim()))
	return '(' + operands.sort().join(' ' + separator + ' ') + ')'
}

function quotedParameter(value)
{
	if (typeof value === 'number') return String(value)
	if (value instanceof Date) {
		const pad  = number => String(number).padStart(2, '0')
		const day  = [value.getFullYear(), value.getMonth() + 1, value.getDate()].map(pad).join('-')
		const time = [value.getHours(), value.getMinutes(), value.getSeconds()].map(pad).join(':')
		const milliseconds = String(value.getMilliseconds()).padStart(3, '0')
		return "TIMESTAMP '" + day + ' ' + time + '.' + milliseconds + "'"
	}
	assert.equal(typeof value, 'string', 'Expected a number, string or Date SQL parameter')
	return "'" + value.replaceAll('\\', '\\\\').replaceAll("'", "''") + "'"
}

function assertSql(query, expected)
{
	const { sql, values } = query
	const where   = sql.match(/\nWHERE (.+?)(?=\nORDER BY|\nLIMIT|$)/s)?.[1] ?? ''
	const aliases = new Map([['t0', '']])
	assert.match(sql, /\nFROM `film` AS `t0`/)
	for (const [join, table, alias] of sql.matchAll(/^.*\bJOIN `([^`]+)` AS `(t\d+)`.*$/gm)) {
		assert.equal(join, 'LEFT JOIN `' + table + '` AS `' + alias
			+ '` ON `t0`.`' + table + '_id` = `' + alias + '`.`id`')
		aliases.set(alias, table + '.')
	}

	let parameter = 0
	const actual = where.replace(/`(t\d+)`\./g, (_, alias) => {
		assert.ok(aliases.has(alias), 'Missing join for ' + alias)
		return aliases.get(alias)
	}).replace(/`([a-z_]+)`/g, '$1').replace(/\?/g, () => quotedParameter(values[parameter ++]))
	const expectedCount = [...expected.matchAll(/'(?:''|\\.|[^'\\])*'|1 = 0|-?\d+(?:\.\d+)?/g)]
		.filter(([token]) => token !== '1 = 0').length
	assert.equal(parameter, values.length, 'Each generated placeholder must have a parameter')
	assert.equal(values.length, expectedCount, 'All documented operands must be bound parameters')

	const typed = expected.replace(sqlLiteral, literal => dateTime.test(literal) ? 'TIMESTAMP ' + literal : literal)
	assert.equal(predicateKey(actual), predicateKey(typed))
}

function assertSearch(data, expected)
{
	const filter = new SearchFilter(columns, new ListQuery())
	if (Object.hasOwn(rejections, expected)) {
		assert.throws(() => filter.getParams({ data }, Film), error =>
			error instanceof InvalidListQuery && rejections[expected].test(error.message))
		return
	}

	filter.getParams({ data }, Film)
	const condition = filter.searchObject(Film)
	const where     = expected === 'Aucune condition' ? '' : inlineCode(expected)
	assertSql(new Count(schema, condition).build(), where)
	assertSql(new Select(schema, ['title'], condition).buildProjection(), where)
}

test('SQL examples in the filter specification', async context => {
	// Run this file in an isolated process so reflected Date types use the same clock as the filters.
	process.env.TZ = 'Europe/Paris'
	context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-27T12:00:00+01:00') })
	trInit('fr-FR')
	for (const [english, french] of [
		['added', 'ajouté'], ['director', 'réalisateur'], ['empty', 'vide'], ['first name', 'prénom'],
		['last name', 'nom'], ['name', 'nom'], ['title', 'titre'], ['watch count', 'nombre de vues']
	]) {
		translations.set(english, french)
	}
	sqlJoinDependsOn({
		multiplicityOf: () => 'one',
		relationshipOf: (_table, name) => ({
			leftColumn: name + '_id', rightColumn: 'id', multiplicity: 'one', optional: true
		})
	})
	for (const { columnFilter, general, generated, lineNumber, section, sql } of documentedRows()) {
		const name = section + ', line ' + lineNumber
		if (general !== '—') {
			await context.test(name + ', general filter: ' + general, () => {
				const listQuery = general === 'Champ laissé vide' ? '' : inlineCode(general)
				assertSearch({ listQuery, listQuerySync: '1' }, sql)
			})
		}
		if (columnFilter !== '—') {
			const data = formFields(columnFilter)
			await context.test(name + ', generated general filter: ' + columnFilter, () => {
				assert.equal(generalFromColumns(data), generated === 'Filtre vide' ? '' : inlineCode(generated))
			})
			await context.test(name + ', column filter: ' + columnFilter, () => {
				assertSearch(data, sql)
			})
		}
	}
})

import type { Type }           from '@itrocks/class-type'
import { displayOf }           from '@itrocks/property-view'
import { ReflectClass }        from '@itrocks/reflect'
import { PropertyPathError }   from '@itrocks/reflect-path'
import { resolvePropertyPath } from '@itrocks/reflect-path'
import { tr }                  from '@itrocks/translate'
import { distance }            from 'fastest-levenshtein'

type PropertyName = { aliases: string[]; label: string; name: string }
type SearchField  = { field: string; path: string }

function exactProperty(properties: readonly PropertyName[], part: string): PropertyName | undefined
{
	const name = properties.find(property => property.name === part)
	if (name) return name

	const key     = normalise(part)
	const matches = properties.filter(property => property.aliases.includes(key))
	return (matches.length === 1) ? matches[0] : undefined
}

function matchProperty(properties: readonly PropertyName[], part: string, approximate: boolean)
	: PropertyName | undefined
{
	const exact = exactProperty(properties, part)
	if (exact || !approximate) return exact

	const key = normalise(part)
	if (!key || /^[!-]/.test(key) || properties.some(property => property.aliases.includes(key))) return

	const prefixes = properties.filter(property => property.aliases.some(alias => alias.startsWith(key)))
	if (prefixes.length) return (prefixes.length === 1) ? prefixes[0] : undefined

	const limit = Math.min(2, Math.floor(key.length / 4))
	let best    = limit + 1
	let match: PropertyName | undefined
	for (const property of properties) {
		const score = Math.min(...property.aliases
			.filter(alias => Math.abs(alias.length - key.length) <= limit)
			.map(alias => distance(alias, key)))
		if (score > limit || score > best) continue
		match = (score < best) ? property : undefined
		best  = score
	}
	return match
}

function normalise(name: string): string
{
	return name.normalize().toLocaleLowerCase()
}

function propertyNames(type: Type): PropertyName[]
{
	return Object.keys(new ReflectClass(type).propertyTypes).map(name => {
		const english = displayOf(type, name as never) || name
		const label   = tr(english).toLocaleLowerCase()
		return { aliases: [name, english, label].map(normalise), label, name }
	})
}

export function resolveSearchField(type: Type, field: string, approximate = true): SearchField | undefined
{
	const parts  = field.split('.')
	const labels = new Array<string>()
	const names  = new Array<string>()
	let context  = type
	for (const [index, part] of parts.entries()) {
		if (!part) return
		const properties = propertyNames(context)
		const match      = matchProperty(properties, part, approximate)
		if (!match) return
		names.push(match.name)
		labels.push(
			!match.label.includes('.') && exactProperty(properties, match.label) === match ? match.label : match.name
		)
		try {
			const { target } = resolvePropertyPath(context, match.name)
			if (index === parts.length - 1) continue
			if (!target) return
			context = target
		}
		catch (error) {
			if (!(error instanceof PropertyPathError)) throw error
			return
		}
	}
	return { field: labels.join('.'), path: names.join('.') }
}

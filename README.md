[![npm version](https://img.shields.io/npm/v/@itrocks/list-filter?logo=npm)](https://www.npmjs.org/package/@itrocks/list-filter)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/list-filter)](https://www.npmjs.org/package/@itrocks/list-filter)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/list-filter?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/list-filter)
[![issues](https://img.shields.io/github/issues/itrocks-ts/list-filter)](https://github.com/itrocks-ts/list-filter/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# list-filter

Editable search filters for object lists.

## Usage

The package configuration composes the list action from [@itrocks/list](https://github.com/itrocks-ts/list)
with the exported `ListWithFilters` action. For a local checkout, build `@itrocks/list` first, then run
`npm run build` in this package. The following local application configuration activates it directly.

```yaml
compose:
  '@itrocks/list': '@itrocks/list-filter'
  '@itrocks/list:List': '@itrocks/list-filter:ListWithFilters'
```

Click the filter icon in the list toolbar to focus the editor at the end of the query.
While the editor has focus, click the icon or press Enter to apply a complete query.
After the search, the editor regains focus at the caret position.
Six trailing spaces extend the editor's clickable area and are underlined on hover or focus.
The editor grows with the query and scrolls horizontally when space runs out.
The editor displays field names in the request language and stores their canonical property paths.
Operators, value spelling and spacing are preserved.
The general editor and the column filters submit together. Editing either updates the other as you type.
A column edit replaces the criteria for that property path with its raw column expression.
An OR between different fields stays in the general editor. A criterion also stays there when column syntax
would change its meaning.
The list's reset button clears both editors and focuses the general editor.
Apply the empty query to refresh the list.

Named lists save the query with their other settings. On submission, the stored expression uses English property
paths in alphabetical order. The editor displays fields in the request language and sorts them in that language.

## Search reference

The general filter combines named fields. The column filter applies the entered expression to one field.

See the [search filter guide](docs/search-filter-guide.md) for syntax and examples.

## API

`parseSearch(text, locale = 'en')`, exported from
`@itrocks/list-filter/syntax` and the browser subpath `/syntax.js`,
returns the recognised criteria and their UTF-16 positions in the original text. Each criterion has a
normalised operator, decoded field and value, and offsets for the whole criterion, field, separator end and value.
The parser marks criteria written with a colon using `columnSyntax` and keeps grouped column expressions in `column`.
Pass the editor language as `locale` to recognise its local equivalents of `and` and `or`.
A result may have an `error` offset or an `incomplete` flag at the end of input.

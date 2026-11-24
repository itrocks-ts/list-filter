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
The focused editor reserves space for about eight characters.
The editor grows with the query and scrolls horizontally when space runs out.
The editor displays field names in the request language and stores their canonical property paths.
Operators, value spelling and spacing are preserved.
The general editor and the column filters submit together. Editing either updates the other as you type.
A column edit replaces the criteria for that property path with its raw column expression.
An OR between different fields stays in the general editor. A criterion also stays there when column syntax
would change its meaning.
The list's reset action clears both.

Named lists save the query with their other settings. On submission, the stored expression uses English property
paths in alphabetical order. The editor displays fields in the request language and sorts them in that language.

## Syntax

```text
query      = AND groups separated by | or ,
AND group  = terms separated by spaces, & or +
term       = criterion or a parenthesised query
criterion  = [negation] field separator value
negation   = !  -  !=  <>
separator  = :  =  !=  ≠  <>  >  <  >=  <=
field      = property name or label, optionally followed by dot-separated segments
value      = a word or a quoted string
```

- Use property paths such as `studio.name`, English field labels or labels in the current language.
  Fields also work when their columns are hidden.
- Enter a separator to localise a field name or complete a unique prefix. If no prefix matches, spelling correction
  accepts a unique closest name within one edit for 4–7 characters or two edits for 8 or more.
- Spaces, `&` and `+` between criteria mean AND. `|` and `,` mean OR. AND takes precedence.
  Use parentheses to group criteria and quotes when a separator belongs to the value.
- Spaces around a field separator are optional, as in `title : 1900` or `year >= 1978`.
- `title:(1900*,Other)` uses the complete column grammar inside the parentheses, including wildcard, range,
  comparison, grouping and escaped character syntax.
- Use single or double quotes around a field, path segment or value containing spaces, as in `'nombre de vues'>=8`.
  Quotes are optional for a single word. Within quotes, a backslash escapes the matching quote or another backslash.
- `title:1900` matches the start of a title. `title=1900` matches the whole value.
- `!title:1900`, `-title:1900`, `!=title:1900`, `<>title:1900`, `title!=1900`, `title≠1900`,
  `title<>1900` and `title:!1900` all mean different from `1900`.
- With `:`, a leading operator can precede the value, including inside its quotes.
  For example, `year:>=1970` and `year:">=1970"` are equivalent to `year>=1970`.
  An explicit operator or negation makes leading symbols part of the value. For example,
  `title="!A New Hope"` compares the full title including the exclamation mark.
- An unfinished field, value or quote can be completed in place. The editor marks the first unexpected character
  in red and gives unexpected whitespace a solid red background.

## API

`parseSearch(text)`, exported from `@itrocks/list-filter/syntax` and the browser subpath `/syntax.js`,
returns the recognised criteria and their UTF-16 positions in the original text. Each criterion has a
normalised operator, decoded field and value, and offsets for the whole criterion, field, separator end and value.
A result may have an `error` offset or an `incomplete` flag at the end of input.

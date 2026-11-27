# General search filter

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

Open the filter in the list toolbar, enter a search and press Enter to apply it.
A criterion consists of a field name, a separator and a value. You can search hidden fields.
To filter a single column, enter the value expression beneath its heading.

## Enter and compare values

| General filter | What it finds |
| --- | --- |
| `title:Alien` | Text starting with Alien |
| `title=Alien` or `title:=Alien` | The whole title Alien |
| `!title:Alien`, `-title:Alien`, `title!Alien` or `title:!Alien` | Text that does not start with Alien |
| `!title=Alien`, `-title=Alien`, `title!=Alien`, `title<>Alien` or `title≠Alien` | Text that differs from the whole value Alien |
| `score>10` or `score>=10` | Above 10, or at least 10 |
| `score<10` or `score<=10` | Below 10, or at most 10 |
| `score:>=10` or `score:">=10"` | At least 10 |
| `"watch count">=8` or `watchCount>=8` | At least eight views |
| `studio.name:Fox` | A related studio whose name starts with Fox |

A field can be a property path, an English label or a label in the current language.
Quote names containing spaces, including segments in a dotted path. Single and double quotes both work.
Spaces around a field separator are optional, as in `score >= 10`.
Entering a separator can localise a field name, complete a unique prefix or correct a close spelling match.

## Use wildcards

With `:`, text matches from the start by default. An explicit wildcard sets the pattern.
`*` and `%` match zero or more characters. `?` and `_` match exactly one.

| General filter | What it finds |
| --- | --- |
| `title:*Alien*` or `title:%Alien%` | Alien anywhere in the title |
| `title:*Alien` | Titles ending in Alien |
| `title:A?B` or `title:A_B` | Exactly one character between A and B |
| `!title:*test*` | Titles without test anywhere |
| `title=100%` | The exact text 100%, including the percent sign |
| `title<>%Alien%` | Titles different from the literal text %Alien% |

## Search for a range or date

Closed ranges include both endpoints. You can omit one endpoint in an open range.
For slash-separated dates, follow the order displayed by the application.

| General filter | What it finds |
| --- | --- |
| `score:10-20` | From 10 through 20 |
| `score:10-` or `score:-20` | From 10 upwards, or up to 20 |
| `added:2020`, `added:03/2020` or `added:6` | A year, a month in a specific year, or June of the current year |
| `added:09/03/2020` or `added:2020-03-09` | 9 March 2020, using day/month/year in the first example |
| `added:01/03/2020-09/03/2020` | From 1 through 9 March 2020 |
| `added:2020-2022` | From 2020 through 2022 |
| `added>2020`, `added<=2020` or `added!=2020` | After 2020, through the end of 2020, or outside 2020 |
| `added:2020-03-__` or `added:20??` | Any day in March 2020, or any year from 2000 through 2099 |

## Find empty or populated fields

The word `empty` works with text, numbers, dates and relationships. In French, use `vide`.

| General filter | What it finds |
| --- | --- |
| `title=`, `title:` or `title=""` | An empty title string |
| `!title=`, `!title:` or `title!=` | A title with at least one character |
| `title:empty` or `!title:empty` | An empty title, or a populated title |
| `score:empty` or `!score:empty` | A missing optional score, or a populated score |
| `score!=10 or score:empty` | A score other than 10, including rows where the score is missing |
| `added:empty` or `!added:empty` | A missing date, or a populated date |
| `director:empty` or `!director:empty` | A missing related record, or a present related record |
| `director:Jean` | A related record that matches Jean in its representative fields |

A comparison such as `score!=10` omits SQL `NULL` values. Add a separate `score:empty` criterion to include them.

## Combine criteria and quote values

Use `and` or `or` between criteria, with spaces or grouping parentheses to delimit the word.
The words are case-insensitive.
The editor also recognises the equivalents for its language, such as `et` and `ou` in French.
The symbols `&` and `+`, as well as a space on its own, mean AND between criteria.
A comma or `|` between criteria means OR. AND takes precedence. Use parentheses to change the grouping.
After an empty criterion, a logical word followed by another criterion joins the two.
Quote the word when you want it as the value, as in `title="or"`.

| General filter | What it finds |
| --- | --- |
| `title:Alien and score>=10` | Both criteria |
| `title:Alien or studio.name:Fox` | Either criterion |
| `title= or score>=10` | An empty title or a score of at least 10 |
| `(title=)or(score>=10)` | An empty title or a score of at least 10 |
| `title=or score>=10` | The literal title or, with a score of at least 10 |
| `title:Alien or title:Predator and score>=10` | Alien, or Predator with the required score |
| `(title:Alien or title:Predator) and score>=10` | Either title with the required score |
| `title:Alien,Predator and score>=10` | The same two title alternatives and score requirement |
| `title:(Alien, Predator)` | Either title, with an explicit group around the value expression |
| `title:"Rock and Roll"` | A title starting with the phrase Rock and Roll |
| `title:"Rock & Roll"` | A title starting with the phrase Rock & Roll |
| `title:"The \"Great\" Escape"` | A title starting with The "Great" Escape |

For a list of bare values after `:`, join them with commas and omit the spaces around the commas.
A compact `|` also works. When the next term has its own field and separator, it starts a separate criterion.
Use `title:(...)` for a full column expression, including nested groups or alternatives containing spaces.
Within quotes, a backslash escapes the matching quote or another backslash.

### In a column filter

Enter the value expression alone. Use a comma for alternatives and `&` or `+` to require both conditions.
The words `and`, `or` and their local equivalents are part of the search value in this context.

| Column | Input | General-filter equivalent |
| --- | --- | --- |
| Title | `Alien, Predator` | `title:Alien,Predator` |
| Title | `Alien & *1979*` | `title:Alien and title:*1979*` |
| Title | `Rock and Roll` | `title:"Rock and Roll"` |

// Run with Node.js after installing this package's development dependencies.
// node docs/generate-search-cheatsheets.cjs
const { writeFile }                      = require('node:fs/promises')
const { join }                           = require('node:path')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')

const sheets = {
	fr: {
		title: 'Saisir le filtre de recherche',
		labels: ['À saisir', 'Ce que vous trouvez'],
		intro: 'Ouvrez le filtre dans la barre d’outils, puis appuyez sur Entrée pour appliquer la saisie. '
			+ 'Vous pouvez chercher dans un champ masqué.',
		full: [
			['Saisir et comparer', [
				['titre:Alien   studio.nom:Fox', 'Début du titre ou du nom du studio. Un point précise le champ lié.'],
				['titre=Alien   titre:=Alien', 'Titre entier « Alien ».'],
				[['!titre:Alien  -titre:Alien', 'titre!Alien   titre:!Alien'], 'Titres qui ne commencent pas par « Alien ».'],
				[
					['!titre=Alien  -titre=Alien', 'titre!=Alien  titre<>Alien', 'titre≠Alien   titre:!=Alien'],
					'Titres différents de la valeur entière « Alien ».'
				],
				[
					['score>10  score>=10  score:>=10', 'score<10  score<=10'],
					'Seuil strict ou inclus. Un opérateur peut remplacer les deux points.'
				],
				[
					['"nombre de vues">=8', "'watch count'>=8   watchCount>=8"],
					'Libellé français, libellé anglais ou nom de propriété. Citez les noms à espaces.'
				]
			]],
			['Utiliser des jokers', [
				['titre:*Alien*    titre:%Alien%', '« Alien » n’importe où. * et % remplacent zéro à plusieurs caractères.'],
				['titre:Alien*  titre:*Alien', 'Commence ou finit par « Alien ». Un joker explicite fixe le motif.'],
				['titre:A?B     titre:A_B', '? et _ remplacent un caractère.'],
				['!titre:*test*    titre=100%', 'Exclut « test » n’importe où. Avec =, le % est littéral.']
			]],
			['Chercher un intervalle ou une date', [
				[
					'score:10-20   score:10-   score:-20',
					'Intervalle inclusif, borne inférieure seule ou borne supérieure seule.'
				],
				[
					['ajouté:2020  ajouté:2020-03  ajouté:6', 'ajouté:2020-03-09   ajouté:09/03/2020'],
					'Année, mois ou jour. 6 désigne juin de l’année en cours. Avec /, suivez l’ordre affiché.'
				],
				[
					['ajouté:2020-2022', 'ajouté:01/03/2020-09/03/2020'],
					'De 2020 à 2022 ou du 1er au 9 mars inclus en jour/mois.'
				],
				[
					['ajouté>2020  ajouté<=2020', 'ajouté!=2020'],
					'Après 2020, au plus tard fin 2020 ou en dehors de 2020.'
				],
				['ajouté:2020-03-__   ajouté:20??', 'Tous les jours de mars 2020 ou les années de 2000 à 2099.']
			]],
			['Chercher le vide ou une valeur renseignée', [
				[
					['titre:   titre=   titre=""   titre:=', '!titre:   -titre:   !titre=   titre!='],
					'Chaîne vide sur la première ligne, texte différent de la chaîne vide sur la seconde.'
				],
				[
					['titre:vide   titre:!vide', 'score:vide   score:!vide'],
					'Vide ou renseigné. Le compteur facultatif teste NULL. En anglais, utilisez empty.'
				],
				['score!=10 | score:vide', 'Compteur différent de 10 ou absent. Les comparaisons seules ignorent les NULL.'],
				[
					['réalisateur:vide  !réalisateur:vide', 'réalisateur:Jean'],
					'Lien absent ou présent. Une valeur cherche dans les propriétés représentatives, ici nom et prénom.'
				],
				[
					'ajouté:vide   ajouté:!?   ajouté:?',
					'Date vide pour les deux premières formes, renseignée pour la troisième.'
				]
			]],
			['Combiner et protéger', [
				[
					['titre:Alien | titre:Predator', 'titre:(Alien, Predator)'],
					'L’un ou l’autre. La virgule et | signifient OU.'
				],
				[
					['titre:Alien score>=10', 'titre:Alien & score>=10', 'titre:Alien + score>=10'],
					'Un espace, & ou + signifie ET. Le ET passe avant le OU.'
				],
				[
					'(titre:Alien | titre:Predator) score>=10',
					'Les parenthèses imposent le groupe des titres avant de tester le score.'
				],
				[
					['titre:"Rock & Roll"', String.raw`titre:"Le \"Grand\" Bleu"`],
					'Citez les espaces et les signes de combinaison. Dans les guillemets, \\ protège " et \\.'
				]
			]]
		],
		minimal: [
			['Saisir et comparer', [
				['titre:Alien', 'Le titre commence par « Alien ».'],
				['titre=Alien', 'Le titre est exactement « Alien ».'],
				['!titre:Alien', 'Le titre ne commence pas par « Alien ».'],
				['!titre=Alien', 'Le titre diffère de la valeur entière « Alien ».'],
				['score>=10', 'Le score vaut au moins 10, seuil inclus.'],
				['"nombre de vues">=8', 'Citez un nom de champ qui contient des espaces.'],
				['studio.nom:Fox', 'Cherchez par le nom du studio, un champ lié.']
			]],
			['Utiliser des jokers', [
				['titre:*Alien*', '« Alien » n’importe où dans le titre. Le joker * remplace zéro ou plusieurs caractères.'],
				['titre:A?B', 'Un seul caractère entre A et B, par exemple A1B.']
			]],
			['Chercher un intervalle ou une date', [
				['score:10-20', 'De 10 à 20 inclus.'],
				['ajouté:03/2020', 'Tout mars 2020.'],
				['ajouté:09/03/2020', 'Le 9 mars 2020.'],
				['ajouté:01/03/2020-09/03/2020', 'Du 1er au 9 mars 2020 inclus.'],
				['ajouté:2020-2022', 'De 2020 à 2022 inclus.']
			]],
			['Chercher le vide ou une valeur renseignée', [
				['titre=', 'Le titre est une chaîne vide.'],
				['!titre=', 'Le titre contient au moins un caractère.'],
				['score:vide', 'Le score facultatif est absent. Le mot vide vaut aussi pour les dates et liens.'],
				['!score:vide', 'Le score est renseigné.'],
				['score!=10 ou score:vide', 'Le score diffère de 10 ou il est absent.']
			]],
			['Combiner et protéger', [
				['titre:Alien ou titre:Predator', 'L’un ou l’autre des deux débuts de titre.'],
				['titre:Alien et score>=10', 'Les deux critères à la fois.'],
				[
					['(titre:Alien ou titre:Predator) et score>=10', 'titre:Alien,Predator et score>=10'],
					'Même résultat. Le score s’applique aux deux titres.'
				],
				['titre:"Rock & Roll"', 'Les guillemets gardent les espaces et le & dans le titre cherché.']
			]]
		]
	},
	en: {
		title: 'Enter a search filter',
		labels: ['Type this', 'What it finds'],
		intro: 'Open the filter in the toolbar and press Enter to apply your search. You can search a hidden field.',
		full: [
			['Enter and compare values', [
				[
					'title:Alien   studio.name:Fox',
					'Start of the title or studio name. A dot selects a field on the related object.'
				],
				['title=Alien   title:=Alien', 'The whole title “Alien”.'],
				[['!title:Alien  -title:Alien', 'title!Alien   title:!Alien'], 'Titles that do not start with “Alien”.'],
				[
					['!title=Alien  -title=Alien', 'title!=Alien  title<>Alien', 'title≠Alien   title:!=Alien'],
					'Titles whose whole value differs from “Alien”.'
				],
				[
					['score>10  score>=10  score:>=10', 'score<10  score<=10'],
					'Strict or inclusive threshold. A comparison can replace the colon.'
				],
				[['"watch count">=8', 'watchCount>=8'], 'Field label or property name. Quote field names containing spaces.']
			]],
			['Use wildcards', [
				['title:*Alien*    title:%Alien%', '“Alien” anywhere. * and % match zero or more characters.'],
				['title:Alien*  title:*Alien', 'Starts or ends with “Alien”. Explicit wildcards set the pattern.'],
				['title:A?B     title:A_B', '? and _ match one character.'],
				['!title:*test*    title=100%', 'Excludes “test” anywhere. With =, % is literal.']
			]],
			['Search for a range or date', [
				['score:10-20   score:10-   score:-20', 'Inclusive range, lower bound only, or upper bound only.'],
				[
					['added:2020  added:2020-03  added:6', 'added:2020-03-09   added:09/03/2020'],
					'Year, month or day. 6 is June this year. The slash example uses day/month order.'
				],
				[
					['added:2020-2022', 'added:01/03/2020-09/03/2020'],
					'2020 through 2022, or 1 through 9 March in day/month order.'
				],
				[['added>2020  added<=2020', 'added!=2020'], 'After 2020, up to the end of 2020, or outside 2020.'],
				['added:2020-03-__   added:20??', 'Every day in March 2020, or the years 2000 to 2099.']
			]],
			['Find empty or populated fields', [
				[
					['title:   title=   title=""   title:=', '!title:   -title:   !title=   title!='],
					'Empty text on the first line, text other than the empty string on the second.'
				],
				[
					['title:empty   title:!empty', 'score:empty   score:!empty'],
					'Empty or populated. For an optional number, this checks for NULL.'
				],
				['score!=10 | score:empty', 'A score other than 10 or missing. Comparisons alone omit NULL values.'],
				[
					['director:empty   !director:empty', 'director:Jean'],
					'Missing or present link. A value searches the representative fields, here surname and first name.'
				],
				['added:empty   added:!?   added:?', 'The first two find empty dates. The third finds populated dates.']
			]],
			['Combine and quote conditions', [
				[['title:Alien | title:Predator', 'title:(Alien, Predator)'], 'Either one. The comma and | mean OR.'],
				[
					['title:Alien score>=10', 'title:Alien & score>=10', 'title:Alien + score>=10'],
					'A space, & or + means AND. AND takes precedence over OR.'
				],
				[
					'(title:Alien | title:Predator) score>=10',
					'Parentheses group the title choices before the score is checked.'
				],
				[
					['title:"Rock & Roll"', String.raw`title:"The \"Great\" Escape"`],
					'Quote spaces and grouping signs. Within double quotes, \\ escapes " and \\.'
				]
			]]
		],
		minimal: [
			['Enter and compare values', [
				['title:Alien', 'The title starts with “Alien”.'],
				['title=Alien', 'The whole title is “Alien”.'],
				['!title:Alien', 'The title does not start with “Alien”.'],
				['!title=Alien', 'The whole title differs from “Alien”.'],
				['score>=10', 'The score is at least 10, including 10.'],
				['"watch count">=8', 'Quote a field name containing spaces.'],
				['studio.name:Fox', 'Search by the studio name, a field on the related object.']
			]],
			['Use wildcards', [
				['title:*Alien*', '“Alien” anywhere in the title. An asterisk matches zero or more characters.'],
				['title:A?B', 'Exactly one character between A and B, for example A1B.']
			]],
			['Search for a range or date', [
				['score:10-20', 'From 10 to 20 inclusive.'],
				['added:03/2020', 'All of March 2020.'],
				['added:09/03/2020', '9 March 2020 (day/month/year).'],
				['added:01/03/2020-09/03/2020', 'From 1 through 9 March 2020.'],
				['added:2020-2022', 'From 2020 through 2022.']
			]],
			['Find empty or populated fields', [
				['title=', 'The title is an empty string.'],
				['!title=', 'The title contains at least one character.'],
				['score:empty', 'The optional score is missing. Use empty for a date or link too.'],
				['!score:empty', 'The score is populated.'],
				['score!=10 or score:empty', 'The score differs from 10 or is missing.']
			]],
			['Combine and quote conditions', [
				['title:Alien or title:Predator', 'Either title prefix.'],
				['title:Alien and score>=10', 'Both conditions.'],
				[
					['(title:Alien or title:Predator) and score>=10', 'title:Alien,Predator and score>=10'],
					'Same result. The score applies to both titles.'
				],
				['title:"Rock & Roll"', 'Double quotes keep the spaces and & inside the title you search for.']
			]]
		]
	}
}

const basename    = 'search-filter-cheatsheet'
const packageName = '@itrocks/list-filter'

const pageSize = [595.28, 841.89]
const margin   = 36
const layouts  = {
	full:    { codeSize: 9.25, inputWidth: 247, lineHeight: 10.8, rowGap: 2.6, sectionGap: 14, textSize: 9.5 },
	minimal: { codeSize: 10.1, inputWidth: 282, lineHeight: 12.8, rowGap: 4.6, sectionGap: 18, textSize: 10.6 }
}
const edition = {
	en: { full: 'Complete reference', minimal: 'Essentials' },
	fr: { full: 'Fiche complète', minimal: 'L’essentiel' }
}
const ink        = rgb(0.12, 0.19, 0.20)
const accent     = rgb(0.05, 0.32, 0.29)
const rule       = rgb(0.82, 0.86, 0.85)
const tint       = rgb(0.93, 0.96, 0.95)

function wrap(text, font, size, width)
{
	const lines = []
	let line = ''
	for (const word of text.split(' ')) {
		const next = line ? line + ' ' + word : word
		if (line && font.widthOfTextAtSize(next, size) > width) {
			lines.push(line)
			line = word
		}
		else {
			line = next
		}
	}
	return [...lines, line]
}

function wrapSentences(text, font, size, width, segmenter, separate)
{
	if (separate) {
		return Array.from(segmenter.segment(text))
			.flatMap(({ segment }) => wrap(segment.trim(), font, size, width))
	}

	const lines = []
	let rest    = wrap(text, font, size, width)
	let start   = 0
	for (const { index } of segmenter.segment(text)) {
		if (!index) continue
		const before = wrap(text.slice(start, index).trim(), font, size, width)
		const after  = wrap(text.slice(index).trimStart(), font, size, width)
		if (before.length + after.length > rest.length) continue
		lines.push(...before)
		rest  = after
		start = index
	}
	return [...lines, ...rest]
}

function drawExample(page, example, x, y, fonts, { codeSize, inputWidth })
{
	const runs = example.split(/(≠)/).filter(Boolean).map(text => ({
		font: text === '≠' ? fonts.symbol : fonts.code,
		text
	}))
	for (const { font, text } of runs) {
		page.drawText(text, { x, y, font, size: codeSize, color: ink })
		x += font.widthOfTextAtSize(text, codeSize)
	}
	if (x > margin + inputWidth) throw new Error(`Example is too wide: ${example}`)
}

async function render(language, sheet, variant)
{
	const pdf = await PDFDocument.create({ updateMetadata: false })
	const segmenter = new Intl.Segmenter(language, { granularity: 'sentence' })
	pdf.setLanguage(language)
	pdf.setTitle(sheet.title + ' - ' + edition[language][variant])

	const fonts = {
		body:   await pdf.embedFont(StandardFonts.Helvetica),
		bold:   await pdf.embedFont(StandardFonts.HelveticaBold),
		code:   await pdf.embedFont(StandardFonts.Courier),
		symbol: await pdf.embedFont(StandardFonts.Symbol)
	}
	const page   = pdf.addPage(pageSize)
	const layout = layouts[variant]
	const { inputWidth, lineHeight, rowGap, sectionGap, textSize } = layout
	const width  = page.getWidth() - 2 * margin
	const bodyX  = margin + inputWidth + 9
	let   y      = page.getHeight() - 46
	page.drawText(sheet.title, { x: margin, y, font: fonts.bold, size: 26, color: ink })

	y -= 19
	page.drawText(edition[language][variant], { x: margin, y, font: fonts.bold, size: 11, color: accent })
	y -= 17
	for (const line of wrap(sheet.intro, fonts.body, 10.5, width)) {
		page.drawText(line, { x: margin, y, font: fonts.body, size: 10.5, color: ink })
		y -= 13
	}

	y -= 7
	page.drawRectangle({ x: margin, y: y - 9, width, height: 19, color: tint })
	page.drawText(sheet.labels[0], { x: margin + 7, y: y - 2, font: fonts.bold, size: 9, color: accent })
	page.drawText(sheet.labels[1], { x: bodyX, y: y - 2, font: fonts.bold, size: 9, color: accent })
	y -= 12

	for (const [heading, rows] of sheet[variant]) {
		y -= sectionGap
		page.drawText(heading, { x: margin, y, font: fonts.bold, size: 12, color: accent })
		y -= 4

		for (const [examples, explanation] of rows) {
			const code = Array.isArray(examples) ? examples : [examples]
			const body = wrapSentences(
				explanation, fonts.body, textSize, width - inputWidth - 9, segmenter, variant === 'minimal'
			)
			page.drawLine({
				start: { x: margin, y },
				end: { x: margin + width, y },
				thickness: 0.45,
				color: rule
			})
			code.forEach((line, index) => drawExample(page, line, margin + 7, y - 11 - index * lineHeight, fonts, layout))
			body.forEach((line, index) => page.drawText(line, {
				x: bodyX, y: y - 11 - index * lineHeight, font: fonts.body, size: textSize, color: ink
			}))
			y -= Math.max(code.length, body.length) * lineHeight + rowGap
		}
	}

	if (y < 45) throw new Error(`Content exceeds one A4 page: ${language}/${variant} (${y.toFixed(1)} pt)`)
	page.drawText(packageName, { x: margin, y: 24, font: fonts.body, size: 8, color: accent })

	const suffix   = variant === 'minimal' ? '.minimal' : ''
	const filename = join(__dirname, `${basename}${suffix}.${language}.pdf`)
	await writeFile(filename, await pdf.save())
}

Promise.all(Object.entries(sheets).flatMap(([language, sheet]) =>
	Object.keys(layouts).map(variant => render(language, sheet, variant))
))
	.catch(error => {
		console.error(error.message)
		process.exitCode = 1
	})

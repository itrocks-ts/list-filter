// Run with Node.js after installing this package's development dependencies.
// node docs/generate-search-cheatsheets.cjs
const { writeFile }                      = require('node:fs/promises')
const { join }                           = require('node:path')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')

const sheets = {
	fr: {
		title: 'Saisir le filtre de recherche',
		intro: [
			'Dans la barre d’outils, cliquez sur l’icône de filtre. Saisissez le nom du champ et le critère, puis'
			+ ' appuyez sur Entrée. Les champs masqués restent accessibles.',
			'La forme champ:(...) reprend la saisie en colonne, avec ses jokers, intervalles et mots-clés.'
		],
		labels: ['À saisir', 'Ce que vous trouvez'],
		sections: [
			['Saisir et comparer', [
				[
					'titre:Alien   studio.nom:Fox',
					'Le texte qui commence par la valeur saisie. Un point permet de préciser le champ, ici le nom du'
					+ ' studio.'
				],
				['titre=Alien', 'La valeur entière « Alien ». Pour chercher le titre exact « !Alien », tapez titre="!Alien".'],
				[
					['score>10   score>=10', 'score<10   score<=10'],
					'Plus grand, au moins, plus petit, au plus. score:>=10 fonctionne aussi.'
				],
				[
					['titre!=Alien   titre<>Alien', 'titre≠Alien   titre:!Alien'],
					'Les valeurs différentes de « Alien ». Vous pouvez aussi commencer le critère par !, -, != ou <>,'
					+ ' comme dans !titre:Alien.'
				]
			]],
			['Remplacer des caractères', [
				['titre:(*Alien*)', 'Le texte qui contient « Alien ». * remplace zéro, un ou plusieurs caractères.'],
				['titre:(A?B)', 'Un seul caractère à la place de ?, comme dans A1B ou A2B.'],
				['titre:(!*test*)', 'Le texte qui ne contient pas « test ».']
			]],
			['Chercher un intervalle ou une date', [
				[
					['score:(10-20)', 'score:(10-)   score:(-20)'],
					'De 10 à 20, à partir de 10, ou jusqu’à 20. Les bornes sont incluses.'
				],
				[['ajouté:2020   ajouté:2020-03', 'ajouté:6'], 'Toute l’année 2020, mars 2020, ou juin de l’année en cours.'],
				[
					['ajouté:2020-03-09', 'ajouté:09/03/2020'],
					'Le 9 mars 2020. L’exemple avec / est en jour/mois. Avec / ou sans séparateurs, suivez l’ordre affiché'
					+ ' dans la liste.'
				],
				[
					['ajouté:(2020-2022)', 'ajouté:(01/03/2020-09/03/2020)'],
					'De 2020 à 2022, ou du 1er au 9 mars inclus en jour/mois. Pour omettre une borne, tapez par exemple'
					+ ' ajouté:(2020-).'
				],
				[['ajouté>2020   ajouté<=2020', 'ajouté!=2020'], 'Après 2020, jusqu’à fin 2020, ou en dehors de 2020.'],
				[
					'ajouté:2020-03-??   ajouté:20??',
					'Tous les jours de mars 2020, ou les années de 2000 à 2099. Pour les dates, % peut aussi s’utiliser'
					+ ' comme *.'
				]
			]],
			['Chercher une valeur vide', [
				[
					'titre:(vide)   titre:(!vide)',
					'Une valeur vide ou renseignée. En anglais, écrivez empty ou !empty dans les parenthèses.'
				],
				['titre=""   titre=vide', 'Un texte sans aucun caractère, ou le mot « vide » lui-même.'],
				['ajouté!=?   ajouté:?', 'Une date vide ou renseignée.']
			]],
			['Combiner et protéger', [
				['titre:Alien | titre:Predator', 'L’un ou l’autre. La virgule et | signifient OU.'],
				['titre:Alien score>=10', 'Les deux à la fois. Un espace, & ou + signifie ET et passe avant OU.'],
				[
					'(titre:Alien | titre:Predator) score>=10',
					'Les parenthèses regroupent les choix. Ici, l’un des deux débuts de titre avec un score d’au moins 10.'
				],
				[
					['titre:"Rock & Roll"', "'nombre de vues'>=8"],
					'Les guillemets simples ou doubles entourent les champs et valeurs contenant des espaces ou des signes'
					+ ' de combinaison.'
				],
				[
					[String.raw`titre:"Le \"Grand\" Bleu"`, String.raw`titre:"A\\B"`],
					'Entre guillemets, le signe \\ protège le guillemet utilisé et \\. Dans champ:(...), suivez les règles'
					+ ' des colonnes.'
				]
			]]
		]
	},
	en: {
		title: 'Enter a search filter',
		intro: [
			'Click the filter icon in the toolbar. Type a field name and its condition, then press Enter. You can'
			+ ' search a field even if its column is hidden.',
			'Use field:(...) to enter a column-style search with its wildcards, ranges, and keywords.'
		],
		labels: ['Type this', 'What it finds'],
		sections: [
			['Enter and compare values', [
				[
					'title:Alien   studio.name:Fox',
					'Text starting with the value you type. A dot lets you pick a more specific field, here the studio'
					+ ' name.'
				],
				[
					'title=Alien',
					'The whole value “Alien”. An explicit = also lets you match a leading sign, as in title="!Alien".'
				],
				[
					['score>10   score>=10', 'score<10   score<=10'],
					'Greater than, at least, less than, or at most. score:>=10 also works.'
				],
				[
					['title!=Alien   title<>Alien', 'title≠Alien   title:!Alien'],
					'Values other than “Alien”. You can also start the condition with !, -, !=, or <>, as in !title:Alien.'
				]
			]],
			['Replace characters with wildcards', [
				['title:(*Alien*)', 'Text containing “Alien”. * stands for zero, one, or several characters.'],
				['title:(A?B)', 'Exactly one character in place of ?, as in A1B or A2B.'],
				['title:(!*test*)', 'Text without “test”.']
			]],
			['Search for a range or date', [
				[
					['score:(10-20)', 'score:(10-)   score:(-20)'],
					'From 10 to 20, from 10 onward, or up to 20. Both ends are included.'
				],
				[['added:2020   added:2020-03', 'added:6'], 'All of 2020, March 2020, or June of the current year.'],
				[
					['added:2020-03-09', 'added:09/03/2020'],
					'9 March 2020. The slash example uses day/month order. With slashes or no separators, follow the order'
					+ ' shown in the list.'
				],
				[
					['added:(2020-2022)', 'added:(01/03/2020-09/03/2020)'],
					'2020 through 2022, or 1 through 9 March in day/month order. Leave one end open with added:(2020-),'
					+ ' for example.'
				],
				[['added>2020   added<=2020', 'added!=2020'], 'After 2020, up to the end of 2020, or outside 2020.'],
				[
					'added:2020-03-??   added:20??',
					'Every day in March 2020, or the years 2000 to 2099. For dates, % also works like *.'
				]
			]],
			['Find empty values', [
				[
					'title:(empty)   title:(!empty)',
					'A blank or filled-in value. In French, use vide or !vide inside the parentheses.'
				],
				['title=""   title=empty', 'Text with zero characters, or the word “empty” itself.'],
				['added!=?   added:?', 'A blank or filled-in date.']
			]],
			['Combine and quote conditions', [
				['title:Alien | title:Predator', 'Either one. The comma and | mean OR.'],
				['title:Alien score>=10', 'Both at once. A space, & or + means AND and is applied before OR.'],
				[
					'(title:Alien | title:Predator) score>=10',
					'Parentheses group the choices. Here, either title prefix with a score of at least 10.'
				],
				[
					['title:"Rock & Roll"', "'watch count'>=8"],
					'Single or double quotes surround fields and values with spaces or signs used to combine conditions.'
				],
				[
					[String.raw`title:"The \"Great\" Escape"`, String.raw`title:"A\\B"`],
					'Inside quotes, a backslash protects the matching quote and \\. Inside field:(...), use the column'
					+ ' rules.'
				]
			]]
		]
	}
}

const basename    = 'search-filter-cheatsheet'
const packageName = '@itrocks/list-filter'

const pageSize   = [595.28, 841.89]
const margin     = 36
const inputWidth = 242
const lineHeight = 11.5
const textSize   = 9.75
const codeSize   = 9.55
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

function drawExample(page, example, x, y, fonts)
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

async function render(language, sheet)
{
	const pdf = await PDFDocument.create({ updateMetadata: false })
	pdf.setLanguage(language)
	pdf.setTitle(sheet.title)

	const fonts = {
		body:   await pdf.embedFont(StandardFonts.Helvetica),
		bold:   await pdf.embedFont(StandardFonts.HelveticaBold),
		code:   await pdf.embedFont(StandardFonts.Courier),
		symbol: await pdf.embedFont(StandardFonts.Symbol)
	}
	const page  = pdf.addPage(pageSize)
	const width = page.getWidth() - 2 * margin
	const bodyX = margin + inputWidth + 9
	let   y     = page.getHeight() - 62
	page.drawText(sheet.title, { x: margin, y, font: fonts.bold, size: 28, color: ink })

	y -= 25
	for (const paragraph of sheet.intro) {
		for (const line of wrap(paragraph, fonts.body, 11, width)) {
			page.drawText(line, { x: margin, y, font: fonts.body, size: 11, color: ink })
			y -= 14
		}
		y -= 3
	}

	y -= 7
	page.drawRectangle({ x: margin, y: y - 9, width, height: 19, color: tint })
	page.drawText(sheet.labels[0], { x: margin + 7, y: y - 2, font: fonts.bold, size: 9, color: accent })
	page.drawText(sheet.labels[1], { x: bodyX, y: y - 2, font: fonts.bold, size: 9, color: accent })
	y -= 12

	for (const [heading, rows] of sheet.sections) {
		y -= 16
		page.drawText(heading, { x: margin, y, font: fonts.bold, size: 12, color: accent })
		y -= 4

		for (const [examples, explanation] of rows) {
			const code = Array.isArray(examples) ? examples : [examples]
			const body = wrap(explanation, fonts.body, textSize, width - inputWidth - 9)
			page.drawLine({
				start: { x: margin, y },
				end: { x: margin + width, y },
				thickness: 0.45,
				color: rule
			})
			code.forEach((line, index) => drawExample(page, line, margin + 7, y - 12 - index * lineHeight, fonts))
			body.forEach((line, index) => page.drawText(line, {
				x: bodyX, y: y - 12 - index * lineHeight, font: fonts.body, size: textSize, color: ink
			}))
			y -= Math.max(code.length, body.length) * lineHeight + 4
		}
	}

	if (y < 45) throw new Error(`Content exceeds one A4 page: ${language} (${y.toFixed(1)} pt)`)
	page.drawText(packageName, { x: margin, y: 24, font: fonts.body, size: 8, color: accent })

	const filename = join(__dirname, `${basename}.${language}.pdf`)
	await writeFile(filename, await pdf.save())
}

Promise.all(Object.entries(sheets).map(([language, sheet]) => render(language, sheet)))
	.catch(error => {
		console.error(error.message)
		process.exitCode = 1
	})

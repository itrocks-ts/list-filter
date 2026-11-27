# Équivalences SQL des filtres de liste

*Cette documentation a été rédigée par une intelligence artificielle et peut contenir des erreurs.
Elle n’a pas encore été relue intégralement par une personne. En cas de doute, contacte l’auteur du paquet.*

Chaque exemple présente le filtre général, son équivalent SQL, la saisie en colonne et le filtre général généré.
Chaque saisie occupe sa propre ligne dans la cellule « Filtre colonne ». Le report part d’un filtre vide et suit
l’ordre des saisies. Un `"` seul reprend la cellule précédente dans la même colonne. Un tiret long (`—`) marque
une cellule sans équivalent présenté. Un report incomplet apparaît tel qu’il est affiché pendant
la saisie. Dans la colonne SQL, `1 = 0` ne sélectionne aucune ligne.

Le SQL montre les paramètres en clair pour la lecture. Le moteur les transmet séparément. `titre` et `studio.nom`
sont des champs texte, `vues` est un nombre facultatif et `ajoute` est une date et heure. Les dates suivent le format
jour/mois et le fuseau Europe/Paris. L’exemple du mois seul utilise 2026 comme année courante.

`director`, affiché « Réalisateur », est une référence facultative fictive. La clé est `director_id` et les
propriétés représentatives sont `director.nom` et `director.prenom`, combinées avec `OR` pour une recherche
par valeur. Une recherche sur une propriété nommée, comme `réalisateur.nom`, porte sur cette propriété seule.

Une comparaison numérique ordinaire utilise un paramètre numérique lorsque la saisie représente un nombre.
Un motif avec jokers reste une chaîne. Les cas où un opérateur exact reçoit un motif montrent le paramètre
transmis tel quel, dont MySQL peut convertir la valeur selon le type de la colonne.

Les comparaisons, `BETWEEN`, `LIKE` et `NOT LIKE` n’incluent pas `NULL`. Pour un nombre ou une référence simple,
`vide` et `!vide` testent explicitement la présence d’une valeur. Sur du texte, `vide` utilise le motif `_%`
et exclut les valeurs SQL `NULL`. Pour les dates, le filtre de vide repose sur la sentinelle `0000-00-00`.
Les comparaisons à zéro excluent aussi les valeurs absentes. On peut ajouter explicitement `vide` avec `OU`.

Un nom de champ qui contient des espaces se met entre guillemets. Pour le nier, le signe `!` se place devant
le guillemet ouvrant. À l’intérieur, le signe fait partie du nom de champ recherché.

## Saisir et comparer

| Filtre général                | SQL équivalent                           | Filtre colonne                | Filtre général généré         |
| ----------------------------- | ---------------------------------------- | ----------------------------- | ----------------------------- |
| **Texte**                     |                                          |                               |                               |
| `titre:Alien`                 | `titre LIKE 'Alien%'`                    | Titre: `Alien`                | `titre:Alien`                 |
| `titre : Alien`               | "                                        | "                             | "                             |
| `titre:"Alien"`               | "                                        | "                             | "                             |
| `titre:'Alien'`               | "                                        | "                             | "                             |
| `"titre":Alien`               | "                                        | "                             | "                             |
| `'titre':Alien`               | "                                        | "                             | "                             |
| `title:Alien`                 | "                                        | Titre: `"Alien"`              | "                             |
| `studio.nom:Fox`              | `studio.nom LIKE 'Fox%'`                 | Nom du studio: `Fox`          | `studio.nom:Fox`              |
| `studio.name:Fox`             | "                                        | "                             | "                             |
| `"studio.nom":Fox`            | "                                        | "                             | "                             |
| `studio.'nom':Fox`            | "                                        | "                             | "                             |
| `titre=Alien`                 | `titre = 'Alien'`                        | Titre: `=Alien`               | `titre=Alien`                 |
| `titre:=Alien`                | "                                        | "                             | "                             |
| `titre="!Alien"`              | `titre = '!Alien'`                       | Titre: `=!Alien`              | `titre=!Alien`                |
| `titre=≠Alien`                | `titre = '≠Alien'`                       | Titre: `=≠Alien`              | `titre=≠Alien`                |
| `!titre:Alien`                | `titre NOT LIKE 'Alien%'`                | Titre: `!Alien`               | `!titre:Alien`                |
| `titre!Alien`                 | "                                        | "                             | "                             |
| `titre:!Alien`                | "                                        | "                             | "                             |
| `titre:"!Alien"`              | "                                        | "                             | "                             |
| `!titre : Alien`              | "                                        | "                             | "                             |
| `-titre:Alien`                | "                                        | Titre: `! Alien`              | "                             |
| `titre!=Alien`                | `titre <> 'Alien'`                       | Titre: `!=Alien`              | `titre!=Alien`                |
| `titre:!=Alien`               | "                                        | "                             | "                             |
| `titre:<>Alien`               | "                                        | "                             | "                             |
| `titre:≠Alien`                | "                                        | "                             | "                             |
| `!titre=Alien`                | "                                        | "                             | "                             |
| `-titre=Alien`                | "                                        | "                             | "                             |
| `titre<>Alien`                | "                                        | Titre: `<>Alien`              | `titre<>Alien`                |
| `titre≠Alien`                 | "                                        | Titre: `≠Alien`               | `titre≠Alien`                 |
| `titre:"!Alien Resurrection"` | `titre NOT LIKE 'Alien Resurrection%'`   | Titre: `!Alien Resurrection`  | `!titre:"Alien Resurrection"` |
| `titre:"Alien Resurrection"`  | `titre LIKE 'Alien Resurrection%'`       | Titre: `Alien Resurrection`   | `titre:"Alien Resurrection"`  |
| `titre:A-B`                   | `titre BETWEEN 'A' AND 'B'`              | Titre: `A-B`                  | `titre:A-B`                   |
| `titre=A-B`                   | `titre = 'A-B'`                          | Titre: `=A-B`                 | `titre=A-B`                   |
| **Numérique**                 |                                          |                               |                               |
| `"nombre de vues":10`         | `vues = 10`                              | Nombre de vues: `10`          | `"nombre de vues":10`         |
| `"watch count":10`            | "                                        | "                             | "                             |
| `'watch count':10`            | "                                        | "                             | "                             |
| `watchCount:10`               | "                                        | Nombre de vues: `=10`         | `"nombre de vues"=10`         |
| `'nombre de vues'=10`         | "                                        | "                             | "                             |
| `"nombre de vues":=10`        | "                                        | "                             | "                             |
| `"nombre de vues">10`         | `vues > 10`                              | Nombre de vues: `>10`         | `"nombre de vues">10`         |
| "                             | "                                        | Nombre de vues: `> 10`        | "                             |
| `"nombre de vues">=10`        | `vues >= 10`                             | Nombre de vues: `>=10`        | `"nombre de vues">=10`        |
| `"nombre de vues":>=10`       | "                                        | "                             | "                             |
| `"nombre de vues"<10`         | `vues < 10`                              | Nombre de vues: `<10`         | `"nombre de vues"<10`         |
| `"nombre de vues"<=10`        | `vues <= 10`                             | Nombre de vues: `<=10`        | `"nombre de vues"<=10`        |
| `"nombre de vues"!=10`        | `vues <> 10`                             | Nombre de vues: `!10`         | `!"nombre de vues":10`        |
| `"nombre de vues"!10`         | "                                        | Nombre de vues: `!=10`        | `"nombre de vues"!=10`        |
| `!"nombre de vues"=10`        | "                                        | "                             | "                             |
| `-"nombre de vues"=10`        | "                                        | "                             | "                             |
| `!"watch count"=10`           | "                                        | "                             | "                             |
| `"nombre de vues"=-10`        | `vues = -10`                             | Nombre de vues: `= -10`       | `"nombre de vues"=-10`        |
| `"!nombre de vues"=10`        | Champ inconnu                            | —                             | —                             |
| `"nombre de vues"=12.5`       | `vues = 12.5`                            | Nombre de vues: `=12.5`       | `"nombre de vues"=12.5`       |
| `"nombre de vues"=1.25e2`     | `vues = 125`                             | Nombre de vues: `=1.25e2`     | `"nombre de vues"=1.25e2`     |
| **Objet lié**                 |                                          |                               |                               |
| `réalisateur:Jean`            | `(director.nom LIKE 'Jean%' OR director.prenom LIKE 'Jean%')` | Réalisateur: `Jean`           | `réalisateur:Jean`            |
| `director:Jean`               | "                                        | "                             | "                             |
| `réalisateur=Jean`            | `(director.nom = 'Jean' OR director.prenom = 'Jean')` | Réalisateur: `=Jean`          | `réalisateur=Jean`            |
| `réalisateur.nom:Du`          | `director.nom LIKE 'Du%'`                | Nom du réalisateur: `Du`      | `réalisateur.nom:Du`          |
| `réalisateur.prénom:Jean`     | `director.prenom LIKE 'Jean%'`           | Prénom du réalisateur: `Jean` | `réalisateur.prénom:Jean`     |

## Remplacer des caractères

| Filtre général         | SQL équivalent                           | Filtre colonne         | Filtre général généré  |
| ---------------------- | ---------------------------------------- | ---------------------- | ---------------------- |
| **Texte**              |                                          |                        |                        |
| `titre:*Alien*`        | `titre LIKE '%Alien%'`                   | Titre: `*Alien*`       | `titre:*Alien*`        |
| `titre:%Alien%`        | "                                        | Titre: `%Alien%`       | `titre:%Alien%`        |
| `titre:Alien*`         | `titre LIKE 'Alien%'`                    | Titre: `Alien*`        | `titre:Alien*`         |
| `titre:*Alien`         | `titre LIKE '%Alien'`                    | Titre: `*Alien`        | `titre:*Alien`         |
| `titre:A?B`            | `titre LIKE 'A_B'`                       | Titre: `A?B`           | `titre:A?B`            |
| `titre:"A?B"`          | "                                        | Titre: `"A?B"`         | "                      |
| `titre:A_B`            | "                                        | Titre: `A_B`           | `titre:A_B`            |
| `titre:A*B?C`          | `titre LIKE 'A%B_C'`                     | Titre: `A*B?C`         | `titre:A*B?C`          |
| `titre:A%B_C`          | "                                        | Titre: `A%B_C`         | `titre:A%B_C`          |
| `titre:*`              | `titre LIKE '%'`                         | Titre: `*`             | `titre:*`              |
| `titre:%`              | "                                        | Titre: `%`             | `titre:%`              |
| `titre:?`              | `titre LIKE '_'`                         | Titre: `?`             | `titre:?`              |
| `titre:_`              | "                                        | Titre: `_`             | `titre:_`              |
| `!titre:*test*`        | `titre NOT LIKE '%test%'`                | Titre: `!*test*`       | `!titre:*test*`        |
| `titre!*test*`         | "                                        | "                      | "                      |
| `titre:!*test*`        | "                                        | "                      | "                      |
| `-titre:%test%`        | "                                        | Titre: `!%test%`       | `!titre:%test%`        |
| `!titre:Alien*`        | `titre NOT LIKE 'Alien%'`                | Titre: `!Alien*`       | `!titre:Alien*`        |
| `!titre:Alien%`        | "                                        | Titre: `!Alien%`       | `!titre:Alien%`        |
| `!titre:Alien?`        | `titre NOT LIKE 'Alien_'`                | Titre: `!Alien?`       | `!titre:Alien?`        |
| `!titre:Alien_`        | "                                        | Titre: `!Alien_`       | `!titre:Alien_`        |
| `!titre:*`             | `titre NOT LIKE '%'`                     | Titre: `!*`            | `!titre:*`             |
| `!titre:?`             | `titre NOT LIKE '_'`                     | Titre: `!?`            | `!titre:?`             |
| `titre!=*test*`        | `titre <> '*test*'`                      | Titre: `!=*test*`      | `titre!=*test*`        |
| `!titre=*test*`        | "                                        | "                      | "                      |
| `titre<>%test%`        | `titre <> '%test%'`                      | Titre: `<>%test%`      | `titre<>%test%`        |
| `-titre=%test%`        | "                                        | Titre: `!=%test%`      | `titre!=%test%`        |
| `titre≠A_B`            | `titre <> 'A_B'`                         | Titre: `≠A_B`          | `titre≠A_B`            |
| `titre=*Alien*`        | `titre = '*Alien*'`                      | Titre: `=*Alien*`      | `titre=*Alien*`        |
| `titre:=%Alien%`       | `titre = '%Alien%'`                      | Titre: `=%Alien%`      | `titre=%Alien%`        |
| **Numérique**          |                                          |                        |                        |
| `"nombre de vues":1*`  | `vues LIKE '1%'`                         | Nombre de vues: `1*`   | `"nombre de vues":1*`  |
| `"nombre de vues"!=1*` | `vues <> '1*'`                           | Nombre de vues: `!=1*` | `"nombre de vues"!=1*` |
| **Objet lié**          |                                          |                        |                        |
| `réalisateur:*Jean*`   | `(director.nom LIKE '%Jean%' OR director.prenom LIKE '%Jean%')` | Réalisateur: `*Jean*`  | `réalisateur:*Jean*`   |

## Chercher un intervalle ou une date

| Filtre général                 | SQL équivalent                           | Filtre colonne                  | Filtre général généré          |
| ------------------------------ | ---------------------------------------- | ------------------------------- | ------------------------------ |
| **Texte**                      |                                          |                                 |                                |
| `titre:A-B`                    | `titre BETWEEN 'A' AND 'B'`              | Titre: `A-B`                    | `titre:A-B`                    |
| `titre=A-B`                    | `titre = 'A-B'`                          | Titre: `=A-B`                   | `titre=A-B`                    |
| `titre:-`                      | `titre = '-'`                            | Titre: `-`                      | `titre:-`                      |
| `titre:" - "`                  | "                                        | Titre: `" - "`                  | `titre:" - "`                  |
| `titre=-`                      | "                                        | Titre: `=-`                     | `titre=-`                      |
| **Numérique**                  |                                          |                                 |                                |
| `"nombre de vues":10-20`       | `vues BETWEEN 10 AND 20`                 | Nombre de vues: `10-20`         | `"nombre de vues":10-20`       |
| `"nombre de vues":"10 - 20"`   | "                                        | Nombre de vues: `10 - 20`       | `"nombre de vues":"10 - 20"`   |
| `"nombre de vues":10-`         | `vues >= 10`                             | Nombre de vues: `10-`           | `"nombre de vues":10-`         |
| `"nombre de vues":-20`         | `vues <= 20`                             | Nombre de vues: `-20`           | `"nombre de vues":-20`         |
| `"nombre de vues":-`           | `1 = 0`                                  | Nombre de vues: `-`             | `"nombre de vues":-`           |
| **Date**                       |                                          |                                 |                                |
| `ajouté:2020`                  | `ajoute BETWEEN '2020-01-01 00:00:00.000' AND '2020-12-31 23:59:59.999'` | Ajouté: `2020`                  | `ajouté:2020`                  |
| `ajouté=2020`                  | "                                        | Ajouté: `=2020`                 | `ajouté=2020`                  |
| `ajouté:=2020`                 | "                                        | "                               | "                              |
| `ajouté:2020-03`               | `ajoute BETWEEN '2020-03-01 00:00:00.000' AND '2020-03-31 23:59:59.999'` | Ajouté: `2020-03`               | `ajouté:2020-03`               |
| `ajouté:6`                     | `ajoute BETWEEN '2026-06-01 00:00:00.000' AND '2026-06-30 23:59:59.999'` | Ajouté: `6`                     | `ajouté:6`                     |
| `ajouté:2020-03-09`            | `ajoute BETWEEN '2020-03-09 00:00:00.000' AND '2020-03-09 23:59:59.999'` | Ajouté: `2020-03-09`            | `ajouté:2020-03-09`            |
| `ajouté:09/03/2020`            | "                                        | Ajouté: `09/03/2020`            | `ajouté:09/03/2020`            |
| `ajouté:09032020`              | "                                        | Ajouté: `09032020`              | `ajouté:09032020`              |
| `ajouté:2020-2022`             | `ajoute BETWEEN '2020-01-01 00:00:00.000' AND '2022-12-31 23:59:59.999'` | Ajouté: `2020-2022`             | `ajouté:2020-2022`             |
| `ajouté:01/03/2020-09/03/2020` | `ajoute BETWEEN '2020-03-01 00:00:00.000' AND '2020-03-09 23:59:59.999'` | Ajouté: `01/03/2020-09/03/2020` | `ajouté:01/03/2020-09/03/2020` |
| `ajouté:2020-`                 | `ajoute >= '2020-01-01 00:00:00.000'`    | Ajouté: `2020-`                 | `ajouté:2020-`                 |
| `ajouté>=2020`                 | "                                        | Ajouté: `>=2020`                | `ajouté>=2020`                 |
| `ajouté:-2020`                 | `ajoute <= '2020-12-31 23:59:59.999'`    | Ajouté: `-2020`                 | `ajouté:-2020`                 |
| `ajouté<=2020`                 | "                                        | Ajouté: `<=2020`                | `ajouté<=2020`                 |
| `ajouté>2020`                  | `ajoute > '2020-12-31 23:59:59.999'`     | Ajouté: `>2020`                 | `ajouté>2020`                  |
| `ajouté<2020`                  | `ajoute < '2020-01-01 00:00:00.000'`     | Ajouté: `<2020`                 | `ajouté<2020`                  |
| `ajouté!=2020`                 | `ajoute NOT BETWEEN '2020-01-01 00:00:00.000' AND '2020-12-31 23:59:59.999'` | Ajouté: `!2020`                 | `!ajouté:2020`                 |
| `-ajouté:2020`                 | "                                        | "                               | "                              |
| `ajouté!2020`                  | "                                        | "                               | "                              |
| `ajouté<>2020`                 | "                                        | Ajouté: `!=2020`                | `ajouté!=2020`                 |
| `!ajouté=2020`                 | "                                        | "                               | "                              |
| `ajouté≠2020`                  | "                                        | Ajouté: `<>2020`                | `ajouté<>2020`                 |
| `!ajouté:2020`                 | "                                        | Ajouté: `≠2020`                 | `ajouté≠2020`                  |
| `ajouté:2020-03-__`            | `ajoute LIKE '2020-03-__%'`              | Ajouté: `2020-03-__`            | `ajouté:2020-03-__`            |
| `ajouté:2020-03-??`            | "                                        | Ajouté: `2020-03-??`            | `ajouté:2020-03-??`            |
| `ajouté!2020-03-__`            | `ajoute NOT LIKE '2020-03-__%'`          | Ajouté: `!2020-03-__`           | `!ajouté:2020-03-__`           |
| `ajouté<>2020-03-__`           | "                                        | Ajouté: `<>2020-03-__`          | `ajouté<>2020-03-__`           |
| `ajouté:20??`                  | `ajoute LIKE '20__-%'`                   | Ajouté: `20??`                  | `ajouté:20??`                  |
| `ajouté:2026-02-29`            | `1 = 0`                                  | Ajouté: `2026-02-29`            | `ajouté:2026-02-29`            |
| `ajouté:-`                     | "                                        | Ajouté: `-`                     | `ajouté:-`                     |

## Chercher une valeur vide

Une valeur texte vide donne une égalité ou une inégalité exacte, même avec `:` ou `!`.
Une recherche par préfixe ajoute `%` à une valeur texte non vide quand elle ne contient aucun joker explicite.
Le préfixe `!` ou `-` inverse la condition. Avec `=`, il donne une inégalité exacte.

| Filtre général                        | SQL équivalent                           | Filtre colonne              | Filtre général généré             |
| ------------------------------------- | ---------------------------------------- | --------------------------- | --------------------------------- |
| **Texte**                             |                                          |                             |                                   |
| `titre:vide`                          | `titre NOT LIKE '_%'`                    | Titre: `vide`               | `titre:vide`                      |
| `titre:empty`                         | "                                        | Titre: `empty`              | `titre:empty`                     |
| `titre:VIDE`                          | "                                        | Titre: `VIDE`               | `titre:VIDE`                      |
| `titre:" vide "`                      | "                                        | Titre: ` vide `             | `titre:" vide "`                  |
| `!titre:vide`                         | `titre LIKE '_%'`                        | Titre: `!vide`              | `!titre:vide`                     |
| `titre!vide`                          | "                                        | "                           | "                                 |
| `titre:!vide`                         | "                                        | "                           | "                                 |
| `-titre:vide`                         | "                                        | Titre: `!empty`             | `!titre:empty`                    |
| `titre:!empty`                        | "                                        | "                           | "                                 |
| `titre:=`                             | `titre = ''`                             | Titre: `=`                  | `titre:=`                         |
| `titre=`                              | "                                        | "                           | "                                 |
| `titre:`                              | "                                        | "                           | "                                 |
| `titre=""`                            | "                                        | "                           | "                                 |
| `!titre!=`                            | "                                        | "                           | "                                 |
| `!titre<>`                            | "                                        | "                           | "                                 |
| `!titre≠`                             | "                                        | "                           | "                                 |
| `-titre!=`                            | "                                        | "                           | "                                 |
| `-titre<>`                            | "                                        | "                           | "                                 |
| `-titre≠`                             | "                                        | "                           | "                                 |
| `titre:=""`                           | "                                        | Titre: `=""`                | "                                 |
| `titre:""`                            | "                                        | Titre: `""`                 | `titre:""`                        |
| `!titre!`                             | "                                        | "                           | "                                 |
| `-titre!`                             | "                                        | "                           | "                                 |
| `titre:!`                             | `titre <> ''`                            | Titre: `!`                  | `!titre:""`                       |
| `titre!`                              | "                                        | "                           | "                                 |
| `!titre:`                             | "                                        | "                           | "                                 |
| `-titre:`                             | "                                        | "                           | "                                 |
| `!titre:""`                           | "                                        | Titre: `!""`                | "                                 |
| `titre!""`                            | "                                        | "                           | "                                 |
| `titre:!=`                            | "                                        | Titre: `!=`                 | `titre:!=`                        |
| `titre!=`                             | "                                        | "                           | "                                 |
| `titre<>`                             | "                                        | "                           | "                                 |
| `titre≠`                              | "                                        | "                           | "                                 |
| `!titre=`                             | "                                        | "                           | "                                 |
| `-titre=`                             | "                                        | "                           | "                                 |
| `titre!=""`                           | "                                        | Titre: `!=""`               | "                                 |
| `!titre=""`                           | "                                        | "                           | "                                 |
| `titre:<>`                            | "                                        | Titre: `<>`                 | `titre:<>`                        |
| `titre:≠`                             | "                                        | Titre: `≠`                  | `titre:≠`                         |
| `titre<`                              | `titre < ''`                             | Titre: `<`                  | `titre:<`                         |
| `titre:<`                             | "                                        | "                           | "                                 |
| `!titre>=`                            | "                                        | "                           | "                                 |
| `-titre>=`                            | "                                        | "                           | "                                 |
| `titre<=`                             | `titre <= ''`                            | Titre: `<=`                 | `titre:<=`                        |
| `titre:<=`                            | "                                        | "                           | "                                 |
| `!titre>`                             | "                                        | "                           | "                                 |
| `-titre>`                             | "                                        | "                           | "                                 |
| `titre>`                              | `titre > ''`                             | Titre: `>`                  | `titre:>`                         |
| `titre:>`                             | "                                        | "                           | "                                 |
| `!titre<=`                            | "                                        | "                           | "                                 |
| `-titre<=`                            | "                                        | "                           | "                                 |
| `titre>=`                             | `titre >= ''`                            | Titre: `>=`                 | `titre:>=`                        |
| `titre:>=`                            | "                                        | "                           | "                                 |
| `!titre<`                             | "                                        | "                           | "                                 |
| `-titre<`                             | "                                        | "                           | "                                 |
| `titre=vide`                          | `titre = 'vide'`                         | Titre: `=vide`              | `titre=vide`                      |
| `titre:=vide`                         | "                                        | "                           | "                                 |
| `titre!=vide`                         | `titre <> 'vide'`                        | Titre: `!=vide`             | `titre!=vide`                     |
| `!titre=vide`                         | "                                        | "                           | "                                 |
| `titre:vide*`                         | `titre LIKE 'vide%'`                     | Titre: `vide*`              | `titre:vide*`                     |
| **Numérique**                         |                                          |                             |                                   |
| `"nombre de vues":vide`               | `vues IS NULL`                           | Nombre de vues: `vide`      | `"nombre de vues":vide`           |
| `"watch count":empty`                 | "                                        | Nombre de vues: `empty`     | `"nombre de vues":empty`          |
| `"nombre de vues":!vide`              | `vues IS NOT NULL`                       | Nombre de vues: `!vide`     | `!"nombre de vues":vide`          |
| `!"nombre de vues":vide`              | "                                        | "                           | "                                 |
| `"nombre de vues":0`                  | `vues = 0`                               | Nombre de vues: `0`         | `"nombre de vues":0`              |
| `"nombre de vues"=0`                  | "                                        | Nombre de vues: `=0`        | `"nombre de vues"=0`              |
| `"nombre de vues"!=0`                 | `vues <> 0`                              | Nombre de vues: `!=0`       | `"nombre de vues"!=0`             |
| `"nombre de vues":vide \| "nombre de vues":0` | `(vues IS NULL OR vues = 0)`             | Nombre de vues: `vide \| 0` | `"nombre de vues":vide \| "nombre de vues":0` |
| **Date**                              |                                          |                             |                                   |
| `ajouté:vide`                         | `ajoute = '0000-00-00'`                  | Ajouté: `vide`              | `ajouté:vide`                     |
| `ajouté:empty`                        | "                                        | Ajouté: `empty`             | `ajouté:empty`                    |
| `ajouté!=?`                           | "                                        | Ajouté: `!?`                | `!ajouté:?`                       |
| `ajouté<>?`                           | "                                        | Ajouté: `!=?`               | `ajouté!=?`                       |
| `ajouté≠?`                            | "                                        | Ajouté: `<>?`               | `ajouté<>?`                       |
| `ajouté!?`                            | "                                        | Ajouté: `≠?`                | `ajouté≠?`                        |
| `ajouté:!vide`                        | `ajoute <> '0000-00-00'`                 | Ajouté: `!vide`             | `!ajouté:vide`                    |
| `ajouté:?`                            | "                                        | Ajouté: `?`                 | `ajouté:?`                        |
| `ajouté:_`                            | "                                        | Ajouté: `_`                 | `ajouté:_`                        |
| `ajouté!=vide`                        | "                                        | Ajouté: `!=vide`            | `ajouté!=vide`                    |
| `ajouté!=`                            | `1 = 0`                                  | Ajouté: `!=`                | `ajouté:!=`                       |
| `ajouté:!=`                           | "                                        | "                           | "                                 |
| `!ajouté=`                            | "                                        | "                           | "                                 |
| **Objet lié**                         |                                          |                             |                                   |
| `réalisateur:vide`                    | `director_id IS NULL`                    | Réalisateur: `vide`         | `réalisateur:vide`                |
| `director:empty`                      | "                                        | Réalisateur: `empty`        | `réalisateur:empty`               |
| `!réalisateur:vide`                   | `director_id IS NOT NULL`                | Réalisateur: `!vide`        | `!réalisateur:vide`               |
| `-réalisateur:vide`                   | "                                        | "                           | "                                 |
| `réalisateur!vide`                    | "                                        | "                           | "                                 |
| `réalisateur:!vide`                   | "                                        | "                           | "                                 |
| `réalisateur=vide`                    | `(director.nom = 'vide' OR director.prenom = 'vide')` | Réalisateur: `=vide`        | `réalisateur=vide`                |
| `réalisateur.nom:vide`                | `director.nom NOT LIKE '_%'`             | Nom du réalisateur: `vide`  | `réalisateur.nom:vide`            |
| **Saisie vide**                       |                                          |                             |                                   |
| Champ laissé vide                     | Aucune condition                         | Titre: Champ laissé vide    | Filtre vide                       |

## Combiner et protéger

Après `:`, une virgule ou un `|` collé entre deux valeurs simples les rattache au même champ.
Si la partie suivante commence par un champ et son séparateur, la virgule ou le `|` relie deux critères.

Dans le filtre général, les espaces ou les parenthèses délimitent `and` et `or` entre deux critères.
Les mots localisés sont aussi acceptés, par exemple `et` et `ou` en français.
Les opérateurs ET sont prioritaires sur les opérateurs OU. Les parenthèses changent cet ordre.
Après un critère sans valeur, un mot logique suivi d’un autre critère relie les deux.
Pour chercher ce mot comme valeur, écrivez par exemple `titre="ou"`.
Dans un filtre de colonne, ces mots font partie de la valeur. Dans le filtre général, citez une valeur
de plusieurs mots pour les rechercher littéralement.

| Filtre général                        | SQL équivalent                           | Filtre colonne                         | Filtre général généré             |
| ------------------------------------- | ---------------------------------------- | -------------------------------------- | --------------------------------- |
| **Texte**                             |                                          |                                        |                                   |
| `titre:Alien \| titre:Predator`       | `(titre LIKE 'Alien%' OR titre LIKE 'Predator%')` | Titre: `Alien, Predator`               | `titre:Alien \| titre:Predator`   |
| `titre:Alien or titre:Predator`             | "                                        | "                                       | "                                 |
| `titre:Alien ou titre:Predator`             | "                                        | "                                       | "                                 |
| `titre:(Alien, Predator)`             | "                                        | "                                      | "                                 |
| `titre:Alien,titre:Predator`          | "                                        | Titre: `Alien \| Predator`             | "                                 |
| `titre:(Alien \| Predator)`           | "                                        | Titre: `Alien\|Predator`               | "                                 |
| `titre:Alien\|Predator`               | "                                        | "                                      | "                                 |
| `titre:Alien,Predator`                      | "                                        | "                                       | "                                 |
| `titre:Alien\|Predator\|Aliens`       | `(titre LIKE 'Alien%' OR titre LIKE 'Predator%' OR titre LIKE 'Aliens%')` | Titre: `Alien \| Predator \| Aliens` | `titre:Alien \| titre:Predator \| titre:Aliens` |
| `titre:Alien,Predator,Aliens`               | "                                        | "                                       | "                                 |
| `titre= \| titre:Alien`               | `(titre = '' OR titre LIKE 'Alien%')`    | Titre: `= \| Alien`                    | `titre:= \| titre:Alien`          |
| `titre:Alien&titre:*1979*`            | `(titre LIKE 'Alien%' AND titre LIKE '%1979%')` | Titre: `Alien & *1979*`                | `titre:Alien & titre:*1979*`      |
| `titre:Alien and titre:*1979*`              | "                                        | "                                       | "                                 |
| `titre:Alien et titre:*1979*`               | "                                        | "                                       | "                                 |
| `titre:(Alien + *1979*)`              | "                                        | Titre: `Alien + *1979*`                | "                                 |
| `(titre:Alien)`                       | `titre LIKE 'Alien%'`                    | Titre: `(Alien)`                       | `titre:Alien`                     |
| `titre:"Alien \| Predator"`           | `titre LIKE 'Alien \| Predator%'`        | Titre: `"Alien \| Predator"`           | `titre:"Alien \| Predator"`       |
| `titre:"Paris, Texas"`                | `titre LIKE 'Paris, Texas%'`             | Titre: `"Paris, Texas"`                | `titre:"Paris, Texas"`            |
| "                                     | "                                        | Titre: `Paris\, Texas`                 | "                                 |
| `titre:"Rock & Roll"`                 | `titre LIKE 'Rock & Roll%'`              | Titre: `"Rock & Roll"`                 | `titre:"Rock & Roll"`             |
| `titre:'Rock & Roll'`                 | "                                        | Titre: `Rock \& Roll`                  | "                                 |
| `titre:"Rock and Roll or Jazz"` | `titre LIKE 'Rock and Roll or Jazz%'` | Titre: `Rock and Roll or Jazz` | `titre:"Rock and Roll or Jazz"` |
| `titre:"Roche et métal ou jazz"` | `titre LIKE 'Roche et métal ou jazz%'` | Titre: `Roche et métal ou jazz` | `titre:"Roche et métal ou jazz"` |
| `titre:"A+B"`                         | `titre LIKE 'A+B%'`                      | Titre: `"A+B"`                         | `titre:"A+B"`                     |
| "                                     | "                                        | Titre: `A\+B`                          | "                                 |
| `titre:"Alien (1979)"`                | `titre LIKE 'Alien (1979)%'`             | Titre: `"Alien (1979)"`                | `titre:"Alien (1979)"`            |
| "                                     | "                                        | Titre: `Alien \(1979\)`                | "                                 |
| `titre:"Le \"Grand\" Bleu"`           | `titre LIKE 'Le "Grand" Bleu%'`          | Titre: `"Le \"Grand\" Bleu"`           | `titre:"Le \"Grand\" Bleu"`       |
| `titre:'Le "Grand" Bleu'`             | "                                        | Titre: `Le \"Grand\" Bleu`             | "                                 |
| `titre:"O'Neil"`                      | `titre LIKE 'O''Neil%'`                  | Titre: `O'Neil`                        | `titre:O'Neil`                    |
| `titre:'O\'Neil'`                     | "                                        | "                                      | "                                 |
| `titre:O'Neil`                        | "                                        | Titre: `"O'Neil"`                      | "                                 |
| `titre:"A\\B"`                        | `titre LIKE 'A\\B%'`                     | Titre: `"A\\B"`                        | `titre:"A\\B"`                    |
| "                                     | "                                        | Titre: `A\\B`                          | "                                 |
| `titre:" Autant "`                    | `titre LIKE ' Autant %'`                 | Titre: `" Autant "`                    | `titre:" Autant "`                |
| `titre:Alien \| titre:Predator & !titre:*test*` | `(titre LIKE 'Alien%' OR (titre LIKE 'Predator%' AND titre NOT LIKE '%test%'))` | Titre: `Alien \| Predator & !*test*`   | `titre:Alien \| titre:Predator & !titre:*test*` |
| `titre:Alien or titre:Predator and !titre:*test*` | "                                        | "                                       | "                                 |
| `titre:Alien ou titre:Predator et !titre:*test*` | "                                        | "                                       | "                                 |
| `(titre:Alien \| titre:Predator) & !titre:*test*` | `((titre LIKE 'Alien%' OR titre LIKE 'Predator%') AND titre NOT LIKE '%test%')` | Titre: `(Alien \| Predator) & !*test*` | `(titre:Alien \| titre:Predator) & !titre:*test*` |
| `(titre:Alien or titre:Predator) and !titre:*test*` | "                                        | "                                       | "                                 |
| `(titre:Alien ou titre:Predator) et !titre:*test*` | "                                        | "                                       | "                                 |
| "                                     | "                                        | Titre: `(Alien, Predator) + !*test*`   | "                                 |
| `titre="Paris, Texas"`                | `titre = 'Paris, Texas'`                 | Titre: `="Paris, Texas"`               | `titre="Paris, Texas"`            |
| `titre:"\""`                          | `titre LIKE '"%'`                        | Titre: `\"`                            | `titre:"\""`                      |
| `titre:"\\"`                          | `titre LIKE '\\%'`                       | Titre: `\\`                            | `titre:"\\"`                      |
| —                                     | `1 = 0`                                  | Titre: `Alien \|`                      | `titre:"Alien \|`                 |
| —                                     | "                                        | Titre: `"Alien`                        | `titre:"\"Alien`                  |
| —                                     | "                                        | Titre: `(Alien`                        | `titre:"(Alien`                   |
| **Numérique**                         |                                          |                                        |                                   |
| `"nombre de vues">=10 & "nombre de vues"<=20` | `(vues >= 10 AND vues <= 20)`            | Nombre de vues: `>=10 & <=20`          | `"nombre de vues">=10 & "nombre de vues"<=20` |
| "                                     | "                                        | Nombre de vues: `>=10 + <=20`          | "                                 |
| **Filtres combinés**                  |                                          |                                        |                                   |
| `titre:Alien watchCount>=10`          | `(titre LIKE 'Alien%' AND vues >= 10)`   | Titre: `Alien`<br/>Nombre de vues: `>=10` | `titre:Alien "nombre de vues">=10` |
| `titre:Alien & watchCount>=10`        | "                                        | "                                      | "                                 |
| `titre:Alien + watchCount>=10`        | "                                        | "                                      | "                                 |
| `titre:Alien \| titre:Predator watchCount>=10` | `(titre LIKE 'Alien%' OR (titre LIKE 'Predator%' AND vues >= 10))` | —                                      | —                                 |
| `(titre:Alien \| titre:Predator) watchCount>=10` | `((titre LIKE 'Alien%' OR titre LIKE 'Predator%') AND vues >= 10)` | Titre: `Alien \| Predator`<br/>Nombre de vues: `>=10` | `(titre:Alien \| titre:Predator) "nombre de vues">=10` |
| `titre:(Alien \| Predator) watchCount>=10` | "                                        | "                                      | "                                 |
| `titre:Alien\|Predator & watchCount>=10` | "                                        | "                                      | "                                 |
| `titre:Alien\|Predator&watchCount>=10` | "                                        | "                                      | "                                 |
| `titre:Alien,Predator et watchCount>=10`    | "                                        | "                                       | "                                 |
| `(titre:Alien \| titre:Predator) & (watchCount>=10 \| watchCount=0)` | `((titre LIKE 'Alien%' OR titre LIKE 'Predator%') AND (vues >= 10 OR vues = 0))` | Titre: `Alien \| Predator`<br/>Nombre de vues: `>=10 \| =0` | `(titre:Alien \| titre:Predator) ("nombre de vues">=10 \| "nombre de vues"=0)` |
| `réalisateur:vide \| titre:Alien`     | `(director_id IS NULL OR titre LIKE 'Alien%')` | —                                      | —                                 |
| `réalisateur:vide\|titre:Alien`        | "                                        | "                                      | "                                 |
| `réalisateur:!vide & réalisateur.nom:Du` | `(director_id IS NOT NULL AND director.nom LIKE 'Du%')` | Réalisateur: `!vide`<br/>Nom du réalisateur: `Du` | `!réalisateur:vide réalisateur.nom:Du` |
| `watchCount>=8 titre:`                | `(titre = '' AND vues >= 8)`             | Titre: `=`<br/>Nombre de vues: `>=8`   | `titre:= "nombre de vues">=8`     |
| `titre: et watchCount>=8`                   | "                                        | "                                       | "                                 |
| `titre= and watchCount>=8`                  | "                                        | "                                       | "                                 |
| `watchCount>=8 !titre:`               | `(titre <> '' AND vues >= 8)`            | Titre: `!`<br/>Nombre de vues: `>=8`   | `!titre:"" "nombre de vues">=8`   |
| `!titre: et watchCount>=8`                  | "                                        | "                                       | "                                 |
| `titre= ou watchCount>=10`                  | `(titre = '' OR vues >= 10)`             | —                                       | —                                 |
| `titre= or watchCount>=10`                  | "                                        | "                                       | "                                 |
| `titre: ou (watchCount>=10)`                | "                                        | "                                       | "                                 |
| `(titre=)ou(watchCount>=10)`                | "                                        | "                                       | "                                 |
| `watchCount>=10 ou(titre=)`                 | "                                        | "                                       | "                                 |
| `(watchCount>=10)ou titre=`                | "                                        | "                                       | "                                 |
| `titre="ou" et watchCount>=10`              | `(titre = 'ou' AND vues >= 10)`          | Titre: `=ou`<br/>Nombre de vues: `>=10` | `titre=ou "nombre de vues">=10`   |
| `titre=ou watchCount>=10`                   | "                                        | "                                       | "                                 |
| **Saisies invalides ou incomplètes**  |                                          |                                        |                                   |
| `titre:Alien \| Predator`             | Critère incomplet                        | —                                      | —                                 |
| `titre:Alien \|`                      | "                                        | —                                      | —                                 |
| `titre:"Alien`                        | "                                        | —                                      | —                                 |
| `champInexistant:Alien`               | Champ inconnu                            | —                                      | —                                 |

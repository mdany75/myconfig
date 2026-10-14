# CLAUDE.md — myconfig

Mod Claude Code qui réunit jauge, fil-son, relais, plume et cap en six modules réglables
(Son, Relais, Correction, Stats, Proposition, Confirmation), avec une bande au-dessus du champ
de saisie et un panneau de réglages à onglets.

Ce projet suit le standard commun des projets de Dany (`/standard-projet` le vérifie).
Une exception voulue : il vit dans `~/Developer/Plugins/myconfig`, pas directement dans
`~/Developer`, car `~/Developer/Plugins` regroupe tous les mods.

## Commandes

| Action | Commande |
| --- | --- |
| Construire | rien à construire : le mod est chargé tel quel |
| Valider | `claude plugin validate .` |
| Tester | `claude plugin test .` |
| Recharger après une modification | `/reload-plugins` dans une session Claude Code |

Les tests demandent Claude Code 2.1.295 ou plus récent.

## Publier une version

1. Mettre le numéro à jour dans `.claude-plugin/plugin.json` (`version`) et ajouter la
   section `## X.Y.Z — date` dans `CHANGELOG.md`.
2. `claude plugin validate . && claude plugin test .`
3. `git add -A && git commit -m "Version X.Y.Z" && git push origin main`
4. `git tag -a vX.Y.Z -m "Version X.Y.Z" && git push origin vX.Y.Z`
5. `gh release create vX.Y.Z --title "myconfig X.Y.Z" --notes "$(~/.claude/skills/standard-projet/scripts/notes-version.sh X.Y.Z)"`

## Règles

- Répondre et écrire (commits, README, textes de l'interface) en français.
- Ne jamais déplacer ni renommer ce dossier : le marketplace local `plugins-dany` le désigne
  par `./myconfig`.
- La description du mod est écrite dans `.claude-plugin/plugin.json` et dans l'entrée
  `myconfig` du `marketplace.json` parent : les garder identiques.
- Tout ce qui touche au moteur (`$`) reste dans `hooks/register.tsx` : le moteur ne suit pas
  `$` à travers un import (`claude plugin validate` le refuse). Les autres fichiers de
  `hooks/` ne contiennent que des fonctions pures, testées directement.
- Toute valeur gardée dans `$.state` est déclarée dans `types/index.d.ts`.
- Les réglages vivent dans `$.state` et dans `$.store` (clé `reglages`) : `/clear` vide
  `$.state`, et `lireReglages` relit alors le store.
- Choix de Dany : la bande suit le croquis 1 (« Tableau de bord », carte arrondie, anneau SVG
  dans l'app de bureau), le panneau le croquis 5 (« Onglets »).
- Stats : dans la ligne, seulement le contexte (%, jetons) et les minutes. Les limites de 5 h et
  hebdomadaire n'apparaissent que dans la vue ouverte d'un clic sur les Stats (à la place des
  propositions), qui relit `$.session.usage()`. Seuils : vert sous 60 %, jaune de 60 à 79 %,
  rouge à 80 % et plus ; barres des limites en bleu, comme dans l'app.
- Confirmation : le feu vert est reconnu par `estFeuVert` (`hooks/confirmation.ts`) ; sans
  lui, Write, Edit et NotebookEdit sont refusés. Une panne du hook laisse passer (garde-fou
  de confort, pas de sécurité).
- Correction : `correction` vaut toujours `ameliorer || corriger` (`avecBoutons` dans
  `hooks/reglages.ts`) ; son onglet n'a pas d'On/Off, seulement « Afficher ».
- Progression : les étapes viennent de TodoWrite, TaskCreate et TaskUpdate du fil principal
  (`hooks/progression.ts`, logique reprise de fil) ; visible tant que la tâche tourne, puis
  `AFFICHAGE_FIN_MS` (15 s). Un même événement ne prend qu'un hook sans matcher : les hooks
  `tool.call` de la Progression ont chacun un matcher `{ tool }`.
- Ne pas activer en même temps jauge, fil, fil-son, relais, plume ou cap.
- Avant de pousser une fonctionnalité : README et CHANGELOG à jour, capture d'écran
  (`docs/capture.png`) refaite si la bande ou le panneau a changé et qu'une capture existe, et une
  nouvelle version (tag et Release sans pièce jointe : le mod s'installe depuis le marketplace).
- Pousser sur `main` directement.

## Organisation

- `.claude-plugin/plugin.json` : manifeste du mod (version, option `modele` de la Correction)
- `hooks/register.tsx` : tous les hooks, la bande, le panneau
- `hooks/*.ts` : fonctions pures des modules (réglages, stats, proposition, correction,
  confirmation, son, relais)
- `types/index.d.ts` : contrat des valeurs de `$.state`
- `sons/fin.aiff` : signal de fin
- `tests/` : tests du mod
- `docs/` : captures d'écran

# CLAUDE.md — myconfig

Mod Claude Code qui réunit jauge, fil-son, relais, plume et cap, avec une bande au-dessus du champ
de saisie et un panneau de réglages à six onglets (Général, Correction, Stats, Proposition,
Confirmation, Progression). Le Relais n'a pas d'onglet : son bouton vit dans l'onglet Stats.

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
  de confort, pas de sécurité). Dans la bande, le bouton `confirmation` (choix de Dany, Bande 1) :
  « ⏸ » `primary` à On, « ▶ » `secondary` à Off ; `basculerConfirmation` remet `feuVert` à false
  quand il la remet à On.
- Onglet Général (choix de Dany, Général A) : c'est le module `son` (sa clé ne change pas, pour les
  réglages gardés), affiché « Général » ; une rangée « Son » (`on` / `off`, `tester`) et une rangée
  « Croquis 👁 » (`croquis-on` / `croquis-off`). Allumé (●) quand `son || croquis`. `resume` écrit
  une ligne « Son » et une ligne « Croquis ».
- Mise à jour (0.10.0, choix de Dany, Croquis 4) : rangées « Version » et « Mods » de l'onglet
  Général (`rangeesMod`). `verifierGithub` (à l'ouverture de l'onglet, au plus une fois par
  `VERIFICATION_MS`) fait `git fetch`, `rev-list --count HEAD..@{u}` et lit `plugin.json` de `@{u}`
  dans `$.plugin.root` ; le résultat va dans `versionGithub`, l'action en cours dans `miseAJour`.
  `mettreAJour` refuse si `git status --porcelain` n'est pas vide, fait `git pull --ff-only`, puis
  appelle toujours `recharger` quand `HEAD` a changé (demande de Dany). `recharger` lance
  `$.command.run({ command: 'reload-plugins' })` ; s'il est refusé, `/reload-plugins` va dans le
  champ. Les boutons passent par `$.clock.after` : une promesse laissée seule meurt avec le hook.
- Croquis (0.9.0) : `croquis` est un réglage, pas un module (pas d'onglet à lui). À On, le hook
  `prompt.compose` (partagé avec la Confirmation : un seul hook sans matcher par événement) ajoute
  la section `myconfig:croquis` (`hooks/croquis.ts`). Dans la bande, l'œil `croquis` (Œil 2) est
  à gauche du bouton Confirmation : « 👁 » `primary` à On, `secondary` à Off.
- Progression, Titre 1 (choix de Dany) : `titreDe` coupe la consigne à un mot entier (`TITRE_MAX`).
  Quand `aResumer` (plus d'une ligne, ou plus de `TITRE_COURT` caractères) et que la Progression est
  à On, `turn.start` lance `resumerTitre` (une minuterie, sinon la promesse meurt avec le hook) :
  `$.model.complete` avec `haiku` et `CONSIGNE_TITRE`, nettoyé par `nettoyerTitre`, posé seulement
  si la tâche n'a pas changé (`p.debut`). Un échec garde la consigne.
- Relais (0.8.0) : plus un module (absent de `MODULES`, de `Reglages` et de la bande) ; son bouton
  `relais` est dans l'onglet Stats (`boutonRelais`), deux clics, grisé tant que `auTravail` (posé par
  `turn.start`, retiré par `turn.complete` du fil principal). `/myconfig relais …` répond
  `RELAIS_TOUJOURS`. Un onglet `relais` gardé dans `$.state` revient aux Stats.
- Onglet Stats (choix de Dany, croquis C, `ongletStats`) : « Cette session », « Forfait », « Relais ».
  Le contenu du contexte vient de `$.session.usage({ breakdown: 'summary' })` (`mesurerRepartition`,
  estimation locale, rien n'est envoyé) et va dans `repartition` : relu à l'ouverture du panneau sur
  cet onglet, au clic sur l'onglet, et à chaque `session.measure` qui change le contexte quand
  l'onglet est choisi. Le coût vient de `cost.usd` (`Mesure.cout`).
- Correction : `correction` vaut toujours `ameliorer || corriger` (`avecBoutons` dans
  `hooks/reglages.ts`) ; son onglet n'a pas d'On/Off, seulement « Afficher ».
- Progression : `progression` vaut toujours `avecListe || sansListe` (`avecModes` dans
  `hooks/reglages.ts`) ; son onglet n'a pas d'On/Off, seulement « Afficher ». Un mode retiré ne
  montre rien dans son cas (`bandeProgression`), le suivi continue.
- Progression : les étapes viennent de TodoWrite, TaskCreate et TaskUpdate du fil principal
  (`hooks/progression.ts`, logique reprise de fil) ; visible dès le début, puis `disparaitApres`
  secondes après la fin (15 par défaut ; `null` : jamais, jusqu'au clic sur le titre qui pose
  `effacee`) ; choix dans `DISPARITIONS` de `hooks/reglages.ts`. Une interruption pose `effacee`,
  que `demarrer` retire quand une liste inachevée reprend. `lireReglages` passe toujours par
  `completer` : `$.state` garde après un rechargement des réglages d'une version plus ancienne. Un même événement ne prend qu'un hook sans matcher : les hooks
  `tool.call` de la Progression ont chacun un matcher `{ tool }`.
- Progression, journal : chaque action du fil principal entre dans `p.journal` (`debuterAction`,
  `JOURNAL_MAX` au plus) avec `decrireOutil` (nom, libellé, complément). Un clic sur le bouton
  `progression-detail` (la ligne sous la barre ; un `Button` ne peut pas contenir le `Svg` de la
  barre) bascule `journalOuvert` ; `journalDe` dessine les `journalLignes` dernières (réglage
  « Détail » ; `null` : illimité), sans dépasser la place que la bande laisse (`e.props.maxRows`).
  Journal 1 (choix de Dany) : l'outil, puis le titre entier (`titreJournal`, sans le complément en
  gris), coupé sur plusieurs rangées (`wrap="wrap"`) ; `pageJournal` prend la plus grande page dont
  les titres tiennent dans les rangées (`rangeesTexte`), et sa `taille` sert de pas à ▲ et ▼.
  Plus d'actions que de place : « ▲ » (`journal-haut`, à la place du trait) et « ▼ » (`journal-bas`)
  feuillettent par pages ; `journalAncre` garde l'id de la première action montrée (`null` : les
  dernières), remis à `null` quand le journal se replie ou se rouvre.
- Progression sans liste : le hook `tool.call` sans matcher (partagé avec la garde de la
  Confirmation) note chaque action du fil principal (`debuterAction` / `finirAction`) ; les
  actions consécutives de même sorte forment un segment (`BLOCS_MAX` au plus). La piste se remplit
  à `t / (t + 15 s)` et passe à 100 % à la fin. Un chrono `$.clock.every(1000)` tourne de
  `turn.start` à `turn.complete`.
- Ne pas activer en même temps jauge, fil, fil-son, relais, plume ou cap.
- Avant de pousser une fonctionnalité : README et CHANGELOG à jour, capture d'écran
  (`docs/capture.png`) refaite si la bande ou le panneau a changé et qu'une capture existe, et une
  nouvelle version (tag et Release sans pièce jointe : le mod s'installe depuis le marketplace).
- Pousser sur `main` directement.

## Organisation

- `.claude-plugin/plugin.json` : manifeste du mod (version, option `modele` de la Correction)
- `hooks/register.tsx` : tous les hooks, la bande, le panneau
- `hooks/*.ts` : fonctions pures des modules (réglages, stats, proposition, correction,
  confirmation, croquis, mise-a-jour, progression, son, relais)
- `types/index.d.ts` : contrat des valeurs de `$.state`
- `sons/fin.aiff` : signal de fin
- `tests/` : tests du mod
- `docs/` : captures d'écran

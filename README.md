# MyConfig

Mod Claude Code qui réunit en un seul mod, réglables d'un même panneau, les mods
[jauge](../jauge), [fil-son](../fil-son), [relais](../relais), [plume](../plume) et
[cap](../cap), plus un sixième module, la Confirmation. Une carte au-dessus du champ de saisie
réunit les boutons et les chiffres ; un panneau à onglets règle chaque module.

```
╭───────────────────────────────────────────────────────────────────────────────╮
│ ✦ [ Lance les tests ] [ Mets le README à jour ] [ Publie la version ] [ ↻ ]   │
│                                                                               │
│ [ ✎ Améliorer ] [ ✓ Correction ] [ Revenir ]   ◔ 34 % 68k/200k · 12 min ▾ [ ⇄ Relais ] [ ⚙ ] │
╰───────────────────────────────────────────────────────────────────────────────╯
```

## Fonctions

| Module | Remplace | Ce qu'il fait | Réglages |
| --- | --- | --- | --- |
| **Son** | fil-son | Joue un son à la fin d'une tâche d'au moins 10 secondes. | On / Off |
| **Relais** | relais | Récapitule la conversation dans `.relais/`, l'efface et prépare le message de reprise. | On / Off |
| **Correction** | plume | « ✎ Améliorer » reformule ta consigne en prompt structuré ; « ✓ Correction » corrige seulement le texte ; « Revenir » remet ton texte. | Afficher : Améliorer, Correction (aucun = Off) |
| **Stats** | jauge | Contexte utilisé (%, jetons) et durée de la session ; un clic ouvre les limites d'utilisation du forfait. | On / Off |
| **Proposition** | cap | Des suites logiques après chaque réponse ; un clic en lance une. | On / Off, 1 à 5, sur une ligne ou une par ligne ; modèle de la session |
| **Confirmation** | — | Claude résume ce qu'il compte faire et attend ton feu vert avant de créer ou de modifier quoi que ce soit. | On / Off |

### La bande

Au-dessus du champ de saisie, une carte arrondie (croquis 1, « Tableau de bord ») :

- Les propositions en haut, côte à côte ou une par ligne, puis une ligne vide avant les boutons.
- La Correction à gauche, puis à droite la Confirmation (« ⏸ Confirmation » ou « ▶ Feu vert »),
  les Stats (un anneau de contexte dessiné dans l'app de bureau, un quart de disque au terminal),
  le Relais et ⚙, qui ouvre le panneau.
- Couleurs des Stats : vert sous 60 %, jaune de 60 à 79 %, rouge à 80 % et plus.
- Un clic sur les chiffres des Stats (▾) relit les données et ouvre, à la place des propositions,
  les **limites d'utilisation du forfait** : limite de 5 heures et limite hebdomadaire, chacune avec
  son %, le délai avant sa remise à zéro et une barre bleue. « ↻ » les relit ; un autre clic (▴)
  les ferme. Ce sont les chiffres que la dernière réponse a rapportés.
- Un module à Off disparaît de la bande ; ⚙ reste toujours.

### Le panneau

⚙ ou `/myconfig` ouvre le panneau MyConfig (croquis 5, « Onglets ») : un onglet par module
(● On, ○ Off), son état On / Off et ses réglages propres.

- **Son** : bouton « ▶ Tester le son ».
- **Correction** : pas d'On / Off, mais « Afficher » : « ✎ Améliorer » et « ✓ Correction », chacun affiché
  ou non dans la bande ; aucun des deux, et la Correction est à Off. Le modèle est rappelé dessous.
- **Proposition** : le modèle (celui de la session : les propositions partent de la conversation en
  cache), nombre (1 à 5), disposition (« Sur une ligne », « Une par ligne »), « ↻ Proposer maintenant ».
- **Stats** : contexte, jetons et durée de la session.
- **Confirmation** : l'état du dernier message (feu vert donné ou en attente).

Au clavier, une fois le panneau sélectionné : `1` à `6` changent d'onglet, `o` et `f` mettent à On
ou à Off, `a` et `c` affichent ou retirent les boutons de la Correction. Les réglages sont gardés d'une session à l'autre.

### La Confirmation

À On, chaque message que tu envoies est lu :

- **Avec un feu vert** (« go », « vas-y », « tu peux y aller », « oui », « ok », « procède »,
  « c'est bon »…), Claude produit.
- **Sans feu vert**, ou s'il est repris aussitôt (« non », « attends », « pas encore »), Claude
  résume ce qu'il compte faire et demande s'il faut procéder. Les outils qui écrivent des
  fichiers (Write, Edit, NotebookEdit) sont refusés tant que le feu vert manque.

La règle passe par une section de la consigne système et par une note jointe à chacun de tes
messages. Une commande Bash qui modifie quelque chose n'est pas bloquée par le mod : seule la
consigne la retient.

### Commandes

```
/myconfig                          ouvre le panneau
/myconfig etat                     résume les réglages et les stats
/myconfig <module> on | off        son, relais, correction, stats, proposition, confirmation
/myconfig proposition 1 à 5        nombre de propositions
/myconfig proposition ligne | liste
/myconfig ameliorer | corriger on | off   affiche ou retire un bouton de la Correction
/relais [léger | dernier | purger [n]]
/correction <texte> | corriger <texte> | retour
```

Les anciens noms sont compris aussi : `/myconfig jauge off`, `/myconfig plume on`, `/myconfig cap 4`.

Le modèle de la Correction (sonnet, haiku ou opus) se règle dans les options du plugin.

## Installer

MyConfig s'installe depuis le marketplace local « plugins-dany » : le dossier
`~/Developer/Plugins`, qui regroupe tous les mods de Dany.

```bash
claude plugin marketplace add ~/Developer/Plugins
```

```bash
claude plugin install myconfig@plugins-dany
```

Le plugin est lu directement dans `~/Developer/Plugins/myconfig` : après une modification,
`/reload-plugins` dans une session suffit, sans réinstaller.

Ne pas activer MyConfig en même temps que jauge, fil-son, relais, plume ou cap : boutons et son
seraient en double (`claude plugin disable <mod>@plugins-dany` les désactive).

Testé avec Claude Code 2.1.295.

## Tests

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

Les tests demandent Claude Code 2.1.295 ou plus récent. Ils simulent la session (contexte,
limites du forfait, horloge, modèle, champ de saisie) et dessinent la bande et le panneau au
terminal et dans l'app de bureau ; ils ne jouent aucun son et n'écrivent aucun fichier.

## Organisation

- `.claude-plugin/plugin.json` : manifeste du mod
- `hooks/hooks.json` : nomme le module de hooks
- `hooks/register.tsx` : tous les hooks, la bande et le panneau (tout ce qui touche au moteur)
- `hooks/reglages.ts` : réglages par défaut, commande `/myconfig` (pur)
- `hooks/stats.ts`, `hooks/proposition.ts`, `hooks/correction.ts`, `hooks/confirmation.ts`,
  `hooks/son.ts`, `hooks/relais-consigne.ts`, `hooks/relais-outils.ts` : fonctions pures des modules
- `types/index.d.ts` : contrat des valeurs de `$.state`
- `sons/fin.aiff` : signal de fin
- `tests/` : tests du mod
- `docs/` : captures d'écran

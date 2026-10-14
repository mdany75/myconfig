# Changements

## 1.0.0 — 2026-10-14

Première version stable : la bande (Correction, Stats, l'œil des Croquis, la Confirmation, ⚙) et
le panneau à six onglets (Général, Correction, Stats, Proposition, Confirmation, Progression).

### Ajouté
- Recharge automatique : à la fin de chaque tour, si un fichier de `~/Developer/Plugins` a changé
  depuis le dernier chargement des mods, MyConfig lance `/reload-plugins` ; le message suivant
  part avec les mods à jour. Rien ne se passe quand rien n'a changé. Des propositions coupées par
  la recharge sont relancées. À On par défaut ; `/myconfig recharge on | off`.

## 0.10.0 — 2026-10-14

### Ajouté
- Onglet Général (Croquis 4) : la rangée « Version » montre le numéro du mod et ce que GitHub en
  dit (« à jour », « → 0.9.1 disponible »), vérifié à l'ouverture de l'onglet. « ⬇ Mettre à jour
  et recharger » récupère la dernière version de mdany75/myconfig, puis recharge toujours les mods ;
  des modifications locales l'arrêtent, rien n'est écrasé.
- Onglet Général : la rangée « Mods » et son bouton « ↻ Recharger », comme `/reload-plugins`.

## 0.9.0 — 2026-10-14

### Ajouté
- Croquis (l'œil 👁 de la bande, Œil 2, à gauche du ⏸ / ▶) : à On, avant de construire ou de
  changer une interface, Claude montre 5 croquis visuels, attend ton choix et ne construit que le
  croquis choisi, sans que tu le demandes. Foncé à On, normal à Off ; à Off par défaut. Aussi
  `/myconfig croquis on | off`.
- Progression, Titre 1 : le titre au-dessus de la barre résume ta consigne en une ligne. Une
  consigne longue, ou de plusieurs lignes, est résumée par un petit modèle (Haiku) ; ta consigne
  s'affiche en attendant et reste le titre si le résumé échoue. Une consigne courte sert telle quelle.

### Modifié
- Panneau : l'onglet Son devient « Général » (Général A), avec une rangée par fonction : « Son »
  (On / Off, « ▶ Tester le son ») et « Croquis 👁 » (On / Off).
- Progression : un titre trop long est coupé à un mot entier, et commence par une majuscule.

## 0.8.0 — 2026-10-14

### Ajouté
- Bande : un bouton Confirmation à la place du Relais (Bande 1) : « ⏸ » foncé quand la
  Confirmation est à On, « ▶ » normal à Off ; un clic bascule. Remise à On, elle attend un
  nouveau feu vert.
- Onglet Stats du panneau (croquis C), en trois groupes : « Cette session » (contexte en % et en
  jetons, une barre de son contenu par part avec la légende, durée et coût en $ US au prix de
  l'API), « Forfait » (limite de 5 heures et de la semaine, chacune avec sa barre, son % et sa
  remise à zéro, comme `/usage`) et « Relais ». Le contenu du contexte est l'estimation locale de
  `/context` : rien n'est envoyé au modèle.

### Modifié
- Le bouton Relais passe de la bande à l'onglet Stats du panneau, pour éviter un clic par erreur.
  Il garde ses deux clics (« Confirmer ? » pendant 6 secondes) et attend la fin du tour quand
  Claude travaille.
- Progression, journal déplié (Journal 1) : chaque action montre l'outil, puis son titre en
  entier, sur plusieurs lignes au besoin ; le détail en gris (la commande, le dossier) n'est plus
  affiché. La page se raccourcit quand de longs titres prennent plus de rangées.

### Corrigé
- Progression, dans l'app de bureau : la piste et la barre de la liste vont jusqu'au bout de la
  carte ; elles s'arrêtaient vers 87 % de sa largeur.
- Progression : le chevron qui déplie le journal passe à « ▼ / ▲ », pleine taille ; « ▾ / ▴ »
  étaient minuscules dans l'app de bureau.

### Retiré
- L'onglet Relais du panneau (6 onglets, touches 1 à 6) et l'On / Off du Relais : son bouton et
  `/relais` marchent toujours. `/myconfig relais on | off` explique où il est passé.
- L'indicateur « ⏸ Confirmation / ▶ Feu vert » de la bande : l'onglet Confirmation montre
  toujours l'état du dernier message.

## 0.7.0 — 2026-10-13

### Ajouté
- Progression, journal déplié (croquis 2, « flèches dans le journal ») : quand la tâche compte plus
  d'actions que le « Détail » n'en montre, « ▲ N actions plus anciennes » remplace le trait
  au-dessus du journal, avec la position à droite (« 4–6 sur 12 ») ; un clic recule d'une page, et
  « ▼ N plus récentes », dessous, avance. La carte garde sa hauteur, la page reste en place quand de
  nouvelles actions arrivent, et le journal revient aux dernières actions quand on le replie.
- README : une capture du journal déplié (`docs/journal.png`).

## 0.6.1 — 2026-10-13

### Modifié
- Onglet Progression : « Détail » propose 3, 6, 9, 12 actions ou Illimité (6 par défaut) ; un
  ancien réglage de 18 devient 12.

### Retiré
- Onglet Progression : l'option « Effacer du chat » ; les commandes Bash s'affichent de nouveau
  dans la conversation. `/myconfig progression masquer` n'existe plus.

## 0.6.0 — 2026-10-13

### Ajouté
- Progression : un clic sur la ligne sous la barre (les points et « ▾ ») déplie le journal des
  dernières actions de Claude (croquis 1, « journal déplié ») ; un autre clic le replie. Chaque
  action : ✓ faite ou ◉ en cours, l'outil, ce qu'il touche, le détail en gris (la commande, le
  dossier) et sa durée ; « + N actions plus anciennes » au-dessus. Dans le terminal, la barre
  elle-même est cliquable. Le journal marche avec et sans liste de tâches, et garde les
  200 dernières actions.
- Onglet Progression : « Détail » (6, 12, 18 ou Illimité), le nombre d'actions du journal déplié ;
  Illimité montre toutes celles qui tiennent dans la bande. Aussi `/myconfig progression detail 12`.
- Onglet Progression : « Effacer du chat » (On / Off) ; à On, les commandes Bash et leur sortie ne
  s'affichent plus dans la conversation (le journal les montre) ; une commande en erreur ou
  interrompue reste visible. Aussi `/myconfig progression masquer on`.
- Une barre arrêtée s'efface d'un clic sur son titre ou sur ✕.
- Les exemples « ▶ Avec liste » et « ▶ Sans liste » du panneau remplissent aussi le journal.

### Modifié
- « Reste après » devient « Disparaît après » : Instantané, 5, 10 ou 15 secondes, ou Jamais (la
  barre reste alors jusqu'au clic sur son titre). Un ancien réglage de 20 à 30 s devient 15 s.
  Aussi `/myconfig progression disparait jamais`.
- Les libellés des rangées du panneau sont plus larges (« Disparaît après » tient sur une ligne).

### Retiré
- « Apparaît après » : la barre apparaît dès que Claude travaille.
- Le texte de l'onglet Progression qui décrivait la piste sans liste.

## 0.5.0 — 2026-10-13

### Ajouté
- Onglet Progression : « Afficher » remplace l'État On / Off, avec deux boutons, « ☰ Avec liste »
  (barre fine et chapelet) et « ▬ Sans liste » (piste de temps), chacun affiché ou non dans la
  bande ; aucun des deux, et la Progression est à Off. Touches `a` et `s`. Aussi
  `/myconfig progression avec off`, `/myconfig progression sans on`.

### Modifié
- `/myconfig progression on | off` affiche ou retire les deux modes ; un ancien réglage à Off les
  retire tous les deux.
- Les boutons d'essai « ▶ Avec liste » et « ▶ Sans liste » sont éteints quand leur mode est retiré.
- `/myconfig etat` nomme les modes affichés de la Progression.
- Description de la Progression : « L'avancement du travail : les étapes de la liste de tâches de
  Claude, ou une piste de temps de ses actions ».

## 0.4.0 — 2026-10-13

### Ajouté
- Progression sans liste de tâches (croquis 3, « piste de temps ») : chaque action de Claude
  (commande, lecture, modification…) ajoute à la piste un segment coloré aussi long qu'elle a duré ;
  la piste se remplit de gauche à droite et atteint 100 % à la fin de la tâche, en vert, avec
  « ✓ N actions · durée ». Le chrono avance chaque seconde ; dessous, un point par sorte d'action
  et l'action en cours.
- Onglet Progression : « ▶ Sans liste » rejoue la piste d'une publication ; l'ancien exemple
  devient « ▶ Avec liste ».

## 0.3.0 — 2026-10-13

### Ajouté
- Onglet Progression : « Apparaît après », le temps de travail avant que la barre apparaisse
  (Instantané, 5, 10, 15, 20, 25 ou 30 secondes ; instantané par défaut) ; une tâche finie avant
  ce délai ne s'affiche pas. Aussi `/myconfig progression apparait 10`.
- Onglet Progression : « Reste après », le temps où la barre reste après la fin de la tâche
  (Instantané, 5, 10, 15, 20, 25 ou 30 secondes ; 15 par défaut). Aussi
  `/myconfig progression reste 5`.

### Modifié
- Description de la Progression : « Les tâches : une barre fine, et un point par étape de la liste
  de tâches de Claude » (elle suit les tâches découpées en étapes, quelle que soit leur durée).

## 0.2.0 — 2026-10-13

### Ajouté
- Module Progression : pour les longues tâches, un bloc en haut de la bande avec le titre, le %, le
  temps restant estimé, une barre fine et un point par étape de la liste de tâches de Claude
  (● faite, ◉ en cours, ○ restante). Une tâche finie reste 15 secondes avec sa coche.
- Onglet Progression du panneau : On / Off et « ▶ Voir un exemple ».

## 0.1.0 — 2026-10-13

Première version publiée.

- Premier dépôt de MyConfig : les mods jauge, fil-son, relais, plume et cap réunis en six modules
  réglables (Son, Relais, Correction, Stats, Proposition, Confirmation).
- Bande « Tableau de bord » : carte arrondie, anneau de contexte, propositions sur une ligne ou une
  par ligne, et une ligne vide sous la dernière proposition.
- Correction : « ✎ Améliorer » (prompt structuré) et « ✓ Correction » (orthographe, accords et ponctuation
  seulement, sans reformuler), puis « Revenir » ; « /correction corriger <texte> ». Dans le panneau,
  « Afficher » choisit les boutons de la bande ; aucun des deux, et la Correction est à Off.
- Onglet Proposition : le modèle utilisé (celui de la session).
- Panneau « Onglets » : un onglet par module, On / Off, nombre de propositions de 1 à 5, disposition.
- Stats : contexte et durée ; un clic ouvre les limites d'utilisation du forfait (5 heures, hebdomadaire),
  avec barres et délai de remise à zéro, et relit les données.
- Nouveau module Confirmation : sans feu vert, Claude résume et demande ; Write, Edit et
  NotebookEdit sont refusés.
- Réglages gardés d'une session à l'autre, et après un `/clear`.

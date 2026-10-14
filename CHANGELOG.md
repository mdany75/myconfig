# Changements

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

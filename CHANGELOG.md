# Changements

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

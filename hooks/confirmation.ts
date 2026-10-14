// Fonctions pures du module Confirmation : reconnaître le feu vert, et ce que le modèle lit.

import type { PromptOrigin } from 'claude-code'

// Les outils qui créent ou modifient des fichiers : refusés tant que le feu vert manque.
export const OUTILS_BLOQUES: readonly string[] = ['Write', 'Edit', 'NotebookEdit']

export const SECTION = 'myconfig:confirmation'

export const CONSIGNE = `MyConfig — mode Confirmation activé par l'utilisateur.
Avant de produire quoi que ce soit (créer ou modifier un fichier, lancer une commande qui change quelque chose, installer, publier, envoyer), résume en quelques lignes ce que tu comptes faire, puis demande à l'utilisateur s'il veut que tu procèdes, et arrête-toi là.
Tu ne produis qu'après un feu vert explicite dans son dernier message (« go », « vas-y », « tu peux y aller », « oui », « procède », « c'est bon »…).
Lire, chercher, analyser et répondre à une question restent permis sans feu vert.
Chaque message de l'utilisateur porte une note de MyConfig qui dit si le feu vert est donné ; tant qu'il ne l'est pas, les outils Write, Edit et NotebookEdit sont refusés.`

export const NOTE_FEU_VERT =
  'MyConfig Confirmation : ce message donne le feu vert. Tu peux produire ce que tu as résumé et ce qui est demandé.'

export const NOTE_ATTENTE =
  'MyConfig Confirmation : ce message ne donne pas le feu vert. Ne crée et ne modifie rien : résume ce que tu comptes faire, puis demande s’il faut procéder.'

export const REFUS =
  'MyConfig Confirmation : pas de feu vert dans le dernier message de l’utilisateur. Ne modifie rien : résume ce que tu comptes faire et demande-lui s’il faut procéder (il répondra « go », « vas-y », « tu peux y aller »…).'

const normaliser = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'")

// « non » seul (pas « non-régression »), « attends », « pas encore », « stop »…
const NEGATION =
  /(?:^|[^\w-])(?:non|nope|stop|attends?|pas encore|pas tout de suite|pas maintenant|ne (?:fais|procede|produis|cree|modifie) (?:rien|pas))(?![\w-])/

const FEU_VERT =
  /(?:^|[^\w-])(?:go|vas[- ]y|va[- ]y|tu peux y aller|tu peux proceder|tu peux le faire|on y va|procede|proceder|fonce|oui|ouais|ok|okay|d'accord|c'est bon|c'est parfait|parfait|je confirme|confirme|approuve|let'?s go|go ahead|yes|yep)(?![\w-])/

/** Vrai quand le message donne le feu vert sans le reprendre aussitôt. */
export function estFeuVert(texte: string): boolean {
  const t = normaliser(texte)
  return FEU_VERT.test(t) && !NEGATION.test(t)
}

/** Vrai pour un message que l'utilisateur a écrit ou choisi (pas une notification, ni une relance). */
export function estDeLUtilisateur(origine: PromptOrigin): boolean {
  switch (origine.kind) {
    case 'composer':
    case 'bridge':
    case 'sdk':
      return true
    case 'plugin':
      return origine.asUser === true
    default:
      return false
  }
}

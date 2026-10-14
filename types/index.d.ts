/** Les six modules de MyConfig, dans l'ordre des onglets du panneau. */
export type Module = 'son' | 'relais' | 'correction' | 'stats' | 'proposition' | 'confirmation' | 'progression'

/** Les propositions côte à côte (`ligne`) ou une par ligne (`liste`). */
export type Disposition = 'ligne' | 'liste'

/** Les réglages de MyConfig, gardés d'une session à l'autre dans `$.store`. */
export type Reglages = {
  son: boolean
  relais: boolean
  /** Toujours `ameliorer || corriger` : la Correction est à Off quand aucun bouton n'est affiché. */
  correction: boolean
  stats: boolean
  proposition: boolean
  confirmation: boolean
  progression: boolean
  /** Bouton « ✎ Améliorer » affiché dans la bande. */
  ameliorer: boolean
  /** Bouton « ✓ Correction » affiché dans la bande. */
  corriger: boolean
  /** Nombre de propositions, de 1 à 5. */
  nombre: number
  disposition: Disposition
}

/** Une limite d'utilisation du forfait (5 heures, hebdomadaire…), telle que la dernière réponse l'a donnée. */
export type Limite = {
  /** `five_hour`, `seven_day`, `spend_limit` ou une autre fenêtre du forfait. */
  kind: string
  /** Part utilisée, de 0 à 100. */
  pourcent: number
  /** Remise à zéro, en ISO 8601, si elle est connue. */
  reinit: string | null
}

/** Les chiffres de la dernière mesure de la session. */
export type Mesure = {
  /** Début de la session, en millisecondes depuis l'époque (`startedAt`). */
  debut: number
  /** Jetons d'entrée de la dernière réponse, absents avant la première. */
  jetons: number | null
  /** Taille de la fenêtre de contexte du modèle, en jetons. */
  fenetre: number
  /** Part du contexte utilisée, de 0 à 100. */
  contexte: number | null
  /** Les limites d'utilisation du forfait ; vide hors abonnement ou avant la première réponse. */
  limites: Limite[]
}

/** Une étape de la liste de tâches de Claude, avec ses heures (millisecondes). */
export type EtapeProgression = {
  /** L'identifiant de TaskCreate, ou `todo-<n>` pour une étape de TodoWrite. */
  id: string
  titre: string
  statut: 'attente' | 'en_cours' | 'faite'
  debut: number | null
  fin: number | null
}

/** La tâche longue en cours : son titre (la consigne), ses étapes, son début et sa fin. */
export type Progression = {
  titre: string
  debut: number
  /** Fin du tour qui l'a terminée ou mise en pause ; rien tant qu'elle tourne. */
  fin: number | null
  etapes: EtapeProgression[]
  /** Vrai pour l'exemple du panneau, qui ne suit aucune vraie tâche. */
  exemple: boolean
}

/**
 * Où en est le relais : rien, le bouton attend le deuxième clic, le récapitulatif
 * s'écrit, ou la conversation s'efface.
 */
export type EtapeRelais = 'a-confirmer' | 'redaction' | 'effacement' | null

/** Ce que la Correction fait en ce moment : améliorer le prompt, corriger le texte, ou rien. */
export type TravailCorrection = 'ameliorer' | 'corriger' | null

declare module 'claude-code' {
  interface PluginState {
    myconfig: {
      /** Les réglages ; rien après un « /clear », qui vide $.state (on relit alors $.store). */
      reglages: Reglages | null
      /** L'onglet affiché dans le panneau. */
      onglet: Module
      /** La dernière mesure, ou rien avant la première. */
      mesure: Mesure | null
      /** Vrai quand un clic sur les Stats a ouvert la vue des limites d'utilisation. */
      limitesOuvertes: boolean
      /** L'heure de la dernière mise à jour de la durée, en millisecondes. */
      maintenant: number | null
      /** Les propositions affichées, ou rien. */
      suites: string[] | null
      /** Vrai pendant que le modèle cherche les propositions. */
      suitesEnCours: boolean
      /** Le texte de l'utilisateur avant la première correction, tant qu'on peut y revenir. */
      original: string | null
      /** Le dernier texte que la Correction a mis dans le champ. */
      improved: string | null
      /** Le travail de la Correction pendant l'appel au modèle, ou rien. */
      correctionEnCours: TravailCorrection
      /** L'étape du relais en cours, ou rien au repos. */
      etapeRelais: EtapeRelais
      /** Vrai quand le dernier message de l'utilisateur donne le feu vert (module Confirmation). */
      feuVert: boolean
      /** La tâche longue suivie par le module Progression, ou rien. */
      progression: Progression | null
    }
  }
}

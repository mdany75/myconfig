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
  /** Toujours `avecListe || sansListe` : la Progression est à Off quand aucun mode n'est affiché. */
  progression: boolean
  /** Barre fine et chapelet quand Claude suit une liste de tâches. */
  avecListe: boolean
  /** Piste de temps des actions quand Claude n'a pas de liste de tâches. */
  sansListe: boolean
  /** Bouton « ✎ Améliorer » affiché dans la bande. */
  ameliorer: boolean
  /** Bouton « ✓ Correction » affiché dans la bande. */
  corriger: boolean
  /** Nombre de propositions, de 1 à 5. */
  nombre: number
  disposition: Disposition
  /**
   * Secondes pendant lesquelles la Progression reste affichée après la fin : 0 (instantané), 5, 10
   * ou 15 ; `null` (jamais) : elle reste jusqu'à un clic sur la barre.
   */
  disparaitApres: number | null
  /** Actions que le journal déplié montre : 3, 6, 9 ou 12 ; `null` : toutes celles qui tiennent. */
  journalLignes: number | null
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

/** La sorte d'une action du mode sans liste : commande, lecture, modification, ou autre. */
export type SorteAction = 'bash' | 'lecture' | 'modif' | 'autre'

/**
 * Un segment de la piste du mode sans liste : des actions consécutives de même sorte.
 * `duree` cumule les actions finies (ms) ; `ouverts` donne le début de chaque action en cours.
 */
export type BlocAction = {
  sorte: SorteAction
  /** Nombre d'actions du segment. */
  n: number
  duree: number
  /** Libellé de la dernière action du segment (« Bash · Commit, push… »). */
  titre: string
  ouverts: Record<string, number>
}

/** L'outil d'une action, en clair, pour le journal et « En cours ». */
export type DescriptionAction = {
  /** L'outil : « Bash », « Read », « github · create_issue ». */
  nom: string
  /** Ce qu'il touche, en court : la description de la commande, le fichier, le motif ; vide sinon. */
  libelle: string
  /** Le détail : la commande, le dossier du fichier ; vide s'il n'apporte rien. */
  complement: string
}

/** Une action du journal, que la Progression déplie d'un clic. */
export type ActionJournal = DescriptionAction & {
  /** Le `tool_use_id` de l'appel. */
  id: string
  sorte: SorteAction
  debut: number
  /** Rien tant que l'action tourne. */
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
  /** Mode sans liste : la piste des actions du fil principal (absente avant la 0.4.0). */
  blocs?: BlocAction[]
  /** Mode sans liste : nombre d'actions par sorte. */
  comptes?: Partial<Record<SorteAction, number>>
  /** Les dernières actions du fil principal, la plus récente à la fin (absent avant la 0.6.0). */
  journal?: ActionJournal[]
  /** Vrai quand un clic l'a effacée, ou qu'une interruption l'a retirée ; elle reprend au tour suivant. */
  effacee?: boolean
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
      /** Vrai quand un clic sous la barre de Progression a déplié le journal des actions. */
      journalOuvert: boolean
      /** L'id de la première action de la page montrée (▲ ▼) ; rien : les dernières actions. */
      journalAncre: string | null
    }
  }
}

// Fonctions pures des réglages : valeurs par défaut, lecture du store, commande « /myconfig ».

import type { Disposition, Module, Reglages } from '../types'

export const MODULES: readonly Module[] = [
  'son',
  'relais',
  'correction',
  'stats',
  'proposition',
  'confirmation',
  'progression',
]

export const NOMS: Record<Module, string> = {
  son: 'Son',
  relais: 'Relais',
  correction: 'Correction',
  stats: 'Stats',
  proposition: 'Proposition',
  confirmation: 'Confirmation',
  progression: 'Progression',
}

export const ICONES: Record<Module, string> = {
  son: '♪',
  relais: '⇄',
  correction: '✎',
  stats: '◔',
  proposition: '✦',
  confirmation: '⏸',
  progression: '▰',
}

export const DESCRIPTIONS: Record<Module, string> = {
  son: 'Joue un son quand une tâche d’au moins 10 secondes se termine.',
  relais: 'Écrit un récapitulatif dans .relais/, efface la conversation et prépare le message de reprise.',
  correction: 'Améliore ta consigne en un prompt structuré, ou corrige seulement le texte, avant l’envoi.',
  stats: 'Montre à droite de la bande le contexte utilisé, en % et en jetons, et la durée de la session.',
  proposition: 'Propose des suites logiques après chaque réponse : un clic en lance une.',
  confirmation: 'Claude résume ce qu’il compte faire et attend ton feu vert avant de créer ou de modifier quoi que ce soit.',
  progression: 'L’avancement du travail : les étapes de la liste de tâches de Claude, ou une piste de temps de ses actions.',
}

export const DEFAUT: Reglages = {
  son: true,
  relais: true,
  correction: true,
  stats: true,
  proposition: true,
  confirmation: false,
  progression: true,
  avecListe: true,
  sansListe: true,
  ameliorer: true,
  corriger: true,
  nombre: 3,
  disposition: 'ligne',
  disparaitApres: 15,
  journalLignes: 6,
}

export const NOMBRE_MIN = 1
export const NOMBRE_MAX = 5

/** Les choix de « Disparaît après » de la Progression, en secondes ; 0 : instantané, null : jamais. */
export const DISPARITIONS = [0, 5, 10, 15, null] as const

export const libelleDisparition = (s: number | null) => (s === null ? 'Jamais' : s === 0 ? 'Instantané' : `${s} s`)

/** Les choix du « Détail » : les actions que le journal déplié montre ; null : illimité. */
export const LIGNES_JOURNAL = [3, 6, 9, 12, null] as const

export const libelleLignes = (n: number | null) => (n === null ? 'Illimité' : String(n))

export function borner(n: number) {
  return Math.min(NOMBRE_MAX, Math.max(NOMBRE_MIN, Math.round(n)))
}

// Les deux boutons de la Correction ; elle est à On tant qu'au moins un est affiché.
export function avecBoutons(r: Reglages, ameliorer: boolean, corriger: boolean): Reglages {
  return { ...r, ameliorer, corriger, correction: ameliorer || corriger }
}

// Les deux modes de la Progression ; elle est à On tant qu'au moins un est affiché.
export function avecModes(r: Reglages, avecListe: boolean, sansListe: boolean): Reglages {
  return { ...r, avecListe, sansListe, progression: avecListe || sansListe }
}

// Ce que le store rend peut venir d'une version plus ancienne, ou de rien : on complète et on borne.
export function completer(valeur: unknown): Reglages {
  const v = typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : {}
  const actif = (m: Module) => (typeof v[m] === 'boolean' ? (v[m] as boolean) : DEFAUT[m])
  // Avant les deux boutons, la Correction n'avait qu'un On/Off : il vaut pour les deux.
  const bouton = (cle: 'ameliorer' | 'corriger') =>
    typeof v[cle] === 'boolean' ? (v[cle] as boolean) : v.correction === false ? false : DEFAUT[cle]
  const ameliorer = bouton('ameliorer')
  const corriger = bouton('corriger')
  // Avant les deux modes, la Progression n'avait qu'un On/Off : il vaut pour les deux.
  const mode = (cle: 'avecListe' | 'sansListe') =>
    typeof v[cle] === 'boolean' ? (v[cle] as boolean) : v.progression === false ? false : DEFAUT[cle]
  const avecListe = mode('avecListe')
  const sansListe = mode('sansListe')
  return {
    son: actif('son'),
    relais: actif('relais'),
    correction: ameliorer || corriger,
    stats: actif('stats'),
    proposition: actif('proposition'),
    confirmation: actif('confirmation'),
    progression: avecListe || sansListe,
    avecListe,
    sansListe,
    ameliorer,
    corriger,
    nombre: typeof v.nombre === 'number' && Number.isFinite(v.nombre) ? borner(v.nombre) : DEFAUT.nombre,
    disposition: v.disposition === 'ligne' || v.disposition === 'liste' ? v.disposition : DEFAUT.disposition,
    disparaitApres: lireDisparition(v),
    journalLignes: lireLignes(v),
  }
}

// En 0.6.0, « Détail » allait jusqu'à 18 : au-delà de 12, on garde 12.
function lireLignes(v: Record<string, unknown>): number | null {
  if ('journalLignes' in v && LIGNES_JOURNAL.some(n => n === v.journalLignes)) {
    return v.journalLignes as number | null
  }
  return typeof v.journalLignes === 'number' && v.journalLignes > 12 ? 12 : DEFAUT.journalLignes
}

// Avant la 0.6.0, « Reste après » (`resteApres`) allait de 0 à 30 s : au-delà de 15 s, on garde 15.
function lireDisparition(v: Record<string, unknown>): number | null {
  if ('disparaitApres' in v && DISPARITIONS.some(s => s === v.disparaitApres)) {
    return v.disparaitApres as number | null
  }
  const ancien = v.resteApres
  if (typeof ancien === 'number' && Number.isFinite(ancien) && ancien >= 0) {
    return DISPARITIONS.some(s => s === ancien) ? ancien : 15
  }
  return DEFAUT.disparaitApres
}

const sansAccents = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const ALIAS: Record<string, Module> = {
  son: 'son',
  sons: 'son',
  relais: 'relais',
  correction: 'correction',
  plume: 'correction',
  stats: 'stats',
  stat: 'stats',
  jauge: 'stats',
  proposition: 'proposition',
  propositions: 'proposition',
  cap: 'proposition',
  confirmation: 'confirmation',
  confirmer: 'confirmation',
  progression: 'progression',
  progres: 'progression',
  fil: 'progression',
}

export function lireModule(mot: string): Module | undefined {
  return ALIAS[sansAccents(mot)]
}

function lireEtat(mot: string): boolean | undefined {
  const m = sansAccents(mot)
  if (/^(on|oui|actif|activer|active)$/.test(m)) {
    return true
  }
  if (/^(off|non|inactif|desactiver|desactive|couper)$/.test(m)) {
    return false
  }
  return undefined
}

function lireDisposition(mots: string[]): Disposition | undefined {
  const m = sansAccents(mots.join(' '))
  if (/^(ligne|une ligne|sur une ligne|1 ligne|cote a cote)$/.test(m)) {
    return 'ligne'
  }
  if (/^(liste|par ligne|une par ligne|lignes|colonne)$/.test(m)) {
    return 'liste'
  }
  return undefined
}

export const libelleDisposition = (d: Disposition) => (d === 'ligne' ? 'sur une ligne' : 'une par ligne')

export const onOff = (actif: boolean) => (actif ? 'On' : 'Off')

export function boutonsAffiches(r: Reglages) {
  return [r.ameliorer ? 'Améliorer' : '', r.corriger ? 'Correction' : ''].filter(b => b !== '').join(', ')
}

export function modesAffiches(r: Reglages) {
  return [r.avecListe ? 'avec liste' : '', r.sansListe ? 'sans liste' : ''].filter(m => m !== '').join(', ')
}

export function resume(r: Reglages) {
  return MODULES.map(m => {
    const base = `${NOMS[m].padEnd(13)}: ${onOff(r[m])}`
    if (m === 'proposition') {
      return `${base} · ${r.nombre} · ${libelleDisposition(r.disposition)}`
    }
    if (m === 'progression' && r.progression) {
      const disparait =
        r.disparaitApres === null
          ? 'reste jusqu’au clic'
          : r.disparaitApres === 0
            ? 'disparaît aussitôt'
            : `disparaît après ${r.disparaitApres} s`
      const detail = r.journalLignes === null ? 'détail illimité' : `détail ${r.journalLignes}`
      return `${base} · ${modesAffiches(r)} · ${disparait} · ${detail}`
    }
    return m === 'correction' && r.correction ? `${base} · ${boutonsAffiches(r)}` : base
  }).join('\n')
}

export const USAGE = [
  'MyConfig :',
  '  /myconfig                         ouvre le panneau des réglages',
  '  /myconfig etat                    résume les réglages',
  '  /myconfig <module> on | off       son, relais, correction, stats, proposition, confirmation, progression',
  '  /myconfig proposition 1 à 5       nombre de propositions',
  '  /myconfig proposition ligne | liste   sur une ligne, ou une par ligne',
  '  /myconfig ameliorer | corriger on | off   affiche ou retire un bouton de la Correction',
  '  /myconfig progression avec | sans on | off   affiche ou retire un mode de la Progression',
  '  /myconfig progression disparait 0 | 5 | 10 | 15 | jamais   secondes où la barre reste après la fin',
  '  /myconfig progression detail 3 | 6 | 9 | 12 | illimite   actions montrées dans le journal déplié',
].join('\n')

export type Changement = { reglages: Reglages; message: string } | { erreur: string }

// « /myconfig son off », « /myconfig proposition 4 », « /myconfig proposition une par ligne ».
export function appliquer(r: Reglages, args: string): Changement {
  const [premier = '', ...reste] = args.trim().split(/\s+/)

  // « /myconfig ameliorer off », « /myconfig corriger on » : un bouton de la Correction.
  const bouton = /^(ameliorer|amelioration)$/.test(sansAccents(premier))
    ? 'ameliorer'
    : /^(corriger|correcteur)$/.test(sansAccents(premier))
      ? 'corriger'
      : undefined
  if (bouton !== undefined) {
    const etatBouton = reste.length === 1 ? lireEtat(reste[0] ?? '') : undefined
    if (etatBouton === undefined) {
      return { erreur: `MyConfig : ajoute « on » ou « off » après « ${premier} ».` }
    }
    const nouveau =
      bouton === 'ameliorer' ? avecBoutons(r, etatBouton, r.corriger) : avecBoutons(r, r.ameliorer, etatBouton)
    const nom = bouton === 'ameliorer' ? '« ✎ Améliorer »' : '« ✓ Correction »'
    return {
      reglages: nouveau,
      message: `MyConfig : bouton ${nom} ${etatBouton ? 'affiché' : 'retiré'}${nouveau.correction ? '' : ' ; la Correction est à Off'}.`,
    }
  }

  const module = lireModule(premier)
  if (module === undefined) {
    return { erreur: `MyConfig : module inconnu « ${premier} ».\n${USAGE}` }
  }
  if (reste.length === 0) {
    return { erreur: `MyConfig : ${NOMS[module]} est à ${onOff(r[module])}. Ajoute « on » ou « off ».` }
  }
  const seul = reste.length === 1 ? (reste[0] ?? '') : undefined
  const etat = seul === undefined ? undefined : lireEtat(seul)
  if (etat !== undefined) {
    // La Correction suit ses deux boutons, la Progression ses deux modes : On les affiche tous, Off les retire.
    const reglages =
      module === 'correction'
        ? avecBoutons(r, etat, etat)
        : module === 'progression'
          ? avecModes(r, etat, etat)
          : { ...r, [module]: etat }
    return { reglages, message: `MyConfig : ${NOMS[module]} à ${onOff(etat)}.` }
  }
  // « /myconfig progression avec off », « … sans liste on » : un mode de la Progression.
  if (module === 'progression') {
    const etatMode = lireEtat(reste[reste.length - 1] ?? '')
    const mots = etatMode === undefined ? reste : reste.slice(0, -1)
    const mot = sansAccents(mots.join(' ')).replace(/[-_]/g, ' ')
    const cleMode = /^(avec ?(liste)?|liste)$/.test(mot)
      ? 'avecListe'
      : /^(sans ?(liste)?|piste)$/.test(mot)
        ? 'sansListe'
        : undefined
    if (cleMode !== undefined) {
      if (etatMode === undefined) {
        return { erreur: `MyConfig : ajoute « on » ou « off » après « ${mots.join(' ')} ».` }
      }
      const nouveau =
        cleMode === 'avecListe' ? avecModes(r, etatMode, r.sansListe) : avecModes(r, r.avecListe, etatMode)
      const nom = cleMode === 'avecListe' ? '« Avec liste »' : '« Sans liste »'
      return {
        reglages: nouveau,
        message: `MyConfig : mode ${nom} de la Progression ${etatMode ? 'affiché' : 'retiré'}${nouveau.progression ? '' : ' ; la Progression est à Off'}.`,
      }
    }
  }
  // « /myconfig progression disparait 5 | jamais », « … detail 12 » ;
  // un nombre seul règle « Disparaît après ».
  if (module === 'progression') {
    const [motCle = '', valeur = ''] = reste.length === 2 ? reste : ['disparait', seul ?? '']
    const cle = sansAccents(motCle)
    const v = sansAccents(valeur)
    if (/^(disparait|disparition|reste|fin)$/.test(cle)) {
      const secondes = /^jamais$/.test(v)
        ? null
        : /^(instantane|instantanement|aussitot)$/.test(v)
          ? 0
          : /^\d+$/.test(v)
            ? Number(v)
            : NaN
      if (DISPARITIONS.some(s => s === secondes)) {
        const message =
          secondes === null
            ? 'MyConfig : la Progression reste après la fin, jusqu’à un clic sur la barre.'
            : secondes === 0
              ? 'MyConfig : la Progression disparaît dès la fin.'
              : `MyConfig : la Progression disparaît ${secondes} s après la fin.`
        return { reglages: { ...r, disparaitApres: secondes }, message }
      }
      if (!Number.isNaN(secondes)) {
        return { erreur: 'MyConfig : choisis 0 (instantané), 5, 10 ou 15 secondes, ou « jamais ».' }
      }
    }
    if (/^(detail|journal|actions)$/.test(cle)) {
      const n = /^(illimite|tout|toutes|tous)$/.test(v) ? null : /^\d+$/.test(v) ? Number(v) : NaN
      if (LIGNES_JOURNAL.some(x => x === n)) {
        return {
          reglages: { ...r, journalLignes: n },
          message:
            n === null
              ? 'MyConfig : le journal déplié montre toutes les actions qui tiennent dans la bande.'
              : `MyConfig : le journal déplié montre les ${n} dernières actions.`,
        }
      }
      return { erreur: 'MyConfig : choisis 3, 6, 9 ou 12 actions, ou « illimité ».' }
    }
  }
  if (module === 'proposition') {
    if (seul !== undefined && /^\d+$/.test(seul)) {
      const nombre = Number(seul)
      if (nombre < NOMBRE_MIN || nombre > NOMBRE_MAX) {
        return { erreur: `MyConfig : le nombre de propositions va de ${NOMBRE_MIN} à ${NOMBRE_MAX}.` }
      }
      return { reglages: { ...r, nombre }, message: `MyConfig : ${nombre} proposition(s).` }
    }
    const disposition = lireDisposition(reste)
    if (disposition !== undefined) {
      return {
        reglages: { ...r, disposition },
        message: `MyConfig : propositions ${libelleDisposition(disposition)}.`,
      }
    }
  }
  return { erreur: `MyConfig : je ne comprends pas « ${reste.join(' ')} ».\n${USAGE}` }
}

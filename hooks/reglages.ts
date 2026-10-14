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
  progression: 'Les tâches : une barre fine, et un point par étape de la liste de tâches de Claude.',
}

export const DEFAUT: Reglages = {
  son: true,
  relais: true,
  correction: true,
  stats: true,
  proposition: true,
  confirmation: false,
  progression: true,
  ameliorer: true,
  corriger: true,
  nombre: 3,
  disposition: 'ligne',
  apparaitApres: 0,
  resteApres: 15,
}

export const NOMBRE_MIN = 1
export const NOMBRE_MAX = 5

/** Les choix de « Apparaît après » et « Reste après » de la Progression, en secondes ; 0 : instantané. */
export const RESTES = [0, 5, 10, 15, 20, 25, 30] as const

export const libelleReste = (s: number) => (s === 0 ? 'Instantané' : `${s} s`)

export function borner(n: number) {
  return Math.min(NOMBRE_MAX, Math.max(NOMBRE_MIN, Math.round(n)))
}

// Les deux boutons de la Correction ; elle est à On tant qu'au moins un est affiché.
export function avecBoutons(r: Reglages, ameliorer: boolean, corriger: boolean): Reglages {
  return { ...r, ameliorer, corriger, correction: ameliorer || corriger }
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
  return {
    son: actif('son'),
    relais: actif('relais'),
    correction: ameliorer || corriger,
    stats: actif('stats'),
    proposition: actif('proposition'),
    confirmation: actif('confirmation'),
    progression: actif('progression'),
    ameliorer,
    corriger,
    nombre: typeof v.nombre === 'number' && Number.isFinite(v.nombre) ? borner(v.nombre) : DEFAUT.nombre,
    disposition: v.disposition === 'ligne' || v.disposition === 'liste' ? v.disposition : DEFAUT.disposition,
    apparaitApres: RESTES.some(s => s === v.apparaitApres) ? (v.apparaitApres as number) : DEFAUT.apparaitApres,
    resteApres: RESTES.some(s => s === v.resteApres) ? (v.resteApres as number) : DEFAUT.resteApres,
  }
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

export function resume(r: Reglages) {
  return MODULES.map(m => {
    const base = `${NOMS[m].padEnd(13)}: ${onOff(r[m])}`
    if (m === 'proposition') {
      return `${base} · ${r.nombre} · ${libelleDisposition(r.disposition)}`
    }
    if (m === 'progression' && r.progression) {
      const apparait = r.apparaitApres === 0 ? 'apparaît aussitôt' : `apparaît après ${r.apparaitApres} s`
      const reste = r.resteApres === 0 ? 'ferme instantanément' : `reste ${r.resteApres} s`
      return `${base} · ${apparait} · ${reste}`
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
  '  /myconfig progression apparait 0 à 30   secondes de travail avant que la barre apparaisse',
  '  /myconfig progression reste 0 à 30      secondes où la barre reste après la fin (0 : instantané)',
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
    // La Correction suit ses deux boutons : On les affiche tous les deux, Off les retire.
    const reglages = module === 'correction' ? avecBoutons(r, etat, etat) : { ...r, [module]: etat }
    return { reglages, message: `MyConfig : ${NOMS[module]} à ${onOff(etat)}.` }
  }
  // « /myconfig progression apparait 10 », « … reste 5 » ; un nombre seul règle « reste ».
  if (module === 'progression') {
    const [motCle = '', valeur = ''] = reste.length === 2 ? reste : ['reste', seul ?? '']
    const cle = /^(apparait|apparition|delai)$/.test(sansAccents(motCle))
      ? 'apparaitApres'
      : /^(reste|restes|fin)$/.test(sansAccents(motCle))
        ? 'resteApres'
        : undefined
    const secondes = /^(instantane|instantanement|aussitot|0)$/.test(sansAccents(valeur))
      ? 0
      : /^\d+$/.test(valeur)
        ? Number(valeur)
        : NaN
    if (cle !== undefined && !Number.isNaN(secondes)) {
      if (!RESTES.some(s => s === secondes)) {
        return { erreur: `MyConfig : choisis ${RESTES.slice(1).join(', ')} secondes, ou 0 (instantané).` }
      }
      const message =
        cle === 'apparaitApres'
          ? secondes === 0
            ? 'MyConfig : la Progression apparaît aussitôt.'
            : `MyConfig : la Progression apparaît après ${secondes} s de travail.`
          : secondes === 0
            ? 'MyConfig : la Progression ferme instantanément après la fin.'
            : `MyConfig : la Progression reste ${secondes} s après la fin.`
      return { reglages: { ...r, [cle]: secondes }, message }
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

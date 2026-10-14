// Fonctions pures du module Progression (variante 1, « barre fine et chapelet ») : les étapes
// viennent de la liste de tâches de Claude (TodoWrite, TaskCreate, TaskUpdate).

import type { EtapeProgression, Progression } from '../types'

/** Une tâche terminée reste dans la bande, avec sa coche ✓, ce temps-là. */
export const AFFICHAGE_FIN_MS = 15_000
/** L'exemple du panneau reste affiché ce temps-là. */
export const EXEMPLE_MS = 20_000
/** Au-delà, le chapelet se resserre : les points en trop sont comptés. */
export const POINTS_MAX = 20

export function titreDe(texte: string) {
  const ligne = texte.trim().split('\n')[0]?.trim() ?? ''
  if (ligne === '') {
    return 'Suite du travail'
  }
  return ligne.length > 60 ? `${ligne.slice(0, 59)}…` : ligne
}

export function nouvelle(texte: string, maintenant: number): Progression {
  return { titre: titreDe(texte), debut: maintenant, fin: null, etapes: [], exemple: false }
}

export const terminee = (p: Progression) => p.etapes.length > 0 && p.etapes.every(e => e.statut === 'faite')

/**
 * Au début d'un tour : une tâche aux étapes inachevées continue (Claude reprend sa liste),
 * sinon une nouvelle commence, au titre de la consigne.
 */
export function demarrer(p: Progression | null, texte: string, maintenant: number): Progression {
  if (p !== null && !p.exemple && p.etapes.length > 0 && !terminee(p)) {
    return { ...p, fin: null }
  }
  if (texte.trim() === '' && p !== null && !p.exemple) {
    return { ...p, fin: null }
  }
  return nouvelle(texte, maintenant)
}

// Fait passer une étape à un nouveau statut en notant ses heures.
function changer(e: EtapeProgression, statut: EtapeProgression['statut'], maintenant: number, depart: number) {
  if (e.statut === statut) {
    return e
  }
  if (statut === 'en_cours') {
    return { ...e, statut, debut: e.debut ?? maintenant, fin: null }
  }
  if (statut === 'faite') {
    return { ...e, statut, debut: e.debut ?? depart, fin: maintenant }
  }
  return { ...e, statut, fin: null }
}

// Fin de la dernière étape faite, ou début de la tâche : le départ d'une étape cochée d'un coup.
const depart = (p: Progression, etapes: EtapeProgression[]) =>
  etapes.reduce((max, e) => (e.fin !== null && e.fin > max ? e.fin : max), p.debut)

const STATUTS = { pending: 'attente', in_progress: 'en_cours', completed: 'faite' } as const

export type Todo = { content: string; status: string; activeForm?: string }

/** TodoWrite remplace la liste entière ; les étapes connues gardent leurs heures. */
export function appliquerTodos(p: Progression, todos: readonly Todo[], maintenant: number): Progression {
  const anciennes = new Map(p.etapes.map(e => [e.titre, e]))
  const etapes: EtapeProgression[] = []
  for (const [i, todo] of todos.entries()) {
    const connue = anciennes.get(todo.content) ?? {
      id: `todo-${i}`,
      titre: todo.content,
      statut: 'attente' as const,
      debut: null,
      fin: null,
    }
    const statut = STATUTS[todo.status as keyof typeof STATUTS] ?? 'attente'
    etapes.push(changer(connue, statut, maintenant, depart(p, etapes)))
  }
  return { ...p, etapes }
}

/** TaskCreate : une étape de plus, en attente. */
export function ajouterEtape(p: Progression, id: string, titre: string): Progression {
  if (p.etapes.some(e => e.id === id)) {
    return p
  }
  return { ...p, etapes: [...p.etapes, { id, titre, statut: 'attente', debut: null, fin: null }] }
}

/** TaskUpdate : nouveau statut ou nouveau titre ; « deleted » retire l'étape. */
export function majEtape(
  p: Progression,
  id: string,
  champs: { statut?: string; titre?: string },
  maintenant: number,
): Progression {
  if (champs.statut === 'deleted') {
    return { ...p, etapes: p.etapes.filter(e => e.id !== id) }
  }
  const debut = depart(p, p.etapes)
  return {
    ...p,
    etapes: p.etapes.map(e => {
      if (e.id !== id) {
        return e
      }
      const renommee = champs.titre === undefined ? e : { ...e, titre: champs.titre }
      const statut = STATUTS[champs.statut as keyof typeof STATUTS]
      return statut === undefined ? renommee : changer(renommee, statut, maintenant, debut)
    }),
  }
}

export type Compte = {
  faites: number
  total: number
  /** L'étape en cours, ou la première en attente ; rien quand tout est fait. */
  courante: EtapeProgression | undefined
  /** Son rang, de 1 au total. */
  rang: number
}

export function compter(p: Progression): Compte {
  const faites = p.etapes.filter(e => e.statut === 'faite').length
  const index =
    p.etapes.findIndex(e => e.statut === 'en_cours') >= 0
      ? p.etapes.findIndex(e => e.statut === 'en_cours')
      : p.etapes.findIndex(e => e.statut === 'attente')
  return { faites, total: p.etapes.length, courante: p.etapes[index], rang: index + 1 }
}

/** Les étapes faites, plus la moitié de celle en cours, sur le total. */
export function pourcentage(p: Progression) {
  if (p.etapes.length === 0) {
    return 0
  }
  const faites = p.etapes.filter(e => e.statut === 'faite').length
  const enCours = p.etapes.some(e => e.statut === 'en_cours') ? 0.5 : 0
  return Math.round(((faites + enCours) / p.etapes.length) * 100)
}

/** Le temps restant, au rythme des étapes déjà faites : « ~3 min », « < 1 min », ou rien. */
export function resteEstime(p: Progression, maintenant: number) {
  const part = pourcentage(p) / 100
  const faites = p.etapes.filter(e => e.statut === 'faite').length
  if (faites === 0 || part <= 0 || part >= 1) {
    return ''
  }
  const reste = ((maintenant - p.debut) * (1 - part)) / part
  const minutes = Math.round(reste / 60_000)
  return minutes < 1 ? '< 1 min' : `~${minutes} min`
}

export function duree(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  if (m >= 60) {
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
  }
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`
}

/** Le chapelet : un point par étape, au plus POINTS_MAX ; les points en trop sont comptés. */
export function chapelet(p: Progression): { faits: string; courant: string; restants: string; reste: number } {
  const statuts = p.etapes.map(e => e.statut)
  const montres = statuts.slice(0, POINTS_MAX)
  const point = (s: EtapeProgression['statut']) => (s === 'faite' ? '●' : s === 'en_cours' ? '◉' : '○')
  const i = montres.findIndex(s => s !== 'faite')
  const faits = (i < 0 ? montres : montres.slice(0, i)).map(point)
  const courant = i >= 0 && montres[i] === 'en_cours' ? '◉' : ''
  const restants = (i < 0 ? [] : montres.slice(courant === '' ? i : i + 1)).map(point)
  return {
    faits: faits.join(' '),
    courant,
    restants: restants.join(' '),
    reste: statuts.length - montres.length,
  }
}

/** Visible pendant la tâche, puis AFFICHAGE_FIN_MS après sa fin ; jamais sans étapes. */
export function visible(p: Progression | null, maintenant: number) {
  if (p === null || p.etapes.length === 0) {
    return false
  }
  if (p.exemple) {
    // Une minuterie retire l'exemple après EXEMPLE_MS.
    return true
  }
  return p.fin === null || maintenant - p.fin < AFFICHAGE_FIN_MS
}

/** L'exemple du panneau : 7 étapes, 3 faites, la 4e en cours. */
export function exemple(maintenant: number): Progression {
  const titres = ['Lire', 'Analyser', 'Convertir', 'Valider', 'Tester', 'Documenter', 'Publier']
  const minute = 60_000
  return {
    titre: 'Migration des presets (exemple)',
    debut: maintenant - 4 * minute,
    fin: null,
    exemple: true,
    etapes: titres.map((titre, i) => ({
      id: `exemple-${i}`,
      titre,
      statut: i < 3 ? 'faite' : i === 3 ? 'en_cours' : 'attente',
      debut: i <= 3 ? maintenant - (4 - i) * minute : null,
      fin: i < 3 ? maintenant - (3 - i) * minute : null,
    })),
  }
}

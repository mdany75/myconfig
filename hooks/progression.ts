// Fonctions pures du module Progression (variante 1, « barre fine et chapelet ») : les étapes
// viennent de la liste de tâches de Claude (TodoWrite, TaskCreate, TaskUpdate).

import type { BlocAction, EtapeProgression, Progression, SorteAction } from '../types'

/** Par défaut, une tâche terminée reste dans la bande, avec sa coche ✓, ce temps-là (réglable). */
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

/**
 * Visible une fois la tâche en marche depuis `apparaitMs`, puis `resteMs` après sa fin (0 : plus du
 * tout) ; jamais sans étapes ni actions. Une tâche finie avant `apparaitMs` ne s'affiche pas du tout.
 */
export function visible(
  p: Progression | null,
  maintenant: number,
  resteMs: number = AFFICHAGE_FIN_MS,
  apparaitMs = 0,
) {
  if (p === null || (p.etapes.length === 0 && (p.blocs ?? []).length === 0)) {
    return false
  }
  if (p.exemple) {
    // Une minuterie retire l'exemple après EXEMPLE_MS.
    return true
  }
  if ((p.fin ?? maintenant) - p.debut < apparaitMs) {
    return false
  }
  return p.fin === null || maintenant - p.fin < resteMs
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

// ── Mode sans liste : la piste de temps ───────────────────────────────────────
// Sans liste de tâches, chaque action du fil principal ajoute un segment à la piste, aussi long
// qu'elle a duré. La piste se remplit de gauche à droite et n'atteint 100 % qu'à la fin.

/** Au-delà, les deux premiers segments sont fondus en un. */
export const BLOCS_MAX = 40
/** La piste est à moitié pleine après ce temps de travail : part = t / (t + DEMI_PISTE_MS). */
export const DEMI_PISTE_MS = 15_000

/** Les outils qui ne sont pas des actions : la liste de tâches, les questions, le mode plan. */
const NON_SUIVIS = /^(TodoWrite|Task(Create|Update|Get|List|Stop)|AskUserQuestion|EnterPlanMode|ExitPlanMode)$/

export const suivre = (outil: string) => !NON_SUIVIS.test(outil)

export function sorteDe(outil: string): SorteAction {
  if (/^(Bash|BashOutput|KillShell|PowerShell|Monitor)$/.test(outil)) {
    return 'bash'
  }
  if (/^(Read|Grep|Glob|LS|LSP|WebFetch|WebSearch|ToolSearch|ListMcpResourcesTool|ReadMcpResource\w*)$/.test(outil)) {
    return 'lecture'
  }
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(outil)) {
    return 'modif'
  }
  return 'autre'
}

export const NOMS_SORTES: Record<SorteAction, string> = {
  bash: 'Bash',
  lecture: 'Lecture',
  modif: 'Modif.',
  autre: 'Autre',
}

/** L'outil en clair, pour « En cours » (repris de fil). */
export function libelleOutil(outil: string, entree: Record<string, unknown>) {
  const texte = (k: string) => (typeof entree[k] === 'string' ? (entree[k] as string) : '')
  const fichier = (k: string) => texte(k).split('/').pop() ?? ''
  const court = (s: string) => (s.length > 48 ? `${s.slice(0, 47)}…` : s)
  let detail = ''
  if (outil === 'Bash') {
    detail = texte('description') || texte('command')
  } else if (outil === 'Read' || outil === 'Edit' || outil === 'Write' || outil === 'NotebookEdit') {
    detail = fichier('file_path') || fichier('notebook_path')
  } else if (outil === 'Grep' || outil === 'Glob') {
    detail = texte('pattern')
  } else if (outil === 'WebFetch') {
    detail = texte('url')
  } else if (outil === 'WebSearch') {
    detail = texte('query')
  } else if (outil === 'Agent') {
    detail = texte('description')
  }
  const nom = outil.startsWith('mcp__') ? outil.split('__').slice(1).join(' · ') : outil
  return detail === '' ? nom : `${nom} · ${court(detail.split('\n')[0] ?? '')}`
}

/** Une action commence : elle rejoint le dernier segment s'il est de même sorte. */
export function debuterAction(p: Progression, id: string, sorte: SorteAction, titre: string, maintenant: number) {
  const blocs = [...(p.blocs ?? [])]
  const dernier = blocs[blocs.length - 1]
  if (dernier !== undefined && dernier.sorte === sorte) {
    blocs[blocs.length - 1] = { ...dernier, n: dernier.n + 1, titre, ouverts: { ...dernier.ouverts, [id]: maintenant } }
  } else {
    blocs.push({ sorte, n: 1, duree: 0, titre, ouverts: { [id]: maintenant } })
  }
  // Trop de segments : les deux plus anciens se fondent, à la sorte du plus long.
  while (blocs.length > BLOCS_MAX) {
    const [a, b] = blocs as [BlocAction, BlocAction, ...BlocAction[]]
    blocs.splice(0, 2, {
      sorte: a.duree >= b.duree ? a.sorte : b.sorte,
      n: a.n + b.n,
      duree: a.duree + b.duree,
      titre: b.titre,
      ouverts: { ...a.ouverts, ...b.ouverts },
    })
  }
  const comptes = { ...(p.comptes ?? {}), [sorte]: (p.comptes?.[sorte] ?? 0) + 1 }
  return { ...p, blocs, comptes }
}

/** Une action finit : sa durée s'ajoute à son segment. */
export function finirAction(p: Progression, id: string, maintenant: number): Progression {
  const blocs = (p.blocs ?? []).map(b => {
    const debut = b.ouverts[id]
    if (debut === undefined) {
      return b
    }
    const ouverts = { ...b.ouverts }
    delete ouverts[id]
    return { ...b, duree: b.duree + Math.max(0, maintenant - debut), ouverts }
  })
  return { ...p, blocs }
}

export type Segment = { sorte: SorteAction; duree: number; enCours: boolean }

/** Les segments à dessiner, la durée des actions en cours comptée jusqu'à maintenant. */
export function segmentsPiste(p: Progression, maintenant: number): Segment[] {
  return (p.blocs ?? []).map(b => {
    const ouverts = Object.values(b.ouverts)
    const enCours = ouverts.reduce((total, debut) => total + Math.max(0, maintenant - debut), 0)
    return { sorte: b.sorte, duree: b.duree + enCours, enCours: ouverts.length > 0 }
  })
}

/** L'action en cours (la plus récente), ou rien. */
export function actionCourante(p: Progression): string | undefined {
  const blocs = p.blocs ?? []
  for (let i = blocs.length - 1; i >= 0; i--) {
    const b = blocs[i]
    if (b !== undefined && Object.keys(b.ouverts).length > 0) {
      return b.titre
    }
  }
  return undefined
}

export const totalActions = (p: Progression) =>
  Object.values(p.comptes ?? {}).reduce((total: number, n) => total + (n ?? 0), 0)

/** La part remplie de la piste : de gauche à droite, de plus en plus lentement, 100 % à la fin. */
export function remplissagePiste(p: Progression, maintenant: number) {
  if (p.fin !== null) {
    return 1
  }
  const ecoule = Math.max(0, maintenant - p.debut)
  return ecoule / (ecoule + DEMI_PISTE_MS)
}

/** Partage `largeur` cellules entre les durées : chacune au moins 1, le total exact. */
export function repartir(durees: readonly number[], largeur: number): number[] {
  if (durees.length === 0 || largeur <= 0) {
    return durees.map(() => 0)
  }
  if (largeur < durees.length) {
    return durees.map((_, i) => (i < largeur ? 1 : 0))
  }
  const somme = durees.reduce((a, b) => a + b, 0) || 1
  const brut = durees.map(d => (d / somme) * largeur)
  const parts = brut.map(x => Math.max(1, Math.floor(x)))
  let reste = largeur - parts.reduce((a, b) => a + b, 0)
  const ordre = brut.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])
  for (let j = 0; reste > 0; j = (j + 1) % ordre.length) {
    const i = ordre[j]?.[1] ?? 0
    parts[i] = (parts[i] ?? 0) + 1
    reste--
  }
  while (reste < 0) {
    const i = parts.indexOf(Math.max(...parts))
    parts[i] = (parts[i] ?? 1) - 1
    reste++
  }
  return parts
}

/** Les teintes des sortes, et le vert de la fin. */
export const TEINTES_SORTES: Record<SorteAction, string> = {
  bash: '#3b82f6',
  lecture: '#7F77DD',
  modif: '#1D9E75',
  autre: '#8b949e',
}
export const VERT_FIN = '#2ea043'

/**
 * La piste de l'app de bureau : un rail gris arrondi, la part remplie à gauche, un segment par
 * bloc (2 px entre eux) ; le segment en cours pulse. Tout passe au vert à la fin.
 */
export function pisteSvg(segments: readonly Segment[], part: number, largeur: number, fini: boolean) {
  const h = 8
  const rempli = Math.round(largeur * Math.min(1, Math.max(0, part)))
  const espaces = Math.max(0, segments.length - 1) * 2
  const somme = segments.reduce((a, s) => a + s.duree, 0) || 1
  let x = 0
  let rects = ''
  for (const [i, s] of segments.entries()) {
    const reste = i === segments.length - 1
    const w = reste ? Math.max(1, rempli - x) : Math.max(1, Math.round(((rempli - espaces) * s.duree) / somme))
    const teinte = fini ? VERT_FIN : TEINTES_SORTES[s.sorte]
    const pouls = s.enCours && !fini ? `<animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite"/>` : ''
    rects += `<rect x="${x}" width="${Math.max(0, Math.min(w, rempli - x))}" height="${h}" fill="${teinte}">${pouls}</rect>`
    x += w + 2
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${h}" viewBox="0 0 ${largeur} ${h}">` +
    `<clipPath id="rail"><rect width="${largeur}" height="${h}" rx="${h / 2}"/></clipPath>` +
    `<g clip-path="url(#rail)"><rect width="${largeur}" height="${h}" fill="#8b949e" fill-opacity="0.25"/>${rects}</g>` +
    `</svg>`
  )
}

/** L'exemple sans liste du panneau : les actions d'une publication, en millisecondes. */
export const EXEMPLE_SANS_LISTE: readonly { outil: string; titre: string; ms: number }[] = [
  { outil: 'Read', titre: 'Read · README.md', ms: 1500 },
  { outil: 'Bash', titre: 'Bash · Valide le mod', ms: 2500 },
  { outil: 'Read', titre: 'Read · CHANGELOG.md', ms: 1000 },
  { outil: 'Edit', titre: 'Edit · plugin.json', ms: 2000 },
  { outil: 'Bash', titre: 'Bash · Lance les tests', ms: 5000 },
  { outil: 'Edit', titre: 'Edit · CHANGELOG.md', ms: 1500 },
  { outil: 'Bash', titre: 'Bash · Commit, push, tag', ms: 6500 },
  { outil: 'Bash', titre: 'Bash · Publie la release', ms: 3000 },
]

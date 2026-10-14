import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionContextUsage } from 'claude-code'

import { estFeuVert, NOTE_ATTENTE, NOTE_FEU_VERT, REFUS, SECTION } from '../hooks/confirmation'
import { CONSIGNE as CONSIGNE_PROMPT, CONSIGNE_ORTHOGRAPHE } from '../hooks/correction'
import { SECTION as SECTION_CROQUIS } from '../hooks/croquis'
import { lireVersion, messageMiseAJour, statutVersion } from '../hooks/mise-a-jour'
import { cheminMarqueur, chercherChangement, dossierMods } from '../hooks/recharge'
import {
  actionCourante,
  appliquerTodos,
  aResumer,
  CONSIGNE_TITRE,
  chapelet,
  compter,
  ancrePrecedente,
  ancreSuivante,
  debuterAction,
  decrireOutil,
  demarrer,
  finirAction,
  JOURNAL_MAX,
  libelleOutil,
  lignesJournal,
  majEtape,
  nettoyerTitre,
  nouvelle,
  pageJournal,
  rangeesTexte,
  pourcentage,
  remplissagePiste,
  repartir,
  resteEstime,
  segmentsPiste,
  sorteDe,
  titreDe,
  totalActions,
  visible,
} from '../hooks/progression'
import { consigne, extraire } from '../hooks/proposition'
import { appliquer, completer, DEFAUT, MODULES, RELAIS_TOUJOURS } from '../hooks/reglages'
import {
  cellules,
  couleur,
  delai,
  dollars,
  dureeSession,
  glyphe,
  jetons,
  minutes,
  nomCourt,
  nomLimite,
  partsContexte,
  remplissage,
  trierLimites,
} from '../hooks/stats'

const SURFACES = ['terminal', 'desktop'] as const

const bande = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 140,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  },
} as const

const panneau = {
  component: 'Pane',
  requestId: 'myconfig',
  props: {
    title: 'MyConfig',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

const SUITES = ['Lance les tests', 'Ajoute un README', "Corrige l'erreur 42", 'Publie la version', 'Refais la capture']

const MAINTENANT = 12 * 60_000
const HEURE = 3_600_000

// Les limites du forfait que la session rapporte ; un test peut les changer entre deux lectures.
const forfait = () => ({
  limites: [
    { kind: 'seven_day', percentUsed: 26, resetsAt: new Date(MAINTENANT + 4 * 24 * HEURE).toISOString() },
    { kind: 'five_hour', percentUsed: 8, resetsAt: new Date(MAINTENANT + 2 * HEURE).toISOString() },
  ],
})

// Le contenu du contexte, comme « /context » le compte (seules les parts servent au mod).
const CATEGORIES = [
  { name: 'System prompt', tokens: 12_000, color: 'promptBorder', isDeferred: false, kind: 'used' as const },
  { name: 'MCP tools', tokens: 30_000, color: 'cyan', isDeferred: true, kind: 'deferred' as const },
  { name: 'Messages', tokens: 56_000, color: 'permission', isDeferred: false, kind: 'used' as const },
  { name: 'Free space', tokens: 99_000, color: 'inactive', isDeferred: false, kind: 'free' as const },
  { name: 'Autocompact buffer', tokens: 33_000, color: 'inactive', isDeferred: false, kind: 'buffer' as const },
]
const CONTENU = { categories: CATEGORIES } as unknown as NonNullable<SessionContextUsage['breakdown']>

// Le monde sous le mod : store, horloge à 12 minutes, contexte à 34 %, modèle et prompts simulés.
function simuler(on: On, envoyes: string[] = [], store: Record<string, unknown> = {}, limites = forfait()) {
  mock.store(on, store)
  const horloge = mock.clock(on, { now: MAINTENANT })
  on('session.usage', (_$, e) => ({
    value: {
      startedAt: 0,
      context: {
        tokens: 68_000,
        window: 200_000,
        percent: 34,
        ...(e.breakdown === undefined ? {} : { breakdown: CONTENU }),
      },
      rateLimits: limites.limites,
      cost: { usd: 4.82 },
    },
  }))
  on('model.fork', () => ({
    value: { isAnswered: true as const, text: JSON.stringify(SUITES), usage: USAGE },
  }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.submit', ($, e) => {
    envoyes.push(e.text)
    return { text: e.text, ...(e.context === undefined ? {} : { context: e.context }) }
  })
  // Sans autre mod : le moteur ne dessine rien de lui-même dans la bande.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine' as const, ref: 0 }))
  return horloge
}

async function myconfig($: Engine, args: string) {
  return $.command.run({
    command: 'myconfig',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 140 },
  })
}

// Ce que « /myconfig etat » répond : les réglages tels que le mod les lit.
async function etat($: Engine) {
  return ((await myconfig($, 'etat')) as { text: string }).text
}

describe('fonctions pures', () => {
  test('le feu vert est reconnu, sa reprise aussi', () => {
    for (const oui of ['go', 'Vas-y !', 'tu peux y aller', 'Oui, procède', 'ok', "C'est bon", 'go, ajoute des tests de non-régression']) {
      expect(estFeuVert(oui)).toBe(true)
    }
    for (const non of ['Ajoute un bouton', 'Non, attends', 'oui mais attends', 'explique-moi Google', 'pas encore', 'algorithme']) {
      expect(estFeuVert(non)).toBe(false)
    }
  })

  test('les réglages lus du store sont complétés et bornés', () => {
    expect(completer(undefined)).toEqual(DEFAUT)
    expect(completer({ son: false, nombre: 9, disposition: 'nimporte' })).toEqual({ ...DEFAUT, son: false, nombre: 5 })
  })

  test('« /myconfig » change un réglage', () => {
    const off = appliquer(DEFAUT, 'son off')
    expect('reglages' in off && off.reglages.son).toBe(false)
    const quatre = appliquer(DEFAUT, 'proposition 4')
    expect('reglages' in quatre && quatre.reglages.nombre).toBe(4)
    const liste = appliquer(DEFAUT, 'proposition une par ligne')
    expect('reglages' in liste && liste.reglages.disposition).toBe('liste')
    const jauge = appliquer(DEFAUT, 'jauge off')
    expect('reglages' in jauge && jauge.reglages.stats).toBe(false)
    expect('erreur' in appliquer(DEFAUT, 'proposition 7')).toBe(true)
    expect('erreur' in appliquer(DEFAUT, 'lune on')).toBe(true)
    // Le Relais n'a plus d'On / Off : il vit dans l'onglet Stats.
    expect(appliquer(DEFAUT, 'relais off')).toEqual({ erreur: RELAIS_TOUJOURS })
    expect(MODULES).not.toContain('relais')
    expect(completer({ relais: false })).toEqual(DEFAUT)
    // Croquis : à Off par défaut, « /myconfig croquis on » (ou « œil ») l'allume.
    expect(DEFAUT.croquis).toBe(false)
    const croquis = appliquer(DEFAUT, 'croquis on')
    expect('reglages' in croquis && croquis.reglages.croquis).toBe(true)
    const oeil = appliquer({ ...DEFAUT, croquis: true }, 'œil off')
    expect('reglages' in oeil && oeil.reglages.croquis).toBe(false)
    expect('erreur' in appliquer(DEFAUT, 'croquis')).toBe(true)
  })

  test('la Correction suit ses deux boutons', () => {
    const ancien = completer({ correction: false })
    expect([ancien.ameliorer, ancien.corriger, ancien.correction]).toEqual([false, false, false])
    const sansAmeliorer = appliquer(DEFAUT, 'ameliorer off')
    expect('reglages' in sansAmeliorer && sansAmeliorer.reglages).toEqual({ ...DEFAUT, ameliorer: false })
    const aucun = 'reglages' in sansAmeliorer ? appliquer(sansAmeliorer.reglages, 'corriger off') : sansAmeliorer
    expect('reglages' in aucun && aucun.reglages.correction).toBe(false)
    const remis = 'reglages' in aucun ? appliquer(aucun.reglages, 'correction on') : aucun
    expect('reglages' in remis && remis.reglages).toEqual(DEFAUT)
  })

  test('la Progression suit ses deux modes', () => {
    const ancien = completer({ progression: false })
    expect([ancien.avecListe, ancien.sansListe, ancien.progression]).toEqual([false, false, false])
    const sansPiste = appliquer(DEFAUT, 'progression sans off')
    expect('reglages' in sansPiste && sansPiste.reglages).toEqual({ ...DEFAUT, sansListe: false })
    const aucun = 'reglages' in sansPiste ? appliquer(sansPiste.reglages, 'progression avec liste off') : sansPiste
    expect('reglages' in aucun && aucun.reglages.progression).toBe(false)
    expect('message' in aucun && aucun.message).toContain('la Progression est à Off')
    const remis = 'reglages' in aucun ? appliquer(aucun.reglages, 'progression on') : aucun
    expect('reglages' in remis && remis.reglages).toEqual(DEFAUT)
    const incomplet = appliquer(DEFAUT, 'progression avec')
    expect('erreur' in incomplet && incomplet.erreur).toContain('ajoute « on » ou « off » après « avec »')
    expect('erreur' in appliquer(DEFAUT, 'progression avec peut-être')).toBe(true)
  })

  test('les propositions suivent le nombre demandé', () => {
    expect(extraire(JSON.stringify(SUITES), 2)).toEqual(['Lance les tests', 'Ajoute un README'])
    expect(extraire('1. Lance les tests\n2) Ajoute un README', 5)).toEqual(['Lance les tests', 'Ajoute un README'])
    expect(consigne(1, 'ligne')).toContain('exactement 1 suite logique')
    expect(consigne(4, 'liste')).toContain('70 caractères')
  })

  test('les limites d’utilisation', () => {
    expect(nomLimite('five_hour')).toBe('Limite de 5 heures')
    expect(nomLimite('seven_day')).toBe('Hebdomadaire · tous les modèles')
    expect(nomLimite('seven_day_fable')).toBe('Hebdomadaire · Fable')
    expect(delai(new Date(2 * HEURE).toISOString(), 0)).toBe('réinit. dans 2h')
    expect(delai(new Date(4 * 24 * HEURE).toISOString(), 0)).toBe('réinit. dans 4j')
    expect(delai(new Date(45 * 60_000).toISOString(), 0)).toBe('réinit. dans 45 min')
    expect(delai(null, 0)).toBe('')
    expect(remplissage(26, 40)).toEqual({ plein: 10, vide: 30 })
    expect(
      trierLimites([
        { kind: 'seven_day_fable', pourcent: 44, reinit: null },
        { kind: 'seven_day', pourcent: 26, reinit: null },
        { kind: 'five_hour', pourcent: 8, reinit: null },
      ]).map(l => l.kind),
    ).toEqual(['five_hour', 'seven_day', 'seven_day_fable'])
  })

  test('les stats', () => {
    expect(minutes(0, 12 * 60_000)).toBe('12 min')
    expect(jetons(68_000)).toBe('68k')
    expect(jetons(1_000_000)).toBe('1M')
    expect(couleur(34)).toBe('success')
    expect(couleur(65)).toBe('warning')
    expect(couleur(85)).toBe('error')
    expect(glyphe(34)).toBe('◔')
    expect(glyphe(null)).toBe('○')
  })

  test('l’onglet Stats : contenu du contexte, durée, coût, noms courts', () => {
    const parts = partsContexte(CATEGORIES)
    expect(parts.map(x => x.nom)).toEqual(['Système', 'Messages', 'Libre', 'Réserve'])
    expect(parts.map(x => x.sorte)).toEqual(['used', 'used', 'free', 'buffer'])
    const n = cellules(parts, 40)
    expect(n.reduce((t, x) => t + x, 0)).toBe(40)
    expect(n.every(x => x >= 1)).toBe(true)
    // Une part minuscule garde au moins une cellule.
    expect(cellules([{ nom: 'A', jetons: 1, teinte: '#000', sorte: 'used' }, { nom: 'B', jetons: 999, teinte: '#000', sorte: 'free' }], 10)).toEqual([1, 9])
    expect(dollars(4.82)).toMatch(/^4,82\s\$ US$/)
    expect(dollars(null)).toBe('—')
    expect(dureeSession(0, 45 * 60_000)).toBe('45 min')
    expect(dureeSession(0, 72 * 60_000)).toBe('1 h 12 min')
    expect(nomCourt('five_hour')).toBe('Limite 5 h')
    expect(nomCourt('seven_day')).toBe('Semaine')
    expect(nomCourt('seven_day_opus')).toBe('Semaine · Opus')
  })
})

const TODOS = ['Lire', 'Analyser', 'Convertir', 'Valider', 'Tester', 'Documenter', 'Publier'].map((content, i) => ({
  content,
  status: (i < 3 ? 'completed' : i === 3 ? 'in_progress' : 'pending') as 'pending' | 'in_progress' | 'completed',
  activeForm: content,
}))

describe('la Progression (fonctions pures)', () => {
  test('la liste de tâches donne les étapes, le %, le chapelet', () => {
    const p = appliquerTodos(nouvelle('Migration des presets', 0), TODOS, 60_000)
    expect(compter(p)).toEqual({ faites: 3, total: 7, courante: p.etapes[3], rang: 4 })
    expect(pourcentage(p)).toBe(50)
    expect(chapelet(p)).toEqual({ faits: '● ● ●', courant: '◉', restants: '○ ○ ○', reste: 0 })
    expect(resteEstime(p, 4 * 60_000)).toBe('~4 min')
    expect(resteEstime(nouvelle('x', 0), 60_000)).toBe('')
  })

  test('une liste inachevée continue au tour suivant, une liste finie laisse place à la suivante', () => {
    const p = appliquerTodos(nouvelle('Migration', 0), TODOS, 0)
    expect(demarrer({ ...p, fin: 5 }, 'oui, continue', 10).titre).toBe('Migration')
    const finie = appliquerTodos(p, TODOS.map(t => ({ ...t, status: 'completed' as const })), 20)
    expect(demarrer(finie, 'Autre chose', 30).titre).toBe('Autre chose')
    expect(majEtape(p, 'todo-6', { statut: 'deleted' }, 0).etapes).toHaveLength(6)
  })

  test('« Disparaît après » : instantané, 5 à 15 secondes, ou jamais', () => {
    expect(DEFAUT.disparaitApres).toBe(15)
    expect(completer({ disparaitApres: 7 }).disparaitApres).toBe(15)
    expect(completer({ disparaitApres: null }).disparaitApres).toBe(null)
    // Un ancien « Reste après » est repris ; au-delà de 15 s, il devient 15 s.
    expect(completer({ resteApres: 5 }).disparaitApres).toBe(5)
    expect(completer({ resteApres: 30 }).disparaitApres).toBe(15)
    const cinq = appliquer(DEFAUT, 'progression 5')
    expect('reglages' in cinq && cinq.reglages.disparaitApres).toBe(5)
    const aussitot = appliquer(DEFAUT, 'progression disparait instantané')
    expect('reglages' in aussitot && aussitot.reglages.disparaitApres).toBe(0)
    const jamais = appliquer(DEFAUT, 'progression disparait jamais')
    expect('reglages' in jamais && jamais.reglages.disparaitApres).toBe(null)
    expect('erreur' in appliquer(DEFAUT, 'progression 30')).toBe(true)
    const p = appliquerTodos(nouvelle('x', 0), TODOS, 0)
    expect(visible({ ...p, fin: 1000 }, 1000, 0)).toBe(false)
    expect(visible({ ...p, fin: 1000 }, 5999, 5000)).toBe(true)
    expect(visible({ ...p, fin: 1000 }, 6000, 5000)).toBe(false)
    expect(visible({ ...p, fin: 1000 }, 1e12, Infinity)).toBe(true)
    expect(visible({ ...p, fin: 1000, effacee: true }, 1000, Infinity)).toBe(false)
    // Une liste effacée en cours de route reprend au tour suivant.
    expect(demarrer({ ...p, fin: 1000, effacee: true }, 'continue', 2000).effacee).toBe(false)
  })

  test('« Détail » : 3, 6, 9, 12 actions, ou illimité', () => {
    expect(DEFAUT.journalLignes).toBe(6)
    expect(completer({ journalLignes: 7 }).journalLignes).toBe(6)
    expect(completer({ journalLignes: null }).journalLignes).toBe(null)
    const douze = appliquer(DEFAUT, 'progression detail 12')
    expect('reglages' in douze && douze.reglages.journalLignes).toBe(12)
    const tout = appliquer(DEFAUT, 'progression détail illimité')
    expect('reglages' in tout && tout.reglages.journalLignes).toBe(null)
    expect('erreur' in appliquer(DEFAUT, 'progression detail 7')).toBe(true)
    const trois = appliquer(DEFAUT, 'progression detail 3')
    expect('reglages' in trois && trois.reglages.journalLignes).toBe(3)
    // Un ancien 18 (0.6.0) devient 12.
    expect(completer({ journalLignes: 18 }).journalLignes).toBe(12)
  })

  test('visible pendant la tâche, puis 15 secondes après sa fin', () => {
    const p = appliquerTodos(nouvelle('x', 0), TODOS, 0)
    expect(visible(nouvelle('sans étapes', 0), 0)).toBe(false)
    expect(visible(p, 999_999)).toBe(true)
    expect(visible({ ...p, fin: 1000 }, 15_000)).toBe(true)
    expect(visible({ ...p, fin: 1000 }, 17_000)).toBe(false)
  })
})

// Le moteur sous le mod pour les tours et les outils.
function simulerTours(on: On) {
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {}, text: 'ok' }))
}

describe('la Progression dans la bande', () => {
  for (const surface of SURFACES) {
    test(`suit la liste de tâches, puis reste 15 s avec sa coche (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      await $.turn.start({ text: 'Migration des presets', turnId: 't1' })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      expect(await ui.find({ key: 'progression' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Migration des presets' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^50 %/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Étape 4 sur 7 · Valider' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '● ● ●' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' ◉' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' ○ ○ ○' })).toBeDefined()
      const arbre = JSON.stringify(await ui.drawn())
      expect(arbre.indexOf('"progression"')).toBeLessThan(arbre.indexOf('"ligne"'))

      await horloge.advance(3 * 60_000)
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u2', todos: TODOS.map(t => ({ ...t, status: 'completed' as const })) })
      await $.turn.complete({ reason: 'answer', answer: 'fait', durationMs: 0, isAborted: false, turnId: 't1' })
      expect(await ui.find({ type: 'Text', text: /^✓ 7 étapes · 3 min/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Toutes les étapes sont faites' })).toBeDefined()

      await horloge.advance(16_000)
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await ui.unmount()
    })

    test(`à Off, rien ne s’affiche ; l’exemple du panneau dure 20 s (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      await myconfig($, 'progression off')
      await $.turn.start({ text: 'Migration', turnId: 't1' })
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      await myconfig($, 'progression on')
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't1' })
      await horloge.advance(16_000)
      const pane = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await pane.press({ key: 'onglet-progression' })
      await pane.press({ key: 'voir-exemple' })
      expect(await ui.find({ type: 'Text', text: 'Migration des presets (exemple)' })).toBeDefined()
      await horloge.advance(21_000)
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await pane.unmount()
      await ui.unmount()
    })
  }
})

describe('la Progression : disparaît après', () => {
  for (const surface of SURFACES) {
    test(`le panneau règle le temps ; instantané ferme dès la fin, 5 s reste 5 s (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      const pane = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await pane.press({ key: 'onglet-progression' })
      expect(await pane.find({ type: 'Text', text: 'Disparaît après' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'Apparaît après' })).toBeUndefined()
      for (const cle of ['0', '5', '10', '15', 'jamais']) {
        expect(await pane.find({ type: 'Button', key: `disparait-${cle}` })).toBeDefined()
      }
      expect((await pane.find({ type: 'Button', key: 'disparait-0' }))?.props.label).toBe('Instantané')
      expect((await pane.find({ type: 'Button', key: 'disparait-jamais' }))?.props.label).toBe('Jamais')
      expect(await pane.find({ type: 'Text', text: /remplie de gauche à droite/ })).toBeUndefined()

      await pane.press({ key: 'disparait-0' })
      expect(await etat($)).toContain('Progression  : On · avec liste, sans liste · disparaît aussitôt · détail 6')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Migration', turnId: 't1' })
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      expect(await ui.find({ key: 'progression' })).toBeDefined()
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't1' })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      await pane.press({ key: 'disparait-5' })
      expect(await etat($)).toContain('Progression  : On · avec liste, sans liste · disparaît après 5 s')
      await $.turn.start({ text: 'Autre tâche', turnId: 't2' })
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u2', todos: TODOS })
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't2' })
      await horloge.advance(4_000)
      expect(await ui.find({ key: 'progression' })).toBeDefined()
      await horloge.advance(2_000)
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await ui.unmount()
      await pane.unmount()
    })

    test(`Jamais : la barre reste après la fin, jusqu’au clic sur son titre (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      await myconfig($, 'progression disparait jamais')
      expect(await etat($)).toContain('reste jusqu’au clic')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Publie', turnId: 't1' })
      await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/x/a.md' })
      // Pendant la tâche, le titre n'efface rien.
      expect(await ui.find({ key: 'progression-effacer' })).toBeUndefined()
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't1' })
      await horloge.advance(10 * 60_000)
      expect(await ui.find({ key: 'progression-piste' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '  ✕' })).toBeDefined()

      await ui.press({ key: 'progression-effacer' })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      // Une interruption la retire aussitôt, même à « Jamais ».
      await $.turn.start({ text: 'Autre', turnId: 't2' })
      await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: '/x/b.md' })
      expect(await ui.find({ key: 'progression' })).toBeDefined()
      await $.turn.complete({ reason: 'aborted', answer: '', durationMs: 0, isAborted: true, turnId: 't2' })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await ui.unmount()
    })
  }
})

describe('la Progression : détail du journal', () => {
  for (const surface of SURFACES) {
    test(`« Détail » règle le nombre d’actions du journal déplié (${surface})`, async ($, on) => {
      simuler(on)
      simulerTours(on)
      const grande = { ...bande, props: { ...bande.props, maxRows: 40 } }
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...grande })
      await $.turn.start({ text: 'Lis tout', turnId: 't1' })
      for (let i = 0; i < 20; i++) {
        await $.tool.call({ tool: 'Read', tool_use_id: `r${i}`, file_path: `/x/f${i}.md` })
      }
      await ui.press({ key: 'progression-detail' })
      const haut = async () => (await ui.find({ type: 'Button', key: 'journal-haut' }))?.props.label
      expect(await haut()).toBe('▲ 14 actions plus anciennes')
      await myconfig($, 'progression detail 12')
      expect(await haut()).toBe('▲ 8 actions plus anciennes')
      await myconfig($, 'progression detail illimite')
      expect(await ui.find({ key: 'journal-haut-ligne' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /^f0\.md/ })).toBeDefined()
      await ui.unmount()
    })

    test(`▲ et ▼ feuillettent le journal par pages ; la page reste en place (${surface})`, async ($, on) => {
      simuler(on)
      simulerTours(on)
      await myconfig($, 'progression detail 3')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Lis tout', turnId: 't1' })
      for (let i = 0; i < 12; i++) {
        await $.tool.call({ tool: 'Read', tool_use_id: `r${i}`, file_path: `/x/f${i}.md` })
      }
      await ui.press({ key: 'progression-detail' })
      const label = async (key: string) => (await ui.find({ type: 'Button', key }))?.props.label
      expect(await label('journal-haut')).toBe('▲ 9 actions plus anciennes')
      expect(await ui.find({ type: 'Text', text: '10–12 sur 12' })).toBeDefined()
      expect(await ui.find({ key: 'journal-bas' })).toBeUndefined()

      await ui.press({ key: 'journal-haut' })
      expect(await ui.find({ type: 'Text', text: '7–9 sur 12' })).toBeDefined()
      expect(await label('journal-bas')).toBe('▼ 3 plus récentes')
      expect(await ui.find({ type: 'Text', text: /^f6\.md/ })).toBeDefined()

      // Une nouvelle action ne déplace pas la page que l'on regarde.
      await $.tool.call({ tool: 'Read', tool_use_id: 'r12', file_path: '/x/f12.md' })
      expect(await ui.find({ type: 'Text', text: '7–9 sur 13' })).toBeDefined()

      await ui.press({ key: 'journal-haut' })
      await ui.press({ key: 'journal-haut' })
      expect(await ui.find({ type: 'Text', text: 'Début de la tâche' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '1–3 sur 13' })).toBeDefined()

      // Replié puis rouvert, le journal montre de nouveau les dernières actions.
      await ui.press({ key: 'progression-detail' })
      await ui.press({ key: 'progression-detail' })
      expect(await ui.find({ type: 'Text', text: '11–13 sur 13' })).toBeDefined()
      await ui.unmount()
    })
  }
})

describe('la Progression sans liste (fonctions pures)', () => {
  test('les sortes d’actions', () => {
    expect(['Bash', 'Read', 'Grep', 'Edit', 'Write', 'Agent'].map(sorteDe)).toEqual([
      'bash',
      'lecture',
      'lecture',
      'modif',
      'modif',
      'autre',
    ])
  })

  test('la piste : segments par sorte, durées, action en cours, remplissage', () => {
    let p = nouvelle('Publie', 0)
    p = debuterAction(p, 'a', 'lecture', 'Read · README.md', 0)
    p = finirAction(p, 'a', 2_000)
    p = debuterAction(p, 'b', 'bash', 'Bash · Valide', 2_000)
    p = finirAction(p, 'b', 5_000)
    p = debuterAction(p, 'c', 'bash', 'Bash · Teste', 5_000)
    expect(segmentsPiste(p, 9_000)).toEqual([
      { sorte: 'lecture', duree: 2_000, enCours: false },
      { sorte: 'bash', duree: 7_000, enCours: true },
    ])
    expect(actionCourante(p)).toBe('Bash · Teste')
    expect(totalActions(p)).toBe(3)
    expect(visible(p, 9_000)).toBe(true)
    expect(remplissagePiste(p, 15_000)).toBe(0.5)
    expect(remplissagePiste({ ...p, fin: 20_000 }, 20_000)).toBe(1)
    expect(repartir([2, 7], 30)).toEqual([7, 23])
    expect(repartir([1, 1, 1], 10).reduce((a, b) => a + b, 0)).toBe(10)
  })

  test('l’outil en clair : son nom, ce qu’il touche, le détail', () => {
    const bash = { command: 'claude plugin test .\nautre ligne', description: 'Lance les tests' }
    expect(decrireOutil('Bash', bash)).toEqual({ nom: 'Bash', libelle: 'Lance les tests', complement: 'claude plugin test .' })
    expect(decrireOutil('Bash', { command: 'ls -la' })).toEqual({ nom: 'Bash', libelle: 'ls -la', complement: '' })
    expect(decrireOutil('Read', { file_path: '/Users/dany/Developer/x/README.md' })).toEqual({
      nom: 'Read',
      libelle: 'README.md',
      complement: '~/Developer/x',
    })
    expect(decrireOutil('mcp__github__create_issue', {}).nom).toBe('github · create_issue')
    expect(libelleOutil('Bash', bash)).toBe('Bash · Lance les tests')
  })

  test('le journal : les dernières actions, leur durée, celle en cours', () => {
    const lire = { nom: 'Read', libelle: 'README.md', complement: '~/x' }
    let p = nouvelle('Publie', 0)
    p = debuterAction(p, 'a', 'lecture', 'Read · README.md', 0, lire)
    p = finirAction(p, 'a', 2_000)
    p = debuterAction(p, 'b', 'bash', 'Bash · Teste', 2_000)
    const { lignes, avant } = lignesJournal(p, 9_000)
    expect(avant).toBe(0)
    expect(lignes.map(l => [l.nom, l.libelle, l.duree, l.enCours])).toEqual([
      ['Read', 'README.md', 2_000, false],
      ['Bash · Teste', '', 7_000, true],
    ])
    // Une action restée ouverte à la fin de la tâche compte jusqu'à cette fin, et n'est plus en cours.
    expect(lignesJournal({ ...p, fin: 4_000 }, 9_000).lignes[1]).toMatchObject({ duree: 2_000, enCours: false })
    for (let i = 0; i < JOURNAL_MAX + 5; i++) {
      p = finirAction(debuterAction(p, `x${i}`, 'bash', 'Bash', 10_000), `x${i}`, 11_000)
    }
    expect(p.journal).toHaveLength(JOURNAL_MAX)
    expect(lignesJournal(p, 12_000)).toMatchObject({ avant: JOURNAL_MAX - 6, apres: 0 })
  })

  test('les pages du journal : ▲ recule, ▼ avance, puis suit les dernières actions', () => {
    let p = nouvelle('Lis', 0)
    for (let i = 0; i < 12; i++) {
      p = finirAction(debuterAction(p, `a${i}`, 'lecture', 'Read', i), `a${i}`, i + 1)
    }
    const journal = p.journal ?? []
    expect(lignesJournal(p, 20, 3)).toMatchObject({ debut: 9, avant: 9, apres: 0, total: 12 })
    const precedente = ancrePrecedente(journal, 3, null)
    expect(precedente).toBe('a6')
    expect(lignesJournal(p, 20, 3, precedente)).toMatchObject({ debut: 6, avant: 6, apres: 3 })
    expect(ancreSuivante(journal, 3, 'a3')).toBe('a6')
    expect(ancreSuivante(journal, 3, 'a6')).toBe(null)
    expect(ancrePrecedente(journal, 3, 'a0')).toBe('a0')
    // Une ancre inconnue (une autre tâche) : les dernières actions.
    expect(lignesJournal(p, 20, 3, 'ailleurs')).toMatchObject({ debut: 9 })
  })

  test('Titre 1 : le titre de la tâche en une ligne', () => {
    expect(titreDe('met à jour le git')).toBe('Met à jour le git')
    expect(titreDe('')).toBe('Suite du travail')
    const long = titreDe('est ce que le titre ou la commande qui est affiché au dessus de la barre de progression peut-être un résumé')
    expect(long.length).toBeLessThanOrEqual(60)
    expect(long.endsWith('…')).toBe(true)
    expect(long).not.toMatch(/\s…$/)
    // Un résumé seulement pour une consigne longue, ou de plusieurs lignes.
    expect(aResumer('met à jour le git')).toBe(false)
    expect(aResumer('corrige les deux défauts, puis publie la version 0.8.0 de MyConfig')).toBe(true)
    expect(aResumer('Lis ceci\npuis fais cela')).toBe(true)
    // La réponse du modèle, ramenée à un titre propre.
    expect(nettoyerTitre('« corriger 2 défauts et publier la 0.8.0. »')).toBe('Corriger 2 défauts et publier la 0.8.0')
    expect(nettoyerTitre('Titre : Mettre à jour le git\n\nExplication…')).toBe('Mettre à jour le git')
    expect(nettoyerTitre('  \n ')).toBe('')
  })

  test('le titre entier : coupé aux espaces, sur autant de rangées qu’il faut', () => {
    expect(rangeesTexte('', 10)).toBe(1)
    expect(rangeesTexte('Lance les tests', 20)).toBe(1)
    expect(rangeesTexte('Lance les tests', 9)).toBe(2)
    expect(rangeesTexte('abcdefghijklmnopqrstuvwxyz', 10)).toBe(3)
    expect(rangeesTexte('ab abcdefghijklmnopqrstuvwxyz', 10)).toBe(4)
  })

  test('une page du journal tient dans ses rangées, même avec de longs titres', () => {
    let p = nouvelle('Lis', 0)
    const long = 'Convertit les presets au format de la version 2 du schéma en gardant les anciens noms'
    for (let i = 0; i < 6; i++) {
      const description = { nom: 'Bash', libelle: i % 2 === 0 ? long : 'Court', complement: 'node x.mjs' }
      p = finirAction(debuterAction(p, `a${i}`, 'bash', 'Bash', i * 1000, description), `a${i}`, i * 1000 + 500)
    }
    // Assez de place : 6 actions, les longues sur 2 rangées.
    const large = pageJournal(p, 9_000, 6, 12, 60)
    expect(large).toMatchObject({ taille: 6, hauteur: 9 })
    // Moins de rangées : la page se raccourcit, les dernières actions d'abord.
    const serre = pageJournal(p, 9_000, 6, 5, 60)
    expect(serre.hauteur).toBeLessThanOrEqual(5)
    expect(serre.lignes.at(-1)?.id).toBe('a5')
    // Au moins une action, même trop longue.
    expect(pageJournal(p, 9_000, 6, 1, 20).taille).toBe(1)
  })
})

describe('la Progression sans liste dans la bande', () => {
  for (const surface of SURFACES) {
    test(`une piste par action, l’action en cours, 100 % et ✓ à la fin (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      on('turn.start', (_$, e) => ({ turnId: e.turnId }))
      // Pendant la commande Bash, la bande doit nommer l'action en cours.
      let enCoursVu = false
      let chercher: ((texte: RegExp) => Promise<boolean>) | undefined
      on('tool.call', async (_$, e) => {
        await horloge.advance(e.tool === 'Bash' ? 4_000 : 1_000)
        if (e.tool === 'Bash' && chercher !== undefined) {
          enCoursVu = await chercher(/^En cours : Bash · Lance les tests/)
        }
        return { result: {}, text: 'ok' }
      })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      chercher = async texte => (await ui.find({ type: 'Text', text: texte })) !== undefined
      await $.turn.start({ text: 'Publie la version', turnId: 't1' })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/x/README.md' })
      await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'claude plugin test .', description: 'Lance les tests' })
      expect(enCoursVu).toBe(true)
      expect(await ui.find({ key: 'progression-piste' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Publie la version' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^⏱ 5 s$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' Lecture ×1' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' Bash ×1' })).toBeDefined()
      if (surface === 'terminal') {
        expect(await ui.find({ type: 'Text', text: /^░+$/ })).toBeDefined()
      }

      await $.turn.complete({ reason: 'answer', answer: 'fait', durationMs: 0, isAborted: false, turnId: 't1' })
      expect(await ui.find({ type: 'Text', text: '✓ 2 actions · 5 s' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Toutes les actions sont faites · 100 %' })).toBeDefined()
      if (surface === 'terminal') {
        expect(await ui.find({ type: 'Text', text: /^░+$/ })).toBeUndefined()
      }
      await ui.unmount()
    })

    test(`une liste de tâches prend le relais ; un sous-agent ne compte pas (${surface})`, async ($, on) => {
      simuler(on)
      simulerTours(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Migration', turnId: 't1' })
      // L'appel d'un sous-agent porte son agentId (que le type de l'appel de test ne déclare pas).
      const appelSousAgent = { tool: 'Read', tool_use_id: 'r1', file_path: '/x/a.md', agentId: 'sous-agent' }
      await $.tool.call(appelSousAgent as unknown as Parameters<typeof $.tool.call>[0])
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: '/x/a.md' })
      expect(await ui.find({ key: 'progression-piste' })).toBeDefined()
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      expect(await ui.find({ key: 'progression-piste' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'Étape 4 sur 7 · Valider' })).toBeDefined()
      await ui.unmount()
    })

    test(`un clic sous la piste déplie le journal des actions, un autre le replie (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      on('turn.start', (_$, e) => ({ turnId: e.turnId }))
      on('tool.call', async (_$, e) => {
        await horloge.advance(e.tool === 'Bash' ? 4_000 : 1_000)
        return { result: {}, text: 'ok' }
      })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Publie la version', turnId: 't1' })
      await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/Users/dany/Developer/x/README.md' })
      await $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'claude plugin test .', description: 'Lance les tests' })
      expect(await ui.find({ key: 'progression-journal' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: ' ▼' })).toBeDefined()

      await ui.press({ key: 'progression-detail' })
      expect(await ui.find({ key: 'progression-journal' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' ▲' })).toBeDefined()
      // Journal 1 : le titre seul, sans le détail en gris.
      expect(await ui.find({ type: 'Text', text: 'README.md' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Lance les tests' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /claude plugin test|~\/Developer\/x/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: '1 s' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '4 s' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '✓' })).toBeDefined()

      // Le journal reste déplié pour une liste de tâches, sous le chapelet.
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      expect(await ui.find({ type: 'Text', text: 'Étape 4 sur 7 · Valider' })).toBeDefined()
      expect(await ui.find({ key: 'progression-journal' })).toBeDefined()

      await ui.press({ key: 'progression-detail' })
      expect(await ui.find({ key: 'progression-journal' })).toBeUndefined()
      await ui.unmount()
    })

    test(`l’onglet Progression : Afficher remplace On / Off, chaque mode s’affiche seul (${surface})`, async ($, on) => {
      simuler(on)
      simulerTours(on)
      const pane = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await pane.press({ key: 'onglet-progression' })
      expect(await pane.find({ key: 'on' })).toBeUndefined()
      expect(await pane.find({ key: 'off' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Afficher' })).toBeDefined()

      // « Sans liste » seul : la piste s'affiche, la barre de la liste non.
      await pane.press({ key: 'afficher-avec-liste' })
      expect(await etat($)).toContain('Progression  : On · sans liste ·')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Migration', turnId: 't1' })
      await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/x/a.md' })
      expect(await ui.find({ key: 'progression-piste' })).toBeDefined()
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      // Aucun mode : la Progression est à Off, et ses essais sont éteints.
      await pane.press({ key: 'afficher-sans-liste' })
      expect(await etat($)).toContain('Progression  : Off')
      expect((await pane.find({ type: 'Button', key: 'onglet-progression' }))?.props.label).toBe('Progression ○')
      expect((await pane.find({ type: 'Button', key: 'voir-exemple' }))?.props.dimColor).toBe(true)
      expect((await pane.find({ type: 'Button', key: 'voir-exemple-sans-liste' }))?.props.dimColor).toBe(true)

      // « Avec liste » seul : la barre de la liste revient.
      await pane.press({ key: 'afficher-avec-liste' })
      expect(await etat($)).toContain('Progression  : On · avec liste ·')
      expect(await ui.find({ type: 'Text', text: 'Étape 4 sur 7 · Valider' })).toBeDefined()
      await ui.unmount()
      await pane.unmount()
    })

    test(`l’exemple sans liste du panneau passe ses 8 actions, puis s’en va (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      const pane = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await pane.press({ key: 'onglet-progression' })
      await pane.press({ key: 'voir-exemple-sans-liste' })
      await horloge.advance(3_000)
      expect(await ui.find({ type: 'Text', text: 'Publie la version 0.3.0 (exemple)' })).toBeDefined()
      expect(await ui.find({ key: 'progression-piste' })).toBeDefined()
      await horloge.advance(21_000)
      expect(await ui.find({ type: 'Text', text: /^✓ 8 actions/ })).toBeDefined()
      await horloge.advance(16_000)
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await pane.unmount()
      await ui.unmount()
    })
  }
})

describe('la bande', () => {
  for (const surface of SURFACES) {
    test(`montre Correction, Stats, Confirmation et ⚙, sans Relais ni quotas (${surface})`, async ($, on) => {
      simuler(on)
      await etat($)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      for (const key of ['myconfig', 'ameliorer', 'revenir', 'stats', 'croquis', 'confirmation', 'reglages']) {
        expect(await ui.find({ key })).toBeDefined()
      }
      expect(await ui.find({ key: 'relais' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /34 %/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /68k\/200k · 12 min/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /5h|7j/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Confirmation|Feu vert/ })).toBeUndefined()
      await ui.unmount()
    })

    test(`l’œil des Croquis : normal à Off, foncé à On, un clic bascule (${surface})`, async ($, on) => {
      simuler(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      const bouton = async () => (await ui.find({ type: 'Button', key: 'croquis' }))?.props
      expect(await bouton()).toMatchObject({ label: '👁', variant: 'secondary' })
      await ui.press({ key: 'croquis' })
      expect(await bouton()).toMatchObject({ label: '👁', variant: 'primary' })
      expect(await etat($)).toContain('Croquis      : On')
      await ui.press({ key: 'croquis' })
      expect(await etat($)).toContain('Croquis      : Off')
      await ui.unmount()
    })

    test(`le bouton Confirmation : ▶ normal à Off, ⏸ foncé à On, un clic bascule (${surface})`, async ($, on) => {
      simuler(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      const bouton = async () => (await ui.find({ type: 'Button', key: 'confirmation' }))?.props
      expect(await bouton()).toMatchObject({ label: '▶', variant: 'secondary' })

      await ui.press({ key: 'confirmation' })
      expect(await bouton()).toMatchObject({ label: '⏸', variant: 'primary' })
      expect(await etat($)).toContain('Confirmation : On')

      await ui.press({ key: 'confirmation' })
      expect(await bouton()).toMatchObject({ label: '▶', variant: 'secondary' })
      expect(await etat($)).toContain('Confirmation : Off')
      await ui.unmount()
    })

    test(`remise à On, la Confirmation attend un nouveau feu vert (${surface})`, async ($, on) => {
      simuler(on)
      on('tool.call', () => ({ result: 'écrit' }))
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await ui.press({ key: 'confirmation' })
      await $.prompt.submit({ text: 'go', origin: { kind: 'composer' }, wait: false })
      await ui.press({ key: 'confirmation' })
      await ui.press({ key: 'confirmation' })
      const refuse = await $.tool.call({ tool: 'Write', tool_use_id: 't1', file_path: '/tmp/a.md', content: 'x' })
      expect('deny' in refuse ? refuse.deny : undefined).toBe(REFUS)
      await ui.unmount()
    })

    test(`un module à Off disparaît de la bande (${surface})`, async ($, on) => {
      simuler(on)
      await myconfig($, 'correction off')
      await myconfig($, 'stats off')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      for (const key of ['ameliorer', 'stats']) {
        expect(await ui.find({ key })).toBeUndefined()
      }
      // ⚙ et le bouton Confirmation restent : c'est lui qui la remet à On.
      expect(await ui.find({ key: 'reglages' })).toBeDefined()
      expect(await ui.find({ key: 'confirmation' })).toBeDefined()
      await ui.unmount()
    })

    test(`propositions sur une ligne, puis une par ligne (${surface})`, async ($, on) => {
      const envoyes: string[] = []
      const horloge = simuler(on, envoyes)
      await myconfig($, 'proposition 4')
      await $.turn.complete({
        reason: 'answer',
        answer: 'fait',
        durationMs: 1000,
        isAborted: false,
        turnId: 't1',
      })
      await horloge.advance(10)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      for (let i = 0; i < 20 && (await ui.find({ key: 'suite-0' })) === undefined; i++) {
        await ui.advance(50)
      }
      for (const key of ['suite-0', 'suite-1', 'suite-2', 'suite-3', 'relancer']) {
        expect(await ui.find({ type: 'Button', key })).toBeDefined()
      }
      expect(await ui.find({ key: 'suite-4' })).toBeUndefined()
      expect(await ui.find({ key: 'ligne-0' })).toBeUndefined()
      expect(await ui.find({ key: 'espace-propositions' })).toBeDefined()

      await myconfig($, 'proposition liste')
      for (const key of ['ligne-0', 'ligne-1', 'ligne-2', 'ligne-3']) {
        expect(await ui.find({ key })).toBeDefined()
      }
      expect(await ui.find({ key: 'espace-propositions' })).toBeDefined()

      await ui.press({ key: 'suite-2' })
      expect(envoyes).toEqual(["Corrige l'erreur 42"])
      expect(await ui.find({ key: 'suite-0' })).toBeUndefined()
      await ui.unmount()
    })
  }
})

describe('la Correction', () => {
  for (const surface of SURFACES) {
    test(`« ✓ Correction » corrige le texte, « Revenir » le remet (${surface})`, async ($, on) => {
      simuler(on)
      const champ = { text: 'je veut que tu corige ce texte' }
      const consignes: string[] = []
      on('prompt.read', () => ({ value: { text: champ.text, cursor: champ.text.length } }))
      on('prompt.fill', (_$, e) => {
        champ.text = e.text
        return { isFilled: true }
      })
      on('model.complete', (_$, e) => {
        consignes.push(typeof e.system === 'string' ? e.system : '')
        const texte = e.system === CONSIGNE_ORTHOGRAPHE ? 'Je veux que tu corriges ce texte.' : 'Objectif : corriger ce texte.'
        return { value: { isAnswered: true as const, text: texte, usage: USAGE } }
      })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      expect((await ui.find({ type: 'Button', key: 'ameliorer' }))?.props.label).toBe('✎ Améliorer')
      expect((await ui.find({ type: 'Button', key: 'corriger' }))?.props.label).toBe('✓ Correction')
      const arbre = JSON.stringify(await ui.drawn())
      expect(arbre.indexOf('"ameliorer"')).toBeLessThan(arbre.indexOf('"corriger"'))
      expect(arbre.indexOf('"corriger"')).toBeLessThan(arbre.indexOf('"revenir"'))

      await ui.press({ key: 'corriger' })
      expect(consignes).toEqual([CONSIGNE_ORTHOGRAPHE])
      expect(champ.text).toBe('Je veux que tu corriges ce texte.')

      await ui.press({ key: 'revenir' })
      expect(champ.text).toBe('je veut que tu corige ce texte')

      await ui.press({ key: 'ameliorer' })
      expect(consignes).toEqual([CONSIGNE_ORTHOGRAPHE, CONSIGNE_PROMPT])
      expect(champ.text).toBe('Objectif : corriger ce texte.')
      await ui.unmount()
    })
  }
})

describe('les boutons affichés de la Correction', () => {
  for (const surface of SURFACES) {
    test(`la bande ne montre que les boutons choisis (${surface})`, async ($, on) => {
      simuler(on)
      await myconfig($, 'ameliorer off')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      expect(await ui.find({ key: 'ameliorer' })).toBeUndefined()
      expect((await ui.find({ type: 'Button', key: 'corriger' }))?.props.variant).toBe('primary')
      expect(await ui.find({ key: 'revenir' })).toBeDefined()

      await myconfig($, 'corriger off')
      for (const key of ['correction', 'corriger', 'revenir']) {
        expect(await ui.find({ key })).toBeUndefined()
      }
      await ui.unmount()
    })

    test(`l’onglet Correction : Afficher remplace On / Off (${surface})`, async ($, on) => {
      simuler(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await ui.press({ key: 'onglet-correction' })
      expect(await ui.find({ key: 'on' })).toBeUndefined()
      expect(await ui.find({ key: 'off' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'Afficher' })).toBeDefined()

      await ui.press({ key: 'afficher-ameliorer' })
      expect(await etat($)).toContain('Correction   : On · Correction')
      await ui.press({ key: 'afficher-corriger' })
      expect(await etat($)).toContain('Correction   : Off')
      expect((await ui.find({ type: 'Button', key: 'onglet-correction' }))?.props.label).toBe('Correction ○')

      await ui.press({ key: 'afficher-corriger' })
      expect(await etat($)).toContain('Correction   : On · Correction')
      await ui.unmount()
    })

    test(`l’onglet Proposition donne le modèle (${surface})`, async ($, on) => {
      simuler(on)
      on('session.model', () => ({ value: 'claude-opus-5-5' }))
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await ui.press({ key: 'onglet-proposition' })
      expect(await ui.find({ type: 'Text', text: 'claude-opus-5-5' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '(celui de la session)' })).toBeDefined()
      await ui.unmount()
    })
  }
})

describe('les limites d’utilisation', () => {
  for (const surface of SURFACES) {
    test(`un clic sur les Stats ouvre les limites, les actualise, un autre les ferme (${surface})`, async ($, on) => {
      const limites = forfait()
      simuler(on, [], {}, limites)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      expect(await ui.find({ key: 'limites' })).toBeUndefined()

      await ui.press({ key: 'stats-bouton' })
      expect(await ui.find({ key: 'limites' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /LIMITES D’UTILISATION DU FORFAIT/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Limite de 5 heures' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '8 % · réinit. dans 2h' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Hebdomadaire · tous les modèles' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '26 % · réinit. dans 4j' })).toBeDefined()
      for (const key of ['barre-five_hour', 'barre-seven_day', 'actualiser-limites', 'espace-propositions']) {
        expect(await ui.find({ key })).toBeDefined()
      }
      const arbre = JSON.stringify(await ui.drawn())
      expect(arbre.indexOf('limite-five_hour')).toBeLessThan(arbre.indexOf('limite-seven_day'))

      // De nouveaux chiffres : le clic suivant les relit.
      limites.limites = [{ kind: 'five_hour', percentUsed: 12, resetsAt: new Date(MAINTENANT + HEURE / 2).toISOString() }]
      await ui.press({ key: 'actualiser-limites' })
      expect(await ui.find({ type: 'Text', text: '12 % · réinit. dans 30 min' })).toBeDefined()
      expect(await ui.find({ key: 'limite-seven_day' })).toBeUndefined()

      await ui.press({ key: 'stats-bouton' })
      expect(await ui.find({ key: 'limites' })).toBeUndefined()
      await ui.unmount()
    })
  }
})

describe('le panneau', () => {
  for (const surface of SURFACES) {
    test(`six onglets, et chaque réglage est gardé dans le store (${surface})`, async ($, on) => {
      simuler(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      for (const m of ['son', 'correction', 'stats', 'proposition', 'confirmation', 'progression']) {
        expect(await ui.find({ type: 'Button', key: `onglet-${m}` })).toBeDefined()
      }
      expect(await ui.find({ type: 'Button', key: 'onglet-relais' })).toBeUndefined()
      expect(await ui.find({ type: 'Button', key: 'tester' })).toBeDefined()

      await ui.press({ key: 'off' })
      expect(await etat($)).toContain('Son          : Off')

      await ui.press({ key: 'onglet-proposition' })
      for (const key of ['nombre-1', 'nombre-5', 'disposition-ligne', 'disposition-liste', 'proposer']) {
        expect(await ui.find({ type: 'Button', key })).toBeDefined()
      }
      await ui.press({ key: 'nombre-5' })
      await ui.press({ key: 'disposition-liste' })
      expect(await etat($)).toContain('Proposition  : On · 5 · une par ligne')

      await ui.press({ key: 'onglet-confirmation' })
      await ui.press({ key: 'on' })
      expect(await etat($)).toContain('Confirmation : On')
      await ui.unmount()
    })
  }

  for (const surface of SURFACES) {
    test(`l’onglet Stats : la session, le forfait et le Relais (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      on('turn.start', (_$, e) => ({ turnId: e.turnId }))
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await ui.press({ key: 'onglet-stats' })
      for (const texte of ['Cette session', 'Forfait', 'Relais', 'Limite 5 h', 'Semaine', '12 min', '34 %']) {
        expect(await ui.find({ type: 'Text', text: texte })).toBeDefined()
      }
      expect(await ui.find({ type: 'Text', text: '68k / 200k jetons' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /^· 4,82\s\$ US$/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ' Messages 56k' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: / MCP / })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /deux clics/ })).toBeUndefined()

      // Le Relais : un premier clic demande confirmation, qui s'éteint après 6 secondes.
      expect((await ui.find({ type: 'Button', key: 'relais' }))?.props.label).toBe('⇄ Relais')
      await ui.press({ key: 'relais' })
      expect((await ui.find({ type: 'Button', key: 'relais' }))?.props.label).toBe('Confirmer ?')
      await horloge.advance(6_500)
      expect((await ui.find({ type: 'Button', key: 'relais' }))?.props.label).toBe('⇄ Relais')

      // Pendant que Claude travaille, le bouton attend.
      await $.turn.start({ text: 'Travaille', turnId: 't1' })
      expect((await ui.find({ type: 'Button', key: 'relais' }))?.props.dimColor).toBe(true)
      await ui.press({ key: 'relais' })
      expect((await ui.find({ type: 'Button', key: 'relais' }))?.props.label).toBe('⇄ Relais')
      await ui.unmount()
    })
  }

  for (const surface of SURFACES) {
    test(`l’onglet Général : le Son et les Croquis, chacun On / Off (${surface})`, async ($, on) => {
      simuler(on)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      expect((await ui.find({ type: 'Button', key: 'onglet-son' }))?.props.label).toBe('Général ●')
      expect(await ui.find({ type: 'Text', text: '⚙ Général' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Croquis 👁' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'tester' })).toBeDefined()

      await ui.press({ key: 'croquis-on' })
      expect(await etat($)).toContain('Croquis      : On')
      await ui.press({ key: 'off' })
      expect(await etat($)).toContain('Son          : Off')
      // Le Son à Off, les Croquis à On : l'onglet reste allumé ; les deux à Off, il s'éteint.
      expect((await ui.find({ type: 'Button', key: 'onglet-son' }))?.props.label).toBe('Général ●')
      await ui.press({ key: 'croquis-off' })
      expect((await ui.find({ type: 'Button', key: 'onglet-son' }))?.props.label).toBe('Général ○')
      await ui.unmount()
    })
  }

  test('« /relais » marche sans réglage, et un ancien « relais : false » n’y change rien', async ($, on) => {
    simuler(on, [], { reglages: { ...DEFAUT, relais: false } })
    on('session.root', () => ({ value: '/tmp/projet' }))
    const texte = ((await $.command.run({
      command: 'relais',
      args: 'dernier',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 140 },
    })) as { text: string }).text
    expect(texte).not.toContain('Off')
    expect(((await myconfig($, 'relais off')) as { text: string }).text).toBe(RELAIS_TOUJOURS)
  })

  test('les réglages gardés dans le store sont relus', async ($, on) => {
    simuler(on, [], { reglages: { ...DEFAUT, son: false, nombre: 2 } })
    const text = await etat($)
    expect(text).toContain('Son          : Off')
    expect(text).toContain('Proposition  : On · 2 · sur une ligne')
  })

  test('« /myconfig etat » résume les réglages et les stats', async ($, on) => {
    simuler(on)
    const text = await etat($)
    expect(text).toContain('Proposition  : On · 3 · sur une ligne')
    expect(text).toContain('Confirmation : Off')
    expect(text).toMatch(/Session {2}: 12 min/)
    expect(text).toMatch(/68\s000 \/ 200\s000 jetons \(34 %\)/)
  })
})

describe('la Confirmation', () => {
  test('sans feu vert, Claude résume et Write est refusé ; avec, il produit', async ($, on) => {
    simuler(on)
    on('tool.call', () => ({ result: 'écrit' }))
    on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Bonjour', scope: 'shared' as const }] }))
    await myconfig($, 'confirmation on')

    const { sections } = await $.prompt.compose({
      model: 'claude-opus-5-5',
      promptModel: 'claude-opus-5-5',
      surfaces: [],
      tools: [],
      outputStyle: null,
      traits: [],
    })
    expect(sections.map(s => s.id)).toEqual(['intro', SECTION])

    const attente = await $.prompt.submit({ text: 'Crée le fichier notes.md', origin: { kind: 'composer' }, wait: false })
    expect(attente.context).toEqual([NOTE_ATTENTE])
    const refuse = await $.tool.call({ tool: 'Write', tool_use_id: 't1', file_path: '/tmp/notes.md', content: 'x' })
    expect('deny' in refuse ? refuse.deny : undefined).toBe(REFUS)

    const vert = await $.prompt.submit({ text: 'go', origin: { kind: 'composer' }, wait: false })
    expect(vert.context).toEqual([NOTE_FEU_VERT])
    const ecrit = await $.tool.call({ tool: 'Write', tool_use_id: 't2', file_path: '/tmp/notes.md', content: 'x' })
    expect(ecrit.result).toBe('écrit')
  })

  test('à Off, rien ne change', async ($, on) => {
    simuler(on)
    on('tool.call', () => ({ result: 'écrit' }))
    const envoi = await $.prompt.submit({ text: 'Crée le fichier', origin: { kind: 'composer' }, wait: false })
    expect(envoi.context).toBeUndefined()
    const ecrit = await $.tool.call({ tool: 'Write', tool_use_id: 't3', file_path: '/tmp/a.md', content: 'x' })
    expect(ecrit.result).toBe('écrit')
  })
})

describe('les Croquis', () => {
  test('à On, la règle des croquis entre dans la consigne système, à côté de la Confirmation', async ($, on) => {
    simuler(on)
    on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'Bonjour', scope: 'shared' as const }] }))
    const composer = async () =>
      (
        await $.prompt.compose({
          model: 'claude-opus-5-5',
          promptModel: 'claude-opus-5-5',
          surfaces: [],
          tools: [],
          outputStyle: null,
          traits: [],
        })
      ).sections.map(s => s.id)
    expect(await composer()).toEqual(['intro'])
    await myconfig($, 'croquis on')
    expect(await composer()).toEqual(['intro', SECTION_CROQUIS])
    await myconfig($, 'confirmation on')
    expect(await composer()).toEqual(['intro', SECTION, SECTION_CROQUIS])
    await myconfig($, 'croquis off')
    expect(await composer()).toEqual(['intro', SECTION])
  })
})

describe('le titre de la Progression (Titre 1)', () => {
  for (const surface of SURFACES) {
    test(`une consigne longue est résumée en une ligne, une courte reste telle quelle (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      const appels: string[] = []
      on('model.complete', (_$, e) => {
        appels.push(typeof e.system === 'string' ? e.system : '')
        return { value: { isAnswered: true as const, text: '« corriger 2 défauts et publier la 0.8.0. »', usage: USAGE } }
      })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })

      await $.turn.start({ text: 'corrige les deux défauts dont on a parlé, puis publie la version 0.8.0', turnId: 't1' })
      await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: '/x/a.md' })
      expect(await ui.find({ type: 'Text', text: /^Corrige les deux défauts/ })).toBeDefined()
      for (let i = 0; i < 20 && (await ui.find({ type: 'Text', text: 'Corriger 2 défauts et publier la 0.8.0' })) === undefined; i++) {
        await horloge.advance(50)
      }
      expect(await ui.find({ type: 'Text', text: 'Corriger 2 défauts et publier la 0.8.0' })).toBeDefined()
      expect(appels).toEqual([CONSIGNE_TITRE])

      await $.turn.complete({ reason: 'answer', answer: 'fait', durationMs: 1000, isAborted: false, turnId: 't1' })
      await $.turn.start({ text: 'met à jour le git', turnId: 't2' })
      await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: '/x/b.md' })
      await horloge.advance(500)
      expect(await ui.find({ type: 'Text', text: 'Met à jour le git' })).toBeDefined()
      expect(appels).toHaveLength(1)
      await ui.unmount()
    })
  }
})

describe('la mise à jour depuis GitHub (onglet Général, Croquis 4)', () => {
  test('les fonctions : version, statut, message', () => {
    expect(lireVersion('{"name":"myconfig","version":"0.9.0"}')).toBe('0.9.0')
    expect(lireVersion('pas du json')).toBe(null)
    const base = { locale: '0.9.0', distante: '0.9.0', retard: 0, verifie: 0, erreur: null }
    expect(statutVersion(base, null)).toEqual({ texte: 'à jour', couleur: 'success', disponible: false })
    expect(statutVersion({ ...base, distante: '0.9.1', retard: 2 }, null)).toMatchObject({ texte: '→ 0.9.1 disponible', disponible: true })
    expect(statutVersion({ ...base, retard: 1 }, null)).toMatchObject({ texte: '→ 1 changement sur GitHub', disponible: true })
    expect(statutVersion({ ...base, erreur: 'GitHub injoignable' }, null)).toMatchObject({ texte: 'GitHub injoignable', disponible: false })
    expect(statutVersion(base, 'mise-a-jour')).toMatchObject({ texte: 'mise à jour…', disponible: false })
    expect(messageMiseAJour('0.9.0', '0.9.1', true)).toBe('MyConfig : 0.9.0 → 0.9.1, rechargement des mods…')
    expect(messageMiseAJour('0.9.0', '0.9.0', false)).toBe('MyConfig : déjà à jour (0.9.0).')
  })

  // Le dépôt du mod, simulé : `local` (git status), `retard` (changements sur GitHub), et la
  // version que `git pull` apporte.
  function simulerGit(on: On, monde: { local: string; retard: number; distante: string }) {
    const appels: string[] = []
    let version = '0.9.0'
    let tete = 'aaa'
    const sortie = (stdout: string, exitCode = 0) => ({
      value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    on('process.run', (_$, e) => {
      const commande = e.argv.join(' ')
      appels.push(commande)
      if (commande === 'git status --porcelain') return sortie(monde.local)
      if (commande === 'git rev-list --count HEAD..@{u}') return sortie(`${monde.retard}\n`)
      if (commande === 'git show @{u}:.claude-plugin/plugin.json') return sortie(JSON.stringify({ version: monde.distante }))
      if (commande === 'git rev-parse HEAD') return sortie(`${tete}\n`)
      if (commande === 'git pull --ff-only --quiet') {
        // Rien à tirer quand GitHub n'a rien de plus.
        if (monde.retard > 0) {
          version = monde.distante
          tete = 'bbb'
        }
        return sortie('')
      }
      return sortie('')
    })
    on('fs.read', () => ({ value: JSON.stringify({ version }) }))
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    const recharges: string[] = []
    on('command.run', { command: 'reload-plugins' }, () => {
      recharges.push('reload-plugins')
      return { text: '' }
    })
    return { appels, toasts, recharges }
  }

  for (const surface of SURFACES) {
    test(`une version plus récente : le bouton fonce, met à jour, puis recharge les mods (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      const git = simulerGit(on, { local: '', retard: 3, distante: '0.9.1' })
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await ui.press({ key: 'onglet-son' })
      await horloge.advance(10)
      expect(git.appels).toContain('git fetch --quiet origin')
      expect(await ui.find({ type: 'Text', text: '0.9.0' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '→ 0.9.1 disponible' })).toBeDefined()
      expect((await ui.find({ type: 'Button', key: 'mettre-a-jour' }))?.props).toMatchObject({
        label: '⬇ Mettre à jour et recharger',
        variant: 'primary',
      })
      expect(await ui.find({ type: 'Button', key: 'recharger' })).toBeDefined()

      await ui.press({ key: 'mettre-a-jour' })
      await horloge.advance(10)
      expect(git.appels).toContain('git pull --ff-only --quiet')
      expect(git.toasts).toContain('MyConfig : 0.9.0 → 0.9.1, rechargement des mods…')
      expect(git.recharges).toEqual(['reload-plugins'])
      expect(await ui.find({ type: 'Text', text: 'à jour' })).toBeDefined()
      await ui.unmount()
    })
  }

  test('des modifications locales arrêtent la mise à jour : rien n’est tiré ni rechargé', async ($, on) => {
    const horloge = simuler(on)
    const git = simulerGit(on, { local: ' M hooks/register.tsx\n', retard: 1, distante: '0.9.1' })
    const ui = await $.ui.mount({ plugin: 'myconfig', surface: 'terminal', ...panneau })
    await ui.press({ key: 'mettre-a-jour' })
    await horloge.advance(10)
    expect(git.appels).not.toContain('git pull --ff-only --quiet')
    expect(git.toasts).toEqual(['MyConfig : mise à jour annulée, des modifications locales ne sont pas sur GitHub.'])
    expect(git.recharges).toEqual([])
    await ui.unmount()
  })

  test('déjà à jour : pas de rechargement ; ↻ recharge les mods', async ($, on) => {
    const horloge = simuler(on)
    const git = simulerGit(on, { local: '', retard: 0, distante: '0.9.0' })
    const ui = await $.ui.mount({ plugin: 'myconfig', surface: 'terminal', ...panneau })
    await ui.press({ key: 'mettre-a-jour' })
    await horloge.advance(10)
    expect(git.toasts).toEqual(['MyConfig : déjà à jour (0.9.0).'])
    expect(git.recharges).toEqual([])
    await ui.press({ key: 'recharger' })
    await horloge.advance(10)
    expect(git.recharges).toEqual(['reload-plugins'])
    await ui.unmount()
  })
})

describe('la recharge automatique des mods', () => {
  test('les fonctions : marqueur, dossier des mods, recherche', () => {
    expect(cheminMarqueur('abc-123')).toBe('/tmp/claude-myconfig/mods-abc-123')
    expect(cheminMarqueur('a/b c')).toBe('/tmp/claude-myconfig/mods-a_b_c')
    expect(dossierMods('/Users/dany/Developer/Plugins/myconfig')).toBe('/Users/dany/Developer/Plugins')
    expect(dossierMods('/Users/dany/Developer/Plugins/myconfig/')).toBe('/Users/dany/Developer/Plugins')
    const argv = chercherChangement('/Plugins', '/tmp/m')
    expect(argv.slice(0, 2)).toEqual(['find', '/Plugins'])
    expect(argv).toContain('-newer')
    expect(argv.join(' ')).toContain('-name .git -o -name .relais')
    expect(argv.at(-1)).toBe('-quit')
    // La commande « /myconfig recharge ».
    expect(DEFAUT.rechargeAuto).toBe(true)
    const off = appliquer(DEFAUT, 'recharge off')
    expect('reglages' in off && off.reglages.rechargeAuto).toBe(false)
  })

  // Le dossier des mods, simulé : `change` dit si `find` trouve un fichier plus récent que le marqueur.
  function simulerMods(on: On, monde: { change: boolean; marqueur: boolean }) {
    const commandes: string[] = []
    const recharges: string[] = []
    on('session.id', () => ({ value: 'session-1' }))
    on('process.run', (_$, e) => {
      commandes.push(e.argv[0] ?? '')
      if (e.argv[0] === 'touch') {
        monde.marqueur = true
        monde.change = false
      }
      const trouve = e.argv[0] === 'find' && monde.change ? '/Plugins/myconfig/hooks/register.tsx\n' : ''
      const exitCode = e.argv[0] === 'find' && !monde.marqueur ? 1 : 0
      return { value: { exitCode, stdout: trouve, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    on('command.run', { command: 'reload-plugins' }, () => {
      recharges.push('reload-plugins')
      return { text: '' }
    })
    return { commandes, recharges }
  }

  const finir = ($: Engine, agentId?: string) =>
    $.turn.complete({
      reason: 'answer',
      answer: 'fait',
      durationMs: 1000,
      isAborted: false,
      turnId: 't1',
      ...(agentId === undefined ? {} : { agentId }),
    })

  test('un mod a changé pendant le tour : « /reload-plugins » à la fin, une seule fois', async ($, on) => {
    const horloge = simuler(on)
    const mods = simulerMods(on, { change: true, marqueur: true })
    // Le message lui-même ne recharge rien : le moteur refuse une commande dans prompt.submit.
    await $.prompt.submit({ text: 'Ajoute un bouton', origin: { kind: 'composer' }, wait: false })
    expect(mods.recharges).toEqual([])
    await finir($)
    await horloge.advance(100)
    expect(mods.recharges).toEqual(['reload-plugins'])
    // Le marqueur est posé avant la recharge : le tour suivant ne recharge plus.
    expect(mods.commandes.indexOf('touch')).toBeGreaterThan(mods.commandes.indexOf('find'))
    await finir($)
    await horloge.advance(100)
    expect(mods.recharges).toEqual(['reload-plugins'])
  })

  test('rien n’a changé, ou pas encore de marqueur : pas de recharge', async ($, on) => {
    const horloge = simuler(on)
    const mods = simulerMods(on, { change: false, marqueur: false })
    await finir($)
    await horloge.advance(100)
    expect(mods.commandes).toContain('touch')
    await finir($)
    await horloge.advance(100)
    expect(mods.recharges).toEqual([])
  })

  test('à Off, ou à la fin du tour d’un sous-agent, pas de recharge', async ($, on) => {
    const horloge = simuler(on)
    const mods = simulerMods(on, { change: true, marqueur: true })
    await finir($, 'agent-1')
    await horloge.advance(100)
    expect(mods.recharges).toEqual([])
    await myconfig($, 'recharge off')
    await finir($)
    await horloge.advance(100)
    expect(mods.recharges).toEqual([])
    expect(await etat($)).toContain('Recharge     : Off')
  })
})

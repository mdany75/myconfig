import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { estFeuVert, NOTE_ATTENTE, NOTE_FEU_VERT, REFUS, SECTION } from '../hooks/confirmation'
import { CONSIGNE as CONSIGNE_PROMPT, CONSIGNE_ORTHOGRAPHE } from '../hooks/correction'
import {
  actionCourante,
  appliquerTodos,
  chapelet,
  compter,
  debuterAction,
  demarrer,
  finirAction,
  majEtape,
  nouvelle,
  pourcentage,
  remplissagePiste,
  repartir,
  resteEstime,
  segmentsPiste,
  sorteDe,
  totalActions,
  visible,
} from '../hooks/progression'
import { consigne, extraire } from '../hooks/proposition'
import { appliquer, completer, DEFAUT } from '../hooks/reglages'
import { couleur, delai, glyphe, jetons, minutes, nomLimite, remplissage, trierLimites } from '../hooks/stats'

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

// Le monde sous le mod : store, horloge à 12 minutes, contexte à 34 %, modèle et prompts simulés.
function simuler(on: On, envoyes: string[] = [], store: Record<string, unknown> = {}, limites = forfait()) {
  mock.store(on, store)
  const horloge = mock.clock(on, { now: MAINTENANT })
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 68_000, window: 200_000, percent: 34 },
      rateLimits: limites.limites,
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

  test('« Reste après la fin » : instantané, ou 5 à 30 secondes', () => {
    expect(DEFAUT.resteApres).toBe(15)
    expect(completer({ resteApres: 7 }).resteApres).toBe(15)
    const cinq = appliquer(DEFAUT, 'progression 5')
    expect('reglages' in cinq && cinq.reglages.resteApres).toBe(5)
    const aussitot = appliquer(DEFAUT, 'progression instantané')
    expect('reglages' in aussitot && aussitot.reglages.resteApres).toBe(0)
    expect('erreur' in appliquer(DEFAUT, 'progression 7')).toBe(true)
    const apparait = appliquer(DEFAUT, 'progression apparait 10')
    expect('reglages' in apparait && [apparait.reglages.apparaitApres, apparait.reglages.resteApres]).toEqual([10, 15])
    const reste = appliquer(DEFAUT, 'progression reste 30')
    expect('reglages' in reste && reste.reglages.resteApres).toBe(30)
    expect(DEFAUT.apparaitApres).toBe(0)
    const p = appliquerTodos(nouvelle('x', 0), TODOS, 0)
    expect(visible({ ...p, fin: 1000 }, 1000, 0)).toBe(false)
    expect(visible({ ...p, fin: 1000 }, 5999, 5000)).toBe(true)
    expect(visible({ ...p, fin: 1000 }, 6000, 5000)).toBe(false)
  })

  test('« Apparaît après » : rien avant le délai, et rien pour une tâche finie avant', () => {
    const p = appliquerTodos(nouvelle('x', 0), TODOS, 0)
    expect(visible(p, 9_999, 15_000, 10_000)).toBe(false)
    expect(visible(p, 10_000, 15_000, 10_000)).toBe(true)
    expect(visible({ ...p, fin: 5_000 }, 6_000, 15_000, 10_000)).toBe(false)
    expect(visible({ ...p, fin: 12_000 }, 13_000, 15_000, 10_000)).toBe(true)
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

describe('la Progression : reste après la fin', () => {
  for (const surface of SURFACES) {
    test(`le panneau règle le temps ; instantané ferme dès la fin, 5 s reste 5 s (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      const pane = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await pane.press({ key: 'onglet-progression' })
      expect(await pane.find({ type: 'Text', text: 'Reste après' })).toBeDefined()
      for (const sec of [0, 5, 10, 15, 20, 25, 30]) {
        expect(await pane.find({ type: 'Button', key: `reste-${sec}` })).toBeDefined()
      }
      expect((await pane.find({ type: 'Button', key: 'reste-0' }))?.props.label).toBe('Instantané')

      await pane.press({ key: 'reste-0' })
      expect(await etat($)).toContain('Progression  : On · apparaît aussitôt · ferme instantanément')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Migration', turnId: 't1' })
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      expect(await ui.find({ key: 'progression' })).toBeDefined()
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't1' })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()

      await pane.press({ key: 'reste-5' })
      expect(await etat($)).toContain('Progression  : On · apparaît aussitôt · reste 5 s')
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
  }
})

describe('la Progression : apparaît après', () => {
  for (const surface of SURFACES) {
    test(`le panneau règle le délai ; la barre attend 10 s de travail (${surface})`, async ($, on) => {
      const horloge = simuler(on)
      simulerTours(on)
      const pane = await $.ui.mount({ plugin: 'myconfig', surface, ...panneau })
      await pane.press({ key: 'onglet-progression' })
      expect(await pane.find({ type: 'Text', text: 'Apparaît après' })).toBeDefined()
      for (const sec of [0, 5, 10, 15, 20, 25, 30]) {
        expect(await pane.find({ type: 'Button', key: `apparait-${sec}` })).toBeDefined()
      }
      await pane.press({ key: 'apparait-10' })
      expect(await etat($)).toContain('Progression  : On · apparaît après 10 s · reste 15 s')

      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      await $.turn.start({ text: 'Migration', turnId: 't1' })
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u1', todos: TODOS })
      await horloge.advance(9_000)
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await horloge.advance(1_500)
      expect(await ui.find({ key: 'progression' })).toBeDefined()

      // Une tâche finie avant le délai ne s'affiche jamais.
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u2', todos: TODOS.map(t => ({ ...t, status: 'completed' as const })) })
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't1' })
      await horloge.advance(16_000)
      await $.turn.start({ text: 'Vite fait', turnId: 't2' })
      await $.tool.call({ tool: 'TodoWrite', tool_use_id: 'u3', todos: TODOS.map(t => ({ ...t, status: 'completed' as const })) })
      await horloge.advance(3_000)
      await $.turn.complete({ reason: 'answer', answer: '', durationMs: 0, isAborted: false, turnId: 't2' })
      expect(await ui.find({ key: 'progression' })).toBeUndefined()
      await ui.unmount()
      await pane.unmount()
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
    test(`montre Correction, Stats, Relais et ⚙, sans quotas de 5 h ni de 7 jours (${surface})`, async ($, on) => {
      simuler(on)
      await etat($)
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      for (const key of ['myconfig', 'ameliorer', 'revenir', 'stats', 'relais', 'reglages']) {
        expect(await ui.find({ key })).toBeDefined()
      }
      expect(await ui.find({ type: 'Text', text: /34 %/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /68k\/200k · 12 min/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /5h|7j/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Confirmation/ })).toBeUndefined()
      await ui.unmount()
    })

    test(`un module à Off disparaît de la bande (${surface})`, async ($, on) => {
      simuler(on)
      await myconfig($, 'correction off')
      await myconfig($, 'stats off')
      await myconfig($, 'relais off')
      const ui = await $.ui.mount({ plugin: 'myconfig', surface, ...bande })
      for (const key of ['ameliorer', 'stats', 'relais']) {
        expect(await ui.find({ key })).toBeUndefined()
      }
      expect(await ui.find({ key: 'reglages' })).toBeDefined()
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
      for (const m of ['son', 'relais', 'correction', 'stats', 'proposition', 'confirmation', 'progression']) {
        expect(await ui.find({ type: 'Button', key: `onglet-${m}` })).toBeDefined()
      }
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

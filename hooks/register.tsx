// MyConfig : les mods jauge, fil-son, relais, plume et cap réunis, plus la Confirmation.
// Tout ce qui touche au moteur ($) vit dans ce fichier : le moteur ne suit pas $ à travers
// un import. Les autres fichiers de hooks/ ne contiennent que des fonctions pures.

import type { EngineInterface, RenderElement, RenderInput, Register } from 'claude-code'

import type { Disposition, Module, Progression, Reglages, SorteAction, TravailCorrection } from '../types'
import {
  CONSIGNE as CONSIGNE_CONFIRMATION,
  estDeLUtilisateur,
  estFeuVert,
  NOTE_ATTENTE,
  NOTE_FEU_VERT,
  OUTILS_BLOQUES,
  REFUS,
  SECTION,
} from './confirmation'
import {
  CONSIGNE as CONSIGNE_CORRECTION,
  CONSIGNE_ORTHOGRAPHE,
  enveloppe as enveloppeCorrection,
  nettoyer,
  raisonRefus,
} from './correction'
import { USAGE as USAGE_CORRECTION } from './correction'
import {
  actionCourante,
  ajouterEtape,
  appliquerTodos,
  chapelet,
  compter,
  debuterAction,
  decrireOutil,
  demarrer,
  duree,
  exemple,
  EXEMPLE_MS,
  EXEMPLE_SANS_LISTE,
  finirAction,
  lignesJournal,
  majEtape,
  NOMS_SORTES,
  pisteSvg,
  pourcentage,
  remplissagePiste,
  repartir,
  resteEstime,
  segmentsPiste,
  sorteDe,
  suivre,
  TEINTES_SORTES,
  terminee,
  titreAction,
  totalActions,
  VERT_FIN,
  visible,
} from './progression'
import type { Todo } from './progression'
import { consigne as consigneProposition, extraire } from './proposition'
import {
  appliquer,
  avecBoutons,
  avecModes,
  completer,
  DESCRIPTIONS,
  ICONES,
  libelleDisposition,
  MODULES,
  NOMBRE_MAX,
  NOMBRE_MIN,
  NOMS,
  DISPARITIONS,
  libelleDisparition,
  libelleLignes,
  LIGNES_JOURNAL,
  resume,
  USAGE,
} from './reglages'
import { CONSIGNE as CONSIGNE_RELAIS, enveloppe as enveloppeRelais, reprise, repriseLegere } from './relais-consigne'
import {
  aPurger,
  citer,
  compterMots,
  extraireSection,
  libelle,
  nettoyer as nettoyerRecap,
  nomDeFichier,
  problemeRecap,
  sectionDepot,
  SEUIL_CONSEIL,
  tronquer,
  USAGE as USAGE_RELAIS,
} from './relais-outils'
import { doitSonner } from './son'
import {
  anneau,
  barre,
  BLEU,
  couleur,
  delai,
  detail,
  glyphe,
  jetons,
  lire,
  minutes,
  nomLimite,
  pourcent,
  remplissage,
  trierLimites,
  VERT,
} from './stats'

// ── État ──────────────────────────────────────────────────────────────────────
// Chaque valeur de $.state est déclarée dans types/index.d.ts.

const reglages = { plugin: 'myconfig', key: 'reglages' } as const
const onglet = { plugin: 'myconfig', key: 'onglet' } as const
const mesure = { plugin: 'myconfig', key: 'mesure' } as const
const limitesOuvertes = { plugin: 'myconfig', key: 'limitesOuvertes' } as const
const maintenant = { plugin: 'myconfig', key: 'maintenant' } as const
const suites = { plugin: 'myconfig', key: 'suites' } as const
const suitesEnCours = { plugin: 'myconfig', key: 'suitesEnCours' } as const
const original = { plugin: 'myconfig', key: 'original' } as const
const improved = { plugin: 'myconfig', key: 'improved' } as const
const correctionEnCours = { plugin: 'myconfig', key: 'correctionEnCours' } as const
const etapeRelais = { plugin: 'myconfig', key: 'etapeRelais' } as const
const feuVert = { plugin: 'myconfig', key: 'feuVert' } as const
const progression = { plugin: 'myconfig', key: 'progression' } as const
const journalOuvert = { plugin: 'myconfig', key: 'journalOuvert' } as const

// Les réglages dans $.store, qui survit aux sessions et à « /clear ».
const CLE_REGLAGES = 'reglages'
// Le chemin du dernier récapitulatif vit dans $.store, par projet : « /clear » vide $.state.
const cleDernier = (racine: string) => `dernier:${racine}`

export const PANNEAU = 'myconfig'
const TITRE = 'MyConfig'
const SON = { asset: 'sons/fin.aiff' }

const DOSSIER_RELAIS = '.relais'
// Délai pour confirmer le deuxième clic du Relais, après quoi le bouton revient au repos.
const DELAI_CONFIRMATION = 6000
// Sans le cache de la conversation, on garde le début et la fin de la transcription.
const TRANSCRIPTION_MAX = 300_000
// Nombre de récapitulatifs gardés par « /relais purger ».
const GARDER_PAR_DEFAUT = 20
// Au-delà, le récapitulatif est signalé comme long (la consigne vise moins de 900 mots).
const MOTS_LONG = 1500

// La minuterie qui avance la durée de session chaque minute ; une seule par chargement.
let minuterie: { cancel: () => unknown } | undefined
// Début du tour en cours ; un tour sans texte (retour d'un sous-agent) garde le début précédent.
let debut: number | null = null
// Propositions : seule la dernière demande compte, une réponse plus ancienne est ignorée.
let generation = 0
// Un seul relais à la fois, même si deux appels partent avant que l'état soit écrit.
let relaisEnCours = false
// Progression : le chrono qui fait avancer la piste chaque seconde pendant le travail.
let chrono: { cancel: () => unknown } | undefined
// Progression : seul le dernier exemple lancé du panneau compte.
let exempleGeneration = 0

type Bande = RenderInput<'AbovePrompt'>
type Panneau = RenderInput<'Pane'>

// ── Réglages ──────────────────────────────────────────────────────────────────

// $.state d'abord ; après un « /clear » il est vide, et $.store a gardé les réglages.
async function lireReglages($: EngineInterface): Promise<Reglages> {
  // Complétés à chaque lecture : $.state garde ceux d'une version plus ancienne après un rechargement.
  const { value } = await $.state.get(reglages)
  if (value !== undefined && value !== null) {
    return completer(value)
  }
  return completer(await $.store.get(CLE_REGLAGES))
}

async function ecrireReglages($: EngineInterface, valeur: Reglages) {
  await $.state.set(reglages, valeur)
  await $.store.set(CLE_REGLAGES, valeur)
  if (!valeur.proposition) {
    await oublierSuites($)
  }
}

async function changer($: EngineInterface, fn: (r: Reglages) => Reglages) {
  await ecrireReglages($, fn(await lireReglages($)))
}

async function ouvrirPanneau($: EngineInterface) {
  return $.ui.open({ id: PANNEAU, title: TITRE })
}

const horsService = (nom: string) => `${nom} est à Off. « /myconfig ${nom.toLowerCase()} on » le remet.`

// ── Stats ─────────────────────────────────────────────────────────────────────

async function mesurer($: EngineInterface) {
  const usage = await $.session.usage()
  await $.state.set(mesure, lire(usage.startedAt, usage.context, usage.rateLimits))
  await $.state.set(maintenant, await $.clock.now())
  if (minuterie === undefined) {
    minuterie = $.clock.every(60_000, async () => {
      await $.state.set(maintenant, await $.clock.now())
    })
  }
}

// Un clic sur les Stats ouvre ou ferme la vue des limites, et relit les chiffres.
async function basculerLimites($: EngineInterface) {
  await mesurer($)
  const { value: ouvert = false } = await $.state.get(limitesOuvertes)
  await $.state.set(limitesOuvertes, !ouvert)
}

// Un clic sous la barre de Progression déplie ou replie le journal des actions.
async function basculerJournal($: EngineInterface) {
  const { value: ouvert = false } = await $.state.get(journalOuvert)
  await $.state.set(journalOuvert, !ouvert)
}

// Un clic sur la barre d'une tâche arrêtée l'efface (avec « Disparaît après : Jamais », seul moyen).
async function effacerProgression($: EngineInterface) {
  const { value: p = null } = await $.state.get(progression)
  if (p !== null && (p.fin !== null || p.exemple)) {
    await $.state.set(progression, { ...p, effacee: true })
  }
}

// « Effacer du chat » ne vaut que si la Progression est à On : ailleurs, rien ne montrerait les commandes.
async function commandesMasquees($: EngineInterface) {
  const r = await lireReglages($)
  return r.progression && r.masquerCommandes
}

// Le temps où la barre reste après la fin : Jamais, jusqu'au clic qui l'efface.
const resteMs = (r: Reglages) => (r.disparaitApres === null ? Infinity : r.disparaitApres * 1000)

// ── Progression ───────────────────────────────────────────────────────────────

async function changerProgression($: EngineInterface, fn: (p: Progression) => Progression) {
  const { value: p = null } = await $.state.get(progression)
  if (p !== null && !p.exemple) {
    await $.state.set(progression, fn(p))
  }
}

// Une fois la tâche finie, la bande se redessine pour retirer la barre : `maintenant` avance.
function redessinerApres($: EngineInterface, ms: number) {
  $.clock.after(ms, () => {
    void (async () => {
      await $.state.set(maintenant, await $.clock.now())
    })()
  })
}

// Pendant le travail, `maintenant` avance chaque seconde : le chrono et la piste se redessinent.
function demarrerChrono($: EngineInterface) {
  if (chrono === undefined) {
    chrono = $.clock.every(1000, async () => {
      await $.state.set(maintenant, await $.clock.now())
    })
  }
}

function arreterChrono() {
  chrono?.cancel()
  chrono = undefined
}

const tacheEnCours = (p: Progression | null) =>
  p !== null && !p.exemple && p.fin === null && (p.etapes.length > 0 || (p.blocs ?? []).length > 0)

// L'exemple du panneau : 20 secondes, sans toucher à une vraie tâche en cours.
async function montrerExemple($: EngineInterface) {
  const { value: p = null } = await $.state.get(progression)
  if (tacheEnCours(p)) {
    $.ui.toast('Progression : une vraie tâche est en cours, l’exemple attendra.')
    return
  }
  exempleGeneration++
  await $.state.set(progression, exemple(await $.clock.now()))
  $.clock.after(EXEMPLE_MS, () => {
    void (async () => {
      if ((await $.state.get(progression)).value?.exemple === true) {
        await $.state.set(progression, null)
      }
    })()
  })
}

// Une étape de l'exemple sans liste ; ignorée si un autre exemple ou une vraie tâche a pris la place.
async function changerExemple($: EngineInterface, numero: number, fn: (p: Progression, instant: number) => Progression) {
  if (numero !== exempleGeneration) {
    return
  }
  const { value: p = null } = await $.state.get(progression)
  if (p !== null && p.exemple) {
    await $.state.set(progression, fn(p, await $.clock.now()))
  }
}

// L'exemple sans liste : les actions d'une publication passent une à une sur la piste.
async function montrerExempleSansListe($: EngineInterface) {
  const { value: p = null } = await $.state.get(progression)
  if (tacheEnCours(p)) {
    $.ui.toast('Progression : une vraie tâche est en cours, l’exemple attendra.')
    return
  }
  const numero = ++exempleGeneration
  const debut = await $.clock.now()
  await $.state.set(progression, {
    titre: 'Publie la version 0.3.0 (exemple)',
    debut,
    fin: null,
    etapes: [],
    exemple: true,
    blocs: [],
    comptes: {},
  })
  demarrerChrono($)
  let t = 0
  for (const [i, action] of EXEMPLE_SANS_LISTE.entries()) {
    const id = `exemple-${i}`
    const sorte = sorteDe(action.nom)
    const titre = titreAction(action)
    $.clock.after(t, () => void changerExemple($, numero, (x, instant) => debuterAction(x, id, sorte, titre, instant, action)))
    t += action.ms
    $.clock.after(t, () => void changerExemple($, numero, (x, instant) => finirAction(x, id, instant)))
  }
  $.clock.after(t + 50, () => {
    void (async () => {
      await changerExemple($, numero, (x, instant) => ({ ...x, fin: instant }))
      arreterChrono()
    })()
  })
  const { disparaitApres } = await lireReglages($)
  if (disparaitApres === null) {
    return
  }
  $.clock.after(t + 50 + Math.max(3, disparaitApres) * 1000, () => {
    void (async () => {
      if (numero === exempleGeneration && (await $.state.get(progression)).value?.exemple === true) {
        await $.state.set(progression, null)
      }
    })()
  })
}

// ── Proposition ───────────────────────────────────────────────────────────────

async function proposer($: EngineInterface, nombre: number, disposition: Disposition) {
  const numero = ++generation
  await $.state.set(suites, null)
  await $.state.set(suitesEnCours, true)
  try {
    const reponse = await $.model.fork({ prompt: consigneProposition(nombre, disposition) })
    if (numero !== generation) {
      return
    }
    const liste = reponse.isAnswered ? extraire(reponse.text, nombre) : []
    await $.state.set(suites, liste.length > 0 ? liste : null)
  } catch {
    // Pas de propositions cette fois : la bande n'en montre pas.
  } finally {
    if (numero === generation) {
      await $.state.set(suitesEnCours, false)
    }
  }
}

async function oublierSuites($: EngineInterface) {
  generation++
  await $.state.set(suites, null)
  await $.state.set(suitesEnCours, false)
}

async function lancer($: EngineInterface, texte: string) {
  const suite = texte.trim()
  if (suite === '') {
    return
  }
  await oublierSuites($)
  await $.prompt.submit({ text: suite, asUser: true })
}

// ── Correction ────────────────────────────────────────────────────────────────

// « ameliorer » reformule `texte` en prompt structuré, « corriger » corrige seulement le texte ;
// le résultat va dans le champ. Renvoie un message d'erreur, ou rien.
async function ameliorer($: EngineInterface, modele: string, texte: string, travail: TravailCorrection = 'ameliorer') {
  if (texte.trim() === '') {
    return 'Correction : le champ de saisie est vide.'
  }
  if ((await $.state.get(correctionEnCours)).value) {
    return undefined
  }

  await $.state.set(correctionEnCours, travail)
  try {
    const reponse = await $.model.complete({
      model: modele,
      system: travail === 'corriger' ? CONSIGNE_ORTHOGRAPHE : CONSIGNE_CORRECTION,
      prompt: enveloppeCorrection(texte),
      maxTokens: 2048,
      timeoutMs: 90_000,
    })
    if (!reponse.isAnswered) {
      return `Correction : ${travail === 'corriger' ? 'la correction' : 'la reformulation'} a échoué (${reponse.reason}).`
    }

    const nouveau = nettoyer(reponse.text)
    const rempli = await $.prompt.fill({ text: nouveau, mode: 'replace' })
    if (!rempli.isFilled) {
      return `Correction : impossible de remplacer le texte (${raisonRefus(rempli.refusal)}).`
    }

    // Corriger deux fois de suite garde le tout premier texte comme retour.
    const { value: avant = null } = await $.state.get(original)
    const { value: precedent = null } = await $.state.get(improved)
    await $.state.set(original, precedent === texte && avant !== null ? avant : texte)
    await $.state.set(improved, nouveau)
    return undefined
  } finally {
    await $.state.set(correctionEnCours, null)
  }
}

async function revenir($: EngineInterface) {
  if ((await $.state.get(correctionEnCours)).value) {
    return undefined
  }
  const { value: texte = null } = await $.state.get(original)
  if (texte === null) {
    return 'Correction : aucun texte à rétablir.'
  }

  const rempli = await $.prompt.fill({ text: texte, mode: 'replace' })
  if (!rempli.isFilled) {
    return `Correction : impossible de rétablir le texte (${raisonRefus(rempli.refusal)}).`
  }

  await oublierRetour($)
  return undefined
}

// Une fois le prompt envoyé, il n'y a plus de texte à rétablir.
async function oublierRetour($: EngineInterface) {
  await $.state.set(original, null)
  await $.state.set(improved, null)
}

function signaler($: EngineInterface, message: string | undefined) {
  if (message !== undefined) {
    $.ui.toast(message)
  }
}

async function ameliorerLeChamp($: EngineInterface, modele: string, travail: TravailCorrection = 'ameliorer') {
  const { text } = await $.prompt.read()
  signaler($, await ameliorer($, modele, text, travail))
}

async function revenirAuChamp($: EngineInterface) {
  signaler($, await revenir($))
}

// ── Relais ────────────────────────────────────────────────────────────────────

type Redige = { texte: string; tronque: boolean } | { erreur: string }

// Rédige le récapitulatif : d'abord sur la conversation en cache, sinon sur sa transcription.
// Un texte incomplet (sections absentes) est refusé : mieux vaut ne rien effacer.
async function rediger($: EngineInterface): Promise<Redige> {
  const fourche = await $.model.fork({ prompt: CONSIGNE_RELAIS })
  if (fourche.isAnswered) {
    const texte = nettoyerRecap(fourche.text)
    if (problemeRecap(texte) === undefined) {
      return { texte, tronque: false }
    }
  } else if (fourche.reason === 'nothing-to-fork') {
    return { erreur: 'la conversation est vide, il n’y a rien à relayer' }
  }

  const messages = await $.session.messages()
  const brute = messages
    .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Claude'} : ${m.text}`)
    .join('\n\n')
  if (brute.trim() === '') {
    return { erreur: 'la conversation est vide, il n’y a rien à relayer' }
  }
  const { texte: transcription, tronque } = tronquer(brute, TRANSCRIPTION_MAX)
  const reponse = await $.model.complete({
    model: 'sonnet',
    prompt: enveloppeRelais(transcription),
    maxTokens: 4096,
    timeoutMs: 180_000,
  })
  if (!reponse.isAnswered) {
    return { erreur: `la rédaction a échoué (${reponse.reason})` }
  }
  const texte = nettoyerRecap(reponse.text)
  const probleme = problemeRecap(texte)
  if (probleme !== undefined) {
    return { erreur: `le récapitulatif est inutilisable (${probleme})` }
  }
  return { texte, tronque }
}

// L'état du dépôt, relevé par le code plutôt que rappelé par le modèle. Rien hors d'un dépôt git.
async function etatDepot($: EngineInterface, racine: string) {
  try {
    const r = await $.process.run(['git', 'status', '--short', '--branch'], { cwd: racine, timeoutMs: 5000 })
    return r.exitCode === 0 ? sectionDepot(r.stdout) : undefined
  } catch {
    return undefined
  }
}

async function entete($: EngineInterface, quand: number, notes: string[]) {
  const { context } = await $.session.usage()
  const date = new Date(quand).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })
  const contexte = context.percent === undefined || context.percent === null ? '—' : `${Math.round(context.percent)} %`
  const suite = notes.length === 0 ? '' : ` · ${notes.join(' · ')}`
  return `<!-- Relais du ${date} · session ${await $.session.id()} · contexte au moment du relais : ${contexte}${suite} -->`
}

// Supprime les anciens récapitulatifs de .relais/, en gardant les `garder` plus récents.
async function purger($: EngineInterface, garder: number): Promise<string> {
  const racine = await $.session.root()
  let entrees: Awaited<ReturnType<EngineInterface['fs']['list']>> = []
  try {
    entrees = await $.fs.list(`${racine}/${DOSSIER_RELAIS}`)
  } catch {
    return 'Relais : aucun récapitulatif à purger pour ce projet.'
  }
  const noms = aPurger(entrees, garder)
  if (noms.length === 0) {
    return `Relais : rien à purger (${Math.min(entrees.length, garder)} récapitulatif(s) gardé(s) au plus).`
  }
  const r = await $.process.run(['rm', '-f', '--', ...noms.map(n => `${racine}/${DOSSIER_RELAIS}/${n}`)], {
    cwd: racine,
    timeoutMs: 10_000,
  })
  if (r.exitCode !== 0) {
    return `Relais : la purge a échoué (${r.stderr.trim() || `code ${r.exitCode}`}).`
  }
  return `Relais : ${noms.length} ancien(s) récapitulatif(s) supprimé(s), les ${Math.max(garder, 1)} plus récents sont gardés.`
}

// Écrit le récapitulatif, efface la conversation et prépare la reprise.
// `leger` : le message de reprise porte l'état actuel et les prochaines étapes, sans « @ ».
// Renvoie le message à montrer.
export async function passer($: EngineInterface, options: { leger?: boolean } = {}): Promise<string> {
  if (relaisEnCours) {
    return 'Relais : un relais est déjà en cours.'
  }
  relaisEnCours = true
  try {
    const { value: en = null } = await $.state.get(etapeRelais)
    if (en === 'redaction' || en === 'effacement') {
      return 'Relais : un relais est déjà en cours.'
    }

    await $.state.set(etapeRelais, 'redaction')
    $.ui.status('Relais : rédaction du récapitulatif…')
    const recap = await rediger($)
    if ('erreur' in recap) {
      return `Relais : ${recap.erreur}. La conversation n’a pas été effacée.`
    }

    const quand = await $.clock.now()
    const racine = await $.session.root()
    let relatif = `${DOSSIER_RELAIS}/${nomDeFichier(quand)}.md`
    for (let n = 2; await $.fs.exists(`${racine}/${relatif}`); n++) {
      relatif = `${DOSSIER_RELAIS}/${nomDeFichier(quand)}-${n}.md`
    }
    const mots = compterMots(recap.texte)
    const notes = [`${mots} mots`]
    if (mots > MOTS_LONG) {
      notes.push('récapitulatif long')
    }
    if (recap.tronque) {
      notes.push('transcription tronquée au milieu')
    }
    const depot = await etatDepot($, racine)
    const corps = depot === undefined ? recap.texte : `${recap.texte}\n\n${depot}`
    await $.fs.write(`${racine}/${relatif}`, `${await entete($, quand, notes)}\n\n${corps}\n`)
    await $.store.set(cleDernier(racine), relatif)

    await $.state.set(etapeRelais, 'effacement')
    $.ui.status('Relais : effacement de la conversation…')
    await $.command.run({ command: 'clear' })

    const cwd = await $.session.cwd()
    const chemin = citer(racine, cwd, relatif)
    const etat = extraireSection(recap.texte, 'État actuel')
    const etapes = extraireSection(recap.texte, 'Prochaines étapes')
    const message =
      options.leger === true && etat !== undefined && etapes !== undefined
        ? repriseLegere(chemin, etat, etapes)
        : reprise(chemin)
    const rempli = await $.prompt.fill({ text: message, mode: 'replace' })
    if (!rempli.isFilled) {
      return `Relais passé : le récapitulatif est dans ${relatif}, mais le champ a refusé le message de reprise. Demande de lire @${relatif}.`
    }
    const avis = mots > MOTS_LONG ? ' Il est long : à relire.' : ''
    return `Relais passé : récapitulatif dans ${relatif}. Le message de reprise attend dans le champ.${avis}`
  } catch (erreur) {
    return `Relais : échec (${erreur instanceof Error ? erreur.message : String(erreur)}).`
  } finally {
    relaisEnCours = false
    $.ui.status(undefined)
    await $.state.set(etapeRelais, null)
  }
}

// Premier clic : le bouton demande confirmation ; deuxième clic dans les 6 secondes : le relais part.
async function cliquerRelais($: EngineInterface) {
  const { value: en = null } = await $.state.get(etapeRelais)
  if (en === null) {
    await $.state.set(etapeRelais, 'a-confirmer')
    $.clock.after(DELAI_CONFIRMATION, () => {
      void (async () => {
        if ((await $.state.get(etapeRelais)).value === 'a-confirmer') {
          await $.state.set(etapeRelais, null)
        }
      })()
    })
    return
  }
  if (en === 'a-confirmer') {
    await $.state.set(etapeRelais, null)
    $.ui.toast(await passer($))
  }
}

// Ce que répond « /relais … ».
async function commandeRelais($: EngineInterface, args: string): Promise<string> {
  if (/^dernier$/i.test(args)) {
    const racine = await $.session.root()
    const relatif = await $.store.get(cleDernier(racine))
    if (typeof relatif !== 'string') {
      return 'Relais : aucun récapitulatif écrit pour ce projet.'
    }
    const chemin = citer(racine, await $.session.cwd(), relatif)
    if (!(await $.fs.exists(`${racine}/${relatif}`))) {
      return `Relais : le dernier récapitulatif, ${chemin}, n’existe plus.`
    }
    return `Relais : ${chemin}`
  }
  const purge = /^purger(?:\s+(\d+))?$/i.exec(args)
  if (purge !== null) {
    return purger($, purge[1] === undefined ? GARDER_PAR_DEFAUT : Number(purge[1]))
  }
  const leger = /^l[ée]ger$/i.test(args)
  if (args !== '' && !leger && !/^complet$/i.test(args)) {
    return USAGE_RELAIS
  }
  // L'effacement attend la fin de cette commande : le relais se poursuit sans elle.
  void passer($, { leger }).then(message => $.ui.toast(message))
  return 'Relais : rédaction du récapitulatif, puis effacement de la conversation…'
}

// ── La bande (croquis 1, « Tableau de bord ») ────────────────────────────────
// Une carte arrondie : les propositions en haut, la Correction à gauche,
// la Confirmation, les Stats, le Relais et ⚙ à droite.

// L'anneau de contexte : un dessin SVG là où la surface en a, un quart de disque au terminal.
function anneauDe($: EngineInterface, e: Bande, p: number | null): RenderElement {
  if (e.surface === 'terminal') {
    const { Text } = $.ui.resolve(e)
    return <Text color={p === null ? 'subtle' : couleur(p)}>{glyphe(p)}</Text>
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={anneau(p)} alt={`Contexte utilisé : ${pourcent(p)}`} width={18} height={18} />
}

async function bandePropositions($: EngineInterface, e: Bande, r: Reglages): Promise<RenderElement | undefined> {
  if (!r.proposition || e.props.isWorking) {
    return undefined
  }
  const { value: occupe = false } = await $.state.get(suitesEnCours)
  const { value: liste = null } = await $.state.get(suites)
  if (!occupe && liste === null) {
    return undefined
  }

  const { Box, Button, Text } = $.ui.resolve(e)
  if (occupe || liste === null) {
    return (
      <Box key="propositions" flexDirection="row" gap={1}>
        <Text color="claude">✦</Text>
        <Text dimColor>Recherche des propositions…</Text>
      </Box>
    )
  }

  const relancer = (
    <Button
      key="relancer"
      label="↻"
      dimColor
      onPress={() => $.clock.after(1, () => void proposer($, r.nombre, r.disposition))}
    />
  )
  const suite = (texte: string, i: number) => (
    <Button key={`suite-${i}`} label={texte} onPress={() => void lancer($, texte)} />
  )

  if (r.disposition === 'ligne') {
    return (
      <Box key="propositions" flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        <Text color="claude">✦</Text>
        {liste.map(suite)}
        {relancer}
      </Box>
    )
  }
  const derniere = liste.length - 1
  return (
    <Box key="propositions" flexDirection="column">
      {liste.map((texte, i) => (
        <Box key={`ligne-${i}`} flexDirection="row" gap={1} alignItems="center">
          <Text color="claude">{i === 0 ? '✦' : ' '}</Text>
          {suite(texte, i)}
          <Box key={`espace-${i}`} flexGrow={1} />
          {i === derniere ? relancer : null}
        </Box>
      ))}
    </Box>
  )
}

// Les boutons choisis dans le panneau (Afficher) ; le premier affiché est le bouton principal.
async function bandeCorrection($: EngineInterface, e: Bande, r: Reglages, modele: string): Promise<RenderElement> {
  const { Box, Button } = $.ui.resolve(e)
  const { value: travail = null } = await $.state.get(correctionEnCours)
  const { value: retour = null } = await $.state.get(original)
  const occupe = Boolean(travail)
  return (
    <Box key="correction" flexDirection="row" gap={1} flexShrink={1}>
      {r.ameliorer ? (
        <Button
          key="ameliorer"
          label={travail === 'ameliorer' ? 'Reformulation…' : '✎ Améliorer'}
          variant="primary"
          onPress={() => void ameliorerLeChamp($, modele, 'ameliorer')}
        />
      ) : null}
      {r.corriger ? (
        <Button
          key="corriger"
          label={travail === 'corriger' ? 'Correction…' : '✓ Correction'}
          {...(r.ameliorer ? {} : { variant: 'primary' as const })}
          dimColor={occupe && travail !== 'corriger'}
          onPress={() => void ameliorerLeChamp($, modele, 'corriger')}
        />
      ) : null}
      <Button
        key="revenir"
        label="Revenir"
        dimColor={retour === null || occupe}
        onPress={() => void revenirAuChamp($)}
      />
    </Box>
  )
}

async function bandeStats($: EngineInterface, e: Bande): Promise<RenderElement> {
  const { Box, Button, Text } = $.ui.resolve(e)
  const { value: m = null } = await $.state.get(mesure)
  const { value: instant = null } = await $.state.get(maintenant)
  const { value: ouvert = false } = await $.state.get(limitesOuvertes)
  const p = m?.contexte ?? null
  const morceaux: string[] = []
  if (m !== null) {
    morceaux.push(`${m.jetons === null ? '0' : jetons(m.jetons)}/${jetons(m.fenetre)}`)
    if (instant !== null) {
      morceaux.push(minutes(m.debut, instant))
    }
  }
  // Les chiffres sont un bouton : un clic ouvre ou ferme les limites d'utilisation.
  const textes: RenderElement[] = [
    <Text bold color={p === null ? 'subtle' : couleur(p)}>
      {pourcent(p)}
    </Text>,
  ]
  if (morceaux.length > 0) {
    textes.push(<Text dimColor>{` ${morceaux.join(' · ')}`}</Text>)
  }
  textes.push(<Text dimColor>{ouvert ? ' ▴' : ' ▾'}</Text>)
  return (
    <Box key="stats" flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
      {anneauDe($, e, p)}
      <Button key="stats-bouton" plain onPress={() => void basculerLimites($)}>
        {textes}
      </Button>
    </Box>
  )
}

// La vue des limites d'utilisation du forfait, à droite au-dessus des Stats.
async function bandeLimites($: EngineInterface, e: Bande): Promise<{ bloc: RenderElement; rangs: number }> {
  const { Box, Button, Text } = $.ui.resolve(e)
  const { value: m = null } = await $.state.get(mesure)
  const { value: instant = null } = await $.state.get(maintenant)
  const liste = trierLimites(m?.limites ?? [])
  const largeur = Math.max(20, Math.min(46, e.props.bodyColumns - 6))

  const barreDe = (l: { kind: string; pourcent: number }): RenderElement => {
    if (e.surface === 'terminal') {
      const { plein, vide } = remplissage(l.pourcent, largeur)
      return (
        <Text>
          <Text color={BLEU}>{'━'.repeat(plein)}</Text>
          <Text color="subtle">{'━'.repeat(vide)}</Text>
        </Text>
      )
    }
    const { Svg } = $.ui.resolve(e)
    const px = Math.round(largeur * 7.5)
    return (
      <Svg
        source={barre(l.pourcent, px)}
        alt={`${nomLimite(l.kind)} : ${pourcent(l.pourcent)}`}
        width={px}
        height={6}
      />
    )
  }

  const lignes = liste.map(l => {
    const quand = instant === null ? '' : delai(l.reinit, instant)
    return (
      <Box key={`limite-${l.kind}`} flexDirection="column">
        <Box key={`limite-${l.kind}-texte`} flexDirection="row" gap={1}>
          <Text>{nomLimite(l.kind)}</Text>
          <Box key={`limite-${l.kind}-espace`} flexGrow={1} />
          <Text dimColor>{quand === '' ? pourcent(l.pourcent) : `${pourcent(l.pourcent)} · ${quand}`}</Text>
        </Box>
        <Box key={`barre-${l.kind}`}>{barreDe(l)}</Box>
      </Box>
    )
  })

  const bloc = (
    <Box key="limites" flexDirection="row" width="100%">
      <Box key="limites-espace" flexGrow={1} />
      <Box key="limites-bloc" flexDirection="column" width={largeur}>
        <Box key="limites-titre" flexDirection="row">
          <Text dimColor bold>
            LIMITES D’UTILISATION DU FORFAIT
          </Text>
          <Box key="limites-titre-espace" flexGrow={1} />
          <Button key="actualiser-limites" label="↻" plain dimColor onPress={() => void mesurer($)} />
        </Box>
        {lignes.length > 0 ? (
          lignes
        ) : (
          <Text dimColor>Aucune limite connue pour l’instant : elles arrivent avec la prochaine réponse.</Text>
        )}
      </Box>
    </Box>
  )
  return { bloc, rangs: 1 + Math.max(1, liste.length * 2) }
}

async function bandeRelais($: EngineInterface, e: Bande): Promise<RenderElement> {
  const { Button } = $.ui.resolve(e)
  const { value: en = null } = await $.state.get(etapeRelais)
  const { value: m = null } = await $.state.get(mesure)
  const occupe = en === 'redaction' || en === 'effacement'
  const conseille = typeof m?.contexte === 'number' && m.contexte >= SEUIL_CONSEIL
  return (
    <Button
      key="relais"
      label={libelle(en, conseille)}
      variant={en === 'a-confirmer' ? 'primary' : 'secondary'}
      dimColor={occupe || e.props.isWorking}
      onPress={() => {
        if (!occupe && !e.props.isWorking) {
          void cliquerRelais($)
        }
      }}
    />
  )
}

// La ligne du titre ; une fois la tâche arrêtée, un clic dessus (ou sur ✕) efface la barre.
function ligneTitre(
  $: EngineInterface,
  e: Bande,
  titre: string,
  droite: string,
  fini: boolean,
  droiteEnVert: boolean,
  effacable: boolean,
): RenderElement {
  const { Box, Button, Text } = $.ui.resolve(e)
  const gauche = (
    <Text bold color={fini ? 'success' : undefined}>
      {titre}
    </Text>
  )
  const aDroite = (
    <Text color={droiteEnVert ? 'success' : undefined} dimColor={!droiteEnVert}>
      {droite}
    </Text>
  )
  return (
    <Box key="progression-titre" flexDirection="row" gap={1}>
      {effacable ? (
        <Button key="progression-effacer-titre" plain onPress={() => void effacerProgression($)}>
          {gauche}
        </Button>
      ) : (
        gauche
      )}
      <Box key="progression-espace" flexGrow={1} />
      {effacable ? (
        <Button key="progression-effacer" plain onPress={() => void effacerProgression($)}>
          {[aDroite, <Text dimColor>{'  ✕'}</Text>]}
        </Button>
      ) : (
        aDroite
      )}
    </Box>
  )
}

// La Progression (variante 1, « barre fine et chapelet ») : titre et %, une barre fine sur toute
// la largeur, puis un point par étape (● faite, ◉ en cours, ○ restante).
// Le mode sans liste (croquis 3, « piste de temps ») : un segment par suite d'actions de même
// sorte, aussi long qu'elles ont duré ; la piste se remplit de gauche à droite, 100 % à la fin.
function bandePiste($: EngineInterface, e: Bande, p: Progression, instant: number, ouvert: boolean): RenderElement {
  const { Box, Button, Text } = $.ui.resolve(e)
  const fini = p.fin !== null
  const segments = segmentsPiste(p, p.fin ?? instant)
  const part = remplissagePiste(p, instant)
  const n = totalActions(p)
  const ecoule = duree((p.fin ?? instant) - p.debut)
  const droite = fini ? `✓ ${n} action${n > 1 ? 's' : ''} · ${ecoule}` : `⏱ ${ecoule}`
  const teinte = (s: SorteAction) => (fini ? VERT_FIN : TEINTES_SORTES[s])

  const largeur = Math.max(10, e.props.bodyColumns - 4)
  let piste: RenderElement
  if (e.surface === 'terminal') {
    const parts = repartir(
      segments.map(s => s.duree),
      fini ? largeur : Math.round(part * largeur),
    )
    const morceaux = segments.map((s, i) => (
      <Text color={teinte(s.sorte)}>{(s.enCours && !fini ? '▓' : '█').repeat(parts[i] ?? 0)}</Text>
    ))
    const vide = Math.max(0, largeur - parts.reduce((a, b) => a + b, 0))
    piste = (
      <Button key="progression-piste-bouton" plain onPress={() => void (fini ? effacerProgression($) : basculerJournal($))}>
        <Text>
          {morceaux}
          <Text color="subtle">{'░'.repeat(vide)}</Text>
        </Text>
      </Button>
    )
  } else {
    const { Svg } = $.ui.resolve(e)
    const px = Math.round(largeur * 7)
    piste = (
      <Svg
        source={pisteSvg(segments, part, px, fini)}
        alt={`${p.titre} : ${n} action${n > 1 ? 's' : ''}, ${ecoule}`}
        width={px}
        height={8}
      />
    )
  }

  // Un point par sorte d'action, avec son nombre ; puis l'action en cours, ou la fin.
  const sortes: SorteAction[] = ['bash', 'lecture', 'modif', 'autre']
  const legende: RenderElement[] = []
  for (const s of sortes) {
    const nombre = p.comptes?.[s] ?? 0
    if (nombre > 0) {
      legende.push(<Text color={teinte(s)}>{`${legende.length > 0 ? '   ' : ''}●`}</Text>)
      legende.push(<Text dimColor>{` ${NOMS_SORTES[s]} ×${nombre}`}</Text>)
    }
  }
  const courante = actionCourante(p)

  return (
    <Box key="progression" flexDirection="column" width="100%">
      {ligneTitre($, e, p.titre, droite, fini, fini, fini)}
      <Box key="progression-piste">{piste}</Box>
      <Box key="progression-legende" flexDirection="row" gap={2}>
        <Button key="progression-detail" plain onPress={() => void basculerJournal($)}>
          {[...legende, <Text dimColor>{ouvert ? ' ▴' : ' ▾'}</Text>]}
        </Button>
        <Box key="progression-legende-espace" flexGrow={1} />
        {fini ? (
          <Text color="success">Toutes les actions sont faites · 100 %</Text>
        ) : courante === undefined ? null : (
          <Text dimColor>{`En cours : ${courante}`}</Text>
        )}
      </Box>
    </Box>
  )
}

// Le journal déplié d'un clic sous la barre (croquis 1) : les dernières actions, la plus récente
// en bas ; ✓ faite, ◉ en cours (l'app de bureau dessine une image fixe : pas de roue qui tourne).
function journalDe(
  $: EngineInterface,
  e: Bande,
  p: Progression,
  instant: number,
  max: number,
): { bloc: RenderElement; rangs: number } {
  const { Box, Text } = $.ui.resolve(e)
  const { lignes, plus } = lignesJournal(p, instant, max)
  const largeur = Math.max(10, e.props.bodyColumns - 4)
  const rangees: RenderElement[] = lignes.map((l, i) => (
    <Box key={`journal-${i}`} flexDirection="row" gap={1} width="100%">
      <Box key={`journal-${i}-etat`} width={1} flexShrink={0}>
        <Text color={l.enCours ? TEINTES_SORTES[l.sorte] : 'success'}>{l.enCours ? '◉' : '✓'}</Text>
      </Box>
      <Box key={`journal-${i}-outil`} width={12} flexShrink={0}>
        <Text wrap="truncate-end">
          <Text color={TEINTES_SORTES[l.sorte]}>●</Text>
          {` ${l.nom}`}
        </Text>
      </Box>
      <Box key={`journal-${i}-quoi`} flexGrow={1} flexShrink={1}>
        <Text wrap="truncate-end" bold={l.enCours}>
          {l.libelle}
          {l.complement === '' ? '' : <Text dimColor>{`${l.libelle === '' ? '' : '  '}${l.complement}`}</Text>}
        </Text>
      </Box>
      <Box key={`journal-${i}-duree`} flexShrink={0}>
        <Text dimColor={!l.enCours}>{duree(l.duree)}</Text>
      </Box>
    </Box>
  ))
  const autres = plus > 1 ? `+ ${plus} actions plus anciennes` : '+ 1 action plus ancienne'
  return {
    bloc: (
      <Box key="progression-journal" flexDirection="column" width="100%">
        <Text dimColor wrap="truncate-end">
          {'─'.repeat(largeur)}
        </Text>
        {plus > 0 ? <Text dimColor>{autres}</Text> : null}
        {rangees.length > 0 ? rangees : <Text dimColor>Aucune action pour l’instant.</Text>}
      </Box>
    ),
    rangs: 1 + (plus > 0 ? 1 : 0) + Math.max(1, rangees.length),
  }
}

// La Progression, et son nombre de rangées : la piste ou la barre de la liste, puis le journal s'il est déplié.
// `place` : les rangées que le reste de la bande laisse ; le journal n'en prend pas plus.
async function bandeProgression(
  $: EngineInterface,
  e: Bande,
  r: Reglages,
  place: number,
): Promise<{ bloc: RenderElement; rangs: number } | undefined> {
  if (!r.progression) {
    return undefined
  }
  const { value: p = null } = await $.state.get(progression)
  // Lu pour être redessiné quand `maintenant` avance (fin de l'affichage, durée).
  await $.state.get(maintenant)
  const instant = await $.clock.now()
  if (p === null || !visible(p, instant, resteMs(r))) {
    return undefined
  }
  // Sans liste de tâches : la piste de temps des actions. Chaque mode s'affiche seulement s'il est choisi.
  if (p.etapes.length === 0 ? !r.sansListe : !r.avecListe) {
    return undefined
  }
  const { value: ouvert = false } = await $.state.get(journalOuvert)
  const corps = p.etapes.length === 0 ? bandePiste($, e, p, instant, ouvert) : bandeListe($, e, p, instant, ouvert)
  if (!ouvert) {
    return { bloc: corps, rangs: 3 }
  }
  const { Box } = $.ui.resolve(e)
  // Sous la barre (3 rangées), le trait et « + N plus anciennes » en prennent 2.
  const journal = journalDe($, e, p, instant, Math.max(1, Math.min(r.journalLignes ?? Infinity, place - 5)))
  return {
    bloc: (
      <Box key="progression-ouverte" flexDirection="column" width="100%">
        {corps}
        {journal.bloc}
      </Box>
    ),
    rangs: 3 + journal.rangs,
  }
}

// Avec liste de tâches (variante 1) : la barre fine, le chapelet et l'étape en cours.
function bandeListe($: EngineInterface, e: Bande, p: Progression, instant: number, ouvert: boolean): RenderElement {
  const { Box, Button, Text } = $.ui.resolve(e)
  const { total, courante, rang } = compter(p)
  const fini = terminee(p)
  const pc = fini ? 100 : pourcentage(p)
  const teinte = fini ? VERT : BLEU
  const reste = resteEstime(p, instant)
  const droite = fini
    ? `✓ ${total} étapes · ${duree((p.fin ?? instant) - p.debut)}`
    : reste === ''
      ? `${pc} %`
      : `${pc} % · ${reste}`
  const legende = fini
    ? 'Toutes les étapes sont faites'
    : `${p.fin !== null ? 'En pause · ' : ''}Étape ${rang} sur ${total}${courante === undefined ? '' : ` · ${courante.titre}`}`

  const largeur = Math.max(10, e.props.bodyColumns - 4)
  let barreDessinee: RenderElement
  if (e.surface === 'terminal') {
    const { plein, vide } = remplissage(pc, largeur)
    barreDessinee = (
      <Button
        key="progression-barre-bouton"
        plain
        onPress={() => void (p.fin !== null ? effacerProgression($) : basculerJournal($))}
      >
        <Text>
          <Text color={teinte}>{'━'.repeat(plein)}</Text>
          <Text color="subtle">{'━'.repeat(vide)}</Text>
        </Text>
      </Button>
    )
  } else {
    const { Svg } = $.ui.resolve(e)
    const px = Math.round(largeur * 7)
    barreDessinee = <Svg source={barre(pc, px, teinte)} alt={`${p.titre} : ${pc} %`} width={px} height={6} />
  }

  // Le chapelet : faites et en cours en couleur, restantes en gris.
  const ch = chapelet(p)
  const morceaux: RenderElement[] = []
  if (ch.faits !== '') {
    morceaux.push(<Text color={teinte}>{ch.faits}</Text>)
  }
  if (ch.courant !== '') {
    morceaux.push(
      <Text color={teinte} bold>
        {`${morceaux.length > 0 ? ' ' : ''}${ch.courant}`}
      </Text>,
    )
  }
  if (ch.restants !== '') {
    morceaux.push(<Text color="subtle">{`${morceaux.length > 0 ? ' ' : ''}${ch.restants}`}</Text>)
  }
  if (ch.reste > 0) {
    morceaux.push(<Text dimColor>{` +${ch.reste}`}</Text>)
  }

  return (
    <Box key="progression" flexDirection="column" width="100%">
      {ligneTitre($, e, p.titre, droite, fini, false, p.fin !== null)}
      <Box key="progression-barre">{barreDessinee}</Box>
      <Box key="progression-points" flexDirection="row">
        <Button key="progression-detail" plain onPress={() => void basculerJournal($)}>
          {[...morceaux, <Text>{'  '}</Text>, <Text dimColor>{legende}</Text>, <Text dimColor>{ouvert ? ' ▴' : ' ▾'}</Text>]}
        </Button>
      </Box>
    </Box>
  )
}

async function bande($: EngineInterface, e: Bande, dessous: RenderElement, modele: string): Promise<RenderElement> {
  const r = await lireReglages($)
  const { Box, Button, Text } = $.ui.resolve(e)

  // Les limites d'utilisation, ouvertes d'un clic sur les Stats, prennent la place des propositions.
  const { value: ouvert = false } = await $.state.get(limitesOuvertes)
  const limites = r.stats && ouvert ? await bandeLimites($, e) : undefined
  const suitesHaut = limites === undefined ? await bandePropositions($, e, r) : undefined
  const suite = limites?.bloc ?? suitesHaut
  const rangsSuite =
    limites !== undefined ? limites.rangs : suitesHaut === undefined ? 0 : r.disposition === 'liste' ? Math.max(1, r.nombre) : 1
  // La Progression d'une longue tâche passe tout en haut, une ligne vide la sépare de la suite.
  // Les rangées hors Progression : la ligne des boutons, le cadre, l'espace, et la suite.
  const autres = 4 + (suite === undefined ? 0 : rangsSuite + 1)
  const progres = await bandeProgression($, e, r, e.props.maxRows - autres)
  const prog = progres?.bloc
  const haut =
    prog === undefined ? suite : suite === undefined ? prog : (
      <Box key="haut-progression" flexDirection="column">
        {prog}
        <Box key="espace-progression" height={1} />
        {suite}
      </Box>
    )
  const rangsHaut = (progres?.rangs ?? 0) + (prog !== undefined && suite !== undefined ? 1 : 0) + rangsSuite
  const { value: vert = false } = await $.state.get(feuVert)

  const ligne = (
    <Box key="ligne" flexDirection="row" gap={1} alignItems="center" width="100%">
      {r.correction ? await bandeCorrection($, e, r, modele) : null}
      <Box key="espace" flexGrow={1} />
      {r.confirmation ? (
        <Text color={vert ? 'success' : 'warning'}>{vert ? '▶ Feu vert' : '⏸ Confirmation'}</Text>
      ) : null}
      {r.stats ? await bandeStats($, e) : null}
      {r.relais ? await bandeRelais($, e) : null}
      <Button key="reglages" label="⚙" dimColor onPress={() => void ouvrirPanneau($)} />
    </Box>
  )

  // Une ligne vide sépare la dernière proposition (ou la vue des limites) des boutons.
  const propositions =
    haut === undefined ? null : (
      <Box key="haut" flexDirection="column">
        {haut}
        <Box key="espace-propositions" height={1} />
      </Box>
    )

  // Le cadre arrondi prend deux lignes : sans la place, la carte reste à plat.
  const lignes = 1 + (haut === undefined ? 0 : rangsHaut + 1)
  const carte =
    e.props.maxRows >= lignes + 2 ? (
      <Box key="myconfig" flexDirection="column" width="100%" borderStyle="round" borderColor="subtle" paddingX={1}>
        {propositions}
        {ligne}
      </Box>
    ) : (
      <Box key="myconfig" flexDirection="column" width="100%">
        {propositions}
        {ligne}
      </Box>
    )

  if (dessous.type === 'engine') {
    return carte
  }
  // Un autre mod a dessiné sous MyConfig : il reste au-dessus de la carte.
  return (
    <Box flexDirection="column" width="100%">
      <Box key="dessous" flexDirection="column" width="100%">
        {dessous}
      </Box>
      {carte}
    </Box>
  )
}

// ── Le panneau (croquis 5, « Onglets ») ──────────────────────────────────────
// Un onglet par module, son état On/Off et les réglages propres au module affiché.

async function panneau($: EngineInterface, e: Panneau, modele: string): Promise<RenderElement> {
  const { Box, Button, Text } = $.ui.resolve(e)
  const r = await lireReglages($)
  const { value: choisi = 'son' } = await $.state.get(onglet)
  const actif = r[choisi]

  // Une rangée du contenu : son libellé à gauche, ses éléments à droite.
  const rangee = (cle: string, titre: string, ...enfants: RenderElement[]) => (
    <Box key={cle} flexDirection="row" gap={1} alignItems="center">
      <Box key={`${cle}-libelle`} width={16} flexShrink={0}>
        <Text dimColor>{titre}</Text>
      </Box>
      {enfants}
    </Box>
  )

  // Un bouton d'un groupe à choix unique : le choix courant est le bouton principal.
  const choix = (cle: string, texte: string, estChoisi: boolean, fn: (x: Reglages) => Reglages, hotkey?: string) => (
    <Button
      key={cle}
      label={texte}
      {...(hotkey === undefined ? {} : { hotkey })}
      variant={estChoisi ? 'primary' : undefined}
      dimColor={!estChoisi}
      onPress={() => void changer($, fn)}
    />
  )

  const onglets = (
    <Box key="onglets" flexDirection="row" flexWrap="wrap" columnGap={1}>
      {MODULES.map((m, i) => (
        <Button
          key={`onglet-${m}`}
          label={`${NOMS[m]} ${r[m] ? '●' : '○'}`}
          hotkey={String(i + 1)}
          variant={m === choisi ? 'primary' : undefined}
          dimColor={m !== choisi}
          onPress={() => void $.state.set(onglet, m)}
        />
      ))}
    </Box>
  )

  const etat = rangee(
    'etat',
    'État',
    choix('on', 'On', actif, x => ({ ...x, [choisi]: true }), 'o'),
    choix('off', 'Off', !actif, x => ({ ...x, [choisi]: false }), 'f'),
  )

  // Ce que l'onglet ajoute sous l'état On/Off.
  async function extras(m: Module): Promise<RenderElement> {
    switch (m) {
      case 'son':
        return rangee(
          'essai',
          'Essai',
          <Button key="tester" label="▶ Tester le son" onPress={() => void $.audio.play(SON).catch(() => undefined)} />,
        )
      case 'relais':
        return (
          <Box key="infos" flexDirection="column">
            <Text dimColor>Bouton « ⇄ Relais » de la bande (deux clics), ou « /relais ».</Text>
            <Text dimColor>« /relais léger », « /relais dernier », « /relais purger [n] ».</Text>
            <Text dimColor>{`Le bouton devient « ⇄ Relais ! » à partir de ${SEUIL_CONSEIL} % de contexte.`}</Text>
          </Box>
        )
      case 'correction':
        // Pas d'On/Off ici : la Correction est à Off quand aucun bouton n'est affiché.
        return (
          <Box key="infos" flexDirection="column" gap={1}>
            {rangee(
              'afficher',
              'Afficher',
              choix('afficher-ameliorer', '✎ Améliorer', r.ameliorer, x => avecBoutons(x, !x.ameliorer, x.corriger), 'a'),
              choix('afficher-corriger', '✓ Correction', r.corriger, x => avecBoutons(x, x.ameliorer, !x.corriger), 'c'),
            )}
            {rangee('modele', 'Modèle', <Text key="valeur">{modele}</Text>)}
            <Text dimColor>« ✎ Améliorer » reformule en prompt structuré ; « ✓ Correction » corrige seulement le texte.</Text>
            <Text dimColor>« Revenir » remet ton texte. Aussi : « /correction », « /correction corriger ».</Text>
          </Box>
        )
      case 'stats': {
        const { value: me = null } = await $.state.get(mesure)
        const { value: instant = null } = await $.state.get(maintenant)
        const p = me?.contexte ?? null
        const fenetre = me === null ? '—' : `${me.jetons === null ? '0' : jetons(me.jetons)} / ${jetons(me.fenetre)}`
        return (
          <Box key="infos" flexDirection="column">
            {rangee(
              'contexte',
              'Contexte',
              <Text key="valeur" bold color={p === null ? 'subtle' : couleur(p)}>
                {pourcent(p)}
              </Text>,
            )}
            {rangee('jetons', 'Jetons', <Text key="valeur">{fenetre}</Text>)}
            {rangee(
              'session',
              'Session',
              <Text key="valeur">{me !== null && instant !== null ? minutes(me.debut, instant) : '—'}</Text>,
            )}
          </Box>
        )
      }
      case 'proposition': {
        const nombres: RenderElement[] = []
        for (let n = NOMBRE_MIN; n <= NOMBRE_MAX; n++) {
          nombres.push(choix(`nombre-${n}`, String(n), r.nombre === n, x => ({ ...x, nombre: n })))
        }
        const disposition = (d: Disposition, glyphe: string) => {
          const texte = libelleDisposition(d)
          return choix(
            `disposition-${d}`,
            `${glyphe} ${texte.charAt(0).toUpperCase()}${texte.slice(1)}`,
            r.disposition === d,
            x => ({ ...x, disposition: d }),
          )
        }
        // Les propositions passent par une fourche de la conversation : le modèle de la session.
        let modeleSession = '—'
        try {
          modeleSession = await $.session.model()
        } catch {
          modeleSession = '—'
        }
        return (
          <Box key="infos" flexDirection="column" gap={1}>
            {rangee(
              'modele',
              'Modèle',
              <Text key="valeur">{modeleSession}</Text>,
              <Text key="note" dimColor>
                (celui de la session)
              </Text>,
            )}
            {rangee('nombre', 'Nombre', ...nombres)}
            {rangee('disposition', 'Disposition', disposition('ligne', '▤'), disposition('liste', '☰'))}
            {rangee(
              'maintenant',
              'Essai',
              <Button
                key="proposer"
                label="↻ Proposer maintenant"
                dimColor={!r.proposition}
                onPress={() => {
                  if (r.proposition) {
                    $.clock.after(1, () => void proposer($, r.nombre, r.disposition))
                  }
                }}
              />,
            )}
          </Box>
        )
      }
      case 'progression':
        // Pas d'On/Off ici : la Progression est à Off quand aucun mode n'est affiché.
        return (
          <Box key="infos" flexDirection="column" gap={1}>
            {rangee(
              'afficher',
              'Afficher',
              choix('afficher-avec-liste', '☰ Avec liste', r.avecListe, x => avecModes(x, !x.avecListe, x.sansListe), 'a'),
              choix('afficher-sans-liste', '▬ Sans liste', r.sansListe, x => avecModes(x, x.avecListe, !x.sansListe), 's'),
            )}
            {rangee(
              'disparait',
              'Disparaît après',
              ...DISPARITIONS.map(s =>
                choix(`disparait-${s ?? 'jamais'}`, libelleDisparition(s), r.disparaitApres === s, x => ({
                  ...x,
                  disparaitApres: s,
                })),
              ),
            )}
            {rangee(
              'detail',
              'Détail',
              ...LIGNES_JOURNAL.map(n =>
                choix(`detail-${n ?? 'illimite'}`, libelleLignes(n), r.journalLignes === n, x => ({ ...x, journalLignes: n })),
              ),
            )}
            {rangee(
              'masquer',
              'Effacer du chat',
              choix('masquer-on', 'On', r.masquerCommandes, x => ({ ...x, masquerCommandes: true })),
              choix('masquer-off', 'Off', !r.masquerCommandes, x => ({ ...x, masquerCommandes: false })),
            )}
            {rangee(
              'exemple',
              'Essai',
              <Button
                key="voir-exemple"
                label="▶ Avec liste"
                dimColor={!r.avecListe}
                onPress={() => {
                  if (r.avecListe) {
                    void montrerExemple($)
                  }
                }}
              />,
              <Button
                key="voir-exemple-sans-liste"
                label="▶ Sans liste"
                dimColor={!r.sansListe}
                onPress={() => {
                  if (r.sansListe) {
                    void montrerExempleSansListe($)
                  }
                }}
              />,
            )}
            <Box key="infos-texte" flexDirection="column">
              <Text dimColor>Avec liste : les étapes de la liste de tâches de Claude (TodoWrite, TaskCreate).</Text>
              <Text dimColor>Avec liste : ● faite · ◉ en cours · ○ restante</Text>
              <Text dimColor>
                {r.disparaitApres === null
                  ? 'Une fois la tâche finie, la barre reste jusqu’à un clic sur son titre (✕).'
                  : r.disparaitApres === 0
                    ? 'La barre disparaît dès la fin de la tâche.'
                    : `La barre disparaît ${r.disparaitApres} s après la fin ; un clic sur son titre (✕) l’efface plus tôt.`}
              </Text>
              <Text dimColor>
                {`Un clic sur la ligne sous la barre (▾) déplie ${r.journalLignes === null ? 'toutes les actions de Claude qui tiennent dans la bande' : `les ${r.journalLignes} dernières actions de Claude`}.`}
              </Text>
              <Text dimColor>Effacer du chat : les commandes Bash et leur sortie ne s’y affichent plus ; une commande en erreur reste visible.</Text>
            </Box>
          </Box>
        )
      case 'confirmation': {
        const { value: vert = false } = await $.state.get(feuVert)
        return (
          <Box key="infos" flexDirection="column">
            {rangee(
              'dernier',
              'Dernier msg',
              <Text key="valeur" color={!r.confirmation ? 'subtle' : vert ? 'success' : 'warning'}>
                {!r.confirmation ? '—' : vert ? '▶ feu vert donné' : '⏸ en attente du feu vert'}
              </Text>,
            )}
            <Text dimColor>Feu vert : « go », « vas-y », « tu peux y aller », « oui », « ok », « procède », « c’est bon ».</Text>
            <Text dimColor>Sans feu vert, Claude résume et demande ; Write, Edit et NotebookEdit sont refusés.</Text>
          </Box>
        )
      }
    }
  }

  return (
    <Box flexDirection="column" gap={1} width="100%">
      {onglets}
      <Box key="contenu" flexDirection="column" gap={1} borderStyle="round" borderColor="subtle" paddingX={1} width="100%">
        <Box key="titre" flexDirection="column">
          <Box key="nom" flexDirection="row" gap={1}>
            <Text bold>{`${ICONES[choisi]} ${NOMS[choisi]}`}</Text>
            <Text color={actif ? 'success' : 'subtle'}>{actif ? '● On' : '○ Off'}</Text>
          </Box>
          <Text dimColor>{DESCRIPTIONS[choisi]}</Text>
        </Box>
        {choisi === 'correction' || choisi === 'progression' ? null : etat}
        {await extras(choisi)}
      </Box>
      <Text dimColor>
        {`Réglages gardés d’une session à l’autre · 1 à 7 : onglets · ${choisi === 'correction' ? 'a / c : boutons affichés' : choisi === 'progression' ? 'a / s : modes affichés' : 'o / f : On / Off'}`}
      </Text>
    </Box>
  )
}

// ── Les hooks ─────────────────────────────────────────────────────────────────

export const register: Register = (on, options) => {
  const modele = typeof options.modele === 'string' ? options.modele : 'sonnet'

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'myconfig',
      description: 'Panneau des réglages MyConfig (« /myconfig etat », « /myconfig son off », « /myconfig proposition 4 »)',
      argumentHint: '[etat | <module> on | off | proposition 1-5 | ligne | liste]',
    })
    await $.command.register({
      name: 'relais',
      description: 'Récapitule la conversation dans .relais/, l’efface et prépare le message de reprise',
      argumentHint: '[léger | dernier | purger [n]]',
    })
    await $.command.register({
      name: 'correction',
      description: 'Reformule une consigne en prompt structuré (« /correction retour » pour revenir à ton texte)',
      argumentHint: '<texte> | corriger <texte> | retour',
    })
    await $.state.set(reglages, completer(await $.store.get(CLE_REGLAGES)))
    const resultat = await next(e)
    await mesurer($)
    return resultat
  })

  // Réglages : « /myconfig » ouvre le panneau, le reste change un réglage.
  on('command.run', { command: 'myconfig' }, async ($, e) => {
    const args = e.args.trim()
    if (args === '') {
      const ouvert = await ouvrirPanneau($)
      return {
        text: ouvert.isPlaced
          ? 'MyConfig : panneau ouvert.'
          : `MyConfig : le panneau n’a pas pu s’afficher.\n${resume(await lireReglages($))}`,
      }
    }
    if (/^(aide|help|\?)$/i.test(args)) {
      return { text: USAGE }
    }
    if (/^([ée]tat|statut|r[ée]sum[ée])$/i.test(args)) {
      await mesurer($)
      const { value: m = null } = await $.state.get(mesure)
      return { text: `${resume(await lireReglages($))}\n\n${detail(m, await $.clock.now())}` }
    }
    const changement = appliquer(await lireReglages($), args)
    if ('erreur' in changement) {
      return { text: changement.erreur }
    }
    await ecrireReglages($, changement.reglages)
    return { text: changement.message }
  })

  on('ui.render', { component: 'Pane', requestId: PANNEAU }, async ($, e) => panneau($, e, modele))

  // Stats : la mesure ne porte pas le début de la session, il vient de la précédente.
  on('session.measure', async ($, e, next) => {
    const avant = (await $.state.get(mesure)).value?.debut ?? (await $.session.usage()).startedAt
    await $.state.set(mesure, lire(avant, e.context, e.rateLimits))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'relais' }, async ($, e) => {
    if (!(await lireReglages($)).relais) {
      return { text: horsService('Relais') }
    }
    return { text: await commandeRelais($, e.args.trim()) }
  })

  on('command.run', { command: 'correction' }, async ($, e) => {
    if (!(await lireReglages($)).correction) {
      return { text: horsService('Correction') }
    }
    const args = e.args.trim()
    if (args === '') {
      return { text: USAGE_CORRECTION }
    }
    if (/^(retour|revenir|annuler)$/i.test(args)) {
      return { text: (await revenir($)) ?? 'Correction : ton texte est rétabli dans le champ de saisie.' }
    }
    const corriger = /^corriger(?:\s+([\s\S]*))?$/i.exec(args)
    if (corriger !== null) {
      const texte = corriger[1] ?? ''
      if (texte.trim() === '') {
        return { text: USAGE_CORRECTION }
      }
      return {
        text:
          (await ameliorer($, modele, texte, 'corriger')) ??
          'Correction : le texte corrigé est dans le champ de saisie. Relis-le, puis envoie.',
      }
    }
    return {
      text:
        (await ameliorer($, modele, args)) ??
        'Correction : le prompt reformulé est dans le champ de saisie. Relis-le, puis envoie.',
    }
  })

  // Prompt envoyé : plus de texte à rétablir, propositions périmées, et la note de la Confirmation.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'plugin') {
      await oublierRetour($)
    }
    await oublierSuites($)

    const r = await lireReglages($)
    if (!r.confirmation || !estDeLUtilisateur(e.origin)) {
      return next(e)
    }
    const vert = estFeuVert(e.text)
    await $.state.set(feuVert, vert)
    return next({ ...e, context: [...(e.context ?? []), vert ? NOTE_FEU_VERT : NOTE_ATTENTE] })
  }).catch(($, e, next) => next(e))

  // Confirmation : la règle du feu vert, dans la consigne système.
  on('prompt.compose', async ($, e, next) => {
    const resultat = await next(e)
    if (!(await lireReglages($)).confirmation) {
      return resultat
    }
    return {
      sections: [
        ...resultat.sections.filter(s => s.id !== SECTION),
        { id: SECTION, text: CONSIGNE_CONFIRMATION, scope: 'session' as const },
      ],
    }
  }).catch(($, e, next) => next(e))

  // Confirmation : sans feu vert, les outils qui écrivent des fichiers sont refusés.
  // Une panne du mod laisse passer : c'est un garde-fou de confort, pas de sécurité.
  // Progression sans liste : chaque action du fil principal ajoute son temps à la piste.
  // (Un seul hook tool.call sans matcher est permis : les deux rôles partagent celui-ci.)
  on('tool.call', async ($, e, next) => {
    if (OUTILS_BLOQUES.includes(String(e.tool)) && (await lireReglages($)).confirmation) {
      if ((await $.state.get(feuVert)).value !== true) {
        return { deny: REFUS }
      }
    }
    const outil = String(e.tool)
    if (e.agentId !== undefined || !suivre(outil)) {
      return next(e)
    }
    const id = e.tool_use_id
    const sorte = sorteDe(outil)
    const description = decrireOutil(outil, e as unknown as Record<string, unknown>)
    const debutAction = await $.clock.now()
    await changerProgression($, p => debuterAction(p, id, sorte, titreAction(description), debutAction, description))
    try {
      return await next(e)
    } finally {
      const finAction = await $.clock.now()
      await changerProgression($, p => finirAction(p, id, finAction))
    }
  }).catch(($, e, next) => next(e))

  // Son : le début de la tâche.
  on('turn.start', async ($, e, next) => {
    const instant = await $.clock.now()
    if (e.text.trim() !== '' || debut === null) {
      debut = instant
    }
    // Progression : la tâche continue si sa liste n'est pas finie, sinon une nouvelle commence.
    const { value: avant = null } = await $.state.get(progression)
    await $.state.set(progression, demarrer(avant, e.text, instant))
    demarrerChrono($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Progression : la liste de tâches de Claude (le fil principal seulement, pas les sous-agents).
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const entree = e as unknown as Record<string, unknown>
    if (e.agentId === undefined && Array.isArray(entree.todos)) {
      const instant = await $.clock.now()
      await changerProgression($, p => appliquerTodos(p, entree.todos as Todo[], instant))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const entree = e as unknown as Record<string, unknown>
    if (e.agentId === undefined && typeof entree.taskId === 'string') {
      const id = entree.taskId
      const champs = {
        ...(typeof entree.status === 'string' ? { statut: entree.status } : {}),
        ...(typeof entree.subject === 'string' ? { titre: entree.subject } : {}),
      }
      const instant = await $.clock.now()
      await changerProgression($, p => majEtape(p, id, champs, instant))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // TaskCreate : l'identifiant de l'étape n'est connu qu'une fois l'outil passé.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const resultat = await next(e)
    if (e.agentId === undefined && !('deny' in resultat)) {
      const entree = e as unknown as Record<string, unknown>
      const tache = (resultat.result as { task?: { id?: string; subject?: string } } | undefined)?.task
      if (typeof tache?.id === 'string') {
        const id = tache.id
        const titre = tache.subject ?? (typeof entree.subject === 'string' ? entree.subject : 'Étape')
        await changerProgression($, p => ajouterEtape(p, id, titre))
      }
    }
    return resultat
  }).catch(($, e, next) => next(e))

  // Son et Proposition : la fin de la tâche.
  on('turn.complete', async ($, e, next) => {
    const resultat = await next(e)
    const r = await lireReglages($)
    const sousAgent = e.agentId !== undefined
    if (doitSonner(debut, await $.clock.now(), e.reason, sousAgent)) {
      debut = null
      if (r.son) {
        await $.audio.play(SON).catch(() => undefined)
      }
    }
    // Progression : la tâche s'arrête (finie ou en pause) ; une interruption la retire aussitôt.
    if (!sousAgent) {
      arreterChrono()
      const fin = await $.clock.now()
      if (e.reason === 'aborted' || e.reason === 'error') {
        // Une interruption la retire aussitôt ; une liste inachevée reprend au tour suivant.
        await changerProgression($, p => ({ ...p, fin, effacee: true }))
      } else {
        await changerProgression($, p => ({ ...p, fin }))
        if (r.disparaitApres !== null && r.disparaitApres > 0) {
          redessinerApres($, r.disparaitApres * 1000 + 500)
        }
      }
    }
    if (r.proposition && !sousAgent && e.reason === 'answer') {
      // Une minuterie survit à la fin du hook ; une promesse laissée seule, non.
      $.clock.after(1, () => void proposer($, r.nombre, r.disposition))
    }
    return resultat
  }).catch(($, e, next) => next(e))

  // Progression, « Effacer du chat » : les commandes Bash (la ligne et sa sortie) ne s'affichent plus,
  // le journal de la barre les montre ; une commande en erreur ou interrompue reste visible.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || e.props.isErrored || e.props.isInterrupted || !(await commandesMasquees($))) {
      return next(e)
    }
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || e.props.isErrored || !(await commandesMasquees($))) {
      return next(e)
    }
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const dessous = await next(e)
    if (e.props.hasSurvey) {
      return dessous
    }
    return bande($, e, dessous, modele)
  })
}

// Fonctions pures du module Relais : validation, troncature, extraction, purge, noms. Aucun accès à $.

import type { EtapeRelais } from '../types'

export const SECTIONS = [
  'Objectifs',
  'Contraintes',
  'État actuel',
  'Décisions',
  'Prochaines étapes',
  'Références utiles',
] as const

// Le modèle entoure parfois sa réponse d'un bloc de code.
export function nettoyer(texte: string) {
  const t = texte.trim()
  const bloc = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/.exec(t)
  return (bloc?.[1] ?? t).trim()
}

export function sectionsManquantes(recap: string) {
  return SECTIONS.filter(nom => !new RegExp(`^##\\s+${nom}\\s*$`, 'mi').test(recap))
}

// Renvoie ce qui ne va pas, ou undefined si le récapitulatif est utilisable.
export function problemeRecap(recap: string): string | undefined {
  if (recap.trim() === '') {
    return 'le récapitulatif est vide'
  }
  if (!/^#\s+Relais\b/m.test(recap)) {
    return 'le titre « # Relais — … » est absent'
  }
  const manquantes = sectionsManquantes(recap)
  if (manquantes.length > 0) {
    return `sections absentes : ${manquantes.join(', ')}`
  }
  return undefined
}

export function compterMots(texte: string) {
  const mots = texte.trim().match(/\S+/g)
  return mots === null ? 0 : mots.length
}

// Garde le début (les objectifs de départ) et la fin (l'état récent), coupe le milieu.
export function tronquer(texte: string, max: number): { texte: string; tronque: boolean } {
  if (texte.length <= max) {
    return { texte, tronque: false }
  }
  const debut = Math.floor(max * 0.2)
  const fin = max - debut
  const omis = texte.length - max
  return {
    texte: `${texte.slice(0, debut)}\n\n[… ${omis} caractères omis au milieu de la conversation …]\n\n${texte.slice(texte.length - fin)}`,
    tronque: true,
  }
}

// Le contenu d'une section « ## nom », sans son titre, coupé à `max` caractères.
export function extraireSection(recap: string, nom: string, max = 1500): string | undefined {
  const lignes = recap.split('\n')
  const debut = lignes.findIndex(l => new RegExp(`^##\\s+${nom}\\s*$`, 'i').test(l))
  if (debut < 0) {
    return undefined
  }
  let fin = lignes.findIndex((l, i) => i > debut && /^#{1,2}\s/.test(l))
  if (fin < 0) {
    fin = lignes.length
  }
  const corps = lignes.slice(debut + 1, fin).join('\n').trim()
  if (corps === '') {
    return undefined
  }
  return corps.length > max ? `${corps.slice(0, max).trimEnd()} […]` : corps
}

// `git status --short --branch` mis en forme pour le fichier. Rien si ce n'est pas un dépôt.
export function sectionDepot(statut: string, maxLignes = 60): string | undefined {
  const lignes = statut.split('\n').filter(l => l.trim() !== '')
  if (lignes.length === 0) {
    return undefined
  }
  const premiere = lignes[0] ?? ''
  const branche = premiere.startsWith('## ') ? premiere.slice(3) : undefined
  const fichiers = branche === undefined ? lignes : lignes.slice(1)
  const montres = fichiers.slice(0, maxLignes)
  const reste = fichiers.length - montres.length
  const corps =
    fichiers.length === 0
      ? 'Aucune modification en cours.'
      : '```\n' + montres.join('\n') + (reste > 0 ? `\n… et ${reste} autre(s) ligne(s)` : '') + '\n```'
  return `## État du dépôt (relevé automatique)\n\n${branche === undefined ? '' : `Branche : ${branche}\n\n`}${corps}`
}

const FICHIER_RELAIS = /^\d{4}-\d{2}-\d{2}-\d{2}h\d{2}(-\d+)?\.md$/

// Les récapitulatifs au-delà des `garder` plus récents (par date de modification).
export function aPurger(entrees: { name: string; kind: string; mtimeMs: number }[], garder: number): string[] {
  return entrees
    .filter(e => e.kind === 'file' && FICHIER_RELAIS.test(e.name))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(Math.max(garder, 1))
    .map(e => e.name)
}

const deux = (n: number) => String(n).padStart(2, '0')

export function nomDeFichier(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}-${deux(d.getHours())}h${deux(d.getMinutes())}`
}

// Le chemin tel qu'on le cite : relatif depuis la racine du projet, absolu ailleurs.
export function citer(racine: string, cwd: string, relatif: string) {
  return cwd === racine ? relatif : `${racine}/${relatif}`
}

// Au-delà de ce pourcentage de contexte, le bouton conseille le relais.
export const SEUIL_CONSEIL = 80

export const USAGE =
  'Relais : « /relais » écrit le récapitulatif dans .relais/, efface la conversation et met le message de reprise dans le champ ; « /relais léger » met dans le message l’état actuel et les prochaines étapes plutôt que tout le fichier ; « /relais dernier » donne le chemin du dernier récapitulatif ; « /relais purger [n] » supprime les anciens récapitulatifs en gardant les n plus récents (20 par défaut).'

export function libelle(en: EtapeRelais, conseille: boolean) {
  switch (en) {
    case 'a-confirmer':
      return 'Confirmer ?'
    case 'redaction':
      return 'Rédaction…'
    case 'effacement':
      return 'Effacement…'
    default:
      return conseille ? '⇄ Relais !' : '⇄ Relais'
  }
}

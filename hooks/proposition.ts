// Fonctions pures du module Proposition : la consigne envoyée au modèle et la lecture de sa réponse.

import type { Disposition } from '../types'
import { borner } from './reglages'

// Côte à côte, les suites doivent être plus courtes pour tenir sur la ligne. En liste, chacune
// peut prendre une ligne entière de la bande : `place` lettres (0 tant que la largeur est inconnue).
export const longueurMax = (disposition: Disposition, place = 0) =>
  disposition === 'ligne' ? 45 : place > 0 ? Math.max(30, place) : 70

export function consigne(nombre: number, disposition: Disposition, place = 0) {
  const n = borner(nombre)
  const quoi = n === 1 ? 'exactement 1 suite logique' : `exactement ${n} suites logiques`
  const variete =
    n === 1
      ? '- la plus utile maintenant : l’étape suivante évidente.'
      : '- variées : approfondir, vérifier, corriger ou étendre, passer à l’étape suivante.'
  return `Propose ${quoi} à la conversation, rédigées comme des consignes que l'utilisateur pourrait m'envoyer maintenant.
Règles :
- en français, à l'impératif, une phrase chacune (${longueurMax(disposition, place)} caractères au plus) ;
- concrètes et propres à ce qui vient d'être fait, pas de formules génériques ;
${variete}
Réponds uniquement par un tableau JSON de ${n} chaîne(s), sans aucun autre texte.`
}

// Le modèle répond parfois en liste ou dans un bloc de code plutôt qu'en JSON pur.
export function extraire(texte: string, nombre: number): string[] {
  const n = borner(nombre)
  const t = texte.trim()
  const tableau = /\[[\s\S]*\]/.exec(t)
  if (tableau) {
    try {
      const valeur: unknown = JSON.parse(tableau[0])
      if (Array.isArray(valeur)) {
        return valeur
          .filter((v): v is string => typeof v === 'string')
          .map(v => v.trim())
          .filter(v => v !== '')
          .slice(0, n)
      }
    } catch {
      // On retombe sur la lecture ligne par ligne.
    }
  }
  return t
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["«]\s*|\s*["»],?$/g, '').trim())
    .filter(l => l !== '' && !l.startsWith('```') && l !== '[' && l !== ']')
    .slice(0, n)
}

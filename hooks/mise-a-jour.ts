// Fonctions pures de la mise à jour depuis GitHub (onglet Général, Croquis 4) : la version du
// mod, ce que la rangée « Version » en dit, et le message de fin.

import type { EtatGithub, MiseAJour } from '../types'

/** Pas plus d'une vérification de GitHub par tranche de 5 minutes, sauf erreur. */
export const VERIFICATION_MS = 5 * 60_000

/** La version d'un `plugin.json`, ou rien s'il ne se lit pas. */
export function lireVersion(json: string): string | null {
  try {
    const v = (JSON.parse(json) as { version?: unknown }).version
    return typeof v === 'string' && v !== '' ? v : null
  } catch {
    return null
  }
}

export const premiereLigne = (t: string) =>
  t
    .split('\n')
    .map(l => l.trim())
    .find(l => l !== '') ?? ''

/** Ce que la rangée « Version » dit à droite du numéro, et si une mise à jour attend. */
export function statutVersion(
  g: EtatGithub | null,
  enCours: MiseAJour,
): { texte: string; couleur: 'warning' | 'success' | 'subtle'; disponible: boolean } {
  if (enCours !== null) {
    const textes: Record<NonNullable<MiseAJour>, string> = {
      verification: 'vérification…',
      'mise-a-jour': 'mise à jour…',
      rechargement: 'rechargement…',
    }
    return { texte: textes[enCours], couleur: 'subtle', disponible: false }
  }
  if (g === null) {
    return { texte: '', couleur: 'subtle', disponible: false }
  }
  if (g.erreur !== null) {
    return { texte: g.erreur, couleur: 'subtle', disponible: false }
  }
  if (g.retard > 0) {
    const texte =
      g.distante !== null && g.distante !== g.locale
        ? `→ ${g.distante} disponible`
        : `→ ${g.retard} changement${g.retard > 1 ? 's' : ''} sur GitHub`
    return { texte, couleur: 'warning', disponible: true }
  }
  return { texte: 'à jour', couleur: 'success', disponible: false }
}

/** Le message après un `git pull` réussi. */
export function messageMiseAJour(avant: string | null, apres: string | null, change: boolean) {
  if (!change) {
    return `MyConfig : déjà à jour (${avant ?? 'version inconnue'}).`
  }
  return avant !== null && apres !== null && avant !== apres
    ? `MyConfig : ${avant} → ${apres}, rechargement des mods…`
    : 'MyConfig : mis à jour depuis GitHub, rechargement des mods…'
}

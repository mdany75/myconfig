// Fonctions pures du module Stats : contexte, jetons et durée ; d'un clic, les limites d'utilisation du forfait.

import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Limite, Mesure } from '../types'

export function lire(debut: number, context: SessionContextUsage, limites: SessionRateLimit[]): Mesure {
  return {
    debut,
    jetons: context.tokens ?? null,
    fenetre: context.window,
    contexte: context.percent ?? null,
    limites: limites.map(l => ({ kind: l.kind, pourcent: l.percentUsed, reinit: l.resetsAt ?? null })),
  }
}

// ── Les limites d'utilisation du forfait (la vue ouverte d'un clic sur les Stats) ──

const capitale = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

// Le nom d'une fenêtre : 5 heures, hebdomadaire, ou hebdomadaire d'un modèle (« seven_day_fable »).
export function nomLimite(kind: string) {
  if (kind === 'five_hour') {
    return 'Limite de 5 heures'
  }
  if (kind === 'seven_day') {
    return 'Hebdomadaire · tous les modèles'
  }
  if (kind === 'spend_limit') {
    return 'Limite de dépenses'
  }
  const modele = /^seven_day_(.+)$/.exec(kind)
  if (modele?.[1] !== undefined) {
    return `Hebdomadaire · ${capitale(modele[1].replace(/_/g, ' '))}`
  }
  return capitale(kind.replace(/_/g, ' '))
}

// L'ordre de la vue : 5 heures, hebdomadaire, hebdomadaires par modèle, le reste.
export function trierLimites(limites: readonly Limite[]): Limite[] {
  const rang = (k: string) => (k === 'five_hour' ? 0 : k === 'seven_day' ? 1 : k.startsWith('seven_day_') ? 2 : 3)
  return [...limites].sort((a, b) => rang(a.kind) - rang(b.kind))
}

// « réinit. dans 45 min », « dans 2h », « dans 4j » ; rien quand la date manque.
export function delai(reinit: string | null, instant: number) {
  if (reinit === null) {
    return ''
  }
  const quand = Date.parse(reinit)
  if (Number.isNaN(quand)) {
    return ''
  }
  const minutesRestantes = (quand - instant) / 60_000
  if (minutesRestantes <= 0) {
    return 'réinit. imminente'
  }
  if (minutesRestantes < 60) {
    return `réinit. dans ${Math.ceil(minutesRestantes)} min`
  }
  const heures = minutesRestantes / 60
  if (heures < 24) {
    return `réinit. dans ${Math.round(heures)}h`
  }
  return `réinit. dans ${Math.round(heures / 24)}j`
}

// La barre du terminal : `largeur` cellules, dont la part remplie.
export function remplissage(p: number, largeur: number) {
  const plein = Math.round((Math.min(100, Math.max(0, p)) / 100) * largeur)
  return { plein, vide: largeur - plein }
}

export const BLEU = '#3b82f6'

// La barre de l'app de bureau : un rail gris arrondi, la part utilisée en bleu.
export function barre(p: number, largeur: number) {
  const h = 6
  const part = Math.min(100, Math.max(0, p)) / 100
  const plein = part === 0 ? 0 : Math.max(h, Math.round(largeur * part))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${h}" viewBox="0 0 ${largeur} ${h}">` +
    `<rect width="${largeur}" height="${h}" rx="${h / 2}" fill="#8b949e" fill-opacity="0.25"/>` +
    (plein > 0 ? `<rect width="${plein}" height="${h}" rx="${h / 2}" fill="${BLEU}"/>` : '') +
    `</svg>`
  )
}

// Minutes écoulées depuis le début de la session.
export function minutes(debut: number, instant: number) {
  return `${Math.max(0, Math.floor((instant - debut) / 60_000))} min`
}

// Vert sous 60 %, jaune de 60 à 79 %, rouge à 80 % et plus.
export function couleur(pourcent: number) {
  if (pourcent >= 80) {
    return 'error'
  }
  if (pourcent >= 60) {
    return 'warning'
  }
  return 'success'
}

export function jetons(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  return `${Math.round(n / 1000)}k`
}

export function pourcent(p: number | null) {
  return p === null ? '—' : `${Math.round(p)} %`
}

// L'anneau du terminal : un quart de disque par tranche de 25 %.
export function glyphe(p: number | null) {
  if (p === null || p < 12.5) {
    return '○'
  }
  if (p < 37.5) {
    return '◔'
  }
  if (p < 62.5) {
    return '◑'
  }
  if (p < 87.5) {
    return '◕'
  }
  return '●'
}

const TEINTES = { success: '#2ea043', warning: '#d29922', error: '#e5534b' } as const

// L'anneau de l'app de bureau : un cercle gris, et l'arc rempli à la couleur du seuil.
export function anneau(p: number | null) {
  const r = 7
  const tour = 2 * Math.PI * r
  const part = p === null ? 0 : Math.min(100, Math.max(0, p)) / 100
  const teinte = p === null ? '#8b949e' : TEINTES[couleur(p)]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">` +
    `<circle cx="9" cy="9" r="${r}" fill="none" stroke="#8b949e" stroke-opacity="0.35" stroke-width="3"/>` +
    `<circle cx="9" cy="9" r="${r}" fill="none" stroke="${teinte}" stroke-width="3" stroke-linecap="round" ` +
    `stroke-dasharray="${(tour * part).toFixed(2)} ${tour.toFixed(2)}" transform="rotate(-90 9 9)"/>` +
    `</svg>`
  )
}

// Le détail que « /myconfig etat » et l'onglet Stats montrent.
export function detail(m: Mesure | null, instant: number) {
  if (m === null) {
    return 'Stats : aucune mesure pour le moment ; elle arrive avec la première réponse.'
  }
  const contexte =
    m.jetons === null
      ? `— / ${m.fenetre.toLocaleString('fr-CA')} jetons`
      : `${m.jetons.toLocaleString('fr-CA')} / ${m.fenetre.toLocaleString('fr-CA')} jetons (${pourcent(m.contexte)})`
  return [`Session  : ${minutes(m.debut, instant)}`, `Contexte : ${contexte}`].join('\n')
}

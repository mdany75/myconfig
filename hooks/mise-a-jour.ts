// Fonctions pures de la mise à jour depuis GitHub (onglet Général, Croquis 4) : la version du
// mod, ce que la rangée « Version » en dit, et le message de fin. Une copie installée depuis le
// marketplace GitHub n'est pas un clone : elle passe par `claude plugin` (Croquis 1).

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
      marketplace: 'marketplace…',
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

// ── Copie du marketplace ─────────────────────────────────────────────────────

/**
 * Une copie installée depuis un marketplace (`/plugin install myconfig --marketplace
 * mdany75/myconfig`) : le moteur la range dans `<plugins>/cache/<marketplace>/<plugin>/<version>`.
 */
export type CopieMarketplace = {
  /** Le dossier des mods du moteur (`~/.claude/plugins`). */
  plugins: string
  marketplace: string
  plugin: string
}

/** La copie du marketplace que désigne la racine du mod, ou rien pour un clone ou un autre dossier. */
export function copieMarketplace(racine: string): CopieMarketplace | null {
  const [, plugins, marketplace, plugin] =
    /^(.*[\\/]plugins)[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/][^\\/]+[\\/]?$/.exec(racine) ?? []
  return plugins === undefined || marketplace === undefined || plugin === undefined
    ? null
    : { plugins, marketplace, plugin }
}

/**
 * Le clone du marketplace : son `installLocation` dans `known_marketplaces.json`, sinon la place
 * que le moteur lui donne, `<plugins>/marketplaces/<marketplace>`.
 */
export function dossierMarketplace(connus: string | null, c: CopieMarketplace): string {
  try {
    const lieu = (JSON.parse(connus ?? '') as Record<string, { installLocation?: unknown } | undefined>)[c.marketplace]
      ?.installLocation
    if (typeof lieu === 'string' && lieu !== '') {
      return lieu
    }
  } catch {
    // Illisible : la place par défaut.
  }
  return `${c.plugins}/marketplaces/${c.marketplace}`
}

/**
 * Où le mod vit dans son marketplace, d'après la `source` de son entrée dans `marketplace.json` :
 * `''` à la racine (`./`), `dossier/` plus bas ; rien quand il vient d'ailleurs.
 */
export function cheminDansMarketplace(catalogue: string, plugin: string): string | null {
  try {
    const entree = (JSON.parse(catalogue) as { plugins?: { name?: unknown; source?: unknown }[] }).plugins?.find(
      p => p.name === plugin,
    )
    const source = entree?.source
    if (typeof source !== 'string' || !source.startsWith('./') || source.includes('..')) {
      return null
    }
    const chemin = source.slice(2).replace(/\/+$/, '')
    return chemin === '' ? '' : `${chemin}/`
  } catch {
    return null
  }
}

/** 1 quand GitHub porte une autre version que la copie : `claude plugin update` la remplacera. */
export const retardMarketplace = (locale: string | null, distante: string | null) =>
  locale !== null && distante !== null && locale !== distante ? 1 : 0

/** Les deux commandes de la mise à jour, sans l'exécutable : relire le marketplace, puis le mod. */
export const commandesMarketplace = (c: CopieMarketplace) =>
  [
    ['plugin', 'marketplace', 'update', c.marketplace, '--json'],
    ['plugin', 'update', `${c.plugin}@${c.marketplace}`, '--json'],
  ] as const

/** Ce qu'une commande `claude plugin … --json` a répondu. */
export type ResultatClaude = {
  ok: boolean
  /** Son message (la première ligne), ou l'erreur. */
  message: string
  avant: string | null
  apres: string | null
  /** Vrai quand le mod a changé ; sans réponse lisible, on le suppose, pour recharger. */
  change: boolean
}

/** Lit la dernière ligne JSON de `--json` ; une sortie sans JSON ne compte que par son code. */
export function lireResultat(r: { exitCode: number; stdout: string; stderr: string }): ResultatClaude {
  const ligne = r.stdout
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('{'))
    .pop()
  let json: Record<string, unknown> | null = null
  try {
    json = ligne === undefined ? null : (JSON.parse(ligne) as Record<string, unknown>)
  } catch {
    json = null
  }
  const texte = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)
  return {
    ok: r.exitCode === 0 && (json === null || json.outcome === undefined || json.outcome === 'ok'),
    message: premiereLigne(texte(json?.message) ?? '') || premiereLigne(r.stderr) || `code ${r.exitCode}`,
    avant: texte(json?.oldVersion),
    apres: texte(json?.newVersion),
    change: json === null || json.updateOutcome === undefined ? true : json.updateOutcome === 'updated',
  }
}

/** Le message quand la mise à jour par le marketplace échoue : la raison, et la voie à la main. */
export const echecMarketplace = (c: CopieMarketplace, raison: string) =>
  `MyConfig : la mise à jour a échoué (${raison}). Dans un terminal : claude plugin marketplace update ` +
  `${c.marketplace}, puis claude plugin update ${c.plugin}@${c.marketplace}.`

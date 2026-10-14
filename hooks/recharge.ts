// Fonctions pures de la recharge automatique : au début d'un message, les mods sont rechargés
// (« /reload-plugins ») quand un fichier du dossier des mods a changé depuis leur chargement.

/** Le marqueur du dernier chargement des mods, un par session : un fichier plus récent a changé depuis. */
export function cheminMarqueur(sessionId: string) {
  return `/tmp/claude-myconfig/mods-${sessionId.replace(/[^\w-]/g, '_')}`
}

/** Le dossier des mods : celui qui contient le dossier de MyConfig (`~/Developer/Plugins`). */
export function dossierMods(racine: string) {
  const sans = racine.replace(/\/+$/, '')
  return sans.slice(0, Math.max(1, sans.lastIndexOf('/')))
}

// Ce qui change sans changer un mod : git, les récapitulatifs du Relais, les types que le moteur
// écrit à chaque chargement, les dépendances, les fichiers du Finder.
const IGNORES = ['.git', '.relais', 'node_modules', 'types']

/** La commande `find` qui nomme le premier fichier d'un mod plus récent que le marqueur, ou rien. */
export function chercherChangement(dossier: string, marqueur: string): string[] {
  const elagues = IGNORES.flatMap((nom, i) => (i === 0 ? ['-name', nom] : ['-o', '-name', nom]))
  return ['find', dossier, '(', ...elagues, ')', '-prune', '-o', '-type', 'f', '-newer', marqueur, '!', '-name', '.DS_Store', '-print', '-quit']
}

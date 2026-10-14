/** Une tâche plus courte que ça (en ms) ne fait pas de bruit. */
export const SEUIL_MS = 10_000

/** Vrai quand une tâche terminée mérite le signal sonore. */
export function doitSonner(debut: number | null, fin: number, raison: string, sousAgent: boolean): boolean {
  if (sousAgent || debut === null || raison === 'aborted' || raison === 'error') {
    return false
  }
  return fin - debut >= SEUIL_MS
}

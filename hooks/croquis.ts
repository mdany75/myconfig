// Fonctions pures de la fonction Croquis (l'œil de la bande) : la règle que le modèle lit.

export const SECTION = 'myconfig:croquis'

/** Le nombre de croquis montrés avant une nouvelle interface. */
export const NOMBRE_CROQUIS = 5

export const CONSIGNE = `MyConfig — mode Croquis activé par l'utilisateur.
Avant de construire une nouvelle interface ou de changer l'apparence d'une interface existante (écran, page, fenêtre, panneau, bande, bouton, composant, mise en page), montre d'abord ${NOMBRE_CROQUIS} croquis visuels différents, interactifs si possible (widget visuel), puis demande à l'utilisateur lequel il choisit et arrête-toi là.
L'utilisateur n'a pas besoin de le demander : c'est la règle tant que ce mode est actif.
Les ${NOMBRE_CROQUIS} croquis sont de vraies variantes (disposition, présentation, emplacement), chacun avec un numéro et un nom court.
Construis ensuite seulement le croquis choisi, sans y ajouter d'éléments d'un autre croquis.
Une correction de bogue, un texte ou un changement sans effet visible ne demande pas de croquis.`

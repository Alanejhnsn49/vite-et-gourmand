/**
 * Composant metier : cycle de vie d'une commande.
 *
 * Les statuts et leurs enchainements autorises sont declares ici, en un seul
 * endroit. Sans machine a etats explicite, rien n'empeche de faire passer une
 * commande de "livree" a "en preparation", ou de la relancer apres annulation.
 */

// Libelles lisibles, utilises dans l'interface et dans les emails.
const STATUTS = {
    attente:    { libelle: "En attente de validation", ordre: 1 },
    accepte:    { libelle: "Acceptée",                 ordre: 2 },
    prep:       { libelle: "En préparation",           ordre: 3 },
    livraison:  { libelle: "En cours de livraison",    ordre: 4 },
    livre:      { libelle: "Livrée",                   ordre: 5 },
    retour:     { libelle: "En attente de retour du matériel", ordre: 6 },
    terminee:   { libelle: "Terminée",                 ordre: 7 },
    annulee:    { libelle: "Annulée",                  ordre: 0 },
};

/**
 * Transitions autorisees depuis chaque statut.
 *
 * Le cahier des charges decrit une progression lineaire, avec deux sorties
 * possibles apres livraison : soit la commande est terminee directement,
 * soit du materiel a ete prete et il faut attendre sa restitution.
 *
 * L'annulation reste possible tant que la prestation n'a pas commence.
 * "terminee" et "annulee" sont des etats finaux.
 */
const TRANSITIONS = {
    attente:   ['accepte', 'annulee'],
    accepte:   ['prep', 'annulee'],
    prep:      ['livraison', 'annulee'],
    livraison: ['livre'],
    livre:     ['retour', 'terminee'],
    retour:    ['terminee'],
    terminee:  [],
    annulee:   [],
};

// Tant qu'une commande n'a pas ete acceptee, le client garde la main dessus.
// Cahier des charges : "l'annulation de commande est possible, tant qu'un
// employe n'a pas passe la commande en accepte, la modification est
// egalement possible".
const STATUTS_MODIFIABLES_PAR_CLIENT = ['attente'];

// Le retour du materiel declenche une penalite passe un delai contractuel.
const DELAI_RETOUR_MATERIEL_JOURS = 10;
const PENALITE_MATERIEL_EUROS = 600;

function estStatutConnu(statut) {
    return Object.prototype.hasOwnProperty.call(STATUTS, statut);
}

function libelle(statut) {
    return estStatutConnu(statut) ? STATUTS[statut].libelle : statut;
}

/**
 * Indique si le passage d'un statut a un autre est autorise.
 */
function transitionAutorisee(depuis, vers) {
    if (!estStatutConnu(depuis) || !estStatutConnu(vers)) return false;
    return TRANSITIONS[depuis].includes(vers);
}

/**
 * Liste les statuts atteignables depuis l'etat courant.
 * Sert a n'afficher a l'employe que les actions realisables.
 */
function transitionsPossibles(depuis) {
    if (!estStatutConnu(depuis)) return [];
    return TRANSITIONS[depuis].map(s => ({ statut: s, libelle: STATUTS[s].libelle }));
}

/**
 * Le client peut-il encore modifier ou annuler lui-meme sa commande ?
 */
function modifiableParClient(statut) {
    return STATUTS_MODIFIABLES_PAR_CLIENT.includes(statut);
}

module.exports = {
    STATUTS,
    TRANSITIONS,
    DELAI_RETOUR_MATERIEL_JOURS,
    PENALITE_MATERIEL_EUROS,
    estStatutConnu,
    libelle,
    transitionAutorisee,
    transitionsPossibles,
    modifiableParClient,
};

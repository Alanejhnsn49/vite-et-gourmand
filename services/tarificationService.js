/**
 * Composant metier : calcul du tarif d'une commande.
 *
 * Les regles sont isolees ici plutot que dans le controleur, pour trois
 * raisons : elles sont testables independamment du transport HTTP, elles
 * sont reutilisables par la simulation de prix comme par la creation reelle
 * de commande, et une evolution tarifaire se fait dans un seul fichier.
 *
 * Toutes les regles ci-dessous sont issues du cahier des charges.
 */

// Frais fixes de livraison hors de la ville de Bordeaux.
const FRAIS_LIVRAISON_FIXE = 5.00;

// Majoration par kilometre parcouru, en plus des frais fixes.
const FRAIS_LIVRAISON_PAR_KM = 0.59;

// Ville de rattachement de l'entreprise : aucune livraison facturee sur place.
const VILLE_SANS_FRAIS = 'bordeaux';

// Nombre de convives supplementaires a partir duquel la remise s'applique.
const SEUIL_CONVIVES_REMISE = 5;

// Taux de la remise commerciale accordee par Julie.
const TAUX_REMISE = 0.10;

/**
 * Arrondi monetaire au centime.
 * Les calculs en virgule flottante produisent des valeurs du type 290.00000000004 :
 * on arrondit systematiquement avant de renvoyer ou de stocker un montant.
 */
function arrondir(montant) {
    return Math.round(montant * 100) / 100;
}

/**
 * Calcule le detail tarifaire d'une commande.
 *
 * @param {object} menu           Ligne de la table menus (prix_min, min_personnes)
 * @param {number} nombreConvives Nombre de convives demande
 * @param {string} villeLivraison Ville de la prestation
 * @param {number} distanceKm     Distance en kilometres, utilisee hors Bordeaux
 * @returns {object} detail complet du calcul
 * @throws {Error} si le nombre de convives est inferieur au minimum du menu
 */
function calculerTarif(menu, nombreConvives, villeLivraison, distanceKm = 0) {
    const minPersonnes = Number(menu.min_personnes);
    const prixMin = Number(menu.prix_min);
    const convives = Number(nombreConvives);

    // Regle du cahier des charges : "il y a l'obligation de commander pour le
    // nombre minimum de personnes inscrit dans le menu".
    if (!Number.isInteger(convives) || convives < minPersonnes) {
        const erreur = new Error(
            `Ce menu impose un minimum de ${minPersonnes} convives.`
        );
        erreur.code = 'CONVIVES_INSUFFISANTS';
        erreur.minimum = minPersonnes;
        throw erreur;
    }

    // Le prix affiche du menu correspond au nombre minimum de personnes.
    // Les convives supplementaires sont factures au prorata de ce forfait,
    // ce qui garantit un prix par personne constant et coherent avec le
    // tarif annonce. Le cahier des charges ne fixe pas de tarif unitaire
    // distinct : la proportionnalite est le choix le plus defendable.
    const prixParPersonne = prixMin / minPersonnes;
    const convivesSupplementaires = convives - minPersonnes;
    const prixMenuBrut = prixMin + (convivesSupplementaires * prixParPersonne);

    // Regle de Julie : "une reduction de 10% est appliquee pour toutes
    // commandes ayant 5 personnes de plus que le nombre de personnes minimum
    // indique dans le menu".
    const remiseApplicable = convivesSupplementaires >= SEUIL_CONVIVES_REMISE;
    const montantRemise = remiseApplicable ? prixMenuBrut * TAUX_REMISE : 0;
    const prixMenuNet = prixMenuBrut - montantRemise;

    // Regle de Jose : "facturation de 5 euros (majore de 59 centimes par
    // kilometre parcouru) si la livraison n'est pas dans la ville de Bordeaux".
    // La remise porte sur la prestation, pas sur la livraison.
    const horsBordeaux =
        typeof villeLivraison === 'string' &&
        villeLivraison.trim().toLowerCase() !== VILLE_SANS_FRAIS;

    const km = Math.max(0, Number(distanceKm) || 0);
    const fraisLivraison = horsBordeaux
        ? FRAIS_LIVRAISON_FIXE + (km * FRAIS_LIVRAISON_PAR_KM)
        : 0;

    const totalTtc = prixMenuNet + fraisLivraison;

    // Detail renvoye tel quel au front, qui doit afficher "une vue detaillee
    // du prix visible avant validation (prix menu ainsi que le prix de la
    // livraison)".
    return {
        min_personnes: minPersonnes,
        nombre_convives: convives,
        convives_supplementaires: convivesSupplementaires,
        prix_par_personne: arrondir(prixParPersonne),
        prix_menu_brut: arrondir(prixMenuBrut),
        remise_applicable: remiseApplicable,
        taux_remise: remiseApplicable ? TAUX_REMISE : 0,
        montant_remise: arrondir(montantRemise),
        prix_menu_net: arrondir(prixMenuNet),
        hors_bordeaux: horsBordeaux,
        distance_km: horsBordeaux ? arrondir(km) : 0,
        frais_livraison: arrondir(fraisLivraison),
        total_ttc: arrondir(totalTtc),
    };
}

module.exports = {
    calculerTarif,
    FRAIS_LIVRAISON_FIXE,
    FRAIS_LIVRAISON_PAR_KM,
    SEUIL_CONVIVES_REMISE,
    TAUX_REMISE,
};

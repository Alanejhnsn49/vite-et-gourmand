const mongo = require('../config/mongo');

const COLLECTION = 'evenements_commandes';

/**
 * Composants d'acces aux donnees non relationnelles.
 *
 * Ce module isole toutes les interactions avec MongoDB. Les controleurs
 * n'ecrivent jamais de requete Mongo directement : ils appellent ces
 * fonctions. Cette separation permet de changer de base analytique sans
 * toucher a la logique metier.
 */

/**
 * Enregistre un evenement a chaque commande passee.
 *
 * L'ecriture est volontairement non bloquante du point de vue metier :
 * si MongoDB est indisponible, la commande reste enregistree dans
 * PostgreSQL. On ne perd qu'une donnee statistique, jamais une vente.
 */
async function enregistrerCommande(commande, menu) {
    const db = mongo.getDb();
    if (!db) return null;

    const evenement = {
        commande_id: commande.id,
        menu_id: menu.id,
        menu_titre: menu.titre,
        menu_theme: menu.theme,
        utilisateur_id: commande.utilisateur_id,
        nombre_convives: commande.nombre_convives,
        montant_ttc: parseFloat(commande.total_ttc),
        ville_livraison: commande.ville_livraison,
        date_commande: new Date(commande.date_commande),
    };

    try {
        const resultat = await db.collection(COLLECTION).insertOne(evenement);
        return resultat.insertedId;
    } catch (error) {
        console.error('Analytique : échec de l\'enregistrement de l\'événement :', error.message);
        return null;
    }
}

/**
 * Construit l'etage de filtrage commun aux agregations.
 *
 * Les valeurs sont typees et validees ici, jamais injectees telles quelles
 * dans le pipeline. C'est l'equivalent, cote NoSQL, des requetes preparees
 * utilisees cote SQL : aucune donnee utilisateur n'est interpretee comme
 * un operateur Mongo.
 */
function construireFiltre({ menuId, dateDebut, dateFin } = {}) {
    const filtre = {};

    if (menuId !== undefined && menuId !== null && menuId !== '') {
        const id = Number.parseInt(menuId, 10);
        if (!Number.isNaN(id)) {
            filtre.menu_id = id;
        }
    }

    const intervalle = {};
    if (dateDebut) {
        const debut = new Date(dateDebut);
        if (!Number.isNaN(debut.getTime())) intervalle.$gte = debut;
    }
    if (dateFin) {
        const fin = new Date(dateFin);
        if (!Number.isNaN(fin.getTime())) intervalle.$lte = fin;
    }
    if (Object.keys(intervalle).length > 0) {
        filtre.date_commande = intervalle;
    }

    return filtre;
}

/**
 * Nombre de commandes et chiffre d'affaires par menu.
 *
 * C'est la donnee qui alimente le graphique de comparaison de l'espace
 * administrateur, exige par l'enonce.
 */
async function statistiquesParMenu(filtres = {}) {
    const db = mongo.getDb();
    if (!db) return [];

    return db.collection(COLLECTION).aggregate([
        { $match: construireFiltre(filtres) },
        {
            $group: {
                _id: '$menu_id',
                menu_titre: { $first: '$menu_titre' },
                menu_theme: { $first: '$menu_theme' },
                nombre_commandes: { $sum: 1 },
                chiffre_affaires: { $sum: '$montant_ttc' },
                convives_total: { $sum: '$nombre_convives' },
            },
        },
        {
            $project: {
                _id: 0,
                menu_id: '$_id',
                menu_titre: 1,
                menu_theme: 1,
                nombre_commandes: 1,
                chiffre_affaires: { $round: ['$chiffre_affaires', 2] },
                convives_total: 1,
                panier_moyen: {
                    $round: [{ $divide: ['$chiffre_affaires', '$nombre_commandes'] }, 2],
                },
            },
        },
        { $sort: { nombre_commandes: -1 } },
    ]).toArray();
}

/**
 * Chiffre d'affaires agrege sur la periode, tous menus confondus.
 */
async function chiffreAffairesGlobal(filtres = {}) {
    const db = mongo.getDb();
    if (!db) return { nombre_commandes: 0, chiffre_affaires: 0, panier_moyen: 0 };

    const resultat = await db.collection(COLLECTION).aggregate([
        { $match: construireFiltre(filtres) },
        {
            $group: {
                _id: null,
                nombre_commandes: { $sum: 1 },
                chiffre_affaires: { $sum: '$montant_ttc' },
            },
        },
    ]).toArray();

    if (resultat.length === 0) {
        return { nombre_commandes: 0, chiffre_affaires: 0, panier_moyen: 0 };
    }

    const { nombre_commandes, chiffre_affaires } = resultat[0];
    return {
        nombre_commandes,
        chiffre_affaires: Math.round(chiffre_affaires * 100) / 100,
        panier_moyen: Math.round((chiffre_affaires / nombre_commandes) * 100) / 100,
    };
}

/**
 * Evolution du chiffre d'affaires jour par jour, pour un graphique temporel.
 */
async function evolutionTemporelle(filtres = {}) {
    const db = mongo.getDb();
    if (!db) return [];

    return db.collection(COLLECTION).aggregate([
        { $match: construireFiltre(filtres) },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_commande' } },
                nombre_commandes: { $sum: 1 },
                chiffre_affaires: { $sum: '$montant_ttc' },
            },
        },
        {
            $project: {
                _id: 0,
                date: '$_id',
                nombre_commandes: 1,
                chiffre_affaires: { $round: ['$chiffre_affaires', 2] },
            },
        },
        { $sort: { date: 1 } },
    ]).toArray();
}

module.exports = {
    enregistrerCommande,
    statistiquesParMenu,
    chiffreAffairesGlobal,
    evolutionTemporelle,
};

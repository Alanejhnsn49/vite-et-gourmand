const db = require('../config/db');
const analytics = require('../services/analyticsService');
const tarification = require('../services/tarificationService');
const mail = require('../services/mailService');

/**
 * Recupere un menu et verifie qu'il est commandable.
 * Factorise entre la simulation et la creation de commande.
 */
async function chargerMenuCommandable(menuId) {
    const id = Number.parseInt(menuId, 10);
    if (Number.isNaN(id)) {
        const erreur = new Error("Identifiant de menu invalide.");
        erreur.statut = 400;
        throw erreur;
    }

    const menuQuery = await db.query('SELECT * FROM menus WHERE id = $1', [id]);
    if (menuQuery.rows.length === 0) {
        const erreur = new Error("Menu non trouvé.");
        erreur.statut = 404;
        throw erreur;
    }

    const menu = menuQuery.rows[0];
    if (menu.stock <= 0) {
        const erreur = new Error("Ce menu est temporairement en rupture de stock.");
        erreur.statut = 400;
        throw erreur;
    }

    return menu;
}

/**
 * POST /api/orders/simuler
 *
 * Renvoie le detail tarifaire sans rien enregistrer. Repond a l'exigence du
 * cahier des charges : "une vue detaillee du prix est visible avant
 * validation (prix menu ainsi que le prix de la livraison)".
 */
exports.simulateOrder = async (req, res) => {
    const { menuId, villeLivraison, distanceKm, nombreConvives } = req.body;

    try {
        const menu = await chargerMenuCommandable(menuId);
        const detail = tarification.calculerTarif(menu, nombreConvives, villeLivraison, distanceKm);

        res.json({
            menu: { id: menu.id, titre: menu.titre, prix_min: Number(menu.prix_min) },
            detail,
        });
    } catch (error) {
        if (error.code === 'CONVIVES_INSUFFISANTS') {
            return res.status(400).json({ error: error.message, minimum: error.minimum });
        }
        if (error.statut) {
            return res.status(error.statut).json({ error: error.message });
        }
        console.error("Erreur lors de la simulation tarifaire :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * POST /api/orders/create
 */
exports.createOrder = async (req, res) => {
    const {
        menuId, datePrestation, heurePrestation,
        adresseLivraison, villeLivraison, distanceKm, nombreConvives,
    } = req.body;
    const userId = req.session.userId;

    // Validation serveur des champs obligatoires. Les attributs HTML5 du
    // formulaire sont contournables : la verification cote serveur est la
    // seule qui fasse foi.
    const champsManquants = [];
    if (!menuId) champsManquants.push('menuId');
    if (!datePrestation) champsManquants.push('datePrestation');
    if (!heurePrestation) champsManquants.push('heurePrestation');
    if (!adresseLivraison) champsManquants.push('adresseLivraison');
    if (!villeLivraison) champsManquants.push('villeLivraison');
    if (!nombreConvives) champsManquants.push('nombreConvives');

    if (champsManquants.length > 0) {
        return res.status(400).json({
            error: "Certains champs obligatoires sont manquants.",
            champs: champsManquants,
        });
    }

    // La prestation ne peut pas etre demandee dans le passe.
    const prestation = new Date(datePrestation);
    if (Number.isNaN(prestation.getTime())) {
        return res.status(400).json({ error: "Date de prestation invalide." });
    }
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    if (prestation < aujourdhui) {
        return res.status(400).json({ error: "La date de prestation ne peut pas être dans le passé." });
    }

    try {
        const menu = await chargerMenuCommandable(menuId);

        // Tout le calcul tarifaire est delegue au service dedie.
        const detail = tarification.calculerTarif(menu, nombreConvives, villeLivraison, distanceKm);

        const insertQuery = `
            INSERT INTO commandes (utilisateur_id, menu_id, date_prestation, heure_prestation, adresse_livraison, ville_livraison, distance_km, nombre_convives, total_ttc, statut)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'attente')
            RETURNING *;
        `;
        const newOrder = await db.query(insertQuery, [
            userId, menu.id, datePrestation, heurePrestation,
            adresseLivraison, villeLivraison, detail.distance_km,
            detail.nombre_convives, detail.total_ttc,
        ]);

        await db.query('UPDATE menus SET stock = stock - 1 WHERE id = $1', [menu.id]);

        // Evenement analytique ecrit apres l'enregistrement relationnel :
        // une indisponibilite de MongoDB ne doit jamais faire echouer une vente.
        await analytics.enregistrerCommande(newOrder.rows[0], menu);

        // Email de confirmation avec le détail tarifaire.
        // Comme pour l'analytique, un échec d'envoi ne remet jamais la
        // commande en cause : elle est déjà enregistrée.
        const clientQuery = await db.query(
            'SELECT prenom, nom, email FROM utilisateurs WHERE id = $1', [userId]
        );
        if (clientQuery.rows.length > 0) {
            await mail.envoyerConfirmationCommande(
                clientQuery.rows[0], newOrder.rows[0], menu, detail
            );
        }

        res.status(201).json({
            message: "Commande enregistrée avec succès !",
            commande: newOrder.rows[0],
            detail,
        });

    } catch (error) {
        if (error.code === 'CONVIVES_INSUFFISANTS') {
            return res.status(400).json({ error: error.message, minimum: error.minimum });
        }
        if (error.statut) {
            return res.status(error.statut).json({ error: error.message });
        }
        console.error("Erreur lors de la création de la commande :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

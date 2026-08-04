const db = require('../config/db');
const analytics = require('../services/analyticsService');
const tarification = require('../services/tarificationService');
const mail = require('../services/mailService');
const statuts = require('../services/commandeStatutService');

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

        // Premiere entree du suivi : sans elle, l'historique commencerait au
        // deuxieme statut et le client ne verrait pas la date de sa commande
        // dans sa chronologie.
        await db.query(
            `INSERT INTO suivi_commandes (commande_id, statut, auteur_id)
             VALUES ($1, 'attente', $2)`,
            [newOrder.rows[0].id, userId]
        );

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

// ============================================================================
// CYCLE DE VIE DE LA COMMANDE
// ============================================================================

/**
 * Enregistre un changement de statut dans l'historique et met a jour l'etat
 * courant de la commande. Les deux ecritures vont ensemble : une transaction
 * garantit qu'on ne se retrouve jamais avec un statut courant sans trace
 * correspondante dans le suivi, ni l'inverse.
 */
async function appliquerStatut(commandeId, statut, options = {}) {
    const { auteurId = null, motif = null, canal = null } = options;
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const maj = await client.query(
            `UPDATE commandes
                SET statut = $1,
                    motif_annulation = COALESCE($2, motif_annulation),
                    canal_contact = COALESCE($3, canal_contact)
              WHERE id = $4
          RETURNING *`,
            [statut, motif, canal, commandeId]
        );

        await client.query(
            `INSERT INTO suivi_commandes (commande_id, statut, auteur_id, motif, canal_contact)
             VALUES ($1, $2, $3, $4, $5)`,
            [commandeId, statut, auteurId, motif, canal]
        );

        await client.query('COMMIT');
        return maj.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Charge une commande avec le titre de son menu et les coordonnees du client.
 */
async function chargerCommandeComplete(commandeId) {
    const resultat = await db.query(
        `SELECT c.*, m.titre AS menu_titre, u.email, u.prenom, u.nom
           FROM commandes c
           JOIN menus m ON m.id = c.menu_id
           JOIN utilisateurs u ON u.id = c.utilisateur_id
          WHERE c.id = $1`,
        [commandeId]
    );
    return resultat.rows.length > 0 ? resultat.rows[0] : null;
}

/**
 * GET /api/orders/mes-commandes
 * Espace utilisateur : "visualiser l'ensemble des commandes dans le detail
 * qu'il a effectue".
 */
exports.getMesCommandes = async (req, res) => {
    try {
        const resultat = await db.query(
            `SELECT c.*, m.titre AS menu_titre, m.images AS menu_images
               FROM commandes c
               JOIN menus m ON m.id = c.menu_id
              WHERE c.utilisateur_id = $1
           ORDER BY c.date_commande DESC`,
            [req.session.userId]
        );

        res.json({
            total: resultat.rows.length,
            commandes: resultat.rows.map(function (c) {
                return Object.assign({}, c, {
                    statut_libelle: statuts.libelle(c.statut),
                    modifiable: statuts.modifiableParClient(c.statut),
                });
            }),
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des commandes :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * GET /api/orders/:id/suivi
 * Historique complet des etats, avec date et heure de chaque changement.
 *
 * Un client ne peut consulter que ses propres commandes. Un employe ou un
 * administrateur peut consulter n'importe laquelle.
 */
exports.getSuivi = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de commande invalide." });
    }

    try {
        const commande = await chargerCommandeComplete(id);
        if (!commande) {
            return res.status(404).json({ error: "Commande non trouvée." });
        }

        // Controle de propriete : sans cette verification, n'importe quel
        // client authentifie pourrait lire le suivi des commandes des autres
        // en changeant l'identifiant dans l'URL.
        const estPersonnel = ['employe', 'admin'].includes(req.session.userRole);
        if (!estPersonnel && commande.utilisateur_id !== req.session.userId) {
            return res.status(403).json({ error: "Accès interdit." });
        }

        const suivi = await db.query(
            `SELECT statut, motif, canal_contact, date_changement
               FROM suivi_commandes
              WHERE commande_id = $1
           ORDER BY date_changement ASC, id ASC`,
            [id]
        );

        res.json({
            commande_id: id,
            statut_courant: commande.statut,
            statut_courant_libelle: statuts.libelle(commande.statut),
            transitions_possibles: estPersonnel ? statuts.transitionsPossibles(commande.statut) : [],
            historique: suivi.rows.map(function (e) {
                return {
                    statut: e.statut,
                    libelle: statuts.libelle(e.statut),
                    motif: e.motif,
                    canal_contact: e.canal_contact,
                    date: e.date_changement,
                };
            }),
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du suivi :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PATCH /api/orders/:id/statut
 * Reserve aux employes et aux administrateurs.
 *
 * Cahier des charges : l'employe "ne peut pas modifier / annuler les
 * commandes avant d'avoir contacte le client par appel GSM ou mail. Il devra
 * mettre un motif d'annulation en specifiant le mode de contact ainsi que le
 * motif".
 */
exports.changerStatut = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const { statut, motif, canal_contact } = req.body;

    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de commande invalide." });
    }
    if (!statuts.estStatutConnu(statut)) {
        return res.status(400).json({ error: "Statut inconnu." });
    }

    try {
        const commande = await chargerCommandeComplete(id);
        if (!commande) {
            return res.status(404).json({ error: "Commande non trouvée." });
        }

        if (!statuts.transitionAutorisee(commande.statut, statut)) {
            return res.status(409).json({
                error: "Une commande au statut « " + statuts.libelle(commande.statut)
                     + " » ne peut pas passer à « " + statuts.libelle(statut) + " ».",
                transitions_possibles: statuts.transitionsPossibles(commande.statut),
            });
        }

        // Une annulation par le personnel exige motif et canal de contact.
        if (statut === 'annulee') {
            if (!motif || !String(motif).trim()) {
                return res.status(400).json({ error: "Un motif d'annulation est obligatoire." });
            }
            if (!['gsm', 'mail'].includes(canal_contact)) {
                return res.status(400).json({
                    error: "Le mode de contact du client est obligatoire (gsm ou mail).",
                });
            }
        }

        const misAJour = await appliquerStatut(id, statut, {
            auteurId: req.session.userId,
            motif: statut === 'annulee' ? String(motif).trim() : null,
            canal: statut === 'annulee' ? canal_contact : null,
        });

        // Le stock est rendu si la prestation n'aura pas lieu.
        if (statut === 'annulee') {
            await db.query('UPDATE menus SET stock = stock + 1 WHERE id = $1', [commande.menu_id]);
        }

        // Notifications, jamais bloquantes pour la mise a jour du statut.
        const destinataire = { email: commande.email, prenom: commande.prenom };

        if (statut === 'annulee') {
            await mail.envoyerAnnulation(destinataire, commande, String(motif).trim(), canal_contact);
        } else if (statut === 'retour') {
            await mail.envoyerRetourMateriel(
                destinataire, commande,
                statuts.DELAI_RETOUR_MATERIEL_JOURS,
                statuts.PENALITE_MATERIEL_EUROS
            );
        } else if (statut === 'terminee') {
            await mail.envoyerInvitationAvis(destinataire, commande, commande.menu_titre);
        } else {
            await mail.envoyerChangementStatut(
                destinataire, commande, commande.menu_titre, statuts.libelle(statut)
            );
        }

        res.json({
            message: "Commande n°" + id + " : " + statuts.libelle(statut) + ".",
            commande: Object.assign({}, misAJour, { statut_libelle: statuts.libelle(statut) }),
            transitions_possibles: statuts.transitionsPossibles(statut),
        });
    } catch (error) {
        console.error("Erreur lors du changement de statut :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * POST /api/orders/:id/annuler
 * Annulation par le client lui-meme, possible tant qu'aucun employe n'a
 * accepte la commande.
 */
exports.annulerParClient = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de commande invalide." });
    }

    try {
        const commande = await chargerCommandeComplete(id);
        if (!commande) {
            return res.status(404).json({ error: "Commande non trouvée." });
        }
        if (commande.utilisateur_id !== req.session.userId) {
            return res.status(403).json({ error: "Accès interdit." });
        }
        if (!statuts.modifiableParClient(commande.statut)) {
            return res.status(409).json({
                error: "Cette commande a déjà été prise en charge par notre équipe et ne peut plus être annulée en ligne. Contactez-nous.",
            });
        }

        await appliquerStatut(id, 'annulee', {
            auteurId: req.session.userId,
            motif: "Annulation à l'initiative du client",
        });

        await db.query('UPDATE menus SET stock = stock + 1 WHERE id = $1', [commande.menu_id]);

        res.json({ message: "Votre commande a bien été annulée." });
    } catch (error) {
        console.error("Erreur lors de l'annulation :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PATCH /api/orders/:id
 * Modification par le client.
 *
 * Cahier des charges : "la modification est egalement possible (tout est
 * modifiable, sauf, le choix du menu)". Le menu n'est donc jamais lu depuis
 * la requete : il reste celui d'origine, et le prix est recalcule a partir
 * de lui.
 */
exports.modifierParClient = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de commande invalide." });
    }

    try {
        const commande = await chargerCommandeComplete(id);
        if (!commande) {
            return res.status(404).json({ error: "Commande non trouvée." });
        }
        if (commande.utilisateur_id !== req.session.userId) {
            return res.status(403).json({ error: "Accès interdit." });
        }
        if (!statuts.modifiableParClient(commande.statut)) {
            return res.status(409).json({
                error: "Cette commande a déjà été prise en charge et ne peut plus être modifiée en ligne.",
            });
        }

        // Chaque champ absent de la requete conserve sa valeur actuelle.
        const datePrestation = req.body.datePrestation || commande.date_prestation;
        const heurePrestation = req.body.heurePrestation || commande.heure_prestation;
        const adresseLivraison = req.body.adresseLivraison || commande.adresse_livraison;
        const villeLivraison = req.body.villeLivraison || commande.ville_livraison;
        const distanceKm = req.body.distanceKm !== undefined ? req.body.distanceKm : commande.distance_km;
        const nombreConvives = req.body.nombreConvives !== undefined
            ? req.body.nombreConvives : commande.nombre_convives;

        // La date n'est revalidee que si le client la modifie reellement.
        // Revalider une date deja enregistree ferait echouer toute
        // modification portant sur un autre champ des lors que la date est
        // passee, ce qui n'a aucun sens : elle avait ete validee a la
        // creation de la commande.
        if (req.body.datePrestation !== undefined) {
            const prestation = new Date(datePrestation);
            if (Number.isNaN(prestation.getTime())) {
                return res.status(400).json({ error: "Date de prestation invalide." });
            }
            const aujourdhui = new Date();
            aujourdhui.setHours(0, 0, 0, 0);
            if (prestation < aujourdhui) {
                return res.status(400).json({ error: "La date de prestation ne peut pas être dans le passé." });
            }
        }

        const menuQuery = await db.query('SELECT * FROM menus WHERE id = $1', [commande.menu_id]);
        const menu = menuQuery.rows[0];

        // Le prix est integralement recalcule : modifier le nombre de convives
        // ou la ville de livraison change le montant du.
        const detail = tarification.calculerTarif(menu, nombreConvives, villeLivraison, distanceKm);

        const maj = await db.query(
            `UPDATE commandes
                SET date_prestation = $1, heure_prestation = $2, adresse_livraison = $3,
                    ville_livraison = $4, distance_km = $5, nombre_convives = $6, total_ttc = $7
              WHERE id = $8
          RETURNING *`,
            [datePrestation, heurePrestation, adresseLivraison, villeLivraison,
             detail.distance_km, detail.nombre_convives, detail.total_ttc, id]
        );

        res.json({
            message: "Votre commande a bien été modifiée.",
            commande: maj.rows[0],
            detail,
        });
    } catch (error) {
        if (error.code === 'CONVIVES_INSUFFISANTS') {
            return res.status(400).json({ error: error.message, minimum: error.minimum });
        }
        console.error("Erreur lors de la modification de la commande :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * GET /api/orders
 * Espace employe : "un filtre sur les commandes doit etre disponible afin de
 * vite retrouver les commandes a effectuer (par statut) ou d'un client en
 * particulier".
 */
exports.listerCommandes = async (req, res) => {
    const { statut, client, menuId } = req.query;

    const conditions = [];
    const valeurs = [];

    if (statut && statuts.estStatutConnu(statut)) {
        valeurs.push(statut);
        conditions.push('c.statut = $' + valeurs.length);
    }

    if (client && String(client).trim()) {
        valeurs.push('%' + String(client).trim().toLowerCase() + '%');
        const p = '$' + valeurs.length;
        conditions.push('(LOWER(u.email) LIKE ' + p
                     + ' OR LOWER(u.nom) LIKE ' + p
                     + ' OR LOWER(u.prenom) LIKE ' + p + ')');
    }

    const idMenu = Number.parseInt(menuId, 10);
    if (!Number.isNaN(idMenu)) {
        valeurs.push(idMenu);
        conditions.push('c.menu_id = $' + valeurs.length);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const resultat = await db.query(`
            SELECT c.*, m.titre AS menu_titre,
                   u.nom AS client_nom, u.prenom AS client_prenom, u.email AS client_email
              FROM commandes c
              JOIN menus m ON m.id = c.menu_id
              JOIN utilisateurs u ON u.id = c.utilisateur_id
              ${where}
          ORDER BY c.date_commande DESC
        `, valeurs);

        res.json({
            filtres: {
                statut: statut && statuts.estStatutConnu(statut) ? statut : null,
                client: client || null,
                menuId: Number.isNaN(idMenu) ? null : idMenu,
            },
            total: resultat.rows.length,
            commandes: resultat.rows.map(function (c) {
                return Object.assign({}, c, {
                    statut_libelle: statuts.libelle(c.statut),
                    transitions_possibles: statuts.transitionsPossibles(c.statut),
                });
            }),
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des commandes :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

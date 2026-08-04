const db = require('../config/db');

/**
 * Gestion du catalogue par le personnel.
 *
 * Cahier des charges : l'employe "peut modifier / supprimer les menus, plats,
 * et les horaires". Ces elements "doivent etre configurables depuis l'espace
 * Administrateur ainsi que Employe".
 *
 * Toutes les routes de ce controleur sont donc reservees aux roles employe
 * et admin, la restriction etant posee dans le fichier de routes.
 */

const THEMES = ['classique', 'noel', 'paques', 'evenement'];
const REGIMES = ['classique', 'vegetarien', 'vegan', 'sans-gluten'];
const TYPES_PLAT = ['entree', 'plat', 'dessert'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/**
 * Valide les champs d'un menu.
 * Renvoie un tableau de messages, vide si tout est correct.
 */
function validerMenu(donnees, creation) {
    const erreurs = [];
    const requis = (champ) => creation || donnees[champ] !== undefined;

    if (requis('titre') && (!donnees.titre || !String(donnees.titre).trim())) {
        erreurs.push("Le titre est obligatoire.");
    }
    if (requis('description') && (!donnees.description || !String(donnees.description).trim())) {
        erreurs.push("La description est obligatoire.");
    }
    if (requis('conditions') && (!donnees.conditions || !String(donnees.conditions).trim())) {
        erreurs.push("Les conditions de commande sont obligatoires.");
    }
    if (requis('theme') && !THEMES.includes(donnees.theme)) {
        erreurs.push("Le thème doit être : " + THEMES.join(', ') + ".");
    }
    if (requis('regime') && !REGIMES.includes(donnees.regime)) {
        erreurs.push("Le régime doit être : " + REGIMES.join(', ') + ".");
    }

    if (requis('minPersonnes')) {
        const n = Number.parseInt(donnees.minPersonnes, 10);
        if (Number.isNaN(n) || n < 1) erreurs.push("Le nombre minimum de personnes doit être au moins 1.");
    }
    if (requis('prixMin')) {
        const p = Number.parseFloat(donnees.prixMin);
        if (Number.isNaN(p) || p < 0) erreurs.push("Le prix doit être un nombre positif.");
    }
    if (donnees.stock !== undefined) {
        const s = Number.parseInt(donnees.stock, 10);
        if (Number.isNaN(s) || s < 0) erreurs.push("Le stock ne peut pas être négatif.");
    }

    return erreurs;
}

/**
 * Les images arrivent sous forme de tableau et sont stockees en TEXT separe
 * par des virgules, format historique de la table.
 */
function joindreImages(images) {
    if (Array.isArray(images)) return images.map(u => String(u).trim()).filter(Boolean).join(',');
    if (typeof images === 'string') return images.trim();
    return '';
}

// ---------------------------------------------------------------------------
// MENUS
// ---------------------------------------------------------------------------

/**
 * GET /api/catalogue/menus
 *
 * Liste destinee a l'espace de gestion. Contrairement a GET /api/menus, qui
 * sert le catalogue public et ne montre que les menus en stock, celle-ci
 * renvoie TOUS les menus, y compris ceux dont le stock est a zero.
 *
 * Sans cela, un menu retire du catalogue disparaitrait aussi de l'interface
 * de gestion, et deviendrait donc impossible a remettre en vente.
 */
exports.listerMenusGestion = async (req, res) => {
    try {
        const resultat = await db.query('SELECT * FROM menus ORDER BY id ASC');

        res.json({
            total: resultat.rows.length,
            menus: resultat.rows.map(ligne => ({
                id: ligne.id,
                titre: ligne.titre,
                description: ligne.description,
                images: ligne.images
                    ? String(ligne.images).split(',').map(u => u.trim()).filter(Boolean)
                    : [],
                theme: ligne.theme,
                regime: ligne.regime,
                minPersonnes: Number(ligne.min_personnes),
                prixMin: Number(ligne.prix_min),
                stock: Number(ligne.stock),
                conditions: ligne.conditions,
            })),
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des menus :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * POST /api/catalogue/menus
 */
exports.creerMenu = async (req, res) => {
    const erreurs = validerMenu(req.body, true);
    if (erreurs.length > 0) {
        return res.status(400).json({ error: "Menu invalide.", details: erreurs });
    }

    try {
        const resultat = await db.query(
            `INSERT INTO menus (titre, description, images, theme, regime, min_personnes, prix_min, stock, conditions)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                String(req.body.titre).trim(),
                String(req.body.description).trim(),
                joindreImages(req.body.images),
                req.body.theme,
                req.body.regime,
                Number.parseInt(req.body.minPersonnes, 10),
                Number.parseFloat(req.body.prixMin),
                req.body.stock !== undefined ? Number.parseInt(req.body.stock, 10) : 0,
                String(req.body.conditions).trim(),
            ]
        );

        res.status(201).json({ message: "Menu créé.", menu: resultat.rows[0] });
    } catch (error) {
        console.error("Erreur lors de la création du menu :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PATCH /api/catalogue/menus/:id
 * Modification partielle : seuls les champs transmis sont mis a jour.
 */
exports.modifierMenu = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de menu invalide." });
    }

    const erreurs = validerMenu(req.body, false);
    if (erreurs.length > 0) {
        return res.status(400).json({ error: "Menu invalide.", details: erreurs });
    }

    try {
        const actuel = await db.query('SELECT * FROM menus WHERE id = $1', [id]);
        if (actuel.rows.length === 0) {
            return res.status(404).json({ error: "Menu non trouvé." });
        }
        const m = actuel.rows[0];

        const resultat = await db.query(
            `UPDATE menus
                SET titre = $1, description = $2, images = $3, theme = $4, regime = $5,
                    min_personnes = $6, prix_min = $7, stock = $8, conditions = $9
              WHERE id = $10
          RETURNING *`,
            [
                req.body.titre !== undefined ? String(req.body.titre).trim() : m.titre,
                req.body.description !== undefined ? String(req.body.description).trim() : m.description,
                req.body.images !== undefined ? joindreImages(req.body.images) : m.images,
                req.body.theme !== undefined ? req.body.theme : m.theme,
                req.body.regime !== undefined ? req.body.regime : m.regime,
                req.body.minPersonnes !== undefined ? Number.parseInt(req.body.minPersonnes, 10) : m.min_personnes,
                req.body.prixMin !== undefined ? Number.parseFloat(req.body.prixMin) : m.prix_min,
                req.body.stock !== undefined ? Number.parseInt(req.body.stock, 10) : m.stock,
                req.body.conditions !== undefined ? String(req.body.conditions).trim() : m.conditions,
                id,
            ]
        );

        res.json({ message: "Menu mis à jour.", menu: resultat.rows[0] });
    } catch (error) {
        console.error("Erreur lors de la modification du menu :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * DELETE /api/catalogue/menus/:id
 *
 * Un menu deja commande n'est jamais supprime : la suppression ferait
 * disparaitre en cascade les commandes qui le referencent, donc une partie
 * de l'historique commercial. Dans ce cas, on met le stock a zero, ce qui
 * le retire du catalogue sans rien detruire.
 */
exports.supprimerMenu = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de menu invalide." });
    }

    try {
        const commandes = await db.query(
            'SELECT COUNT(*)::int AS total FROM commandes WHERE menu_id = $1', [id]
        );

        if (commandes.rows[0].total > 0) {
            const retire = await db.query(
                'UPDATE menus SET stock = 0 WHERE id = $1 RETURNING *', [id]
            );
            if (retire.rows.length === 0) {
                return res.status(404).json({ error: "Menu non trouvé." });
            }
            return res.json({
                message: `Ce menu a déjà fait l'objet de ${commandes.rows[0].total} commande(s). Il a été retiré du catalogue (stock à zéro) plutôt que supprimé, afin de préserver l'historique.`,
                menu: retire.rows[0],
                supprime: false,
            });
        }

        const supprime = await db.query('DELETE FROM menus WHERE id = $1 RETURNING id', [id]);
        if (supprime.rows.length === 0) {
            return res.status(404).json({ error: "Menu non trouvé." });
        }

        res.json({ message: "Menu supprimé.", supprime: true });
    } catch (error) {
        console.error("Erreur lors de la suppression du menu :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

// ---------------------------------------------------------------------------
// PLATS
// ---------------------------------------------------------------------------

/**
 * GET /api/catalogue/plats
 */
exports.listerPlats = async (req, res) => {
    const { type } = req.query;

    const conditions = [];
    const valeurs = [];
    if (type && TYPES_PLAT.includes(type)) {
        valeurs.push(type);
        conditions.push('p.type = $' + valeurs.length);
    }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const resultat = await db.query(`
            SELECT p.id, p.type, p.nom,
                   COALESCE(ARRAY_AGG(a.libelle ORDER BY a.libelle)
                            FILTER (WHERE a.libelle IS NOT NULL), '{}') AS allergenes,
                   COUNT(DISTINCT mp.menu_id)::int AS nb_menus
              FROM plats p
         LEFT JOIN plats_allergenes pa ON pa.plat_id = p.id
         LEFT JOIN allergenes a ON a.id = pa.allergene_id
         LEFT JOIN menus_plats mp ON mp.plat_id = p.id
              ${where}
          GROUP BY p.id, p.type, p.nom
          ORDER BY p.type, p.nom
        `, valeurs);

        res.json({ total: resultat.rows.length, plats: resultat.rows });
    } catch (error) {
        console.error("Erreur lors de la récupération des plats :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * POST /api/catalogue/plats
 * Cree un plat et associe ses allergenes en une transaction.
 */
exports.creerPlat = async (req, res) => {
    const { nom, type, allergenes } = req.body;

    if (!nom || !String(nom).trim()) {
        return res.status(400).json({ error: "Le nom du plat est obligatoire." });
    }
    if (!TYPES_PLAT.includes(type)) {
        return res.status(400).json({ error: "Le type doit être : " + TYPES_PLAT.join(', ') + "." });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const plat = await client.query(
            'INSERT INTO plats (nom, type) VALUES ($1, $2) RETURNING *',
            [String(nom).trim(), type]
        );

        // Les allergenes inconnus sont crees a la volee, ce qui evite a
        // l'employe de devoir les declarer separement au prealable.
        if (Array.isArray(allergenes)) {
            for (const libelle of allergenes) {
                const propre = String(libelle).trim();
                if (!propre) continue;

                const existant = await client.query(
                    'SELECT id FROM allergenes WHERE libelle = $1', [propre]
                );
                const allergeneId = existant.rows.length > 0
                    ? existant.rows[0].id
                    : (await client.query(
                        'INSERT INTO allergenes (libelle) VALUES ($1) RETURNING id', [propre]
                      )).rows[0].id;

                await client.query(
                    `INSERT INTO plats_allergenes (plat_id, allergene_id) VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [plat.rows[0].id, allergeneId]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Plat créé.", plat: plat.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(400).json({ error: "Un plat portant ce nom existe déjà." });
        }
        console.error("Erreur lors de la création du plat :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    } finally {
        client.release();
    }
};

/**
 * DELETE /api/catalogue/plats/:id
 */
exports.supprimerPlat = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de plat invalide." });
    }

    try {
        const supprime = await db.query('DELETE FROM plats WHERE id = $1 RETURNING id, nom', [id]);
        if (supprime.rows.length === 0) {
            return res.status(404).json({ error: "Plat non trouvé." });
        }
        // Les liaisons menus_plats et plats_allergenes disparaissent
        // automatiquement grace aux ON DELETE CASCADE du schema.
        res.json({ message: `Le plat « ${supprime.rows[0].nom} » a été supprimé de tous les menus.` });
    } catch (error) {
        console.error("Erreur lors de la suppression du plat :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PUT /api/catalogue/menus/:id/plats
 * Remplace la composition d'un menu par la liste de plats fournie.
 */
exports.definirComposition = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const { platIds } = req.body;

    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de menu invalide." });
    }
    if (!Array.isArray(platIds)) {
        return res.status(400).json({ error: "platIds doit être un tableau d'identifiants." });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const menu = await client.query('SELECT id FROM menus WHERE id = $1', [id]);
        if (menu.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Menu non trouvé." });
        }

        await client.query('DELETE FROM menus_plats WHERE menu_id = $1', [id]);

        for (const platId of platIds) {
            const pid = Number.parseInt(platId, 10);
            if (Number.isNaN(pid)) continue;
            await client.query(
                'INSERT INTO menus_plats (menu_id, plat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [id, pid]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "Composition du menu mise à jour." });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23503') {
            return res.status(400).json({ error: "Un des plats indiqués n'existe pas." });
        }
        console.error("Erreur lors de la mise à jour de la composition :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    } finally {
        client.release();
    }
};

// ---------------------------------------------------------------------------
// HORAIRES
// ---------------------------------------------------------------------------

/**
 * GET /api/catalogue/horaires
 * Route publique : le pied de page doit afficher les horaires du lundi au
 * dimanche.
 */
exports.getHoraires = async (req, res) => {
    try {
        const resultat = await db.query(
            'SELECT jour_semaine, ferme, heure_ouverture, heure_fermeture FROM horaires ORDER BY jour_semaine'
        );

        res.json({
            horaires: resultat.rows.map(h => ({
                jour_semaine: h.jour_semaine,
                jour: JOURS[h.jour_semaine - 1],
                ferme: h.ferme,
                heure_ouverture: h.heure_ouverture ? h.heure_ouverture.slice(0, 5) : null,
                heure_fermeture: h.heure_fermeture ? h.heure_fermeture.slice(0, 5) : null,
            })),
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des horaires :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PATCH /api/catalogue/horaires/:jour
 * Modification d'un jour, reservee au personnel.
 */
exports.modifierHoraire = async (req, res) => {
    const jour = Number.parseInt(req.params.jour, 10);
    const { ferme, heure_ouverture, heure_fermeture } = req.body;

    if (Number.isNaN(jour) || jour < 1 || jour > 7) {
        return res.status(400).json({ error: "Le jour doit être compris entre 1 (lundi) et 7 (dimanche)." });
    }
    if (typeof ferme !== 'boolean') {
        return res.status(400).json({ error: "Le champ ferme doit valoir true ou false." });
    }
    if (!ferme && (!heure_ouverture || !heure_fermeture)) {
        return res.status(400).json({
            error: "Un jour ouvert doit comporter une heure d'ouverture et une heure de fermeture.",
        });
    }

    try {
        const maj = await db.query(
            `UPDATE horaires
                SET ferme = $1,
                    heure_ouverture = $2,
                    heure_fermeture = $3
              WHERE jour_semaine = $4
          RETURNING *`,
            [ferme, ferme ? null : heure_ouverture, ferme ? null : heure_fermeture, jour]
        );

        if (maj.rows.length === 0) {
            return res.status(404).json({ error: "Jour non trouvé." });
        }

        res.json({ message: `Horaires du ${JOURS[jour - 1]} mis à jour.`, horaire: maj.rows[0] });
    } catch (error) {
        // La contrainte de coherence du schema rejette une fermeture
        // anterieure a l'ouverture.
        if (error.code === '23514') {
            return res.status(400).json({
                error: "Horaires incohérents : l'heure de fermeture doit être postérieure à l'heure d'ouverture.",
            });
        }
        console.error("Erreur lors de la modification des horaires :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

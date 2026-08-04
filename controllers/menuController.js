const db = require('../config/db');

/**
 * Valeurs autorisees, alignees sur les contraintes CHECK du schema.
 * Toute valeur hors de ces listes est ignoree plutot que transmise a la
 * requete : le filtre est neutralise, jamais interprete.
 */
const THEMES = ['classique', 'noel', 'paques', 'evenement'];
const REGIMES = ['classique', 'vegetarien', 'vegan', 'sans-gluten'];

/**
 * Les images sont stockees dans une colonne TEXT, separees par des virgules.
 * L'API renvoie un tableau : le format de stockage ne doit pas fuiter jusqu'au
 * client.
 */
function decouperImages(valeur) {
    if (!valeur) return [];
    return String(valeur).split(',').map(url => url.trim()).filter(Boolean);
}

/**
 * Normalise une ligne de la table menus pour l'API.
 */
function formaterMenu(ligne) {
    return {
        id: ligne.id,
        titre: ligne.titre,
        description: ligne.description,
        images: decouperImages(ligne.images),
        theme: ligne.theme,
        regime: ligne.regime,
        minPersonnes: Number(ligne.min_personnes),
        prixMin: Number(ligne.prix_min),
        stock: Number(ligne.stock),
        conditions: ligne.conditions,
    };
}

/**
 * GET /api/menus
 *
 * Vue globale des menus, accessible aux visiteurs comme aux personnes
 * authentifiees, conformement au cahier des charges.
 *
 * Filtres acceptes, tous combinables et tous optionnels :
 *   theme          un des themes autorises
 *   regime         un des regimes autorises
 *   minPersonnes   nombre de personnes minimum du menu
 *   prixMin        borne basse de la fourchette de prix
 *   prixMax        borne haute, ou filtre "prix maximum" seul
 *
 * Le filtrage est realise par PostgreSQL et non en JavaScript apres coup :
 * la base n'envoie que les lignes utiles, ce qui reste efficace quel que soit
 * le nombre de menus. Chaque valeur passe par un parametre lie, jamais par
 * concatenation dans la chaine SQL.
 */
exports.getAllMenus = async (req, res) => {
    const { theme, regime, minPersonnes, prixMin, prixMax } = req.query;

    const conditions = ['stock > 0'];
    const valeurs = [];

    // Seuls les filtres reellement appliques sont conserves, afin que la
    // reponse decrive ce que le serveur a fait et non ce que le client a
    // demande. Une valeur refusee n'est jamais renvoyee au client.
    const appliques = { theme: null, regime: null };

    if (theme && THEMES.includes(theme)) {
        valeurs.push(theme);
        conditions.push(`theme = $${valeurs.length}`);
        appliques.theme = theme;
    }

    if (regime && REGIMES.includes(regime)) {
        valeurs.push(regime);
        conditions.push(`regime = $${valeurs.length}`);
        appliques.regime = regime;
    }

    const nbPersonnes = Number.parseInt(minPersonnes, 10);
    if (!Number.isNaN(nbPersonnes) && nbPersonnes > 0) {
        valeurs.push(nbPersonnes);
        conditions.push(`min_personnes >= $${valeurs.length}`);
    }

    const borneBasse = Number.parseFloat(prixMin);
    if (!Number.isNaN(borneBasse) && borneBasse >= 0) {
        valeurs.push(borneBasse);
        conditions.push(`prix_min >= $${valeurs.length}`);
    }

    const borneHaute = Number.parseFloat(prixMax);
    if (!Number.isNaN(borneHaute) && borneHaute >= 0) {
        valeurs.push(borneHaute);
        conditions.push(`prix_min <= $${valeurs.length}`);
    }

    const requete = `
        SELECT * FROM menus
         WHERE ${conditions.join(' AND ')}
         ORDER BY id ASC
    `;

    try {
        const resultat = await db.query(requete, valeurs);
        res.status(200).json({
            filtres: {
                theme: appliques.theme,
                regime: appliques.regime,
                minPersonnes: Number.isNaN(nbPersonnes) ? null : nbPersonnes,
                prixMin: Number.isNaN(borneBasse) ? null : borneBasse,
                prixMax: Number.isNaN(borneHaute) ? null : borneHaute,
            },
            total: resultat.rows.length,
            menus: resultat.rows.map(formaterMenu),
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des menus :", error);
        res.status(500).json({ error: "Impossible de charger les menus." });
    }
};

/**
 * GET /api/menus/:id
 *
 * Vue detaillee d'un menu. Le cahier des charges exige que "toutes les
 * informations enumerees dans la base de donnees" soient visibles, ce qui
 * inclut la composition et les allergenes.
 *
 * Les plats sont recuperes en une seule requete, avec leurs allergenes
 * agreges par PostgreSQL, plutot qu'une requete par plat. C'est le probleme
 * classique dit "N+1" : sur 17 plats, la version naive declencherait 18
 * allers-retours vers la base au lieu d'un seul.
 */
exports.getMenuById = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de menu invalide." });
    }

    try {
        const menuQuery = await db.query('SELECT * FROM menus WHERE id = $1', [id]);

        if (menuQuery.rows.length === 0) {
            return res.status(404).json({ error: "Menu non trouvé." });
        }

        const platsQuery = await db.query(`
            SELECT p.id,
                   p.nom,
                   p.type,
                   COALESCE(
                       ARRAY_AGG(a.libelle ORDER BY a.libelle)
                           FILTER (WHERE a.libelle IS NOT NULL),
                       '{}'
                   ) AS allergenes
              FROM menus_plats mp
              JOIN plats p ON p.id = mp.plat_id
         LEFT JOIN plats_allergenes pa ON pa.plat_id = p.id
         LEFT JOIN allergenes a ON a.id = pa.allergene_id
             WHERE mp.menu_id = $1
          GROUP BY p.id, p.nom, p.type
          ORDER BY p.id ASC
        `, [id]);

        // Regroupement par type, dans la forme attendue par le front.
        const composition = { entrees: [], plats: [], desserts: [] };
        const correspondance = { entree: 'entrees', plat: 'plats', dessert: 'desserts' };

        platsQuery.rows.forEach(ligne => {
            const groupe = correspondance[ligne.type];
            if (groupe) {
                composition[groupe].push({
                    id: ligne.id,
                    nom: ligne.nom,
                    allergenes: ligne.allergenes || [],
                });
            }
        });

        res.status(200).json({
            ...formaterMenu(menuQuery.rows[0]),
            plats: composition,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération du menu :", error);
        res.status(500).json({ error: "Impossible de charger ce menu." });
    }
};

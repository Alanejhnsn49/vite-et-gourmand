const analytics = require('../services/analyticsService');

/**
 * Controleur de l'espace administrateur : indicateurs et donnees de graphique.
 *
 * Toutes les donnees exposees ici proviennent de MongoDB, conformement a
 * l'enonce qui impose que les statistiques de comparaison des commandes
 * viennent d'une base non relationnelle.
 */

/**
 * GET /api/analytics/menus
 * Alimente le graphique de comparaison des commandes par menu.
 * Filtres acceptes : menuId, dateDebut, dateFin.
 */
exports.getStatistiquesParMenu = async (req, res) => {
    try {
        const { menuId, dateDebut, dateFin } = req.query;
        const donnees = await analytics.statistiquesParMenu({ menuId, dateDebut, dateFin });

        res.json({
            filtres: { menuId: menuId || null, dateDebut: dateDebut || null, dateFin: dateFin || null },
            resultats: donnees,
        });
    } catch (error) {
        console.error('Erreur lors du calcul des statistiques par menu :', error);
        res.status(500).json({ error: 'Une erreur interne est survenue.' });
    }
};

/**
 * GET /api/analytics/chiffre-affaires
 * Chiffre d'affaires global sur la periode, avec le detail par menu.
 */
exports.getChiffreAffaires = async (req, res) => {
    try {
        const { menuId, dateDebut, dateFin } = req.query;
        const filtres = { menuId, dateDebut, dateFin };

        const [global, parMenu] = await Promise.all([
            analytics.chiffreAffairesGlobal(filtres),
            analytics.statistiquesParMenu(filtres),
        ]);

        res.json({
            filtres: { menuId: menuId || null, dateDebut: dateDebut || null, dateFin: dateFin || null },
            global,
            par_menu: parMenu,
        });
    } catch (error) {
        console.error('Erreur lors du calcul du chiffre d\'affaires :', error);
        res.status(500).json({ error: 'Une erreur interne est survenue.' });
    }
};

/**
 * GET /api/analytics/evolution
 * Evolution jour par jour, pour un graphique temporel.
 */
exports.getEvolution = async (req, res) => {
    try {
        const { menuId, dateDebut, dateFin } = req.query;
        const donnees = await analytics.evolutionTemporelle({ menuId, dateDebut, dateFin });
        res.json({ resultats: donnees });
    } catch (error) {
        console.error('Erreur lors du calcul de l\'évolution temporelle :', error);
        res.status(500).json({ error: 'Une erreur interne est survenue.' });
    }
};

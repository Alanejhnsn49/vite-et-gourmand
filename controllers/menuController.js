const db = require('../config/db');

// Récupérer tous les menus disponibles en stock
exports.getAllMenus = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM menus WHERE stock > 0 ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Erreur lors de la récupération des menus :", error);
        res.status(500).json({ error: "Impossible de charger les menus." });
    }
};
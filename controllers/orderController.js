const db = require('../config/db');

exports.createOrder = async (req, res) => {
    const { menuId, datePrestation, heurePrestation, adresseLivraison, villeLivraison, distanceKm, nombreConvives } = req.body;
    const userId = req.session.userId;

    try {
        // 1. Récupérer les informations du menu en base de données
        const menuQuery = await db.query('SELECT * FROM menus WHERE id = $1', [menuId]);
        if (menuQuery.rows.length === 0) {
            return res.status(404).json({ error: "Menu non trouvé." });
        }
        const menu = menuQuery.rows[0];

        // 2. Vérifier le stock disponible
        if (menu.stock <= 0) {
            return res.status(400).json({ error: "Ce menu est temporairement en rupture de stock." });
        }

        // 3. Calculer le prix de base (prix forfaitaire de base + convives supplémentaires)
        let totalTtc = parseFloat(menu.prix_min);
        
        // Si le nombre de convives demandés dépasse le minimum du menu, on ajuste le prix
        if (nombreConvives > menu.min_personnes) {
            const convivesSupplementaires = nombreConvives - menu.min_personnes;
            const prixParConviveSupp = 25.00; // Tarif standard par convive supplémentaire
            totalTtc += (convivesSupplementaires * prixParConviveSupp);
        }

        // 4. Règle de Julie : Réduction de 10% si le menu est un événement/pâtisserie et dépasse 250€
        if (menu.theme === 'evenement' && totalTtc > 250.00) {
            totalTtc = totalTtc * 0.90; // Application des 10% de remise
        }

        // 5. Règle de José : Frais kilométriques hors Bordeaux (2.50 € / km)
        let fraisLivraison = 0;
        if (villeLivraison.toLowerCase() !== 'bordeaux' && distanceKm > 0) {
            fraisLivraison = distanceKm * 2.50;
            totalTtc += fraisLivraison;
        }

        // 6. Enregistrement de la commande en base de données
        const insertQuery = `
            INSERT INTO commandes (utilisateur_id, menu_id, date_prestation, heure_prestation, adresse_livraison, ville_livraison, distance_km, nombre_convives, total_ttc, statut)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'attente')
            RETURNING *;
        `;
        const newOrder = await db.query(insertQuery, [
            userId, menuId, datePrestation, heurePrestation, adresseLivraison, villeLivraison, distanceKm, nombreConvives, totalTtc
        ]);

        // 7. Décrémenter le stock du menu commandé
        await db.query('UPDATE menus SET stock = stock - 1 WHERE id = $1', [menuId]);

        res.status(201).json({
            message: "Commande enregistrée avec succès !",
            commande: newOrder.rows[0]
        });

    } catch (error) {
        console.error("Erreur lors de la création de la commande :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};
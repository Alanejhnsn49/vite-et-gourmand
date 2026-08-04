const db = require('../config/db');

/**
 * Avis clients.
 *
 * Cahier des charges :
 * - "quand la commande est terminee, alors l'utilisateur est notifie par mail
 *   qu'il peut se connecter a son compte pour donner son avis depuis la
 *   commande. Il doit pouvoir donner entre note entre 1 et 5, suivi d'un
 *   commentaire."
 * - "l'employe peut egalement valider les avis recus par les utilisateurs
 *   afin qu'ils soient visibles sur la page d'accueil. Il peut egalement en
 *   refuser."
 * - La page d'accueil affiche "les avis clients qui sont valides".
 */

const LONGUEUR_MAX_COMMENTAIRE = 2000;

/**
 * GET /api/avis
 * Route publique : uniquement les avis valides, pour la page d'accueil.
 */
exports.getAvisPublics = async (req, res) => {
    try {
        const resultat = await db.query(
            `SELECT a.id, a.note, a.commentaire, a.date_publication,
                    u.prenom, m.titre AS menu_titre
               FROM avis a
               JOIN utilisateurs u ON u.id = a.utilisateur_id
               JOIN commandes c ON c.id = a.commande_id
               JOIN menus m ON m.id = c.menu_id
              WHERE a.statut_moderation = 'valide'
           ORDER BY a.date_publication DESC
              LIMIT 20`
        );

        const moyenne = resultat.rows.length > 0
            ? Math.round((resultat.rows.reduce((s, a) => s + a.note, 0) / resultat.rows.length) * 10) / 10
            : null;

        // Seul le prenom est expose : publier le nom complet d'un client sur
        // une page publique serait une diffusion de donnee personnelle non
        // necessaire au regard du RGPD.
        res.json({ total: resultat.rows.length, note_moyenne: moyenne, avis: resultat.rows });
    } catch (error) {
        console.error("Erreur lors de la récupération des avis :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * POST /api/avis
 * Depot d'un avis par le client, sur une de ses commandes terminees.
 */
exports.deposerAvis = async (req, res) => {
    const { commandeId, note, commentaire } = req.body;

    const id = Number.parseInt(commandeId, 10);
    const valeurNote = Number.parseInt(note, 10);

    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant de commande invalide." });
    }
    if (Number.isNaN(valeurNote) || valeurNote < 1 || valeurNote > 5) {
        return res.status(400).json({ error: "La note doit être comprise entre 1 et 5." });
    }
    if (!commentaire || !String(commentaire).trim()) {
        return res.status(400).json({ error: "Le commentaire est obligatoire." });
    }
    if (String(commentaire).trim().length > LONGUEUR_MAX_COMMENTAIRE) {
        return res.status(400).json({
            error: `Le commentaire ne peut pas dépasser ${LONGUEUR_MAX_COMMENTAIRE} caractères.`,
        });
    }

    try {
        const commandeQuery = await db.query(
            'SELECT id, utilisateur_id, statut FROM commandes WHERE id = $1', [id]
        );
        if (commandeQuery.rows.length === 0) {
            return res.status(404).json({ error: "Commande non trouvée." });
        }

        const commande = commandeQuery.rows[0];

        // Un client ne peut noter que ses propres commandes.
        if (commande.utilisateur_id !== req.session.userId) {
            return res.status(403).json({ error: "Accès interdit." });
        }

        // Et seulement une fois la prestation reellement terminee.
        if (commande.statut !== 'terminee') {
            return res.status(409).json({
                error: "Vous pourrez déposer un avis une fois la prestation terminée.",
            });
        }

        // La contrainte UNIQUE sur commande_id garantit deja l'unicite en
        // base : ce controle sert uniquement a renvoyer un message clair.
        const dejaNote = await db.query('SELECT id FROM avis WHERE commande_id = $1', [id]);
        if (dejaNote.rows.length > 0) {
            return res.status(409).json({ error: "Vous avez déjà déposé un avis pour cette commande." });
        }

        // Tout avis part en moderation : le cahier des charges impose une
        // validation par un employe avant publication.
        const nouveau = await db.query(
            `INSERT INTO avis (utilisateur_id, commande_id, note, commentaire, statut_moderation)
             VALUES ($1, $2, $3, $4, 'en_attente')
             RETURNING id, note, commentaire, statut_moderation, date_publication`,
            [req.session.userId, id, valeurNote, String(commentaire).trim()]
        );

        res.status(201).json({
            message: "Merci ! Votre avis sera publié après validation par notre équipe.",
            avis: nouveau.rows[0],
        });
    } catch (error) {
        console.error("Erreur lors du dépôt de l'avis :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * GET /api/avis/moderation
 * Reserve aux employes et administrateurs : file de moderation.
 */
exports.getFileModeration = async (req, res) => {
    const { statut } = req.query;
    const statutsValides = ['en_attente', 'valide', 'refuse'];

    const conditions = [];
    const valeurs = [];

    if (statut && statutsValides.includes(statut)) {
        valeurs.push(statut);
        conditions.push('a.statut_moderation = $' + valeurs.length);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const resultat = await db.query(
            `SELECT a.id, a.note, a.commentaire, a.statut_moderation, a.date_publication,
                    a.commande_id, u.nom, u.prenom, u.email, m.titre AS menu_titre
               FROM avis a
               JOIN utilisateurs u ON u.id = a.utilisateur_id
               JOIN commandes c ON c.id = a.commande_id
               JOIN menus m ON m.id = c.menu_id
               ${where}
           ORDER BY a.date_publication DESC`,
            valeurs
        );

        res.json({
            filtre: statut && statutsValides.includes(statut) ? statut : null,
            total: resultat.rows.length,
            avis: resultat.rows,
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de la file de modération :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PATCH /api/avis/:id/moderation
 * Validation ou refus d'un avis par un employe ou un administrateur.
 */
exports.modererAvis = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const { statut_moderation } = req.body;

    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant d'avis invalide." });
    }
    if (!['valide', 'refuse'].includes(statut_moderation)) {
        return res.status(400).json({ error: "Le statut de modération doit être « valide » ou « refuse »." });
    }

    try {
        const maj = await db.query(
            `UPDATE avis SET statut_moderation = $1 WHERE id = $2
             RETURNING id, note, commentaire, statut_moderation`,
            [statut_moderation, id]
        );

        if (maj.rows.length === 0) {
            return res.status(404).json({ error: "Avis non trouvé." });
        }

        res.json({
            message: statut_moderation === 'valide'
                ? "L'avis est désormais visible sur la page d'accueil."
                : "L'avis a été refusé et ne sera pas publié.",
            avis: maj.rows[0],
        });
    } catch (error) {
        console.error("Erreur lors de la modération de l'avis :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

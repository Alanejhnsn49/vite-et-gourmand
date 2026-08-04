const db = require('../config/db');
const bcrypt = require('bcrypt');
const mail = require('../services/mailService');

/**
 * Gestion des comptes.
 *
 * Une partie des actions est reservee a l'administrateur, l'autre concerne
 * le compte de la personne connectee.
 */

const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Regle du cahier des charges, identique a celle de l'inscription.
 */
function validerMotDePasse(motDePasse) {
    const manques = [];
    if (typeof motDePasse !== 'string' || motDePasse.length < 10) manques.push('10 caractères minimum');
    if (!/[A-Z]/.test(motDePasse || '')) manques.push('une majuscule');
    if (!/[a-z]/.test(motDePasse || '')) manques.push('une minuscule');
    if (!/[0-9]/.test(motDePasse || '')) manques.push('un chiffre');
    if (!/[^A-Za-z0-9]/.test(motDePasse || '')) manques.push('un caractère spécial');
    return manques;
}

/**
 * PATCH /api/users/moi
 * Espace utilisateur : "modifier ses informations personnelles".
 *
 * Le role et l'etat actif ne figurent volontairement pas parmi les champs
 * modifiables : sans cela, n'importe quel client pourrait s'attribuer le role
 * administrateur en ajoutant un champ a la requete.
 */
exports.modifierMonProfil = async (req, res) => {
    const { nom, prenom, telephone, adresse_facturation, email } = req.body;

    try {
        const actuel = await db.query(
            'SELECT * FROM utilisateurs WHERE id = $1', [req.session.userId]
        );
        if (actuel.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur non trouvé." });
        }

        const nouvelEmail = email ? String(email).trim().toLowerCase() : actuel.rows[0].email;

        if (email && !FORMAT_EMAIL.test(nouvelEmail)) {
            return res.status(400).json({ error: "Adresse email invalide." });
        }

        // L'unicite de l'email est garantie par une contrainte en base, mais
        // un message clair vaut mieux qu'une erreur SQL brute.
        if (nouvelEmail !== actuel.rows[0].email) {
            const dejaPris = await db.query(
                'SELECT id FROM utilisateurs WHERE email = $1 AND id <> $2',
                [nouvelEmail, req.session.userId]
            );
            if (dejaPris.rows.length > 0) {
                return res.status(400).json({ error: "Cet email est déjà utilisé." });
            }
        }

        const maj = await db.query(
            `UPDATE utilisateurs
                SET nom = $1, prenom = $2, telephone = $3, adresse_facturation = $4, email = $5
              WHERE id = $6
          RETURNING id, nom, prenom, email, telephone, adresse_facturation, role`,
            [
                nom || actuel.rows[0].nom,
                prenom || actuel.rows[0].prenom,
                telephone || actuel.rows[0].telephone,
                adresse_facturation || actuel.rows[0].adresse_facturation,
                nouvelEmail,
                req.session.userId,
            ]
        );

        res.json({ message: "Vos informations ont bien été mises à jour.", user: maj.rows[0] });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du profil :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * GET /api/users
 * Reserve a l'administrateur : liste des comptes du personnel.
 */
exports.listerUtilisateurs = async (req, res) => {
    const { role } = req.query;

    const conditions = [];
    const valeurs = [];

    if (role && ['client', 'employe', 'admin'].includes(role)) {
        valeurs.push(role);
        conditions.push('role = $' + valeurs.length);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        // Le mot de passe hache n'est jamais renvoye, meme a un administrateur.
        const resultat = await db.query(
            `SELECT id, nom, prenom, email, telephone, role, actif, date_creation
               FROM utilisateurs ${where}
           ORDER BY role, nom`,
            valeurs
        );
        res.json({ total: resultat.rows.length, utilisateurs: resultat.rows });
    } catch (error) {
        console.error("Erreur lors de la récupération des utilisateurs :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * POST /api/users/employes
 * Reserve a l'administrateur.
 *
 * Cahier des charges : "il peut creer un compte de type employe, il doit
 * pour cela fournir un email (qui sera l'username) ainsi qu'un mot de passe.
 * L'employe en question va recevoir un mail lui notifiant qu'un compte pour
 * lui a ete cree, cependant, le mot de passe n'est pas communique dans le
 * mail. Il devra se rapprocher de l'administrateur afin de l'obtenir."
 *
 * Et surtout : "il ne doit pas etre possible de creer un compte
 * Administrateur depuis l'application". Le role est donc force a 'employe',
 * il n'est jamais lu depuis la requete.
 */
exports.creerEmploye = async (req, res) => {
    const { nom, prenom, email, mot_de_passe, telephone, adresse_facturation } = req.body;

    if (!nom || !prenom || !email) {
        return res.status(400).json({ error: "Nom, prénom et email sont obligatoires." });
    }

    const adresse = String(email).trim().toLowerCase();
    if (!FORMAT_EMAIL.test(adresse)) {
        return res.status(400).json({ error: "Adresse email invalide." });
    }

    const manques = validerMotDePasse(mot_de_passe);
    if (manques.length > 0) {
        return res.status(400).json({
            error: "Le mot de passe ne respecte pas les exigences de sécurité.",
            manquant: manques,
        });
    }

    try {
        const existe = await db.query('SELECT id FROM utilisateurs WHERE email = $1', [adresse]);
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: "Cet email est déjà utilisé." });
        }

        const hache = await bcrypt.hash(mot_de_passe, 12);

        // Le role est ecrit en dur dans la requete : aucune valeur venant du
        // client ne peut influencer le role cree.
        const nouveau = await db.query(
            `INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, adresse_facturation, role)
             VALUES ($1, $2, $3, $4, $5, $6, 'employe')
             RETURNING id, nom, prenom, email, role, actif`,
            [
                nom, prenom, adresse, hache,
                telephone || 'non renseigné',
                adresse_facturation || 'non renseignée',
            ]
        );

        // Le mot de passe n'apparait volontairement pas dans l'email.
        await mail.envoyerCreationCompteEmploye(nouveau.rows[0]);

        res.status(201).json({
            message: "Compte employé créé. Un email de notification vient de lui être envoyé, sans le mot de passe.",
            user: nouveau.rows[0],
        });
    } catch (error) {
        console.error("Erreur lors de la création du compte employé :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

/**
 * PATCH /api/users/:id/actif
 * Reserve a l'administrateur : active ou desactive un compte.
 *
 * Le compte n'est jamais supprime. Une suppression casserait les cles
 * etrangeres des commandes deja passees et ferait disparaitre l'historique
 * commercial de l'entreprise.
 */
exports.changerActivation = async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    const { actif } = req.body;

    if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Identifiant invalide." });
    }
    if (typeof actif !== 'boolean') {
        return res.status(400).json({ error: "Le champ actif doit valoir true ou false." });
    }

    // Un administrateur qui se desactive lui-meme se verrouillerait dehors.
    if (id === req.session.userId) {
        return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
    }

    try {
        const cible = await db.query('SELECT id, role FROM utilisateurs WHERE id = $1', [id]);
        if (cible.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur non trouvé." });
        }

        const maj = await db.query(
            `UPDATE utilisateurs SET actif = $1 WHERE id = $2
             RETURNING id, nom, prenom, email, role, actif`,
            [actif, id]
        );

        res.json({
            message: actif
                ? "Le compte a été réactivé."
                : "Le compte a été rendu inutilisable. L'historique des commandes est conservé.",
            user: maj.rows[0],
        });
    } catch (error) {
        console.error("Erreur lors du changement d'activation :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

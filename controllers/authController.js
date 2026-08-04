const db = require('../config/db');
const bcrypt = require('bcrypt');
const mail = require('../services/mailService');
const reinitialisation = require('../services/reinitialisationService');

/**
 * Règle du cahier des charges : "mot de passe sécurisé (10 caractères
 * minimum constitué au minima d'un caractère spécial, une majuscule, une
 * minuscule, un chiffre)".
 *
 * Vérifiée côté serveur : un attribut pattern sur le formulaire est
 * contournable dès que la requête est forgée hors du navigateur.
 */
function validerMotDePasse(motDePasse) {
    const manques = [];
    if (typeof motDePasse !== 'string' || motDePasse.length < 10) {
        manques.push('10 caractères minimum');
    }
    if (!/[A-Z]/.test(motDePasse || '')) manques.push('une majuscule');
    if (!/[a-z]/.test(motDePasse || '')) manques.push('une minuscule');
    if (!/[0-9]/.test(motDePasse || '')) manques.push('un chiffre');
    if (!/[^A-Za-z0-9]/.test(motDePasse || '')) manques.push('un caractère spécial');
    return manques;
}

// 1. INSCRIPTION
exports.register = async (req, res) => {
    const { nom, prenom, email, mot_de_passe, telephone, adresse_facturation } = req.body;

    try {
        const manques = validerMotDePasse(mot_de_passe);
        if (manques.length > 0) {
            return res.status(400).json({
                error: "Le mot de passe ne respecte pas les exigences de sécurité.",
                manquant: manques,
            });
        }

        // Vérifier si l'email existe déjà
        const userExists = await db.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: "Cet email est déjà utilisé." });
        }

        // Hachage du mot de passe avec un coût de 12 (Sécurité bcrypt)
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);

        // Insertion du nouvel utilisateur (rôle 'client' par défaut)
        const insertQuery = `
            INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, adresse_facturation, role)
            VALUES ($1, $2, $3, $4, $5, $6, 'client')
            RETURNING id, nom, prenom, email, role;
        `;
        
        const newUser = await db.query(insertQuery, [
            nom, prenom, email, hashedPassword, telephone, adresse_facturation
        ]);

        // Email de bienvenue automatique. Un échec d'envoi ne remet pas
        // l'inscription en cause : le compte est créé, l'erreur est journalisée.
        await mail.envoyerBienvenue(newUser.rows[0]);

        res.status(201).json({
            message: "Inscription réussie !",
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error("Erreur lors de l'inscription :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

// 2. CONNEXION
exports.login = async (req, res) => {
    const { email, mot_de_passe } = req.body;

    try {
        // Rechercher l'utilisateur par son email
        const userQuery = await db.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);
        if (userQuery.rows.length === 0) {
            return res.status(401).json({ error: "Identifiants incorrects." });
        }

        const user = userQuery.rows[0];

        // Comparer le mot de passe saisi avec le hash stocké en base de données
        //
        // La comparaison est faite AVANT le contrôle d'activation, et de
        // façon délibérée : révéler qu'un compte est désactivé sans exiger
        // le bon mot de passe permettrait de découvrir quelles adresses
        // correspondent à d'anciens employés.
        const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!match) {
            return res.status(401).json({ error: "Identifiants incorrects." });
        }

        // Un compte rendu inutilisable par l'administrateur ne peut plus
        // ouvrir de session, mais il n'est jamais supprimé : son historique
        // de commandes reste intact.
        if (user.actif === false) {
            return res.status(403).json({
                error: "Ce compte a été désactivé. Rapprochez-vous de votre administrateur.",
            });
        }

        // Initialiser la session utilisateur (Stockage sécurisé côté serveur)
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = `${user.prenom} ${user.nom}`;

        res.status(200).json({
            message: "Connexion réussie !",
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Erreur lors de la connexion :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

// 3. DÉCONNEXION
exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: "Impossible de vous déconnecter." });
        }
        res.clearCookie('connect.sid'); // Supprime le cookie de session chez le client
        res.status(200).json({ message: "Déconnexion réussie." });
    });
};

// 4. RÉCUPÉRER L'UTILISATEUR CONNECTÉ (Pour pré-remplir les formulaires)
exports.getMe = async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: "Non connecté" });
        }

        const userQuery = await db.query(
            'SELECT id, nom, prenom, email, telephone, adresse_facturation, role FROM utilisateurs WHERE id = $1',
            [req.session.userId]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        res.status(200).json(userQuery.rows[0]);
    } catch (error) {
        console.error("Erreur lors de la récupération du profil :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};
// ============================================================================
// 5. MOT DE PASSE OUBLIÉ : DEMANDE D'UN LIEN DE RÉINITIALISATION
// ============================================================================

/**
 * POST /api/auth/mot-de-passe-oublie
 *
 * Cahier des charges : "si le mot de passe est oublié, il pourra le
 * réinitialiser via un bouton prévu à cet effet : un lien par mail lui sera
 * envoyé afin de l'inviter à le réinitialiser, pour cela, il devra juste
 * donner son mail dans le formulaire."
 *
 * Point de sécurité important : la réponse est volontairement identique que
 * l'adresse existe ou non. Une réponse différenciée permettrait d'énumérer
 * les comptes de la plateforme, ce qui est une fuite d'information et un
 * manquement au RGPD.
 */
exports.demanderReinitialisation = async (req, res) => {
    const { email } = req.body;

    // Message unique, renvoyé dans tous les cas de figure.
    const reponseNeutre = {
        message: "Si un compte est associé à cette adresse, un email de réinitialisation vient d'être envoyé.",
    };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return res.status(400).json({ error: "Une adresse email valide est obligatoire." });
    }

    try {
        const utilisateurQuery = await db.query(
            'SELECT id, prenom, email FROM utilisateurs WHERE email = $1',
            [String(email).trim().toLowerCase()]
        );

        // Adresse inconnue : on répond exactement comme en cas de succès,
        // sans rien envoyer.
        if (utilisateurQuery.rows.length === 0) {
            return res.status(200).json(reponseNeutre);
        }

        const utilisateur = utilisateurQuery.rows[0];
        const { jeton } = await reinitialisation.creerJeton(utilisateur.id);

        await mail.envoyerReinitialisation(
            utilisateur, jeton, reinitialisation.DUREE_VALIDITE_MINUTES
        );

        res.status(200).json(reponseNeutre);
    } catch (error) {
        console.error("Erreur lors de la demande de réinitialisation :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

// ============================================================================
// 6. VÉRIFICATION D'UN LIEN DE RÉINITIALISATION
// ============================================================================

/**
 * GET /api/auth/reinitialisation/:jeton
 *
 * Permet à la page de réinitialisation de savoir, avant d'afficher le
 * formulaire, si le lien est encore valide. Évite de faire saisir un nouveau
 * mot de passe pour rien.
 */
exports.verifierLienReinitialisation = async (req, res) => {
    try {
        const ligne = await reinitialisation.verifierJeton(req.params.jeton);

        if (!ligne) {
            return res.status(400).json({
                valide: false,
                error: "Ce lien est invalide, expiré, ou a déjà été utilisé.",
            });
        }

        res.status(200).json({ valide: true, prenom: ligne.prenom });
    } catch (error) {
        console.error("Erreur lors de la vérification du lien :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

// ============================================================================
// 7. RÉINITIALISATION EFFECTIVE DU MOT DE PASSE
// ============================================================================

/**
 * POST /api/auth/reinitialiser
 *
 * Le jeton est revérifié ici, et non seulement à l'affichage du formulaire :
 * une vérification faite uniquement côté client ou lors d'un appel précédent
 * ne protège rien.
 */
exports.reinitialiserMotDePasse = async (req, res) => {
    const { jeton, mot_de_passe } = req.body;

    if (!jeton) {
        return res.status(400).json({ error: "Jeton manquant." });
    }

    const manques = validerMotDePasse(mot_de_passe);
    if (manques.length > 0) {
        return res.status(400).json({
            error: "Le mot de passe ne respecte pas les exigences de sécurité.",
            manquant: manques,
        });
    }

    try {
        const ligne = await reinitialisation.verifierJeton(jeton);

        if (!ligne) {
            return res.status(400).json({
                error: "Ce lien est invalide, expiré, ou a déjà été utilisé.",
            });
        }

        const hashedPassword = await bcrypt.hash(mot_de_passe, 12);

        await db.query(
            'UPDATE utilisateurs SET mot_de_passe = $1 WHERE id = $2',
            [hashedPassword, ligne.utilisateur_id]
        );

        // Le jeton est consommé immédiatement : il ne pourra plus resservir.
        await reinitialisation.consommerJeton(ligne.id);

        // L'utilisateur est prévenu du changement, ce qui lui permet de réagir
        // si la demande ne venait pas de lui.
        await mail.envoyerConfirmationChangementMotDePasse({
            email: ligne.email, prenom: ligne.prenom,
        });

        res.status(200).json({
            message: "Votre mot de passe a bien été modifié. Vous pouvez maintenant vous connecter.",
        });
    } catch (error) {
        console.error("Erreur lors de la réinitialisation du mot de passe :", error);
        res.status(500).json({ error: "Une erreur interne est survenue." });
    }
};

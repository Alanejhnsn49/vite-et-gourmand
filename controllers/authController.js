const db = require('../config/db');
const bcrypt = require('bcrypt');

// 1. INSCRIPTION
exports.register = async (req, res) => {
    const { nom, prenom, email, mot_de_passe, telephone, adresse_facturation } = req.body;

    try {
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
        const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!match) {
            return res.status(401).json({ error: "Identifiants incorrects." });
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
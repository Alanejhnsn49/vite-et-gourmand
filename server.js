const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();

const db = require('./config/db');
const mongo = require('./config/mongo');
const mail = require('./services/mailService');

const app = express();
const PORT = process.env.PORT || 3000;

// En production, l'application tourne derrière le reverse proxy de
// l'hébergeur. Sans cette ligne, Express voit une connexion HTTP interne et
// refuse d'émettre un cookie marqué "secure", ce qui casse silencieusement
// l'authentification une fois en ligne.
const EN_PRODUCTION = process.env.NODE_ENV === 'production';
if (EN_PRODUCTION) {
    app.set('trust proxy', 1);
}

// Importation des routes
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const menuRoutes = require('./routes/menus');
const analyticsRoutes = require('./routes/analytics');
const contactRoutes = require('./routes/contact');
const userRoutes = require('./routes/users');
const avisRoutes = require('./routes/avis');
const catalogueRoutes = require('./routes/catalogue');

// Middleware pour analyser les requêtes JSON et de formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Permet à Express de servir automatiquement vos fichiers HTML, CSS et JS
app.use(express.static('public'));

// Configuration sécurisée des sessions (Recommandations OWASP / MDN)
//
// Les sessions sont stockées dans PostgreSQL, et non en mémoire du processus.
// Le stockage par défaut d'express-session perd toutes les sessions au moindre
// redémarrage, ce qui déconnecte les utilisateurs à chaque déploiement, et ne
// fonctionne pas du tout dès que l'application tourne sur plusieurs instances,
// chacune ayant sa propre mémoire.
app.use(session({
    store: new pgSession({
        pool: db,
        tableName: 'sessions',
        // La table est créée au premier démarrage si elle n'existe pas, ce qui
        // évite une étape manuelle lors du déploiement.
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,      // Empêche l'accès au cookie via JavaScript (protection XSS)
        secure: EN_PRODUCTION, // Cookie transmis uniquement en HTTPS une fois en ligne
        maxAge: 1000 * 60 * 60 * 24, // Session de 24 heures
        sameSite: 'strict'   // Protection contre les failles CSRF
    }
}));

// Association des routes à l'application
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/avis', avisRoutes);
app.use('/api/catalogue', catalogueRoutes);

// Route de test d'API
app.get('/api/status', (req, res) => {
    res.json({ status: "En ligne", message: "Serveur Vite & Gourmand opérationnel." });
});

/**
 * GET /api/health
 *
 * Sonde de santé destinée à l'hébergeur. Contrairement à /api/status, qui se
 * contente de prouver que le processus répond, celle-ci vérifie que les deux
 * bases sont réellement joignables.
 *
 * Un hébergeur qui interroge cette route redémarre l'instance si elle échoue,
 * plutôt que de laisser tourner une application incapable de servir la moindre
 * page utile.
 */
app.get('/api/health', async (req, res) => {
    const etat = { serveur: 'ok', postgresql: 'ko', mongodb: 'ko' };

    try {
        await db.query('SELECT 1');
        etat.postgresql = 'ok';
    } catch (error) {
        etat.erreur_postgresql = error.message;
    }

    try {
        const base = mongo.getDb();
        if (base) {
            await base.command({ ping: 1 });
            etat.mongodb = 'ok';
        }
    } catch (error) {
        etat.erreur_mongodb = error.message;
    }

    // MongoDB ne porte que l'analytique : son indisponibilité dégrade l'espace
    // administrateur mais n'empêche pas de vendre. PostgreSQL, lui, est vital.
    const codeHttp = etat.postgresql === 'ok' ? 200 : 503;
    res.status(codeHttp).json(etat);
});

// Démarrage du serveur
// La connexion MongoDB est établie avant l'écoute HTTP, afin que les
// index analytiques soient prêts dès la première requête.
Promise.all([mongo.connect(), mail.verifierConnexion()]).then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
        if (EN_PRODUCTION) {
            console.log('   Mode production : cookies sécurisés et proxy de confiance activés.');
        }
    });
});

// Fermeture propre des connexions à l'arrêt du conteneur.
// L'hébergeur envoie SIGTERM avant de couper une instance : sans cette
// gestion, les connexions restent ouvertes côté base jusqu'à expiration.
process.on('SIGTERM', async () => {
    console.log('Arrêt demandé, fermeture des connexions...');
    await mongo.close();
    await db.end();
    process.exit(0);
});

const express = require('express');
const session = require('express-session');
require('dotenv').config();

const mongo = require('./config/mongo');
const mail = require('./services/mailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Importation des routes
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const menuRoutes = require('./routes/menus');
const analyticsRoutes = require('./routes/analytics');
const contactRoutes = require('./routes/contact');
const userRoutes = require('./routes/users');
const avisRoutes = require('./routes/avis');

// Middleware pour analyser les requêtes JSON et de formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Permet à Express de servir automatiquement vos fichiers HTML, CSS et JS
app.use(express.static('public'));

// Configuration sécurisée des sessions (Recommandations OWASP / MDN)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Empêche l'accès aux cookies via JS (Protection XSS)
        secure: false,  // Mettre à 'true' en production avec HTTPS
        maxAge: 1000 * 60 * 60 * 24, // Session de 24 heures
        sameSite: 'strict' // Protection contre les failles CSRF
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

// Route de test d'API
app.get('/api/status', (req, res) => {
    res.json({ status: "En ligne", message: "Serveur Vite & Gourmand opérationnel." });
});

// Démarrage du serveur
// La connexion MongoDB est établie avant l'écoute HTTP, afin que les
// index analytiques soient prêts dès la première requête.
Promise.all([mongo.connect(), mail.verifierConnexion()]).then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    });
});

// Fermeture propre des connexions à l'arrêt du conteneur.
process.on('SIGTERM', async () => {
    await mongo.close();
    process.exit(0);
});
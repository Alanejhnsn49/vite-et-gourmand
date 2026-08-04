const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');

// Définition des routes d'authentification
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', isAuthenticated, authController.getMe);

// Réinitialisation de mot de passe.
// Ces trois routes sont nécessairement publiques : un utilisateur qui a perdu
// son mot de passe ne peut pas être authentifié.
router.post('/mot-de-passe-oublie', authController.demanderReinitialisation);
router.get('/reinitialisation/:jeton', authController.verifierLienReinitialisation);
router.post('/reinitialiser', authController.reinitialiserMotDePasse);

module.exports = router;

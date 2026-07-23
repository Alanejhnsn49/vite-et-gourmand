const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Définition des routes d'authentification
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.register); // Note : remplacez par la ligne ci-dessous :
router.get('/me', authController.getMe);
module.exports = router;
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated, hasRole } = require('../middleware/auth');

router.use(isAuthenticated);

// Compte de la personne connectee.
router.patch('/moi', userController.modifierMonProfil);

// Gestion des comptes, reservee a l'administrateur.
router.get('/', hasRole(['admin']), userController.listerUtilisateurs);
router.post('/employes', hasRole(['admin']), userController.creerEmploye);
router.patch('/:id/actif', hasRole(['admin']), userController.changerActivation);

module.exports = router;

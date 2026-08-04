const express = require('express');
const router = express.Router();
const avisController = require('../controllers/avisController');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Route publique : la page d'accueil affiche les avis validés.
router.get('/', avisController.getAvisPublics);

// File de modération, déclarée avant les routes paramétrées.
router.get('/moderation', isAuthenticated, hasRole(['employe', 'admin']), avisController.getFileModeration);

// Dépôt d'un avis par un client sur sa propre commande terminée.
router.post('/', isAuthenticated, avisController.deposerAvis);

// Validation ou refus par un employé ou un administrateur.
router.patch('/:id/moderation', isAuthenticated, hasRole(['employe', 'admin']), avisController.modererAvis);

module.exports = router;

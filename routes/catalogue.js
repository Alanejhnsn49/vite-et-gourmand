const express = require('express');
const router = express.Router();
const catalogueController = require('../controllers/catalogueController');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Route publique : le pied de page affiche les horaires à tout visiteur.
router.get('/horaires', catalogueController.getHoraires);

// Tout le reste est réservé au personnel.
// Le cahier des charges précise que les menus "doivent être configurables
// depuis l'espace Administrateur ainsi que Employé".
router.use(isAuthenticated, hasRole(['employe', 'admin']));

router.post('/menus', catalogueController.creerMenu);
router.patch('/menus/:id', catalogueController.modifierMenu);
router.delete('/menus/:id', catalogueController.supprimerMenu);
router.put('/menus/:id/plats', catalogueController.definirComposition);

router.get('/plats', catalogueController.listerPlats);
router.post('/plats', catalogueController.creerPlat);
router.delete('/plats/:id', catalogueController.supprimerPlat);

router.patch('/horaires/:jour', catalogueController.modifierHoraire);

module.exports = router;

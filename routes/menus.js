const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Routes publiques : le cahier des charges precise que la vue globale des
// menus "doit etre disponible pour les personnes non authentifiees comme
// authentifiees".
router.get('/', menuController.getAllMenus);
router.get('/:id', menuController.getMenuById);

module.exports = router;

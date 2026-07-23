const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Route publique : n'importe qui peut voir les menus disponibles
router.get('/', menuController.getAllMenus);

module.exports = router;
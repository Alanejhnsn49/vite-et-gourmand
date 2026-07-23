const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated } = require('../middleware/auth');

// Route sécurisée : l'utilisateur doit être connecté pour passer commande
router.post('/create', isAuthenticated, orderController.createOrder);

module.exports = router;
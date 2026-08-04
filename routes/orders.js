const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated } = require('../middleware/auth');

// Simulation tarifaire : renvoie le détail du prix sans rien enregistrer.
// Permet au front d'afficher la vue détaillée du prix avant validation.
router.post('/simuler', isAuthenticated, orderController.simulateOrder);

// Route sécurisée : l'utilisateur doit être connecté pour passer commande
router.post('/create', isAuthenticated, orderController.createOrder);

module.exports = router;
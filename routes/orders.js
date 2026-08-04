const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Toutes les routes de ce fichier exigent une session valide.
router.use(isAuthenticated);

// ---------------------------------------------------------------------------
// Espace employe et administrateur
//
// Declare avant les routes parametrees : sans cela, Express ferait
// correspondre "mes-commandes" au motif "/:id".
// ---------------------------------------------------------------------------
router.get('/', hasRole(['employe', 'admin']), orderController.listerCommandes);

// ---------------------------------------------------------------------------
// Espace client
// ---------------------------------------------------------------------------
router.get('/mes-commandes', orderController.getMesCommandes);

// Simulation tarifaire : renvoie le detail du prix sans rien enregistrer.
// Permet au front d'afficher la vue detaillee du prix avant validation.
router.post('/simuler', orderController.simulateOrder);

router.post('/create', orderController.createOrder);

// Le controle de propriete est fait dans le controleur : un client ne peut
// agir que sur ses propres commandes, un membre du personnel sur toutes.
router.get('/:id/suivi', orderController.getSuivi);
router.post('/:id/annuler', orderController.annulerParClient);
router.patch('/:id', orderController.modifierParClient);

// Changement de statut : reserve au personnel.
router.patch('/:id/statut', hasRole(['employe', 'admin']), orderController.changerStatut);

module.exports = router;

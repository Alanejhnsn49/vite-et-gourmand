const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// Route publique : un visiteur non authentifie doit pouvoir contacter
// l'entreprise, conformement au cahier des charges.
router.post('/', contactController.envoyerMessage);

module.exports = router;

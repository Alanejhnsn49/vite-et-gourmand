const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { isAuthenticated, hasRole } = require('../middleware/auth');

// Ces routes exposent des indicateurs commerciaux : elles sont reservees
// a l'administrateur. isAuthenticated verifie la session, hasRole verifie
// le role stocke en session cote serveur, jamais une valeur envoyee par le
// client.
router.use(isAuthenticated, hasRole(['admin']));

router.get('/menus', analyticsController.getStatistiquesParMenu);
router.get('/chiffre-affaires', analyticsController.getChiffreAffaires);
router.get('/evolution', analyticsController.getEvolution);

module.exports = router;

// Vérifie si l'utilisateur est connecté
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ error: "Accès refusé. Veuillez vous connecter." });
};

// Vérifie si l'utilisateur possède un rôle spécifique (ex: 'admin' ou 'employe')
const hasRole = (roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userRole || !roles.includes(req.session.userRole)) {
            return res.status(403).json({ error: "Accès interdit. Privilèges insuffisants." });
        }
        next();
    };
};

module.exports = { isAuthenticated, hasRole };
const crypto = require('crypto');
const db = require('../config/db');

/**
 * Composant metier : reinitialisation de mot de passe par lien a duree limitee.
 *
 * Principes de securite appliques :
 *
 * 1. Le jeton est genere avec crypto.randomBytes, un generateur
 *    cryptographiquement sur. Math.random est previsible et ne doit jamais
 *    servir a produire un secret.
 *
 * 2. Seule l'empreinte SHA-256 du jeton est stockee. Le jeton en clair
 *    n'existe que dans le lien envoye par email. Une fuite de la base ne
 *    permet donc pas de reinitialiser un compte.
 *
 * 3. Le jeton expire au bout d'une heure et ne peut servir qu'une fois.
 *
 * 4. Toute nouvelle demande invalide les jetons precedents du meme compte,
 *    afin qu'un lien ancien reste inutilisable.
 */

// Duree de validite du lien, en minutes.
const DUREE_VALIDITE_MINUTES = 60;

// 32 octets aleatoires, soit 64 caracteres hexadecimaux : impossible a deviner.
const TAILLE_JETON_OCTETS = 32;

/**
 * Calcule l'empreinte stockee en base a partir d'un jeton en clair.
 * SHA-256 suffit ici : contrairement a un mot de passe, un jeton de 32 octets
 * aleatoires n'est pas attaquable par dictionnaire.
 */
function hacherJeton(jeton) {
    return crypto.createHash('sha256').update(jeton).digest('hex');
}

/**
 * Cree un jeton pour un utilisateur et invalide les precedents.
 * Renvoie le jeton EN CLAIR, a inserer dans le lien envoye par email.
 * Il n'est plus jamais accessible ensuite.
 */
async function creerJeton(utilisateurId) {
    // Les demandes precedentes non utilisees sont marquees consommees :
    // un seul lien valide a la fois par compte.
    await db.query(
        `UPDATE reinitialisations_mot_de_passe
            SET date_utilisation = CURRENT_TIMESTAMP
          WHERE utilisateur_id = $1 AND date_utilisation IS NULL`,
        [utilisateurId]
    );

    const jeton = crypto.randomBytes(TAILLE_JETON_OCTETS).toString('hex');
    const jetonHache = hacherJeton(jeton);

    const expiration = new Date(Date.now() + DUREE_VALIDITE_MINUTES * 60 * 1000);

    await db.query(
        `INSERT INTO reinitialisations_mot_de_passe (utilisateur_id, jeton_hache, date_expiration)
         VALUES ($1, $2, $3)`,
        [utilisateurId, jetonHache, expiration]
    );

    return { jeton, expiration };
}

/**
 * Verifie un jeton presente par un utilisateur.
 * Renvoie la ligne correspondante si le jeton est valide, null sinon.
 *
 * La verification porte sur l'empreinte : le jeton en clair transmis par le
 * navigateur n'est jamais compare a une valeur stockee en clair.
 */
async function verifierJeton(jeton) {
    if (typeof jeton !== 'string' || jeton.length !== TAILLE_JETON_OCTETS * 2) {
        return null;
    }

    const resultat = await db.query(
        `SELECT r.id, r.utilisateur_id, u.email, u.prenom
           FROM reinitialisations_mot_de_passe r
           JOIN utilisateurs u ON u.id = r.utilisateur_id
          WHERE r.jeton_hache = $1
            AND r.date_utilisation IS NULL
            AND r.date_expiration > CURRENT_TIMESTAMP`,
        [hacherJeton(jeton)]
    );

    return resultat.rows.length > 0 ? resultat.rows[0] : null;
}

/**
 * Marque un jeton comme consomme. Appele une fois le mot de passe change.
 */
async function consommerJeton(jetonId) {
    await db.query(
        `UPDATE reinitialisations_mot_de_passe
            SET date_utilisation = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [jetonId]
    );
}

/**
 * Supprime les jetons expires ou consommes depuis plus de 24 heures.
 * Evite que la table croisse indefiniment.
 */
async function purger() {
    const resultat = await db.query(
        `DELETE FROM reinitialisations_mot_de_passe
          WHERE date_expiration < CURRENT_TIMESTAMP - INTERVAL '24 hours'
             OR date_utilisation < CURRENT_TIMESTAMP - INTERVAL '24 hours'`
    );
    return resultat.rowCount;
}

module.exports = {
    creerJeton,
    verifierJeton,
    consommerJeton,
    purger,
    DUREE_VALIDITE_MINUTES,
};

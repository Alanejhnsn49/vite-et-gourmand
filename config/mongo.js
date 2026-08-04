const { MongoClient } = require('mongodb');
require('dotenv').config();

/**
 * Connexion a la base non relationnelle MongoDB.
 *
 * Pourquoi une seconde base ?
 * PostgreSQL porte les donnees transactionnelles : utilisateurs, menus,
 * commandes. Elles exigent des contraintes d'integrite fortes et un schema
 * stable.
 * MongoDB porte les donnees analytiques : un evenement est ecrit a chaque
 * commande passee. Ces documents sont nombreux, jamais modifies apres coup,
 * et leur structure doit pouvoir evoluer sans migration. C'est exactement
 * le cas d'usage d'une base orientee documents.
 */

const MONGO_URL = process.env.MONGO_URL;
const MONGO_DB = process.env.MONGO_DB || 'vite_gourmand_analytics';

// Le client MongoDB gere lui-meme un pool de connexions.
// On l'instancie une seule fois pour toute la duree de vie du serveur.
const client = new MongoClient(MONGO_URL, {
    serverSelectionTimeoutMS: 5000,
});

let db = null;

/**
 * Etablit la connexion et prepare les index.
 * Appelee une fois au demarrage du serveur.
 */
async function connect() {
    try {
        await client.connect();
        db = client.db(MONGO_DB);

        // Index sur les champs interroges par les agregations de l'espace
        // administrateur. Sans index, chaque filtre par date ou par menu
        // provoquerait un parcours complet de la collection.
        await db.collection('evenements_commandes').createIndex({ menu_id: 1 });
        await db.collection('evenements_commandes').createIndex({ date_commande: -1 });

        console.log('✅ Connexion à la base de données MongoDB réussie.');
        return db;
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données MongoDB :', error.message);
        // On ne fait pas tomber le serveur : l'application reste utilisable
        // sans analytique, seul l'espace administrateur sera degrade.
        return null;
    }
}

/**
 * Retourne l'instance de base. Null tant que connect() n'a pas abouti.
 */
function getDb() {
    return db;
}

/**
 * Ferme proprement la connexion, appelee a l'arret du serveur.
 */
async function close() {
    await client.close();
    db = null;
}

module.exports = { connect, getDb, close };

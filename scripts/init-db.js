#!/usr/bin/env node

/**
 * Initialisation de la base de données relationnelle.
 *
 * En développement, docker-compose monte schema.sql et seed.sql dans
 * /docker-entrypoint-initdb.d, et PostgreSQL les exécute tout seul au premier
 * démarrage du conteneur.
 *
 * Un PostgreSQL managé (Render, Fly, Neon, Railway) n'a pas ce mécanisme :
 * la base est fournie vide. Ce script joue les mêmes fichiers, dans le même
 * ordre, contre la DATABASE_URL de l'environnement.
 *
 * Usage :
 *   npm run db:init          structure seule
 *   npm run db:seed          structure + jeu de démonstration
 *
 * Attention : schema.sql commence par des DROP TABLE. Le script refuse donc
 * de s'exécuter sur une base contenant déjà des commandes, sauf confirmation
 * explicite par --force.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const RACINE = path.join(__dirname, '..');
const avecDonnees = process.argv.includes('--seed');
const forcer = process.argv.includes('--force');

/**
 * Recopie les commandes du jeu de démonstration dans MongoDB.
 *
 * `seed.sql` alimente uniquement PostgreSQL. Sans cette étape, l'espace
 * administrateur d'une installation fraîche afficherait un graphique vide,
 * alors que des commandes existent bel et bien en base relationnelle.
 *
 * En fonctionnement normal, ces événements sont écrits au fil de l'eau à
 * chaque commande passée. Ici, on les rejoue une fois pour que la
 * démonstration soit cohérente dès le premier démarrage.
 */
async function alimenterAnalytique(pool) {
    if (!process.env.MONGO_URL) {
        console.log('   MONGO_URL absente : analytique non alimentée.');
        return;
    }

    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 });

    try {
        await client.connect();
        const base = client.db(process.env.MONGO_DB || 'vite_gourmand_analytics');
        const collection = base.collection('evenements_commandes');

        const commandes = await pool.query(`
            SELECT c.id, c.menu_id, c.utilisateur_id, c.nombre_convives,
                   c.total_ttc, c.ville_livraison, c.date_commande,
                   m.titre AS menu_titre, m.theme AS menu_theme
              FROM commandes c
              JOIN menus m ON m.id = c.menu_id
             WHERE c.statut <> 'annulee'
        `);

        if (commandes.rows.length === 0) {
            console.log('   Aucune commande à reporter dans l\'analytique.');
            return;
        }

        // La collection est vidée pour rester alignée sur le jeu relationnel
        // qui vient d'être rechargé.
        await collection.deleteMany({});

        await collection.insertMany(commandes.rows.map(c => ({
            commande_id: c.id,
            menu_id: c.menu_id,
            menu_titre: c.menu_titre,
            menu_theme: c.menu_theme,
            utilisateur_id: c.utilisateur_id,
            nombre_convives: c.nombre_convives,
            montant_ttc: parseFloat(c.total_ttc),
            ville_livraison: c.ville_livraison,
            date_commande: new Date(c.date_commande),
        })));

        await collection.createIndex({ menu_id: 1 });
        await collection.createIndex({ date_commande: -1 });

        console.log(`✅ Analytique alimentée : ${commandes.rows.length} événement(s) dans MongoDB.`);
    } catch (error) {
        // L'analytique est secondaire : son échec ne doit pas faire échouer
        // l'initialisation de la base relationnelle.
        console.warn('⚠️  Analytique non alimentée :', error.message);
    } finally {
        await client.close();
    }
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL n\'est pas définie.');
        process.exit(1);
    }

    // Les PostgreSQL managés imposent TLS, et présentent souvent un certificat
    // que Node ne peut pas valider seul. On l'accepte uniquement hors du
    // réseau Docker local, où la connexion ne sort jamais de la machine.
    const distant = !/@(db|localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: distant ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('Connexion à la base...');
        await pool.query('SELECT 1');

        // Garde-fou : ne jamais écraser une base qui contient de vraies ventes.
        if (!forcer) {
            const existe = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = 'commandes'
                ) AS presente
            `);

            if (existe.rows[0].presente) {
                const compte = await pool.query('SELECT COUNT(*)::int AS total FROM commandes');
                if (compte.rows[0].total > 0) {
                    console.error(
                        `❌ Cette base contient déjà ${compte.rows[0].total} commande(s).\n` +
                        '   schema.sql commence par des DROP TABLE : les exécuter détruirait ces données.\n' +
                        '   Relancez avec --force si c\'est réellement ce que vous voulez.'
                    );
                    process.exit(1);
                }
            }
        }

        const fichiers = ['database/schema.sql'];
        if (avecDonnees) fichiers.push('database/seed.sql');

        for (const relatif of fichiers) {
            const chemin = path.join(RACINE, relatif);
            console.log(`Exécution de ${relatif}...`);
            const sql = fs.readFileSync(chemin, 'utf8');
            await pool.query(sql);
            console.log(`  ✅ ${relatif}`);
        }

        const tables = await pool.query(`
            SELECT COUNT(*)::int AS total FROM information_schema.tables
             WHERE table_schema = 'public'
        `);
        console.log(`\n✅ Base relationnelle initialisée : ${tables.rows[0].total} tables.`);

        if (!avecDonnees) {
            console.log('   Jeu de démonstration non chargé. Utilisez npm run db:seed pour l\'ajouter.');
        } else {
            await alimenterAnalytique(pool);
        }
    } catch (error) {
        console.error('❌ Échec de l\'initialisation :', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();

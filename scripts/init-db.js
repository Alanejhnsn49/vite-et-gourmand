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
        console.log(`\n✅ Base initialisée : ${tables.rows[0].total} tables.`);

        if (!avecDonnees) {
            console.log('   Jeu de démonstration non chargé. Utilisez npm run db:seed pour l\'ajouter.');
        }
    } catch (error) {
        console.error('❌ Échec de l\'initialisation :', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();

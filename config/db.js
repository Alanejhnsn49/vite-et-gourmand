const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test de connexion à la base de données
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données PostgreSQL :', err.message);
  } else {
    console.log('✅ Connexion à la base de données PostgreSQL réussie.');
  }
});

module.exports = pool;
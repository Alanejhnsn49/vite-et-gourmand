-- ============================================================================
-- 1. NETTOYAGE DE LA BASE (Pour réinitialisation en local)
-- ============================================================================
DROP TABLE IF EXISTS avis CASCADE;
DROP TABLE IF EXISTS commandes CASCADE;
DROP TABLE IF EXISTS menus CASCADE;
DROP TABLE IF EXISTS utilisateurs CASCADE;

-- ============================================================================
-- 2. TABLE : UTILISATEURS
-- ============================================================================
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(50) NOT NULL,
    prenom VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL, -- Sera stocké haché (ex: bcrypt)
    telephone VARCHAR(20) NOT NULL,
    adresse_facturation TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'client',
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Sécurité : Limitation stricte des rôles applicatifs
    CONSTRAINT chk_role CHECK (role IN ('client', 'employe', 'admin'))
);

-- ============================================================================
-- 3. TABLE : MENUS
-- ============================================================================
CREATE TABLE menus (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    images TEXT NOT NULL, -- URLs stockées sous forme de texte (séparées par des virgules)
    theme VARCHAR(50) NOT NULL,
    regime VARCHAR(50) NOT NULL,
    min_personnes INT NOT NULL,
    prix_min DECIMAL(10, 2) NOT NULL, -- Prix forfaitaire pour le nombre min de personnes
    stock INT NOT NULL DEFAULT 0,
    conditions TEXT NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contraintes de cohérence métier
    CONSTRAINT chk_min_personnes CHECK (min_personnes > 0),
    CONSTRAINT chk_prix_min CHECK (prix_min >= 0.00),
    CONSTRAINT chk_stock CHECK (stock >= 0),
    CONSTRAINT chk_theme CHECK (theme IN ('classique', 'noel', 'paques', 'evenement')),
    CONSTRAINT chk_regime CHECK (regime IN ('classique', 'vegetarien', 'vegan', 'sans-gluten'))
);

-- ============================================================================
-- 4. TABLE : COMMANDES
-- ============================================================================
CREATE TABLE commandes (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    menu_id INT NOT NULL,
    date_commande TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_prestation DATE NOT NULL,
    heure_prestation TIME NOT NULL,
    adresse_livraison TEXT NOT NULL,
    ville_livraison VARCHAR(100) NOT NULL,
    distance_km DECIMAL(5, 2) DEFAULT 0.00, -- Utilisé si hors-Bordeaux
    nombre_convives INT NOT NULL,
    total_ttc DECIMAL(10, 2) NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'attente',
    motif_annulation TEXT, -- Renseigné si l'employé annule/modifie
    canal_contact VARCHAR(20), -- Renseigné si l'employé annule/modifie ('gsm' ou 'mail')
    
    -- Clés étrangères
    CONSTRAINT fk_commande_utilisateur FOREIGN KEY (utilisateur_id) 
        REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_commande_menu FOREIGN KEY (menu_id) 
        REFERENCES menus(id) ON DELETE RESTRICT,
        
    -- Contraintes de cohérence métier
    CONSTRAINT chk_convives CHECK (nombre_convives > 0),
    CONSTRAINT chk_total CHECK (total_ttc >= 0.00),
    CONSTRAINT chk_statut CHECK (statut IN ('attente', 'accepte', 'prep', 'livraison', 'livre', 'retour', 'terminee', 'annulee')),
    CONSTRAINT chk_contact CHECK (canal_contact IN ('gsm', 'mail', NULL))
);

-- ============================================================================
-- 5. TABLE : AVIS
-- ============================================================================
CREATE TABLE avis (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    commande_id INT NOT NULL UNIQUE, -- Un seul avis par commande
    note INT NOT NULL,
    commentaire TEXT NOT NULL,
    statut_moderation VARCHAR(20) NOT NULL DEFAULT 'en_attente',
    date_publication TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Clés étrangères
    CONSTRAINT fk_avis_utilisateur FOREIGN KEY (utilisateur_id) 
        REFERENCES utilisateurs(id) ON DELETE CASCADE,
    CONSTRAINT fk_avis_commande FOREIGN KEY (commande_id) 
        REFERENCES commandes(id) ON DELETE CASCADE,
        
    -- Contraintes de cohérence métier
    CONSTRAINT chk_note CHECK (note BETWEEN 1 AND 5),
    CONSTRAINT chk_moderation CHECK (statut_moderation IN ('en_attente', 'valide', 'refuse'))
);
-- ============================================================================
-- JETONS DE REINITIALISATION DE MOT DE PASSE
--
-- Le jeton en clair n'est JAMAIS stocke : seule son empreinte SHA-256 l'est.
-- Si la base fuite, les jetons deja emis restent inexploitables, exactement
-- comme pour les mots de passe.
--
-- Chaque jeton a une duree de vie limitee et ne peut servir qu'une seule fois.
-- ============================================================================
CREATE TABLE reinitialisations_mot_de_passe (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT NOT NULL,
    jeton_hache CHAR(64) NOT NULL UNIQUE,
    date_expiration TIMESTAMP NOT NULL,
    date_utilisation TIMESTAMP,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_reinit_utilisateur FOREIGN KEY (utilisateur_id)
        REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- Recherche par empreinte a chaque tentative de reinitialisation.
CREATE INDEX idx_reinit_jeton ON reinitialisations_mot_de_passe (jeton_hache);

-- Invalidation des jetons precedents d'un utilisateur lors d'une nouvelle demande.
CREATE INDEX idx_reinit_utilisateur ON reinitialisations_mot_de_passe (utilisateur_id);

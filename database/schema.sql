-- ============================================================================
-- 1. NETTOYAGE DE LA BASE (Pour réinitialisation)
--
-- L'ordre suit les dépendances : les tables de liaison et les tables filles
-- d'abord, les tables mères ensuite. CASCADE rend cet ordre théorique, mais
-- l'expliciter documente le modèle.
--
-- Toute nouvelle table doit être ajoutée ici, faute de quoi le script ne peut
-- plus être rejoué sur une base existante.
--
-- La table "sessions" n'y figure pas volontairement : elle est créée et gérée
-- par connect-pg-simple, indépendamment du modèle métier.
-- ============================================================================
DROP TABLE IF EXISTS suivi_commandes CASCADE;
DROP TABLE IF EXISTS reinitialisations_mot_de_passe CASCADE;
DROP TABLE IF EXISTS plats_allergenes CASCADE;
DROP TABLE IF EXISTS menus_plats CASCADE;
DROP TABLE IF EXISTS allergenes CASCADE;
DROP TABLE IF EXISTS plats CASCADE;
DROP TABLE IF EXISTS horaires CASCADE;
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

    -- Un compte n'est jamais supprimé, il est rendu inutilisable.
    -- Cahier des charges : "il doit être possible également de rendre
    -- inutilisable un compte employé en cas de départ de l'entreprise".
    -- Une suppression casserait les clés étrangères des commandes passées
    -- et ferait disparaître l'historique commercial.
    actif BOOLEAN NOT NULL DEFAULT TRUE,

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

-- ============================================================================
-- PLATS, ALLERGENES ET COMPOSITION DES MENUS
--
-- Le cahier des charges precise qu'un menu comporte "une liste de plat
-- possible (entree, plat ainsi que dessert)", que "chaque plat peut posseder
-- une liste d'allergenes" et qu'"une entree ou un plat / dessert peuvent etre
-- present dans plusieurs menus".
--
-- Cette derniere phrase impose une relation plusieurs-a-plusieurs entre les
-- menus et les plats : un plat est donc une entite autonome, jamais dupliquee
-- d'un menu a l'autre. Meme raisonnement entre les plats et les allergenes.
-- ============================================================================

CREATE TABLE plats (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(200) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL,
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_type_plat CHECK (type IN ('entree', 'plat', 'dessert'))
);

CREATE TABLE allergenes (
    id SERIAL PRIMARY KEY,
    libelle VARCHAR(80) NOT NULL UNIQUE
);

-- Table de liaison plats / allergenes.
-- La cle primaire composite empeche d'associer deux fois le meme allergene
-- au meme plat.
CREATE TABLE plats_allergenes (
    plat_id INT NOT NULL,
    allergene_id INT NOT NULL,

    PRIMARY KEY (plat_id, allergene_id),
    CONSTRAINT fk_pa_plat FOREIGN KEY (plat_id)
        REFERENCES plats(id) ON DELETE CASCADE,
    CONSTRAINT fk_pa_allergene FOREIGN KEY (allergene_id)
        REFERENCES allergenes(id) ON DELETE CASCADE
);

-- Table de liaison menus / plats.
CREATE TABLE menus_plats (
    menu_id INT NOT NULL,
    plat_id INT NOT NULL,

    PRIMARY KEY (menu_id, plat_id),
    CONSTRAINT fk_mp_menu FOREIGN KEY (menu_id)
        REFERENCES menus(id) ON DELETE CASCADE,
    CONSTRAINT fk_mp_plat FOREIGN KEY (plat_id)
        REFERENCES plats(id) ON DELETE CASCADE
);

-- Index sur les cles etrangeres interrogees lors de l'affichage d'un menu.
CREATE INDEX idx_menus_plats_plat ON menus_plats (plat_id);
CREATE INDEX idx_plats_allergenes_allergene ON plats_allergenes (allergene_id);

-- Index sur les colonnes servant aux filtres de la vue globale des menus.
CREATE INDEX idx_menus_theme ON menus (theme);
CREATE INDEX idx_menus_regime ON menus (regime);
CREATE INDEX idx_menus_prix ON menus (prix_min);

-- ============================================================================
-- HISTORIQUE DES STATUTS DE COMMANDE
--
-- Le cahier des charges exige que "le suivi de la commande enumere tous les
-- etats de sa commande suivi de la date et l'heure de modification".
--
-- La colonne commandes.statut porte l'etat courant, cette table porte
-- l'historique complet. Conserver les deux evite de recalculer l'etat
-- courant a chaque lecture, tout en gardant la tracabilite.
--
-- L'auteur du changement est conserve pour repondre a l'exigence de motif
-- et de canal de contact lors d'une annulation par un employe.
-- ============================================================================
CREATE TABLE suivi_commandes (
    id SERIAL PRIMARY KEY,
    commande_id INT NOT NULL,
    statut VARCHAR(30) NOT NULL,
    auteur_id INT,
    motif TEXT,
    canal_contact VARCHAR(20),
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_suivi_commande FOREIGN KEY (commande_id)
        REFERENCES commandes(id) ON DELETE CASCADE,
    CONSTRAINT fk_suivi_auteur FOREIGN KEY (auteur_id)
        REFERENCES utilisateurs(id) ON DELETE SET NULL,

    CONSTRAINT chk_suivi_statut CHECK (statut IN
        ('attente', 'accepte', 'prep', 'livraison', 'livre', 'retour', 'terminee', 'annulee')),
    CONSTRAINT chk_suivi_canal CHECK (canal_contact IS NULL OR canal_contact IN ('gsm', 'mail'))
);

-- Le suivi est toujours consulte pour une commande donnee, du plus ancien
-- au plus recent.
CREATE INDEX idx_suivi_commande ON suivi_commandes (commande_id, date_changement);

-- Index sur les colonnes de filtrage de l'espace employe.
CREATE INDEX idx_commandes_statut ON commandes (statut);
CREATE INDEX idx_commandes_utilisateur ON commandes (utilisateur_id);

-- ============================================================================
-- HORAIRES D'OUVERTURE
--
-- Cahier des charges : "les horaires doivent etre visible sur le pied de
-- page, du lundi au dimanche" et l'employe "peut modifier / supprimer les
-- menus, plats, et les horaires".
--
-- Les horaires etaient jusqu'ici ecrits en dur dans le HTML, donc non
-- modifiables depuis l'application.
--
-- jour_semaine suit la convention ISO : 1 = lundi, 7 = dimanche.
-- ============================================================================
CREATE TABLE horaires (
    id SERIAL PRIMARY KEY,
    jour_semaine INT NOT NULL UNIQUE,
    ferme BOOLEAN NOT NULL DEFAULT FALSE,
    heure_ouverture TIME,
    heure_fermeture TIME,

    CONSTRAINT chk_jour CHECK (jour_semaine BETWEEN 1 AND 7),

    -- Un jour ouvert doit porter ses deux horaires, un jour ferme n'en porte
    -- aucun. Sans cette contrainte, la base accepterait un jour ouvert sans
    -- heure d'ouverture.
    CONSTRAINT chk_coherence_horaires CHECK (
        (ferme = TRUE AND heure_ouverture IS NULL AND heure_fermeture IS NULL)
        OR
        (ferme = FALSE AND heure_ouverture IS NOT NULL AND heure_fermeture IS NOT NULL
         AND heure_fermeture > heure_ouverture)
    )
);

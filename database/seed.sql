-- ============================================================================
-- 1. INSERTION DES UTILISATEURS DE TEST (Mots de passe hachés fictifs)
-- ============================================================================
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, adresse_facturation, role) VALUES
-- Administrateur (José)
('Gomez', 'José', 'jose.admin@viteetgourmand.fr', '$2b$12$K3v9Z8vB9u8X7y6z5w4v3u2t1s0r9q8p7o6n5m4l3k2j1i0h9g8f7', '05 56 00 11 22', '123 rue de la Gastronomie, 33000 Bordeaux', 'admin'),

-- Employé (Pierre)
('Durand', 'Pierre', 'pierre.employe@viteetgourmand.fr', '$2b$12$Y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1h0g9f8e7d6c5b4a3', '06 99 88 77 66', '12 rue des Commis, 33100 Bordeaux', 'employe'),

-- Client de test (Jean Dupont)
('Dupont', 'Jean', 'jean.dupont@exemple.com', '$2b$12$Z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5', '06 12 34 56 78', '45 Cours de l''Intendance, 33000 Bordeaux', 'client');

-- ============================================================================
-- 2. INSERTION DES MENUS DE LA CARTE
-- ============================================================================
INSERT INTO menus (titre, description, images, theme, regime, min_personnes, prix_min, stock, conditions) VALUES
('Le Buffet Champêtre du Sud-Ouest', 
 'Un buffet convivial mettant à l''honneur les trésors culinaires de notre région, préparé avec soin par le chef José.', 
 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80,https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', 
 'classique', 'classique', 15, 290.00, 8, 
 'À commander au moins 5 jours ouvrés à l''avance. À conserver entre 0°C et 4°C.'),

('Éveil des Sens (Végétarien)', 
 'Une expérience gastronomique raffinée et 100% végétarienne conçue par la chef Julie autour des légumes de saison.', 
 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80,https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', 
 'evenement', 'vegetarien', 10, 380.00, 4, 
 'À commander au moins 4 jours ouvrés à l''avance. À consommer sous 24h après livraison.'),

('La Magie de Noël', 
 'Une formule féérique et haut de gamme pour vos repas de fin d''année en famille ou en entreprise.', 
 'https://images.unsplash.com/photo-1545048702-79362596cdc9?auto=format&fit=crop&w=800&q=80,https://images.unsplash.com/photo-1575549594211-8f3769c0966a?auto=format&fit=crop&w=800&q=80', 
 'noel', 'classique', 8, 480.00, 3, 
 'Disponible uniquement en décembre. Commande requise 2 semaines à l''avance.'),

('Douceurs de Pâques', 
 'Célébrez le printemps avec ce menu traditionnel revisité mettant en valeur l''agneau de lait et le chocolat.', 
 'https://images.unsplash.com/photo-1625604087024-7fb428fc4626?q=80&w=1170&auto=format&fit=crop', 
 'paques', 'classique', 6, 210.00, 5, 
 'Disponible pour la période de Pâques. Commande requise 7 jours à l''avance.'),

('Éclat Vegan & Sans Gluten', 
 'Un menu d''une grande finesse technique, entièrement végétalien et naturellement exempt de gluten.', 
 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', 
 'evenement', 'vegan', 12, 420.00, 6, 
 'À commander au moins 5 jours à l''avance. Préparé dans un atelier manipulant du gluten.');

-- ============================================================================
-- 3. INSERTION DE COMMANDES DE TEST
-- ============================================================================
INSERT INTO commandes (utilisateur_id, menu_id, date_prestation, heure_prestation, adresse_livraison, ville_livraison, distance_km, nombre_convives, total_ttc, statut) VALUES
-- Commande 1 : En attente de validation (Jean Dupont)
(3, 1, '2026-07-28', '12:00:00', '45 Cours de l''Intendance, 33000 Bordeaux', 'bordeaux', 0.00, 15, 290.00, 'attente'),

-- Commande 2 : En préparation (Jean Dupont)
(3, 2, '2026-07-29', '20:00:00', '45 Cours de l''Intendance, 33000 Bordeaux', 'bordeaux', 0.00, 10, 380.00, 'prep'),

-- Commande 3 : Terminée (Jean Dupont)
(3, 4, '2026-04-12', '13:00:00', '45 Cours de l''Intendance, 33000 Bordeaux', 'bordeaux', 0.00, 6, 210.00, 'terminee');

-- ============================================================================
-- 4. INSERTION D'AVIS CLIENTS
-- ============================================================================
INSERT INTO avis (utilisateur_id, commande_id, note, commentaire, statut_moderation) VALUES
-- Avis validé et visible sur l'accueil
(3, 3, 5, 'Prestation exceptionnelle pour notre repas de Pâques, les chocolats de Julie ont ravi toute la famille !', 'valide');
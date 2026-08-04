-- ============================================================================
-- 1. INSERTION DES UTILISATEURS DE DEMONSTRATION
--
-- Les mots de passe sont reellement haches avec bcrypt, cout 12, comme en
-- production. Ces comptes permettent de parcourir les trois roles de
-- l'application.
--
--   jose.admin@viteetgourmand.fr       Admin2026!      role admin
--   pierre.employe@viteetgourmand.fr   Employe2026!    role employe
--   jean.dupont@exemple.com            Client2026!     role client
--
-- Jeu de donnees reserve a la demonstration : ne jamais charger en production.
-- ============================================================================
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, adresse_facturation, role) VALUES
-- Administrateur (José)
('Gomez', 'José', 'jose.admin@viteetgourmand.fr', '$2b$12$sbVuO4BTkjoKrxdb82gkNOM79QbCjwTvLpxgvFcvXNdEd7zaA3zIO', '05 56 00 11 22', '123 rue de la Gastronomie, 33000 Bordeaux', 'admin'),

-- Employé (Pierre)
('Durand', 'Pierre', 'pierre.employe@viteetgourmand.fr', '$2b$12$B.1CzVRnfuQDZzKWx7xDjeoUJQccwJwNhLtR8aTb.Ggcy6SWxWpv6', '06 99 88 77 66', '12 rue des Commis, 33100 Bordeaux', 'employe'),

-- Client de test (Jean Dupont)
('Dupont', 'Jean', 'jean.dupont@exemple.com', '$2b$12$ezjtQhIILvdu41fE7LvJ2e/HFN2FP4o3PrHGDeRaALu5WAw.Xd75S', '06 12 34 56 78', '45 Cours de l''Intendance, 33000 Bordeaux', 'client');

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
-- ============================================================================
-- 5. ALLERGENES
-- ============================================================================
INSERT INTO allergenes (libelle) VALUES
    ('Fruits à coque'),
    ('Gluten'),
    ('Lactose'),
    ('Soja'),
    ('Sulfite'),
    ('Sésame'),
    ('Œufs');

-- ============================================================================
-- 6. PLATS
--
-- Chaque plat est declare une seule fois, meme lorsqu il apparait dans
-- plusieurs menus, conformement au cahier des charges.
-- ============================================================================
INSERT INTO plats (nom, type) VALUES
    ('Planche de charcuteries fines du terroir', 'entree'),
    ('Terrine de canard maison aux pistaches', 'entree'),
    ('Manchons de canard confits et pommes de terre sarladaises', 'plat'),
    ('Cannelés bordelais croustillants', 'dessert'),
    ('Velouté de potimarron aux éclats de châtaignes', 'entree'),
    ('Tartare de betterave et chèvre frais aux herbes', 'entree'),
    ('Risotto crémeux aux champignons sauvages et huile de truffe', 'plat'),
    ('Poire pochée au vin rouge épicé et glace vanille', 'dessert'),
    ('Foie gras de canard mi-cuit et son chutney de figues', 'entree'),
    ('Chapon farci aux marrons, écrasé de céleri-rave', 'plat'),
    ('Bûche signature au chocolat noir de dégustation', 'dessert'),
    ('Asperges vertes rôties, sauce mousseline légère', 'entree'),
    ('Gigot d''agneau de sept heures confit au romarin', 'plat'),
    ('Entremets nid de Pâques au praliné croustillant', 'dessert'),
    ('Maki de légumes croquants et avocat, sauce sésame', 'entree'),
    ('Curry thaï de légumes oubliés au lait de coco et riz basmati parfumé', 'plat'),
    ('Panna cotta végétale au lait d''amande et coulis de mangue', 'dessert');

-- ============================================================================
-- 7. ASSOCIATION DES ALLERGENES AUX PLATS
-- ============================================================================
INSERT INTO plats_allergenes (plat_id, allergene_id) VALUES
    ((SELECT id FROM plats WHERE nom = 'Planche de charcuteries fines du terroir'), (SELECT id FROM allergenes WHERE libelle = 'Sulfite')),
    ((SELECT id FROM plats WHERE nom = 'Terrine de canard maison aux pistaches'), (SELECT id FROM allergenes WHERE libelle = 'Fruits à coque')),
    ((SELECT id FROM plats WHERE nom = 'Terrine de canard maison aux pistaches'), (SELECT id FROM allergenes WHERE libelle = 'Sulfite')),
    ((SELECT id FROM plats WHERE nom = 'Cannelés bordelais croustillants'), (SELECT id FROM allergenes WHERE libelle = 'Gluten')),
    ((SELECT id FROM plats WHERE nom = 'Cannelés bordelais croustillants'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Cannelés bordelais croustillants'), (SELECT id FROM allergenes WHERE libelle = 'Œufs')),
    ((SELECT id FROM plats WHERE nom = 'Velouté de potimarron aux éclats de châtaignes'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Tartare de betterave et chèvre frais aux herbes'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Risotto crémeux aux champignons sauvages et huile de truffe'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Poire pochée au vin rouge épicé et glace vanille'), (SELECT id FROM allergenes WHERE libelle = 'Sulfite')),
    ((SELECT id FROM plats WHERE nom = 'Foie gras de canard mi-cuit et son chutney de figues'), (SELECT id FROM allergenes WHERE libelle = 'Sulfite')),
    ((SELECT id FROM plats WHERE nom = 'Chapon farci aux marrons, écrasé de céleri-rave'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Bûche signature au chocolat noir de dégustation'), (SELECT id FROM allergenes WHERE libelle = 'Gluten')),
    ((SELECT id FROM plats WHERE nom = 'Bûche signature au chocolat noir de dégustation'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Bûche signature au chocolat noir de dégustation'), (SELECT id FROM allergenes WHERE libelle = 'Soja')),
    ((SELECT id FROM plats WHERE nom = 'Asperges vertes rôties, sauce mousseline légère'), (SELECT id FROM allergenes WHERE libelle = 'Œufs')),
    ((SELECT id FROM plats WHERE nom = 'Entremets nid de Pâques au praliné croustillant'), (SELECT id FROM allergenes WHERE libelle = 'Gluten')),
    ((SELECT id FROM plats WHERE nom = 'Entremets nid de Pâques au praliné croustillant'), (SELECT id FROM allergenes WHERE libelle = 'Lactose')),
    ((SELECT id FROM plats WHERE nom = 'Entremets nid de Pâques au praliné croustillant'), (SELECT id FROM allergenes WHERE libelle = 'Fruits à coque')),
    ((SELECT id FROM plats WHERE nom = 'Maki de légumes croquants et avocat, sauce sésame'), (SELECT id FROM allergenes WHERE libelle = 'Sésame')),
    ((SELECT id FROM plats WHERE nom = 'Panna cotta végétale au lait d''amande et coulis de mangue'), (SELECT id FROM allergenes WHERE libelle = 'Fruits à coque'));

-- ============================================================================
-- 8. COMPOSITION DES MENUS
-- ============================================================================
INSERT INTO menus_plats (menu_id, plat_id) VALUES
    (1, (SELECT id FROM plats WHERE nom = 'Planche de charcuteries fines du terroir')),
    (1, (SELECT id FROM plats WHERE nom = 'Terrine de canard maison aux pistaches')),
    (1, (SELECT id FROM plats WHERE nom = 'Manchons de canard confits et pommes de terre sarladaises')),
    (1, (SELECT id FROM plats WHERE nom = 'Cannelés bordelais croustillants')),
    (2, (SELECT id FROM plats WHERE nom = 'Velouté de potimarron aux éclats de châtaignes')),
    (2, (SELECT id FROM plats WHERE nom = 'Tartare de betterave et chèvre frais aux herbes')),
    (2, (SELECT id FROM plats WHERE nom = 'Risotto crémeux aux champignons sauvages et huile de truffe')),
    (2, (SELECT id FROM plats WHERE nom = 'Poire pochée au vin rouge épicé et glace vanille')),
    (3, (SELECT id FROM plats WHERE nom = 'Foie gras de canard mi-cuit et son chutney de figues')),
    (3, (SELECT id FROM plats WHERE nom = 'Chapon farci aux marrons, écrasé de céleri-rave')),
    (3, (SELECT id FROM plats WHERE nom = 'Bûche signature au chocolat noir de dégustation')),
    (4, (SELECT id FROM plats WHERE nom = 'Asperges vertes rôties, sauce mousseline légère')),
    (4, (SELECT id FROM plats WHERE nom = 'Gigot d''agneau de sept heures confit au romarin')),
    (4, (SELECT id FROM plats WHERE nom = 'Entremets nid de Pâques au praliné croustillant')),
    (5, (SELECT id FROM plats WHERE nom = 'Maki de légumes croquants et avocat, sauce sésame')),
    (5, (SELECT id FROM plats WHERE nom = 'Curry thaï de légumes oubliés au lait de coco et riz basmati parfumé')),
    (5, (SELECT id FROM plats WHERE nom = 'Panna cotta végétale au lait d''amande et coulis de mangue'));

-- ============================================================================
-- 9. PLATS PARTAGES ENTRE PLUSIEURS MENUS
--
-- Le cahier des charges precise qu'"une entree ou un plat / dessert peuvent
-- etre present dans plusieurs menus". Ces associations le demontrent sur le
-- jeu de demonstration, sans dupliquer la moindre ligne de la table plats.
--
-- La coherence des regimes est respectee : aucun plat non vegan n'est ajoute
-- au menu vegan.
-- ============================================================================
INSERT INTO menus_plats (menu_id, plat_id) VALUES
    -- Les canneles bordelais accompagnent aussi le menu de Paques
    (4, (SELECT id FROM plats WHERE nom = 'Cannelés bordelais croustillants')),
    -- Les asperges vertes figurent egalement au menu vegetarien
    (2, (SELECT id FROM plats WHERE nom = 'Asperges vertes rôties, sauce mousseline légère')),
    -- Le veloute de potimarron est propose au buffet champetre
    (1, (SELECT id FROM plats WHERE nom = 'Velouté de potimarron aux éclats de châtaignes'));

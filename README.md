Projet ECF du développeur web et web mobile

Appplication pour l'entreprise Vite et gourmand

L'environnement a été standardisé pour être déployable en local en moins de 5 minutes par n'importe quel développeur de l'équipe :

Procédure d'installation locale - Vite & Gourmand

Prérequis
Node.js (v18+) 
PostgreSQL (v14+)
Git

Étape 1 : Clonage du projet
git clone https://github.com/Alanejhnsn49/vite-et-gourmand.git
cd vite-et-gourmand

Étape 2 : Configuration de la base de données
1. Connectez-vous à votre SGBD local.
2. Créez une base de données nommée `vite_gourmand`.
3. Exécutez le script de structure : `psql -U user -d vite_gourmand -f database/schema.sql`
4. Injectez les données de test : `psql -U user -d vite_gourmand -f database/seed.sql`

Étape 3 : Lancement de l'application
Si Node.js : `npm install` puis `npm start` (l'application tourne sur http://localhost:3000)

Justification de nos choix : L'utilisation de deux fichiers SQL distincts (schema.sql pour la structure et seed.sql pour les données de test) permet de réinitialiser l'environnement de test instantanément sans corrompre la structure de production.

3.	Énumérez les mécanismes de sécurité que vous avez mis en place, aussi bien sur vos formulaires que sur les composants front-end ainsi que back-end. 

A. Sécurité Front-End (Formulaires et Navigation)
•	Validation HTML5 & Regex : Tous les formulaires (contact, commande, connexion) possèdent des attributs required, min, max et des masques de saisie (Regex) pour valider le format des emails, numéros de téléphone et dates de prestation avant soumission.
•	Protection contre les doubles soumissions : Désactivation systématique des boutons de validation après le premier clic pour éviter les doublons de commandes.
•	Navigation Gardée : Blocage côté client des accès aux pages d'administration pour les utilisateurs non connectés ou ne possédant pas le rôle requis.

B. Sécurité Back-End & Base de Données
•	Protection contre les Injections SQL : Utilisation stricte de requêtes préparées (Prepared Statements) avec liaison de paramètres typés. Aucune variable utilisateur n'est concaténée directement dans les requêtes SQL.
•	Hachage des mots de passe : Utilisation de l'algorithme de hachage fort bcrypt (avec un coût de 12) pour stocker les mots de passe.
•	Contrôle d'accès basé sur les rôles (RBAC) : Vérification systématique du rôle de l'utilisateur stocké dans la session serveur (req.session.user.role) avant de délivrer l'accès aux routes API sensibles (ex: modification des stocks ou validation d'un avis).
•	Protection XSS : Échappement systématique des données saisies par les utilisateurs avant tout affichage sur le site (notamment pour les commentaires des avis clients).

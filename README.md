# Vite & Gourmand

Application web de gestion de menus et de commandes pour un service traiteur, développée dans le cadre de l'ECF du Titre Professionnel Développeur Web et Web Mobile.

> Projet en cours de finalisation. La section [État d'avancement](#état-davancement) détaille précisément ce qui est implémenté et ce qui reste à faire.

---

## Sommaire

- [Stack technique](#stack-technique)
- [Installation avec Docker](#installation-avec-docker-recommandé)
- [Installation manuelle](#installation-manuelle)
- [Structure du projet](#structure-du-projet)
- [Variables d'environnement](#variables-denvironnement)
- [API](#api)
- [Règles de gestion](#règles-de-gestion)
- [Cycle de vie d'une commande](#cycle-de-vie-dune-commande)
- [Emails](#emails)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Sécurité](#sécurité)
- [Workflow git](#workflow-git)
- [État d'avancement](#état-davancement)

---

## Stack technique

| Couche | Technologie | Justification |
|---|---|---|
| Front-end | HTML5, CSS3, JavaScript | Pas de framework : le référentiel évalue la maîtrise des interfaces natives |
| Back-end | Node.js 24, Express 4 | Écosystème unifié en JavaScript, montée en charge asynchrone adaptée à une API REST |
| Base relationnelle | PostgreSQL 16 | Respect des contraintes d'intégrité référentielle, types stricts, requêtes préparées natives via `pg` |
| Base non relationnelle | MongoDB 7 | Stockage des événements analytiques, dont le volume et le schéma évoluent librement |
| Sessions | `express-session` | Sessions serveur, cookie `httpOnly` et `sameSite: strict` |
| Mots de passe | `bcrypt` | Hachage lent avec sel, coût 12 |
| Emails | `nodemailer` | Client SMTP standard, indépendant du fournisseur d'envoi |
| SMTP de développement | Mailpit | Capture les emails sans jamais les remettre à un vrai destinataire |
| Conteneurisation | Docker et Docker Compose | Environnement identique sur toutes les machines et en production |

---

## Installation avec Docker (recommandé)

### Prérequis

- Docker Desktop (Windows, macOS) ou Docker Engine avec le plugin Compose (Linux)
- Git

Aucune installation locale de Node.js, PostgreSQL ou MongoDB n'est nécessaire.

### Étape 1 : cloner le projet

```bash
git clone https://github.com/Alanejhnsn49/vite-et-gourmand.git
```

```bash
cd vite-et-gourmand
```

### Étape 2 : créer le fichier d'environnement

```bash
cp .env.example .env
```

Les valeurs par défaut conviennent pour un environnement de développement. En production, `SESSION_SECRET` et les mots de passe des bases doivent impérativement être remplacés.

### Étape 3 : lancer la pile

```bash
docker compose up -d --build
```

L'application est disponible sur http://localhost:3000

La boîte de réception de développement, qui capture tous les emails envoyés par l'application, est consultable sur http://localhost:8025

### Ce que fait la commande

| Service | Image | Port | Rôle |
|---|---|---|---|
| `app` | construite depuis le `Dockerfile` | 3000 | API Express et fichiers statiques |
| `db` | `postgres:16-alpine` | 5432 | Base relationnelle |
| `mongo` | `mongo:7` | 27017 | Base non relationnelle, données analytiques |
| `mailpit` | `axllent/mailpit` | 1025, 8025 | Serveur SMTP de développement et sa boîte de réception web |

Au premier démarrage, PostgreSQL exécute automatiquement `database/schema.sql` puis `database/seed.sql`. Aucune commande manuelle n'est nécessaire pour créer les tables ou injecter le jeu de test.

Le service `app` attend que PostgreSQL réponde à son `healthcheck` avant de démarrer.

### Commandes utiles

Consulter l'état des services :

```bash
docker compose ps
```

Suivre les journaux de l'application :

```bash
docker compose logs -f app
```

Arrêter les services en conservant les données :

```bash
docker compose down
```

Tout réinitialiser, données comprises :

```bash
docker compose down -v
```

### Justification des choix de conteneurisation

**Pourquoi Docker.** L'énoncé impose une base relationnelle et une base non relationnelle. Sans conteneurisation, chaque développeur devrait installer et configurer PostgreSQL et MongoDB manuellement, avec des versions potentiellement divergentes. Docker garantit un environnement strictement identique partout, ce qui supprime la classe de bugs du « ça marche chez moi ».

**Pourquoi des images Alpine.** `node:24-alpine` et `postgres:16-alpine` sont nettement plus légères que leurs équivalents complets, ce qui réduit le temps de construction et la surface d'attaque.

**Pourquoi copier `package*.json` avant le reste du code.** Docker met chaque instruction en cache. En isolant l'installation des dépendances, une modification du code source ne relance pas un `npm ci` complet.

**Pourquoi `npm ci` plutôt que `npm install`.** `npm ci` installe exactement les versions figées dans `package-lock.json`, là où `npm install` peut les faire dériver. C'est la garantie d'une construction reproductible.

**Pourquoi un healthcheck sur PostgreSQL.** Un conteneur démarré n'est pas un conteneur prêt. Sans la condition `service_healthy`, l'application tenterait de se connecter avant que la base accepte les connexions.

**Pourquoi des volumes nommés.** `pgdata` et `mongodata` permettent d'arrêter et de relancer les conteneurs sans perdre les données.

---

## Installation manuelle

### Prérequis

- Node.js 18 ou supérieur
- PostgreSQL 14 ou supérieur
- MongoDB 7 ou supérieur
- Git

### Étapes

```bash
git clone https://github.com/Alanejhnsn49/vite-et-gourmand.git
```

```bash
cd vite-et-gourmand
```

```bash
cp .env.example .env
```

Créer ensuite une base nommée `vite_gourmand`, puis :

```bash
psql -U postgres -d vite_gourmand -f database/schema.sql
```

```bash
psql -U postgres -d vite_gourmand -f database/seed.sql
```

```bash
npm install
```

```bash
npm start
```

**Pourquoi deux fichiers SQL distincts.** `schema.sql` porte la structure, `seed.sql` porte les données de test. Cette séparation permet de réinitialiser un jeu de données sans toucher à la structure, et inversement de faire évoluer la structure sans dépendre des données.

---

## Structure du projet

```
.
├── config/
│   ├── db.js              Connexion PostgreSQL (pool pg)
│   └── mongo.js           Connexion MongoDB
├── controllers/           Logique métier
├── database/
│   ├── schema.sql         Création des tables (11 tables)
│   └── seed.sql           Jeu de données de test
├── maquette/              Maquettes desktop et mobile (PDF)
├── middleware/
│   └── auth.js            Contrôle d'authentification et de rôle
├── public/                Front-end statique servi par Express
├── routes/                Définition des routes de l'API
├── services/
│   ├── analyticsService.js      Accès aux données MongoDB
│   ├── commandeStatutService.js Cycle de vie et transitions des commandes
│   ├── mailService.js           Envoi des emails et gabarits
│   ├── reinitialisationService.js  Jetons de réinitialisation de mot de passe
│   └── tarificationService.js   Règles de gestion tarifaires
├── Dockerfile
├── docker-compose.yml
└── server.js              Point d'entrée
```

---

## Variables d'environnement

Toutes les variables sont documentées dans `.env.example`. Le fichier `.env` réel n'est jamais versionné.

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute du serveur Express |
| `SESSION_SECRET` | Clé de signature des cookies de session |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Identifiants PostgreSQL |
| `MONGO_USER`, `MONGO_PASSWORD`, `MONGO_DB` | Identifiants MongoDB |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE` | Serveur SMTP |
| `MAIL_USER`, `MAIL_PASSWORD` | Identifiants SMTP, vides avec Mailpit |
| `MAIL_FROM`, `MAIL_CONTACT` | Expéditeur des envois et adresse de réception du formulaire de contact |
| `APP_URL` | Adresse publique, utilisée pour les liens dans les emails |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `MONGO_URL` | Chaîne de connexion MongoDB |

Avec Docker Compose, `DATABASE_URL` et `MONGO_URL` sont reconstruites automatiquement pour pointer vers les services `db` et `mongo` du réseau interne, et non vers `localhost`.

---

## API

| Méthode | Route | Authentification | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | non | Création d'un compte utilisateur |
| `POST` | `/api/auth/login` | non | Connexion |
| `POST` | `/api/auth/logout` | non | Déconnexion |
| `GET` | `/api/auth/me` | oui | Profil de l'utilisateur connecté |
| `POST` | `/api/auth/mot-de-passe-oublie` | non | Demande d'un lien de réinitialisation |
| `GET` | `/api/auth/reinitialisation/:jeton` | non | Vérifie la validité d'un lien avant d'afficher le formulaire |
| `POST` | `/api/auth/reinitialiser` | non | Enregistre le nouveau mot de passe |
| `GET` | `/api/menus` | non | Vue globale des menus, filtrable |
| `GET` | `/api/menus/:id` | non | Vue détaillée d'un menu, avec sa composition et les allergènes |
| `POST` | `/api/orders/simuler` | oui | Détail tarifaire sans enregistrement, pour l'affichage du prix avant validation |
| `POST` | `/api/orders/create` | oui | Création d'une commande |
| `GET` | `/api/orders/mes-commandes` | oui | Commandes du client connecté |
| `GET` | `/api/orders/:id/suivi` | propriétaire ou personnel | Historique complet des statuts, daté |
| `PATCH` | `/api/orders/:id` | propriétaire | Modification, tant que la commande n'est pas acceptée |
| `POST` | `/api/orders/:id/annuler` | propriétaire | Annulation, tant que la commande n'est pas acceptée |
| `GET` | `/api/orders` | rôles `employe` et `admin` | Toutes les commandes, filtrables par statut, client et menu |
| `PATCH` | `/api/orders/:id/statut` | rôles `employe` et `admin` | Changement de statut |
| `GET` | `/api/analytics/menus` | rôle `admin` | Commandes et chiffre d'affaires par menu, données du graphique de comparaison |
| `GET` | `/api/analytics/chiffre-affaires` | rôle `admin` | Chiffre d'affaires global et détail par menu |
| `GET` | `/api/analytics/evolution` | rôle `admin` | Évolution jour par jour |
| `POST` | `/api/contact` | non | Formulaire de contact, transmis par email à l'entreprise |
| `GET` | `/api/avis` | non | Avis validés, pour la page d'accueil |
| `POST` | `/api/avis` | propriétaire | Dépôt d'un avis sur une commande terminée |
| `GET` | `/api/avis/moderation` | rôles `employe` et `admin` | File de modération |
| `PATCH` | `/api/avis/:id/moderation` | rôles `employe` et `admin` | Validation ou refus d'un avis |
| `PATCH` | `/api/users/moi` | oui | Modification de ses informations personnelles |
| `GET` | `/api/users` | rôle `admin` | Liste des comptes |
| `POST` | `/api/users/employes` | rôle `admin` | Création d'un compte employé |
| `PATCH` | `/api/users/:id/actif` | rôle `admin` | Activation ou désactivation d'un compte |
| `GET` | `/api/catalogue/horaires` | non | Horaires d'ouverture, pour le pied de page |
| `PATCH` | `/api/catalogue/horaires/:jour` | rôles `employe` et `admin` | Modification des horaires d'un jour |
| `GET` | `/api/catalogue/menus` | rôles `employe` et `admin` | Tous les menus, y compris ceux retirés du catalogue |
| `POST` | `/api/catalogue/menus` | rôles `employe` et `admin` | Création d'un menu |
| `PATCH` | `/api/catalogue/menus/:id` | rôles `employe` et `admin` | Modification d'un menu |
| `DELETE` | `/api/catalogue/menus/:id` | rôles `employe` et `admin` | Suppression, ou retrait du catalogue si déjà commandé |
| `PUT` | `/api/catalogue/menus/:id/plats` | rôles `employe` et `admin` | Composition d'un menu |
| `GET` | `/api/catalogue/plats` | rôles `employe` et `admin` | Liste des plats avec leurs allergènes |
| `POST` | `/api/catalogue/plats` | rôles `employe` et `admin` | Création d'un plat |
| `DELETE` | `/api/catalogue/plats/:id` | rôles `employe` et `admin` | Suppression d'un plat |
| `GET` | `/api/status` | non | Vérification de disponibilité |

Les trois routes analytiques acceptent les filtres `menuId`, `dateDebut` et `dateFin`, combinables.

### Filtres de la vue globale des menus

`GET /api/menus` accepte cinq filtres, tous optionnels et combinables :

| Paramètre | Effet |
|---|---|
| `theme` | `classique`, `noel`, `paques` ou `evenement` |
| `regime` | `classique`, `vegetarien`, `vegan` ou `sans-gluten` |
| `minPersonnes` | Menus dont le minimum de convives atteint au moins cette valeur |
| `prixMin` | Borne basse de la fourchette de prix |
| `prixMax` | Borne haute, ou plafond de prix utilisé seul |

**Le filtrage est fait par PostgreSQL, pas en JavaScript après coup.** La base n'envoie que les lignes utiles, ce qui reste efficace quel que soit le nombre de menus. Le front interroge l'API à chaque changement de filtre et met à jour la liste sans recharger la page.

Les valeurs de `theme` et `regime` sont comparées à une liste blanche alignée sur les contraintes `CHECK` du schéma. Une valeur hors de cette liste neutralise le filtre au lieu d'être transmise à la requête, et la réponse ne reflète que les filtres réellement appliqués. Les bornes numériques passent par `parseInt` et `parseFloat`. Toutes les valeurs retenues sont liées en paramètres, jamais concaténées.

### Modèle de données des menus

Le cahier des charges précise qu'« une entrée ou un plat / dessert peuvent être présents dans plusieurs menus ». Cette phrase impose une relation plusieurs-à-plusieurs : un plat est donc une entité autonome, jamais dupliquée d'un menu à l'autre. Même raisonnement entre les plats et les allergènes.

```
menus ──< menus_plats >── plats ──< plats_allergenes >── allergenes
```

Le jeu de démonstration comporte 5 menus, 17 plats et 7 allergènes, dont 3 plats effectivement partagés entre deux menus.

La vue détaillée récupère les plats et leurs allergènes **en une seule requête**, avec une agrégation `ARRAY_AGG ... FILTER` côté PostgreSQL. Une version naïve déclencherait un appel par plat, soit 18 allers-retours au lieu d'un : c'est le problème classique dit « N+1 ».

### Répartition des données entre les deux bases

**PostgreSQL** porte les données transactionnelles : utilisateurs, menus, commandes, avis. Elles exigent des contraintes d'intégrité fortes et un schéma stable.

**MongoDB** porte les données analytiques. Un document est écrit dans la collection `evenements_commandes` à chaque commande passée. Ces documents sont nombreux, jamais modifiés après coup, et leur structure doit pouvoir évoluer sans migration. Les agrégations qui alimentent l'espace administrateur sont exécutées directement par le moteur Mongo via un pipeline `$match`, `$group`, `$project`, `$sort`, avec des index sur `menu_id` et `date_commande`.

L'écriture analytique est volontairement placée après l'enregistrement en base relationnelle et n'interrompt jamais le parcours : une indisponibilité de MongoDB fait perdre une statistique, jamais une vente.

Les composants d'accès sont isolés dans `services/analyticsService.js`. Aucun contrôleur n'écrit de requête MongoDB directement.

---

## Règles de gestion

Les règles tarifaires sont isolées dans `services/tarificationService.js`, hors des contrôleurs. Elles sont ainsi testables indépendamment du transport HTTP, réutilisées à l'identique par la simulation et par la création de commande, et modifiables en un seul endroit.

| Règle | Application |
|---|---|
| Nombre minimum de convives | Une commande sous le minimum du menu est refusée par le serveur, avec le minimum requis dans la réponse |
| Prix des convives supplémentaires | Le prix affiché correspond au nombre minimum de personnes. Chaque convive supplémentaire est facturé au prorata, soit `prix_min / min_personnes` |
| Remise commerciale | 10 % dès que la commande dépasse de 5 convives ou plus le minimum du menu. Elle porte sur la prestation, pas sur la livraison |
| Frais de livraison | Nuls dans Bordeaux. Ailleurs : 5 € fixes, majorés de 0,59 € par kilomètre |

**Pourquoi la proportionnalité pour les convives supplémentaires.** Le cahier des charges fixe un prix pour un nombre minimum de personnes, sans définir de tarif unitaire au delà. Facturer au prorata garantit un prix par personne constant, cohérent avec le tarif annoncé au client, et évite tout effet de seuil arbitraire.

### Exemple vérifiable

Menu « La Magie de Noël » : minimum 8 convives, 480 €, soit 60 € par personne.

| Cas | Calcul | Total |
|---|---|---|
| 8 convives, Bordeaux | 480 € | **480,00 €** |
| 13 convives, Bordeaux | 780 € brut, remise 78 € | **702,00 €** |
| 13 convives, Mérignac à 10 km | 702 € + 5 € + 5,90 € | **712,90 €** |
| 5 convives | refusé | **erreur 400** |

---

## Cycle de vie d'une commande

Les statuts et leurs enchaînements autorisés sont déclarés dans `services/commandeStatutService.js`. Sans machine à états explicite, rien n'empêcherait de faire repasser une commande livrée en préparation, ou de relancer une commande annulée.

```
attente ──> accepte ──> prep ──> livraison ──> livre ──┬──> terminee
   │           │          │                            │
   │           │          │                            └──> retour ──> terminee
   └───────────┴──────────┴──> annulee
```

| Statut | Libellé | Transitions possibles |
|---|---|---|
| `attente` | En attente de validation | `accepte`, `annulee` |
| `accepte` | Acceptée | `prep`, `annulee` |
| `prep` | En préparation | `livraison`, `annulee` |
| `livraison` | En cours de livraison | `livre` |
| `livre` | Livrée | `retour`, `terminee` |
| `retour` | En attente de retour du matériel | `terminee` |
| `terminee` | Terminée | état final |
| `annulee` | Annulée | état final |

Une transition non autorisée renvoie un code 409 accompagné de la liste des transitions réellement possibles.

### Règles associées

**Le client garde la main tant que la commande n'est pas acceptée.** Il peut alors la modifier ou l'annuler lui-même. Passé ce stade, l'API refuse en 409 et l'invite à contacter l'entreprise.

**Le menu n'est jamais modifiable.** Il n'est pas lu depuis la requête de modification : il reste celui d'origine, et le prix est recalculé à partir de lui. Envoyer un `menuId` dans la requête n'a aucun effet.

**Une annulation par le personnel exige un motif et un canal de contact** (`gsm` ou `mail`), conformément au cahier des charges qui interdit d'annuler sans avoir joint le client au préalable. Les deux sont conservés dans l'historique.

**Le stock est rendu à l'annulation**, quelle qu'en soit l'origine.

### Traçabilité

La table `suivi_commandes` conserve chaque changement, avec sa date, son auteur, et le motif s'il y en a un. La colonne `commandes.statut` porte l'état courant, la table porte l'historique : conserver les deux évite de recalculer l'état courant à chaque lecture.

La mise à jour du statut et l'écriture dans l'historique sont faites **dans une même transaction**. Sans cela, une panne entre les deux écritures laisserait une commande dont l'état courant n'apparaît nulle part dans son suivi.

---

## Emails

Tous les envois passent par `services/mailService.js`. Les contrôleurs n'assemblent jamais un email eux-mêmes : ils appellent une fonction nommée d'après l'événement métier. La présentation reste homogène et le changement de fournisseur SMTP se fait dans un seul fichier.

| Événement | Destinataire | Contenu |
|---|---|---|
| Création d'un compte | le nouvel inscrit | Message de bienvenue et lien vers les menus |
| Création d'une commande | le client | Récapitulatif complet, détail du prix, remise et livraison isolées |
| Changement de statut | le client | Nouveau statut et lien vers le suivi |
| Passage en attente de retour du matériel | le client | Délai de 10 jours ouvrés et pénalité de 600 euros |
| Commande terminée | le client | Invitation à déposer un avis |
| Annulation | le client | Motif et canal de contact utilisé |
| Mot de passe oublié | le titulaire du compte | Lien de réinitialisation valable une heure |
| Mot de passe modifié | le titulaire du compte | Confirmation, pour qu'il réagisse si la demande ne vient pas de lui |
| Formulaire de contact | l'entreprise | Demande complète avec coordonnées de l'expéditeur |
| Formulaire de contact | le visiteur | Accusé de réception |

### Deux principes appliqués

**Un échec d'envoi n'interrompt jamais un parcours métier.** Une inscription reste valide, une commande reste enregistrée, même si le serveur SMTP est indisponible. L'erreur est journalisée, la fonction renvoie un statut, et le parcours continue.

**Toute donnée utilisateur est échappée avant insertion dans un gabarit.** Un nom ou un message venant d'un formulaire est du texte non fiable. Sans échappement, un visiteur pourrait injecter du balisage dans un email lu par un employé.

### En développement

Le conteneur Mailpit intercepte l'intégralité des envois. Aucun email ne part vers une adresse réelle, ce qui permet de tester les parcours sans compte mail et sans risque d'écrire à une adresse figurant dans le jeu de test. La boîte est consultable sur http://localhost:8025

### En production

Il suffit de renseigner `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` et de passer `MAIL_SECURE` à `true` si le port l'exige. Aucun code n'est à modifier.

---

## Comptes de démonstration

Le jeu de données `seed.sql` crée trois comptes, avec des empreintes bcrypt réelles de coût 12.

| Email | Mot de passe | Rôle |
|---|---|---|
| `jose.admin@viteetgourmand.fr` | `Admin2026!` | admin |
| `pierre.employe@viteetgourmand.fr` | `Employe2026!` | employe |
| `jean.dupont@exemple.com` | `Client2026!` | client |

Ces comptes sont réservés à l'environnement de démonstration.

---

## Sécurité

Cette section distingue volontairement ce qui est **effectivement implémenté** de ce qui **reste à faire**. Toute mesure annoncée ci-dessous comme implémentée est vérifiable dans le code.

### Mesures implémentées

**Protection contre les injections SQL.** Toutes les requêtes utilisent des requêtes préparées avec liaison de paramètres (`$1`, `$2`). Aucune variable issue de l'utilisateur n'est concaténée dans une requête. Vérifiable dans `controllers/`.

**Hachage des mots de passe.** `bcrypt` avec un coût de 12. Le mot de passe en clair n'est jamais stocké ni journalisé. Vérifiable dans `controllers/authController.js`.

**Cookies de session durcis.** `httpOnly` empêche la lecture du cookie par JavaScript, ce qui limite l'impact d'une faille XSS. `sameSite: 'strict'` bloque l'envoi du cookie lors d'une requête inter-site, ce qui constitue une protection CSRF. Durée de vie limitée à 24 heures. Vérifiable dans `server.js`.

**Secrets hors du dépôt.** `.env` est exclu par `.gitignore`. Seul `.env.example`, qui ne contient aucune valeur réelle, est versionné.

**Contrôle d'authentification.** Le middleware `isAuthenticated` rejette toute requête sans session valide sur les routes protégées.

**Contrôle d'accès par rôle.** Le middleware `hasRole` protège les routes `/api/analytics/*`, réservées au rôle `admin`. Le rôle est lu dans la session serveur, jamais dans une valeur transmise par le client, ce qui empêche toute élévation de privilège par manipulation de la requête. Un compte `client` authentifié reçoit un code 403.

**Filtrage typé des paramètres d'agrégation.** Les valeurs de filtre transmises aux pipelines MongoDB sont converties et validées avant usage. Aucune donnée utilisateur ne peut être interprétée comme un opérateur Mongo, ce qui est l'équivalent NoSQL de la protection contre les injections.

### Mesures à implémenter

**Échappement XSS en sortie.** Aucun échappement systématique n'est en place à ce jour. Il deviendra indispensable dès l'affichage des avis clients, qui sont du texte libre.

**Validation serveur.** Trois points d'entrée sont couverts, indépendamment des attributs HTML5 du formulaire qui restent contournables :

- Inscription : le mot de passe doit faire 10 caractères minimum et contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial, conformément au cahier des charges. La réponse d'erreur précise ce qui manque
- Création de commande : champs obligatoires, date de prestation non passée, nombre minimum de convives
- Formulaire de contact : champs obligatoires, format d'adresse, longueurs maximales

**Réinitialisation de mot de passe durcie.** Cinq mesures, toutes vérifiables dans `services/reinitialisationService.js` :

- Le jeton est produit par `crypto.randomBytes(32)`, un générateur cryptographiquement sûr. `Math.random` est prédictible et ne doit jamais produire un secret
- **Seule l'empreinte SHA-256 du jeton est stockée.** Le jeton en clair n'existe que dans le lien envoyé par email. Une fuite de la base ne permet donc pas de réinitialiser un compte
- Le lien expire au bout d'une heure et ne peut servir **qu'une seule fois**
- Toute nouvelle demande **invalide les jetons précédents** du même compte
- **Aucune énumération de comptes possible.** La réponse est strictement identique que l'adresse existe ou non. Une réponse différenciée permettrait de découvrir quels comptes existent sur la plateforme

**Aucune élévation de privilège possible.** Trois protections indépendantes :

- La modification de profil n'accepte que le nom, le prénom, le téléphone, l'adresse et l'email. Envoyer `role: "admin"` dans la requête n'a aucun effet, le champ n'est jamais lu
- La création de compte employé écrit le rôle **en dur** dans la requête SQL. Le cahier des charges impose qu'« il ne doit pas être possible de créer un compte Administrateur depuis l'application » : envoyer `role: "admin"` produit un compte `employe`
- Le rôle utilisé pour les contrôles d'accès est lu dans la session serveur, jamais dans une valeur transmise par le client

**Désactivation de compte plutôt que suppression.** Un compte rendu inutilisable ne peut plus ouvrir de session, mais il n'est jamais effacé : son historique de commandes reste intact et les clés étrangères ne cassent pas. Le contrôle d'activation intervient **après** la vérification du mot de passe, pour ne pas révéler quelles adresses correspondent à d'anciens employés. Un administrateur ne peut pas se désactiver lui-même.

**Modération des avis avant publication.** Aucun avis n'apparaît sur la page d'accueil sans validation par un employé. Seul le prénom du client est exposé publiquement : publier son nom complet serait une diffusion de donnée personnelle non nécessaire au regard du RGPD.

**Contrôle de propriété sur les commandes.** Un client authentifié ne peut lire, modifier ou annuler que ses propres commandes. Sans cette vérification, changer l'identifiant dans l'URL suffirait à consulter le suivi des commandes des autres clients. Les employés et administrateurs y accèdent toutes.

**Échappement des données dans les emails.** Toute valeur issue d'un formulaire est échappée avant insertion dans un gabarit HTML, ce qui empêche l'injection de balisage dans un message lu par un employé.

**Limitation du nombre de tentatives de connexion.** Aucune protection contre le bourrage d'identifiants n'est en place.

---

## Workflow git

Le dépôt suit le flux imposé par l'énoncé.

- `main` : branche principale, ne reçoit que du code testé
- `developpement` : branche d'intégration
- `feat/*` et `fix/*` : une branche par fonctionnalité ou correction, issue de `developpement` et fusionnée dans `developpement` après test

---

## État d'avancement

Le livret d'évaluation a identifié trois compétences à repasser. Voici l'état de chacune.

| Compétence | État |
|---|---|
| CPT 1 : installer et configurer son environnement de travail | Traité, environnement conteneurisé et documenté |
| CPT 2 : composants d'accès aux données SQL et NoSQL | Traité, MongoDB branché avec écriture d'événements, agrégations filtrables et index |
| CPT 3 : composants métier côté serveur | En cours |

### Reste à implémenter

- Conformité RGAA

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

### Ce que fait la commande

| Service | Image | Port | Rôle |
|---|---|---|---|
| `app` | construite depuis le `Dockerfile` | 3000 | API Express et fichiers statiques |
| `db` | `postgres:16-alpine` | 5432 | Base relationnelle |
| `mongo` | `mongo:7` | 27017 | Base non relationnelle, données analytiques |

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
│   ├── schema.sql         Création des tables
│   └── seed.sql           Jeu de données de test
├── maquette/              Maquettes desktop et mobile (PDF)
├── middleware/
│   └── auth.js            Contrôle d'authentification et de rôle
├── public/                Front-end statique servi par Express
├── routes/                Définition des routes de l'API
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
| `GET` | `/api/menus` | non | Liste des menus disponibles |
| `POST` | `/api/orders/simuler` | oui | Détail tarifaire sans enregistrement, pour l'affichage du prix avant validation |
| `POST` | `/api/orders/create` | oui | Création d'une commande |
| `GET` | `/api/analytics/menus` | rôle `admin` | Commandes et chiffre d'affaires par menu, données du graphique de comparaison |
| `GET` | `/api/analytics/chiffre-affaires` | rôle `admin` | Chiffre d'affaires global et détail par menu |
| `GET` | `/api/analytics/evolution` | rôle `admin` | Évolution jour par jour |
| `GET` | `/api/status` | non | Vérification de disponibilité |

Les trois routes analytiques acceptent les filtres `menuId`, `dateDebut` et `dateFin`, combinables.

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

**Validation serveur sur la création de commande.** Champs obligatoires, format et cohérence de la date de prestation, nombre minimum de convives : tout est revérifié côté serveur, indépendamment des attributs HTML5 du formulaire, qui sont contournables. Les autres points d'entrée restent à couvrir.

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

- Envoi d'emails : bienvenue, réinitialisation de mot de passe, confirmation de commande, retour de matériel, invitation à déposer un avis
- Réinitialisation de mot de passe
- Filtres dynamiques sur la vue globale des menus, sans rechargement de page
- Vue détaillée d'un menu
- Cycle de vie complet d'une commande et son suivi client
- Espace utilisateur, espace employé, espace administrateur
- Modération et affichage des avis
- Formulaire de contact

- Conformité RGAA

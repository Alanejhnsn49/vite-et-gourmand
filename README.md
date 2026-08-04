Projet ECF du développeur web et web mobile (a terminer)

Application pour l'entreprise Vite et gourmand

L'environnement a été standardisé pour être déployable en local en moins de 5 minutes par n'importe quel développeur de l'équipe.

Deux méthodes sont proposées. La première est recommandée.

---

## Méthode 1 (recommandée) : installation avec Docker

### Prérequis

- Docker Desktop (Windows ou macOS) ou Docker Engine avec le plugin Compose (Linux)
- Git

Aucune installation locale de Node.js, PostgreSQL ou MongoDB n'est nécessaire : les trois services sont fournis par les conteneurs.

### Étape 1 : Clonage du projet

```bash
git clone https://github.com/Alanejhnsn49/vite-et-gourmand.git
cd vite-et-gourmand
```

### Étape 2 : Configuration

```bash
cp .env.example .env
```

Le fichier `.env.example` documente toutes les variables attendues. Les valeurs par défaut suffisent pour un environnement de développement local. En production, `SESSION_SECRET` et les mots de passe des bases doivent impérativement être remplacés.

### Étape 3 : Lancement

```bash
docker compose up -d --build
```

L'application est alors disponible sur http://localhost:3000

### Ce que fait la commande

| Service | Image | Port | Rôle |
|---|---|---|---|
| `app` | construite depuis le `Dockerfile` | 3000 | API Express et fichiers statiques |
| `db` | `postgres:16-alpine` | 5432 | Base de données relationnelle |
| `mongo` | `mongo:7` | 27017 | Base de données non relationnelle (données analytiques) |

Au premier démarrage, PostgreSQL joue automatiquement `database/schema.sql` puis `database/seed.sql`. Aucune commande manuelle n'est nécessaire pour créer les tables ou injecter le jeu de test.

Le service `app` attend que PostgreSQL réponde à son `healthcheck` avant de démarrer, ce qui évite les erreurs de connexion au lancement.

### Commandes utiles

Consulter l'état des services :

```bash
docker compose ps
```

Lire les journaux de l'application :

```bash
docker compose logs -f app
```

Arrêter les services en conservant les données :

```bash
docker compose down
```

Tout réinitialiser, y compris les données des bases :

```bash
docker compose down -v
```

### Justification des choix techniques

**Pourquoi Docker.** L'énoncé impose une base relationnelle et une base non relationnelle. Sans conteneurisation, chaque développeur devrait installer et configurer PostgreSQL et MongoDB à la main, avec des versions potentiellement différentes. Docker garantit que l'environnement est strictement identique sur toutes les machines et en production, ce qui supprime la classe de bugs du « ça marche chez moi ».

**Pourquoi des images Alpine.** L'image `node:24-alpine` et `postgres:16-alpine` sont nettement plus légères que leurs équivalents complets, ce qui réduit le temps de construction et la surface d'attaque.

**Pourquoi copier `package*.json` avant le reste du code.** Docker met chaque instruction en cache. En isolant l'installation des dépendances, une simple modification du code source ne relance pas un `npm ci` complet.

**Pourquoi `npm ci` plutôt que `npm install`.** `npm ci` installe exactement les versions figées dans `package-lock.json`, là où `npm install` peut les faire dériver. C'est la garantie d'une construction reproductible.

**Pourquoi un `healthcheck` sur PostgreSQL.** Un conteneur démarré n'est pas un conteneur prêt. Sans cette condition, l'application tenterait de se connecter à une base qui n'accepte pas encore les connexions.

**Pourquoi des volumes nommés.** `pgdata` et `mongodata` permettent d'arrêter et de relancer les conteneurs sans perdre les données.

---

## Méthode 2 : installation manuelle

### Prérequis

- Node.js (v18+)
- PostgreSQL (v14+)
- MongoDB (v7+)
- Git

### Étape 1 : Clonage du projet

```bash
git clone https://github.com/Alanejhnsn49/vite-et-gourmand.git
cd vite-et-gourmand
```

### Étape 2 : Configuration de la base de données

1. Connectez-vous à votre SGBD local.
2. Créez une base de données nommée `vite_gourmand`.
3. Exécutez le script de structure : `psql -U user -d vite_gourmand -f database/schema.sql`
4. Injectez les données de test : `psql -U user -d vite_gourmand -f database/seed.sql`

### Étape 3 : Lancement de l'application

```bash
npm install
npm start
```

L'application tourne sur http://localhost:3000

**Justification de nos choix :** l'utilisation de deux fichiers SQL distincts (`schema.sql` pour la structure et `seed.sql` pour les données de test) permet de réinitialiser l'environnement de test instantanément sans corrompre la structure de production.

---

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

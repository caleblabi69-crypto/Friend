# Friend

Assistant conversationnel personnel en français, construit avec React, Express, SQLite et Ollama. Friend utilise Ollama en local par défaut. Pour un hébergement comme Render, un fournisseur d’inférence compatible avec l’API OpenAI peut être configuré avec des variables d’environnement ; le serveur Ollama de votre ordinateur n’a pas à être exposé sur Internet.

## Fonctionnalités

- Comptes avec authentification, rôles utilisateur/administrateur et restriction des inscriptions.
- Conversations privées par compte, réponses en streaming, historique et suppression.
- Mémoire longue durée contrôlée par l’utilisateur.
- Téléversement de PDF (extraction de texte) et d’images (modèle vision requis).
- Thèmes sombre et clair, interface responsive, dictée et lecture vocale lorsque le navigateur les prend en charge.
- Messages Markdown avec tableaux et coloration syntaxique ; impression du fil via le navigateur pour l’enregistrer en PDF.
- Administration des comptes et des extensions d’instructions (prompts).
- API documentée par Swagger sur `/api-docs`.
- Docker Compose avec Ollama et stockage local persistant ; modèle Render avec disque persistant.

La reconnaissance d’image dépend du modèle configuré. La dictée et la synthèse vocale reposent sur les fonctions natives du navigateur et peuvent ne pas être disponibles partout. L’export PDF utilise **Imprimer → Enregistrer au format PDF**.

## Technologies et arborescence

```text
Friend/
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.jsx                 # Interface, conversations, admin et mémoire
│       ├── MarkdownMessage.jsx     # Rendu différé du Markdown et du code
│       ├── main.jsx               # Entrée React
│       └── styles.css             # Thèmes et mise en page responsive
├── src/
│   ├── config.js                  # Configuration par environnement
│   ├── db.js                      # Schéma SQLite et création initiale de l’admin
│   ├── server.js                  # Application Express et Swagger
│   ├── controllers/               # Logique HTTP : auth, chats, fichiers, mémoire, admin
│   ├── middleware/auth.js         # Vérification JWT et rôle administrateur
│   ├── models/                    # Accès aux utilisateurs et conversations
│   ├── routes/                    # Routes Express
│   └── services/aiService.js      # Adaptateurs Ollama et API compatible OpenAI
├── test/api.test.js               # Tests d’intégration de l’API
├── .env.example                   # Exemple de configuration locale
├── docker-compose.yml             # Application et Ollama
├── Dockerfile
├── render.yaml                    # Blueprint Render
├── package.json
└── vite.config.js
```

Le serveur suit une organisation MVC : les routes délèguent aux contrôleurs, les modèles encapsulent les accès SQLite, et les services isolent l’inférence.

## Installation locale

Prérequis : Node.js 24 ou supérieur, npm et [Ollama](https://ollama.com/download).

```powershell
git clone https://github.com/caleblabi69-crypto/Friend.git
cd Friend
git checkout main
git pull
npm install
Copy-Item .env.example .env
ollama pull llama3
npm run dev
```

Ouvrez `http://localhost:5173`. Le serveur API écoute sur `http://localhost:3000`. Vous pouvez créer un compte sur l’écran de connexion ; les mots de passe doivent contenir au moins 10 caractères.

Pour ouvrir la documentation API, démarrez l’application puis consultez `http://localhost:3000/api-docs`. Configuration initiale disponible dans `.env` :

| Variable | Valeur locale par défaut / rôle |
|---|---|
| `AI_PROVIDER` | `ollama` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `llama3` |
| `DATABASE_PATH` | `./data/friend.sqlite` |
| `UPLOAD_DIR` | `./uploads` |
| `JWT_SECRET` | Remplacer par une chaîne aléatoire longue avant tout déploiement |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Facultatifs ; créent le compte admin au premier démarrage |
| `ALLOW_REGISTRATION` | `true` en local ; mettre `false` pour fermer les inscriptions |

Un administrateur provisionné par variables d’environnement est créé au premier démarrage seulement si son adresse n’existe pas encore. En production, utilisez un secret JWT d’au moins 32 octets et désactivez les inscriptions publiques.

### Fournisseur hébergé

Pour une API compatible OpenAI, configurez le serveur (ou le service hébergé) ainsi :

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://votre-fournisseur.example/v1
AI_API_KEY=votre-cle-privee
AI_MODEL=nom-du-modele
```

Gardez la clé uniquement côté serveur et dans les secrets du fournisseur d’hébergement. Le fournisseur doit prendre en charge le streaming ; les modèles traitant des images sont nécessaires pour analyser les pièces jointes visuelles. En mode `ollama`, Friend se connecte au service configuré sur la machine du serveur, jamais à l’Ollama de l’utilisateur depuis Render.

## Commandes de développement

```powershell
npm run dev       # Vite + serveur Express
npm run build     # Compile l’interface de production
npm start         # Démarre Express et sert frontend/dist en production
npm test          # Tests d’intégration API
npm run lint      # Vérification syntaxique du serveur
```

## Docker Compose

Docker Desktop doit être installé. Compose garde le port Ollama lié à `127.0.0.1` uniquement :

```powershell
docker compose up --build -d
docker compose exec ollama ollama pull llama3
```

Puis ouvrez `http://localhost:3000`. Les données SQLite, les fichiers et les poids Ollama sont conservés dans des volumes Docker. Pour arrêter :

```powershell
docker compose down
```

Ne publiez jamais le port `11434` sur une interface réseau publique. Pour utiliser un fournisseur hébergé avec Compose, définissez `AI_PROVIDER=openai-compatible`, `AI_BASE_URL`, `AI_API_KEY` et `AI_MODEL` dans un fichier `.env` local non versionné.

## Déploiement sur Render

Le dépôt contient `render.yaml` pour créer un service web Node avec un disque persistant (`/var/data`) pour SQLite et les fichiers. Le modèle sélectionne un fournisseur compatible OpenAI ; le serveur Ollama local n’est pas utilisé ni exposé.

1. Poussez cette branche sur GitHub, puis créez un **Blueprint** dans Render et sélectionnez le dépôt et la branche.
2. Pendant la configuration du Blueprint, renseignez `AI_BASE_URL`, `AI_API_KEY` et `AI_MODEL` depuis le fournisseur choisi, ainsi que `ADMIN_EMAIL` et un mot de passe admin fort.
3. Lancez le déploiement, puis vérifiez `https://<votre-service>.onrender.com/api/health` et ouvrez l’URL fournie par Render.
4. Connectez-vous avec le compte admin et vérifiez une requête réelle au modèle. L’application n’est effectivement déployée que lorsque Render affiche le service actif et fournit son URL.

Les variables marquées `sync: false` sont des secrets/configurations à saisir dans Render. Ne mettez aucune clé API dans Git. Le plan du service et le disque peuvent être facturés selon le compte Render ; vérifiez les coûts avant confirmation.

## Git et npm

Exemple pour actualiser la branche de travail et lancer les vérifications :

```powershell
git status
git add .
git commit -m "Build Friend AI chat application"
git push -u origin caleblabi69-crypto-friend-implementation-deployment
npm install
npm test
npm run build
```

Ne versionnez jamais `.env`, les données SQLite, les fichiers téléversés ou des secrets. `.gitignore` les exclut.

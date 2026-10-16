# Frontend — Gestion et suivi des marchés de restauration

Application React (Vite + Tailwind) câblée sur le backend Spring Boot fourni
séparément (`backend-gestion-marches-restauration.zip`). Contrairement au
prototype de démonstration, il n'y a plus de rôles simulés : l'utilisateur se
connecte avec un vrai compte, et toutes les données viennent de l'API.

## ✅ Build vérifié

Ce projet a été réellement installé (`npm install`) et compilé (`npm run build`)
avant livraison — contrairement au backend Java (Maven Central est bloqué dans
l'environnement où j'ai travaillé), j'ai un accès complet au registre npm ici,
donc cette vérification est réelle, pas seulement une relecture de code.

## Démarrage rapide

Prérequis : **Node.js 18+** et **npm**.

```bash
cd frontend
npm install
cp .env.example .env
# éditer .env si le backend ne tourne pas sur http://localhost:8080
npm run dev
```

L'application démarre sur `http://localhost:5173`. Assurez-vous que le backend
tourne (`mvn spring-boot:run` dans le dossier `backend/`) et connectez-vous
avec l'un des comptes de démonstration : `admin` / `admin123`, `comptable` /
`comptable123`, `gestionnaire` / `gestionnaire123`, `cuisinier` / `cuisinier123`.

## Comment le câblage fonctionne

- **`src/api.js`** — client HTTP unique. Toutes les requêtes passent par la
  fonction `requete()`, qui ajoute l'en-tête `Authorization: Basic …` construit
  à partir des identifiants saisis à la connexion, et transforme les erreurs du
  backend (`ErreurResponse`) en `ApiError` exploitable dans l'interface.
- **`src/Login.jsx`** — envoie les identifiants à `GET /api/utilisateurs/moi`.
  Si la réponse est 200, le rôle renvoyé par le serveur pilote tout l'affichage
  (menu, boutons visibles) via `ROLE_KEY_BY_BACKEND` dans `App.jsx`.
- **`src/App.jsx`** — recharge les données nécessaires au rôle connecté au
  chargement (`chargerTout()`), puis après chaque création / modification /
  annulation. Les quantités et montants (solde disponible, montant exécuté,
  etc.) ne sont **plus calculés côté client** : ils viennent directement des
  réponses de l'API (le backend fait tous les calculs, garantissant que
  l'interface ne peut jamais afficher un solde incohérent avec ce que le
  serveur autoriserait réellement).
- **Blocages de solde** (ex. commande dépassant le solde disponible) : le
  backend répond HTTP 409 avec un message explicite (`SoldeDepasseException`) ;
  ce message est affiché tel quel dans la fenêtre "Action refusée".

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `VITE_API_BASE_URL` | URL de base de l'API backend | `http://localhost:8080` |

Vite n'expose que les variables préfixées `VITE_`. Pour la production, créez
un fichier `.env.production` avec l'URL réelle du backend déployé, ou définissez
la variable dans les paramètres de votre plateforme de déploiement (voir plus bas).

## ⚠️ Modifications apportées au backend pour permettre le câblage

Deux ajouts ont été faits au projet backend livré précédemment (déjà inclus
dans le zip backend joint à ce message) :

1. **`GET /api/utilisateurs/moi`** — nouvel endpoint (`UtilisateurController`)
   renvoyant l'identifiant, le nom complet et le rôle de l'utilisateur
   authentifié. Nécessaire pour que le frontend sache quel menu afficher après
   la connexion.
2. **CORS** (`SecurityConfig`) — le navigateur bloque par défaut les requêtes
   d'un frontend servi sur un autre domaine/port que l'API. Les origines
   autorisées sont configurables sans recompiler via la variable
   d'environnement `CORS_ALLOWED_ORIGINS` côté backend (liste séparée par des
   virgules), avec `http://localhost:5173` et `http://localhost:4173` autorisés
   par défaut pour le développement local.

   En production, démarrez le backend avec, par exemple :
   ```bash
   export CORS_ALLOWED_ORIGINS=https://marches.mon-domaine.org
   ```

## Déploiement

Le build (`npm run build`) génère un dossier `dist/` **100% statique**
(HTML/CSS/JS) — aucun serveur Node n'est requis en production. Options :

### Render (Static Site) — configuration fournie

Le fichier [`render.yaml`](render.yaml) décrit le service (build, dossier
publié, réécriture SPA, en-têtes de cache).

1. Poussez le dépôt sur GitHub.
2. Sur Render : **New > Blueprint**, puis sélectionnez le dépôt.
3. Renseignez `VITE_API_BASE_URL` quand Render la demande, avec l'URL publique
   du backend **sans `/` final**, par exemple `https://marches-api.onrender.com`.
4. Côté backend, ajoutez l'URL du frontend aux origines CORS autorisées :
   `CORS_ALLOWED_ORIGINS=https://marches-restauration-frontend.onrender.com`.

Si vous changez `VITE_API_BASE_URL` plus tard, relancez un déploiement
(**Manual Deploy > Clear build cache & deploy**) : la valeur est figée au build.

Sans Blueprint (New > Static Site) : Build Command `npm ci && npm run build`,
Publish Directory `dist`, et une règle **Redirects/Rewrites** `/*` → `/index.html`
(Rewrite).

### Option A — Hébergeur statique (Netlify, Vercel, GitHub Pages, S3+CloudFront…)
```bash
npm run build
# déployer le contenu de dist/
```
Définissez `VITE_API_BASE_URL` dans les variables d'environnement de build de
la plateforme (elle est lue **au moment du build**, pas à l'exécution).

### Option B — Nginx (sur le même serveur que le backend, ou séparé)
```nginx
server {
    listen 80;
    server_name marches.mon-domaine.org;

    root /var/www/marches-frontend/dist;
    index index.html;
    location / { try_files $uri /index.html; }  # SPA : toutes les routes vers index.html
}
```
Servez `dist/` tel quel après `npm run build` avec `VITE_API_BASE_URL` pointant
vers l'URL publique du backend.

### Option C — Même domaine que le backend (recommandé, évite tout souci CORS)
Faites reverse-proxyer `/api/**` vers Spring Boot depuis le même Nginx qui sert
`dist/` :
```nginx
location /api/ { proxy_pass http://localhost:8080; }
location /      { try_files $uri /index.html; }
```
Dans ce cas, `VITE_API_BASE_URL` peut simplement être une chaîne vide (`""`)
puisque le frontend et l'API partagent alors la même origine.

## Sécurité — points à ne pas oublier avant une mise en production réelle

- **HTTPS obligatoire.** HTTP Basic envoie l'identifiant et le mot de passe
  encodés en base64 (pas chiffrés) à chaque requête : sans HTTPS, ils sont
  interceptables. Le backend doit être déployé derrière TLS (voir le README
  backend).
- Les identifiants sont conservés en mémoire côté frontend (variable JS), pas
  dans `localStorage`/`sessionStorage` : ils disparaissent à l'actualisation de
  la page (l'utilisateur doit se reconnecter). C'est un choix volontaire pour
  limiter l'exposition ; si vous voulez une session persistante, ajoutez un
  stockage chiffré ou passez à un vrai jeton (JWT) côté backend.
- Changez les mots de passe de démonstration (`admin123`, etc.) avant tout
  déploiement réel — voir le README backend, section "Passage en production".

## Ce qui n'est pas encore câblé

- Les **exports Excel/PDF** (section 8 du cahier des charges) : le backend ne
  les expose pas encore (voir "Limites connues" du README backend) ; à ajouter
  des deux côtés en même temps le moment venu.
- La **gestion documentaire** (pièces jointes : contrats scannés, justificatifs)
  n'a pas d'écran dédié ici ; les champs existent côté backend
  (`documentMarche`, `pieceJustificative`, …) mais attendent un vrai stockage
  de fichiers.

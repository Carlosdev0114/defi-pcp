# SECURITY.md

Mesures de sécurité du projet, du login au rendu. L'identification des
clients par IP (`getClientIp()`, `TRUST_PROXY`) et les seuils du rate limiting
sont décrits dans le [README](README.md#ip-client-proxy-et-rate-limiting) ;
la justification de `'unsafe-inline'` sur les pages publiques aussi
([README](README.md#content-security-policy)).

Les preuves automatisées sont dans `tests/` : `qa-admin-guard` (chaque page
et route admin sans session), `qa-xss`, `qa-upload`, `qa-pagination`,
`qa-rate-limit`, `safe-redirect`, `visitor-token`, `csp`, `client-ip`.

## Authentification et session admin

Seul un compte `ADMIN` peut se connecter ; il n'existe pas de compte visiteur.

- **Mot de passe** : hash **bcrypt** (coût 10) dans `User.passwordHash`,
  jamais en clair. Le compte initial est créé par le seed à partir de
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` (8 caractères minimum).
- **Login** (`POST /api/auth/login`) : même réponse `401 « Identifiants
  incorrects. »` pour un e-mail inconnu, un mauvais mot de passe ou un rôle
  insuffisant. Quand l'e-mail est inconnu, le mot de passe est quand même
  comparé à un hash factice : le temps de réponse ne révèle pas l'existence
  d'un compte.
- **Brute force** : 20 tentatives / 10 min par IP **et** 5 / 10 min par
  e-mail (fenêtres glissantes Redis). La limite par e-mail protège un compte
  même si l'attaquant change d'IP.
- **Session** = JWT **HS256** signé avec `SESSION_SECRET` (32 caractères
  minimum, sinon aucune session n'est créée ni acceptée) **+** une
  entrée Redis `session:<jti>`. Un jeton à la signature valide est refusé si
  son entrée Redis a disparu : la session est donc **révocable**.
- **Cookie** `pcs_session` : `HttpOnly`, `SameSite=Lax`, `Secure` en
  production, `Path=/`, durée **7 jours** (même TTL pour le JWT et l'entrée
  Redis).
- **Déconnexion** (`POST /api/auth/logout`) : supprime l'entrée Redis puis
  efface le cookie. Si Redis ne répond pas, le cookie est tout de même effacé
  et l'entrée expire avec son TTL.

### Contrôle d'accès en trois couches

Chaque couche revérifie la session côté serveur ; aucune ne fait confiance à
un en-tête envoyé par le client.

1. **`proxy.ts`** (ex-middleware) : `/admin/*` sans session admin → redirection
   vers `/login?next=…` ; `/api/admin/*` → `401`. Les routes `/api` sont
   **refusées par défaut** : seules `/api/auth/*`, `/api/contact`,
   `/api/appointments`, `/api/chat` et `/api/public/*` sont ouvertes.
2. **Layout admin** (`app/(admin)/admin/layout.tsx`) : `requireAdminPage()`
   couvre toutes les pages `/admin`.
3. **Chaque route `/api/admin`** : `withAdmin()` → `requireAdmin()`, qui
   **relit le rôle en base**. Un compte supprimé ou rétrogradé perd l'accès
   immédiatement, même avec un jeton encore valide. Seul le polling
   `/api/admin/updates` se contente du jeton et de Redis (voir « Notifications
   et back-office »).

Si le secret ou Redis sont indisponibles, la vérification **échoue fermée**
(pas de session).

### Redirection après login et CSRF

- **Redirection ouverte corrigée** : le paramètre `?next=` n'est suivi que
  s'il désigne un chemin interne (`safeRedirectPath`, `lib/safe-redirect.ts`),
  quelle que soit la couche d'encodage (`//evil.com`, `/\evil.com`,
  `%2F%2Fevil.com`, tabulation ou saut de ligne glissés dans `//`,
  `https://…`, `javascript:`…) ; sinon, retour sur `/admin`. Couvert par
  `tests/safe-redirect.test.ts`.
- **CSRF** : en plus de `SameSite=Lax`, `proxy.ts` refuse (`403`) toute
  requête `/api` qui modifie l'état (hors GET/HEAD/OPTIONS) avec un en-tête
  `Origin` différent de celui du site.

## Surface de l'API

- **Validation Zod** de toutes les entrées : corps, query string, et
  identifiants d'URL (`parseId()` → `400 « Identifiant invalide. »`). Les
  schémas partagés avec le client vivent dans `lib/schemas/`.
- **Corps JSON bornés** : 16 Ko par défaut (`MAX_JSON_BYTES`), moins sur
  certaines routes (4 Ko pour le chat).
- **Méthodes explicites** : une route n'exporte que les méthodes qu'elle
  accepte ; les autres reçoivent `405`.
- **Erreurs sans fuite** : les erreurs Prisma connues deviennent
  `404`/`409` ; tout le reste est un `500` générique, le détail ne va que dans
  les logs serveur (pas de trace de pile, pas de message Gemini).
- **Requêtes Prisma uniquement**, aucune concaténation SQL.
- **Pagination imposée** : `pageSize` au-delà de 50 → `400` (pas de plafond
  silencieux).

## Uploads (médiathèque admin)

Pipeline de `lib/server/media.ts`, commun aux deux supports de stockage :

1. **Contrôles avant lecture** (`POST /api/admin/media`, admin uniquement) :
   `Content-Type` autre que `multipart/form-data` → `415` ; taille annoncée
   au-delà de 4 Mo (+ marge d'enveloppe) → `413`.
2. **Taille réelle** : fichier vide ou de plus de **4 Mo** refusé, vérifié sur
   la taille annoncée **et** sur les octets lus.
3. **Type réel** déduit des premiers octets (magic bytes) : JPEG, PNG, WebP,
   AVIF uniquement. Ni l'extension ni le type déclaré ne font foi, et un type
   déclaré qui contredit le contenu est refusé. **SVG refusé** (XML
   exécutable).
4. **Décodage réel par sharp**, avec un plafond de 40 millions de pixels
   (bombe de décompression) : un fichier qui n'est pas une image échoue.
5. **Réencodage WebP**, largeur maximale 2 000 px : supprime EXIF/GPS et toute
   charge cachée dans le fichier d'origine.
6. **Nom aléatoire** (UUID + `.webp`) : rien du nom d'origine n'est conservé.

Tout refus renvoie `422` avec un message lisible ; rien n'est stocké.

**Stockage** (`STORAGE_DRIVER`) :
- `local` (développement) : dossier `UPLOAD_DIR` (défaut `./uploads`), **hors
  de `public/`**. Les fichiers sont servis par `app/media/[file]/route.ts`,
  qui n'accepte qu'une clé au format UUID + `.webp` (aucune traversée de
  répertoire possible) et répond avec `X-Content-Type-Options: nosniff` et
  une CSP `default-src 'none'; sandbox`.
- `vercel-blob` (production) : fichiers sur le CDN Vercel Blob, jeton
  `BLOB_READ_WRITE_TOKEN` côté serveur uniquement. Le domaine du CDN n'est
  autorisé (`img-src`, `remotePatterns` de `next/image`) que si ce driver est
  actif.

## En-têtes HTTP

### Content-Security-Policy

Construite par `lib/csp.ts`, en deux variantes qui ne diffèrent que par
`script-src` :

| Routes | Posée par | `script-src` |
|---|---|---|
| Pages publiques | `next.config.ts` (en-tête statique) | `'self' 'unsafe-inline'` |
| `/admin/*`, `/login` | `proxy.ts` (à chaque requête) | `'self' 'nonce-<aléatoire>' 'strict-dynamic'` |

- **Nonce** : 128 bits aléatoires, nouveaux à chaque requête ; les pages
  concernées sont rendues à la demande. Aucun `'unsafe-inline'` en script sur
  les pages qui portent la session admin. `next.config.ts` exclut ces routes
  pour qu'elles ne reçoivent pas deux CSP.
- **Directives communes** : `default-src 'self'`, `style-src 'self'
  'unsafe-inline'` (attributs `style={…}`), `img-src 'self' data: blob:` (+ CDN
  Blob si actif), `font-src 'self'`, `connect-src 'self'` (Gemini, Upstash,
  Neon et Blob ne sont appelés que par le serveur), `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests` en production.
- **Pas de `'unsafe-eval'` en production** (développement uniquement). Zod
  est configuré en mode `jitless` (`lib/schemas/zod.ts`), sinon il tente un
  `new Function` que la CSP bloque.
- Pourquoi `'unsafe-inline'` reste sur les pages publiques et ce qui le
  compense : voir le [README](README.md#content-security-policy).

### Autres en-têtes (toutes les routes, `next.config.ts`)

| En-tête | Valeur |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production uniquement) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

`X-Powered-By` est désactivé. L'optimiseur d'images sert les SVG locaux du
site (illustrations faites main dans `public/`) en pièce jointe, avec une CSP
`default-src 'self'; script-src 'none'; sandbox`.

## Assistant IA

- **Clé Gemini côté serveur uniquement** (`GEMINI_API_KEY`, jamais
  `NEXT_PUBLIC_`) ; le navigateur ne parle qu'à `/api/chat`.
- **Base de connaissances publique** : uniquement le contenu publié (projets,
  articles), le parcours, les compétences, les services actifs et le profil.
  Jamais de leads, messages, rendez-vous ni e-mails privés. Couvert par
  `tests/rag-knowledge.test.ts`.
- **Prompt injection** : les règles du prompt système sont figées dans le
  code ; la question du visiteur et les extraits sont délimités et déclarés
  comme données, jamais comme instructions ; les balises de délimitation
  injectées par un visiteur sont neutralisées ; les consignes de
  l'administrateur sont ajoutées après les règles et ne peuvent pas les lever.
- **Hors sujet** : sans extrait assez proche, réponse fixe « Je n'ai pas
  cette information dans les données publiques du candidat. », sans appel au
  modèle de génération.
- **Coût** : 5 questions / 30 s et 60 / jour par IP, plus une limite globale
  (8 / min par défaut) ; quota atteint → `503` + `Retry-After: 60`, sans
  détail interne.
- Les réponses sont rendues en **texte**, jamais en HTML ni en Markdown.

## Secrets

- `.env` n'est pas versionné ; `.env.example` liste toutes les variables avec
  des valeurs factices.
- Aucun secret n'est exposé au client : aucune variable `NEXT_PUBLIC_` dans
  le code, et les modules qui manipulent un secret (`db`, `redis`,
  `session-core`, `rag/gemini`, `rag/chat`, `storage`, `media`,
  `site-config`) importent `server-only`, ce qui fait échouer le build si un
  composant client les importe.

## Messagerie visiteur

### Accès d'un visiteur à SA conversation

Le visiteur n'a pas de compte et le schéma n'a pas de colonne « secret » sur
`Conversation`. L'accès repose sur un **jeton signé** :

- contenu : `{ c: conversationId, e: expiration }`, encodé puis signé
  **HMAC-SHA256** ;
- clé **dérivée** de `SESSION_SECRET` avec un label propre
  (`pcp/visitor-conversation/v1`) : un jeton de session admin ne peut pas
  servir de jeton visiteur, ni l'inverse, et changer `SESSION_SECRET`
  invalide tous les jetons ;
- vérification en **temps constant** (`timingSafeEqual`), refus si signature,
  format ou expiration invalides ;
- cookie `pcs_conv` : **HttpOnly, Secure, SameSite=Lax, 30 jours**.

Le serveur **ignore tout identifiant de conversation envoyé par le client** :
les routes visiteur n'ont pas de paramètre `id` (`/current`), les corps sont
validés en `.strict()` (champ en trop → 400) et la conversation est lue
**uniquement** dans le cookie signé.

Couvert par des tests : cookie forgé, cookie d'une autre conversation
(identifiant échangé), cookie expiré, clé non dérivée, identifiant injecté dans
le corps ou la query string, et visiteur sur les routes admin (401).

### Autres protections

- Validation Zod **partagée** client/serveur (`lib/schemas/message.ts`) :
  message non vide, **2 000 caractères maximum**, corps limité à 8 Ko.
- Rate limiting : ouverture de conversation 3/h par IP ; envoi 10/min par IP
  **et** 30/10 min par conversation (changer d'IP ne contourne pas la limite).
- Contenu stocké et rendu en **texte simple** : React échappe tout, aucun
  `dangerouslySetInnerHTML`, aucun Markdown interprété (côté visiteur comme
  côté admin, notifications comprises).

### Limites connues

- **Perte d'accès si le visiteur efface ses cookies** (ou change de navigateur
  ou d'appareil) : il ne peut plus lire sa conversation ni y répondre. Il peut
  en ouvrir une nouvelle ; l'historique reste visible côté admin. Aucun lien
  de récupération n'est envoyé par e-mail (pas d'envoi d'e-mail dans le projet).
- Le jeton n'est pas révocable individuellement (pas de colonne en base) : il
  expire après 30 jours, ou tous ensemble si `SESSION_SECRET` change.

## Notifications et back-office

- Toutes les routes admin exigent une session admin **vérifiée côté serveur**
  (401 sinon) ; un visiteur, même avec son cookie de conversation, reçoit 401.
- **L'état « lu » est commun à tous les admins.** `Notification` n'a pas de
  colonne `userId` (schéma imposé) : une notification ou un message marqué lu
  par un admin l'est pour tous. Sans importance avec un seul admin (cas
  actuel) ; isoler l'état par admin nécessiterait d'ajouter
  `Notification.userId`.
- Les messages n'ont pas de champ « lu » : l'état non-lu d'un message vit dans
  sa notification `message`. Ouvrir une conversation marque lues les seules
  notifications **de cette conversation** (couvert par un test).
- **Vérification allégée pour le polling** : `/api/admin/updates` vérifie la
  session par JWT signé + entrée Redis (révocable à la déconnexion) et le rôle
  ADMIN contenu dans le jeton, **sans relire le rôle en base**, afin que le
  poll ne réveille pas PostgreSQL. Cette route ne renvoie que des compteurs.
  Toutes les routes qui lisent ou modifient des données relisent le rôle en
  base (`requireAdmin`).

## Mesure d'audience

- Aucune IP, aucun cookie, aucun identifiant ni User-Agent n'est stocké :
  uniquement des compteurs de pages vues par jour et par chemin.
- Chemins validés contre les routes publiques connues ; robots ignorés ;
  plafond global de 600 pages vues/min (clé unique, sans IP).
- Limite : les compteurs peuvent être gonflés jusqu'au plafond global par un
  script (pas de limite par IP, justement pour ne pas en conserver).

### Dépassement du plafond : `204` silencieux, pas `429`

Au-delà de **600 pages vues/min** (règle `visitGlobal`,
`lib/server/rate-limit.ts`), `POST /api/public/visit` répond **`204` sans
compter**, et non `429` + `Retry-After` comme les autres routes limitées.
Choix délibéré :

- **n'informe pas un robot** : la réponse est identique qu'une vue soit
  comptée, ignorée (robot, chemin inconnu) ou refusée par le plafond ; un
  script ne peut ni détecter le plafond ni caler son débit dessus ;
- **le beacon ne lit pas la réponse** : `navigator.sendBeacon`
  (`components/site/VisitBeacon.tsx`) n'expose ni statut ni en-tête, un
  `Retry-After` ne serait donc jamais exploité par le client légitime.

Comportement figé par `tests/qa-rate-limit.test.ts` (600 vues comptées,
601ᵉ en `204` sans `Retry-After`).

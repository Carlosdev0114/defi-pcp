# ARCHITECTURE.md

Vue d'ensemble de l'application, puis détail du temps réel, du budget Redis
et de la mesure d'audience, et enfin les décisions techniques structurantes.
Le modèle de données est dans [DATABASE.md](DATABASE.md), la sécurité dans
[SECURITY.md](SECURITY.md), les mesures dans [PERFORMANCE.md](PERFORMANCE.md).

```
Navigateur ──► Vercel (Next.js 16)
                ├─ proxy.ts : contrôle de session, CSP à nonce, CSRF
                ├─ pages publiques : statiques, revalidées
                ├─ /admin : rendu à chaque requête
                └─ route handlers /api/*
                      ├─► Neon PostgreSQL (Prisma)   contenu, CRM, RDV, messagerie
                      ├─► Upstash Redis (REST)       sessions, limites, caches, config, index RAG
                      ├─► Gemini (REST)              embeddings + génération
                      └─► Vercel Blob                médias (disque local en dev)
```

## Frontend

- **Deux espaces** dans `app/`, séparés par des route groups : `(site)` pour
  le portfolio public, `(admin)` pour `/admin` et `/login`. Chacun a son
  layout ; celui de `/admin` vérifie la session et couvre toutes ses pages.
- **Server Components par défaut.** Les pages publiques lisent la base
  directement (`lib/server/content.ts`, Prisma), sans passer par l'API, et
  rendent le contenu éditorial via `components/content/Markdown.tsx` (sans
  HTML brut). Ne sont des Client Components que les éléments interactifs :
  formulaires (contact, réservation), menu mobile, widgets, beacon de visite.
- **Widgets** (assistant IA, messagerie) : un seul point d'entrée,
  `WidgetStack`, présent sur toutes les pages publiques ; les panneaux sont
  chargés à leur première ouverture (`next/dynamic`), pour ne pas alourdir
  chaque page.
- **Back-office** : chaque page `/admin` est une coquille serveur qui monte un
  « manager » client (`ProjectsManager`, `LeadsBoard`, `MessagesBoard`…).
  Ceux-ci appellent `/api/admin/*` via des clients typés par domaine
  (`lib/admin`, `lib/crm`, `lib/booking`…) construits sur
  `lib/http/client.ts`, qui ramène toute erreur à un résultat typé.
- **Découpage** : 79 composants dans `components/` (`site`, `widgets`,
  `admin/<domaine>`, `content`, `ui`), chacun centré sur une responsabilité.
- **Images** : `next/image` partout, avec `sizes`, et `preload` (ou
  `priority` pour l'illustration de l'accueil) sur l'image principale ; polices via `next/font` (auto-hébergées). Direction
  artistique : [docs/DESIGN.md](docs/DESIGN.md).

## Backend et API

- **Route handlers** regroupés par public : `/api/public/*` (lectures du
  contenu publié, créneaux, messagerie visiteur, visites), `/api/admin/*`
  (back-office), `/api/auth/*`, et trois routes d'écriture publiques :
  `/api/contact`, `/api/appointments`, `/api/chat`. Toute autre route `/api`
  est refusée par `proxy.ts` (liste d'autorisation).
- **Helpers communs** (`lib/server/api.ts`) : `withAdmin()` (session + rôle
  relu en base) et `withErrors()` encadrent les handlers (les routes
  `/api/auth/*` et `/api/admin/overview` gèrent leurs erreurs elles-mêmes) ;
  `parseJsonBody()` borne la taille du corps et valide avec Zod ;
  `parseQuery()` / `paginationSchema` / `toSkipTake()` / `paginated()`
  uniformisent la pagination (50 éléments maximum) ; `handleApiError()`
  traduit les erreurs Prisma et masque le reste.
- **Logique métier** dans `lib/server/<domaine>` (`booking`, `crm`,
  `messaging`, `appointments`, `dashboard`…) : les routes restent minces.
- **Transactions** pour toute opération multi-tables : contact + lead +
  événement + notification ; changement de statut d'un lead ; réservation en
  `SERIALIZABLE` avec un rejeu (deux réservations simultanées du même
  créneau : une seule passe) ; remplacement atomique du planning.
- **Effets après écriture** : `revalidateContent()` régénère les pages
  publiques concernées, invalide le cache Redis des API publiques et marque
  l'index du chatbot comme périmé ; les compteurs temps réel sont
  incrémentés (best-effort, voir plus bas).

## Base de données

PostgreSQL (Neon) via Prisma 6, avec un schéma **imposé** par l'énoncé et
utilisé tel quel. Modèles, index, choix de modélisation et seed :
[DATABASE.md](DATABASE.md).

Redis complète la base pour ce que le schéma ne prévoit pas ou qui ne doit
pas réveiller PostgreSQL :

| Données | Clés Redis | Pourquoi pas en base |
|---|---|---|
| Profil public, modules actifs | `public:profile`, `public:modules` | pas de table dans le schéma imposé ; lus par toutes les pages |
| Paramètres, réglages de l'assistant | `private:settings`, `private:assistant` | idem, lus par l'admin et le moteur du chatbot |
| Sessions admin | `session:<jti>` | révocation sans table de sessions ni requête SQL |
| Index du chatbot | `rag:*` | pas de pgvector dans le schéma |
| Limites, caches, compteurs temps réel, visites | `rl:*`, `cachever:*`, `rt:*`, `visits:*` | données éphémères ou à forte fréquence d'écriture |

La configuration (`lib/server/site-config.ts`) est validée par Zod à
l'écriture **et** à la lecture ; une valeur absente ou corrompue retombe sur
des valeurs par défaut.

## Infrastructure

- **Vercel** : fonctions serverless (Fluid compute) et CDN pour les pages
  statiques. `proxy.ts` (le middleware de Next 16) s'exécute avant chaque
  route.
- **Neon** : PostgreSQL serverless, qui se met en veille entre deux
  sollicitations. Le polling est conçu pour ne pas le réveiller ; le client
  Prisma laisse 10 s pour démarrer une transaction au réveil.
- **Upstash Redis** en REST : pas de connexion persistante à maintenir depuis
  des fonctions éphémères, compteurs partagés par toutes les instances.
- **Stockage des médias** derrière une interface unique
  (`lib/server/storage`), choisie par `STORAGE_DRIVER` : disque local
  (`./uploads`, servi par `/media/[file]`) en développement, Vercel Blob en
  production. La CSP (`img-src`) et `remotePatterns` suivent le même réglage.
- **Configuration** par variables d'environnement uniquement (voir
  `.env.example` et le [README](README.md#installation-locale)).

## IA : assistant RAG

1. **Base de connaissances** (`lib/server/rag/knowledge.ts`) : contenu
   **publié** uniquement (projets, articles), parcours, compétences, services
   actifs et profil ; découpée en morceaux d'environ 900 caractères, chacun
   préfixé par le titre de son document.
2. **Embeddings** Gemini (`gemini-embedding-001` par défaut, 768 dimensions).
3. **Index dans Redis** (`lib/server/rag/index.ts`) : quelques dizaines de
   morceaux, donc une recherche exhaustive par similarité cosinus suffit.
   L'index est marqué périmé à chaque écriture de contenu et reconstruit en
   arrière-plan (`after()`) à la question suivante, sous verrou, au plus une
   fois toutes les 10 min (quota Gemini). L'admin peut aussi le reconstruire
   depuis `/admin/assistant-ia`.
4. **Réponse** (`lib/server/rag/chat.ts`) : seuls les extraits au-dessus
   d'un score de similarité (0,45 par défaut, `RAG_MIN_SCORE`) sont retenus ;
   sans extrait pertinent, réponse fixe sans appel au modèle. Sinon,
   génération (`gemini-2.5-flash` par défaut) avec un prompt système figé
   dans le code.
5. **Garde-fous** (anti prompt injection, limites par IP et globale, clé
   côté serveur) : [SECURITY.md](SECURITY.md#assistant-ia).

## Sécurité (synthèse)

Détail dans [SECURITY.md](SECURITY.md).

- Session admin : JWT signé + entrée Redis révocable, cookie `HttpOnly`,
  contrôle en trois couches (proxy, layout, chaque route) avec relecture du
  rôle en base.
- Visiteur de la messagerie : cookie signé HMAC, jamais d'identifiant venant
  du client.
- Entrées validées par Zod, corps bornés, API refusée par défaut, erreurs
  sans détail interne, rate limiting par IP (`getClientIp()`, voir le
  [README](README.md#ip-client-proxy-et-rate-limiting)).
- Uploads : type réel, taille, réencodage WebP, SVG refusé.
- CSP à deux niveaux (nonce sur `/admin` et `/login`), HSTS et en-têtes de
  sécurité ; aucun rendu de HTML brut.

## Performance (synthèse)

Mesures, correctifs et limites : [PERFORMANCE.md](PERFORMANCE.md).

- **Pages publiques statiques**, revalidées au plus tard toutes les heures
  et régénérées à chaque écriture admin qui les concerne.
- **Profil et modules** lus via `unstable_cache` (étiquettes `site:profile`,
  `site:modules`, expirées par `revalidateTag` à l'écriture) : sans cela, la
  lecture Redis (`fetch` `no-store` côté Upstash) rendait tout le site
  dynamique.
- **Cache Redis des API publiques** (5 min), invalidé par un numéro de
  version par ressource : pas de `SCAN` ni de suppression de clés.
- **Polling** qui n'interroge PostgreSQL que si un compteur Redis a changé.
- **Médias** réencodés en WebP (2 000 px maximum) puis servis par
  `next/image` en tailles adaptées.
- **JavaScript** : widgets chargés à la demande ; Zod ne part plus sur les
  pages qui n'ont pas de formulaire.

## Temps réel : polling court filtré par Redis

### Décision

La messagerie et les notifications du back-office se mettent à jour par
**polling court**, filtré par un **numéro de version dans Redis** :

| Côté | Point d'entrée | Fréquence | Quand |
| --- | --- | --- | --- |
| Admin | `GET /api/admin/updates?since=<v>` | 10 s | onglet admin visible (un seul poll par onglet : `AdminRealtimeProvider`) |
| Visiteur | `GET /api/public/conversations/current?since=<v>&after=<id>` | 5 s | widget de messagerie ouvert, onglet visible, conversation existante |

- Chaque écriture intéressante incrémente un compteur : `rt:version` (global,
  admin) et `rt:conv:<id>` (par conversation, visiteur).
- Le poll lit **uniquement** ce compteur. S'il n'a pas bougé, la réponse
  `{ changed: false }` part **sans aucune requête PostgreSQL** (la session admin
  est vérifiée par JWT + Redis, voir SECURITY.md) : la base Neon peut se mettre
  en veille entre deux événements.
- Si la version a changé, le client recharge ce qu'il affiche (compteurs,
  liste, nouveaux messages après le dernier `id` connu).
- **Arrêt complet quand l'onglet est caché** (Page Visibility API), reprise
  immédiate à son retour.
- **Incréments best-effort** : ils ont lieu *après* la validation de la
  transaction ; s'ils échouent, l'écriture en base est déjà faite. Filet de
  sécurité : le client fait un **rafraîchissement complet toutes les 2 min 30**.

### Latence

- Admin : **≤ 10 s** après l'événement (+ durée de la requête).
- Visiteur : **≤ 5 s**.
- Onglet caché : aucune mise à jour pendant l'absence, rattrapage immédiat au retour.
- Incrément Redis perdu (panne) : rattrapé au plus tard au rafraîchissement
  complet suivant (**≤ 2 min 30**).

Suffisant pour une boîte de réception de portfolio ; pas pour un chat de
support en direct.

### Alternatives écartées

Contexte : déploiement Vercel, fonctions serverless (Fluid compute), durée
maximale 300 s (Hobby) / 800 s (Pro), mémoire allouée facturée pendant toute la
vie de l'instance (Hobby : 360 Go-h/mois inclus, 1 M d'appels, 4 h de CPU actif).

- **SSE (Server-Sent Events)** — écarté. Une fonction garde la connexion
  ouverte jusqu'à 300 s puis le client se reconnecte ; la mémoire est facturée
  pendant toute l'ouverture : un seul onglet admin ouvert 8 h/j × 22 j
  (176 h) consomme ~176 à 350 Go-h, soit la quasi-totalité du quota Hobby.
  Et sans bus d'événements entre instances, la fonction SSE devrait elle-même
  interroger Redis ou la base en boucle : c'est du polling déplacé côté
  serveur, en plus cher.
- **WebSocket via un service tiers (Pusher, Ably…)** — écarté. Vrai push, mais
  un nouveau fournisseur verrait passer les messages des visiteurs
  (sous-traitant au sens du RGPD), avec des clés en plus, une CSP
  `connect-src` à ouvrir vers un domaine `wss://` externe et une dépendance de
  plus, pour un gain de latence inutile ici.
- **Polling sans filtre Redis** — écarté : chaque poll interrogerait
  PostgreSQL et empêcherait Neon de se mettre en veille.

### Limites connues

- Latence de 5 à 10 s (voir plus haut), pas de notion de « en train d'écrire ».
- Le tableau de bord `/admin` est rendu côté serveur : il se met à jour à la
  navigation, pas en direct (la cloche et la messagerie, elles, sont en direct).
- Le budget Redis est dimensionné pour **un** onglet admin ouvert en continu
  (voir ci-dessous).
- **Réveil de Neon.** Le polling est conçu pour laisser la base se mettre en
  veille ; le premier accès après une veille prend alors quelques secondes.
  Avec le délai par défaut de Prisma (2 s pour démarrer une transaction), la
  première écriture échouait (P2028, constaté en test réel). Le client Prisma
  laisse désormais 10 s pour démarrer une transaction et 15 s pour l'exécuter
  (`lib/server/db.ts`) : la première action après une période calme est plus
  lente, mais n'échoue plus.

## Consommation Redis mensuelle (commandes Upstash)

Quota gratuit Upstash : **500 000 commandes/mois** ; au-delà, 0,20 $ les
100 000. Coûts unitaires relevés dans le code :

| Opération | Commandes Redis | Détail |
| --- | --- | --- |
| Poll admin (version inchangée) | **3** | `GET session` (proxy) + `GET session` (route) + `GET rt:version` |
| Poll visiteur | **1** | `GET rt:conv:<id>` (cookie vérifié sans Redis, route publique sans session) |
| Page vue (beacon) | **5** | rate limit global (1 `EVALSHA`) + pipeline `INCR`, `EXPIRE`, `HINCRBY`, `EXPIRE` |
| Message visiteur envoyé | **5** | 2 rate limits (`EVALSHA`) + `INCR rt:version` + `INCR`/`EXPIRE rt:conv` |
| Lecture des statistiques (tableau de bord ou `/admin/analytics`) | **31** | `MGET` 60 jours + 30 `HGETALL` |
| Rechargement d'un écran admin après un changement | **2** | `GET session` (proxy) + `GET session` (route) |

Hypothèses (à ajuster au trafic réel) : 1 onglet admin ouvert 8 h/j × 22 j
(176 h) ; 20 visiteurs/jour gardent le widget ouvert 3 min ; 3 000 pages vues
et 100 messages visiteur par mois ; 30 ouvertures des statistiques par jour.

| Poste | Calcul | Commandes/mois |
| --- | --- | --- |
| Polling admin | 176 h × 3 600 / 10 s = 63 360 polls × 3 | **190 080** |
| Rechargements admin (rafraîchissement complet toutes les 2 min 30, page messages ouverte) | 4 224 × 4 | **16 896** |
| Rechargements admin sur événement | ~1 100 événements × 2 écrans × 2 | **4 400** |
| Polling visiteur | 20 × 3 min × 30 j = 30 h × 3 600 / 5 s = 21 600 × 1 | **21 600** |
| Pages vues | 3 000 × 5 | **15 000** |
| Messages visiteur | 100 × 5 | **500** |
| Statistiques | 30 × 30 j × 31 | **27 900** |
| Existant (login, rate limits contact/RDV/chat, cache public, index RAG) | estimation | **~10 000** |
| **Total** | | **≈ 286 000** (57 % du quota gratuit) |

Lecture :
- Le **polling admin domine** (~2/3 du total). Un **second onglet admin**
  ouvert en continu ajoute ~211 000 commandes et amène le total à ~497 000,
  soit la limite du quota gratuit. Au-delà : passer en paiement à l'usage
  (~0,60 $ par tranche de 300 000 commandes), ou espacer le poll admin à 20 s
  (−95 000).
- 10 000 pages vues/mois au lieu de 3 000 : +35 000.
- Les statistiques pourraient être mises en cache (60 s) si leur lecture
  devenait fréquente.

## Mesure d'audience

Comptage minimal côté serveur, sans outil externe ni donnée personnelle :

- Un composant client (`VisitBeacon`) envoie `navigator.sendBeacon` avec le
  **seul chemin** de la page (respecte « Do Not Track »).
- `POST /api/public/visit` : chemin validé contre les routes publiques connues,
  robots ignorés (User-Agent lu puis oublié), plafond **global** de 600/min
  (clé unique, sans IP), puis `INCR visits:d:<jour>` et
  `HINCRBY visits:p:<jour> <chemin>` (jour en Europe/Paris, conservés 400 jours).
- **Aucune IP, aucun cookie, aucun identifiant, aucun User-Agent stocké.**
- Limites assumées : ce sont des **pages vues**, pas des visiteurs uniques ;
  sans limite par IP (ce qui imposerait d'en conserver une), un script peut
  gonfler les compteurs jusqu'au plafond global.
- Préféré à un comptage dans `proxy.ts`, qui compterait aussi les préchargements
  de liens (`next/link`), les requêtes HEAD et la plupart des robots.

## Décisions techniques

Les choix qui structurent le projet, avec l'alternative écartée à chaque fois.

| Décision | Alternative écartée | Pourquoi |
|---|---|---|
| **Profil, modules, paramètres et réglages de l'assistant dans Redis**, en JSON validé par Zod | Une table `SiteSettings` / `Profile` dans PostgreSQL | Le schéma Prisma est **imposé** : aucune table ni colonne ajoutée. Redis était déjà là (sessions, limites). Contrepartie : ces données ne participent pas aux transactions SQL et ne sont pas dans les sauvegardes Neon |
| **Temps réel par polling court filtré par un compteur Redis** | SSE ; WebSocket via un service tiers (Pusher, Ably) | SSE : une fonction ouverte en continu épuise le quota Vercel Hobby et devrait de toute façon interroger Redis en boucle. WebSocket tiers : un sous-traitant de plus voit les messages des visiteurs (RGPD), plus des clés et une CSP à ouvrir. La latence de 5 à 10 s suffit ici. Détail et chiffres : « Temps réel » plus haut |
| **Visiteur de la messagerie identifié par un cookie signé HMAC** | Un compte visiteur (`User` rôle `VISITOR`) ; un secret stocké sur `Conversation` | Un compte impose inscription et mot de passe pour envoyer un message ponctuel ; le schéma imposé n'a pas de colonne secrète. Contrepartie : pas de récupération si le cookie est effacé, pas de révocation individuelle. Voir [SECURITY.md](SECURITY.md#messagerie-visiteur) |
| **Session admin = JWT signé + entrée Redis** | JWT seul ; table de sessions | Un JWT seul n'est pas révocable avant expiration ; une table de sessions sort du schéma imposé et coûte une requête SQL à chaque vérification (dont chaque poll) |
| **Index du chatbot dans Redis, recherche cosinus exhaustive** | pgvector dans PostgreSQL | pgvector demande une extension et une colonne vectorielle hors du schéma imposé ; avec quelques dizaines de morceaux, une recherche exhaustive en mémoire est instantanée |
| **Pages publiques statiques** (`unstable_cache` + `revalidateTag` / `revalidatePath`) | Rendu dynamique à chaque visite | Le rendu dynamique coûtait une exécution de fonction et des lectures Redis par visite, sans cache CDN. Contrepartie : `unstable_cache` est déprécié dans Next 16 (`'use cache'` à terme) |
| **CSP : nonce sur `/admin` et `/login`, `'unsafe-inline'` sur le public** | Nonce partout ; hashes (`experimental.sri`) | Un nonce rendrait toutes les pages dynamiques ; les hashes ne couvrent pas les scripts inline de Next (testé). Le risque est compensé par l'absence de HTML brut ; la session n'est manipulée que sous CSP stricte. Voir le [README](README.md#content-security-policy) |
| **Couche de stockage avec deux drivers** (`local` / `vercel-blob`) | Écrire dans `public/` ; stocker les octets en base | `public/` est en lecture seule sur Vercel et mélangerait fichiers utilisateurs et code ; des octets en base alourdissent Neon et ne profitent d'aucun CDN |
| **Médias toujours réencodés en WebP** | Conserver le fichier d'origine | Le réencodage supprime EXIF/GPS et toute charge cachée (fichier polyglotte), et donne un format et un poids homogènes pour `next/image` |
| **Rate limiting en fenêtres glissantes dans Redis** | Compteurs en mémoire | Les instances serverless ne partagent pas leur mémoire : une limite en mémoire serait contournée en répartissant les requêtes |

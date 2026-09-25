# Personal Career Platform

Site personnel de candidat freelance, avec son back-office. Côté public : un
portfolio (profil, projets, articles, parcours, compétences), un formulaire de
contact, la réservation de rendez-vous, un assistant IA qui répond à partir
du contenu publié, et une messagerie avec le candidat. Côté `/admin` : la
gestion de tout ce contenu, un CRM des contacts et leads, l'agenda, la
messagerie, les médias et les statistiques de visite.

Aucun module n'est simulé : chaque écran lit et écrit de vraies données.

## Documentation

| Document | Contenu |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Temps réel (polling filtré par Redis), budget Redis, mesure d'audience |
| [DATABASE.md](DATABASE.md) | Modèle de données Prisma, choix de modélisation, ce qui vit dans Redis |
| [SECURITY.md](SECURITY.md) | Messagerie visiteur (cookie signé), notifications, mesure d'audience |
| [PERFORMANCE.md](PERFORMANCE.md) | Mesures Lighthouse, correctifs appliqués, limites connues |
| [docs/DESIGN.md](docs/DESIGN.md) | Direction artistique |

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, Tailwind CSS 4
- **Prisma 6** + **PostgreSQL (Neon)** : contenu, CRM, rendez-vous, messagerie
- **Redis (Upstash, API REST)** : sessions, rate limiting, cache des API
  publiques, configuration du site (profil, modules), index du chatbot,
  compteurs temps réel et de visites
- **Google Gemini** : réponses et embeddings de l'assistant (RAG), appelés
  depuis le serveur uniquement
- **Vercel Blob** : stockage des médias en production (disque local en
  développement), images réencodées en WebP par `sharp`, servies par
  `next/image`
- Zod 4 (validation partagée client/serveur), `jose` (JWT de session),
  `bcryptjs`, `react-markdown`
- Tests : **Vitest**. Déploiement prévu : **Vercel**

## Installation locale

Prérequis : **Node ≥ 22.18** (le seed exécute directement les schémas
TypeScript), une base Neon, une base Upstash Redis, une clé Gemini.

```bash
npm install                 # lance aussi `prisma generate`
cp .env.example .env        # puis remplir .env (jamais versionné)
npm run db:migrate          # prisma migrate deploy
npm run db:seed             # compte admin + contenu initial
npm run dev                 # http://localhost:3000
```

Variables d'environnement (détail et valeurs d'exemple dans `.env.example`) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL Neon (`?sslmode=require`) |
| `REDIS_URL`, `REDIS_TOKEN` | Upstash Redis (REST) |
| `SESSION_SECRET` | Signature des sessions admin et des jetons visiteur, 32 caractères minimum |
| `GEMINI_API_KEY` | Assistant IA (optionnels : `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `RAG_MIN_SCORE`) |
| `STORAGE_DRIVER` | `local` (défaut, dossier `UPLOAD_DIR` ou `./uploads`) ou `vercel-blob` (+ `BLOB_READ_WRITE_TOKEN`) |
| `TRUST_PROXY`, `TRUST_PROXY_HOPS` | Lecture de l'IP client derrière un proxy (voir plus bas) |
| `CHAT_GLOBAL_PER_MINUTE` | Limite globale du chatbot, défaut 8/min |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte admin créé par le seed (mot de passe de 8 caractères minimum) |

Le seed est **create-only** : le relancer n'écrase aucune modification faite
depuis le back-office ; seul le mot de passe admin est resynchronisé. Le
profil public est écrit dans Redis seulement s'il est absent.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build de production / serveur de production |
| `npm run lint` | ESLint |
| `npm test` | Tests Vitest, sans réseau (Redis, base et Gemini remplacés) |
| `npm run db:migrate` | Applique les migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed idempotent |
| `RUN_DB_TESTS=1 npx vitest run tests/booking-db.integration.test.ts` | Test d'intégration contre la vraie base : 5 réservations simultanées du même créneau donnent exactement 1 × 201 et 4 × 409. Supprime ses données à la fin |

Le typage se vérifie avec `npx tsc --noEmit`.

## Rendu et mise en cache

Les pages publiques (`/`, `/projets`, `/projets/[slug]`, `/articles`,
`/articles/[slug]`, `/parcours`, `/competences`, `/a-propos`, `/contact`,
`/reservation`) sont **statiques** : prérendues au build, revalidées au plus
tard toutes les heures, et régénérées dès qu'une écriture admin les concerne
(`revalidatePath` pour le contenu, `revalidateTag` pour le profil et les
modules). Un brouillon ou un contenu dépublié renvoie 404. `/admin`, `/login`
et `/media/[file]` sont rendues à chaque requête.

## IP client, proxy et rate limiting

Le rate limiting (login, chat, contact, réservation, messagerie) identifie les
clients par leur IP, via une fonction unique : `getClientIp()`
(`lib/server/client-ip.ts`).

- **Headers proxy ignorés par défaut.** `x-real-ip` / `x-forwarded-for` sont
  écrits par le client tant qu'aucun proxy de confiance ne les réécrit. Ils ne
  sont lus que si `TRUST_PROXY=true`.
- **Sur Vercel, confiance automatique** quand `VERCEL=1` (Vercel réécrit ces
  headers). Définir quand même `TRUST_PROXY=true` pour l'expliciter ;
  `TRUST_PROXY=false` désactive la confiance partout.
- **Ordre de lecture** : `x-real-ip` s'il contient une IP valide, sinon
  `x-forwarded-for` compté **depuis la droite** (`TRUST_PROXY_HOPS`, défaut 1 :
  l'élément ajouté par le proxy ; ceux de gauche sont falsifiables).
- **IPv6** ramenée à son préfixe `/64` ; IPv4 mappée (`::ffff:a.b.c.d`)
  ramenée à l'IPv4.
- **Repli** : IP absente, invalide ou headers non fiables → compartiment unique
  `unidentified`, partagé par tous ces clients (restrictif par construction).
- **Avertissement** : en production, si `TRUST_PROXY` n'est pas défini, un
  avertissement est journalisé une seule fois au premier appel. Hors Vercel et
  sans `TRUST_PROXY=true`, **tous les visiteurs partagent la même limite**.

Le login garde en plus un blocage **par compte** (5 essais / 10 min),
indépendant de l'IP. Le chat a une limite **globale**, toutes IP confondues
(`CHAT_GLOBAL_PER_MINUTE`, défaut 8/min, sous le quota gratuit Gemini),
vérifiée après la limite par IP ; dépassée, elle renvoie le même
`503` + `Retry-After: 60` qu'un quota Gemini atteint.

## Content-Security-Policy

Deux politiques, construites par `lib/csp.ts` :

| Routes | Source de l'en-tête | `script-src` | Rendu |
| --- | --- | --- | --- |
| Pages publiques | `next.config.ts` (statique) | `'self' 'unsafe-inline'` | statique, revalidé (voir « Rendu et mise en cache ») |
| `/admin/*`, `/login` | `proxy.ts` (par requête) | `'self' 'nonce-…' 'strict-dynamic'` | dynamique |

Les autres directives sont communes : `default-src 'self'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
`connect-src 'self'` (Gemini, Upstash, Neon et Blob ne sont appelés que depuis
le serveur), `img-src` étendu au CDN Vercel Blob seulement si
`STORAGE_DRIVER=vercel-blob`, `'unsafe-eval'` en développement uniquement.
`style-src` garde `'unsafe-inline'` partout : les composants utilisent des
attributs `style={…}`, qu'un nonce ne couvre pas.

### Pourquoi `'unsafe-inline'` reste sur les pages publiques

Next.js injecte dans chaque page des scripts inline `self.__next_f` :
l'amorce, puis le payload RSC de la page découpé en plusieurs morceaux (7
scripts au total sur `/`, ≈ 34 Kio non compressés, 6 Kio en gzip, mesurés
sur le HTML prérendu ; différent d'une page à l'autre). Aucun script inline
ne vient de notre code.

- **Nonce** : un nonce change à chaque requête, il impose donc de rendre
  chaque page à la demande. Les pages publiques perdraient leur rendu
  statique et le cache CDN, avec une exécution de fonction par visite.
- **`experimental.sri`** (hashes) : testé avec Next 16.3.6 / Turbopack, il
  n'ajoute `integrity` qu'aux fichiers JS externes (6 sur 9) et **jamais aux
  scripts inline** ; il ne permet donc pas de retirer `'unsafe-inline'`.

Le nonce est réservé à `/admin` et `/login` : `/admin` est de toute façon
dynamique (vérification de session), `/login` l'est devenue (`connection()`)
pour un coût négligeable. C'est là que se trouve la session admin.

### Ce qui compense sur les pages publiques

- **Aucun rendu de HTML brut** dans le code : ni `dangerouslySetInnerHTML`, ni
  `innerHTML`, ni `insertAdjacentHTML`. `tests/qa-xss.test.tsx` vérifie
  l'absence de `dangerouslySetInnerHTML` dans `app/`, `components/` et
  `lib/`, et celle de `innerHTML` dans `components/admin/`.
- **Contenu de la base rendu sans HTML** : les textes saisis dans l'admin
  (articles, descriptions de projets) passent par `components/content/Markdown.tsx`
  (`react-markdown` sans `rehype-raw`, `skipHtml`, liste blanche d'éléments,
  liens `http(s)` uniquement). Les messages, réponses de l'assistant et
  notifications sont rendus en texte simple, échappé par React.
- **URL validées à l'écriture** : slugs limités à `[a-z0-9-]`, `liveUrl` /
  `repoUrl` limitées à `http(s)` (pas de `javascript:`).
- **Session hors de portée d'un script** : cookie `HttpOnly`, et les pages qui
  la manipulent sont sous CSP stricte à nonce.
- **Exfiltration limitée** : `connect-src`, `form-action`, `img-src` et
  `default-src` restreints à l'origine du site.
- **Pas de `'unsafe-eval'` en production** : Zod est configuré en mode
  `jitless` (`lib/schemas/zod.ts`) pour ne pas tenter de compiler ses
  validateurs avec `new Function`.

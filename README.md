This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## IP client, proxy et rate limiting

Le rate limiting (login, chat, contact, réservation) identifie les clients par
leur IP, via une fonction unique : `getClientIp()` (`lib/server/client-ip.ts`).

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
| Pages publiques | `next.config.ts` (statique) | `'self' 'unsafe-inline'` | statique, cache CDN (`s-maxage=31536000`) |
| `/admin/*`, `/login` | `proxy.ts` (par requête) | `'self' 'nonce-…' 'strict-dynamic'` | dynamique |

Les autres directives sont communes : `default-src 'self'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
`connect-src 'self'` (Gemini, Upstash, Neon et Blob ne sont appelés que depuis
le serveur), `img-src` étendu au CDN Vercel Blob seulement si
`STORAGE_DRIVER=vercel-blob`, `'unsafe-eval'` en développement uniquement.
`style-src` garde `'unsafe-inline'` partout : les composants utilisent des
attributs `style={…}`, qu'un nonce ne couvre pas.

### Pourquoi `'unsafe-inline'` reste sur les pages publiques

Next.js injecte dans chaque page deux scripts inline : l'amorce
`self.__next_f` et le payload RSC de la page (≈ 34 Ko sur `/`, différent
d'une page à l'autre). Aucun script inline ne vient de notre code.

- **Nonce** : impose le rendu dynamique de chaque page, donc la perte du cache
  CDN (`s-maxage` → `no-store`) et une exécution de fonction par visite.
- **`experimental.sri`** (hashes) : testé avec Next 16.3.6 / Turbopack, il
  n'ajoute `integrity` qu'aux fichiers JS externes (6 sur 9) et **jamais aux
  scripts inline** ; il ne permet donc pas de retirer `'unsafe-inline'`.

Le nonce est réservé à `/admin` et `/login` : `/admin` est déjà dynamique
(vérification de session), `/login` l'est devenue (`connection()`) pour un
coût négligeable. C'est là que se trouve la session admin.

### Ce qui compense sur les pages publiques

- **Aucun rendu de HTML brut** dans le code : ni `dangerouslySetInnerHTML`, ni
  `innerHTML`, ni `insertAdjacentHTML`. Tout contenu passe par React, qui
  échappe le texte.
- **Pas de contenu utilisateur ni d'IA rendu côté public aujourd'hui** : les
  pages affichent le contenu maquette ; la base et Gemini ne sont exposés que
  via des API JSON (`X-Content-Type-Options: nosniff`).
- **URL validées à l'écriture** : slugs limités à `[a-z0-9-]`, `liveUrl` /
  `repoUrl` limitées à `http(s)` (pas de `javascript:`).
- **Session hors de portée d'un script** : cookie `HttpOnly`, et les pages qui
  la manipulent sont sous CSP stricte à nonce.
- **Exfiltration limitée** : `connect-src`, `form-action`, `img-src` et
  `default-src` restreints à l'origine du site.

Règle pour la suite (phase 3) : le contenu venant de la base ou de l'IA
(articles, réponses du chatbot, messages) doit être rendu comme **texte** ;
jamais de `dangerouslySetInnerHTML`, ni de conversion Markdown → HTML sans
sanitizer.

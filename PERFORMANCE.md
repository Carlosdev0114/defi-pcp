# PERFORMANCE.md

Mesures réelles du projet (phase 4), correctifs appliqués et limites connues.
Aucun chiffre n'est estimé à la main : tout vient des rapports Lighthouse, de
la sortie de `next build` ou de mesures dans le navigateur.

## Conditions de mesure

- Lighthouse **13.5.0** en ligne de commande, navigateur **Edge headless**
  (Chromium ; Chrome n'était pas installé sur la machine de mesure).
- Build de production local : `npm run build && npm start`, `http://localhost:3000`,
  sans CDN. Mobile = throttling simulé par défaut de Lighthouse ; desktop =
  `--preset=desktop`.
- Slugs réels : `/projets/climove`, `/articles/notation-et-recette`.
- **Une mesure par page et par mode**, sauf mention contraire. La variance
  est réelle : une mesure isolée de `/` a donné 79 en mobile, trois autres
  mesures du même build ont donné 94, 91 et 94.

## Rendu : pages publiques statiques

Toutes les pages publiques sont **prérendues** (`○`, ou `●` pour les pages de
détail avec `generateStaticParams`), avec une revalidation d'**1 h** et une
expiration d'**1 an** (sortie de `next build`). Seules `/login` et
`/media/[file]` restent dynamiques (`ƒ`), volontairement.

Avant la correction, **toutes** les pages étaient dynamiques : le client
Upstash appelle Redis en `fetch` `no-store` (valeur par défaut de la
bibliothèque), et le profil comme les modules sont lus dans les layouts.
Correctif : `getProfile()` / `getModules()` passent par `unstable_cache`
(étiquettes `site:profile` / `site:modules`), et les écritures admin appellent
`revalidateTag(tag, { expire: 0 })`. Détails dans `lib/server/site-config.ts`.

## Scores Lighthouse — état initial (phase 4B)

Performance / Accessibilité / Bonnes pratiques / SEO :

| Page | Mobile | Desktop |
|---|---|---|
| `/` | 95 / 96 / 96 / 100 | 100 / 96 / 96 / 100 |
| `/projets` | 87 / 94 / 96 / 100 | 100 / 94 / 96 / 100 |
| `/projets/climove` | 88 / 96 / 96 / 100 | 100 / 96 / 96 / 100 |
| `/articles/notation-et-recette` | 93 / 96 / 96 / 100 | 100 / 96 / 96 / 100 |
| `/contact` | 92 / 96 / 96 / 100 | 100 / 96 / 96 / 100 |
| `/reservation` | 86 / 96 / 96 / 100 | 98 / 96 / 96 / 100 |
| `/login` | 89 / 94 / 100 / 60 | 100 / 94 / 100 / 60 |

- Mobile : LCP 2,9 à 3,3 s (1,9 s sur `/`), TBT 140 à 320 ms, CLS 0 sauf
  `/reservation` (0,083).
- Desktop : LCP 0,6 à 0,8 s, TBT 0 à 30 ms.
- SEO 60 sur `/login` : page en `noindex`, voulu.

## Scores après correctifs (phase 4C, mobile)

| Page | Avant | Après | Détail |
|---|---|---|---|
| `/` | 95 | **94** (3 mesures : 94, 91, 94) | Zod ne se charge plus ; bonnes pratiques 96 → **100** |
| `/reservation` | 86 | **93** | CLS 0,083 → **0** ; TBT 260 → 130 ms ; LCP 3,3 → 3,0 s |
| `/contact` | 92 | **92** | Zod reste nécessaire (formulaire) ; LCP 3,2 → 3,0 s |

- Le LCP mobile de `/` mesure 3,1 s de façon stable après correctifs, contre
  1,9 s dans l'unique mesure initiale. Un test A/B (build avec `priority`
  contre build avec `preload`, 3 mesures chacun) donne le même résultat
  (94/94/94 contre 94/91/94) : le 1,9 s initial n'était pas représentatif.
- Desktop non remesuré après correctifs.
- Mesures prises **avant** le passage de Zod en `jitless` (voir plus bas) ;
  ce dernier a été vérifié dans DevTools, pas remesuré dans Lighthouse.

## Correctifs appliqués

1. **Widgets chargés à la demande.** `WidgetStack` (dans le layout public)
   importait directement `ChatPanel` et `MessagingPanel`, qui importent
   `lib/schemas/message.ts`, donc Zod : **83 Kio** transférés sur chaque
   page, dont **72 Kio** inutilisés. Ils sont désormais chargés par
   `next/dynamic` (`ssr: false`) à la première ouverture. Vérifié dans le
   navigateur : Zod absent au chargement de `/`, les panneaux s'ouvrent et la
   validation côté client fonctionne.
2. **`preload` au lieu de `priority`** sur les images LCP (`ProjectCard`,
   `/projets/[slug]`, `/articles/[slug]`) : `priority` est déprécié dans
   Next 16. Le HTML produit est identique dans les deux cas.
3. **CLS de `/reservation`.** Au chargement, le message « Chargement des
   services… » (une ligne) était remplacé par la liste des services, ce qui
   décalait la barre de navigation. Hauteur réservée sur les deux messages de
   chargement, d'après les hauteurs mesurées : services 925 px mobile /
   467 px desktop, jours 447 px / 264 px.
4. **Zod en mode `jitless`** (`lib/schemas/zod.ts`). Zod v4 teste
   `new Function("")` à la création de chaque schéma objet ; la CSP de
   production le bloque et le navigateur signale une violation
   `kEvalViolation` (c'était la seule alerte des « Bonnes pratiques »).
   Vérifié dans DevTools : plus aucune violation sur `/contact`,
   `/reservation` et avec la messagerie ouverte.

## Limites connues

- **Polices** : 5 fichiers préchargés par `next/font` (`app/layout.tsx`),
  **118 Kio** au total (Fraunces, Inter, IBM Plex Mono en **3 graisses**). Ils
  concurrencent le JS au démarrage ; cause probable du LCP texte mobile
  (~3 s), non isolée (le LCP mobile est simulé).
- **CSS bloquant** : `app/globals.css` (Tailwind), **10 Kio**, estimé à
  150–220 ms de blocage du rendu en mobile. Une seule feuille ; gain possible
  faible.
- **Polyfills** : **14 Kio** dans le chunk du framework (`Array.prototype.at`,
  `flat`, `flatMap`, `Object.fromEntries`, `Object.hasOwn`,
  `String.prototype.trimStart/trimEnd`). Aucun `browserslist` dans
  `package.json` : cibles par défaut de Next.
- **Hydratation** : tâches longues de 100 à 240 ms dans le chunk React DOM +
  runtime Next (70 Kio) en mobile ; en partie incompressible.
- **`fetchpriority`** : aucune image LCP ne porte `fetchpriority="high"`
  (ni avec `priority`, ni avec `preload`) ; Lighthouse le signale sur
  `/projets`. `components/site/hero/HeroVisual.tsx` utilise encore `priority`.
- **Accessibilité** (94 à 96) : contraste insuffisant sur toutes les pages ;
  libellé visible différent du nom accessible (desktop, `/`, `/contact`,
  `/articles/[slug]`) ; pas de `<main>` sur `/login` ; ordre des titres sur
  `/projets`.
- **Formulaire de messagerie** : champs sans `id` ni `name` (avertissement
  navigateur `FormEmptyIdAndNameAttributesForInputError`).
- **Hauteur réservée des services** (`/reservation`) : dépend du nombre de
  services en base ; en ajouter peut réintroduire un léger décalage. Solution
  exacte : rendre la liste des services côté serveur.
- **`unstable_cache`** : déprécié dans Next 16 au profit de `'use cache'`
  (Cache Components) ; fonctionne, migration à prévoir.

# ARCHITECTURE.md

> Document en cours de rédaction. Cette section couvre le temps réel
> (messagerie, notifications) et la mesure d'audience.

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

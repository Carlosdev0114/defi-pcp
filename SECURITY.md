# SECURITY.md

> Document en cours de rédaction. Cette section couvre la messagerie, les
> notifications et la mesure d'audience ; l'authentification, la CSP et les
> uploads sont décrits dans le README et DATABASE.md.

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

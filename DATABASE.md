# DATABASE.md — Modèle de données

Base : PostgreSQL (Neon), Prisma 6 (migrations versionnées dans
`prisma/migrations/`). Le schéma `prisma/schema.prisma` est utilisé **tel que**
fourni avec l'énoncé — il n'a pas été redessiné.

## Stratégie

- **Migrations** : `prisma/migrations/20260924000000_init` = state initial.
  En local : `npx prisma migrate dev --name <titre>` pour itérer ; sur les
  déploiements : `npx prisma migrate deploy` (jamais de `db push` en prod).
- **Client** : singleton `lib/server/db.ts` (évite la multiplication des
  connexions en dev avec le hot-reload).
- **Identifiants** : CUID partout (`@default(cuid())`), non séquentiels,
  impossible à deviner par itération.
- **Timestamps** : `createdAt @default(now())` systématique, `updatedAt
  @updatedAt` sur les modèles édités.
- **Seed** : `prisma/seed.mjs` crée l'admin initial (via `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` dans `.env`).

## Modèles

### Enums
- `Role` — `ADMIN` / `VISITOR`. Le RBAC n'existe que là : un utilisateur est
  admin ou visiteur, il n'y a pas de "guest" en base.
- `LeadStatus` — cycle CRM : `NEW → CONTACTED → DISCUSSION → PROPOSAL →
  WON | LOST`.
- `AppointmentStatus` — cycle de RDV : `PENDING → CONFIRMED | DECLINED |
  CANCELLED | COMPLETED`.
- `MessageSender` — `VISITOR / ADMIN / AI` (ce dernier prévu pour les
  réponses du chatbot RAG dans les conversations).

### `User`
Comptes. `passwordHash` stocke **uniquement** le hash bcrypt (coût 10, jamais
le mot de passe en clair). `role` par défaut à `ADMIN` : le compte initial est
créé au seed, le compte visiteur n'existe pas encore en BDD. Relations : RDV
dont il est l'admin assigné (`appointments` via `AssignedAdmin`) et ses
`activities`.

C'est la seule source de vérité de l'authentification : `/api/auth/login`
lit `User` par e-mail et compare le hash, et `requireAdmin`
(`lib/server/guard.ts`) relit `User.role` à chaque requête admin. Les
sessions elles-mêmes ne sont **pas** en base : elles vivent dans Redis
(`session:<jti>`, TTL 7 jours), ce qui évite une table de sessions et un hit
PostgreSQL pour les révoquer.

### `Project`
Un projet du portfolio. `slug` unique = URL propre, `techStack` en tableau
Postgres, `featured` + `order` pour piloter la mise en avant, `publishedAt`
pour le filtrage du public. `media` : ses visuels.

### `Experience`
Un poste occupé. `startDate` requis, `endDate` nullable (poste en cours).
`order` pour l'affichage chronologique inversé.

### `Skill`
Une compétence. `name` unique, `category` (ex. "Frontend", "Design"),
`level` (1–5) et `order` pour la grille.

### `Article`
Un billet de blog. `slug` unique, `content` en texte (le markdown/rendu est
géré côté application), `coverMediaId` → `Media` optionnel, `publishedAt`
nullable = brouillon.

### `Media`
Fichier uploadé. `url`, `mimeType`, `sizeBytes` et dimensions (remplies par
Sharp pendant l'optimisation). Rattachable à un `Project` et/ou utilisé comme
couverture d'`article` — un même media peut être la couverture de plusieurs
articles.

### `Contact` et `Lead` — pourquoi **deux** modèles séparés ?
Un **contact** est un fait brut : quelqu'un a rempli le formulaire, avec sa
demande initiale (`message`). Un **lead** est l'objet de suivi commercial :
à quel stade du pipeline, pour quelle valeur, avec quel historique.

**Décision (phase 3) : le formulaire de contact crée directement un lead.**
`POST /api/contact` crée, dans **une seule transaction**, le `Contact`, un
`Lead` au statut `NEW` (source « Formulaire de contact »), le `LeadEvent`
initial `∅ → NEW` et une notification admin. Tout ou rien : si la création
du lead échoue, aucun contact n'est enregistré (couvert par un test).

- **Pourquoi** : la fiche du projet exige que les leads du CRM soient générés
  depuis le formulaire de contact. Une version précédente réservait la
  promotion en lead à une décision humaine ; elle a été abandonnée.
- **Et le spam ?** Il est filtré **avant** l'écriture, pas par un tri
  manuel : validation Zod (schéma partagé client/serveur,
  `lib/schemas/contact.ts`), rate limiting Redis par IP (3 envois / 10 min)
  et pot de miel (champ caché ; rempli = réponse de succès, rien d'écrit).
  Un lead indésirable qui passerait quand même se classe en `LOST`.
- **Anciens contacts sans lead** : la route `POST /api/admin/contacts/[id]/lead`
  est conservée pour les promouvoir.

Les deux modèles restent séparés :
- `Lead.contactId @unique → Contact` garantit qu'un contact correspond à
  **au plus un** lead — on ne duplique jamais une piste.
- La **demande initiale du visiteur** (`Contact.message`) reste intacte,
  alors que le contexte commercial (statut, valeur, source) vit sur le Lead.
- Le suivi vit dans `LeadNote` / `LeadEvent` : l'historique
  `fromStatus → toStatus` permet de rejouer la trajectoire de chaque lead et
  d'alimenter les totaux du pipeline.

### `Service`, `Availability`, `Appointment`, `CalendarEvent`

### `Availability` vs `CalendarEvent` — pourquoi **séparer** ?
`Availability` décrit une **capacité récurrente**, pas un événement :

- `serviceId + weekday` + `startTime/endTime` = « ce service a des créneaux
  tous les mardis de 9h à 17h ». C'est de la **règle récurrente**, stable,
  qui sert à calculer les créneaux proposés aux visiteurs.

`CalendarEvent` décrit des **exceptions ponctuelles et datées** :

- un blocage (`blocked = true`) : vacances, atelier, réunion — un jour précis,
  sans lien avec un service ;
- éventuellement un RDV fermé, une indisponibilité exceptionnelle.

Pourquoi ne pas faire un seul modèle ?
1. **Sémantique différente** : une dispo récurrente n'est pas un événement.
   Les fusionner obligerait à inventer des enregistrements "fantômes" par
   semaine, ou à encoder la récurrence dans des champs de date à moitié nulls.
2. **Calcul des créneaux** : quand un visiteur demande un RDV, on croise
   `Availability` (ce qui est théoriquement proposable) avec
   `CalendarEvent.blocked` (ce qui est exceptionnellement impossible). Le
   `Appointment` existant fait le reste (créneau déjà pris).
3. **Mise à jour indépendante** : ajouter un blocage ne doit pas toucher le
   planning récurrent, et changer les horaires d'un service ne doit pas
   décaler les blocages posés.

`Appointment` est le **RDV concret** : service, visiteur, `startAt/endAt`,
statut, notes, `assignedTo` (l'admin).

### `Conversation` et `Message`
La messagerie : une conversation (éventuellement anonyme — `visitorName/Email`
nullable pour le chat) porte des `Message` ordonnés via
`@@index([conversationId, createdAt])`. `sender` distingue visiteur, admin et
AI pour l'affichage et les droits de réponse.

### `Notification`
Notification dashboard, `type` (message / lead / booking…), `payload` en JSON
(le contenu libre par type), `read`, indexée sur `(read, createdAt)` pour la
liste "non lues" du panneau.

### `Activity`
Journal d'audit léger : `action` + `entity`/`entityId` (project:slug,
lead:id…) + admin optionnel. Sert le fil d'activité du dashboard et la
traçabilité des changements.

## Choix de modélisation notables

- `Skill.level` est un entier borné par l'appli (1–5) — pas d'enum : un simple
  barème, pas un domaine pauvre en valeurs.
- `Notification.payload` en `Json` : le contenu est intrinsèquement
  hétérogène selon le type, un JSONB indexable là où il faut est le bon compromis.
- `Appointment.assignedTo` nullable : un RDV peut ne pas encore être assigné.
- `Project.publishedAt` / `Article.publishedAt` nullable = brouillons non
  visibles du public ; les listes publiques filtrent dessus.

## Index utilitaires
- `Project(@@index([publishedAt]))`, `Article(@@index([publishedAt]))` :
  listes publiques filtrées par date de publication.
- `Lead(@@index([status]))` : pipeline CRM.
- `LeadNote`/`LeadEvent` : `@@index([leadId])` — tous les événements d'un lead.
- `Appointment(@@index([startAt]) + @@index([status]))` : agenda et files
  de statut.
- `CalendarEvent(@@index([startAt, endAt]))` : chevauchements de blocage.
- `Conversation/Message` : index composé conversation+création.
- `Notification(@@index([read, createdAt]))` : panneau de notifications.
- `Activity(@@index([entity, entityId]))` : fil d'activité par ressource.

## Seed

`prisma/seed.mjs` (`npm run db:seed`) crée l'admin puis importe le contenu
du site maquette (`lib/mock/*.ts`, exécutés directement par Node ≥ 22.18) :
projets, expériences, compétences, articles, services et un planning par
défaut (lun.–ven. 9 h–12 h / 14 h–18 h ; 9 h–17 h pour les prestations de plus
de 3 h). Toutes les écritures de contenu sont *create-only* : relancer le seed
ne réécrase jamais une modification faite depuis le back-office. Seul le mot
de passe admin est resynchronisé depuis `.env`.

Adaptations maquette → schéma : la note des compétences passe de /100 à
1–5 ; contexte / problème / solution / résultat d'un projet sont concaténés
dans `Project.description`.

## Ce qui vit dans Redis (et pas dans PostgreSQL)

| Clé | Rôle | Durée |
| --- | --- | --- |
| `session:<jti>` | session admin valide (révoquée au logout) | 7 j |
| `rl:<règle>:<clé>` | fenêtres de rate limiting (login, chat, contact, réservation) | fenêtre |
| `cachever:<ressource>` + `cache:<ressource>:<version>:<clé>` | cache des lectures publiques, invalidé par incrément de version | 5 min (créneaux : 60 s) |
| `rag:meta`, `rag:chunks:<build>`, `rag:stale`, `rag:lock` | index vectoriel du chatbot (morceaux + embeddings) | jusqu'au prochain build |

Pourquoi l'index RAG n'est pas en base : le schéma est imposé tel quel (pas
de table d'embeddings ni d'extension pgvector) et le corpus public tient en
quelques dizaines de morceaux — une recherche cosinus exhaustive en mémoire
est instantanée à cette échelle. Toute écriture admin sur un contenu public
pose `rag:stale`, et l'index est reconstruit à la question suivante (ou à la
demande via `POST /api/admin/assistant`).

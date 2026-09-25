# Personal Career Platform — Plan & Checklist maître

Ce document sert de feuille de route à donner à opencode. Rien n'est codé tant que ce plan n'est pas validé. Ordre de travail : **Frontend complet d'abord → Backend ensuite.**

---

## 0. Règle d'usage avec opencode

- Ne jamais laisser opencode partir sur une tâche vague ("fais le frontend"). Chaque tâche donnée doit pointer vers UNE section cochée ci-dessous.
- Après chaque section terminée, revenir ici et cocher — ne rien cocher sans avoir vérifié contre la fiche originale.
- Aucun module ne doit être "simulé" (interdiction explicite de la fiche : pas de chatbot à réponses codées en dur, pas de CRM sans logique réelle).

---

## PHASE 1 — FRONTEND (rien ne doit manquer)

### 1.1 Pages publiques (portfolio)
- [x] Page d'accueil / Hero — identité visuelle forte, PAS de "HELLO I'M...", pas de glassmorphism/gradients IA/blobs
- [x] Section Profil (à propos)
- [x] Section Projets (liste + détail projet)
- [x] Section Expériences professionnelles
- [x] Section Compétences
- [x] Section Articles (blog)
- [x] Page/formulaire de Contact
- [x] Page de réservation (booking) côté visiteur : choix service → choix date → dispos → réservation → confirmation
- [x] Widget/panel Chatbot IA (UI seule à ce stade — logique branchée en Phase 2 backend)
- [x] Widget de messagerie visiteur → candidat (UI + fil de conversation)
- [x] Footer, navigation, responsive mobile/desktop
- [x] Pas de page composée uniquement de cartes (interdit explicite)
- [x] Décomposition des composants (ex. Hero → HeroContent / HeroVisual / HeroActions), aucun composant > ~150 lignes sans justification

### 1.2 Espace /admin (CMS) — UI complète
- [x] Layout admin (Overview / Profile / Projects / Experience / Skills / Articles / Media / Leads / Messages / Calendar / AI Assistant / Analytics / Settings)
- [x] CRUD UI Profil
- [x] CRUD UI Projets
- [x] CRUD UI Expériences
- [x] CRUD UI Compétences
- [x] CRUD UI Articles
- [x] Médiathèque UI (upload, liste, suppression)
- [x] Liste des messages reçus (UI)
- [x] Vue statistiques de fréquentation (UI, données mockées pour l'instant si besoin)
- [x] Écran de configuration du chatbot IA (UI)
- [x] Pipeline CRM visuel (Nouveaux → Contacté → Discussion → Proposition → Gagné/Perdu)
- [x] Agenda / calendrier admin (blocage créneaux, horaires, accepter/refuser/annuler RDV)
- [x] Notifications visibles dans le dashboard (nouveau message / lead / réservation) — UI

### 1.3 Design, images, perf (à valider avant de continuer)
- [x] Direction artistique définie et écrite quelque part (pas de blocs Navbar/Hero/About/Skills/Projects/Contact/Footer génériques) — voir `docs/DESIGN.md`
- [x] Pipeline images prévu : originale → Sharp → resize → WebP/AVIF → responsive → next/image
- [x] Toutes les images utilisées sont de vrais assets (aucune banque type Unsplash telle quelle) — SVG locaux faits main
- [x] Usage de `<Image>` avec `sizes` correctement pensé
- [x] Stratégie Server Components vs Client Components décidée (minimiser le JS client)
- [x] Lazy loading prévu sur les sections lourdes
- [x] Font optimization prévue

**Sortie de Phase 1 attendue :** frontend navigable de bout en bout avec données mockées/statiques, prêt à être branché à une vraie API.

---

## PHASE 2 — BACKEND

### 2.1 Base de données (Prisma / Neon)
- [x] Modèle `users` (avec rôles pour RBAC)
- [x] Modèle `projects`
- [x] Modèle `experiences`
- [x] Modèle `skills`
- [x] Modèle `articles`
- [x] Modèle `media`
- [x] Modèle `conversations` + `messages`
- [x] Modèle `contacts`
- [x] Modèle `services`, `availability`, `appointments`, `calendar_events`, `notifications`
- [x] Modèle `leads`, `lead_notes`, `lead_events`, `activities`
- [x] Index sur les listes exposées (perf + pagination) — `publishedAt`, `status`, `startAt`, `(read, createdAt)`… (voir DATABASE.md)
- [x] Migrations Prisma versionnées — `20260924000000_init` appliquée sur Neon ; seed du contenu (`npm run db:seed`, idempotent)
- [x] `DATABASE.md` commencé au fur et à mesure (schéma + choix de modélisation)

### 2.2 Authentification & RBAC
- [x] Hash des mots de passe
- [x] Sessions ou JWT sécurisés — JWT HS256 + entrée Redis `session:<jti>` (révocable au logout)
- [x] Rôles clairs (admin vs visiteur)
- [x] Vérification serveur systématique (proxy.ts + `requireAdmin` en base dans chaque route et le layout admin) sur toute route /admin et API sensible (jamais de sécurité juste côté UI)
- [x] Rate limiting Redis sur le login (brute force)

### 2.3 API — règles transverses (à poser avant d'écrire les routes)
- [x] Validation Zod sur toutes les entrées
- [x] Requêtes Prisma uniquement (aucune concaténation SQL)
- [x] Transactions sur les opérations multi-tables sensibles — lead (statut + LeadEvent + Activity + Notification), promotion contact→lead, contact + notification, réservation (SERIALIZABLE + rejeu), planning (remplacement atomique), suppressions (détachement des relations)
- [x] Pagination sur toutes les listes exposées — `page`/`pageSize` (max 50) validés par Zod ; curseur pour les fils de messages
- [x] Limite de taille de payload + méthodes HTTP explicitement autorisées
- [x] Gestion d'erreurs propre (aucune stack trace exposée au client)

### 2.4 Redis — usages à implémenter
- [x] Cache (réduire les hits PostgreSQL) — lectures publiques en cache Redis, invalidation par version à chaque écriture admin
- [x] Rate limiting (login, /api/chat, formulaire de contact) — + réservation ; fenêtres glissantes Upstash
- [x] Sessions

### 2.5 Chatbot IA — RAG (Gemini)
- [x] Construction de la base de connaissances (⚠ nécessite `GEMINI_API_KEY` dans `.env` pour tourner) à partir des données réelles (profil, projets, expériences, articles)
- [x] Chunking
- [x] Embeddings
- [x] Recherche vectorielle — similarité cosinus sur index Redis (pas de pgvector : schéma imposé)
- [x] Appel Gemini avec contexte récupéré uniquement (pas de prompt statique)
- [x] Clé Gemini strictement côté serveur
- [x] Prompt système verrouillé (anti prompt injection, ne sort pas de son rôle)
- [x] Réponse par défaut si absence d'info : "Je n'ai pas cette information dans les données publiques du candidat"
- [x] `/api/chat` protégé (validation Zod + rate limiting Redis)

### 2.6 Uploads / médias
- [x] Types de fichiers autorisés limités
- [x] Taille limitée
- [x] Scan/validation du contenu

### 2.7 Headers HTTP
- [x] Content-Security-Policy
- [x] X-Content-Type-Options
- [x] Referrer-Policy
- [x] Permissions-Policy
- [x] Strict-Transport-Security

### 2.8 Secrets
- [x] Aucun secret commité dans Git
- [x] `.env` non versionné
- [x] `.env.example` fourni et tenu à jour
- [x] Aucune clé API / identifiant DB dans le code frontend

---

## PHASE 3 — Branchement Frontend ↔ Backend
- [x] Remplacer les données mockées du frontend par les vraies routes API — `lib/mock/` supprimé ; contenu lu en base (pages statiques revalidées)
- [x] Booking connecté (dispos réelles, création RDV réelle) — transaction SERIALIZABLE (`tests/booking-atomic.test.ts`)
- [x] CRM connecté (leads réels générés depuis le formulaire de contact) — Contact + Lead NEW + LeadEvent en une transaction (`tests/contact-lead.test.ts`)
- [x] Chatbot connecté au pipeline RAG réel — index limité au contenu publié (`tests/rag-knowledge.test.ts`)
- [x] Messagerie temps réel connectée (polling / SSE / WebSocket — choix à justifier dans ARCHITECTURE.md) — polling court filtré par Redis, justifié dans ARCHITECTURE.md
- [x] Notifications dashboard connectées aux vrais événements — cloche admin sur `/api/admin/updates`

---

## PHASE 4 — QA, sécurité finale, performance
- [x] Test manuel de chaque route /admin sans être connecté (doit être bloqué) — automatisé, toutes les pages et routes générées depuis `app/` (`tests/qa-admin-guard.test.ts`)
- [x] Test XSS sur les champs texte utilisateur (articles, messages, contact) — `tests/qa-xss.test.tsx`
- [x] Test upload avec fichier non autorisé — `tests/qa-upload.test.ts`
- [x] Audit Lighthouse (perf, accessibilité) — résultats, correctifs et limites connues dans PERFORMANCE.md
- [x] Vérification pagination sur toutes les listes — `tests/qa-pagination.test.ts`
- [x] Vérification rate limiting (spam login, spam chatbot) — `tests/qa-rate-limit.test.ts`, `tests/chat-global-limit.test.ts`

---

## PHASE 5 — Documentation & livrables finaux
- [x] `README.md`
- [ ] `ARCHITECTURE.md` (Frontend / Backend & API / Base de données / Infrastructure / IA / Sécurité / Performance / Décisions techniques) — en cours : ne couvre que le temps réel, le budget Redis et la mesure d'audience
- [x] `DATABASE.md`
- [ ] `SECURITY.md` — en cours : messagerie, notifications, audience ; manquent authentification, uploads, en-têtes HTTP
- [x] `PERFORMANCE.md`
- [x] `.env.example`
- [ ] Préparer les 3 décisions techniques à présenter en soutenance ("que ferais-tu avec 24h de plus ?")

---

## Rappels — Interdits absolus (fiche section 9)
- Pas de template ou boilerplate repris tel quel
- Pas d'appli générée entièrement par IA sans compréhension
- Pas de clé Gemini ou credentials DB côté client
- Pas de mot de passe en clair / secret dans Git
- Pas de route /admin non protégée côté serveur
- Pas d'images non optimisées
- Pas de page 100% cartes
- Pas de composants ou routes API monolithiques
- Pas de module simulé sans logique réelle (CRM, booking, chatbot)

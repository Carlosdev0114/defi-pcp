# Direction artistique — Personal Career Platform

Document de référence du design (checklist 1.3). Tout élément visuel doit
pouvoir remonter à une décision ci-dessous.

## Positionnement

Un portfolio de développeuse indépendante = un objet éditorial, pas une vitrine
"tech". On assume le registre de l'imprimé : la page se lit comme un journal de
travail plutôt qu'un dashboard générique.

Ton recherché : **net, à l'encre, précis**. Si une page ressemble à un bloc
Navbar/Hero/About/Skills/Projects/Contact/Footer générique, elle est à refaire.

## Palettes

| Token | Valeur | Usage |
| --- | --- | --- |
| `--color-paper` | `#f3eee2` | fond principal (papier chaud) |
| `--color-cream` | `#faf7ef` | surfaces claires (cartes, encadrés) |
| `--color-ink` | `#211a12` | encre, texte fort, bordures |
| `--color-accent` | `#e0421c` | orange "à la sérigraphie", réservé aux points d'exclamation |
| `--color-line` | `rgba(33,26,18,.12)` | filets discrets |
| `--color-line-strong` | `rgba(33,26,18,.3)` | filets marqués |

Interdits : glassmorphism, gradients IA, blobs, auréoles, dégradés néon.
Les données (graphiques analytics, pipeline CRM) restent dans la palette —
aucune troisième couleur thématique.

## Typographies

- **Fraunces** (display) — titres, chiffres des stats. Serif éditorial avec
  une patte variable, donne le côté imprimé.
- **Inter** (sans) — textes courants.
- **IBM Plex Mono** — tout ce qui relève du système : étiquettes, métadonnées,
  paths, légendes `FIG.xx`, compteurs. Présence de mono = "méta".

Les figures sont légendées à la façon d'un document technique : `FIG.01 — ...`.

## Systèmes visuels récurrents

- **Bordure double encre** `border-2 border-ink` sur les objets conteneurs
  (cartes, encadrés, figures) : l'épaisseur "trace" de l'imprimé.
- **Filets** de séparation seulement (pas d'ombres portées).
- **Étiquette mono** secrétaire avant les blocs : `label-mono` (mono, espacée).
- **Ticker défilant** bicolore encre/accent sous le hero (sérigraphie).
- **Grille de lignes** `line-grid` en fond de certaines sections.
- **Hover éditorial** : translation du bloc + accent sur l'icône, jamais de
  glow ou d'échelle douce exagérée.

## Iconographie & images

- Toutes les illustrations sont des **SVG locaux faits main** (`public/`,
  `public/work/`) : portrait encre & papier, pochettes de projets traitées
  comme des affiches de cinéma (masques colorés sur fond de niche).
- **Aucune banque d'images** (pas d'Unsplash tel quel) ; la phase 2 définira
  le pipeline Sharp → resize → WebP/AVIF pour les uploads utilisateur.
- Icônes en trait 1.5px, monochrome, famille unique (`components/ui/icons.tsx`).

## Front public vs back-office

- **Site public** : dominante papier, nombreuses figures, texte long sur
  mesure de lecture. Le hero évite tout "HELLO I'M" : on ouvre sur un
  constat de travail, pas sur une autoprésentation.
- **/admin** : mêmes tokens, mais plus dense — tableaux, formulaires,
  panels. Violence typographique accentuée (grands compteurs Fraunces,
  tags mono). Le design suit, il ne réinvente pas.

## Contraintes d'implémentation

- Tokens exposés dans `@theme` (`app/globals.css`) ; composants dans
  `components/ui` (boutons, icônes) et `components/admin/ui` (panels,
  champs, tags) — pas de classes utilitaires hors tokens pour ces derniers.
- Responsive : mobile-first, navigation mobile dédiée (`MobileNav`).
- Accessibilité : skip-link, contrastes suffisants, focus visibles,
  `alt` explicites.

## Évolutions possibles (souhaitables si le temps le permet)

- Variante "sombre" du thème en mode lecture (encres inversées).
- Gaufrage/serif variable en micro-interaction sur les titres de section.
- Empreinte de dossier imprimée sur le PDF d'export des RDV (phase 2).
import type { Project } from "@/lib/types";

export const projects: Project[] = [
  {
    slug: "climove",
    title: "Climove",
    tagline: "Simulateur d'impact carbone pour les trajets domicile-travail",
    year: 2024,
    role: "Conception + développement",
    status: "Livré",
    cover: "/work/climove-cover.svg",
    coverBg: "#e0421c",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Mapbox", "Chart.js"],
    context:
      "Une métropole voulait pousser ses agents à changer de mode de transport sans passer par la culpabilisation. Il fallait quelque chose de ludique, factuel, et utilisable sur le téléphone dans les transports.",
    problem:
      "Les données existaient (enquêtes ménages, GPS anonymisés) mais rien de lisible pour un agent pressé entre deux rendez-vous : des tableurs et des cartes statiques.",
    solution:
      "Un simulateur où l'on entre son trajet, et qui compare l'empreinte carbone selon le mode avec des équivalents parlants (« ça équivaut à 340 km de voiture » plutôt qu'un chiffre abstrait). Ajout d'un défi collectif par direction pour l'engagement.",
    outcome:
      "Déployé auprès de 900 agents. En 3 mois, 22 % des testeurs ont déclaré avoir changé au moins un trajet par semaine. Le défi par équipe a fait remonter l'usage le week-end.",
    metrics: [
      { label: "Agents équipés", value: "900" },
      { label: "Changement de comportement", value: "22%" },
      { label: "Note d'usage (Lighthouse)", value: "98" },
    ],
  },
  {
    slug: "carnet-de-cave",
    title: "Carnet de cave",
    tagline: "Back-office de gestion pour un opérateur de réserves de vin",
    year: 2023,
    role: "Développement fullstack",
    status: "Livré",
    cover: "/work/vin-cover.svg",
    coverBg: "#1855e0",
    stack: ["React", "Node.js", "Prisma", "PostgreSQL", "Stripe"],
    context:
      "Un négociant vendait des réserves de vin à des particuliers via PDF et appels. Les ventes augmentaient, le suivi non : erreurs de doublons, stock fantôme, clients jamais relancés.",
    problem:
      "Le stock n'était pas fiable, la relance commerciale reposait sur la mémoire d'un commercial, et aucun chiffre de caisses par client n'était consolidé.",
    solution:
      "Un back-office avec des fiches clients, un état de stock par appellation, et une gestion des paiements en plusieurs fois couplée à des relances automatiques déclenchées par des statuts.",
    outcome:
      "Zéro doublon constaté trois mois après la mise en service. Le commercial a récupéré ~6 h par semaine, réinvesties dans la relation client. Les ventes en plusieurs fois ont doublé.",
    metrics: [
      { label: "Doublons", value: "0" },
      { label: "Heures récupérées / semaine", value: "6" },
      { label: "Ventes en plusieurs fois", value: "×2" },
    ],
  },
  {
    slug: "panier-tricot",
    title: "Panier Tricot",
    tagline: "Boutique et club d'ateliers pour une mercerie artisanale",
    year: 2023,
    role: "Design + développement",
    status: "Livré",
    cover: "/work/tricot-cover.svg",
    coverBg: "#d8a600",
    stack: ["Next.js", "Stripe", "Tailwind", "Sanity CMS"],
    context:
      "Une mercerie de quartier vendait en boutique et s'essayait aux ateliers. La demande pour réserver des cours à 20 personnes n'était pas satisfaite par les formulaires papier.",
    problem:
      "Aucune visibilité sur les places restantes, des annulations gérées au crayon, et une newsletter qui existait surtout dans la tête de la gérante.",
    solution:
      "Une petite boutique en ligne couplée à un système d'inscription aux ateliers avec paiement à la réservation. La gérante gère ses créneaux depuis une page admin simple, sans intermédiaire.",
    outcome:
      "Le taux de remplissage des ateliers est passé de ~60 % à quasi complet, avec une liste d'attente automatique qui a dû être désactivée faute de créneaux.",
    metrics: [
      { label: "Taux de remplissage", value: "~100%" },
      { label: "Ventes en ligne / mois", value: "+40 %" },
      { label: "Cours par mois", value: "14" },
    ],
  },
  {
    slug: "outline-v1",
    title: "Outline v1",
    tagline: "En cours — outil d'écriture pour scénaristes",
    year: 2024,
    role: "Side-project",
    status: "En cours",
    cover: "/work/outline-cover.svg",
    coverBg: "#4b3bf0",
    stack: ["Next.js", "tRPC", "Prisma", "PostgreSQL", "Cytoscape"],
    context:
      "Un projet perso né d'une frustration : structurer un scénario dans un traitement de texte classique, c'est du petit-suicide de la motivation. Les fiches personnages, l'intrigue et le déroulé n'existent pas dans le même outil.",
    problem:
      "Chaque outil du marché fait une chose (fiches, timeline, rédaction) sans lien entre elles. Le coût d'entrée est trop haut pour une personne déjà débordée par son propre scénario.",
    solution:
      "Un graphe interactif où fiches et scènes s'asso… se connectent, un mode écriture plein écran, et un export propre pour l'envoyer à un producteur sans refrapper tout.",
    outcome:
      "Projet en itération ouverte sur GitHub, ~400 étoiles, une petite liste d'attente pour la beta. Je le finance sur mon temps libre et je documente ce que j'en apprends.",
    metrics: [
      { label: "Étoiles GitHub", value: "400" },
      { label: "Liste d'attente beta", value: "—" },
      { label: "Version publique", value: "V1 beta" },
    ],
  },
  {
    slug: "audit-orga",
    title: "Audit Orga",
    tagline: "Grille d'audit automatisée pour le conseil indépendant",
    year: 2022,
    role: "Développement",
    status: "Livré",
    cover: "/work/audit-cover.svg",
    coverBg: "#0e8a60",
    stack: ["React", "Node.js", "Express", "PostgreSQL", "Puppeteer"],
    context:
      "Une consultante indépendante vendait des audits organisationnels. Elle passait des soirées à compiler des PDF depuis des tableurs Excel remplis à la main.",
    problem:
      "Le rendu dépendait de la fatigue du soir, les données n'étaient pas centralisées, et chaque mission avait son propre système de notation → impossibilité de comparer dans le temps.",
    solution:
      "Une application qui guide la saisie des réponses, calcule les scores par pilier, et génère un rapport PDF sur-mesure avec les recommandations. Les grilles restent configurables par mission.",
    outcome:
      "Le temps de production d'un rapport est passé de 2 jours à une demi-journée. La consultante a pu standardiser ses offres et faire monter son TJM.",
    metrics: [
      { label: "Temps de rapport", value: "-75%" },
      { label: "Missions standardisées", value: "12" },
      { label: "Satisfaction client", value: "4,8/5" },
    ],
  },
];

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
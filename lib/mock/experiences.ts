import type { Experience } from "@/lib/types";

export const experiences: Experience[] = [
  {
    id: "xp-1",
    role: "Développeuse indépendante — produit & interfaces",
    company: "Solo, clients SaaS / éditeurs",
    start: "2021-03",
    end: null,
    location: "Lyon (remote-friendly)",
    type: "Freelance",
    summary:
      "J'accompagne des équipes produit sur un segment précis : transformer un besoin métier parfois flou en une interface qui tient debout et une base de code qu'on aime maintenir.",
    bullets: [
      "Refonte frontend d'un back-office de gestion locative : 3 200 utilisateurs actifs, temps de chargement perçu divisé par 3.",
      "Conception et livraison d'un mini-portail client pour un éditeur de logiciels CRM viticole (études, devis, relances).",
      "Mise en place d'une procédure de revue de code et de tests E2E qui a fait tomber les régressions avant release.",
    ],
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Prisma", "Tailwind", "Playwright"],
  },
  {
    id: "xp-2",
    role: "Lead développeuse frontend",
    company: "Logora — plateforme de débats en ligne",
    start: "2018-09",
    end: "2021-02",
    location: "Paris",
    type: "CDI",
    summary:
      "Entre 4 et 10 personnes selon les périodes, j'étais responsable technique de l'application web utilisée par les rédactions de plusieurs médias nationaux.",
    bullets: [
      "Mise en place d'un design system interne partagé entre trois produits (login unique, composants, tokens).",
      "Reconstruction du moteur de modération temps réel qui gérait jusqu'à 8 000 signalements par jour.",
      "Accompagnement de deux développeurs juniors vers le médiorat, avec revue de code et binôme sur les sujets sensibles.",
    ],
    stack: ["React", "Redux", "Node.js", "Elasticsearch", "Redis"],
  },
  {
    id: "xp-3",
    role: "Développeuse web",
    company: "Agency Kargo — sites & campagnes",
    start: "2016-04",
    end: "2018-08",
    location: "Lyon",
    type: "CDI",
    summary:
      "Mon premier poste sérieux. J'ai appris la différence entre « ça marche chez moi » et « ça marche chez le client » à coups de calques Photoshop et de tickets bien sentis.",
    bullets: [
      "Développement de sites vitrines et e-commerce sur-mesure (WooCommerce, migrations, évolutions).",
      "Intégration responsive et optimisation Lighthouse pour une trentaine de projets.",
      "Écriture des cahiers de recette et passage des validations client.",
    ],
    stack: ["PHP", "WordPress", "jQuery", "Sass", "MySQL"],
  },
];
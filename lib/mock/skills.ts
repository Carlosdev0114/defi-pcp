import type { Skill } from "@/lib/types";

export const skills: Skill[] = [
  { name: "TypeScript", level: 88, family: "Langages" },
  { name: "React / Next.js", level: 90, family: "Frontend" },
  { name: "Node.js", level: 82, family: "Backend" },
  { name: "PostgreSQL", level: 76, family: "Données" },
  { name: "Prisma", level: 80, family: "Données" },
  { name: "Tailwind CSS", level: 92, family: "Frontend" },
  { name: "GraphQL", level: 68, family: "Backend" },
  { name: "Design d'interfaces", level: 74, family: "Produit" },
  { name: "UX / tests utilisateurs", level: 64, family: "Produit" },
  { name: "Docker", level: 58, family: "Ops" },
  { name: "CI / déploiement (Vercel, GitHub Actions)", level: 78, family: "Ops" },
  { name: "Accessibilité web", level: 71, family: "Frontend" },
];

export const skillFamilies = ["Langages", "Frontend", "Backend", "Données", "Produit", "Ops"];
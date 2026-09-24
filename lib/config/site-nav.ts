// Navigation du site public : configuration de l'interface (pas une donnée).
export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Compétences", href: "/competences" },
  { label: "Projets", href: "/projets" },
  { label: "Articles", href: "/articles" },
  { label: "Contact", href: "/contact" },
];

export const footerLinks: { explore: NavLink[]; services: NavLink[] } = {
  explore: [
    { label: "Profil", href: "/a-propos" },
    { label: "Parcours", href: "/parcours" },
    { label: "Compétences", href: "/competences" },
    { label: "Projets", href: "/projets" },
    { label: "Articles", href: "/articles" },
  ],
  services: [
    { label: "Réserver un créneau", href: "/reservation" },
    { label: "Contact", href: "/contact" },
  ],
};

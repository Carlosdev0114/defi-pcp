// Menu du back-office : configuration de l'interface (pas une donnée).
export const adminNav = {
  dashboard: [{ href: "/admin", label: "Vue d'ensemble", glyph: "⌂" }],
  contenu: [
    { href: "/admin/profil", label: "Profil", glyph: "◉" },
    { href: "/admin/projets", label: "Projets", glyph: "▣" },
    { href: "/admin/parcours", label: "Parcours", glyph: "≡" },
    { href: "/admin/competences", label: "Compétences", glyph: "✶" },
    { href: "/admin/articles", label: "Articles", glyph: "¶" },
    { href: "/admin/medias", label: "Médiathèque", glyph: "▤" },
  ],
  client: [
    { href: "/admin/leads", label: "Leads & CRM", glyph: "↗" },
    { href: "/admin/messages", label: "Messages", glyph: "✉" },
    { href: "/admin/agenda", label: "Agenda & résa", glyph: "☐" },
    { href: "/admin/services", label: "Services", glyph: "◷" },
  ],
  systeme: [
    { href: "/admin/assistant-ia", label: "Assistant IA", glyph: "✦" },
    { href: "/admin/analytics", label: "Statistiques", glyph: "◔" },
    { href: "/admin/parametres", label: "Paramètres", glyph: "⚙" },
  ],
};
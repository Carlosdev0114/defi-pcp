import type { Article } from "@/lib/types";

export const articles: Article[] = [
  {
    slug: "pourquoi-je-revais-dun-bouton",
    title: "Pourquoi je rêve d'un bouton « moins bien mais livré »",
    excerpt:
      "La perfection est une dette qui s'accumule pendant que le produit dort chez le client. Petit plaidoyer pour des livraisons imparfaites mais réelles.",
    date: "2024-11-18",
    readTime: "6 min",
    tag: "Méthode",
    body: [
      "J'ai passé des années à penser que livrer, c'était finir. Puis j'ai passé une année à rattraper des projets que des équipes parfaites n'avaient jamais finies. Le paradoxe m'a vaccinée.",
      "Un bouton « moins bien mais livré » ne veut pas dire saccager. Il veut dire : on coupe proprement, on documente ce qui est coupé, on fixe une échéance pour la suite. Le premier pas de la vraie discipline, c'est de dire à voix haute ce qu'on ne fera pas.",
      "Concrètement, je rends visible la dette plutôt que de la cacher. Une liste « à reprendre » dans le repo, un ticket par vrai problème, et jamais de silence radio sur ce qui est bancal. Le client mérite de choisir, pas de subir.",
      "Le résultat contre-intuitif : les livraisons imparfaites mais régulières ont plus fait avancer mes projets que les grands soirs de 3 h du matin. Et mes clients finissent par me croire quand je leur promets une date.",
    ],
  },
  {
    slug: "notation-et-recette",
    title: "La recette d'une base de code qui se laisse lire",
    excerpt:
      "On ne relit pas son propre code trois mois après avec les mêmes yeux. Voici ce que j'essaie de faire pour que le futur moi puisse comprendre le présent moi.",
    date: "2024-08-02",
    readTime: "8 min",
    tag: "Code",
    body: [
      "Le code se lit mille fois plus qu'il ne s'écrit. C'est la phrase que tout le monde répète et que presque personne n'applique aux noms de variables ou à la structure des fichiers.",
      "Depuis deux ans, je me force à une règle simple : si un fichier dépasse une certaine taille ou demande plus d'une minute pour être compris, je le découpe. Pas par esthétique : par économie. Le temps passé à relire après une pause de trois semaines coûte plus cher que celui passé à découper.",
      "Les commentaires, j'en mets peu, mais je garde ceux qui expliquent le « pourquoi » d'une bizarrerie. Le « quoi », le code le dit déjà. Le « pourquoi », lui, ne se devine jamais.",
      "Il y a aussi une dimension sociale à tout ça : quand on code pour soi, on se pardonne tout. Dès que quelqu'un d'autre est susceptible de lire, on fait attention. Je code donc pour une collègue imaginaire, et bizarrement, ça marche.",
    ],
  },
  {
    slug: "freelance-et-agenda",
    title: "Freelance : mon agenda est un produit comme un autre",
    excerpt:
      "Entre le dispo à remplir, les RDV à protéger et les créneaux de travail profond, j'ai fini par traiter mon planning comme une base de données avec des règles.",
    date: "2024-04-23",
    readTime: "5 min",
    tag: "Métier",
    body: [
      "Travailler seule, ça veut dire que personne ne va me protéger de la surcharge. Le client appelle, c'est un bon client, il veut un créneau demain — et voilà comment on se retrouve à 30 h sur la semaine sans repère.",
      "Ma règle de base : les créneaux de développement profond sont des rendez-vous comme les autres, avec une invitation, et je ne les déplace pas pour un café. Ils sont le produit que je vends, pas le résidu de mes journées.",
      "J'ai automatisé tout ce qui était un aller-retour inutile : un formulaire de réservation avec les créneaux déjà bloqués, des rappels automatiques, et un récapitulatif rempli des questions à préparer. Le visiteur gagne du temps, moi aussi.",
      "C'est le genre de sujet dont on ne parle jamais dans les posts « comment je recrute mes premiers clients ». Pourtant, c'est ce qui fait la différence entre une année où on s'en sort et une année où on s'enterre.",
    ],
  },
  {
    slug: "design-system-sans-star-wars",
    title: "Faire un design system sans en faire un Star Wars",
    excerpt:
      "Le design system, c'est génial jusqu'au jour où on se retrouve à maintenir un méta-projet qui n'appartient à personne. Retour d'expérience sur la bonne dose.",
    date: "2023-12-10",
    readTime: "7 min",
    tag: "Design",
    body: [
      "J'ai vu des design systems devenir des blocs de béton : utiles six mois, avant de freezer toute évolution visuelle parce que « ça doit rester cohérent ». La cohérence devient une excuse pour ne plus réfléchir.",
      "Ce qui a fonctionné chez mon ex-employeur, ce n'était pas le système en soi, mais deux choses : des tokens de design compréhensibles (pas 400 variables dont personne ne sait l'usage), et un vrai processus de proposition de changement pour les composants.",
      "Le reste, c'était de la gouvernance. Et la gouvernance, quand on est freelance, c'est surtout : décider vite, documenter les décisions, et assumer qu'on pourra les défaire. Le système doit servir le produit, jamais l'inverse.",
      "Mon conseil si on démarre : commencez par les tokens et trois composants de base (bouton, champ de saisie, liste). C'est là que naissent 80 % des incohérences visuelles. Le reste viendra par besoin réel, pas par prévision.",
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}
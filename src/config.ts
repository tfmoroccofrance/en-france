export const SITE = {
  website: "https://tfmorocco.com/",
  author: "Equipe En France",
  profile: "https://tfmorocco.com/a-propos/",
  desc: "Recettes françaises faciles et rapides pour cuisiner maison au quotidien. Plats traditionnels, idées repas simples et savoureux pour toute la famille.",
  title: "Recettes Françaises Faciles",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 6,
  postPerPage: 9,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: false,
  showBackButton: true,
  editPost: {
    enabled: false,
    text: "Modifier la page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "fr-FR",
  timezone: "Europe/Paris",
} as const;
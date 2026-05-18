export const SITE = {
  website: "https://tfmorocco.com/",
  author: "Equipe En France",
  profile: "https://tfmorocco.com/a-propos/",
  desc: "Découvrez les meilleures recettes françaises faciles et rapides. Cuisine maison, plats traditionnels et idées repas pour cuisiner au quotidien en France.",
  title: "Recettes Françaises | En France",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 6,
  postPerPage: 9,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: false,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Modifier la page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "fr-FR", // html lang code. Set this empty and default will be "en"
  timezone: "Europe/Paris", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;

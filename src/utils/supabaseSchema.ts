import { SITE } from "@/config";
import type { RecipePost } from "@/types/post";

const fallbackImage = (base: URL) => new URL(`/${SITE.ogImage}`, base).href;

export function getPostImageUrl(post: RecipePost, base: URL) {
  return post.featuredImage
    ? new URL(post.featuredImage, base).href
    : fallbackImage(base);
}

export function createSupabaseRecipeSchema(post: RecipePost, base: URL) {
  const canonical = new URL(post.url, base).href;
  const imageUrl = getPostImageUrl(post, base);

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    headline: post.metaTitle,
    name: post.title,
    description: post.metaDescription,
    image: {
      "@type": "ImageObject",
      url: imageUrl,
      width: 1200,
      height: 675,
    },
    url: canonical,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.publishedAt.toISOString(),
    author: {
      "@type": "Person",
      name: SITE.author,
      url: SITE.profile,
    },
    publisher: {
      "@type": "Organization",
      name: "En France",
      url: SITE.website,
      logo: {
        "@type": "ImageObject",
        url: new URL("/recette%20facile%20en%20france%20logo.svg", base).href,
        width: 300,
        height: 60,
      },
    },
    recipeCategory: post.category,
    recipeCuisine: "Française",
    recipeYield: "4 portions",
    prepTime: "PT20M",
    cookTime: "PT30M",
    totalTime: "PT50M",
    keywords: `${post.category}, recette française, cuisine française, recette facile, ${post.title}`,
    nutrition: {
      "@type": "NutritionInformation",
      servingSize: "1 portion",
    },
    inLanguage: "fr-FR",
    isAccessibleForFree: true,
  };
}

export function createSupabaseBreadcrumbSchema(post: RecipePost, base: URL) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: new URL("/", base).href,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.category,
        item: new URL(`/categorie/${post.categorySlug}/`, base).href,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: new URL(post.url, base).href,
      },
    ],
  };
}

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

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    mainEntityOfPage: canonical,
    headline: post.metaTitle,
    name: post.title,
    description: post.metaDescription,
    image: [getPostImageUrl(post, base)],
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.publishedAt.toISOString(),
    author: {
      "@type": "Person",
      name: SITE.author,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.title,
      logo: {
        "@type": "ImageObject",
        url: new URL("/favicon.svg", base).href,
      },
    },
    recipeCategory: post.category,
    recipeCuisine: "Française",
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

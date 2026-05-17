import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";
import { getPath } from "@/utils/getPath";
import { getPostCategories } from "@/utils/recipeCategories";

const toAbsoluteUrl = (value: string | undefined, base: URL) =>
  value ? new URL(value, base).href : new URL(`/${SITE.ogImage}`, base).href;

const toIsoDuration = (value?: string) => {
  if (!value) return undefined;
  if (value.startsWith("PT")) return value;
  const minutes = value.match(/\d+/)?.[0];
  return minutes ? `PT${minutes}M` : undefined;
};

export function createBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createRecipeSchema(post: CollectionEntry<"blog">, base: URL) {
  const { data } = post;
  const canonical = new URL(data.canonicalURL ?? getPath(post.id, post.filePath), base).href;
  const image =
    typeof data.featuredImage === "string"
      ? data.featuredImage
      : typeof data.ogImage === "string"
        ? data.ogImage
        : data.featuredImage?.src ?? data.ogImage?.src;

  return {
    "@context": "https://schema.org",
    "@type": data.ingredients?.length || data.instructions?.length ? "Recipe" : "Article",
    mainEntityOfPage: canonical,
    headline: data.title,
    name: data.title,
    description: data.description,
    image: [toAbsoluteUrl(image, base)],
    datePublished: data.pubDatetime.toISOString(),
    ...(data.modDatetime && { dateModified: data.modDatetime.toISOString() }),
    author: { "@type": "Person", name: data.author || SITE.author },
    publisher: {
      "@type": "Organization",
      name: SITE.title,
      logo: { "@type": "ImageObject", url: new URL("/favicon.svg", base).href },
    },
    recipeCuisine: data.cuisine,
    recipeCategory: getPostCategories(data.category, data.categories).join(", "),
    prepTime: toIsoDuration(data.prepTime),
    cookTime: toIsoDuration(data.cookTime),
    totalTime: toIsoDuration(data.totalTime),
    recipeYield: data.recipeYield,
    recipeIngredient: data.ingredients,
    recipeInstructions: data.instructions?.map(step => ({
      "@type": "HowToStep",
      text: step,
    })),
    nutrition: data.nutrition && {
      "@type": "NutritionInformation",
      ...data.nutrition,
    },
  };
}

export function createFaqSchema(faq?: { question: string; answer: string }[]) {
  if (!faq?.length) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

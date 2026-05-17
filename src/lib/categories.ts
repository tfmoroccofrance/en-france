import type { PostQueryResult, RecipeCategory, SupabaseCategoryRow } from "@/types/post";
import { supabase } from "@/lib/supabase";

export const SEO_CATEGORIES: RecipeCategory[] = [
  {
    name: "Recettes économiques",
    slug: "recettes-economiques",
    url: "/categorie/recettes-economiques/",
    metaTitle: "Recettes économiques faciles | En France",
    metaDescription:
      "Découvrez des recettes économiques pour cuisiner maison sans dépasser votre budget.",
  },
  {
    name: "Recettes facile",
    slug: "recettes-facile",
    url: "/categorie/recettes-facile/",
    metaTitle: "Recettes facile et gourmandes | En France",
    metaDescription:
      "Des recettes facile à préparer pour réussir vos repas du quotidien.",
  },
  {
    name: "Repas rapide",
    slug: "repas-rapide",
    url: "/categorie/repas-rapide/",
    metaTitle: "Repas rapide pour tous les jours | En France",
    metaDescription:
      "Idées de repas rapide, simples et pratiques pour cuisiner même quand le temps manque.",
  },
  {
    name: "Cuisine",
    slug: "cuisine",
    url: "/categorie/cuisine/",
    metaTitle: "Cuisine maison, astuces et recettes | En France",
    metaDescription:
      "Guides, recettes et conseils de cuisine pour mieux cuisiner à la maison.",
  },
];

const CATEGORY_META = new Map(SEO_CATEGORIES.map(category => [category.slug, category]));
let categoriesPromise: Promise<PostQueryResult<RecipeCategory[]>> | null = null;

function emptyResult<T>(data: T, error: unknown): PostQueryResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Supabase categories query failed:", message);
  return { data, error: message };
}

export function getCategoryBySlug(slug: string) {
  return SEO_CATEGORIES.find(category => category.slug === slug) ?? null;
}

function toCategory(row: SupabaseCategoryRow): RecipeCategory | null {
  const allowedCategory = CATEGORY_META.get(row.slug);
  if (!allowedCategory) return null;

  return {
    ...allowedCategory,
    id: row.id,
    name: row.name || allowedCategory.name,
  };
}

async function loadSeoCategories(): Promise<PostQueryResult<RecipeCategory[]>> {
  if (!supabase) return { data: SEO_CATEGORIES, error: null };

  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,created_at")
      .in("slug", SEO_CATEGORIES.map(category => category.slug))
      .order("created_at", { ascending: true });

    if (error) return { data: SEO_CATEGORIES, error: error.message };

    const categories = (data ?? [])
      .map(toCategory)
      .filter((category): category is RecipeCategory => Boolean(category));

    return {
      data: categories.length > 0 ? categories : SEO_CATEGORIES,
      error: null,
    };
  } catch (error) {
    return emptyResult(SEO_CATEGORIES, error);
  }
}

export function fetchSeoCategories(): Promise<PostQueryResult<RecipeCategory[]>> {
  categoriesPromise ??= loadSeoCategories();
  return categoriesPromise;
}

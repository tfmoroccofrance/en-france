import type { RecipePost, SupabasePostRow, PostQueryResult } from "@/types/post";
import { supabase } from "@/lib/supabase";
import { fetchSeoCategories, getCategoryBySlug } from "@/lib/categories";

const POST_COLUMNS_WITH_CATEGORY_SLUG =
  "id,title,slug,content,excerpt,featured_image,category,category_slug,published_at,meta_title,meta_description,created_at";
const POST_COLUMNS_WITH_FEATURED =
  "id,title,slug,content,excerpt,featured_image,category,category_slug,is_featured,published_at,meta_title,meta_description,created_at";
const LEGACY_POST_COLUMNS =
  "id,title,slug,content,excerpt,featured_image,category,published_at,meta_title,meta_description,created_at";

const SEO_DEFAULT_CATEGORY = "Cuisine";
const DEFAULT_CATEGORY_SLUG = "cuisine";

const DEFAULT_CATEGORY = "Recettes Françaises";

void DEFAULT_CATEGORY;

const ASTROPAPER_DEMO_SLUGS = new Set([
  "adding-new-posts-in-astropaper-theme",
  "astro-paper-2",
  "astro-paper-v3",
  "astro-paper-v4",
  "astro-paper-v5",
  "customizing-astropaper-theme-color-schemes",
  "dynamic-og-image-generation-in-astropaper-blog-posts",
  "how-to-add-latex-equations-in-blog-posts",
  "how-to-configure-astropaper-theme",
  "how-to-integrate-giscus-comments",
  "how-to-update-dependencies",
  "predefined-color-schemes",
  "setting-dates-via-git-hooks",
  "examples/how-do-i-develop-my-portfolio-and-blog",
  "examples/how-do-i-develop-my-terminal-portfolio-website-with-react",
  "examples/tailwind-typography",
]);

function normalizeSlug(slug: string) {
  return slug.replace(/^\/+|\/+$/g, "");
}

function toPost(row: SupabasePostRow): RecipePost {
  const publishedAt = row.published_at ?? row.created_at ?? new Date().toISOString();
  const title = row.title?.trim() || "Recette";
  const excerpt = row.excerpt?.trim() || row.meta_description?.trim() || "";
  const linkedCategory = row.category_slug
    ? getCategoryBySlug(row.category_slug)
    : null;
  const category = linkedCategory?.name || row.category?.trim() || SEO_DEFAULT_CATEGORY;
  const categorySlug = linkedCategory?.slug || row.category_slug || DEFAULT_CATEGORY_SLUG;
  const description =
    row.meta_description?.trim() ||
    excerpt ||
    `Decouvrez ${title} sur En France.`;

  return {
    id: row.id,
    title,
    slug: normalizeSlug(row.slug),
    url: `/${normalizeSlug(row.slug)}/`,
    content: row.content ?? "",
    excerpt,
    featuredImage: row.featured_image,
    category,
    categorySlug,
    isFeatured: Boolean(row.is_featured),
    publishedAt: new Date(publishedAt),
    metaTitle: row.meta_title?.trim() || title,
    metaDescription: description,
    createdAt: new Date(row.created_at ?? publishedAt),
  };
}

function isDemoPost(row: SupabasePostRow | RecipePost) {
  return ASTROPAPER_DEMO_SLUGS.has(normalizeSlug(row.slug));
}

function toVisiblePosts(rows: SupabasePostRow[] | null | undefined) {
  return (rows ?? []).filter(row => !isDemoPost(row)).map(toPost);
}

function emptyResult<T>(data: T, error: unknown): PostQueryResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Supabase posts query failed:", message);
  return { data, error: message };
}

function byPublishedDate(query: ReturnType<NonNullable<typeof supabase>["from"]>) {
  return query.order("published_at", { ascending: false, nullsFirst: false });
}

function isMissingCategorySlug(error: { message?: string }) {
  return (
    error.message?.includes("category_slug") ||
    error.message?.includes("schema cache")
  );
}

async function selectPosts() {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured.") };

  const result = await byPublishedDate(
    supabase.from("posts").select(POST_COLUMNS_WITH_FEATURED)
  );

  if (!result.error) return result;

  if (
    !isMissingCategorySlug(result.error) &&
    !result.error.message?.includes("is_featured")
  ) {
    return result;
  }

  const categorySlugResult = await byPublishedDate(
    supabase.from("posts").select(POST_COLUMNS_WITH_CATEGORY_SLUG)
  );

  if (!categorySlugResult.error || !isMissingCategorySlug(categorySlugResult.error)) {
    return categorySlugResult;
  }

  return byPublishedDate(supabase.from("posts").select(LEGACY_POST_COLUMNS));
}

export async function fetchAllPosts(): Promise<PostQueryResult<RecipePost[]>> {
  if (!supabase) return { data: [], error: "Supabase is not configured." };

  try {
    const { data, error } = await selectPosts();
    if (error) return emptyResult([], error);

    return {
      data: toVisiblePosts(data),
      error: null,
    };
  } catch (error) {
    return emptyResult([], error);
  }
}

export async function fetchPostBySlug(
  slug: string
): Promise<PostQueryResult<RecipePost | null>> {
  if (!supabase) return { data: null, error: "Supabase is not configured." };

  try {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_COLUMNS_WITH_CATEGORY_SLUG)
      .eq("slug", normalizeSlug(slug))
      .maybeSingle();

    if (error) {
      if (!isMissingCategorySlug(error)) return emptyResult(null, error);

      const legacyResult = await supabase
        .from("posts")
        .select(LEGACY_POST_COLUMNS)
        .eq("slug", normalizeSlug(slug))
        .maybeSingle();

      if (legacyResult.error) return emptyResult(null, legacyResult.error);
      return {
        data:
          legacyResult.data && !isDemoPost(legacyResult.data)
            ? toPost(legacyResult.data)
            : null,
        error: null,
      };
    }
    return { data: data && !isDemoPost(data) ? toPost(data) : null, error: null };
  } catch (error) {
    return emptyResult(null, error);
  }
}

export async function fetchRelatedPostsByCategory(
  category: string,
  currentSlug: string,
  limit = 3
): Promise<PostQueryResult<RecipePost[]>> {
  if (!supabase) return { data: [], error: "Supabase is not configured." };

  try {
    const categorySlug = getCategoryBySlug(category)?.slug ?? category;
    const { data, error } = await byPublishedDate(
      supabase
        .from("posts")
        .select(POST_COLUMNS_WITH_CATEGORY_SLUG)
        .or(`category_slug.eq.${categorySlug},category.eq.${category}`)
        .neq("slug", normalizeSlug(currentSlug))
        .limit(limit)
    );

    if (error) {
      if (!isMissingCategorySlug(error)) return emptyResult([], error);

      const legacyResult = await byPublishedDate(
        supabase
          .from("posts")
          .select(LEGACY_POST_COLUMNS)
          .eq("category", category)
          .neq("slug", normalizeSlug(currentSlug))
          .limit(limit)
      );

      if (legacyResult.error) return emptyResult([], legacyResult.error);
      return {
        data: toVisiblePosts(legacyResult.data),
        error: null,
      };
    }
    return {
      data: toVisiblePosts(data),
      error: null,
    };
  } catch (error) {
    return emptyResult([], error);
  }
}

export async function fetchLatestPosts(
  limit = 6
): Promise<PostQueryResult<RecipePost[]>> {
  if (!supabase) return { data: [], error: "Supabase is not configured." };

  try {
    const { data, error } = await byPublishedDate(
      supabase.from("posts").select(POST_COLUMNS_WITH_CATEGORY_SLUG).limit(limit)
    );

    if (error) {
      if (!isMissingCategorySlug(error)) return emptyResult([], error);

      const legacyResult = await byPublishedDate(
        supabase.from("posts").select(LEGACY_POST_COLUMNS).limit(limit)
      );

      if (legacyResult.error) return emptyResult([], legacyResult.error);
      return {
        data: toVisiblePosts(legacyResult.data),
        error: null,
      };
    }
    if (data && data[0]) {
      console.log("[supabase] raw first post keys:", Object.keys(data[0]).join(", "));
      console.log("[supabase] raw featured_image value:", (data[0] as Record<string, unknown>).featured_image);
    }
    return {
      data: toVisiblePosts(data),
      error: null,
    };
  } catch (error) {
    return emptyResult([], error);
  }
}

export async function fetchFeaturedPosts(
  limit = 6
): Promise<PostQueryResult<RecipePost[]>> {
  if (!supabase) return { data: [], error: "Supabase is not configured." };

  try {
    // Direct lightweight query — avoids fetching full content of every post
    const { data: featured, error: featuredError } = await byPublishedDate(
      supabase
        .from("posts")
        .select(POST_COLUMNS_WITH_FEATURED)
        .eq("is_featured", true)
        .limit(limit)
    );

    if (!featuredError && featured && featured.length > 0) {
      return { data: toVisiblePosts(featured), error: null };
    }

    // is_featured column missing or no featured posts — fall back to latest
    const { data: latest, error: latestError } = await byPublishedDate(
      supabase.from("posts").select(POST_COLUMNS_WITH_CATEGORY_SLUG).limit(limit)
    );

    if (latestError) return emptyResult([], latestError);
    return { data: toVisiblePosts(latest ?? []), error: null };
  } catch (err) {
    return emptyResult([], err);
  }
}

export async function fetchCategories(): Promise<PostQueryResult<string[]>> {
  const { data, error } = await fetchSeoCategories();

  return {
    data: data.map(category => category.name),
    error,
  };
}

export async function fetchPostsByCategory(
  category: string
): Promise<PostQueryResult<RecipePost[]>> {
  if (!supabase) return { data: [], error: "Supabase is not configured." };

  try {
    const seoCategory = getCategoryBySlug(category);
    const categoryName = seoCategory?.name ?? category;
    const categorySlug = seoCategory?.slug ?? category;
    const { data, error } = await byPublishedDate(
      supabase
        .from("posts")
        .select(POST_COLUMNS_WITH_CATEGORY_SLUG)
        .or(`category_slug.eq.${categorySlug},category.eq.${categoryName}`)
    );

    if (error) {
      if (!isMissingCategorySlug(error)) return emptyResult([], error);

      const legacyResult = await byPublishedDate(
        supabase
          .from("posts")
          .select(LEGACY_POST_COLUMNS)
          .eq("category", categoryName)
      );

      if (legacyResult.error) return emptyResult([], legacyResult.error);
      return {
        data: toVisiblePosts(legacyResult.data),
        error: null,
      };
    }
    return {
      data: toVisiblePosts(data),
      error: null,
    };
  } catch (error) {
    return emptyResult([], error);
  }
}

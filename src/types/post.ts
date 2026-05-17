export type SupabasePostRow = {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image: string | null;
  category: string | null;
  category_slug?: string | null;
  is_featured?: boolean | null;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string | null;
};

export type RecipePost = {
  id: string;
  title: string;
  slug: string;
  url: string;
  content: string;
  excerpt: string;
  featuredImage: string | null;
  category: string;
  categorySlug: string;
  isFeatured: boolean;
  publishedAt: Date;
  metaTitle: string;
  metaDescription: string;
  createdAt: Date;
};

export type SupabaseCategoryRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string | null;
};

export type RecipeCategory = {
  id?: string;
  name: string;
  slug: string;
  url: string;
  metaTitle: string;
  metaDescription: string;
};

export type PostQueryResult<T> = {
  data: T;
  error: string | null;
};

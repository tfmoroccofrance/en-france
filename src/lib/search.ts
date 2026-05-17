import type { RecipePost } from "@/types/post";

export type SearchablePost = Pick<
  RecipePost,
  "title" | "slug" | "excerpt" | "category"
>;

export function createSearchIndex(posts: RecipePost[]): SearchablePost[] {
  return posts.map(({ title, slug, excerpt, category }) => ({
    title,
    slug,
    excerpt,
    category,
  }));
}

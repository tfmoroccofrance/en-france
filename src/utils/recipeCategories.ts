export const RECIPE_CATEGORIES = [
  "Petit Déjeuner",
  "Déjeuner",
  "Dîner",
  "Dessert",
  "Recettes Françaises",
  "Cuisine Saine",
  "Boissons",
] as const;

export function getPostCategories(
  category?: string,
  categories?: string[]
): string[] {
  const values = [category, ...(categories ?? [])].filter(Boolean) as string[];
  return [...new Set(values)];
}
